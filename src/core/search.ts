/** Local food search: accent-insensitive, multilingual and ranked. */
import type { Locale } from './types.ts';

export interface Searchable {
  id: string;
  name: string;
  names?: Partial<Record<Locale, string>>;
  brand?: string;
  aliases?: string[];
}

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function displayName(food: Pick<Searchable, 'name' | 'names'>, locale: Locale): string {
  return food.names?.[locale] ?? food.name;
}

interface Prepared {
  display: string;
  haystack: string;
}

const cache = new WeakMap<object, Map<Locale, Prepared>>();

function prepare(food: Searchable, locale: Locale): Prepared {
  let byLocale = cache.get(food);
  if (!byLocale) {
    byLocale = new Map();
    cache.set(food, byLocale);
  }
  let prepared = byLocale.get(locale);
  if (!prepared) {
    const parts = [
      food.name,
      ...Object.values(food.names ?? {}),
      food.brand,
      ...(food.aliases ?? []),
    ];
    prepared = {
      display: normalizeText(displayName(food, locale)),
      haystack: normalizeText(parts.filter(Boolean).join(' | ')),
    };
    byLocale.set(locale, prepared);
  }
  return prepared;
}

export interface SearchOptions<T> {
  locale: Locale;
  limit?: number;
  /** Extra score, e.g. for recently used or custom foods. */
  boost?: (food: T) => number;
}

function score(prepared: Prepared, query: string, tokens: string[]): number | null {
  const { display, haystack } = prepared;
  if (!tokens.every((token) => haystack.includes(token))) return null;
  let points = 0;
  if (display === query) points += 200;
  else if (display.startsWith(query)) points += 100;
  else if (display.includes(query)) points += 40;
  const first = tokens[0] ?? '';
  const words = display.split(/[\s,()/-]+/);
  if (words.includes(first)) points += 50;
  else if (words.some((word) => word.startsWith(first))) points += 30;
  if (tokens.every((token) => display.includes(token))) points += 20;
  // Prefer short, generic names ("Egg" over "Egg, whole, raw, frozen, salted").
  return points - Math.min(display.length, 80) * 0.2;
}

export function searchFoods<T extends Searchable>(
  foods: readonly T[],
  query: string,
  { locale, limit = 50, boost }: SearchOptions<T>,
): T[] {
  const normalized = normalizeText(query);
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) return [];

  const scored: { food: T; points: number; display: string }[] = [];
  for (const food of foods) {
    const prepared = prepare(food, locale);
    const points = score(prepared, normalized, tokens);
    if (points === null) continue;
    scored.push({ food, points: points + (boost?.(food) ?? 0), display: prepared.display });
  }
  scored.sort((a, b) => b.points - a.points || a.display.localeCompare(b.display));
  return scored.slice(0, limit).map((item) => item.food);
}
