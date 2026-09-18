/** Small helpers for the hand-made SVG weight chart. */
import { addDays, diffDays } from './dates.ts';
import type { DayKey } from './types.ts';

export type ChartRange = '1m' | '3m' | '1y' | 'all';
export const CHART_RANGES: readonly ChartRange[] = ['1m', '3m', '1y', 'all'];

const RANGE_DAYS: Record<Exclude<ChartRange, 'all'>, number> = { '1m': 30, '3m': 91, '1y': 365 };

/** First day shown for a range. `all` starts at the first record (or today when there is none). */
export function rangeStart(range: ChartRange, today: DayKey, firstDate: DayKey | null): DayKey {
  if (range === 'all') return firstDate && firstDate < today ? firstDate : addDays(today, -1);
  return addDays(today, -RANGE_DAYS[range]);
}

export interface Scale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

const STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100];

/** Rounds a value domain to clean tick values, with at most `maxTicks` intervals. */
export function niceScale(values: readonly number[], maxTicks = 4): Scale {
  const finite = values.filter(Number.isFinite);
  let low = finite.length ? Math.min(...finite) : 0;
  let high = finite.length ? Math.max(...finite) : 1;
  if (high - low < 1) {
    const middle = (high + low) / 2;
    low = middle - 0.5;
    high = middle + 0.5;
  }
  const step =
    STEPS.find((s) => Math.ceil(high / s) - Math.floor(low / s) <= maxTicks) ?? STEPS.at(-1)!;
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let value = min; value <= max + step / 1000; value += step) {
    ticks.push(Math.round(value * 1000) / 1000);
  }
  return { min, max: max === min ? min + step : max, step, ticks };
}

/** Horizontal position (0..1) of a date between two dates. */
export function datePosition(date: DayKey, from: DayKey, to: DayKey): number {
  const span = Math.max(1, diffDays(from, to));
  return Math.min(1, Math.max(0, diffDays(from, date) / span));
}

/** Index of the point closest to a horizontal position. `positions` must be sorted. */
export function nearestIndex(positions: readonly number[], x: number): number {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  positions.forEach((position, i) => {
    const distance = Math.abs(position - x);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}
