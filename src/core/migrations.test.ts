import { describe, expect, it } from 'vitest';
import { upgradeSettingsV2 } from './migrations.ts';

describe('upgradeSettingsV2', () => {
  it('converts the birth year and fills in the sex', () => {
    expect(upgradeSettingsV2({ id: 'profile', birthYear: 1990, sex: null, heightCm: 170 })).toEqual(
      { id: 'profile', birthDate: '1990-07-01', sex: 'male', heightCm: 170 },
    );
    expect(upgradeSettingsV2({ id: 'profile', birthYear: null, sex: 'female' })).toMatchObject({
      birthDate: null,
      sex: 'female',
    });
  });

  it('adds default preferences without touching existing ones', () => {
    expect(upgradeSettingsV2({ id: 'prefs', locale: 'es', theme: 'dark' })).toEqual({
      id: 'prefs',
      locale: 'es',
      theme: 'dark',
      accent: 'green',
      weightUnit: 'kg',
    });
    expect(upgradeSettingsV2({ id: 'prefs', accent: 'blue', weightUnit: 'lb' })).toMatchObject({
      accent: 'blue',
      weightUnit: 'lb',
    });
  });

  it('is idempotent on already upgraded records', () => {
    const profile = { id: 'profile', birthDate: '1990-03-04', sex: 'female' };
    expect(upgradeSettingsV2(profile)).toEqual(profile);
  });
});
