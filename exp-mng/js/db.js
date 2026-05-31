const DB_NAME = "LedgerCoreDB";
const DB_VERSION = 4;

export const STORES = {
  TX: "transactions",
  CAT: "categories",
  TAG: "tags",
  RECUR: "recurring",
  GOALS: "savings_goals",
  FUNDS: "sinking_funds",
  EVENTS: "expense_events",
  SPLITS: "split_groups",
  WALLETS: "wallets",
  AUTO_RULES: "auto_rules",
  MILEAGE: "mileage",
  SETTINGS: "settings",
};

const DEFAULT_EXPENSE_CATS = [
  { name: "Food", color: "#ef4444", icon: "🍔" },
  { name: "Transport", color: "#3b82f6", icon: "🚗" },
  { name: "Shopping", color: "#f59e0b", icon: "🛍️" },
  { name: "Bills", color: "#10b981", icon: "📄" },
  { name: "Health", color: "#a855f7", icon: "💊" },
  { name: "Entertainment", color: "#ec4899", icon: "🎬" },
  { name: "Other", color: "#64748b", icon: "📦" },
];

const DEFAULT_INCOME_CATS = [
  { name: "Salary", color: "#10b981", icon: "💼" },
  { name: "Freelance", color: "#3b82f6", icon: "💻" },
  { name: "Gift", color: "#f59e0b", icon: "🎁" },
  { name: "Other", color: "#64748b", icon: "💰" },
];

const DEFAULT_WALLETS = [
  { name: "Cash", type: "cash", icon: "💵", color: "#10b981", isDefault: true },
  { name: "Bank", type: "bank", icon: "🏦", color: "#3b82f6", isDefault: false },
];

