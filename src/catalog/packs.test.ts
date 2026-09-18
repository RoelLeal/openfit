import { describe, expect, it } from 'vitest';
import baseFoods from './base-foods.json';
import { encodePack, PackError, parsePack, type PackInfo } from './packs.ts';
import { macrosFor } from '../core/nutrition.ts';

const info: PackInfo = {
  id: 'test',
  version: '1',
  name: 'Test pack',
  license: 'CC0-1.0',
  attribution: 'Tests',
  source: 'https://example.org',
};

describe('encodePack / parsePack', () => {
  it('round-trips rows into catalog foods', () => {
    const file = encodePack(info, [
      {
        id: 'egg',
        name: 'Egg',
        name_es: 'Huevo',
        aliases: 'a; b',
        kcal: 143,
        protein: 12.6,
        carbs: 0.7,
        fat: 9.5,
        unitSize: 50,
      },
      {
        id: 'milk',
        name: 'Milk',
        unit: 'ml',
        kcal: 62,
        protein: 3.2,
        carbs: 4.8,
        fat: 3.3,
        servingSize: 240,
      },
    ]);
    expect(file.fields).toEqual([
      'id',
      'name',
      'name_es',
      'aliases',
      'unit',
      'kcal',
      'protein',
      'carbs',
      'fat',
      'unitSize',
      'servingSize',
    ]);

    const pack = parsePack(JSON.parse(JSON.stringify(file)));
    expect(pack.name).toBe('Test pack');
    expect(pack.foods).toEqual([
      {
        id: 'test:egg',
        pack: 'test',
        name: 'Egg',
        names: { es: 'Huevo' },
        aliases: ['a', 'b'],
        baseAmount: 100,
        baseUnit: 'g',
        macros: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
        unitSize: 50,
      },
      {
        id: 'test:milk',
        pack: 'test',
        name: 'Milk',
        baseAmount: 100,
        baseUnit: 'ml',
        macros: { kcal: 62, protein: 3.2, carbs: 4.8, fat: 3.3 },
        servingSize: 240,
      },
    ]);
  });

  it('rejects malformed packs', () => {
    const valid = encodePack(info, [{ id: 'a', name: 'A', kcal: 1, protein: 0, carbs: 0, fat: 0 }]);
    const broken = (patch: Record<string, unknown>) => () => parsePack({ ...valid, ...patch });

    expect(() => parsePack(null)).toThrow(PackError);
    expect(broken({ format: 'nope' })).toThrow(/Not an OpenFit pack/);
    expect(broken({ formatVersion: 2 })).toThrow(/format version/);
    expect(broken({ id: 'Bad Id' })).toThrow(/id/);
    expect(broken({ license: '' })).toThrow(/license/);
    expect(broken({ fields: ['id', 'name', 'kcal', 'protein', 'carbs', 'fat', 'color'] })).toThrow(
      /unknown fields/,
    );
    expect(broken({ fields: ['id', 'name', 'kcal', 'protein', 'carbs'], foods: [] })).toThrow(
      /"fat"/,
    );
    expect(broken({ foods: [['a', 'A', 1, 0, 0]] })).toThrow(/Row 0/);
    expect(broken({ foods: [['a', 'A', -1, 0, 0, 0]] })).toThrow(/kcal/);
    expect(
      broken({
        foods: [
          ['a', 'A', 1, 0, 0, 0],
          ['a', 'B', 1, 0, 0, 0],
        ],
      }),
    ).toThrow(/Duplicated/);
  });
});

describe('bundled base pack', () => {
  const pack = parsePack(baseFoods);

  it('is valid and small', () => {
    expect(pack.id).toBe('base');
    expect(pack.foods.length).toBeGreaterThanOrEqual(90);
    expect(JSON.stringify(baseFoods).length).toBeLessThan(20_000);
  });

  it('has Spanish names for every food', () => {
    expect(pack.foods.filter((food) => !food.names?.es)).toEqual([]);
  });

  it('contains the common foods from the plan with plausible values', () => {
    const find = (id: string) => pack.foods.find((food) => food.id === `base:${id}`);
    for (const id of [
      'egg',
      'rice-white-cooked',
      'chicken-breast-grilled',
      'tortilla-corn',
      'milk-whole',
      'oats',
      'banana',
      'apple',
      'bread-white',
      'pasta-cooked',
      'potato-boiled',
      'beans-black',
      'yogurt-plain',
      'beef-sirloin',
      'tuna-water',
    ]) {
      const food = find(id);
      expect(food, id).toBeDefined();
      // Energy roughly matches the macros (Atwater, within 25 % or 15 kcal).
      const { kcal, protein, carbs, fat } = food!.macros;
      const estimate = protein * 4 + carbs * 4 + fat * 9;
      expect(Math.abs(estimate - kcal), id).toBeLessThan(Math.max(15, kcal * 0.25));
    }
    expect(macrosFor(find('egg')!, 2, 'unit')?.kcal).toBeCloseTo(143);
    expect(find('milk-whole')?.baseUnit).toBe('ml');
  });
});
