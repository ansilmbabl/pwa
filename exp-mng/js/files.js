import { getSetting, setSetting } from "./db.js";
import { toast } from "./ui.js";

export const BACKUP_DIR_LABEL = "LedgerCore";
export const BACKUP_JSON = "ledger-core-backup.json";
export const BACKUP_CSV = "ledger-core-export.csv";

export function supportsFileFolder() {
  return "showDirectoryPicker" in window;
}

export async function pickBackupFolder() {
  if (!supportsFileFolder()) {
    toast("Folder picker not supported — use Download instead", "info");
    return false;
  }
  try {
    const handle = await window.showDirectoryPicker({
      id: "ledger-core-backup",
      mode: "readwrite",
      startIn: "documents",
    });
    await setSetting("backupDirHandle", handle);
    await setSetting("backupDirName", handle.name);
    toast(`Backup folder: ${handle.name}`, "success");
    return true;
  } catch (e) {
    if (e.name !== "AbortError") toast(e.message, "error");
    return false;
  }
}

export async function getBackupFolderName() {
  return (await getSetting("backupDirName")) || null;
}

async function getDirHandle() {
  return getSetting("backupDirHandle");
}

export async function writeToBackupFolder(filename, content, mime = "application/json") {
  const dir = await getDirHandle();
  if (!dir) return false;
  try {
    const fileHandle = await dir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([content], { type: mime }));
    await writable.close();
    return true;
  } catch (e) {
    toast(`Folder save failed: ${e.message}`, "error");
    return false;
  }
}

export async function readFromBackupFolder(filename = BACKUP_JSON) {
  const dir = await getDirHandle();
  if (!dir) return null;
  try {
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

export async function saveJsonBackup(jsonString) {
  const saved = await writeToBackupFolder(BACKUP_JSON, jsonString);
  if (saved) toast(`Saved to folder: ${BACKUP_JSON}`, "success");
  return saved;
}

export async function importJsonFromBackupFolder() {
  const text = await readFromBackupFolder(BACKUP_JSON);
  if (!text) throw new Error(`No ${BACKUP_JSON} found in backup folder`);
  return JSON.parse(text);
}

export async function tryAutoRestoreFromFolder(importFn) {
  if (!supportsFileFolder()) return false;
  const dir = await getDirHandle();
  if (!dir) return false;
  try {
    const text = await readFromBackupFolder(BACKUP_JSON);
    if (!text) return false;
    const data = JSON.parse(text);
    if (!data.transactions?.length) return false;
    await importFn(data, false);
    toast(`Restored from ${BACKUP_JSON} in backup folder`, "success");
    return true;
  } catch {
    return false;
  }
}
