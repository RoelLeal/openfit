import { describe, expect, it } from 'vitest';
import { ageAt, bmr, goalDirection, suggestGoals, type GoalInput } from './goals.ts';
import { kcalFromMacros } from './nutrition.ts';

const person: GoalInput = {
  weightKg: 80,
  heightCm: 180,
  age: 30,
  sex: 'male',
  activity: 'moderate',
  targetWeightKg: 80,
};

describe('ageAt', () => {
  it('counts completed years, birthday included', () => {
    expect(ageAt('1996-09-16', '2026-09-16')).toBe(30);
    expect(ageAt('1996-09-17', '2026-09-16')).toBe(29);
    expect(ageAt('1996-12-31', '2026-01-01')).toBe(29);
    expect(ageAt('2000-02-29', '2027-02-28')).toBe(26);
    expect(ageAt('2000-02-29', '2027-03-01')).toBe(27);
  });
});

describe('bmr', () => {
  it('matches the Mifflin-St Jeor equation', () => {
    expect(bmr(person)).toBe(1780);
    expect(bmr({ ...person, sex: 'female' })).toBe(1614);
  });
});

describe('goalDirection', () => {
  it('uses a small tolerance around the current weight', () => {
    expect(goalDirection(80, 70)).toBe('lose');
    expect(goalDirection(80, 85)).toBe('gain');
    expect(goalDirection(80, 80.3)).toBe('maintain');
    expect(goalDirection(80, null)).toBe('maintain');
  });
});

describe('suggestGoals', () => {
  it('suggests maintenance calories with balanced macros', () => {
    const { tdee, direction, goals } = suggestGoals(person);
    expect(tdee).toBeCloseTo(2759);
    expect(direction).toBe('maintain');
    expect(goals.kcal).toBe(2760);
    expect(goals.protein).toBe(144);
    expect(goals.fat).toBe(77);
    // Macros add up to the calorie goal (within rounding).
    expect(Math.abs(kcalFromMacros(goals) - goals.kcal)).toBeLessThan(10);
  });

  it('creates a deficit when losing and a surplus when gaining', () => {
    expect(suggestGoals({ ...person, targetWeightKg: 70 }).goals.kcal).toBe(2210);
    expect(suggestGoals({ ...person, targetWeightKg: 90 }).goals.kcal).toBe(3030);
  });

  it('never goes below the basal rate', () => {
    const { bmr: base, goals } = suggestGoals({
      ...person,
      activity: 'sedentary',
      targetWeightKg: 60,
    });
    expect(goals.kcal).toBeGreaterThanOrEqual(Math.round(base / 10) * 10);
  });

  it('bases protein on the target weight when losing and caps its share', () => {
    const heavy = suggestGoals({ ...person, weightKg: 150, targetWeightKg: 100 });
    expect(heavy.goals.protein).toBe(180);
    const capped = suggestGoals({
      ...person,
      weightKg: 200,
      targetWeightKg: 200,
      activity: 'sedentary',
    });
    expect(capped.goals.protein * 4).toBeLessThanOrEqual(capped.goals.kcal * 0.35 + 4);
    expect(capped.goals.carbs).toBeGreaterThan(0);
  });
});
