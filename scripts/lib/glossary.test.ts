import { describe, expect, it } from 'vitest';
import { translateName } from './glossary.ts';

describe('translateName', () => {
  it('translates common USDA names segment by segment', () => {
    expect(
      translateName('Chicken, broilers or fryers, breast, meat only, cooked, roasted').text,
    ).toBe('Pollo, de engorde, pechuga, solo carne, cocido, asado');
    expect(
      translateName('Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled').text,
    ).toBe('Res, molido, 85% carne magra / 15% grasa, hamburguesa, cocido, a la parrilla');
    expect(translateName('Egg, whole, raw, fresh').text).toBe('Huevo, entero, crudo, fresco');
    expect(translateName('Milk, whole, 3.25% milkfat, with added vitamin D').text).toBe(
      'Leche, entero, 3.25% milkfat, con añadido vitamina D',
    );
  });

  it('prefers phrases over single words and keeps punctuation', () => {
    expect(translateName('Beans, black, mature seeds, cooked, boiled, without salt').text).toBe(
      'Frijoles, negro, semillas maduras, cocido, hervido, sin sal',
    );
    expect(
      translateName('Rice, white, long-grain, regular, enriched, cooked (with salt)').text,
    ).toBe('Arroz, blanco, long-grain, regular, enriquecido, cocido (con sal)');
  });

  it('leaves brands alone and reports coverage', () => {
    const result = translateName("Cereals ready-to-eat, KELLOGG, KELLOGG'S CORN FLAKES");
    expect(result.text).toBe("Cereales listo para comer, KELLOGG, KELLOGG'S CORN FLAKES");
    expect(result.coverage).toBeGreaterThan(0.2);
    expect(result.coverage).toBeLessThan(1);
    expect(translateName('Xyzzy, plugh').coverage).toBe(0);
  });
});
