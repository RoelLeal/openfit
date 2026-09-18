import { describe, expect, it } from 'vitest';
import { datePosition, nearestIndex, niceScale, rangeStart } from './chart.ts';

describe('rangeStart', () => {
  it('goes back a fixed number of days', () => {
    expect(rangeStart('1m', '2026-09-16', null)).toBe('2026-08-17');
    expect(rangeStart('1y', '2026-09-16', '2020-01-01')).toBe('2025-09-16');
  });

  it('starts at the first record for "all"', () => {
    expect(rangeStart('all', '2026-09-16', '2024-02-01')).toBe('2024-02-01');
    expect(rangeStart('all', '2026-09-16', '2026-09-16')).toBe('2026-09-15');
    expect(rangeStart('all', '2026-09-16', null)).toBe('2026-09-15');
  });
});

describe('niceScale', () => {
  it('produces clean ticks around the data', () => {
    expect(niceScale([70.2, 72.8, 65])).toMatchObject({
      min: 65,
      max: 75,
      step: 2.5,
      ticks: [65, 67.5, 70, 72.5, 75],
    });
    const scale = niceScale([80, 81.3]);
    expect(scale.ticks[0]).toBeLessThanOrEqual(80);
    expect(scale.ticks.at(-1)).toBeGreaterThanOrEqual(81.3);
    expect(scale.ticks.length).toBeLessThanOrEqual(5);
  });

  it('handles flat and empty data', () => {
    const flat = niceScale([70, 70]);
    expect(flat.min).toBeLessThan(70);
    expect(flat.max).toBeGreaterThan(70);
    expect(niceScale([]).ticks.length).toBeGreaterThan(1);
  });
});

describe('positions', () => {
  it('maps dates to 0..1 and finds the nearest point', () => {
    expect(datePosition('2026-09-01', '2026-09-01', '2026-09-11')).toBe(0);
    expect(datePosition('2026-09-06', '2026-09-01', '2026-09-11')).toBe(0.5);
    expect(datePosition('2026-10-01', '2026-09-01', '2026-09-11')).toBe(1);
    expect(nearestIndex([0, 0.3, 0.9], 0.5)).toBe(1);
    expect(nearestIndex([], 0.5)).toBe(-1);
  });
});
