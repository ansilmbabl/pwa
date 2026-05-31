import { STORES, getAll, put, add, remove } from "./db.js";
import { todayStr, addDays, addMonths, daysUntil } from "./dates.js";
import { formatCurrency, escapeHtml, toast } from "./ui.js";
import { saveTransaction } from "./transactions.js";

const FREQ_DAYS = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };

function nextDate(current, frequency) {
  if (frequency === "monthly") return addMonths(current, 1);
  if (frequency === "yearly") return addMonths(current, 12);
  return addDays(current, FREQ_DAYS[frequency] || 30);
}

export async function processRecurring() {
  const rules = await getAll(STORES.RECUR);
  const today = todayStr();
  for (const rule of rules) {
    if (!rule.active) continue;
    if (rule.nextDate > today) continue;
    if (rule.endDate && rule.nextDate > rule.endDate) continue;

    await saveTransaction({
      amount: rule.amount,
      type: rule.type,
      date: rule.nextDate,
      categoryId: rule.categoryId,
      merchant: rule.merchant || "",
      paymentMethod: rule.paymentMethod || "Cash",
      notes: rule.notes || "(Recurring)",
      tags: rule.tags || [],
      recurringId: rule.id,
    });

    rule.nextDate = nextDate(rule.nextDate, rule.frequency);
    await put(STORES.RECUR, rule);
  }
}

export async function renderBillsPanel() {
  await processRecurring();
  const rules = await getAll(STORES.RECUR);
  const list = document.getElementById("recurringList");
  const subs = document.getElementById("subscriptionList");
  const calendar = document.getElementById("billsCalendar");

  if (list) {
    list.innerHTML = rules.length ? rules.map((r) => `
      <div class="list-card">
        <div><strong>${escapeHtml(r.merchant || r.notes || "Recurring")}</strong>
        <span class="muted">${r.frequency} • Next: ${r.nextDate}</span></div>
        <div>${formatCurrency(r.amount)} <button type="button" class="btn-sm btn-danger del-recur" data-id="${r.id}">✕</button></div>
      </div>`).join("") : `<p class="empty-msg">No recurring rules</p>`;

    list.querySelectorAll(".del-recur").forEach((btn) => {
      btn.onclick = async () => {
        await remove(STORES.RECUR, Number(btn.dataset.id));
        renderBillsPanel();
      };
    });
  }

  if (subs) {
    const subscriptions = rules.filter((r) => r.isSubscription);
    let monthly = 0, yearly = 0;
    subscriptions.forEach((r) => {
      if (r.frequency === "yearly") yearly += r.amount;
      else monthly += r.amount;
    });
    document.getElementById("subMonthlyTotal").textContent = formatCurrency(monthly + yearly / 12);
    document.getElementById("subYearlyTotal").textContent = formatCurrency(monthly * 12 + yearly);
    subs.innerHTML = subscriptions.length ? subscriptions.map((r) => `
      <div class="list-card">
        <span>${escapeHtml(r.merchant || r.notes)}</span>
        <span>${formatCurrency(r.amount)}/${r.frequency === "yearly" ? "yr" : "mo"}</span>
      </div>`).join("") : `<p class="empty-msg">No subscriptions tracked</p>`;
  }

  if (calendar) {
    const upcoming = rules
      .filter((r) => r.active && daysUntil(r.nextDate) <= 30)
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
    calendar.innerHTML = upcoming.length ? upcoming.map((r) => {
      const d = daysUntil(r.nextDate);
      return `<div class="list-card${d <= 3 ? " due-soon" : ""}">
        <span>${r.nextDate} (${d}d) — ${escapeHtml(r.merchant || r.notes || "Bill")}</span>
        <span>${formatCurrency(r.amount)}</span>
      </div>`;
    }).join("") : `<p class="empty-msg">No bills due in 30 days</p>`;
  }
}

export async function addRecurringRule(data) {
  await add(STORES.RECUR, {
    amount: parseFloat(data.amount),
    type: data.type || "expense",
    categoryId: Number(data.categoryId),
    merchant: data.merchant || "",
    paymentMethod: data.paymentMethod || "Cash",
    notes: data.notes || "",
    tags: data.tags || [],
    frequency: data.frequency || "monthly",
    nextDate: data.nextDate || todayStr(),
    endDate: data.endDate || "",
    isSubscription: !!data.isSubscription,
    active: true,
  });
  toast("Recurring rule added", "success");
  if (data.isSubscription && Notification.permission === "granted") {
    scheduleBillReminder(data);
  }
}

export function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function scheduleBillReminder(rule) {
  const days = daysUntil(rule.nextDate);
  if (days > 0 && days <= 7 && Notification.permission === "granted") {
    new Notification("Ledger Core", {
      body: `${rule.merchant || "Bill"} due in ${days} day(s): ${formatCurrency(rule.amount)}`,
      icon: "./icons/icon.svg",
    });
  }
}

export async function checkBillReminders() {
  const rules = await getAll(STORES.RECUR);
  rules.filter((r) => r.active).forEach(scheduleBillReminder);
}
