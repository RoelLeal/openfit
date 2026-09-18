/**
 * Runtime validation of user records. Used before writing imported backups
 * and before saving forms, so the database never holds malformed data.
 */
import { ACTIVITY_LEVELS } from './goals.ts';
import { isDayKey } from './dates.ts';
import { isBaseUnit, isUnit } from './units.ts';
import { ACCENTS, LOCALES, SEXES, WEIGHT_UNITS } from './types.ts';
import type {
  CustomFood,
  Entry,
  FoodFacts,
  MealTemplate,
  SettingsRecord,
  WeightEntry,
} from './types.ts';

export class ValidationError extends Error {
  path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ValidationError';
    this.path = path;
  }
}

type Obj = Record<string, unknown>;

function fail(path: string, message: string): never {
  throw new ValidationError(path, message);
}

function object(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Obj;
}

function nonNegative(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(path, 'must be a non-negative number');
  }
  return value;
}

function positive(value: unknown, path: string): number {
  if (nonNegative(value, path) === 0) fail(path, 'must be greater than 0');
  return value as number;
}

function optional<T>(value: unknown, path: string, check: (v: unknown, p: string) => T): void {
  if (value !== undefined && value !== null) check(value, path);
}

function text(value: unknown, path: string, { required = true, max = 200 } = {}): void {
  if (value === undefined && !required) return;
  if (typeof value !== 'string') fail(path, 'must be a string');
  if (required && value.trim() === '') fail(path, 'must not be empty');
  if (value.length > max) fail(path, `must be at most ${max} characters`);
}

function synced(value: Obj, path: string): void {
  text(value.id, `${path}.id`);
  nonNegative(value.createdAt, `${path}.createdAt`);
  nonNegative(value.updatedAt, `${path}.updatedAt`);
  optional(value.deletedAt, `${path}.deletedAt`, nonNegative);
}

export function assertFoodFacts(value: unknown, path = 'food'): asserts value is FoodFacts {
  const food = object(value, path);
  text(food.name, `${path}.name`);
  text(food.brand, `${path}.brand`, { required: false });
  if (food.names !== undefined) {
    const names = object(food.names, `${path}.names`);
    for (const [key, name] of Object.entries(names)) {
      if (!(LOCALES as readonly string[]).includes(key))
        fail(`${path}.names`, `unknown locale ${key}`);
      text(name, `${path}.names.${key}`);
    }
  }
  positive(food.baseAmount, `${path}.baseAmount`);
  if (!isBaseUnit(food.baseUnit)) fail(`${path}.baseUnit`, 'must be g, ml or unit');
  const macros = object(food.macros, `${path}.macros`);
  for (const key of ['kcal', 'protein', 'carbs', 'fat']) {
    nonNegative(macros[key], `${path}.macros.${key}`);
  }
  optional(food.unitSize, `${path}.unitSize`, positive);
  optional(food.servingSize, `${path}.servingSize`, positive);
}

export function assertCustomFood(value: unknown, path = 'food'): asserts value is CustomFood {
  synced(object(value, path), path);
  assertFoodFacts(value, path);
}

function quantity(item: Obj, path: string): void {
  text(item.foodId, `${path}.foodId`);
  assertFoodFacts(item.food, `${path}.food`);
  nonNegative(item.amount, `${path}.amount`);
  if (!isUnit(item.unit)) fail(`${path}.unit`, 'must be a valid unit');
}

export function assertEntry(value: unknown, path = 'entry'): asserts value is Entry {
  const entry = object(value, path);
  synced(entry, path);
  if (!isDayKey(entry.date)) fail(`${path}.date`, 'must be a YYYY-MM-DD date');
  text(entry.meal, `${path}.meal`, { max: 40 });
  quantity(entry, path);
}

export function assertMealTemplate(value: unknown, path = 'meal'): asserts value is MealTemplate {
  const meal = object(value, path);
  synced(meal, path);
  text(meal.name, `${path}.name`);
  if (!Array.isArray(meal.items)) fail(`${path}.items`, 'must be an array');
  meal.items.forEach((item, i) =>
    quantity(object(item, `${path}.items[${i}]`), `${path}.items[${i}]`),
  );
}

export function assertWeight(value: unknown, path = 'weight'): asserts value is WeightEntry {
  const weight = object(value, path);
  synced(weight, path);
  if (!isDayKey(weight.date)) fail(`${path}.date`, 'must be a YYYY-MM-DD date');
  positive(weight.kg, `${path}.kg`);
}

export function assertSettings(value: unknown, path = 'settings'): asserts value is SettingsRecord {
  const record = object(value, path);
  synced(record, path);
  if (record.id === 'profile') {
    if (record.birthDate !== null && !isDayKey(record.birthDate)) {
      fail(`${path}.birthDate`, 'must be a YYYY-MM-DD date or null');
    }
    optional(record.heightCm, `${path}.heightCm`, positive);
    optional(record.targetWeightKg, `${path}.targetWeightKg`, positive);
    if (!(SEXES as readonly unknown[]).includes(record.sex)) {
      fail(`${path}.sex`, 'must be female or male');
    }
    if (!(ACTIVITY_LEVELS as readonly unknown[]).includes(record.activity)) {
      fail(`${path}.activity`, 'must be a valid activity level');
    }
    const goals = object(record.goals, `${path}.goals`);
    for (const key of ['kcal', 'protein', 'carbs', 'fat']) {
      nonNegative(goals[key], `${path}.goals.${key}`);
    }
  } else if (record.id === 'prefs') {
    if (record.locale !== null && !(LOCALES as readonly unknown[]).includes(record.locale)) {
      fail(`${path}.locale`, 'must be a supported locale or null');
    }
    if (!['system', 'light', 'dark'].includes(record.theme as string)) {
      fail(`${path}.theme`, 'must be system, light or dark');
    }
    if (!(ACCENTS as readonly unknown[]).includes(record.accent)) {
      fail(`${path}.accent`, 'must be a known accent color');
    }
    if (!(WEIGHT_UNITS as readonly unknown[]).includes(record.weightUnit)) {
      fail(`${path}.weightUnit`, 'must be kg or lb');
    }
  } else {
    fail(`${path}.id`, 'must be "profile" or "prefs"');
  }
}
