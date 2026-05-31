import { exportAllData, importAllData, getAll, STORES, getSetting, setSetting } from "./db.js";
import { toast, setLoading } from "./ui.js";
import { downloadFile } from "./reports.js";
import { saveJsonBackup, getBackupFolderName, supportsFileFolder, BACKUP_JSON } from "./files.js";

let swRegistration = null;
let updateAvailable = false;

async function parseCacheVersionFromSw() {
  try {
    const res = await fetch("./sw.js", { cache: "no-store" });
    const text = await res.text();
    const m = text.match(/CACHE_NAME\s*=\s*"([^"]+)"/);
    return m?.[1] || null;
  } catch {
    return null;
  }
}

export async function getInstalledVersion() {
  return (await getSetting("installedCacheVersion")) || "unknown";
}

export async function checkForAppUpdate(silent = false) {
  if (!("serviceWorker" in navigator)) {
    if (!silent) toast("Updates not supported in this browser", "info");
    return { available: false, current: await getInstalledVersion(), remote: null };
  }

  const reg = swRegistration || await navigator.serviceWorker.getRegistration();
  if (!reg) {
    if (!silent) toast("App not installed as PWA yet", "info");
    return { available: false, current: await getInstalledVersion(), remote: null };
  }

  await reg.update();
  const remote = await parseCacheVersionFromSw();
  const current = await getInstalledVersion();
  const hasWaiting = !!reg.waiting;
  const versionChanged = remote && remote !== current;

  updateAvailable = hasWaiting || versionChanged;

  if (!silent) {
    if (updateAvailable) toast("Update available", "info");
    else toast("You're on the latest version", "success");
  }

  return { available: updateAvailable, current, remote, reg };
}

function waitForSw(reg) {
  return new Promise((resolve) => {
    if (reg.waiting) return resolve(reg.waiting);
    if (!reg.installing) return resolve(null);
    reg.installing.addEventListener("statechange", () => {
      if (reg.installing?.state === "installed") resolve(reg.waiting || reg.installing);
    });
  });
}

async function backupBeforeUpdate() {
  const data = await exportAllData();
  const json = JSON.stringify(data);
  const count = data.transactions?.length || 0;

  await setSetting("preUpdateBackup", json);
  await setSetting("preUpdateBackupAt", new Date().toISOString());
  await setSetting("updateInProgress", true);
  await setSetting("lastBackupDate", new Date().toISOString());

  downloadFile(json, `ledger-pre-update-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
  const folderSaved = await saveJsonBackup(json, true);

  return { count, folderSaved };
}

function activateWaitingWorker(reg) {
  return new Promise((resolve) => {
    const onChange = () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      resolve(true);
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);

    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      resolve(false);
    }

    setTimeout(() => resolve(false), 8000);
  });
}

/** One-click: backup data → activate new app → reload */
export async function applyAppUpdate() {
  if (!("serviceWorker" in navigator)) {
    toast("Use browser refresh to update", "info");
    window.location.reload();
    return;
  }

  setLoading(true);
  try {
    const { count, folderSaved } = await backupBeforeUpdate();
    toast(`Backed up ${count} transactions${folderSaved ? " to folder" : ""}`, "success");

    const reg = swRegistration || await navigator.serviceWorker.register("./sw.js");
    await reg.update();

    const worker = reg.waiting || (await waitForSw(reg));

    if (worker) {
      toast("Installing update…", "info");
      await activateWaitingWorker(reg);
    }

    const remote = await parseCacheVersionFromSw();
    if (remote) await setSetting("installedCacheVersion", remote);

    window.location.reload();
  } catch (e) {
    toast(e.message || "Update failed", "error");
    setLoading(false);
  }
}

/** Check for updates and apply if one is waiting (silent path for banner button) */
export async function checkAndApplyUpdate() {
  const { available } = await checkForAppUpdate(true);
  if (available) await applyAppUpdate();
  else {
    toast("Already up to date — refreshing", "info");
    await backupBeforeUpdate();
    window.location.reload();
  }
}

export async function finishUpdateOnLaunch() {
  const inProgress = await getSetting("updateInProgress");
  if (!inProgress) return;

  await setSetting("updateInProgress", false);

  const remote = await parseCacheVersionFromSw();
  if (remote) await setSetting("installedCacheVersion", remote);

  const txs = await getAll(STORES.TX);
  const backupRaw = await getSetting("preUpdateBackup");

  if (!txs.length && backupRaw) {
    try {
      await importAllData(JSON.parse(backupRaw), false);
      toast("Restored your data after update", "success");
    } catch {
      toast("Update complete — restore backup from Settings if data is missing", "error");
    }
  } else {
    toast("App updated — your data is intact", "success");
  }

  await setSetting("preUpdateBackup", null);
}

export function registerServiceWorker(onUpdateAvailable) {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);

  return navigator.serviceWorker.register("./sw.js").then(async (reg) => {
    swRegistration = reg;

    const remote = await parseCacheVersionFromSw();
    const installed = await getInstalledVersion();
    if (installed === "unknown" && remote) {
      await setSetting("installedCacheVersion", remote);
    } else if (remote && remote !== installed) {
      updateAvailable = true;
      onUpdateAvailable?.();
    }

    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      nw?.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) {
          updateAvailable = true;
          onUpdateAvailable?.();
        }
      });
    });

    return reg;
  });
}

export function isUpdateAvailable() {
  return updateAvailable;
}

export async function renderUpdatePanel() {
  const statusEl = document.getElementById("updateStatus");
  const btn = document.getElementById("updateAppBtn");
  const checkBtn = document.getElementById("checkUpdateBtn");
  if (!statusEl) return;

  const current = await getInstalledVersion();
  const remote = await parseCacheVersionFromSw();
  const lastBackup = await getSetting("lastBackupDate");
  const folder = await getBackupFolderName();

  let html = `<p><strong>Installed:</strong> <code>${current}</code></p>`;
  if (remote && remote !== current) {
    html += `<p class="update-badge">New version available: <code>${remote}</code></p>`;
    btn?.classList.remove("hidden");
  } else {
    html += `<p class="muted">Latest version installed.</p>`;
  }
  if (lastBackup) {
    html += `<p class="muted">Last backup: ${new Date(lastBackup).toLocaleString()}</p>`;
  }
  html += `<p class="muted hint">Updates keep your data in IndexedDB. This button backs up first, then reloads the latest app — no uninstall needed.</p>`;
  if (!folder && supportsFileFolder()) {
    html += `<p class="muted hint">Tip: set a backup folder below for automatic saves.</p>`;
  }

  statusEl.innerHTML = html;
  if (btn) btn.textContent = remote && remote !== current ? "Update now (backup & reload)" : "Check & refresh app";
}

export function bindUpdateControls() {
  document.getElementById("updateAppBtn")?.addEventListener("click", () => checkAndApplyUpdate());
  document.getElementById("checkUpdateBtn")?.addEventListener("click", async () => {
    await checkForAppUpdate(false);
    await renderUpdatePanel();
  });
  document.getElementById("updateBannerBtn")?.addEventListener("click", () => applyAppUpdate());
  document.getElementById("updateBannerDismiss")?.addEventListener("click", () => {
    document.getElementById("updateBanner")?.classList.add("hidden");
  });
}

export function showUpdateBanner() {
  const banner = document.getElementById("updateBanner");
  if (banner) banner.classList.remove("hidden");
}
