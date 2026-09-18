/**
 * Calendar dates as local `YYYY-MM-DD` strings. Arithmetic happens at local noon
 * so daylight-saving changes never move a date to the previous/next day.
 */
import type { DayKey } from './types.ts';

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

export function toDayKey(date: Date): DayKey {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string') return false;
  const match = DAY_KEY.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Local noon of the given day. Throws on malformed keys. */
export function parseDayKey(key: DayKey): Date {
  const match = DAY_KEY.exec(key);
  if (!match) throw new RangeError(`Invalid day key: ${key}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

export function today(now: Date = new Date()): DayKey {
  return toDayKey(now);
}

export function addDays(key: DayKey, days: number): DayKey {
  const date = parseDayKey(key);
  date.setDate(date.getDate() + days);
  return toDayKey(date);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((parseDayKey(b).getTime() - parseDayKey(a).getTime()) / MS_PER_DAY);
}

export function startOfMonth(key: DayKey): DayKey {
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonth(key: DayKey): DayKey {
  const date = parseDayKey(startOfMonth(key));
  date.setMonth(date.getMonth() + 1, 0);
  return toDayKey(date);
}

export function addMonths(key: DayKey, months: number): DayKey {
  const date = parseDayKey(startOfMonth(key));
  date.setMonth(date.getMonth() + months);
  return toDayKey(date);
}

/**
 * The 42 days (6 weeks) shown in a month view containing `key`.
 * `weekStartsOn`: 0 = Sunday, 1 = Monday.
 */
export function monthGrid(key: DayKey, weekStartsOn: 0 | 1 = 1): DayKey[] {
  const first = parseDayKey(startOfMonth(key));
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const start = addDays(toDayKey(first), -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function isSameMonth(a: DayKey, b: DayKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}
