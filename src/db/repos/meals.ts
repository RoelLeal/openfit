/** Reusable meals (templates) that log several foods at once. */
import { macrosFor, toFoodFacts } from '../../core/nutrition.ts';
import type { DayKey, Entry, MealItem, MealTemplate } from '../../core/types.ts';
import { assertMealTemplate } from '../../core/validate.ts';
import { stamp, write } from '../database.ts';
import { getRecord, putRecord } from '../idb.ts';
import { addEntries } from './entries.ts';
import { findFood } from './foods.ts';
import { getAlive, listAlive, restore, softDelete } from './records.ts';

export interface MealInput {
  id?: string;
  name: string;
  items: MealItem[];
}

export async function listMeals(): Promise<MealTemplate[]> {
  const meals = await listAlive<MealTemplate>('meals');
  return meals.sort((a, b) => a.name.localeCompare(b.name));
}

export function getMeal(id: string): Promise<MealTemplate | null> {
  return getAlive<MealTemplate>('meals', id);
}

export function saveMeal(input: MealInput): Promise<MealTemplate> {
  return write('meals', async (tx) => {
    const store = tx.objectStore('meals');
    const existing = input.id ? await getRecord<MealTemplate>(store, input.id) : undefined;
    const meal: MealTemplate = stamp({
      name: input.name.trim(),
      items: input.items.map((item) => ({
        foodId: item.foodId,
        food: toFoodFacts(item.food),
        amount: item.amount,
        unit: item.unit,
      })),
      id: input.id,
      createdAt: existing?.createdAt,
      updatedAt: existing?.updatedAt,
      deletedAt: null,
    });
    assertMealTemplate(meal);
    await putRecord(store, meal);
    return meal;
  });
}

export function mealFromEntries(name: string, entries: Entry[]): Promise<MealTemplate> {
  return saveMeal({
    name,
    items: entries.map(({ foodId, food, amount, unit }) => ({ foodId, food, amount, unit })),
  });
}

export function deleteMeal(id: string): Promise<void> {
  return softDelete('meals', id);
}

export function restoreMeal(id: string): Promise<void> {
  return restore('meals', id);
}

/** Logs every item of a meal, using the latest version of each food when possible. */
export async function logMeal(meal: MealTemplate, date: DayKey, slot: string): Promise<Entry[]> {
  const items = await Promise.all(
    meal.items.map(async (item) => {
      const current = await findFood(item.foodId);
      const facts = current ? toFoodFacts(current) : item.food;
      const food = macrosFor(facts, item.amount, item.unit) ? facts : item.food;
      return { date, meal: slot, foodId: item.foodId, food, amount: item.amount, unit: item.unit };
    }),
  );
  return addEntries(items);
}
