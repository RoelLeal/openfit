import { describe, expect, it, vi } from 'vitest';
import { encodePack, parsePack } from '../catalog/packs.ts';
import { parseBackup } from '../core/backup.ts';
import { parseCsv } from '../core/csv.ts';
import { DEFAULT_GOALS } from '../core/goals.ts';
import { onChange } from './changes.ts';
import {
  ensureBaseCatalog,
  getCatalogFood,
  getCatalogFoods,
  installPack,
  listInstalledPacks,
  removePack,
} from './repos/catalog.ts';
import {
  buildCsv,
  deleteAllData,
  exportBackup,
  getLastBackupAt,
  hasUserData,
  importBackup,
  markBackupExported,
} from './repos/data.ts';
import {
  addEntries,
  addEntry,
  datesWithEntries,
  deleteEntry,
  listEntries,
  recentFoods,
  restoreEntry,
  updateEntry,
} from './repos/entries.ts';
import {
  deleteCustomFood,
  findFood,
  getCustomFood,
  listCustomFoods,
  listSearchableFoods,
  restoreCustomFood,
  saveCustomFood,
} from './repos/foods.ts';
import { deleteMeal, listMeals, logMeal, mealFromEntries, saveMeal } from './repos/meals.ts';
import { getDeviceId, getMeta } from './repos/meta.ts';
import {
  getPrefs,
  getProfile,
  savePrefs,
  saveProfile,
  type ProfileInput,
} from './repos/settings.ts';
import {
  deleteWeight,
  latestWeight,
  listWeights,
  restoreWeight,
  setWeight,
} from './repos/weights.ts';
import { eggFacts, riceFacts, useFreshDatabase } from './test-utils.ts';

useFreshDatabase();

const app = { name: 'OpenFit', version: 'test' };

const profileInput: ProfileInput = {
  birthDate: '1990-05-20',
  heightCm: 175,
  sex: 'female',
  activity: 'moderate',
  targetWeightKg: 65,
  goals: { ...DEFAULT_GOALS },
};

const testPack = (id: string, count: number) =>
  parsePack(
    encodePack(
      {
        id,
        version: '1',
        name: `Pack ${id}`,
        license: 'CC0-1.0',
        attribution: 'test',
        source: 'test',
      },
      Array.from({ length: count }, (_, i) => ({
        id: String(i),
        name: `Food ${i}`,
        kcal: i,
        protein: 0,
        carbs: 0,
        fat: 0,
      })),
    ),
  );

describe('settings', () => {
  it('stores the profile as a singleton', async () => {
    expect(await getProfile()).toBeNull();
    const first = await saveProfile(profileInput);
    expect(first.id).toBe('profile');
    const second = await saveProfile({ ...profileInput, heightCm: 176 });
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt);
    expect((await getProfile())?.heightCm).toBe(176);
  });

  it('rejects invalid profiles', async () => {
    await expect(saveProfile({ ...profileInput, heightCm: -1 })).rejects.toThrow(/heightCm/);
    expect(await getProfile()).toBeNull();
  });

  it('returns default prefs and merges patches', async () => {
    expect(await getPrefs()).toMatchObject({
      locale: null,
      theme: 'system',
      accent: 'green',
      weightUnit: 'kg',
    });
    await savePrefs({ theme: 'dark' });
    await savePrefs({ locale: 'en' });
    await savePrefs({ accent: 'blue', weightUnit: 'lb' });
    expect(await getPrefs()).toMatchObject({
      locale: 'en',
      theme: 'dark',
      accent: 'blue',
      weightUnit: 'lb',
    });
  });

  it('keeps a stable device id', async () => {
    const id = await getDeviceId();
    expect(await getDeviceId()).toBe(id);
  });
});

describe('custom foods', () => {
  it('creates, updates, soft-deletes and restores', async () => {
    const food = await saveCustomFood({ ...riceFacts, brand: '  ' });
    expect(food.brand).toBeUndefined();
    expect(await listCustomFoods()).toHaveLength(1);

    const edited = await saveCustomFood({ ...food, name: 'Arroz de la abuela' });
    expect(edited.id).toBe(food.id);
    expect(edited.createdAt).toBe(food.createdAt);

    await deleteCustomFood(food.id);
    expect(await listCustomFoods()).toEqual([]);
    expect(await getCustomFood(food.id)).toBeNull();
    expect(await findFood(food.id)).toBeNull();

    await restoreCustomFood(food.id);
    expect((await getCustomFood(food.id))?.name).toBe('Arroz de la abuela');
  });

  it('validates before saving', async () => {
    await expect(saveCustomFood({ ...riceFacts, name: ' ' })).rejects.toThrow(/name/);
    await expect(saveCustomFood({ ...riceFacts, baseAmount: 0 })).rejects.toThrow(/baseAmount/);
    expect(await listCustomFoods()).toEqual([]);
  });

  it('notifies listeners about writes', async () => {
    const listener = vi.fn();
    const off = onChange(listener);
    await saveCustomFood(riceFacts);
    off();
    expect(listener).toHaveBeenCalledWith(['foods']);
  });
});

