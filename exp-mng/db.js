// Database Core Configurations for Version 1 Scope
const DB_NAME = "LedgerCoreDB";
const DB_VERSION = 1;
const STORE_TX = "transactions";

/**
 * Initializes and establishes a connection with IndexedDB.
 */
function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // Initialize transaction store using automatic incremental keys
      if (!db.objectStoreNames.contains(STORE_TX)) {
        db.createObjectStore(STORE_TX, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Commits a record row item directly to the active ObjectStore.
 */
async function writeToStore(storeName, data) {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Pulls all matching array items from memory.
 */
async function getAllFromStore(storeName) {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort records descending by date so newest entries display first
      const sorted = (request.result || []).sort((a, b) => new Date(b.date) - new Date(a.date));
      resolve(sorted);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Deletes a targeted entry out of memory by primary key ID.
 */
async function deleteFromStore(storeName, id) {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}