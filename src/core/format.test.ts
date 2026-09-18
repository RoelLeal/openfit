import { describe, expect, it } from 'vitest';
import { decimalSeparator, formatNumber, parseDecimal, toInputValue } from './format.ts';

describe('parseDecimal', () => {
  it('accepts dot and comma decimals', () => {
    expect(parseDecimal('1.5')).toBe(1.5);
    expect(parseDecimal(' 1,5 ')).toBe(1.5);
    expect(parseDecimal('42')).toBe(42);
    expect(parseDecimal('.5')).toBe(0.5);
    expect(parseDecimal('3.')).toBe(3);
  });

  it('rejects empty, negative and ambiguous input', () => {
    for (const input of ['', ' ', '-1', 'abc', '1.2.3', '1,000.5', '1e3', 'Infinity']) {
      expect(parseDecimal(input), input).toBeNull();
    }
  });
});

describe('formatNumber', () => {
  it('formats with locale rules and a max number of decimals', () => {
    expect(formatNumber(1650, 'en')).toBe('1,650');
    expect(formatNumber(12.345, 'en', 1)).toBe('12.3');
    expect(formatNumber(12.345, 'es', 1)).toBe('12,3');
    expect(formatNumber(12, 'en', 1)).toBe('12');
  });

  it('never prints negative zero', () => {
    expect(formatNumber(-0.2, 'en')).toBe('0');
  });
});

describe('toInputValue', () => {
  it('uses the locale decimal separator without grouping', () => {
    expect(toInputValue(1234.5, 'es')).toBe('1234,5');
    expect(toInputValue(1234.5, 'en')).toBe('1234.5');
    expect(toInputValue(0.333333, 'en')).toBe('0.33');
    expect(toInputValue(null, 'en')).toBe('');
  });

  it('detects the decimal separator', () => {
    expect(decimalSeparator('es')).toBe(',');
    expect(decimalSeparator('en')).toBe('.');
  });
});