describe('catalog', () => {
  it('seeds the bundled base pack once per version', async () => {
    expect(await ensureBaseCatalog()).toBe(true);
    expect(await ensureBaseCatalog()).toBe(false);
    const egg = await getCatalogFood('base:egg');
    expect(egg?.names?.es).toBe('Huevo entero');
    expect((await getCatalogFoods()).length).toBeGreaterThanOrEqual(90);
    expect(await findFood('base:egg')).toEqual(egg);
  });

  it('reinstalls when the version changes, replacing old rows', async () => {
    await ensureBaseCatalog('v1', async () => ({
      ...encodePack(testPack('base', 3), []),
      foods: [],
    }));
    const pack = testPack('base', 2);
    await ensureBaseCatalog('v2', async () =>
      encodePack({ ...pack, version: 'v2' }, [
        { id: 'x', name: 'X', kcal: 1, protein: 0, carbs: 0, fat: 0 },
      ]),
    );
    const foods = await getCatalogFoods();
    expect(foods.map((f) => f.id)).toEqual(['base:x']);
  });

  it('installs and removes optional packs atomically', async () => {
    await installPack(testPack('extra', 500));
    expect((await getCatalogFoods()).length).toBe(500);
    expect(await listInstalledPacks()).toMatchObject([{ id: 'extra', foods: 500 }]);

    await installPack(testPack('extra', 10));
    expect((await getCatalogFoods()).length).toBe(10);

    await removePack('extra');
    expect(await getCatalogFoods()).toEqual([]);
    expect(await listInstalledPacks()).toEqual([]);
    await expect(removePack('base')).rejects.toThrow(/base pack/);
  });

  it('lists custom foods before catalog foods for search', async () => {
    await installPack(testPack('extra', 2));
    const custom = await saveCustomFood(riceFacts);
    expect((await listSearchableFoods()).map((f) => f.id)).toEqual([
      custom.id,
      'extra:0',
      'extra:1',
    ]);
  });
});

describe('entries', () => {
  const egg = {
    date: '2026-09-16',
    meal: 'breakfast',
    foodId: 'base:egg',
    food: eggFacts,
    amount: 2,
    unit: 'unit' as const,
  };

  it('adds, lists by date in order, updates and deletes with undo', async () => {
    const [first, second] = await addEntries([egg, { ...egg, amount: 1 }]);
    await addEntry({ ...egg, date: '2026-09-15' });
    expect((await listEntries('2026-09-16')).map((e) => e.id)).toEqual([first!.id, second!.id]);

    const updated = await updateEntry(first!.id, { amount: 3, meal: 'lunch' });
    expect(updated).toMatchObject({ amount: 3, meal: 'lunch' });
    expect(updated.updatedAt).toBeGreaterThan(first!.updatedAt);

    await deleteEntry(second!.id);
    expect(await listEntries('2026-09-16')).toHaveLength(1);
    await restoreEntry(second!.id);
    expect(await listEntries('2026-09-16')).toHaveLength(2);

    expect([...(await datesWithEntries('2026-09-01', '2026-09-30'))].sort()).toEqual([
      '2026-09-15',
      '2026-09-16',
    ]);
  });

  it('stores an immutable snapshot of the food', async () => {
    const food = await saveCustomFood(riceFacts);
    const entry = await addEntry({ ...egg, foodId: food.id, food, amount: 200, unit: 'g' });
    expect(entry.food).toEqual(riceFacts);
    expect(entry.food).not.toHaveProperty('id');

    await saveCustomFood({ ...food, macros: { ...food.macros, kcal: 999 } });
    expect((await listEntries(egg.date))[0]?.food.macros.kcal).toBe(130);
  });

  it('rejects units that do not apply and invalid values', async () => {
    await expect(addEntry({ ...egg, unit: 'ml' })).rejects.toThrow(/does not apply/);
    await expect(addEntry({ ...egg, amount: -1 })).rejects.toThrow(/amount/);
    await expect(addEntry({ ...egg, date: '16/09/2026' })).rejects.toThrow(/date/);
    const entry = await addEntry(egg);
    await expect(updateEntry(entry.id, { unit: 'serving' })).rejects.toThrow(/does not apply/);
    expect(await listEntries(egg.date)).toHaveLength(1);
  });

  it('lists recent foods with their last quantity and skips deleted custom foods', async () => {
    const rice = await saveCustomFood(riceFacts);
    const gone = await saveCustomFood({ ...riceFacts, name: 'Gone' });
    await addEntry({ ...egg, date: '2026-09-10', amount: 1 });
    await addEntry({ ...egg, date: '2026-09-15', amount: 3 });
    await addEntry({ ...egg, foodId: rice.id, food: rice, amount: 150, unit: 'g' });
    await addEntry({ ...egg, foodId: gone.id, food: gone, amount: 50, unit: 'g' });
    await addEntry({ ...egg, date: '2025-01-01' });
    await deleteCustomFood(gone.id);
    await saveCustomFood({ ...rice, name: 'Arroz renombrado' });

    const recent = await recentFoods({ today: '2026-09-16', days: 30 });
    expect(recent.map((r) => [r.foodId, r.amount, r.uses])).toEqual([
      [rice.id, 150, 1],
      ['base:egg', 3, 2],
    ]);
    expect(recent[0]?.food.name).toBe('Arroz renombrado');
  });
});

