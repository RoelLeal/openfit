/**
 * IndexedDB schema. `DB_VERSION` is the number of migrations.
 *
 * RULES
 * - Never edit a migration that has been released. Append a new one.
 * - A migration runs inside the upgrade transaction: if it throws, nothing changes.
 * - When you add a migration, also bump `SCHEMA_VERSION` in core/backup.ts and add a
 *   backup migration so old backup files can still be restored.
 */
import { upgradeSettingsV2 } from '../core/migrations.ts';
import type { Migration } from './idb.ts';

export const DB_NAME = 'openfit';

export type StoreName = 'meta' | 'settings' | 'foods' | 'meals' | 'entries' | 'weights' | 'catalog';

/** Stores with personal data: backed up, and synced in the future. */
export const USER_STORES = ['settings', 'foods', 'meals', 'entries', 'weights'] as const;
export type UserStore = (typeof USER_STORES)[number];

export const migrations: readonly Migration[] = [
  // v1: initial schema.
  (db) => {
    db.createObjectStore('meta', { keyPath: 'key' });

    for (const name of ['settings', 'foods', 'meals'] as const) {
      db.createObjectStore(name, { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
    }

    const entries = db.createObjectStore('entries', { keyPath: 'id' });
    entries.createIndex('date', 'date');
    entries.createIndex('updatedAt', 'updatedAt');
    entries.createIndex('foodId', 'foodId');

    const weights = db.createObjectStore('weights', { keyPath: 'id' });
    weights.createIndex('date', 'date');
    weights.createIndex('updatedAt', 'updatedAt');

    db.createObjectStore('catalog', { keyPath: 'id' }).createIndex('pack', 'pack');
  },

  // v2: profile birth date and required sex; accent and weight unit preferences.
  (_db, tx) => {
    const store = tx.objectStore('settings');
    store.openCursor().onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor) return;
      cursor.update(upgradeSettingsV2(cursor.value as Record<string, unknown>));
      cursor.continue();
    };
  },
];

export const DB_VERSION = migrations.length;
