// IndexedDB wrapper for Philosophy Wiki
// Schema: entries store keyed by slug; notes store (since version 2, 27 November 2026)
// keeps each philosopher's source list and fact-check, keyed by path, for offline reading

const DB_NAME = 'philwiki';
const DB_VERSION = 2;
const NOTES = 'notes';
const STORE = 'entries';

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'slug' });
        store.createIndex('title', 'title', { unique: false });
      }
      if (!db.objectStoreNames.contains(NOTES)) {
        db.createObjectStore(NOTES);
      }
    };

    req.onsuccess = e => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = e => reject(e.target.error);
  });
}

// Write a single entry (upsert)
async function putEntry(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

// Bulk seed — only writes entries not already present (based on slug + version)
async function seedEntries(entries) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let pending = entries.length;

    entries.forEach(entry => {
      const get = store.get(entry.slug);
      get.onsuccess = e => {
        const existing = e.target.result;
        // Re-seed if missing or version changed
        if (!existing || existing.version !== entry.version) {
          store.put(entry);
        }
        if (--pending === 0) resolve();
      };
      get.onerror = e => reject(e.target.error);
    });

    if (entries.length === 0) resolve();
    tx.onerror = e => reject(e.target.error);
  });
}

// Get a single entry by slug
async function getEntry(slug) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(slug);
    req.onsuccess = e => resolve(e.target.result || null);
    req.onerror = e => reject(e.target.error);
  });
}

// Get all entries (returns array sorted by title)
async function getAllEntries() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).index('title').getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

// Full-text search across title, body, and tags
async function searchEntries(query) {
  const all = await getAllEntries();
  const q = query.toLowerCase();
  return all.filter(e =>
    e.title.toLowerCase().includes(q) ||
    e.body.toLowerCase().includes(q) ||
    (e.tags || []).some(t => t.toLowerCase().includes(q))
  );
}

// Notes (source index, fact-checks): plain text keyed by their path in the repo
async function putNote(path, text) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTES, 'readwrite');
    tx.objectStore(NOTES).put(text, path);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

async function getNote(path) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTES, 'readonly');
    const req = tx.objectStore(NOTES).get(path);
    req.onsuccess = e => resolve(e.target.result ?? null);
    req.onerror = e => reject(e.target.error);
  });
}

export { putNote, getNote, putEntry, seedEntries, getEntry, getAllEntries, searchEntries };
