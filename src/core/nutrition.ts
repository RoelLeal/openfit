/** Nutrition math. Values are kept as floats and only rounded for display. */
import type { Entry, FoodFacts, Macros, Unit } from './types.ts';
import { toBaseAmount } from './units.ts';

export const MACRO_KEYS = ['protein', 'carbs', 'fat'] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

export const ZERO_MACROS: Readonly<Macros> = Object.freeze({
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
});

export function scaleMacros(macros: Macros, factor: number): Macros {
  return {
    kcal: macros.kcal * factor,
    protein: macros.protein * factor,
    carbs: macros.carbs * factor,
    fat: macros.fat * factor,
  };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function sumMacros(list: Iterable<Macros>): Macros {
  let total: Macros = { ...ZERO_MACROS };
  for (const macros of list) total = addMacros(total, macros);
  return total;
}

/** Macros of `amount` `unit` of a food, or null if the unit does not apply. */
export function macrosFor(food: FoodFacts, amount: number, unit: Unit): Macros | null {
  const base = toBaseAmount(food, amount, unit);
  if (base === null || !(food.baseAmount > 0)) return null;
  return scaleMacros(food.macros, base / food.baseAmount);
}

/** Copies only the nutrition facts of a food (used for immutable snapshots). */
export function toFoodFacts(food: FoodFacts): FoodFacts {
  const facts: FoodFacts = {
    name: food.name.trim(),
    baseAmount: food.baseAmount,
    baseUnit: food.baseUnit,
    macros: {
      kcal: food.macros.kcal,
      protein: food.macros.protein,
      carbs: food.macros.carbs,
      fat: food.macros.fat,
    },
  };
  if (food.names && Object.keys(food.names).length > 0) facts.names = { ...food.names };
  const brand = food.brand?.trim();
  if (brand) facts.brand = brand;
  if (food.unitSize) facts.unitSize = food.unitSize;
  if (food.servingSize) facts.servingSize = food.servingSize;
  return facts;
}

export function entryMacros(entry: Pick<Entry, 'food' | 'amount' | 'unit'>): Macros {
  return macrosFor(entry.food, entry.amount, entry.unit) ?? { ...ZERO_MACROS };
}

/** Atwater general factors: 4 kcal/g protein and carbs, 9 kcal/g fat. */
export function kcalFromMacros(macros: Pick<Macros, MacroKey>): number {
  return macros.protein * 4 + macros.carbs * 4 + macros.fat * 9;
}

export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  // Adding EPSILON avoids 1.005 → 1.00 style errors.
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Share of a goal reached, as a 0..n ratio. A missing goal counts as 0. */
export function progress(value: number, goal: number): number {
  return goal > 0 ? value / goal : 0;
}

/** Groups entries by meal slot, preserving insertion order inside each group. */
export function groupByMeal<T extends Pick<Entry, 'meal'>>(entries: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const group = groups.get(entry.meal);
    if (group) group.push(entry);
    else groups.set(entry.meal, [entry]);
  }
  return groups;
}