describe('meals', () => {
  it('saves templates and logs them as entries using current food data', async () => {
    const rice = await saveCustomFood(riceFacts);
    const meal = await saveMeal({
      name: ' Desayuno habitual ',
      items: [
        { foodId: 'base:missing', food: eggFacts, amount: 2, unit: 'unit' },
        { foodId: rice.id, food: rice, amount: 100, unit: 'g' },
      ],
    });
    expect(meal.name).toBe('Desayuno habitual');
    await saveCustomFood({ ...rice, macros: { ...rice.macros, kcal: 200 } });

    const entries = await logMeal(meal, '2026-09-16', 'breakfast');
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.food.macros.kcal)).toEqual([143, 200]);
    expect(await listEntries('2026-09-16')).toHaveLength(2);

    const copy = await mealFromEntries('Copia', entries);
    expect(copy.items.map((i) => i.amount)).toEqual([2, 100]);
    expect((await listMeals()).map((m) => m.name)).toEqual(['Copia', 'Desayuno habitual']);

    await deleteMeal(copy.id);
    expect(await listMeals()).toHaveLength(1);
  });

  it('requires a name', async () => {
    await expect(saveMeal({ name: '', items: [] })).rejects.toThrow(/name/);
  });
});

describe('weights', () => {
  it('keeps one record per day, sorted by date', async () => {
    await setWeight('2026-09-16', 70.4);
    await setWeight('2026-09-10', 71);
    const replaced = await setWeight('2026-09-16', 70.2);
    expect(replaced.id).toBe('weight:2026-09-16');
    expect((await listWeights()).map((w) => [w.date, w.kg])).toEqual([
      ['2026-09-10', 71],
      ['2026-09-16', 70.2],
    ]);
    expect((await latestWeight())?.kg).toBe(70.2);

    await deleteWeight(replaced.id);
    expect((await latestWeight())?.kg).toBe(71);
    await restoreWeight(replaced.id);
    expect((await latestWeight())?.kg).toBe(70.2);
    await expect(setWeight('2026-09-17', 0)).rejects.toThrow(/kg/);
  });
});

