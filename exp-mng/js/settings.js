import { exportAllData, importAllData, clearAllData, getSetting, setSetting, getAll, STORES } from "./db.js";
import { toast } from "./ui.js";
import { exportCSV, downloadFile } from "./reports.js";
import { saveJsonBackup, importJsonFromBackupFolder, pickBackupFolder, getBackupFolderName, supportsFileFolder, BACKUP_JSON } from "./files.js";

export async function exportJSON(saveToFolder = true) {
  const data = await exportAllData();
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `ledger-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
  if (saveToFolder) await saveJsonBackup(json);
  await setSetting("lastBackupDate", new Date().toISOString());
  toast(`Exported backup (${data.transactions.length} transactions)`, "success");
}

export async function exportCSVFile() {
  const txs = await getAll(STORES.TX);
  if (!txs.length) return toast("Nothing to export", "error");
  const csv = exportCSV(txs);
  downloadFile(csv, `ledger-sheet-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
  toast(`Exported ${txs.length} transactions`, "success");
}

export async function importJSONFile(file, merge = true) {
  const text = await file.text();
  const data = JSON.parse(text);
  const count = data.transactions?.length || 0;
  await importAllData(data, merge);
  toast(`Imported ${count} transactions`, "success");
  window.dispatchEvent(new Event("refresh-app"));
}

export async function importFromBackupFolder(merge = false) {
  try {
    const data = await importJsonFromBackupFolder();
    const count = data.transactions?.length || 0;
    await importAllData(data, merge);
    toast(`Restored ${count} transactions from ${BACKUP_JSON}`, "success");
    window.dispatchEvent(new Event("refresh-app"));
  } catch (e) {
    toast(e.message, "error");
  }
}

export async function exportEncryptedBackup(password) {
  if (!password) throw new Error("Password required");
  const data = await exportAllData();
  const json = JSON.stringify(data);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(json));
  const bundle = {
    v: 1,
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(cipher))),
  };
  downloadFile(JSON.stringify(bundle), `ledger-encrypted-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
  await setSetting("lastBackupDate", new Date().toISOString());
  toast("Encrypted backup downloaded", "success");
}

export async function importEncryptedBackup(file, password) {
  if (!password) throw new Error("Password required");
  const bundle = JSON.parse(await file.text());
  const salt = Uint8Array.from(atob(bundle.salt), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(bundle.iv), (c) => c.charCodeAt(0));
  const cipher = Uint8Array.from(atob(bundle.data), (c) => c.charCodeAt(0));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
  );
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  const data = JSON.parse(new TextDecoder().decode(plain));
  await importAllData(data, false);
  toast("Encrypted backup restored", "success");
  window.dispatchEvent(new Event("refresh-app"));
}

export async function handleClearAll() {
  if (!confirm("Delete ALL data? This cannot be undone.")) return;
  await clearAllData();
  toast("All data cleared", "success");
  window.dispatchEvent(new Event("refresh-app"));
}

export async function checkBackupReminder() {
  const last = await getSetting("lastBackupDate");
  if (!last) {
    toast("Tip: Set a backup folder in Settings to survive app updates", "info");
    return;
  }
  const days = (Date.now() - new Date(last).getTime()) / 86400000;
  if (days > 30) toast("It's been 30+ days since your last backup", "info");
}

export async function renderBackupFolderStatus() {
  const el = document.getElementById("backupFolderStatus");
  if (!el) return;
  const name = await getBackupFolderName();
  if (name) {
    el.innerHTML = `<span class="muted">Backup folder:</span> <strong>${name}</strong> · writes <code>${BACKUP_JSON}</code>`;
  } else if (supportsFileFolder()) {
    el.innerHTML = `<span class="muted">No backup folder set. Choose one to auto-save exports and restore after updates.</span>`;
  } else {
    el.innerHTML = `<span class="muted">Your browser doesn't support folder backup. Use Download JSON instead.</span>`;
  }
}

export { pickBackupFolder, getBackupFolderName, supportsFileFolder };
