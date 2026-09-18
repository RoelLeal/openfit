import { describe, expect, it } from 'vitest';
import { displayName, normalizeText, searchFoods, type Searchable } from './search.ts';

const foods: Searchable[] = [
  { id: 'egg', name: 'Egg', names: { es: 'Huevo entero', en: 'Egg (whole)' } },
  { id: 'eggplant', name: 'Eggplant, raw', names: { es: 'Berenjena', en: 'Eggplant' } },
  { id: 'tomato', name: 'Tomato', names: { es: 'Jitomate', en: 'Tomato' }, aliases: ['tomate'] },
  { id: 'rice', name: 'Rice, white, cooked', names: { es: 'Arroz blanco cocido' } },
  { id: 'rice-brown', name: 'Rice, brown, cooked', names: { es: 'Arroz integral cocido' } },
  { id: 'yogurt', name: 'Greek yogurt', brand: 'Acme' },
  { id: 'cafe', name: 'Café negro' },
];

const ids = (list: Searchable[]) => list.map((f) => f.id);

describe('normalizeText', () => {
  it('removes accents, case and extra spaces', () => {
    expect(normalizeText('  Plátano   MACHO ')).toBe('platano macho');
    expect(normalizeText('Ñandú')).toBe('nandu');
  });
});

describe('displayName', () => {
  it('uses the translation when available', () => {
    expect(displayName(foods[0]!, 'es')).toBe('Huevo entero');
    expect(displayName(foods[3]!, 'en')).toBe('Rice, white, cooked');
  });
});

describe('searchFoods', () => {
  it('matches any language, aliases and brands without accents', () => {
    expect(ids(searchFoods(foods, 'huevo', { locale: 'es' }))).toEqual(['egg']);
    expect(ids(searchFoods(foods, 'EGG', { locale: 'es' }))).toContain('egg');
    expect(ids(searchFoods(foods, 'tomate', { locale: 'es' }))).toEqual(['tomato']);
    expect(ids(searchFoods(foods, 'acme', { locale: 'en' }))).toEqual(['yogurt']);
    expect(ids(searchFoods(foods, 'cafe', { locale: 'es' }))).toEqual(['cafe']);
  });

  it('requires every token to match', () => {
    expect(ids(searchFoods(foods, 'arroz integral', { locale: 'es' }))).toEqual(['rice-brown']);
    expect(searchFoods(foods, 'arroz pizza', { locale: 'es' })).toEqual([]);
  });

  it('ranks names starting with the query first', () => {
    expect(ids(searchFoods(foods, 'egg', { locale: 'en' }))).toEqual(['egg', 'eggplant']);
    expect(ids(searchFoods(foods, 'arroz', { locale: 'es' }))).toEqual(['rice', 'rice-brown']);
  });

  it('applies boosts and limits', () => {
    const boosted = searchFoods(foods, 'arroz', {
      locale: 'es',
      boost: (f) => (f.id === 'rice-brown' ? 100 : 0),
    });
    expect(ids(boosted)[0]).toBe('rice-brown');
    expect(searchFoods(foods, 'e', { locale: 'en', limit: 2 })).toHaveLength(2);
  });

  it('returns nothing for blank queries', () => {
    expect(searchFoods(foods, '   ', { locale: 'es' })).toEqual([]);
  });
});
