/**
 * Handoff system for passing media files from the landing preview
 * to novelty tools client-side without server roundtrips or disk writes.
 *
 * - Backed by IndexedDB when available.
 * - In-memory fallback for environments without IndexedDB (e.g., SSR, Vitest, unit tests).
 * - Entries expire after 10 minutes (600,000 ms).
 * - takeFile(id) is destructive: deleting the entry on take.
 */

const DB_NAME = "imbrgr_landing_handoff";
const DB_VERSION = 1;
const STORE_NAME = "files";
export const HANDOFF_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

interface StoredEntry {
  id: string;
  name: string;
  type: string;
  lastModified: number;
  data: ArrayBuffer;
  expiresAt: number;
}

// In-memory store fallback (used in Node / SSR / private mode or fallback)
const inMemoryStore = new Map<
  string,
  { file: File; expiresAt: number }
>();

function generateId(): string {
  // Deterministic or timestamp + crypto random string
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `handoff_${Date.now()}_${Math.floor(Date.now() % 100000)}`;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          // Fall back gracefully to memory
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

/**
 * Stores a file in handoff storage and returns a unique handoff ID.
 */
export async function putFile(file: File): Promise<string> {
  const id = generateId();
  const now = Date.now();
  const expiresAt = now + HANDOFF_EXPIRY_MS;

  const db = await getDb();
  if (!db) {
    // In-memory fallback
    inMemoryStore.set(id, { file, expiresAt });
    cleanupMemoryStore();
    return id;
  }

  try {
    const buffer = await file.arrayBuffer();
    const entry: StoredEntry = {
      id,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      data: buffer,
      expiresAt,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Also prune expired entries in IndexedDB lazily
    cleanupIndexedDb(db);
    return id;
  } catch {
    // Fallback to in-memory on IDB write failure
    inMemoryStore.set(id, { file, expiresAt });
    return id;
  }
}

/**
 * Retrieves a file by handoff ID and removes it from storage.
 * Returns null if the file does not exist or has expired.
 */
export async function takeFile(id: string): Promise<File | null> {
  const now = Date.now();

  // Check in-memory store first
  const mem = inMemoryStore.get(id);
  if (mem) {
    inMemoryStore.delete(id);
    if (now > mem.expiresAt) {
      return null;
    }
    return mem.file;
  }

  const db = await getDb();
  if (!db) {
    return null;
  }

  try {
    const entry = await new Promise<StoredEntry | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as StoredEntry | undefined);
      req.onerror = () => reject(req.error);
    });

    if (!entry) {
      return null;
    }

    // Always delete the entry once taken
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    if (now > entry.expiresAt) {
      return null;
    }

    return new File([entry.data], entry.name, {
      type: entry.type,
      lastModified: entry.lastModified,
    });
  } catch {
    return null;
  }
}

function cleanupMemoryStore() {
  const now = Date.now();
  for (const [id, entry] of inMemoryStore.entries()) {
    if (now > entry.expiresAt) {
      inMemoryStore.delete(id);
    }
  }
}

function cleanupIndexedDb(db: IDBDatabase) {
  try {
    const now = Date.now();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const val = cursor.value as StoredEntry;
        if (now > val.expiresAt) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  } catch {
    // Non-blocking cleanup
  }
}

/** Test utility to inspect in-memory store size */
export function _getMemoryStoreSize(): number {
  return inMemoryStore.size;
}

/** Test utility to clear memory store */
export function _clearMemoryStore(): void {
  inMemoryStore.clear();
}
