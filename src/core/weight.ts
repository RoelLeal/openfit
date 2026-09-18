/** Body weight units. Weights are stored in kilograms; pounds only exist at the edges (forms, display). */
import type { WeightUnit } from './types.ts';

export const LB_PER_KG = 2.2046226218;

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg * LB_PER_KG : kg;
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value / LB_PER_KG : value;
}

/** Value to show in a form for `kg` (2 decimals, so kg ⇄ lb round-trips cleanly). */
export function kgToInput(kg: number | null, unit: WeightUnit): number | null {
  return kg === null ? null : Math.round(kgToUnit(kg, unit) * 100) / 100;
}

/** Body mass index (kg/m²), or null when the data is incomplete. */
export function bmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const metres = heightCm / 100;
  return weightKg / (metres * metres);
}
