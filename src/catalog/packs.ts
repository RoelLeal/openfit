/**
 * Catalog pack format: a compact, column-based JSON file with public nutrition data.
 * Shared by the app (install) and scripts/build-catalog.ts (generation).
 */
import { catalogId } from '../core/ids.ts';
import type { CatalogFood } from '../core/types.ts';
import { assertFoodFacts, ValidationError } from '../core/validate.ts';

export const PACK_FORMAT = 'openfit-pack';
export const PACK_FORMAT_VERSION = 1;
export const BASE_PACK_ID = 'base';

export interface PackInfo {
  id: string;
  /** Content version; a change triggers a reinstall of the base pack. */
  version: string;
  name: string;
  description?: string;
  license: string;
  attribution: string;
  source: string;
}

export interface Pack extends PackInfo {
  foods: CatalogFood[];
}

export type PackCell = string | number | null;

export interface PackFile extends PackInfo {
  format: typeof PACK_FORMAT;
  formatVersion: number;
  fields: PackField[];
  foods: PackCell[][];
}

/** Entry of public/packs/index.json. */
export interface PackListing {
  id: string;
  /** Installed automatically on first start (and shipped with the app). */
  default?: boolean;
  version: string;
  name: string;
  description: string;
  file: string;
  foods: number;
  bytes: number;
  license: string;
}

export const PACK_FIELDS = [
  'id',
  'name',
  'name_es',
  'name_en',
  'aliases',
  'brand',
  'unit',
  'amount',
  'kcal',
  'protein',
  'carbs',
  'fat',
  'unitSize',
  'servingSize',
  'sourceId',
] as const;
export type PackField = (typeof PACK_FIELDS)[number];

const REQUIRED_FIELDS: PackField[] = ['id', 'name', 'kcal', 'protein', 'carbs', 'fat'];

export class PackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackError';
  }
}

function str(value: PackCell | undefined): string | undefined {
  return value === null || value === undefined || value === '' ? undefined : String(value);
}

function num(value: PackCell | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return typeof value === 'number' ? value : Number(value);
}

function rowToFood(pack: string, fields: PackField[], row: PackCell[]): CatalogFood {
  const get = (field: PackField) => row[fields.indexOf(field)];
  const food: CatalogFood = {
    id: catalogId(pack, String(get('id'))),
    pack,
    name: String(get('name') ?? ''),
    baseAmount: num(get('amount')) ?? 100,
    baseUnit: (str(get('unit')) ?? 'g') as CatalogFood['baseUnit'],
    macros: {
      kcal: num(get('kcal')) ?? Number.NaN,
      protein: num(get('protein')) ?? Number.NaN,
      carbs: num(get('carbs')) ?? Number.NaN,
      fat: num(get('fat')) ?? Number.NaN,
    },
  };
  const es = str(get('name_es'));
  const en = str(get('name_en'));
  if (es || en) {
    food.names = {};
    if (es) food.names.es = es;
    if (en) food.names.en = en;
  }
  const aliases = str(get('aliases'));
  if (aliases)
    food.aliases = aliases
      .split(';')
      .map((a) => a.trim())
      .filter(Boolean);
  const brand = str(get('brand'));
  if (brand) food.brand = brand;
  const unitSize = num(get('unitSize'));
  if (unitSize !== undefined) food.unitSize = unitSize;
  const servingSize = num(get('servingSize'));
  if (servingSize !== undefined) food.servingSize = servingSize;
  const sourceId = str(get('sourceId'));
  if (sourceId) food.sourceId = sourceId;
  return food;
}

function requireString(file: Record<string, unknown>, key: string): string {
  const value = file[key];
  if (typeof value !== 'string' || value === '') throw new PackError(`Pack is missing "${key}"`);
  return value;
}

/** Validates a pack file and expands its rows. Throws `PackError` on any problem. */
export function parsePack(raw: unknown): Pack {
  if (typeof raw !== 'object' || raw === null) throw new PackError('Pack must be an object');
  const file = raw as Record<string, unknown>;
  if (file.format !== PACK_FORMAT) throw new PackError('Not an OpenFit pack');
  if (file.formatVersion !== PACK_FORMAT_VERSION) {
    throw new PackError(`Unsupported pack format version ${String(file.formatVersion)}`);
  }
  const id = requireString(file, 'id');
  if (!/^[a-z0-9-]+$/.test(id))
    throw new PackError('Pack id must be lowercase letters, digits or -');

  const fields = file.fields;
  if (
    !Array.isArray(fields) ||
    !fields.every((f) => (PACK_FIELDS as readonly unknown[]).includes(f))
  ) {
    throw new PackError('Pack has unknown fields');
  }
  for (const field of REQUIRED_FIELDS) {
    if (!fields.includes(field)) throw new PackError(`Pack is missing the "${field}" field`);
  }
  if (!Array.isArray(file.foods)) throw new PackError('Pack foods must be an array');

  const ids = new Set<string>();
  const foods = file.foods.map((row, i) => {
    if (!Array.isArray(row) || row.length !== fields.length) {
      throw new PackError(`Row ${i} does not match the fields`);
    }
    const food = rowToFood(id, fields as PackField[], row as PackCell[]);
    try {
      assertFoodFacts(food, `foods[${i}]`);
    } catch (error) {
      if (error instanceof ValidationError) throw new PackError(error.message);
      throw error;
    }
    if (ids.has(food.id)) throw new PackError(`Duplicated food id ${food.id}`);
    ids.add(food.id);
    return food;
  });

  return {
    id,
    version: requireString(file, 'version'),
    name: requireString(file, 'name'),
    description: typeof file.description === 'string' ? file.description : undefined,
    license: requireString(file, 'license'),
    attribution: requireString(file, 'attribution'),
    source: requireString(file, 'source'),
    foods,
  };
}

/** Builds a pack file from row objects, dropping columns that are empty in every row. */
export function encodePack(info: PackInfo, rows: Partial<Record<PackField, PackCell>>[]): PackFile {
  const fields = PACK_FIELDS.filter(
    (field) =>
      REQUIRED_FIELDS.includes(field) || rows.some((row) => str(row[field] ?? null) !== undefined),
  );
  return {
    format: PACK_FORMAT,
    formatVersion: PACK_FORMAT_VERSION,
    ...info,
    fields,
    foods: rows.map((row) => fields.map((field) => row[field] ?? null)),
  };
}