describe('data ownership', () => {
  async function seedUserData() {
    await ensureBaseCatalog();
    await installPack(testPack('extra', 3));
    await saveProfile(profileInput);
    await savePrefs({ locale: 'es' });
    const rice = await saveCustomFood(riceFacts);
    const [entry] = await addEntries([
      { date: '2026-09-16', meal: 'lunch', foodId: rice.id, food: rice, amount: 200, unit: 'g' },
      {
        date: '2026-09-16',
        meal: 'breakfast',
        foodId: 'base:egg',
        food: eggFacts,
        amount: 2,
        unit: 'unit',
      },
    ]);
    await deleteEntry(entry!.id);
    await addEntry({
      date: '2026-09-15',
      meal: 'dinner',
      foodId: rice.id,
      food: rice,
      amount: 100,
      unit: 'g',
    });
    await saveMeal({
      name: 'Cena',
      items: [{ foodId: rice.id, food: rice, amount: 100, unit: 'g' }],
    });
    await setWeight('2026-09-16', 70);
    return { rice, deleted: entry! };
  }

  it('exports, deletes and restores everything', async () => {
    await seedUserData();
    const backup = await exportBackup(app);
    expect(backup.data.entries).toHaveLength(3); // tombstone included
    expect(backup.data.packs).toEqual(['extra']);
    expect(backup.data.settings.map((s) => s.id).sort()).toEqual(['prefs', 'profile']);

    // The JSON file must be accepted by the parser.
    const parsed = parseBackup(JSON.stringify(backup));
    expect(await hasUserData()).toBe(true);

    await deleteAllData();
    expect(await hasUserData()).toBe(false);
    expect(await getProfile()).toBeNull();
    expect((await getPrefs()).locale).toBeNull();
    // The public catalog survives.
    expect(await getCatalogFood('base:egg')).not.toBeNull();
    expect((await listInstalledPacks()).map((p) => p.id).sort()).toEqual(['base', 'extra']);

    await importBackup(parsed, 'replace');
    expect(await getProfile()).toMatchObject({ heightCm: 175 });
    expect((await getPrefs()).locale).toBe('es');
    expect(await listEntries('2026-09-16')).toHaveLength(1);
    expect(await listCustomFoods()).toHaveLength(1);
    expect(await listMeals()).toHaveLength(1);
    expect(await listWeights()).toHaveLength(1);
    expect(await exportBackup(app)).toMatchObject({ data: backup.data });
  });

  it('replace mode discards local data that is not in the backup', async () => {
    await seedUserData();
    const backup = parseBackup(JSON.stringify(await exportBackup(app)));
    await setWeight('2026-09-17', 69);
    await importBackup(backup, 'replace');
    expect(await listWeights()).toHaveLength(1);
  });

  it('merge mode keeps the newest version of each record and propagates deletions', async () => {
    const { rice } = await seedUserData();
    const backup = parseBackup(JSON.stringify(await exportBackup(app)));

    // Local changes after the backup.
    await setWeight('2026-09-17', 69); // only local: kept
    await saveCustomFood({ ...rice, name: 'Newer local name' }); // newer locally: kept
    const [lunch] = await listEntries('2026-09-15');
    // Backup has a newer version of the weight and a deletion of the dinner entry.
    backup.data.weights[0] = { ...backup.data.weights[0]!, kg: 68, updatedAt: Date.now() + 10_000 };
    backup.data.entries = backup.data.entries.map((e) =>
      e.id === lunch!.id
        ? { ...e, deletedAt: Date.now() + 10_000, updatedAt: Date.now() + 10_000 }
        : e,
    );

    await importBackup(backup, 'merge');
    expect((await listWeights()).map((w) => [w.date, w.kg])).toEqual([
      ['2026-09-16', 68],
      ['2026-09-17', 69],
    ]);
    expect((await listCustomFoods())[0]?.name).toBe('Newer local name');
    expect(await listEntries('2026-09-15')).toEqual([]);
  });

  it('tracks the last backup date', async () => {
    expect(await getLastBackupAt()).toBeNull();
    await markBackupExported(1234);
    expect(await getLastBackupAt()).toBe(1234);
    expect(await getMeta('lastBackupAt')).toBe(1234);
  });

  it('builds CSV exports', async () => {
    await seedUserData();
    const entries = parseCsv(await buildCsv('entries', 'es'));
    expect(entries[0]).toEqual([
      'date',
      'meal',
      'food',
      'brand',
      'amount',
      'unit',
      'kcal',
      'protein_g',
      'carbs_g',
      'fat_g',
    ]);
    expect(entries.slice(1)).toEqual([
      ['2026-09-15', 'dinner', 'Arroz casero', '', '100', 'g', '130', '2.7', '28', '0.3'],
      ['2026-09-16', 'breakfast', 'Huevo', '', '2', 'unit', '143', '12.6', '0.7', '9.5'],
    ]);

    const totals = parseCsv(await buildCsv('daily-totals', 'es'));
    expect(totals[2]).toEqual([
      '2026-09-16',
      '143',
      '12.6',
      '0.7',
      '9.5',
      '2000',
      '100',
      '250',
      '65',
    ]);

    expect(parseCsv(await buildCsv('weight', 'es'))).toEqual([
      ['date', 'weight_kg'],
      ['2026-09-16', '70'],
    ]);
    expect(parseCsv(await buildCsv('custom-foods', 'es'))[1]?.slice(0, 5)).toEqual([
      'Arroz casero',
      '',
      '100',
      'g',
      '130',
    ]);
  });
});
