/**
 * Tiny i18n: typed flat dictionaries + Intl for numbers and dates.
 * Only the active language is downloaded (each dictionary is its own chunk), and
 * `i18n.locale` changes only once its dictionary is ready, so `t()` stays synchronous.
 * To add a language: copy es.ts, translate it, and register it in `loaders` and core/types.ts.
 */
import { diffDays, parseDayKey } from '../core/dates.ts';
import { formatNumber } from '../core/format.ts';
import type { DayKey, FoodFacts, Locale, Unit, WeightUnit } from '../core/types.ts';
import { kgToUnit } from '../core/weight.ts';
import { LOCALES, MEAL_SLOTS } from '../core/types.ts';
import type { MessageKey, Messages } from './en.ts';

export type { MessageKey };

const loaders: Record<Locale, () => Promise<Messages>> = {
  en: () => import('./en.ts').then((m) => m.en),
  es: () => import('./es.ts').then((m) => m.es),
};

const dictionaries: Partial<Record<Locale, Messages>> = {};

/** Keys that have `.one` / `.other` variants, without the suffix. */
export type PluralKey = {
  [K in MessageKey]: K extends `${infer Base}.other` ? Base : never;
}[MessageKey];

type Params = Record<string, string | number>;

const LOCALE_CACHE_KEY = 'openfit:locale';

export function detectLocale(languages: readonly string[] = navigatorLanguages()): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if ((LOCALES as readonly string[]).includes(base ?? '')) return base as Locale;
  }
  return 'en';
}

function navigatorLanguages(): readonly string[] {
  return typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
}

export const i18n = $state({ locale: 'en' as Locale });

let pending: Promise<void> = Promise.resolve();

/** Loads the dictionary if needed, then switches the language. Calls are applied in order. */
export function setLocale(locale: Locale): Promise<void> {
  pending = pending.then(async () => {
    dictionaries[locale] ??= await loaders[locale]();
    i18n.locale = locale;
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  });
  return pending;
}

/** Last language used on this device (a per-device convenience that avoids a flash on start). */
export function cachedLocale(): Locale | null {
  try {
    const value = localStorage.getItem(LOCALE_CACHE_KEY);
    return (LOCALES as readonly (string | null)[]).includes(value) ? (value as Locale) : null;
  } catch {
    return null;
  }
}

export function cacheLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_CACHE_KEY, locale);
  } catch {
    // Storage unavailable: the language is detected again next time.
  }
}

/** BCP 47 tag used for Intl: keeps the browser's region when it matches the language (es-MX). */
export function intlLocale(locale: Locale = i18n.locale): string {
  return navigatorLanguages().find((tag) => tag.toLowerCase().split('-')[0] === locale) ?? locale;
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

function message(locale: Locale, key: MessageKey): string | undefined {
  return dictionaries[locale]?.[key] ?? dictionaries.en?.[key];
}

/** Whether a message exists (for keys built from data, like catalog ids). */
export function hasMessage(key: string): key is MessageKey {
  // Every dictionary has the same keys, so the active one is enough.
  return key in (dictionaries[i18n.locale] ?? {});
}

export function t(key: MessageKey, params?: Params): string {
  return interpolate(message(i18n.locale, key) ?? key, params);
}

// eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain cache, not reactive state
const pluralRules = new Map<string, Intl.PluralRules>();

export function tp(key: PluralKey, count: number, params?: Params): string {
  const locale = i18n.locale;
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  const template =
    message(locale, `${key}.${rules.select(count)}` as MessageKey) ??
    message(locale, `${key}.other` as MessageKey) ??
    key;
  return interpolate(template, { count: fmtNumber(count, 2), ...params });
}

// ---------- Formatting ----------

export function fmtNumber(value: number, maxDecimals = 0): string {
  return formatNumber(value, intlLocale(), maxDecimals);
}

export function fmtKcal(value: number): string {
  return fmtNumber(value, 0);
}

/** Grams: one decimal for small values, none for larger ones. */
export function fmtGrams(value: number): string {
  return fmtNumber(value, Math.abs(value) < 10 ? 1 : 0);
}

export function unitLabel(unit: Unit, amount = 1): string {
  // Unit words carry no {count}: the plural form only selects the word.
  if (unit === 'unit' || unit === 'serving') return tp(`unit.${unit}`, amount);
  return t(`unit.${unit}`);
}

export function fmtQuantity(amount: number, unit: Unit): string {
  return `${fmtNumber(amount, 2)} ${unitLabel(unit, amount)}`;
}

/** "100 g", "1 unit": the amount the nutrition facts refer to. */
export function fmtBase(food: Pick<FoodFacts, 'baseAmount' | 'baseUnit'>): string {
  return fmtQuantity(food.baseAmount, food.baseUnit);
}

export function mealLabel(meal: string): string {
  return (MEAL_SLOTS as readonly string[]).includes(meal) ? t(`meal.${meal}` as MessageKey) : meal;
}

// eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain cache, not reactive state
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function fmtDate(key: DayKey, options: Intl.DateTimeFormatOptions): string {
  const locale = intlLocale();
  const cacheKey = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(cacheKey, formatter);
  }
  return formatter.format(parseDayKey(key));
}

/** "Today", "Yesterday" or a short date like "Tue, Sep 15". */
export function fmtDayLabel(key: DayKey, today: DayKey): string {
  const diff = diffDays(today, key);
  if (diff === 0) return t('date.today');
  if (diff === -1) return t('date.yesterday');
  if (diff === 1) return t('date.tomorrow');
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return fmtDate(key, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function fmtRelativeTime(timestamp: number, now: number = Date.now()): string {
  const days = Math.round((timestamp - now) / 86_400_000);
  const formatter = new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' });
  if (Math.abs(days) >= 1) return formatter.format(days, 'day');
  const hours = Math.round((timestamp - now) / 3_600_000);
  if (Math.abs(hours) >= 1) return formatter.format(hours, 'hour');
  return formatter.format(Math.round((timestamp - now) / 60_000), 'minute');
}

export function fmtBytes(bytes: number): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
  let value = bytes;
  let index = 0;
  while (value >= 1000 && index < units.length - 1) {
    value /= 1000;
    index++;
  }
  return new Intl.NumberFormat(intlLocale(), {
    style: 'unit',
    unit: units[index],
    unitDisplay: 'short',
    maximumFractionDigits: value < 10 && index > 0 ? 1 : 0,
  }).format(value);
}

/** "79.6 kg" or "175.5 lb" for a weight stored in kilograms. */
export function fmtWeight(kg: number, unit: WeightUnit, decimals = 1): string {
  return t('weight.value', {
    value: fmtNumber(kgToUnit(kg, unit), decimals),
    unit: t(`unit.${unit}`),
  });
}
