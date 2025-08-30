
// Minimal IndexedDB wrapper and migration from localStorage
const DB_NAME = 'practice_playbook_db';
const DB_VER = 1;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('logs')) {
        db.createObjectStore('logs', { keyPath: 'key' }); // key = id+ts or similar
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbPut(store, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGetAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function idbClear(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Migration from localStorage (runs once)
(async function migrateFromLocalStorage(){
  try {
    const migrated = localStorage.getItem('pp_migrated_to_idb') === '1';
    if (migrated) return;
    // sessions_all -> sessions
    const sessions = JSON.parse(localStorage.getItem('pp_sessions_all') || '[]');
    for (const s of sessions) await idbPut('sessions', s);
    // logs -> logs
    const logs = JSON.parse(localStorage.getItem('pp_sessions') || '[]');
    for (const l of logs) await idbPut('logs', { key: `${l.id}-${l.ts}`, ...l });
    // mark and optionally clear old keys
    localStorage.setItem('pp_migrated_to_idb', '1');
    // leave old data in localStorage as a backup
  } catch (e) {
    console.warn('Migration failed:', e);
  }
})();

// Exported API used by app.js
const storageAPI = {
  async listSessions() { return await idbGetAll('sessions'); },
  async saveSession(sess) { await idbPut('sessions', sess); },
  async listLogs() { return await idbGetAll('logs'); },
  async saveLegacyLog(log) { await idbPut('logs', { key: `${log.id}-${log.ts}`, ...log }); },
  async importExport(obj, mode) {
    if (mode === 'export') {
      const sessions = await idbGetAll('sessions');
      const logs = await idbGetAll('logs');
      return { sessions, logs };
    } else if (mode === 'import') {
      if (obj.sessions) {
        for (const s of obj.sessions) await idbPut('sessions', s);
      }
      if (obj.logs) {
        for (const l of obj.logs) await idbPut('logs', { key: `${l.id}-${l.ts}`, ...l });
      }
      return true;
    }
  }
};
