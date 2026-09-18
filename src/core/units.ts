/**
 * Quantity units and conversions. The single place that knows how
 * "2 units" or "1.5 kg" map onto a food's base amount.
 */
import type { BaseUnit, FoodFacts, Unit } from './types.ts';

export const UNITS: readonly Unit[] = ['g', 'kg', 'ml', 'l', 'unit', 'serving'];
export const BASE_UNITS: readonly BaseUnit[] = ['g', 'ml', 'unit'];

type Sizing = Pick<FoodFacts, 'baseUnit' | 'unitSize' | 'servingSize'>;

const METRIC: Record<'g' | 'kg' | 'ml' | 'l', { base: BaseUnit; factor: number }> = {
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
};

export function isUnit(value: unknown): value is Unit {
  return typeof value === 'string' && (UNITS as readonly string[]).includes(value);
}

export function isBaseUnit(value: unknown): value is BaseUnit {
  return typeof value === 'string' && (BASE_UNITS as readonly string[]).includes(value);
}

/** How much of the base unit one `unit` represents, or null if it does not apply to this food. */
export function unitFactor(food: Sizing, unit: Unit): number | null {
  switch (unit) {
    case 'unit':
      if (food.baseUnit === 'unit') return 1;
      return food.unitSize && food.unitSize > 0 ? food.unitSize : null;
    case 'serving':
      return food.servingSize && food.servingSize > 0 ? food.servingSize : null;
    default: {
      const metric = METRIC[unit];
      return metric.base === food.baseUnit ? metric.factor : null;
    }
  }
}

/** Converts a quantity into the food's base unit. Returns null when the unit is not compatible. */
export function toBaseAmount(food: Sizing, amount: number, unit: Unit): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  const factor = unitFactor(food, unit);
  return factor === null ? null : amount * factor;
}

/** Inverse of `toBaseAmount`, rounded to 2 decimals. Used when switching units in a form. */
export function fromBaseAmount(food: Sizing, baseAmount: number, unit: Unit): number | null {
  const factor = unitFactor(food, unit);
  if (factor === null || !Number.isFinite(baseAmount)) return null;
  return Math.round((baseAmount / factor) * 100) / 100;
}

/** Units that make sense for a food, in display order. */
export function allowedUnits(food: Sizing): Unit[] {
  const units: Unit[] =
    food.baseUnit === 'g' ? ['g', 'kg'] : food.baseUnit === 'ml' ? ['ml', 'l'] : ['unit'];
  if (food.baseUnit !== 'unit' && unitFactor(food, 'unit') !== null) units.push('unit');
  if (unitFactor(food, 'serving') !== null) units.push('serving');
  return units;
}

/** A sensible first quantity when the food was never logged before. */
export function defaultQuantity(food: Sizing): { amount: number; unit: Unit } {
  if (unitFactor(food, 'unit') !== null) return { amount: 1, unit: 'unit' };
  if (unitFactor(food, 'serving') !== null) return { amount: 1, unit: 'serving' };
  return { amount: 100, unit: food.baseUnit };
}
