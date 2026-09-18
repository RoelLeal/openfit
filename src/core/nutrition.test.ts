import { describe, expect, it } from 'vitest';
import {
  entryMacros,
  groupByMeal,
  kcalFromMacros,
  macrosFor,
  progress,
  round,
  sumMacros,
} from './nutrition.ts';
import type { FoodFacts } from './types.ts';

const rice: FoodFacts = {
  name: 'Rice',
  baseAmount: 100,
  baseUnit: 'g',
  macros: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  servingSize: 158,
};

describe('macrosFor', () => {
  it('scales macros by quantity', () => {
    expect(macrosFor(rice, 200, 'g')).toEqual({ kcal: 260, protein: 5.4, carbs: 56, fat: 0.6 });
    expect(macrosFor(rice, 0.05, 'kg')?.kcal).toBeCloseTo(65);
  });

  it('works with servings and custom base amounts', () => {
    expect(macrosFor(rice, 1, 'serving')?.kcal).toBeCloseTo(205.4);
    const bar: FoodFacts = { ...rice, baseAmount: 1, baseUnit: 'unit', servingSize: undefined };
    expect(macrosFor(bar, 2, 'unit')?.kcal).toBe(260);
  });

  it('returns null for incompatible units', () => {
    expect(macrosFor(rice, 1, 'unit')).toBeNull();
    expect(macrosFor(rice, 100, 'ml')).toBeNull();
  });

  it('handles zero quantities', () => {
    expect(macrosFor(rice, 0, 'g')).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe('entryMacros', () => {
  it('falls back to zero when the snapshot cannot convert the unit', () => {
    expect(entryMacros({ food: rice, amount: 1, unit: 'l' })).toEqual({
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });
});

describe('sumMacros', () => {
  it('adds all values', () => {
    const total = sumMacros([
      { kcal: 100, protein: 1, carbs: 2, fat: 3 },
      { kcal: 50.5, protein: 0.5, carbs: 0, fat: 1 },
    ]);
    expect(total).toEqual({ kcal: 150.5, protein: 1.5, carbs: 2, fat: 4 });
    expect(sumMacros([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe('helpers', () => {
  it('computes kcal from macros with Atwater factors', () => {
    expect(kcalFromMacros({ protein: 10, carbs: 20, fat: 5 })).toBe(165);
  });

  it('rounds half up without float artifacts', () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(2.5)).toBe(3);
    expect(round(12.345, 1)).toBe(12.3);
  });

  it('computes progress ratios', () => {
    expect(progress(50, 200)).toBe(0.25);
    expect(progress(50, 0)).toBe(0);
  });

  it('groups entries by meal keeping order', () => {
    const groups = groupByMeal([
      { meal: 'lunch', n: 1 },
      { meal: 'breakfast', n: 2 },
      { meal: 'lunch', n: 3 },
    ]);
    expect(groups.get('lunch')?.map((e) => e.n)).toEqual([1, 3]);
    expect(groups.get('breakfast')?.map((e) => e.n)).toEqual([2]);
  });
});
