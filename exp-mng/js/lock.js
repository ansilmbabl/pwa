import { getSetting, setSetting } from "./db.js";

async function hashPin(pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isPinEnabled() {
  return !!(await getSetting("pinHash"));
}

export async function setupPin(pin, confirm) {
  if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN must be 4–6 digits");
  if (pin !== confirm) throw new Error("PINs do not match");
  await setSetting("pinHash", await hashPin(pin));
}

export async function removePin(currentPin) {
  const hash = await getSetting("pinHash");
  if (hash && await hashPin(currentPin) !== hash) throw new Error("Wrong PIN");
  await setSetting("pinHash", null);
}

export async function verifyPin(pin) {
  const hash = await getSetting("pinHash");
  if (!hash) return true;
  return (await hashPin(pin)) === hash;
}

let unlocked = false;
let lockTimer = null;
const IDLE_MS = 5 * 60 * 1000;

export function isUnlocked() {
  return unlocked;
}

export function markActivity() {
  if (!unlocked) return;
  clearTimeout(lockTimer);
  lockTimer = setTimeout(() => {
    unlocked = false;
    showLockScreen();
  }, IDLE_MS);
}

export async function initLock() {
  const enabled = await isPinEnabled();
  if (!enabled) {
    unlocked = true;
    hideLockScreen();
    return;
  }
  unlocked = false;
  showLockScreen();
}

export async function tryUnlock(pin) {
  if (await verifyPin(pin)) {
    unlocked = true;
    hideLockScreen();
    markActivity();
    return true;
  }
  const err = document.getElementById("pinError");
  if (err) { err.textContent = "Wrong PIN"; err.classList.remove("hidden"); }
  return false;
}

function showLockScreen() {
  const el = document.getElementById("pinLock");
  if (el) {
    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
    document.getElementById("pinInput")?.focus();
  }
}

function hideLockScreen() {
  const el = document.getElementById("pinLock");
  if (el) {
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
    const inp = document.getElementById("pinInput");
    if (inp) inp.value = "";
    document.getElementById("pinError")?.classList.add("hidden");
  }
}

export function bindLockEvents() {
  document.getElementById("pinUnlockBtn")?.addEventListener("click", async () => {
    const pin = document.getElementById("pinInput")?.value || "";
    await tryUnlock(pin);
  });
  document.getElementById("pinInput")?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") await tryUnlock(e.target.value);
  });
  ["click", "touchstart", "keydown"].forEach((ev) => {
    document.addEventListener(ev, () => { if (unlocked) markActivity(); }, { passive: true });
  });
}

export async function renderPinSettings() {
  const el = document.getElementById("pinStatus");
  if (!el) return;
  el.textContent = (await isPinEnabled()) ? "PIN lock is ON" : "PIN lock is OFF";
}
