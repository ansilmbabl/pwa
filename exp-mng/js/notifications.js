import { STORES, getAll, getSetting, setSetting } from "./db.js";
import { todayStr, daysUntil, monthKey } from "./dates.js";
import { formatCurrency, toast } from "./ui.js";
import { computeMetrics } from "./transactions.js";
import { getMonthlyBudget } from "./budget.js";

const PREFS_KEY = "notificationPrefs";
const LOG_KEY = "notificationLog";

export const DEFAULT_PREFS = {
  dailyEnabled: true,
  dailyTime: "20:00",
  budgetEnabled: true,
  budgetWarnPct: 80,
  catBudgetEnabled: true,
  billsEnabled: true,
  backupEnabled: false,
};

const BILL_MILESTONES = [7, 3, 1, 0];

let schedulerId = null;

export async function getNotificationPrefs() {
  const stored = await getSetting(PREFS_KEY);
  return { ...DEFAULT_PREFS, ...(stored || {}) };
}

export async function saveNotificationPrefs(prefs) {
  await setSetting(PREFS_KEY, { ...DEFAULT_PREFS, ...prefs });
}

async function getNotifLog() {
  return (await getSetting(LOG_KEY)) || {};
}

async function markNotifSent(key, value) {
  const log = await getNotifLog();
  log[key] = value;
  await setSetting(LOG_KEY, log);
}

async function wasNotifSent(key, value) {
  const log = await getNotifLog();
  return log[key] === value;
}

export function notificationSupported() {
  return "Notification" in window;
}

export function notificationPermission() {
  return notificationSupported() ? Notification.permission : "unsupported";
}

export async function requestNotificationPermission() {
  if (!notificationSupported()) {
    toast("Notifications not supported in this browser", "error");
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") {
    toast("Notifications blocked — enable them in browser settings", "error");
    return false;
  }
  return (await Notification.requestPermission()) === "granted";
}

export async function showAppNotification(title, body, tag = "ledger-core") {
  if (!notificationSupported() || Notification.permission !== "granted") return false;

  const payload = {
    type: "SHOW_NOTIFICATION",
    title,
    body,
    tag,
    icon: "./icons/icon-192.png",
  };

  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.active) {
      reg.active.postMessage(payload);
      return true;
    }
  } catch {
    /* fall through */
  }

  new Notification(title, { body, icon: "./icons/icon-192.png", tag });
  return true;
}

function timeReached(configuredTime) {
  const [h, m] = (configuredTime || "20:00").split(":").map(Number);
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m || 0, 0);
  return now >= target;
}

function hasExpenseToday(txs) {
  const today = todayStr();
  return txs.some((tx) => tx.date === today && tx.type === "expense");
}

async function checkDailyReminder(prefs, txs) {
  if (!prefs.dailyEnabled) return;
  if (!timeReached(prefs.dailyTime)) return;
  if (hasExpenseToday(txs)) return;

  const day = todayStr();
  if (await wasNotifSent("daily", day)) return;

  await showAppNotification(
    "Log today's expenses",
    "You haven't recorded any spending today. Tap to add a transaction.",
    "daily-reminder",
  );
  await markNotifSent("daily", day);
}

async function checkBudgetNotifications(prefs, txs, cats, budget) {
  if (!prefs.budgetEnabled || budget <= 0) return;

  const { monthlyExpense } = computeMetrics(txs, cats, budget);
  const month = monthKey(todayStr());
  const warnPct = Math.min(99, Math.max(50, Number(prefs.budgetWarnPct) || 80));
  const warnAmount = budget * (warnPct / 100);

  if (monthlyExpense > budget) {
    if (!(await wasNotifSent("budgetOver", month))) {
      await showAppNotification(
        "Monthly budget exceeded",
        `You've spent ${formatCurrency(monthlyExpense)} of ${formatCurrency(budget)} this month.`,
        "budget-over",
      );
      await markNotifSent("budgetOver", month);
    }
    return;
  }

  if (monthlyExpense >= warnAmount && !(await wasNotifSent("budgetWarn", month))) {
    const left = budget - monthlyExpense;
    await showAppNotification(
      "Approaching monthly budget",
      `${warnPct}% used — ${formatCurrency(left)} left for the month.`,
      "budget-warn",
    );
    await markNotifSent("budgetWarn", month);
  }
}

async function checkCategoryBudgetNotifications(prefs, txs, cats) {
  if (!prefs.catBudgetEnabled) return;

  const { catSpent } = computeMetrics(txs, cats, 0);
  const month = monthKey(todayStr());

  for (const cat of cats) {
    const limit = (cat.budgetLimit || 0) + (cat.rollover || 0);
    if (limit <= 0) continue;
    const spent = catSpent[cat.id] || 0;
    if (spent <= limit) continue;

    const key = `catOver-${cat.id}`;
    if (await wasNotifSent(key, month)) continue;

    await showAppNotification(
      `${cat.name} over budget`,
      `Spent ${formatCurrency(spent)} of ${formatCurrency(limit)} this month.`,
      `cat-over-${cat.id}`,
    );
    await markNotifSent(key, month);
  }
}

async function checkBillNotifications(prefs) {
  if (!prefs.billsEnabled) return;

  const rules = await getAll(STORES.RECUR);
  const today = todayStr();

  for (const rule of rules.filter((r) => r.active)) {
    const days = daysUntil(rule.nextDate);
    const milestone = BILL_MILESTONES.find((d) => d === days);
    if (milestone === undefined) continue;

    const key = `bill-${rule.id}-${milestone}`;
    if (await wasNotifSent(key, today)) continue;

    const name = rule.merchant || rule.notes || "Bill";
    const when = days === 0 ? "due today" : days === 1 ? "due tomorrow" : `due in ${days} days`;

    await showAppNotification(
      "Bill reminder",
      `${name} ${when}: ${formatCurrency(rule.amount)}`,
      `bill-${rule.id}`,
    );
    await markNotifSent(key, today);
  }
}

