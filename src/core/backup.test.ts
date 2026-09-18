import { describe, expect, it } from 'vitest';
import {
  BACKUP_MIGRATIONS,
  BackupError,
  createBackup,
  mergeRecords,
  migrateBackupData,
  parseBackup,
  shouldRemindBackup,
  summarizeBackup,
  type BackupData,
} from './backup.ts';
import type { Entry, Profile } from './types.ts';

const food = {
  name: 'Egg',
  baseAmount: 100,
  baseUnit: 'g' as const,
  macros: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
  unitSize: 50,
};

const entry = (id: string, date: string, extra: Partial<Entry> = {}): Entry => ({
  id,
  createdAt: 1,
  updatedAt: 1,
  date,
  meal: 'breakfast',
  foodId: 'base:egg',
  food,
  amount: 2,
  unit: 'unit',
  ...extra,
});

const profile: Profile = {
  id: 'profile',
  createdAt: 1,
  updatedAt: 1,
  birthDate: '1990-05-20',
  heightCm: 170,
  sex: 'female',
  activity: 'light',
  targetWeightKg: 65,
  goals: { kcal: 2000, protein: 100, carbs: 250, fat: 65 },
};

const data = (overrides: Partial<BackupData> = {}): BackupData => ({
  settings: [
    profile,
    {
      id: 'prefs',
      createdAt: 1,
      updatedAt: 1,
      locale: 'es',
      theme: 'system',
      accent: 'green',
      weightUnit: 'kg',
    },
  ],
  foods: [{ ...food, id: 'f1', createdAt: 1, updatedAt: 1, name: 'Arroz casero' }],
  meals: [
    {
      id: 'm1',
      createdAt: 1,
      updatedAt: 1,
      name: 'Desayuno',
      items: [{ foodId: 'base:egg', food, amount: 2, unit: 'unit' }],
    },
  ],
  entries: [
    entry('e1', '2026-09-15'),
    entry('e2', '2026-09-16'),
    entry('e3', '2026-09-01', { deletedAt: 5 }),
  ],
  weights: [{ id: 'weight:2026-09-16', createdAt: 1, updatedAt: 1, date: '2026-09-16', kg: 70.5 }],
  packs: ['usda-sr-legacy'],
  ...overrides,
});

const app = { name: 'OpenFit', version: '0.1.0' };

function expectBackupError(text: string, code: BackupError['code']) {
  try {
    parseBackup(text);
  } catch (error) {
    expect(error).toBeInstanceOf(BackupError);
    expect((error as BackupError).code).toBe(code);
    return error as BackupError;
  }
  throw new Error('expected parseBackup to throw');
}

describe('createBackup / parseBackup', () => {
  it('round-trips a complete backup', () => {
    const backup = createBackup(data(), app, new Date('2026-09-16T10:00:00Z'));
    expect(backup.schemaVersion).toBe(2);
    expect(backup.exportedAt).toBe('2026-09-16T10:00:00.000Z');
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  });

  it('migrates version 1 backups', () => {
    const v1 = {
      format: 'openfit-backup',
      schemaVersion: 1,
      data: {
        settings: [
          {
            id: 'profile',
            createdAt: 1,
            updatedAt: 1,
            birthYear: 1990,
            heightCm: 170,
            sex: null,
            activity: 'light',
            targetWeightKg: null,
            goals: profile.goals,
          },
          { id: 'prefs', createdAt: 1, updatedAt: 1, locale: null, theme: 'dark' },
        ],
      },
    };
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.data.settings[0]).toMatchObject({ birthDate: '1990-07-01', sex: 'male' });
    expect(parsed.data.settings[1]).toMatchObject({
      theme: 'dark',
      accent: 'green',
      weightUnit: 'kg',
    });
  });

  it('treats missing stores as empty', () => {
    const parsed = parseBackup(
      JSON.stringify({ format: 'openfit-backup', schemaVersion: 2, data: { entries: [] } }),
    );
    expect(parsed.data.foods).toEqual([]);
    expect(parsed.data.packs).toEqual([]);
  });

  it('rejects files that are not backups', () => {
    expectBackupError('not json', 'invalid_json');
    expectBackupError('[]', 'not_a_backup');
    expectBackupError('{"format":"other","schemaVersion":1,"data":{}}', 'not_a_backup');
    expectBackupError('{"format":"openfit-backup","data":{}}', 'not_a_backup');
    expectBackupError('{"format":"openfit-backup","schemaVersion":2}', 'not_a_backup');
  });

  it('rejects backups from a newer app', () => {
    expectBackupError('{"format":"openfit-backup","schemaVersion":99,"data":{}}', 'too_new');
  });

  it('rejects invalid records with a precise path', () => {
    const bad = createBackup(
      data({ entries: [entry('e1', '2026-09-15'), entry('e2', '2026-02-30')] }),
      app,
    );
    const error = expectBackupError(JSON.stringify(bad), 'invalid_record');
    expect(error.detail).toContain('entries[1].date');

    const negative = createBackup(
      data({ entries: [entry('e1', '2026-09-15', { amount: -1 })] }),
      app,
    );
    expect(expectBackupError(JSON.stringify(negative), 'invalid_record').detail).toContain(
      'amount',
    );

    const badUnit = JSON.parse(JSON.stringify(createBackup(data(), app)));
    badUnit.data.foods[0].baseUnit = 'oz';
    expect(expectBackupError(JSON.stringify(badUnit), 'invalid_record').detail).toContain(
      'baseUnit',
    );

    const badSettings = JSON.parse(JSON.stringify(createBackup(data(), app)));
    badSettings.data.settings[0].activity = 'couch';
    expectBackupError(JSON.stringify(badSettings), 'invalid_record');
  });

  it('rejects duplicated ids', () => {
    const dup = createBackup(
      data({ entries: [entry('e1', '2026-09-15'), entry('e1', '2026-09-16')] }),
      app,
    );
    expect(expectBackupError(JSON.stringify(dup), 'invalid_record').detail).toContain('duplicated');
  });
});

