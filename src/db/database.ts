/** Shared connection and read/write helpers used by every repository. */
import type { Synced } from '../core/types.ts';
import { newId } from '../core/ids.ts';
import { emitChange } from './changes.ts';
import { openDatabase, runTransaction } from './idb.ts';
import { DB_NAME, migrations, type StoreName } from './schema.ts';

let connection: Promise<IDBDatabase> | null = null;
let onVersionChange: () => void = () => {};
let onBlocked: () => void = () => {};

/** Lets the UI react when another tab upgrades or blocks the database. */
export function setDatabaseHandlers(handlers: {
  versionChange?: () => void;
  blocked?: () => void;
}) {
  onVersionChange = handlers.versionChange ?? onVersionChange;
  onBlocked = handlers.blocked ?? onBlocked;
}

export function getDb(): Promise<IDBDatabase> {
  connection ??= openDatabase(DB_NAME, migrations, {
    onVersionChange: () => {
      connection = null;
      onVersionChange();
    },
    onBlocked: () => onBlocked(),
  }).catch((error: unknown) => {
    connection = null;
    throw error;
  });
  return connection;
}

/** Closes the connection (tests, and before deleting the database). */
export async function closeDb(): Promise<void> {
  const current = connection;
  connection = null;
  if (current) (await current).close();
}

export async function read<T>(
  stores: StoreName | StoreName[],
  body: (tx: IDBTransaction) => T | Promise<T>,
): Promise<T> {
  return runTransaction(await getDb(), stores, 'readonly', body);
}

export async function write<T>(
  stores: StoreName | StoreName[],
  body: (tx: IDBTransaction) => T | Promise<T>,
): Promise<T> {
  const result = await runTransaction(await getDb(), stores, 'readwrite', body);
  emitChange(Array.isArray(stores) ? stores : [stores]);
  return result;
}

/**
 * Fills in the sync fields. `updatedAt` always moves forward, even for two writes
 * within the same millisecond, so last-writer-wins merges stay correct.
 */
export function stamp<T extends object>(
  record: T & Partial<Synced>,
  now: number = Date.now(),
): T & Synced {
  return {
    ...record,
    id: record.id ?? newId(),
    createdAt: record.createdAt ?? now,
    updatedAt: Math.max(now, (record.updatedAt ?? 0) + 1),
    deletedAt: record.deletedAt ?? null,
  };
}

export function isAlive(record: Partial<Synced> | undefined | null): boolean {
  return !!record && !record.deletedAt;
}
