import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  diffDays,
  endOfMonth,
  isDayKey,
  isSameMonth,
  monthGrid,
  parseDayKey,
  startOfMonth,
  toDayKey,
} from './dates.ts';

describe('day keys', () => {
  it('formats local dates', () => {
    expect(toDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toDayKey(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });

  it('validates keys', () => {
    expect(isDayKey('2026-02-28')).toBe(true);
    expect(isDayKey('2024-02-29')).toBe(true);
    expect(isDayKey('2026-02-29')).toBe(false);
    expect(isDayKey('2026-13-01')).toBe(false);
    expect(isDayKey('2026-1-01')).toBe(false);
    expect(isDayKey(20260101)).toBe(false);
  });

  it('parses to local noon and rejects garbage', () => {
    const date = parseDayKey('2026-03-08');
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      2026, 2, 8, 12,
    ]);
    expect(() => parseDayKey('yesterday')).toThrow(RangeError);
  });
});

describe('date arithmetic', () => {
  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    // Daylight-saving transitions (in any timezone) must not skip or repeat days.
    let key = '2026-01-01';
    for (let i = 0; i < 365; i++) key = addDays(key, 1);
    expect(key).toBe('2027-01-01');
  });

  it('computes day differences', () => {
    expect(diffDays('2026-03-01', '2026-03-31')).toBe(30);
    expect(diffDays('2026-03-31', '2026-03-01')).toBe(-30);
    expect(diffDays('2026-01-01', '2027-01-01')).toBe(365);
  });

  it('handles months', () => {
    expect(startOfMonth('2026-09-16')).toBe('2026-09-01');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01');
    expect(isSameMonth('2026-09-01', '2026-09-30')).toBe(true);
    expect(isSameMonth('2026-09-01', '2025-09-01')).toBe(false);
  });
});

describe('monthGrid', () => {
  it('returns 6 full weeks starting on the chosen weekday', () => {
    // September 2026 starts on a Tuesday.
    const monday = monthGrid('2026-09-16', 1);
    expect(monday).toHaveLength(42);
    expect(monday[0]).toBe('2026-08-31');
    expect(parseDayKey(monday[0]!).getDay()).toBe(1);

    const sunday = monthGrid('2026-09-16', 0);
    expect(sunday[0]).toBe('2026-08-30');
    expect(sunday).toContain('2026-09-30');
  });
});
