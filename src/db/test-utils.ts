/** Test helpers: a fresh in-memory IndexedDB for every test. */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach } from 'vitest';
import type { FoodFacts } from '../core/types.ts';
import { closeDb } from './database.ts';

export function useFreshDatabase(): void {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });
  afterEach(async () => {
    await closeDb();
  });
}

export const eggFacts: FoodFacts = {
  name: 'Egg',
  names: { es: 'Huevo' },
  baseAmount: 100,
  baseUnit: 'g',
  macros: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
  unitSize: 50,
};

export const riceFacts: FoodFacts = {
  name: 'Arroz casero',
  baseAmount: 100,
  baseUnit: 'g',
  macros: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
};
