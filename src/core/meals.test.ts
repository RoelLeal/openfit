import { describe, expect, it } from 'vitest';
import { mealForHour } from './meals.ts';

describe('mealForHour', () => {
  it('maps the time of day to a meal slot', () => {
    expect(mealForHour(7)).toBe('breakfast');
    expect(mealForHour(11)).toBe('lunch');
    expect(mealForHour(16)).toBe('lunch');
    expect(mealForHour(20)).toBe('dinner');
    expect(mealForHour(23)).toBe('snacks');
    expect(mealForHour(2)).toBe('snacks');
  });
});