async function checkBackupNotification(prefs) {
  if (!prefs.backupEnabled) return;

  const last = await getSetting("lastBackupDate");
  const today = todayStr();
  if (await wasNotifSent("backup", today)) return;

  if (!last) {
    await showAppNotification(
      "Backup your data",
      "Set a backup folder in Settings to protect your ledger.",
      "backup-reminder",
    );
    await markNotifSent("backup", today);
    return;
  }

  const days = (Date.now() - new Date(last).getTime()) / 86400000;
  if (days >= 30) {
    await showAppNotification(
      "Backup reminder",
      "It's been 30+ days since your last backup. Export or sync your data.",
      "backup-reminder",
    );
    await markNotifSent("backup", today);
  }
}

export async function runNotificationChecks() {
  if (!notificationSupported() || Notification.permission !== "granted") return;

  const prefs = await getNotificationPrefs();
  const [txs, cats, budget] = await Promise.all([
    getAll(STORES.TX),
    getAll(STORES.CAT).then((all) => all.filter((c) => c.type === "expense")),
    getMonthlyBudget(),
  ]);

  await checkDailyReminder(prefs, txs);
  await checkBudgetNotifications(prefs, txs, cats, budget);
  await checkCategoryBudgetNotifications(prefs, txs, cats);
  await checkBillNotifications(prefs);
  await checkBackupNotification(prefs);
}

export function startNotificationScheduler() {
  if (schedulerId) clearInterval(schedulerId);
  runNotificationChecks();
  schedulerId = setInterval(runNotificationChecks, 60_000);
  document.addEventListener("visibilitychange", onVisibilityChange);
}

function onVisibilityChange() {
  if (!document.hidden) runNotificationChecks();
}

export function renderNotificationSettings() {
  const status = document.getElementById("notifPermStatus");
  const enableBtn = document.getElementById("notifEnableBtn");
  if (!status) return;

  const perm = notificationPermission();
  if (perm === "granted") {
    status.textContent = "Notifications enabled";
    if (enableBtn) enableBtn.textContent = "Notifications on";
  } else if (perm === "denied") {
    status.textContent = "Blocked — allow notifications in browser settings";
    if (enableBtn) enableBtn.textContent = "Notifications blocked";
  } else if (perm === "unsupported") {
    status.textContent = "Not supported in this browser";
    if (enableBtn) enableBtn.hidden = true;
  } else {
    status.textContent = "Enable to get daily reminders and budget alerts";
    if (enableBtn) enableBtn.textContent = "Enable notifications";
  }
}

export async function loadNotificationSettingsForm() {
  const prefs = await getNotificationPrefs();
  const map = {
    notifDailyEnabled: prefs.dailyEnabled,
    notifDailyTime: prefs.dailyTime,
    notifBudgetEnabled: prefs.budgetEnabled,
    notifBudgetWarnPct: prefs.budgetWarnPct,
    notifCatBudgetEnabled: prefs.catBudgetEnabled,
    notifBillsEnabled: prefs.billsEnabled,
    notifBackupEnabled: prefs.backupEnabled,
  };

  for (const [id, val] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = !!val;
    else el.value = val;
  }

  renderNotificationSettings();
}

async function persistFromForm() {
  const prefs = {
    dailyEnabled: document.getElementById("notifDailyEnabled")?.checked ?? DEFAULT_PREFS.dailyEnabled,
    dailyTime: document.getElementById("notifDailyTime")?.value || DEFAULT_PREFS.dailyTime,
    budgetEnabled: document.getElementById("notifBudgetEnabled")?.checked ?? DEFAULT_PREFS.budgetEnabled,
    budgetWarnPct: Number(document.getElementById("notifBudgetWarnPct")?.value) || DEFAULT_PREFS.budgetWarnPct,
    catBudgetEnabled: document.getElementById("notifCatBudgetEnabled")?.checked ?? DEFAULT_PREFS.catBudgetEnabled,
    billsEnabled: document.getElementById("notifBillsEnabled")?.checked ?? DEFAULT_PREFS.billsEnabled,
    backupEnabled: document.getElementById("notifBackupEnabled")?.checked ?? DEFAULT_PREFS.backupEnabled,
  };
  await saveNotificationPrefs(prefs);
}

export function bindNotificationSettings() {
  document.getElementById("notifEnableBtn")?.addEventListener("click", async () => {
    const ok = await requestNotificationPermission();
    renderNotificationSettings();
    if (ok) {
      toast("Notifications enabled", "success");
      await runNotificationChecks();
    }
  });

  const fields = [
    "notifDailyEnabled", "notifDailyTime", "notifBudgetEnabled", "notifBudgetWarnPct",
    "notifCatBudgetEnabled", "notifBillsEnabled", "notifBackupEnabled",
  ];
  fields.forEach((id) => {
    document.getElementById(id)?.addEventListener("change", async () => {
      await persistFromForm();
      if (Notification.permission === "granted") await runNotificationChecks();
    });
  });

  document.getElementById("notifTestBtn")?.addEventListener("click", async () => {
    if (!(await requestNotificationPermission())) return;
    await showAppNotification(
      "Ledger Core",
      "Notifications are working. You'll get reminders based on your settings.",
      "test",
    );
    toast("Test notification sent", "success");
  });
}
