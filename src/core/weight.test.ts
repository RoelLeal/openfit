import { describe, expect, it } from 'vitest';
import { bmi, kgToInput, kgToUnit, unitToKg } from './weight.ts';

describe('weight units', () => {
  it('converts between kilograms and pounds', () => {
    expect(kgToUnit(80, 'kg')).toBe(80);
    expect(kgToUnit(80, 'lb')).toBeCloseTo(176.37, 2);
    expect(unitToKg(176.37, 'lb')).toBeCloseTo(80, 2);
    expect(unitToKg(80, 'kg')).toBe(80);
  });

  it('round-trips form values', () => {
    expect(kgToInput(unitToKg(175.5, 'lb'), 'lb')).toBe(175.5);
    expect(kgToInput(79.6, 'kg')).toBe(79.6);
    expect(kgToInput(null, 'lb')).toBeNull();
  });

  it('computes BMI', () => {
    expect(bmi(80, 180)).toBeCloseTo(24.69, 2);
    expect(bmi(null, 180)).toBeNull();
    expect(bmi(80, 0)).toBeNull();
  });
});
