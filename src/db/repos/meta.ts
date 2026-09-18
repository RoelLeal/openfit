/** Device-local technical data. Never backed up or synced. */
import { newId } from '../../core/ids.ts';
import { read, write } from '../database.ts';
import { deleteRecord, getAllRecords, getRecord, putRecord } from '../idb.ts';

export interface MetaRecord<T = unknown> {
  key: string;
  value: T;
}

export const META_KEYS = {
  deviceId: 'deviceId',
  lastBackupAt: 'lastBackupAt',
  backupReminderDismissedAt: 'backupReminderDismissedAt',
  firstUseAt: 'firstUseAt',
  packPrefix: 'pack:',
} as const;

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const record = await read('meta', (tx) => getRecord<MetaRecord<T>>(tx.objectStore('meta'), key));
  return record?.value;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await write('meta', (tx) => putRecord(tx.objectStore('meta'), { key, value }));
}

export async function deleteMeta(key: string): Promise<void> {
  await write('meta', (tx) => deleteRecord(tx.objectStore('meta'), key));
}

export async function listMeta<T>(prefix: string): Promise<MetaRecord<T>[]> {
  const records = await read('meta', (tx) => getAllRecords<MetaRecord<T>>(tx.objectStore('meta')));
  return records.filter((record) => record.key.startsWith(prefix));
}

/** Random id of this installation; useful for tie-breaking in a future sync. */
export async function getDeviceId(): Promise<string> {
  const existing = await getMeta<string>(META_KEYS.deviceId);
  if (existing) return existing;
  const id = newId();
  await setMeta(META_KEYS.deviceId, id);
  return id;
}
