/** Body weight log: at most one record per day (deterministic id). */
import { weightId } from '../../core/ids.ts';
import type { DayKey, WeightEntry } from '../../core/types.ts';
import { assertWeight } from '../../core/validate.ts';
import { stamp, write } from '../database.ts';
import { getRecord, putRecord } from '../idb.ts';
import { listAlive, restore, softDelete } from './records.ts';

/** Oldest first. */
export async function listWeights(): Promise<WeightEntry[]> {
  const weights = await listAlive<WeightEntry>('weights');
  return weights.sort((a, b) => a.date.localeCompare(b.date));
}

export async function latestWeight(): Promise<WeightEntry | null> {
  return (await listWeights()).at(-1) ?? null;
}

/** Creates or replaces the weight of a day (also revives a deleted one). */
export function setWeight(date: DayKey, kg: number): Promise<WeightEntry> {
  return write('weights', async (tx) => {
    const store = tx.objectStore('weights');
    const id = weightId(date);
    const existing = await getRecord<WeightEntry>(store, id);
    const weight: WeightEntry = stamp({
      id,
      date,
      kg,
      createdAt: existing?.createdAt,
      updatedAt: existing?.updatedAt,
      deletedAt: null,
    });
    assertWeight(weight);
    await putRecord(store, weight);
    return weight;
  });
}

export function deleteWeight(id: string): Promise<void> {
  return softDelete('weights', id);
}

export function restoreWeight(id: string): Promise<void> {
  return restore('weights', id);
}