let dbPromise;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const oldVer = e.oldVersion;

        if (!db.objectStoreNames.contains(STORES.TX)) {
          db.createObjectStore(STORES.TX, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.CAT)) {
          db.createObjectStore(STORES.CAT, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.TAG)) {
          db.createObjectStore(STORES.TAG, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.RECUR)) {
          db.createObjectStore(STORES.RECUR, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.GOALS)) {
          db.createObjectStore(STORES.GOALS, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.FUNDS)) {
          db.createObjectStore(STORES.FUNDS, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.EVENTS)) {
          db.createObjectStore(STORES.EVENTS, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.SPLITS)) {
          db.createObjectStore(STORES.SPLITS, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.WALLETS)) {
          db.createObjectStore(STORES.WALLETS, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.AUTO_RULES)) {
          db.createObjectStore(STORES.AUTO_RULES, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.MILEAGE)) {
          db.createObjectStore(STORES.MILEAGE, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: "key" });
        }

        if (oldVer < 2) {
          // Schema stores created; migration runs on initDB()
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export async function initDB() {
  await openDB();
  await ensureDefaults();
  await migrateLegacyTransactions();
  await migrateTimeField();
  await migrateCategoryFields();
}

async function migrateCategoryFields() {
  const cats = await getAll(STORES.CAT);
  for (const cat of cats) {
    let changed = false;
    const patch = { ...cat };
    if (cat.parentId === undefined) { patch.parentId = null; changed = true; }
    if (cat.isTaxDeductible === undefined) { patch.isTaxDeductible = false; changed = true; }
    if (changed) await put(STORES.CAT, patch);
  }
}

async function ensureDefaults() {
  const cats = await getAll(STORES.CAT);
  if (cats.length === 0) {
    for (const c of DEFAULT_EXPENSE_CATS) {
      await add(STORES.CAT, { ...c, type: "expense", budgetLimit: 0, isFavorite: false, rollover: 0, parentId: null, isTaxDeductible: false });
    }
    for (const c of DEFAULT_INCOME_CATS) {
      await add(STORES.CAT, { ...c, type: "income", budgetLimit: 0, isFavorite: false, rollover: 0, parentId: null, isTaxDeductible: false });
    }
  }

  const wallets = await getAll(STORES.WALLETS);
  if (wallets.length === 0) {
    for (const w of DEFAULT_WALLETS) {
      await add(STORES.WALLETS, { ...w, balance: 0 });
    }
  }
}

async function migrateLegacyTransactions() {
  const txs = await getAll(STORES.TX);
  const allCats = await getAll(STORES.CAT);
  for (const tx of txs) {
    if (tx.categoryId) continue;
    const type = tx.type || "expense";
    const catName = tx.category || "Other";
    let cat = allCats.find((c) => c.name === catName && c.type === type) || allCats.find((c) => c.name === catName);
    if (!cat) {
      const id = await add(STORES.CAT, {
        name: catName, type, color: "#64748b", icon: "📦",
        budgetLimit: 0, isFavorite: false, rollover: 0,
      });
      cat = { id, name: catName };
      allCats.push({ id, name: catName, type });
    }
    await put(STORES.TX, {
      ...tx,
      categoryId: cat.id,
      categoryName: cat.name,
      merchant: tx.merchant || "",
      paymentMethod: tx.paymentMethod || "Cash",
      tags: tx.tags || [],
      eventId: tx.eventId || null,
      recurringId: tx.recurringId || null,
      splits: tx.splits || [],
      time: tx.time || "12:00",
      walletId: tx.walletId || null,
    });
  }
}

async function migrateTimeField() {
  const txs = await getAll(STORES.TX);
  for (const tx of txs) {
    if (tx.time) continue;
    await put(STORES.TX, { ...tx, time: "12:00" });
  }
}

function txStore(store, mode) {
  return openDB().then((db) => db.transaction(store, mode).objectStore(store));
}

export async function getAll(store) {
  const s = await txStore(store, "readonly");
  return new Promise((res, rej) => {
    const r = s.getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
}

export async function getById(store, id) {
  const s = await txStore(store, "readonly");
  return new Promise((res, rej) => {
    const r = s.get(id);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function put(store, data) {
  const s = await txStore(store, "readwrite");
  return new Promise((res, rej) => {
    const r = s.put(data);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function add(store, data) {
  const s = await txStore(store, "readwrite");
  return new Promise((res, rej) => {
    const r = s.add(data);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function remove(store, id) {
  const s = await txStore(store, "readwrite");
  return new Promise((res, rej) => {
    const r = s.delete(id);
    r.onsuccess = () => res(true);
    r.onerror = () => rej(r.error);
  });
}

export async function getSetting(key, fallback = null) {
  const s = await txStore(STORES.SETTINGS, "readonly");
  return new Promise((res) => {
    const r = s.get(key);
    r.onsuccess = () => res(r.result ? r.result.value : fallback);
  });
}

export async function setSetting(key, value) {
  return put(STORES.SETTINGS, { key, value });
}

export async function getCategories(type) {
  const all = await getAll(STORES.CAT);
  const filtered = type ? all.filter((c) => c.type === type) : all;
  return filtered.sort((a, b) => {
    const pa = a.parentId || 0;
    const pb = b.parentId || 0;
    if (pa !== pb) return pa - pb;
    if (a.isFavorite !== b.isFavorite) return (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0);
    return a.name.localeCompare(b.name);
  });
}

export function formatCategoryLabel(cat, allCats) {
  if (!cat.parentId) return cat.name;
  const parent = allCats.find((c) => c.id === cat.parentId);
  return parent ? `${parent.name} › ${cat.name}` : cat.name;
}

export async function getDefaultWallet() {
  const wallets = await getAll(STORES.WALLETS);
  return wallets.find((w) => w.isDefault) || wallets[0] || null;
}

export async function clearAllData() {
  const db = await openDB();
  const names = [...db.objectStoreNames];
  for (const name of names) {
    await new Promise((res, rej) => {
      const s = db.transaction(name, "readwrite").objectStore(name);
      const r = s.clear();
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  }
  dbPromise = null;
  await initDB();
}

export async function exportAllData() {
  const data = { version: DB_VERSION, exportedAt: new Date().toISOString() };
  for (const store of Object.values(STORES)) {
    data[store] = await getAll(store);
  }
  return data;
}

export async function importAllData(data, merge = true) {
  if (!data || !data.transactions) throw new Error("Invalid backup file");
  if (!merge) await clearAllData();
  for (const store of Object.values(STORES)) {
    if (!data[store]) continue;
    for (const item of data[store]) {
      if (store === STORES.SETTINGS) {
        await put(store, item);
      } else if (merge) {
        const { id, ...rest } = item;
        await add(store, rest);
      } else {
        await put(store, item);
      }
    }
  }
}
