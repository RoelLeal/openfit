/**
 * Record upgrades shared by the IndexedDB migrations (src/db/schema.ts) and the
 * backup-file migrations (src/core/backup.ts), so both paths produce identical data.
 * Never edit a released upgrade: append a new one.
 */

type Raw = Record<string, unknown>;

/**
 * v1 → v2 settings:
 * - profile: `birthYear` becomes `birthDate` (mid-year, the exact day is unknown);
 *   `sex` becomes required (`male` when it was not set).
 * - prefs: new `accent` and `weightUnit` with their defaults.
 */
export function upgradeSettingsV2(record: Raw): Raw {
  if (record.id === 'profile') {
    const { birthYear, sex, ...rest } = record;
    const year = typeof birthYear === 'number' && Number.isInteger(birthYear) ? birthYear : null;
    return {
      ...rest,
      birthDate: 'birthDate' in rest ? rest.birthDate : year ? `${year}-07-01` : null,
      sex: sex === 'female' ? 'female' : 'male',
    };
  }
  if (record.id === 'prefs') {
    return { accent: 'green', weightUnit: 'kg', ...record };
  }
  return record;
}
