/** Diary entries: what was eaten, when, and how much. */
import { addDays } from '../../core/dates.ts';
import { macrosFor, toFoodFacts } from '../../core/nutrition.ts';
import type { CustomFood, DayKey, Entry, FoodFacts, Unit } from '../../core/types.ts';
import { assertEntry } from '../../core/validate.ts';
import { isAlive, read, stamp, write } from '../database.ts';
import { getAllRecords, getRecord, putRecord } from '../idb.ts';
import { getCatalogFoods } from './catalog.ts';
import { isCatalogId } from './foods.ts';
import { restore, softDelete } from './records.ts';

export interface NewEntry {
  date: DayKey;
  meal: string;
  foodId: string;
  food: FoodFacts;
  amount: number;
  unit: Unit;
}

export type EntryPatch = Partial<Pick<Entry, 'date' | 'meal' | 'amount' | 'unit'>>;

const byCreation = (a: Entry, b: Entry) => a.createdAt - b.createdAt || a.id.localeCompare(b.id);

export async function listEntries(date: DayKey): Promise<Entry[]> {
  const entries = await read('entries', (tx) =>
    getAllRecords<Entry>(tx.objectStore('entries').index('date'), date),
  );
  return entries.filter(isAlive).sort(byCreation);
}

/** Entries between two dates, inclusive, ordered by date. */
export async function listEntriesBetween(from: DayKey, to: DayKey): Promise<Entry[]> {
  const entries = await read('entries', (tx) =>
    getAllRecords<Entry>(tx.objectStore('entries').index('date'), IDBKeyRange.bound(from, to)),
  );
  return entries.filter(isAlive).sort((a, b) => a.date.localeCompare(b.date) || byCreation(a, b));
}

export async function listAllEntries(): Promise<Entry[]> {
  const entries = await read('entries', (tx) => getAllRecords<Entry>(tx.objectStore('entries')));
  return entries.filter(isAlive).sort((a, b) => a.date.localeCompare(b.date) || byCreation(a, b));
}

export async function datesWithEntries(from: DayKey, to: DayKey): Promise<Set<DayKey>> {
  return new Set((await listEntriesBetween(from, to)).map((entry) => entry.date));
}

function checkQuantity(entry: Pick<Entry, 'food' | 'amount' | 'unit'>): void {
  if (macrosFor(entry.food, entry.amount, entry.unit) === null) {
    throw new RangeError(`Unit "${entry.unit}" does not apply to ${entry.food.name}`);
  }
}

export function addEntries(list: NewEntry[], now: number = Date.now()): Promise<Entry[]> {
  return write('entries', async (tx) => {
    const store = tx.objectStore('entries');
    const created = list.map((item, i) => {
      // Consecutive timestamps keep the insertion order stable.
      const entry: Entry = stamp({ ...item, food: toFoodFacts(item.food) }, now + i);
      assertEntry(entry);
      checkQuantity(entry);
      return entry;
    });
    await Promise.all(created.map((entry) => putRecord(store, entry)));
    return created;
  });
}

export async function addEntry(entry: NewEntry): Promise<Entry> {
  const [created] = await addEntries([entry]);
  return created!;
}

export function updateEntry(id: string, patch: EntryPatch): Promise<Entry> {
  return write('entries', async (tx) => {
    const store = tx.objectStore('entries');
    const current = await getRecord<Entry>(store, id);
    if (!current || !isAlive(current)) throw new Error(`Entry ${id} not found`);
    const entry: Entry = stamp({ ...current, ...patch });
    assertEntry(entry);
    checkQuantity(entry);
    await putRecord(store, entry);
    return entry;
  });
}

export function deleteEntry(id: string): Promise<void> {
  return softDelete('entries', id);
}

export function restoreEntry(id: string): Promise<void> {
  return restore('entries', id);
}

export interface RecentFood {
  foodId: string;
  /** Current facts when the food still exists, otherwise the last snapshot. */
  food: FoodFacts;
  amount: number;
  unit: Unit;
  lastUsed: number;
  uses: number;
}

/**
 * Foods logged recently, most recent first, with the last quantity used.
 * Deleted custom foods are left out.
 */
export async function recentFoods({
  today,
  days = 90,
  limit = 40,
}: {
  today: DayKey;
  days?: number;
  limit?: number;
}): Promise<RecentFood[]> {
  const [entries, customFoods] = await read(['entries', 'foods'], (tx) =>
    Promise.all([
      getAllRecords<Entry>(
        tx.objectStore('entries').index('date'),
        IDBKeyRange.lowerBound(addDays(today, -days)),
      ),
      getAllRecords<CustomFood>(tx.objectStore('foods')),
    ]),
  );
  const custom = new Map(customFoods.map((food) => [food.id, food]));
  const catalog = new Map((await getCatalogFoods()).map((food) => [food.id, food]));

  const recent = new Map<string, RecentFood>();
  const newestFirst = (a: Entry, b: Entry) =>
    b.updatedAt - a.updatedAt || b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
  for (const entry of entries.filter(isAlive).sort(newestFirst)) {
    const existing = recent.get(entry.foodId);
    if (existing) {
      existing.uses++;
      continue;
    }
    const current = isCatalogId(entry.foodId)
      ? catalog.get(entry.foodId)
      : custom.get(entry.foodId);
    if (!isCatalogId(entry.foodId) && !isAlive(current)) continue;
    const facts = current ? toFoodFacts(current) : entry.food;
    // If the food changed so that the old unit no longer applies, keep the snapshot.
    const food = macrosFor(facts, entry.amount, entry.unit) ? facts : entry.food;
    recent.set(entry.foodId, {
      foodId: entry.foodId,
      food,
      amount: entry.amount,
      unit: entry.unit,
      lastUsed: entry.updatedAt,
      uses: 1,
    });
  }
  return [...recent.values()].slice(0, limit);
}
