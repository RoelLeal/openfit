import { describe, expect, it } from 'vitest';
import {
  buildBaseRows,
  buildFullRows,
  densityFromPortions,
  foodNames,
  nutrientsByFood,
  portionsByFood,
  type CuratedFood,
} from './usda.ts';

const FOOD_CSV = `"fdc_id","data_type","description","food_category_id","publication_date"
"1","sr_legacy_food","Egg, whole, raw, fresh","1","2019-04-01"
"2","sr_legacy_food","Milk, whole","1","2019-04-01"
"3","sr_legacy_food","Incomplete food","1","2019-04-01"
`;

const NUTRIENT_CSV = `"id","fdc_id","nutrient_id","amount"
"10","1","1008","143"
"11","1","1003","12.56"
"12","1","1004","9.51"
"13","1","1005","0.72"
"14","1","1087","56"
"20","2","1008","61"
"21","2","1003","3.15"
"22","2","1004","3.27"
"23","2","1005","4.78"
"30","3","1008","100"
`;

const PORTION_CSV = `"id","fdc_id","seq_num","amount","measure_unit_id","portion_description","modifier","gram_weight"
"1","1","1","1","9999","","large","50"
"2","2","1","1","9999",""," cup ","244"
"3","2","2","1","9999","","fl oz","30.5"
`;

const curated = (overrides: Partial<CuratedFood> = {}): CuratedFood => ({
  slug: 'egg',
  fdc_id: '1',
  name_es: 'Huevo',
  name_en: 'Egg',
  aliases: 'blanquillo',
  unit: 'g',
  unit_g: '50',
  serving_g: '',
  ...overrides,
});

describe('USDA parsing', () => {
  it('keeps only foods with complete energy and macros', () => {
    const nutrients = nutrientsByFood(NUTRIENT_CSV);
    expect(nutrients.get('1')).toEqual({ kcal: 143, protein: 12.56, fat: 9.51, carbs: 0.72 });
    expect(nutrients.has('3')).toBe(false);
  });

  it('reads portions and names', () => {
    const portions = portionsByFood(PORTION_CSV);
    expect(portions.get('2')).toEqual([
      { amount: 1, modifier: 'cup', grams: 244 },
      { amount: 1, modifier: 'fl oz', grams: 30.5 },
    ]);
    expect(foodNames(FOOD_CSV).get('1')).toBe('Egg, whole, raw, fresh');
  });

  it('derives density from cup or fl oz portions', () => {
    expect(densityFromPortions([{ amount: 1, modifier: 'cup', grams: 244 }])).toBeCloseTo(
      1.0313,
      4,
    );
    expect(densityFromPortions([{ amount: 1, modifier: 'fl oz', grams: 30.7 }])).toBeCloseTo(
      1.0381,
      4,
    );
    expect(densityFromPortions([{ amount: 1, modifier: 'large', grams: 50 }])).toBeNull();
  });
});

describe('buildBaseRows', () => {
  const nutrients = nutrientsByFood(NUTRIENT_CSV);
  const portions = portionsByFood(PORTION_CSV);

  it('builds gram-based rows', () => {
    expect(buildBaseRows([curated()], nutrients, portions)).toEqual([
      {
        id: 'egg',
        name: 'Egg',
        name_es: 'Huevo',
        aliases: 'blanquillo',
        unit: 'g',
        kcal: 143,
        protein: 12.56,
        carbs: 0.72,
        fat: 9.51,
        unitSize: 50,
        servingSize: null,
        sourceId: '1',
      },
    ]);
  });

  it('converts liquids to per-100-ml values and ml sizes', () => {
    const [milk] = buildBaseRows(
      [curated({ slug: 'milk', fdc_id: '2', unit: 'ml', unit_g: '', serving_g: '244' })],
      nutrients,
      portions,
    );
    expect(milk?.kcal).toBe(62.9);
    expect(milk?.protein).toBe(3.25);
    expect(milk?.servingSize).toBe(236.6);
  });

  it('rejects bad curated data', () => {
    expect(() => buildBaseRows([curated({ fdc_id: '3' })], nutrients, portions)).toThrow(
      /nutrient/,
    );
    expect(() => buildBaseRows([curated(), curated()], nutrients, portions)).toThrow(/Duplicated/);
    expect(() => buildBaseRows([curated({ slug: 'Egg!' })], nutrients, portions)).toThrow(/slug/);
    expect(() => buildBaseRows([curated({ unit: 'oz' })], nutrients, portions)).toThrow(/unit/);
    expect(() => buildBaseRows([curated({ unit_g: '-1' })], nutrients, portions)).toThrow(/size/);
    expect(() => buildBaseRows([curated({ unit: 'ml' })], nutrients, portions)).toThrow(/density/);
  });
});

describe('buildFullRows', () => {
  it('includes complete foods, excludes curated ones and sorts by name', () => {
    const rows = buildFullRows(foodNames(FOOD_CSV), nutrientsByFood(NUTRIENT_CSV), new Set(['2']));
    expect(rows.map((r) => r.id)).toEqual(['1']);
    expect(rows[0]).toEqual({
      id: '1',
      name: 'Egg, whole, raw, fresh',
      kcal: 143,
      protein: 12.56,
      carbs: 0.72,
      fat: 9.51,
    });
  });

  it('adds translated names when a translator is given', () => {
    const rows = buildFullRows(
      foodNames(FOOD_CSV),
      nutrientsByFood(NUTRIENT_CSV),
      new Set(),
      (name) => ({ text: name.replace('Egg', 'Huevo'), coverage: name.includes('Egg') ? 0.25 : 0 }),
    );
    expect(rows.find((r) => r.id === '1')?.name_es).toBe('Huevo, whole, raw, fresh');
    expect(rows.find((r) => r.id === '2')?.name_es).toBeUndefined();
  });
});
