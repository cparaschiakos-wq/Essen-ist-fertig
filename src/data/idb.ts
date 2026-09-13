/**
 * Winziger IndexedDB-Wrapper. Bewusst keine Bibliothek: wir brauchen nur
 * "alles lesen" und "eine Zeile schreiben" pro Tabelle, und der lokale Cache
 * soll ohne zusätzliche Abhängigkeit auch dann laufen, wenn der Service Worker
 * die App offline startet.
 */

export const STORES = [
  'recipes',
  'plan_entries',
  'pantry_items',
  'shopping_items',
  'households',
  'meta',
] as const

export type StoreName = (typeof STORES)[number]

const DB_NAME = 'essen-ist-fertig'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return dbPromise
}

function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  action: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const request = action(tx.objectStore(store))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )
}

export function idbGetAll<T>(store: StoreName): Promise<T[]> {
  return run<T[]>(store, 'readonly', (objectStore) => objectStore.getAll() as IDBRequest<T[]>)
}

export function idbPut<T extends { id: string }>(store: StoreName, value: T): Promise<unknown> {
  return run(store, 'readwrite', (objectStore) => objectStore.put(value))
}

export async function idbPutMany<T extends { id: string }>(
  store: StoreName,
  values: T[],
): Promise<void> {
  if (values.length === 0) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const objectStore = tx.objectStore(store)
    for (const value of values) objectStore.put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function idbDelete(store: StoreName, id: string): Promise<unknown> {
  return run(store, 'readwrite', (objectStore) => objectStore.delete(id))
}

/** Schlüssel/Wert-Ablage für Sync-Zeitstempel und die Outbox. */
export async function metaGet<T>(key: string): Promise<T | null> {
  const row = await run<{ id: string; value: T } | undefined>('meta', 'readonly', (objectStore) =>
    objectStore.get(key),
  )
  return row ? row.value : null
}

export function metaSet<T>(key: string, value: T): Promise<unknown> {
  return idbPut('meta', { id: key, value })
}
