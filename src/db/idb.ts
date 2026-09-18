/**
 * Minimal promise wrapper around IndexedDB (instead of Dexie/idb).
 * Keep transactions short: never await non-IndexedDB work inside `runTransaction`,
 * or the transaction auto-commits.
 */

/** Runs inside the `versionchange` transaction, so a failure rolls back the whole upgrade. */
export type Migration = (db: IDBDatabase, tx: IDBTransaction) => void;

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface OpenOptions {
  factory?: IDBFactory;
  /** Another tab wants to upgrade: this connection has been closed. */
  onVersionChange?: () => void;
  /** An older connection (another tab) is blocking our upgrade. */
  onBlocked?: () => void;
}

export function openDatabase(
  name: string,
  migrations: readonly Migration[],
  { factory = globalThis.indexedDB, onVersionChange, onBlocked }: OpenOptions = {},
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!factory) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = factory.open(name, migrations.length);
    let migrationError: unknown = null;

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;
      if (!tx) return;
      try {
        for (let version = event.oldVersion; version < migrations.length; version++) {
          migrations[version]?.(db, tx);
        }
      } catch (error) {
        migrationError = error;
        tx.abort();
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        onVersionChange?.();
      };
      resolve(db);
    };
    request.onerror = () => reject(migrationError ?? request.error);
    request.onblocked = () => onBlocked?.();
  });
}

/**
 * Runs `body` in a transaction and resolves with its result once the transaction commits.
 * If `body` throws, the transaction is aborted and nothing is written.
 */
export async function runTransaction<T>(
  db: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode,
  body: (tx: IDBTransaction) => T | Promise<T>,
): Promise<T> {
  const tx = db.transaction(stores, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
  });

  let result: T;
  try {
    result = await body(tx);
  } catch (error) {
    done.catch(() => {});
    try {
      tx.abort();
    } catch {
      // Already finished; report the original error.
    }
    throw error;
  }
  await done;
  return result;
}

export function getRecord<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
  return requestToPromise(store.get(key)) as Promise<T | undefined>;
}

export function getAllRecords<T>(
  source: IDBObjectStore | IDBIndex,
  query?: IDBValidKey | IDBKeyRange | null,
): Promise<T[]> {
  return requestToPromise(source.getAll(query)) as Promise<T[]>;
}

export function putRecord(store: IDBObjectStore, value: unknown): Promise<IDBValidKey> {
  return requestToPromise(store.put(value));
}

export function deleteRecord(store: IDBObjectStore, key: IDBValidKey | IDBKeyRange): Promise<void> {
  return requestToPromise(store.delete(key)).then(() => undefined);
}

export function clearStore(store: IDBObjectStore): Promise<void> {
  return requestToPromise(store.clear()).then(() => undefined);
}

/** Deletes every record whose index value matches `query`. */
export function deleteByIndex(index: IDBIndex, query: IDBValidKey | IDBKeyRange): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    const request = index.openKeyCursor(query);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(count);
        return;
      }
      index.objectStore.delete(cursor.primaryKey);
      count++;
      cursor.continue();
    };
  });
}
