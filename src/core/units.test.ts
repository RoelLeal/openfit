import { describe, expect, it } from 'vitest';
import type { FoodFacts } from './types.ts';
import { allowedUnits, defaultQuantity, fromBaseAmount, isUnit, toBaseAmount } from './units.ts';

const facts = (overrides: Partial<FoodFacts> = {}): FoodFacts => ({
  name: 'Test',
  baseAmount: 100,
  baseUnit: 'g',
  macros: { kcal: 100, protein: 10, carbs: 10, fat: 1 },
  ...overrides,
});

describe('toBaseAmount', () => {
  it('converts mass units for gram-based foods', () => {
    const food = facts();
    expect(toBaseAmount(food, 150, 'g')).toBe(150);
    expect(toBaseAmount(food, 1.5, 'kg')).toBe(1500);
    expect(toBaseAmount(food, 100, 'ml')).toBeNull();
    expect(toBaseAmount(food, 1, 'l')).toBeNull();
  });

  it('converts volume units for ml-based foods', () => {
    const food = facts({ baseUnit: 'ml' });
    expect(toBaseAmount(food, 250, 'ml')).toBe(250);
    expect(toBaseAmount(food, 0.5, 'l')).toBe(500);
    expect(toBaseAmount(food, 10, 'g')).toBeNull();
  });

  it('uses unit and serving sizes when present', () => {
    const egg = facts({ unitSize: 50, servingSize: 100 });
    expect(toBaseAmount(egg, 2, 'unit')).toBe(100);
    expect(toBaseAmount(egg, 1.5, 'serving')).toBe(150);
    expect(toBaseAmount(facts(), 1, 'unit')).toBeNull();
    expect(toBaseAmount(facts(), 1, 'serving')).toBeNull();
  });

  it('treats units as the base for unit-based foods', () => {
    const bar = facts({ baseUnit: 'unit', baseAmount: 1, servingSize: 2 });
    expect(toBaseAmount(bar, 3, 'unit')).toBe(3);
    expect(toBaseAmount(bar, 1, 'serving')).toBe(2);
    expect(toBaseAmount(bar, 30, 'g')).toBeNull();
  });

  it('rejects negative and non-finite amounts', () => {
    expect(toBaseAmount(facts(), -1, 'g')).toBeNull();
    expect(toBaseAmount(facts(), Number.NaN, 'g')).toBeNull();
    expect(toBaseAmount(facts(), Number.POSITIVE_INFINITY, 'g')).toBeNull();
  });

  it('ignores zero or missing sizes', () => {
    expect(toBaseAmount(facts({ unitSize: 0 }), 1, 'unit')).toBeNull();
  });
});

describe('fromBaseAmount', () => {
  it('is the inverse of toBaseAmount, rounded to 2 decimals', () => {
    const egg = facts({ unitSize: 50 });
    expect(fromBaseAmount(egg, 100, 'unit')).toBe(2);
    expect(fromBaseAmount(egg, 1234, 'kg')).toBe(1.23);
    expect(fromBaseAmount(egg, 100, 'serving')).toBeNull();
  });
});

describe('allowedUnits', () => {
  it('lists compatible units in display order', () => {
    expect(allowedUnits(facts())).toEqual(['g', 'kg']);
    expect(allowedUnits(facts({ unitSize: 50, servingSize: 100 }))).toEqual([
      'g',
      'kg',
      'unit',
      'serving',
    ]);
    expect(allowedUnits(facts({ baseUnit: 'ml', servingSize: 240 }))).toEqual([
      'ml',
      'l',
      'serving',
    ]);
    expect(allowedUnits(facts({ baseUnit: 'unit', baseAmount: 1 }))).toEqual(['unit']);
  });
});

describe('defaultQuantity', () => {
  it('prefers units, then servings, then 100 of the base unit', () => {
    expect(defaultQuantity(facts({ unitSize: 50, servingSize: 10 }))).toEqual({
      amount: 1,
      unit: 'unit',
    });
    expect(defaultQuantity(facts({ servingSize: 158 }))).toEqual({ amount: 1, unit: 'serving' });
    expect(defaultQuantity(facts({ baseUnit: 'ml' }))).toEqual({ amount: 100, unit: 'ml' });
    expect(defaultQuantity(facts({ baseUnit: 'unit', baseAmount: 1 }))).toEqual({
      amount: 1,
      unit: 'unit',
    });
  });
});

describe('isUnit', () => {
  it('accepts only known units', () => {
    expect(isUnit('kg')).toBe(true);
    expect(isUnit('oz')).toBe(false);
    expect(isUnit(1)).toBe(false);
  });
});
