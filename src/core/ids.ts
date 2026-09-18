/** Identifier helpers. No auto-increment IDs: records must be mergeable across devices. */
import type { DayKey } from './types.ts';

export function newId(): string {
  return crypto.randomUUID();
}

/** One weight per day: two devices logging the same day converge on the same record. */
export function weightId(date: DayKey): string {
  return `weight:${date}`;
}

export function catalogId(pack: string, sourceId: string): string {
  return `${pack}:${sourceId}`;
}
