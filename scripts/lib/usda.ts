/**
 * Transformations from USDA FoodData Central (SR Legacy CSV) to OpenFit packs.
 * Pure functions: scripts/build-catalog.ts handles files and network.
 */
import { parseCsvObjects } from '../../src/core/csv.ts';
import type { PackCell, PackField } from '../../src/catalog/packs.ts';

/** FDC nutrient ids. */
export const NUTRIENTS = { kcal: '1008', protein: '1003', fat: '1004', carbs: '1005' } as const;

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const ML_PER_CUP = 236.588;
export const ML_PER_FL_OZ = 29.5735;

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Collects energy and macros per 100 g, keyed by FDC id. Foods missing any value are left out. */
export function nutrientsByFood(foodNutrientCsv: string): Map<string, Nutrients> {
  const wanted = new Map<string, keyof Nutrients>(
    Object.entries(NUTRIENTS).map(([key, id]) => [id, key as keyof Nutrients]),
  );
  const partial = new Map<string, Partial<Nutrients>>();
  for (const row of parseCsvObjects(foodNutrientCsv)) {
    const key = wanted.get(row.nutrient_id ?? '');
    if (!key || !row.fdc_id) continue;
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const entry = partial.get(row.fdc_id) ?? {};
    entry[key] = amount;
    partial.set(row.fdc_id, entry);
  }
  const complete = new Map<string, Nutrients>();
  for (const [id, n] of partial) {
    if (
      n.kcal !== undefined &&
      n.protein !== undefined &&
      n.carbs !== undefined &&
      n.fat !== undefined
    ) {
      complete.set(id, n as Nutrients);
    }
  }
  return complete;
}

export interface Portion {
  amount: number;
  modifier: string;
  grams: number;
}

export function portionsByFood(foodPortionCsv: string): Map<string, Portion[]> {
  const portions = new Map<string, Portion[]>();
  for (const row of parseCsvObjects(foodPortionCsv)) {
    const portion = {
      amount: Number(row.amount),
      modifier: (row.modifier ?? '').trim(),
      grams: Number(row.gram_weight),
    };
    if (!row.fdc_id || !(portion.amount > 0) || !(portion.grams > 0)) continue;
    const list = portions.get(row.fdc_id) ?? [];
    list.push(portion);
    portions.set(row.fdc_id, list);
  }
  return portions;
}

/** Grams per millilitre, derived from the "cup" or "fl oz" portions USDA publishes. */
export function densityFromPortions(portions: readonly Portion[]): number | null {
  const volumes: [RegExp, number][] = [
    [/^cup$/i, ML_PER_CUP],
    [/^cup \(8 fl oz\)$/i, ML_PER_CUP],
    [/^fl oz$/i, ML_PER_FL_OZ],
  ];
  for (const [pattern, ml] of volumes) {
    const portion = portions.find((p) => pattern.test(p.modifier));
    if (portion) return portion.grams / (portion.amount * ml);
  }
  return null;
}

export function foodNames(foodCsv: string): Map<string, string> {
  return new Map(parseCsvObjects(foodCsv).map((row) => [row.fdc_id ?? '', row.description ?? '']));
}

/** A row of data/base-foods.csv. */
export interface CuratedFood {
  slug: string;
  fdc_id: string;
  name_es: string;
  name_en: string;
  aliases: string;
  unit: string;
  unit_g: string;
  serving_g: string;
}

export type PackRow = Partial<Record<PackField, PackCell>>;

function optionalNumber(text: string): number | null {
  if (text.trim() === '') return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid size "${text}"`);
  return value;
}

/**
 * Converts curated foods into pack rows. Liquids (`unit = ml`) are expressed per 100 ml
 * and their unit/serving sizes in ml, using the density from USDA portions.
 */
export function buildBaseRows(
  curated: readonly CuratedFood[],
  nutrients: ReadonlyMap<string, Nutrients>,
  portions: ReadonlyMap<string, readonly Portion[]>,
): PackRow[] {
  const slugs = new Set<string>();
  return curated.map((food) => {
    if (!/^[a-z0-9-]+$/.test(food.slug)) throw new Error(`Invalid slug "${food.slug}"`);
    if (slugs.has(food.slug)) throw new Error(`Duplicated slug "${food.slug}"`);
    slugs.add(food.slug);

    const n = nutrients.get(food.fdc_id);
    if (!n) throw new Error(`${food.slug}: FDC ${food.fdc_id} has no complete nutrient data`);
    if (food.unit !== 'g' && food.unit !== 'ml')
      throw new Error(`${food.slug}: unit must be g or ml`);

    let density = 1;
    if (food.unit === 'ml') {
      const found = densityFromPortions(portions.get(food.fdc_id) ?? []);
      if (found === null) throw new Error(`${food.slug}: no volume portion to derive the density`);
      density = found;
    }
    const size = (grams: number | null) => (grams === null ? null : round(grams / density, 1));

    return {
      id: food.slug,
      // English is the canonical name, so no separate name_en column is needed.
      name: food.name_en,
      name_es: food.name_es,
      aliases: food.aliases || null,
      unit: food.unit,
      // Per 100 ml, a liquid weighs 100 × density grams.
      kcal: round(n.kcal * density, 1),
      protein: round(n.protein * density, 2),
      carbs: round(n.carbs * density, 2),
      fat: round(n.fat * density, 2),
      unitSize: size(optionalNumber(food.unit_g)),
      servingSize: size(optionalNumber(food.serving_g)),
      sourceId: food.fdc_id,
    };
  });
}

/**
 * Every SR Legacy food with complete data, per 100 g, excluding ids already curated.
 * `translate` adds a Spanish name when it can translate at least part of the English one.
 */
export function buildFullRows(
  names: ReadonlyMap<string, string>,
  nutrients: ReadonlyMap<string, Nutrients>,
  exclude: ReadonlySet<string>,
  translate?: (name: string) => { text: string; coverage: number },
): PackRow[] {
  const rows: PackRow[] = [];
  for (const [id, name] of names) {
    const n = nutrients.get(id);
    if (!n || exclude.has(id) || !name) continue;
    const spanish = translate?.(name);
    rows.push({
      id,
      name,
      ...(spanish && spanish.coverage > 0 && spanish.text !== name
        ? { name_es: spanish.text }
        : {}),
      kcal: round(n.kcal, 1),
      protein: round(n.protein, 2),
      carbs: round(n.carbs, 2),
      fat: round(n.fat, 2),
    });
  }
  return rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'en'));
}
