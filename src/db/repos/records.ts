/** Generic helpers for stores holding `Synced` records. */
import type { Synced } from '../../core/types.ts';
import { isAlive, read, stamp, write } from '../database.ts';
import { getAllRecords, getRecord, putRecord } from '../idb.ts';
import type { UserStore } from '../schema.ts';

export async function listAlive<T extends Synced>(store: UserStore): Promise<T[]> {
  const records = await read(store, (tx) => getAllRecords<T>(tx.objectStore(store)));
  return records.filter(isAlive);
}

export async function getAlive<T extends Synced>(store: UserStore, id: string): Promise<T | null> {
  const record = await read(store, (tx) => getRecord<T>(tx.objectStore(store), id));
  return record && isAlive(record) ? record : null;
}

/** Marks a record as deleted (tombstone) so deletions can be merged and undone. */
export function softDelete(store: UserStore, id: string): Promise<void> {
  return setDeleted(store, id, true);
}

export function restore(store: UserStore, id: string): Promise<void> {
  return setDeleted(store, id, false);
}

async function setDeleted(store: UserStore, id: string, deleted: boolean): Promise<void> {
  await write(store, async (tx) => {
    const objectStore = tx.objectStore(store);
    const record = await getRecord<Synced>(objectStore, id);
    if (!record) return;
    const now = Date.now();
    await putRecord(objectStore, { ...stamp(record, now), deletedAt: deleted ? now : null });
  });
}
