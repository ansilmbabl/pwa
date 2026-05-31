import { STORES, getAll } from "./db.js";
import {
  parseLocalDate, todayStr, monthKey, formatMonthLabel, formatDisplayDateTime,
} from "./dates.js";
import { formatCurrency, escapeHtml } from "./ui.js";
import { setReportDay } from "./reports.js";

let calMonth = monthKey(todayStr());

function monthStartKey(key) {
  return `${key}-01`;
}

function shiftCalMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function firstWeekday(key) {
  return parseLocalDate(monthStartKey(key)).getDay();
}

function buildDailyTotals(txs, key) {
  const daily = {};
  txs.forEach((t) => {
    if (monthKey(t.date) !== key) return;
    if (t.type !== "expense") return;
    daily[t.date] = (daily[t.date] || 0) + parseFloat(t.amount);
  });
  return daily;
}

function renderDayDetail(el, dateStr, txs) {
  if (!el) return;
  const dayTxs = txs
    .filter((t) => t.date === dateStr)
    .sort((a, b) => (b.time || "").localeCompare(a.time || ""));

  if (!dayTxs.length) {
    el.innerHTML = `
      <p class="empty-msg">No transactions on ${escapeHtml(formatDisplayDateTime(dateStr, null))}</p>
      <button type="button" class="btn btn-secondary btn-sm cal-open-report" data-date="${dateStr}">Open day report →</button>`;
    return;
  }

  let exp = 0;
  let inc = 0;
  dayTxs.forEach((t) => {
    if (t.type === "income") inc += t.amount;
    else exp += t.amount;
  });

  el.innerHTML = `
    <div class="cal-detail-head">
      <strong>${escapeHtml(formatDisplayDateTime(dateStr, null))}</strong>
      <span class="muted">Net ${formatCurrency(inc - exp)}</span>
    </div>
    <div class="grid-2" style="margin:10px 0">
      <div class="stat-box"><span class="income-label">Income</span><strong>${formatCurrency(inc)}</strong></div>
      <div class="stat-box"><span class="expense-label">Spent</span><strong>${formatCurrency(exp)}</strong></div>
    </div>
    ${dayTxs.map((t) => {
      const sign = t.type === "income" ? "+" : "−";
      const cls = t.type === "income" ? "income-label" : "expense-label";
      return `<div class="list-card cal-tx-row"><span>${escapeHtml(t.categoryName)}${t.merchant ? ` · ${escapeHtml(t.merchant)}` : ""}</span><span class="${cls}">${sign}${formatCurrency(t.amount).slice(1)}</span></div>`;
    }).join("")}
    <button type="button" class="btn btn-secondary btn-sm cal-open-report" data-date="${dateStr}">Open day report →</button>`;
}

export async function renderSpendingCalendar() {
  const grid = document.getElementById("calGrid");
  const label = document.getElementById("calMonthLabel");
  const detail = document.getElementById("calDayDetail");
  if (!grid || !label) return;

  label.textContent = formatMonthLabel(calMonth);
  const txs = await getAll(STORES.TX);
  const daily = buildDailyTotals(txs, calMonth);
  const max = Math.max(...Object.values(daily), 0);
  const totalDays = daysInMonth(calMonth);
  const startPad = firstWeekday(calMonth);
  const today = todayStr();

  let html = "";
  for (let i = 0; i < startPad; i++) html += `<div class="cal-cell cal-cell-empty"></div>`;

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${calMonth}-${String(day).padStart(2, "0")}`;
    const amt = daily[dateStr] || 0;
    const intensity = max ? amt / max : 0;
    const alpha = amt ? 0.12 + intensity * 0.88 : 0;
    const isToday = dateStr === today;
    html += `<button type="button" class="cal-cell${isToday ? " cal-today" : ""}${amt ? " cal-has-spend" : ""}"
      data-date="${dateStr}" title="${amt ? formatCurrency(amt) : "No spending"}"
      style="${amt ? `background:rgba(45,212,191,${alpha})` : ""}">
      <span class="cal-day-num">${day}</span>
      ${amt ? `<span class="cal-day-amt">${formatCurrency(amt).replace(/\.00$/, "")}</span>` : ""}
    </button>`;
  }

  grid.innerHTML = html;

  const selected = detail?.dataset.selected || today;
  if (detail && monthKey(selected) === calMonth) {
    detail.dataset.selected = selected;
    renderDayDetail(detail, selected, txs);
  } else if (detail) {
    detail.dataset.selected = "";
    detail.innerHTML = `<p class="muted hint">Tap a day to see transactions</p>`;
  }

  grid.querySelectorAll(".cal-cell[data-date]").forEach((cell) => {
    cell.addEventListener("click", () => {
      const dateStr = cell.dataset.date;
      if (detail) {
        detail.dataset.selected = dateStr;
        renderDayDetail(detail, dateStr, txs);
      }
      grid.querySelectorAll(".cal-cell").forEach((c) => c.classList.remove("cal-selected"));
      cell.classList.add("cal-selected");
    });
  });
}

export function bindCalendarNav(onChange, onOpenReport) {
  document.getElementById("calPrev")?.addEventListener("click", () => {
    calMonth = shiftCalMonth(calMonth, -1);
    onChange();
  });
  document.getElementById("calNext")?.addEventListener("click", () => {
    calMonth = shiftCalMonth(calMonth, 1);
    onChange();
  });
  document.getElementById("calTodayBtn")?.addEventListener("click", () => {
    calMonth = monthKey(todayStr());
    onChange();
  });

  const detail = document.getElementById("calDayDetail");
  if (detail && !detail.dataset.reportBound) {
    detail.dataset.reportBound = "1";
    detail.addEventListener("click", (e) => {
      const btn = e.target.closest(".cal-open-report");
      if (!btn) return;
      setReportDay(btn.dataset.date);
      onOpenReport?.(btn.dataset.date);
    });
  }
}

export function goToCalendarMonth(key) {
  calMonth = key;
}
