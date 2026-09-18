/**
 * CSV exports. Column names are stable English identifiers so the files are easy
 * to process with scripts or spreadsheets in any language.
 */
import { toCsv, type CsvValue } from './csv.ts';
import { entryMacros, round, sumMacros } from './nutrition.ts';
import { displayName } from './search.ts';
import type { CustomFood, Entry, Locale, Macros, WeightEntry } from './types.ts';

const macroCells = (m: Macros): CsvValue[] => [
  round(m.kcal, 0),
  round(m.protein, 1),
  round(m.carbs, 1),
  round(m.fat, 1),
];

export function entriesCsv(entries: readonly Entry[], locale: Locale): string {
  const rows: CsvValue[][] = [
    ['date', 'meal', 'food', 'brand', 'amount', 'unit', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
  ];
  for (const entry of entries) {
    rows.push([
      entry.date,
      entry.meal,
      displayName(entry.food, locale),
      entry.food.brand ?? '',
      entry.amount,
      entry.unit,
      ...macroCells(entryMacros(entry)),
    ]);
  }
  return toCsv(rows);
}

/** One row per day with entries; goals are the current ones (goal history is not kept). */
export function dailyTotalsCsv(entries: readonly Entry[], goals: Macros | null): string {
  const byDate = new Map<string, Macros[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.date) ?? [];
    list.push(entryMacros(entry));
    byDate.set(entry.date, list);
  }
  const rows: CsvValue[][] = [
    [
      'date',
      'kcal',
      'protein_g',
      'carbs_g',
      'fat_g',
      'kcal_goal',
      'protein_goal_g',
      'carbs_goal_g',
      'fat_goal_g',
    ],
  ];
  for (const date of [...byDate.keys()].sort()) {
    rows.push([
      date,
      ...macroCells(sumMacros(byDate.get(date) ?? [])),
      goals?.kcal,
      goals?.protein,
      goals?.carbs,
      goals?.fat,
    ]);
  }
  return toCsv(rows);
}

export function weightsCsv(weights: readonly WeightEntry[]): string {
  return toCsv([
    ['date', 'weight_kg'],
    ...[...weights].sort((a, b) => a.date.localeCompare(b.date)).map((w) => [w.date, w.kg]),
  ]);
}

export function customFoodsCsv(foods: readonly CustomFood[]): string {
  return toCsv([
    [
      'name',
      'brand',
      'base_amount',
      'base_unit',
      'kcal',
      'protein_g',
      'carbs_g',
      'fat_g',
      'unit_size',
      'serving_size',
    ],
    ...foods.map((f) => [
      f.name,
      f.brand ?? '',
      f.baseAmount,
      f.baseUnit,
      f.macros.kcal,
      f.macros.protein,
      f.macros.carbs,
      f.macros.fat,
      f.unitSize,
      f.servingSize,
    ]),
  ]);
}
