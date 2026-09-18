/**
 * Backup file format: creation, parsing, validation, migration and merging.
 * The same record format (and `mergeRecords`) is what a future sync layer would use.
 */
import { upgradeSettingsV2 } from './migrations.ts';
import type {
  CustomFood,
  DayKey,
  Entry,
  MealTemplate,
  SettingsRecord,
  Synced,
  WeightEntry,
} from './types.ts';
import {
  assertCustomFood,
  assertEntry,
  assertMealTemplate,
  assertSettings,
  assertWeight,
  ValidationError,
} from './validate.ts';

export const BACKUP_FORMAT = 'openfit-backup';
/** Must equal the IndexedDB version (checked by a test). */
export const SCHEMA_VERSION = 2;

export interface BackupData {
  settings: SettingsRecord[];
  foods: CustomFood[];
  meals: MealTemplate[];
  entries: Entry[];
  weights: WeightEntry[];
  /** Optional catalog packs that were installed. */
  packs: string[];
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  app: { name: string; version: string };
  exportedAt: string;
  data: BackupData;
}

export type BackupErrorCode = 'invalid_json' | 'not_a_backup' | 'too_new' | 'invalid_record';

export class BackupError extends Error {
  code: BackupErrorCode;
  detail: string;
  constructor(code: BackupErrorCode, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'BackupError';
    this.code = code;
    this.detail = detail;
  }
}

export function createBackup(
  data: BackupData,
  app: { name: string; version: string },
  now: Date = new Date(),
): Backup {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    app,
    exportedAt: now.toISOString(),
    data,
  };
}

export function backupFileName(date: DayKey): string {
  return `openfit-backup-${date}.json`;
}

type RawData = Record<string, unknown>;

/**
 * Migrations for backup files, keyed by the version they upgrade FROM.
 * Add an entry whenever SCHEMA_VERSION is bumped; never edit a published one.
 */
export const BACKUP_MIGRATIONS: Record<number, (data: RawData) => RawData> = {
  // 1 → 2: profile birth date and required sex, preference defaults.
  1: (data) => ({
    ...data,
    settings: Array.isArray(data.settings)
      ? data.settings.map((record) =>
          typeof record === 'object' && record !== null
            ? upgradeSettingsV2(record as RawData)
            : record,
        )
      : data.settings,
  }),
};

export function migrateBackupData(
  data: RawData,
  fromVersion: number,
  toVersion = SCHEMA_VERSION,
): RawData {
  let current = data;
  for (let version = fromVersion; version < toVersion; version++) {
    const migrate = BACKUP_MIGRATIONS[version];
    if (!migrate) throw new BackupError('not_a_backup', `no migration from version ${version}`);
    current = migrate(current);
  }
  return current;
}

const STORE_VALIDATORS = {
  settings: assertSettings,
  foods: assertCustomFood,
  meals: assertMealTemplate,
  entries: assertEntry,
  weights: assertWeight,
} as const;

function list(data: RawData, key: string): unknown[] {
  const value = data[key] ?? [];
  if (!Array.isArray(value)) throw new BackupError('invalid_record', `${key}: must be an array`);
  return value;
}

/** Parses and fully validates a backup file. Throws `BackupError`; never returns partial data. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('invalid_json');
  }
  if (typeof raw !== 'object' || raw === null) throw new BackupError('not_a_backup');
  const file = raw as Record<string, unknown>;
  if (file.format !== BACKUP_FORMAT) throw new BackupError('not_a_backup');
  const version = file.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new BackupError('not_a_backup', 'missing schemaVersion');
  }
  if (version > SCHEMA_VERSION) throw new BackupError('too_new', String(version));
  if (typeof file.data !== 'object' || file.data === null) throw new BackupError('not_a_backup');

  const data = migrateBackupData(file.data as RawData, version);
  const result: BackupData = {
    settings: [],
    foods: [],
    meals: [],
    entries: [],
    weights: [],
    packs: [],
  };

  try {
    for (const [store, validate] of Object.entries(STORE_VALIDATORS)) {
      const records = list(data, store);
      const ids = new Set<string>();
      records.forEach((record, i) => {
        validate(record, `${store}[${i}]`);
        const id = (record as Synced).id;
        if (ids.has(id)) throw new ValidationError(`${store}[${i}].id`, 'is duplicated');
        ids.add(id);
      });
      (result as unknown as Record<string, unknown[]>)[store] = records;
    }
  } catch (error) {
    if (error instanceof ValidationError) throw new BackupError('invalid_record', error.message);
    throw error;
  }

  const packs = list(data, 'packs');
  if (!packs.every((p) => typeof p === 'string')) {
    throw new BackupError('invalid_record', 'packs: must be strings');
  }
  result.packs = packs as string[];

  const app = (file.app ?? {}) as Record<string, unknown>;
  return {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    app: { name: String(app.name ?? ''), version: String(app.version ?? '') },
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : '',
    data: result,
  };
}

/**
 * Last-writer-wins merge. Returns the incoming records that should be written:
 * new ids, or ids whose incoming `updatedAt` is newer. Ties keep the local copy.
 */
export function mergeRecords<T extends Synced>(local: readonly T[], incoming: readonly T[]): T[] {
  const localById = new Map(local.map((record) => [record.id, record]));
  return incoming.filter((record) => {
    const existing = localById.get(record.id);
    return !existing || record.updatedAt > existing.updatedAt;
  });
}

export interface BackupSummary {
  entries: number;
  foods: number;
  meals: number;
  weights: number;
  hasProfile: boolean;
  firstDate: DayKey | null;
  lastDate: DayKey | null;
}

export function summarizeBackup({ data }: Backup): BackupSummary {
  const alive = <T extends Synced>(records: T[]) => records.filter((r) => !r.deletedAt);
  const dates = alive(data.entries)
    .map((e) => e.date)
    .sort();
  return {
    entries: dates.length,
    foods: alive(data.foods).length,
    meals: alive(data.meals).length,
    weights: alive(data.weights).length,
    hasProfile: data.settings.some((s) => s.id === 'profile' && !s.deletedAt),
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
  };
}

const DAY_MS = 86_400_000;

export interface ReminderInput {
  hasData: boolean;
  firstUseAt: number | null;
  lastBackupAt: number | null;
  dismissedAt: number | null;
  now: number;
}

/**
 * Whether to nudge the user to export a backup: only after a few days of use,
 * when the last backup is old (or missing), and not right after a dismissal.
 */
export function shouldRemindBackup({
  hasData,
  firstUseAt,
  lastBackupAt,
  dismissedAt,
  now,
}: ReminderInput): boolean {
  if (!hasData) return false;
  if (firstUseAt !== null && now - firstUseAt < 3 * DAY_MS) return false;
  if (lastBackupAt !== null && now - lastBackupAt < 14 * DAY_MS) return false;
  if (dismissedAt !== null && now - dismissedAt < 7 * DAY_MS) return false;
  return true;
}
