// IndexedDB-backed cache for parsed replays.
//
// Why IDB and not localStorage: replay payloads can run to several MB,
// well past the 5 MB localStorage cap shared across the whole origin.
// IDB stores binary natively, has a much larger quota, and keeps the
// rest of the app's localStorage state untouched.
//
// Schema: one object store 'replays' keyed by `id` (a sha-256 prefix of
// the replay filename + sample count, computed at upload time). Value is
// the raw ArrayBuffer produced by encodeReplay.

const DB_NAME = 'wor-log-analyzer';
const DB_VERSION = 1;
const STORE = 'replays';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode) {
  return openDb().then(db => db.transaction(STORE, mode).objectStore(STORE));
}

export async function putReplay(id, arrayBuffer) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(arrayBuffer, id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function getReplay(id) {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
  });
}

export async function deleteReplay(id) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function listReplayIds() {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

// Stable replay id derived from filename + sample count. Used as both the
// IDB key and the round-side `replayId` reference. We avoid hashing the
// payload itself to keep id derivation synchronous-friendly (matters when
// rehydrating on app boot before async crypto would be awaited).
export function computeReplayId(filename, sampleCount, frameCount) {
  // 32-bit FNV-1a — good enough for collision avoidance within one user's
  // local store, no crypto guarantees needed.
  let h = 0x811c9dc5;
  const mix = (s) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  mix(filename || '');
  mix('|');
  mix(String(sampleCount || 0));
  mix('|');
  mix(String(frameCount || 0));
  return ('00000000' + h.toString(16)).slice(-8);
}
