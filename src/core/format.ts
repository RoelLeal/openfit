/** Parsing and formatting of numbers typed or read by people. */

/**
 * Parses a decimal typed by a person. Accepts "1.5", "1,5" and surrounding spaces.
 * Returns null for empty or invalid input (including thousands separators, which are ambiguous).
 */
export function parseDecimal(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatNumber(value: number, locale: string, maxDecimals = 0): string {
  const key = `${locale}|${maxDecimals}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: maxDecimals });
    formatters.set(key, formatter);
  }
  // Avoid "-0".
  return formatter.format(Object.is(Math.round(value * 10 ** maxDecimals), -0) ? 0 : value);
}

/** Value to prefill an input with: no grouping, "." replaced by the locale decimal separator. */
export function toInputValue(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const text = String(Math.round(value * 100) / 100);
  return decimalSeparator(locale) === ',' ? text.replace('.', ',') : text;
}

export function decimalSeparator(locale: string): string {
  return new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal')
    ?.value === ','
    ? ','
    : '.';
}
