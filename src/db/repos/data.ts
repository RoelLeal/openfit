/** Data ownership: backup, restore, CSV export and "delete everything". */
import { createBackup, mergeRecords, type Backup, type BackupData } from '../../core/backup.ts';
import { customFoodsCsv, dailyTotalsCsv, entriesCsv, weightsCsv } from '../../core/exports.ts';
import type { Locale, Synced } from '../../core/types.ts';
import { BASE_PACK_ID } from '../../catalog/packs.ts';
import { read, write } from '../database.ts';
import { clearStore, deleteRecord, getAllRecords, putRecord, requestToPromise } from '../idb.ts';
import { USER_STORES, type UserStore } from '../schema.ts';
import { listInstalledPacks } from './catalog.ts';
import { listAllEntries } from './entries.ts';
import { listCustomFoods } from './foods.ts';
import { getMeta, META_KEYS, setMeta, type MetaRecord } from './meta.ts';
import { getProfile } from './settings.ts';
import { listWeights } from './weights.ts';

export type RestoreMode = 'replace' | 'merge';

/** Everything personal, including tombstones (so merges propagate deletions). */
export async function exportBackup(app: { name: string; version: string }): Promise<Backup> {
  const stores = await read([...USER_STORES], (tx) =>
    Promise.all(USER_STORES.map((store) => getAllRecords<Synced>(tx.objectStore(store)))),
  );
  const packs = (await listInstalledPacks()).map((p) => p.id).filter((id) => id !== BASE_PACK_ID);
  const data = Object.fromEntries(USER_STORES.map((store, i) => [store, stores[i]])) as Omit<
    BackupData,
    'packs'
  >;
  return createBackup({ ...data, packs }, app);
}

/** Writes a validated backup in a single transaction: it either fully applies or not at all. */
export async function importBackup(backup: Backup, mode: RestoreMode): Promise<void> {
  await write([...USER_STORES], async (tx) => {
    for (const store of USER_STORES) {
      const objectStore = tx.objectStore(store);
      const incoming = backup.data[store] as Synced[];
      let records = incoming;
      if (mode === 'replace') {
        await clearStore(objectStore);
      } else {
        records = mergeRecords(await getAllRecords<Synced>(objectStore), incoming);
      }
      await Promise.all(records.map((record) => putRecord(objectStore, record)));
    }
  });
}

/** Physically removes all personal data. The public catalog stays installed. */
export async function deleteAllData(): Promise<void> {
  await write([...USER_STORES, 'meta'], async (tx) => {
    await Promise.all(USER_STORES.map((store: UserStore) => clearStore(tx.objectStore(store))));
    const meta = tx.objectStore('meta');
    const records = await getAllRecords<MetaRecord>(meta);
    await Promise.all(
      records
        .filter((record) => !record.key.startsWith(META_KEYS.packPrefix))
        .map((record) => deleteRecord(meta, record.key)),
    );
  });
}

export async function hasUserData(): Promise<boolean> {
  const counts = await read(['entries', 'foods', 'meals', 'weights'], (tx) =>
    Promise.all(
      (['entries', 'foods', 'meals', 'weights'] as const).map((store) =>
        requestToPromise(tx.objectStore(store).count()),
      ),
    ),
  );
  return counts.some((count) => count > 0);
}

export async function getLastBackupAt(): Promise<number | null> {
  return (await getMeta<number>(META_KEYS.lastBackupAt)) ?? null;
}

export function markBackupExported(now: number = Date.now()): Promise<void> {
  return setMeta(META_KEYS.lastBackupAt, now);
}

export type CsvKind = 'entries' | 'daily-totals' | 'weight' | 'custom-foods';
export const CSV_KINDS: readonly CsvKind[] = ['entries', 'daily-totals', 'weight', 'custom-foods'];

export async function buildCsv(kind: CsvKind, locale: Locale): Promise<string> {
  switch (kind) {
    case 'entries':
      return entriesCsv(await listAllEntries(), locale);
    case 'daily-totals': {
      const [entries, profile] = await Promise.all([listAllEntries(), getProfile()]);
      return dailyTotalsCsv(entries, profile?.goals ?? null);
    }
    case 'weight':
      return weightsCsv(await listWeights());
    case 'custom-foods':
      return customFoodsCsv(await listCustomFoods());
  }
}
