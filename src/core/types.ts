/**
 * Domain types shared by the whole app.
 * Everything a user creates extends `Synced` so a future sync layer can merge it.
 */

export type Locale = 'es' | 'en';
export const LOCALES: readonly Locale[] = ['es', 'en'];

/** Units a quantity can be entered in. */
export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'unit' | 'serving';
/** Unit in which a food's nutrition facts are expressed. */
export type BaseUnit = 'g' | 'ml' | 'unit';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export type Sex = 'male' | 'female';
export const SEXES: readonly Sex[] = ['female', 'male'];
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Theme = 'system' | 'light' | 'dark';
/** Accent color of the interface (see app.css). */
export type Accent = 'green' | 'blue' | 'violet' | 'orange' | 'rose' | 'teal';
export const ACCENTS: readonly Accent[] = ['green', 'blue', 'violet', 'orange', 'rose', 'teal'];
/** Unit used to enter and display body weight. Weights are always stored in kg. */
export type WeightUnit = 'kg' | 'lb';
export const WEIGHT_UNITS: readonly WeightUnit[] = ['kg', 'lb'];

/** Local calendar date, `YYYY-MM-DD`. */
export type DayKey = string;

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Fields every user record carries so it can be backed up, merged and (later) synced. */
export interface Synced {
  id: string;
  /** Epoch milliseconds. */
  createdAt: number;
  /** Epoch milliseconds; bumped on every write. */
  updatedAt: number;
  /** Tombstone: set instead of physically deleting the record. */
  deletedAt?: number | null;
}

/** What is needed to compute the macros of any quantity of a food. */
export interface FoodFacts {
  name: string;
  /** Translated names (catalog foods). */
  names?: Partial<Record<Locale, string>>;
  brand?: string;
  /** Amount of `baseUnit` the macros refer to, e.g. 100 (g). */
  baseAmount: number;
  baseUnit: BaseUnit;
  macros: Macros;
  /** Size of one "unit" expressed in `baseUnit` (e.g. one egg = 50 g). */
  unitSize?: number;
  /** Size of one "serving" expressed in `baseUnit`. */
  servingSize?: number;
}

/** Public nutrition data. Lives in the `catalog` store and is never synced. */
export interface CatalogFood extends FoodFacts {
  /** `<pack>:<source id>`, stable across installs. */
  id: string;
  pack: string;
  aliases?: string[];
  sourceId?: string;
}

/** A food created by the user. Private. */
export interface CustomFood extends FoodFacts, Synced {}

export type AnyFood = CatalogFood | CustomFood;

export interface Entry extends Synced {
  date: DayKey;
  /** A `MealSlot` today; kept as string so custom categories need no migration. */
  meal: string;
  foodId: string;
  /** Immutable snapshot of the food when it was logged. */
  food: FoodFacts;
  amount: number;
  unit: Unit;
}

export interface MealItem {
  foodId: string;
  food: FoodFacts;
  amount: number;
  unit: Unit;
}

export interface MealTemplate extends Synced {
  name: string;
  items: MealItem[];
}

export interface WeightEntry extends Synced {
  date: DayKey;
  kg: number;
}

export interface Profile extends Synced {
  id: 'profile';
  /** Date of birth, `YYYY-MM-DD`. */
  birthDate: DayKey | null;
  heightCm: number | null;
  /** Used to estimate goals and to draw the body figure. */
  sex: Sex;
  activity: ActivityLevel;
  targetWeightKg: number | null;
  goals: Macros;
}

export interface Prefs extends Synced {
  id: 'prefs';
  /** `null` follows the browser language. */
  locale: Locale | null;
  theme: Theme;
  accent: Accent;
  weightUnit: WeightUnit;
}

export type SettingsRecord = Profile | Prefs;

export function isCustomFood(food: AnyFood): food is CustomFood {
  return !('pack' in food);
}