describe('migrateBackupData', () => {
  it('applies migrations in order', () => {
    BACKUP_MIGRATIONS[8] = (d) => ({ ...d, step: [8] });
    BACKUP_MIGRATIONS[9] = (d) => ({ ...d, step: [...(d.step as number[]), 9] });
    try {
      expect(migrateBackupData({}, 8, 10)).toEqual({ step: [8, 9] });
      expect(migrateBackupData({ a: 1 }, 3, 3)).toEqual({ a: 1 });
    } finally {
      delete BACKUP_MIGRATIONS[8];
      delete BACKUP_MIGRATIONS[9];
    }
  });

  it('fails when a migration is missing', () => {
    expect(() => migrateBackupData({}, 5, 6)).toThrow(BackupError);
  });
});

describe('mergeRecords', () => {
  it('keeps the most recent write and adds new records', () => {
    const local = [
      entry('a', '2026-09-01', { updatedAt: 10 }),
      entry('b', '2026-09-01', { updatedAt: 10 }),
    ];
    const incoming = [
      entry('a', '2026-09-02', { updatedAt: 5 }), // older: ignored
      entry('b', '2026-09-02', { updatedAt: 20 }), // newer: wins
      entry('c', '2026-09-02', { updatedAt: 1 }), // new
      entry('a', '2026-09-03', { updatedAt: 10 }), // tie: local wins
    ];
    expect(mergeRecords(local, incoming).map((r) => `${r.id}@${r.updatedAt}`)).toEqual([
      'b@20',
      'c@1',
    ]);
  });

  it('propagates tombstones', () => {
    const local = [entry('a', '2026-09-01', { updatedAt: 10 })];
    const incoming = [entry('a', '2026-09-01', { updatedAt: 11, deletedAt: 11 })];
    expect(mergeRecords(local, incoming)[0]?.deletedAt).toBe(11);
  });
});

describe('summarizeBackup', () => {
  it('counts live records and the date range', () => {
    expect(summarizeBackup(createBackup(data(), app))).toEqual({
      entries: 2,
      foods: 1,
      meals: 1,
      weights: 1,
      hasProfile: true,
      firstDate: '2026-09-15',
      lastDate: '2026-09-16',
    });
  });
});

describe('shouldRemindBackup', () => {
  const day = 86_400_000;
  const now = 100 * day;
  const base = {
    hasData: true,
    firstUseAt: now - 30 * day,
    lastBackupAt: null,
    dismissedAt: null,
    now,
  };

  it('reminds users with data and no recent backup', () => {
    expect(shouldRemindBackup(base)).toBe(true);
    expect(shouldRemindBackup({ ...base, lastBackupAt: now - 15 * day })).toBe(true);
  });

  it('stays quiet otherwise', () => {
    expect(shouldRemindBackup({ ...base, hasData: false })).toBe(false);
    expect(shouldRemindBackup({ ...base, firstUseAt: now - day })).toBe(false);
    expect(shouldRemindBackup({ ...base, lastBackupAt: now - 2 * day })).toBe(false);
    expect(shouldRemindBackup({ ...base, dismissedAt: now - 2 * day })).toBe(false);
    expect(shouldRemindBackup({ ...base, dismissedAt: now - 8 * day })).toBe(true);
  });
});
