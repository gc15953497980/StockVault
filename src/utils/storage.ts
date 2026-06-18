/**
 * IndexedDB-backed storage with localStorage fallback.
 * Large datasets (fund NAV history, value history, PnL calendar) use IndexedDB.
 * Small config/settings keep using localStorage for simplicity.
 */

const DB_NAME = 'StockVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'kvStore';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

// IndexedDB operations
export const idb = {
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  },

  async set<T = unknown>(key: string, value: T): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch { /* ignore */ }
  },

  async remove(key: string): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch { /* ignore */ }
  },

  async clear(): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch { /* ignore */ }
  },

  async keys(): Promise<string[]> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAllKeys();
        req.onsuccess = () => resolve(req.result as string[]);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  },
};

// Unified storage API — uses IndexedDB, falls back to localStorage on error
export const storage = {
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const result = await idb.get<T>(key);
      if (result !== null) return result;
    } catch { /* fallback to localStorage */ }
    return lsGet<T>(key);
  },

  async set<T = unknown>(key: string, value: T): Promise<void> {
    try {
      await idb.set(key, value);
    } catch { /* fallback to localStorage */ }
    // Always also write to localStorage as backup for sync/gist
    lsSet(key, value);
  },

  async remove(key: string): Promise<void> {
    try { await idb.remove(key); } catch { /* ignore */ }
    lsRemove(key);
  },

  async clearAll(): Promise<void> {
    try { await idb.clear(); } catch { /* ignore */ }
    // Also clear localStorage for this app
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('stockvault_')) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  },

  /**
   * Migrate existing localStorage data to IndexedDB.
   * Call once on app startup. Uses a flag to avoid re-migrating on every launch.
   * Note: localStorage data is kept as fallback/backup until stores migrate to `storage.get`.
   */
  async migrateFromLS(): Promise<number> {
    const MIGRATED_FLAG = 'stockvault_idb_migrated';
    if (localStorage.getItem(MIGRATED_FLAG) === '1') return 0;

    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('stockvault_')) continue;
      if (key === MIGRATED_FLAG) continue;
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      try {
        const value = JSON.parse(raw);
        await idb.set(key, value);
        count++;
      } catch { /* skip bad JSON */ }
    }
    localStorage.setItem(MIGRATED_FLAG, '1');
    return count;
  },
};

// localStorage helpers (sync, for initial store hydration)
function lsGet<T = unknown>(key: string): T | null {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : null;
  } catch {
    return null;
  }
}

function lsSet<T = unknown>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded */ }
}

function lsRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// Synchronous localStorage helpers for Zustand store initialization
export const ls = {
  get: lsGet,
  set: lsSet,
  remove: lsRemove,
};
