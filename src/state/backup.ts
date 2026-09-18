/** Backup actions shared by the Data screen, the onboarding and the diary reminder. */
import { APP_NAME, APP_VERSION } from '../config.ts';
import { backupFileName, parseBackup, shouldRemindBackup, type Backup } from '../core/backup.ts';
import { toDayKey, today } from '../core/dates.ts';
import {
  exportBackup,
  getLastBackupAt,
  hasUserData,
  markBackupExported,
} from '../db/repos/data.ts';
import { getMeta, META_KEYS, setMeta } from '../db/repos/meta.ts';
import { fmtDate } from '../i18n/index.svelte.ts';
import { exportFile, pickTextFile } from '../platform/index.ts';

const JSON_TYPE = 'application/json';

/** Exports all personal data as a JSON file. Resolves false if the user cancelled sharing. */
export async function exportBackupFile({ share = false } = {}): Promise<boolean> {
  const backup = await exportBackup({ name: APP_NAME, version: APP_VERSION });
  const text = `${JSON.stringify(backup, null, 1)}\n`;
  const name = backupFileName(today());
  if (!(await exportFile(name, text, JSON_TYPE, { share }))) return false;
  await markBackupExported();
  return true;
}

/** Lets the user choose a backup file and validates it. Throws BackupError on invalid files. */
export async function pickBackupFile(): Promise<Backup | null> {
  const text = await pickTextFile('application/json,.json');
  return text === null ? null : parseBackup(text);
}

export async function shouldShowBackupReminder(now: number = Date.now()): Promise<boolean> {
  const [hasData, firstUseAt, lastBackupAt, dismissedAt] = await Promise.all([
    hasUserData(),
    getMeta<number>(META_KEYS.firstUseAt),
    getLastBackupAt(),
    getMeta<number>(META_KEYS.backupReminderDismissedAt),
  ]);
  return shouldRemindBackup({
    hasData,
    firstUseAt: firstUseAt ?? null,
    lastBackupAt,
    dismissedAt: dismissedAt ?? null,
    now,
  });
}

export function dismissBackupReminder(now: number = Date.now()): Promise<void> {
  return setMeta(META_KEYS.backupReminderDismissedAt, now);
}

export async function markFirstUse(now: number = Date.now()): Promise<void> {
  if ((await getMeta<number>(META_KEYS.firstUseAt)) === undefined) {
    await setMeta(META_KEYS.firstUseAt, now);
  }
}

/** Local date on which a backup was exported, for display. */
export function backupDateLabel(backup: Backup): string {
  const date = new Date(backup.exportedAt);
  return Number.isNaN(date.getTime())
    ? '–'
    : fmtDate(toDayKey(date), { day: 'numeric', month: 'long', year: 'numeric' });
}
