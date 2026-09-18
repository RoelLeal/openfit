/**
 * Public nutrition catalog: the bundled base pack plus optional packs.
 * Kept apart from personal data; never included in backups (only pack ids are).
 */
import {
  BASE_PACK_ID,
  parsePack,
  PackError,
  type Pack,
  type PackListing,
} from '../../catalog/packs.ts';
import type { CatalogFood } from '../../core/types.ts';
import { onChange } from '../changes.ts';
import { read, write } from '../database.ts';
import { deleteByIndex, deleteRecord, getAllRecords, getRecord, putRecord } from '../idb.ts';
import { getMeta, listMeta, META_KEYS, type MetaRecord } from './meta.ts';

export interface InstalledPack {
  id: string;
  version: string;
  name: string;
  description?: string;
  license: string;
  attribution: string;
  source: string;
  foods: number;
  installedAt: number;
}

const packKey = (id: string) => `${META_KEYS.packPrefix}${id}`;

let cache: Promise<CatalogFood[]> | null = null;
onChange((stores) => {
  if (stores.includes('catalog')) cache = null;
});

/** All catalog foods, loaded once per session (search runs in memory). */
export function getCatalogFoods(): Promise<CatalogFood[]> {
  cache ??= read('catalog', (tx) => getAllRecords<CatalogFood>(tx.objectStore('catalog'))).catch(
    (error: unknown) => {
      cache = null;
      throw error;
    },
  );
  return cache;
}

export async function getCatalogFood(id: string): Promise<CatalogFood | null> {
  const food = await read('catalog', (tx) => getRecord<CatalogFood>(tx.objectStore('catalog'), id));
  return food ?? null;
}

/** Replaces all foods of a pack atomically. */
export async function installPack(pack: Pack, now: number = Date.now()): Promise<InstalledPack> {
  const { foods, ...info } = pack;
  const installed: InstalledPack = { ...info, foods: foods.length, installedAt: now };
  await write(['catalog', 'meta'], async (tx) => {
    const store = tx.objectStore('catalog');
    await deleteByIndex(store.index('pack'), pack.id);
    // Fire all puts at once; the transaction commits when every request is done.
    for (const food of foods) store.put(food);
    await putRecord(tx.objectStore('meta'), { key: packKey(pack.id), value: installed });
  });
  return installed;
}

export async function removePack(id: string): Promise<void> {
  if (id === BASE_PACK_ID) throw new PackError('The base pack cannot be removed');
  await write(['catalog', 'meta'], async (tx) => {
    await deleteByIndex(tx.objectStore('catalog').index('pack'), id);
    await deleteRecord(tx.objectStore('meta'), packKey(id));
  });
}

export async function listInstalledPacks(): Promise<InstalledPack[]> {
  const records: MetaRecord<InstalledPack>[] = await listMeta(META_KEYS.packPrefix);
  return records.map((record) => record.value).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Seeds the base pack on first run and whenever the bundled version changes.
 * The JSON is only downloaded (from the precache) when it is actually needed.
 */
export async function ensureBaseCatalog(
  version: string = __BASE_CATALOG_VERSION__,
  load: () => Promise<unknown> = () =>
    import('../../catalog/base-foods.json').then((m) => m.default),
): Promise<boolean> {
  const current = await getMeta<InstalledPack>(packKey(BASE_PACK_ID));
  if (current?.version === version) return false;
  await installPack(parsePack(await load()));
  return true;
}

/** Lists optional packs published next to the app (`packs/index.json`). Needs network. */
export async function fetchAvailablePacks(baseUrl: string): Promise<PackListing[]> {
  const response = await fetch(new URL('packs/index.json', baseUrl), { cache: 'no-cache' });
  if (!response.ok) throw new PackError(`HTTP ${response.status}`);
  const body = (await response.json()) as { packs?: PackListing[] };
  return Array.isArray(body.packs) ? body.packs : [];
}

export async function downloadAndInstallPack(
  baseUrl: string,
  listing: PackListing,
): Promise<InstalledPack> {
  const response = await fetch(new URL(`packs/${listing.file}`, baseUrl), { cache: 'no-cache' });
  if (!response.ok) throw new PackError(`HTTP ${response.status}`);
  const pack = parsePack(await response.json());
  if (pack.id !== listing.id) throw new PackError(`Expected pack ${listing.id}, got ${pack.id}`);
  return installPack(pack);
}

/**
 * Installs (or updates) the packs marked `default` in packs/index.json. The files ship
 * with the app (precached in the PWA, bundled in the native apps), so this works offline
 * after the first load. Failures are logged and retried on the next start.
 */
export async function ensureDefaultPacks(baseUrl: string): Promise<string[]> {
  const installed = new Map((await listInstalledPacks()).map((pack) => [pack.id, pack.version]));
  const listings = await fetchAvailablePacks(baseUrl);
  const updated: string[] = [];
  for (const listing of listings) {
    if (!listing.default || installed.get(listing.id) === listing.version) continue;
    await downloadAndInstallPack(baseUrl, listing);
    updated.push(listing.id);
  }
  return updated;
}
