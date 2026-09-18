/** Custom (user-created, private) foods, plus lookup across custom and catalog foods. */
import { toFoodFacts } from '../../core/nutrition.ts';
import type { AnyFood, CustomFood, FoodFacts } from '../../core/types.ts';
import { assertCustomFood } from '../../core/validate.ts';
import { stamp, write } from '../database.ts';
import { getRecord, putRecord } from '../idb.ts';
import { getCatalogFood, getCatalogFoods } from './catalog.ts';
import { getAlive, listAlive, restore, softDelete } from './records.ts';

export type CustomFoodInput = FoodFacts & { id?: string };

export async function listCustomFoods(): Promise<CustomFood[]> {
  const foods = await listAlive<CustomFood>('foods');
  return foods.sort((a, b) => a.name.localeCompare(b.name));
}

export function getCustomFood(id: string): Promise<CustomFood | null> {
  return getAlive<CustomFood>('foods', id);
}

export function saveCustomFood(input: CustomFoodInput): Promise<CustomFood> {
  return write('foods', async (tx) => {
    const store = tx.objectStore('foods');
    const existing = input.id ? await getRecord<CustomFood>(store, input.id) : undefined;
    const record: CustomFood = stamp({
      ...toFoodFacts(input),
      id: input.id,
      createdAt: existing?.createdAt,
      updatedAt: existing?.updatedAt,
      deletedAt: null,
    });
    assertCustomFood(record);
    await putRecord(store, record);
    return record;
  });
}

export function deleteCustomFood(id: string): Promise<void> {
  return softDelete('foods', id);
}

export function restoreCustomFood(id: string): Promise<void> {
  return restore('foods', id);
}

/** Catalog ids are `<pack>:<id>`; custom foods use UUIDs (no colon). */
export function isCatalogId(id: string): boolean {
  return id.includes(':');
}

export async function findFood(id: string): Promise<AnyFood | null> {
  return isCatalogId(id) ? getCatalogFood(id) : getCustomFood(id);
}

/** Every food the search can return: custom foods first, then the catalog. */
export async function listSearchableFoods(): Promise<AnyFood[]> {
  const [custom, catalog] = await Promise.all([listCustomFoods(), getCatalogFoods()]);
  return [...custom, ...catalog];
}
