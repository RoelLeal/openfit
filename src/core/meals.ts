/** Meal slot helpers. */
import type { MealSlot } from './types.ts';

/** The slot a person most likely means when adding food at a given hour. */
export function mealForHour(hour: number): MealSlot {
  if (hour >= 4 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 17) return 'lunch';
  if (hour >= 17 && hour < 23) return 'dinner';
  return 'snacks';
}
