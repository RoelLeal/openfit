/**
 * Goal estimation with the Mifflin-St Jeor equation.
 * This is an orientative estimate, not medical advice; users can always edit the result.
 */
import type { ActivityLevel, DayKey, Macros, Sex } from './types.ts';

export const ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
];

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const DEFAULT_GOALS: Readonly<Macros> = Object.freeze({
  kcal: 2000,
  protein: 100,
  carbs: 250,
  fat: 65,
});

export type Direction = 'lose' | 'maintain' | 'gain';

const CALORIE_FACTOR: Record<Direction, number> = { lose: 0.8, maintain: 1, gain: 1.1 };
const PROTEIN_G_PER_KG = 1.8;
const MAX_PROTEIN_SHARE = 0.35;
const FAT_SHARE = 0.25;
/** Weight changes smaller than this count as "maintain". */
const MAINTAIN_TOLERANCE_KG = 0.5;

/** Completed years between a date of birth and `today` (both `YYYY-MM-DD`). */
export function ageAt(birthDate: DayKey, today: DayKey): number {
  const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  // Not yet had the birthday this year → one year less. Month-day strings compare lexically.
  return today.slice(5) < birthDate.slice(5) ? years - 1 : years;
}

export interface BodyData {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
}

/** Basal metabolic rate in kcal/day (Mifflin-St Jeor). */
export function bmr({ weightKg, heightCm, age, sex }: BodyData): number {
  const constant = sex === 'male' ? 5 : -161;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + constant;
}

export function goalDirection(weightKg: number, targetWeightKg: number | null): Direction {
  if (targetWeightKg === null || !Number.isFinite(targetWeightKg)) return 'maintain';
  const delta = targetWeightKg - weightKg;
  if (delta <= -MAINTAIN_TOLERANCE_KG) return 'lose';
  if (delta >= MAINTAIN_TOLERANCE_KG) return 'gain';
  return 'maintain';
}

export interface GoalInput extends BodyData {
  activity: ActivityLevel;
  targetWeightKg: number | null;
}

export interface GoalSuggestion {
  bmr: number;
  tdee: number;
  direction: Direction;
  goals: Macros;
}

export function suggestGoals(input: GoalInput): GoalSuggestion {
  const base = bmr(input);
  const tdee = base * ACTIVITY_FACTORS[input.activity];
  const direction = goalDirection(input.weightKg, input.targetWeightKg);

  // Never suggest eating below the estimated basal rate.
  const kcal = Math.round(Math.max(tdee * CALORIE_FACTOR[direction], base) / 10) * 10;

  // When losing weight, protein is based on the lower (target) weight.
  const referenceKg =
    direction === 'lose' && input.targetWeightKg !== null
      ? Math.min(input.weightKg, input.targetWeightKg)
      : input.weightKg;
  const protein = Math.round(
    Math.min(referenceKg * PROTEIN_G_PER_KG, (kcal * MAX_PROTEIN_SHARE) / 4),
  );
  const fat = Math.round((kcal * FAT_SHARE) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  return { bmr: base, tdee, direction, goals: { kcal, protein, carbs, fat } };
}
