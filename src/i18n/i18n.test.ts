import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { en } from './en.ts';
import { es } from './es.ts';
import {
  detectLocale,
  fmtBytes,
  fmtDayLabel,
  fmtQuantity,
  i18n,
  intlLocale,
  mealLabel,
  setLocale,
  t,
  tp,
  unitLabel,
} from './index.svelte.ts';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

// Formatting follows the browser region (es-MX, en-GB...): pin it so results do not depend on the machine.
beforeAll(() => {
  vi.stubGlobal('navigator', { language: 'en-US', languages: ['en-US'] });
});
afterEach(() => setLocale('en'));

describe('dictionaries', () => {
  it('have the same keys', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('use the same placeholders in every translation', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(es[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('have no empty messages', () => {
    for (const [key, value] of [...Object.entries(en), ...Object.entries(es)]) {
      expect(value.trim(), key).not.toBe('');
    }
  });
});

describe('t / tp', () => {
  it('translates and interpolates', async () => {
    await setLocale('es');
    expect(i18n.locale).toBe('es');
    expect(t('diary.addTo', { meal: 'Cena' })).toBe('Añadir a Cena');
    await setLocale('en');
    expect(t('diary.addTo', { meal: 'Dinner' })).toBe('Add to Dinner');
    expect(t('diary.consumed', { value: 1 })).toBe('1 of {goal} kcal');
  });

  it('selects plural forms', async () => {
    await setLocale('es');
    expect(tp('catalogs.foods', 1)).toBe('1 alimento');
    expect(tp('catalogs.foods', 7694)).toBe('7694 alimentos');
    await setLocale('en');
    expect(tp('catalogs.foods', 2)).toBe('2 foods');
  });

  it('formats quantities', async () => {
    await setLocale('es');
    expect(fmtQuantity(2, 'unit')).toBe('2 unidades');
    expect(fmtQuantity(1, 'serving')).toBe('1 porción');
    expect(fmtQuantity(1.5, 'serving')).toBe('1,5 porciones');
    expect(fmtQuantity(150, 'g')).toBe('150 g');
    expect(unitLabel('unit', 2)).toBe('unidades');
    await setLocale('en');
    expect(fmtQuantity(0.25, 'l')).toBe('0.25 l');
    expect(unitLabel('serving')).toBe('serving');
  });

  it('labels meals and days', async () => {
    await setLocale('es');
    expect(mealLabel('breakfast')).toBe('Desayuno');
    expect(mealLabel('brunch')).toBe('brunch');
    expect(fmtDayLabel('2026-09-16', '2026-09-16')).toBe('Hoy');
    expect(fmtDayLabel('2026-09-15', '2026-09-16')).toBe('Ayer');
    expect(fmtDayLabel('2025-09-15', '2026-09-16')).toContain('2025');
  });

  it('formats byte sizes', () => {
    expect(fmtBytes(693_500)).toBe('694 kB');
    expect(fmtBytes(1_500_000)).toBe('1.5 MB');
  });
});

describe('intlLocale', () => {
  it('keeps the browser region when it matches the language', () => {
    vi.stubGlobal('navigator', { language: 'es-MX', languages: ['es-MX', 'en-US'] });
    expect(intlLocale('es')).toBe('es-MX');
    expect(intlLocale('en')).toBe('en-US');
    vi.stubGlobal('navigator', { language: 'en-US', languages: ['en-US'] });
    expect(intlLocale('es')).toBe('es');
  });
});

describe('detectLocale', () => {
  it('picks the first supported language', () => {
    expect(detectLocale(['fr-FR', 'es-MX', 'en'])).toBe('es');
    expect(detectLocale(['EN-gb'])).toBe('en');
    expect(detectLocale(['de'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
});
