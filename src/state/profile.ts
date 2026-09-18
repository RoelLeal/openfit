/** Glue between the profile forms and the repositories. */
import { addDays, isDayKey } from '../core/dates.ts';
import { ageAt, suggestGoals, type GoalSuggestion } from '../core/goals.ts';
import type { ActivityLevel, DayKey, Macros, Profile, Sex, WeightEntry } from '../core/types.ts';
import { saveProfile } from '../db/repos/settings.ts';
import { setWeight } from '../db/repos/weights.ts';

/** Form model. Weights are kept in kg; the form converts to the preferred unit at the edges. */
export interface ProfileDraft {
  birthDate: DayKey | '';
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  /** `null` until the person chooses. */
  sex: Sex | null;
  activity: ActivityLevel;
}

export type GoalsDraft = Record<keyof Macros, number | null>;

export const MIN_AGE = 10;
export const MAX_AGE = 120;

export function emptyDraft(): ProfileDraft {
  return {
    birthDate: '',
    heightCm: null,
    weightKg: null,
    targetWeightKg: null,
    sex: null,
    activity: 'light',
  };
}

export function draftFromProfile(
  profile: Profile | null,
  latest: WeightEntry | null,
): ProfileDraft {
  if (!profile) return { ...emptyDraft(), weightKg: latest?.kg ?? null };
  return {
    birthDate: profile.birthDate ?? '',
    heightCm: profile.heightCm,
    weightKg: latest?.kg ?? null,
    targetWeightKg: profile.targetWeightKg,
    sex: profile.sex,
    activity: profile.activity,
  };
}

/** Latest and earliest acceptable dates of birth for a date input. */
export function birthDateBounds(today: DayKey): { min: DayKey; max: DayKey } {
  return {
    min: `${Number(today.slice(0, 4)) - MAX_AGE}${today.slice(4)}`,
    max: addDays(today, -Math.round(MIN_AGE * 365.25)),
  };
}

export function isBirthDateValid(birthDate: string, today: DayKey): boolean {
  if (!isDayKey(birthDate)) return false;
  const age = ageAt(birthDate, today);
  return age >= MIN_AGE && age <= MAX_AGE;
}

export function isPositiveOrEmpty(value: number | null): boolean {
  return value === null || value > 0;
}

/** Onboarding and the profile screen require the data the app is built around. */
export function isDraftValid(draft: ProfileDraft, today: DayKey): boolean {
  return (
    draft.sex !== null &&
    isBirthDateValid(draft.birthDate, today) &&
    draft.heightCm !== null &&
    draft.heightCm > 0 &&
    draft.weightKg !== null &&
    draft.weightKg > 0 &&
    isPositiveOrEmpty(draft.targetWeightKg)
  );
}

export function goalsDraft(goals: Macros): GoalsDraft {
  return { ...goals };
}

export function isGoalsValid(goals: GoalsDraft): goals is Macros {
  return Object.values(goals).every((value) => value !== null && value >= 0);
}

export function suggestionFor(draft: ProfileDraft, today: DayKey): GoalSuggestion | null {
  if (!isDraftValid(draft, today)) return null;
  return suggestGoals({
    weightKg: draft.weightKg!,
    heightCm: draft.heightCm!,
    age: ageAt(draft.birthDate, today),
    sex: draft.sex!,
    activity: draft.activity,
    targetWeightKg: draft.targetWeightKg,
  });
}

/**
 * Saves the profile. The current weight is not stored in the profile: it becomes
 * today's entry in the weight history (single source of truth).
 */
export async function saveDraft(
  draft: ProfileDraft,
  goals: Macros,
  { today, previousWeight }: { today: DayKey; previousWeight: number | null },
): Promise<Profile> {
  if (!isDraftValid(draft, today)) throw new Error('Incomplete profile');
  if (draft.weightKg !== null && draft.weightKg !== previousWeight) {
    await setWeight(today, draft.weightKg);
  }
  return saveProfile({
    birthDate: draft.birthDate,
    heightCm: draft.heightCm,
    sex: draft.sex!,
    activity: draft.activity,
    targetWeightKg: draft.targetWeightKg,
    goals,
  });
}
