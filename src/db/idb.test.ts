import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../core/backup.ts';
import { closeDb, getDb, stamp } from './database.ts';
import {
  getAllRecords,
  getRecord,
  openDatabase,
  putRecord,
  runTransaction,
  type Migration,
} from './idb.ts';
import { DB_NAME, DB_VERSION, migrations } from './schema.ts';
import { useFreshDatabase } from './test-utils.ts';

useFreshDatabase();

describe('schema', () => {
  it('creates every store and index', async () => {
    const db = await getDb();
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual([
      'catalog',
      'entries',
      'foods',
      'meals',
      'meta',
      'settings',
      'weights',
    ]);
    const tx = db.transaction(['entries', 'weights', 'catalog']);
    expect([...tx.objectStore('entries').indexNames].sort()).toEqual([
      'date',
      'foodId',
      'updatedAt',
    ]);
    expect([...tx.objectStore('weights').indexNames].sort()).toEqual(['date', 'updatedAt']);
    expect([...tx.objectStore('catalog').indexNames]).toEqual(['pack']);
  });

  it('keeps the backup schema version in step with the database version', () => {
    expect(SCHEMA_VERSION).toBe(DB_VERSION);
  });
});

describe('migrations', () => {
  it('upgrades v1 settings to v2 (birth date, sex, preference defaults)', async () => {
    const v1 = await openDatabase(DB_NAME, migrations.slice(0, 1));
    await runTransaction(v1, 'settings', 'readwrite', async (tx) => {
      const store = tx.objectStore('settings');
      await putRecord(store, {
        id: 'profile',
        createdAt: 1,
        updatedAt: 1,
        birthYear: 1988,
        heightCm: 165,
        sex: null,
        activity: 'moderate',
        targetWeightKg: 60,
        goals: { kcal: 1800, protein: 90, carbs: 200, fat: 60 },
      });
      await putRecord(store, {
        id: 'prefs',
        createdAt: 1,
        updatedAt: 1,
        locale: 'es',
        theme: 'light',
      });
    });
    v1.close();

    const v2 = await openDatabase(DB_NAME, migrations);
    expect(v2.version).toBe(2);
    const [profile, prefs] = await runTransaction(v2, 'settings', 'readonly', (tx) =>
      Promise.all([
        getRecord(tx.objectStore('settings'), 'profile'),
        getRecord(tx.objectStore('settings'), 'prefs'),
      ]),
    );
    expect(profile).toMatchObject({ birthDate: '1988-07-01', sex: 'male', heightCm: 165 });
    expect(profile).not.toHaveProperty('birthYear');
    expect(prefs).toMatchObject({
      locale: 'es',
      theme: 'light',
      accent: 'green',
      weightUnit: 'kg',
    });
    v2.close();
  });

  it('upgrades an existing database without losing data', async () => {
    const v1 = await openDatabase(DB_NAME, migrations);
    await runTransaction(v1, 'entries', 'readwrite', (tx) =>
      putRecord(tx.objectStore('entries'), {
        id: 'e1',
        date: '2026-09-16',
        updatedAt: 1,
        amount: 2,
      }),
    );
    v1.close();

    // A hypothetical v2 adds an index and transforms existing records.
    const v2Migration: Migration = (_db, tx) => {
      const store = tx.objectStore('entries');
      store.createIndex('meal', 'meal');
      store.openCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (!cursor) return;
        cursor.update({ ...cursor.value, meal: cursor.value.meal ?? 'snacks' });
        cursor.continue();
      };
    };
    const v2 = await openDatabase(DB_NAME, [...migrations, v2Migration]);
    expect(v2.version).toBe(migrations.length + 1);
    const entries = await runTransaction(v2, 'entries', 'readonly', (tx) =>
      getAllRecords(tx.objectStore('entries').index('meal'), 'snacks'),
    );
    expect(entries).toEqual([
      { id: 'e1', date: '2026-09-16', updatedAt: 1, amount: 2, meal: 'snacks' },
    ]);
    v2.close();
  });

  it('rolls back a failing migration and keeps the previous version', async () => {
    const v1 = await openDatabase(DB_NAME, migrations);
    await runTransaction(v1, 'foods', 'readwrite', (tx) =>
      putRecord(tx.objectStore('foods'), { id: 'f1', updatedAt: 1 }),
    );
    v1.close();

    const broken: Migration = (db) => {
      db.createObjectStore('temporary');
      throw new Error('boom');
    };
    await expect(openDatabase(DB_NAME, [...migrations, broken])).rejects.toThrow('boom');

    const again = await openDatabase(DB_NAME, migrations);
    expect(again.version).toBe(migrations.length);
    expect(again.objectStoreNames.contains('temporary')).toBe(false);
    const food = await runTransaction(again, 'foods', 'readonly', (tx) =>
      getRecord(tx.objectStore('foods'), 'f1'),
    );
    expect(food).toEqual({ id: 'f1', updatedAt: 1 });
    again.close();
  });
});

describe('runTransaction', () => {
  it('aborts every write when the body throws', async () => {
    const db = await getDb();
    await expect(
      runTransaction(db, 'foods', 'readwrite', async (tx) => {
        await putRecord(tx.objectStore('foods'), { id: 'a', updatedAt: 1 });
        throw new Error('validation failed');
      }),
    ).rejects.toThrow('validation failed');
    const all = await runTransaction(db, 'foods', 'readonly', (tx) =>
      getAllRecords(tx.objectStore('foods')),
    );
    expect(all).toEqual([]);
  });

  it('reopens the connection after closing', async () => {
    await getDb();
    await closeDb();
    expect((await getDb()).version).toBe(DB_VERSION);
  });
});

describe('stamp', () => {
  it('creates ids and timestamps and always moves updatedAt forward', () => {
    const created = stamp({ name: 'x' }, 1000);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created).toMatchObject({ createdAt: 1000, updatedAt: 1000, deletedAt: null });

    const updated = stamp(created, 1000);
    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(1000);
    expect(updated.updatedAt).toBe(1001);
  });
});
