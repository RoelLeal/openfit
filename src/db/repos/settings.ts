/** Profile and preferences: singleton records with fixed ids. */
import type { Prefs, Profile, Synced } from '../../core/types.ts';
import { assertSettings } from '../../core/validate.ts';
import { isAlive, read, stamp, write } from '../database.ts';
import { getRecord, putRecord } from '../idb.ts';

export type ProfileInput = Omit<Profile, keyof Synced | 'id'>;
export type PrefsInput = Partial<Omit<Prefs, keyof Synced | 'id'>>;

export const DEFAULT_PREFS: Readonly<Omit<Prefs, keyof Synced | 'id'>> = Object.freeze({
  locale: null,
  theme: 'system',
  accent: 'green',
  weightUnit: 'kg',
});

async function getSetting<T extends Synced>(id: T['id']): Promise<T | null> {
  const record = await read('settings', (tx) => getRecord<T>(tx.objectStore('settings'), id));
  return record && isAlive(record) ? record : null;
}

async function putSetting<T extends Profile | Prefs>(
  id: T['id'],
  build: (current: T | undefined) => T,
) {
  return write('settings', async (tx) => {
    const store = tx.objectStore('settings');
    const current = await getRecord<T>(store, id);
    const record = build(current);
    assertSettings(record);
    await putRecord(store, record);
    return record;
  });
}

export function getProfile(): Promise<Profile | null> {
  return getSetting<Profile>('profile');
}

export function saveProfile(input: ProfileInput): Promise<Profile> {
  return putSetting<Profile>('profile', (current) =>
    stamp({
      ...input,
      goals: { ...input.goals },
      id: 'profile' as const,
      createdAt: current?.createdAt,
      updatedAt: current?.updatedAt,
      deletedAt: null,
    }),
  );
}

export async function getPrefs(): Promise<Prefs> {
  const prefs = await getSetting<Prefs>('prefs');
  return prefs ?? { id: 'prefs', createdAt: 0, updatedAt: 0, deletedAt: null, ...DEFAULT_PREFS };
}

export function savePrefs(patch: PrefsInput): Promise<Prefs> {
  return putSetting<Prefs>('prefs', (current) =>
    stamp({
      ...DEFAULT_PREFS,
      ...current,
      ...patch,
      id: 'prefs' as const,
      createdAt: current?.createdAt,
      updatedAt: current?.updatedAt,
      deletedAt: null,
    }),
  );
}
