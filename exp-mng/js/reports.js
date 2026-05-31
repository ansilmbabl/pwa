import { STORES, getAll, getCategories } from "./db.js";
import { parseLocalDate, parseDateTime, todayStr, monthKey, formatMonthLabel, startOfMonth, startOfWeek, inRange, formatDisplayDateTime } from "./dates.js";
import { formatCurrency, escapeHtml } from "./ui.js";

let reportMode = "month";
let reportMonth = monthKey(todayStr());
let reportFrom = "";
let reportTo = "";

export function getReportState() {
  return { reportMode, reportMonth, reportFrom, reportTo };
}

export function setReportMonth(m) {
  reportMode = "month";
  reportMonth = m;
  reportFrom = "";
  reportTo = "";
}

export function setReportRange(from, to) {
  reportFrom = from || "";
  reportTo = to || "";
  if (reportFrom && reportTo) {
    reportMode = "range";
  } else if (!reportFrom && !reportTo) {
    reportMode = "month";
  }
}

export function getPeriodLabel() {
  if (reportMode === "range" && reportFrom && reportTo) {
    return `${reportFrom} → ${reportTo}`;
  }
  return formatMonthLabel(reportMonth);
}

function filterByPeriod(txs) {
  if (reportMode === "range" && reportFrom && reportTo) {
    return txs.filter((t) => inRange(t.date, reportFrom, reportTo));
  }
  return txs.filter((t) => monthKey(t.date) === reportMonth);
}

export async function getFilteredTransactions() {
  const txs = await getAll(STORES.TX);
  return filterByPeriod(txs).sort((a, b) => parseDateTime(b.date, b.time) - parseDateTime(a.date, a.time));
}

function prevMonthKey(key) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function categoryTotals(expenses) {
  const map = {};
  expenses.forEach((t) => { map[t.categoryId] = (map[t.categoryId] || 0) + t.amount; });
  const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(map)
    .map(([id, amount]) => ({
      id: Number(id),
      amount,
      pct: ((amount / total) * 100).toFixed(0),
    }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getReportSnapshot() {
  const [txs, cats] = await Promise.all([getAll(STORES.TX), getCategories()]);
  const periodTxs = filterByPeriod(txs);
  const expenses = periodTxs.filter((t) => t.type === "expense");
  const income = periodTxs.filter((t) => t.type === "income");
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = income.reduce((s, t) => s + t.amount, 0);
  const catTotals = categoryTotals(expenses).map((c) => ({
    ...c,
    name: cats.find((x) => x.id === c.id)?.name || "?",
  }));
  return {
    periodLabel: getPeriodLabel(),
    income: totalInc,
    expense: totalExp,
    net: totalInc - totalExp,
    categories: catTotals,
    transactions: periodTxs.sort((a, b) => parseDateTime(b.date, b.time) - parseDateTime(a.date, a.time)),
    periodTxs,
    expenses,
    incomeTxs: income,
    cats,
    allTxs: txs,
  };
}

export async function renderReports() {
  const snap = await getReportSnapshot();
  const { periodTxs, expenses, incomeTxs: income, cats, allTxs } = snap;

  document.getElementById("reportPeriodLabel").textContent = snap.periodLabel;
  document.getElementById("reportIncome").textContent = formatCurrency(snap.income);
  document.getElementById("reportExpense").textContent = formatCurrency(snap.expense);
  document.getElementById("reportNet").textContent = formatCurrency(snap.net);

  const weeklyEl = document.getElementById("weeklyRecap");
  if (weeklyEl) weeklyEl.textContent = `This week you spent ${formatCurrency(computeWeeklyRecap(allTxs))}`;

  renderPieChart(expenses, cats);
  renderTopCategories(expenses, cats);
  renderTrendChart(periodTxs);
  renderYearlySummary(allTxs);
  renderCategoryComparison(allTxs, cats);
  renderTopMerchants(expenses);
  renderSpendingHeatmap(periodTxs);
  await renderCashFlowForecast();
  await renderTaxReport(expenses, cats);
}

function renderPieChart(expenses, cats) {
  const canvas = document.getElementById("categoryWheel");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const map = {};
  expenses.forEach((t) => { map[t.categoryId] = (map[t.categoryId] || 0) + t.amount; });
  const total = Object.values(map).reduce((s, v) => s + v, 0);

  const legend = document.getElementById("chartLegend");
  if (!total) {
    ctx.fillStyle = "#94a3b8"; ctx.textAlign = "center"; ctx.font = "13px sans-serif";
    ctx.fillText("No expenses in this period", canvas.width / 2, canvas.height / 2);
    if (legend) legend.innerHTML = "";
    return;
  }

  let startAngle = 0;
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  let legendHtml = "";

  entries.forEach(([catId, value]) => {
    const cat = cats.find((c) => c.id === Number(catId));
    const color = cat?.color || "#64748b";
    const slice = (value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, canvas.height / 2);
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 25, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    const pct = ((value / total) * 100).toFixed(0);
    const mid = startAngle + slice / 2;
    ctx.fillStyle = "#fff"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`${pct}%`, canvas.width / 2 + Math.cos(mid) * (canvas.width / 3.2), canvas.height / 2 + Math.sin(mid) * (canvas.height / 3.2));
    legendHtml += `<div class="legend-row"><span class="cat-dot" style="background:${color}"></span> ${escapeHtml(cat?.name || "?")} — ${formatCurrency(value)} (${pct}%)</div>`;
    startAngle += slice;
  });
  if (legend) legend.innerHTML = legendHtml;
}

function renderTopCategories(expenses, cats) {
  const el = document.getElementById("topCategories");
  if (!el) return;
  const map = {};
  expenses.forEach((t) => { map[t.categoryId] = (map[t.categoryId] || 0) + t.amount; });
  const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
  const ranked = Object.entries(map).sort((a, b) => b[1] - a[1]);
  el.innerHTML = ranked.length ? ranked.map(([id, amt], i) => {
    const cat = cats.find((c) => c.id === Number(id));
    return `<div class="list-card"><span>#${i + 1} ${escapeHtml(cat?.name || "?")}</span><span>${formatCurrency(amt)} (${((amt / total) * 100).toFixed(0)}%)</span></div>`;
  }).join("") : `<p class="empty-msg">No data for this period</p>`;
}

function renderTrendChart(periodTxs) {
  const canvas = document.getElementById("trendChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const daily = {};
  periodTxs.filter((t) => t.type === "expense").forEach((t) => {
    daily[t.date] = (daily[t.date] || 0) + t.amount;
  });
  const dates = Object.keys(daily).sort();
  const slice = dates.slice(-14);
  if (!slice.length) {
    ctx.fillStyle = "#71717a"; ctx.textAlign = "center"; ctx.font = "12px sans-serif";
    ctx.fillText("No spending in selected period", canvas.width / 2, canvas.height / 2);
    return;
  }

  const max = Math.max(...slice.map((d) => daily[d]));
  const w = canvas.width, h = canvas.height;
  const barW = w / slice.length - 4;

  slice.forEach((d, i) => {
    const barH = max ? (daily[d] / max) * (h - 20) : 0;
    ctx.fillStyle = "#2dd4bf";
    ctx.fillRect(i * (barW + 4) + 2, h - barH - 10, barW, barH);
  });
}

function renderYearlySummary(txs) {
  const el = document.getElementById("yearlySummary");
  if (!el) return;
  const year = reportMode === "month" ? reportMonth.slice(0, 4) : (reportFrom ? reportFrom.slice(0, 4) : String(new Date().getFullYear()));
  const yearTxs = txs.filter((t) => t.date.startsWith(year));
  let inc = 0, exp = 0;
  yearTxs.forEach((t) => {
    if (t.type === "income") inc += t.amount;
    else exp += t.amount;
  });
  const rate = inc > 0 ? (((inc - exp) / inc) * 100).toFixed(1) : 0;
  el.innerHTML = `
    <div class="grid-2">
      <div class="stat-box"><span class="muted">Income ${year}</span><strong>${formatCurrency(inc)}</strong></div>
      <div class="stat-box"><span class="muted">Expenses ${year}</span><strong>${formatCurrency(exp)}</strong></div>
    </div>
    <p class="muted">Savings rate: ${rate}%</p>`;
}

function renderCategoryComparison(txs, cats) {
  const el = document.getElementById("categoryComparison");
  if (!el) return;

  const focusKey = reportMode === "range" && reportFrom
    ? monthKey(reportFrom)
    : reportMonth;
  const lastKey = prevMonthKey(focusKey);

  const sum = (key) => {
    const m = {};
    txs.filter((t) => t.type === "expense" && monthKey(t.date) === key)
      .forEach((t) => { m[t.categoryId] = (m[t.categoryId] || 0) + t.amount; });
    return m;
  };
  const thisM = sum(focusKey);
  const lastM = sum(lastKey);
  const ids = new Set([...Object.keys(thisM), ...Object.keys(lastM)]);

  const focusLabel = formatMonthLabel(focusKey);
  const lastLabel = formatMonthLabel(lastKey);

  el.innerHTML = ids.size ? [...ids].map((id) => {
    const cat = cats.find((c) => c.id === Number(id));
    const cur = thisM[id] || 0;
    const prev = lastM[id] || 0;
    const diff = cur - prev;
    return `<div class="list-card"><span>${escapeHtml(cat?.name || "?")}</span><span>${formatCurrency(cur)} vs ${formatCurrency(prev)} (${diff >= 0 ? "+" : ""}${formatCurrency(diff).slice(1)})</span></div>`;
  }).join("") + `<p class="muted">${focusLabel} compared to ${lastLabel}</p>` : `<p class="empty-msg">Not enough data for comparison</p>`;
}

function computeWeeklyRecap(txs) {
  const weekStart = startOfWeek(new Date());
  return txs.filter((t) => t.type === "expense" && parseLocalDate(t.date) >= weekStart)
    .reduce((s, t) => s + t.amount, 0);
}

export function exportCSV(txs) {
  let csv = "ID,Amount,Type,Date,Time,Category,Merchant,Payment,Notes,Tags\n";
  txs.forEach((r) => {
    const notes = (r.notes || "").replace(/"/g, '""');
    const tags = (r.tags || []).join(";");
    csv += `${r.id},${r.amount},${r.type},${r.date},${r.time || ""},${r.categoryName},${r.merchant},${r.paymentMethod},"${notes}","${tags}"\n`;
  });
  return csv;
}

export function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function printPDFReport(title, html) {
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px}</style>
    </head><body>${html}</body></html>`);
  win.document.close();
  win.print();
}

export async function buildPDFHtml() {
  const snap = await getReportSnapshot();
  const rows = snap.transactions.map((t) =>
    `<tr><td>${formatDisplayDateTime(t.date, t.time)}</td><td>${t.type}</td><td>${t.categoryName}</td><td>${t.merchant}</td><td>₹${t.amount.toFixed(2)}</td><td>${t.notes || ""}</td></tr>`
  ).join("");
  return `<h1>Ledger Core Report</h1><p>Period: ${snap.periodLabel}</p>
    <p>Income: ₹${snap.income.toFixed(2)} | Expenses: ₹${snap.expense.toFixed(2)} | Net: ₹${snap.net.toFixed(2)}</p>
    <table><tr><th>Date & time</th><th>Type</th><th>Category</th><th>Merchant</th><th>Amount</th><th>Notes</th></tr>${rows}</table>`;
}

export function populateMonthPicker(selectEl, txs) {
  const months = new Set(txs.map((t) => monthKey(t.date)));
  months.add(monthKey(todayStr()));
  const sorted = [...months].sort().reverse();
  selectEl.innerHTML = sorted.map((m) => `<option value="${m}">${formatMonthLabel(m)}</option>`).join("");
  if (sorted.includes(reportMonth)) selectEl.value = reportMonth;
  else if (sorted.length) { reportMonth = sorted[0]; selectEl.value = reportMonth; }
}

export async function exportFilteredCSV() {
  const txs = await getFilteredTransactions();
  if (!txs.length) throw new Error("No transactions in selected period");
  const label = getPeriodLabel().replace(/\s+/g, "-");
  downloadFile(exportCSV(txs), `ledger-report-${label}.csv`, "text/csv");
  return txs.length;
}

export async function exportFilteredJSON() {
  const snap = await getReportSnapshot();
  const data = {
    version: 4,
    exportedAt: new Date().toISOString(),
    reportPeriod: snap.periodLabel,
    summary: { income: snap.income, expense: snap.expense, net: snap.net },
    transactions: snap.transactions,
  };
  const label = getPeriodLabel().replace(/\s+/g, "-");
  downloadFile(JSON.stringify(data, null, 2), `ledger-report-${label}.json`, "application/json");
  return snap.transactions.length;
}

function renderTopMerchants(expenses) {
  const el = document.getElementById("topMerchants");
  if (!el) return;
  const map = {};
  expenses.forEach((t) => {
    const m = (t.merchant || "Unknown").trim();
    if (m && !m.startsWith("→") && !m.startsWith("←")) {
      map[m] = (map[m] || 0) + t.amount;
    }
  });
  const ranked = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  el.innerHTML = ranked.length ? ranked.map(([name, amt], i) =>
    `<div class="list-card"><span>#${i + 1} ${escapeHtml(name)}</span><span>${formatCurrency(amt)}</span></div>`
  ).join("") : `<p class="empty-msg">No merchant data</p>`;
}

function renderSpendingHeatmap(periodTxs) {
  const el = document.getElementById("spendingHeatmap");
  if (!el) return;
  const daily = {};
  periodTxs.filter((t) => t.type === "expense").forEach((t) => {
    daily[t.date] = (daily[t.date] || 0) + t.amount;
  });
  const dates = Object.keys(daily).sort();
  if (!dates.length) {
    el.innerHTML = `<p class="empty-msg">No spending to show</p>`;
    return;
  }
  const max = Math.max(...Object.values(daily));
  let html = '<div class="heatmap-grid">';
  dates.forEach((d) => {
    const amt = daily[d];
    const intensity = max ? amt / max : 0;
    const alpha = 0.15 + intensity * 0.85;
    const day = parseLocalDate(d).getDate();
    html += `<div class="heatmap-cell" style="background:rgba(45,212,191,${alpha})" title="${d}: ${formatCurrency(amt)}"><span>${day}</span></div>`;
  });
  html += "</div>";
  el.innerHTML = html;
}

async function renderCashFlowForecast() {
  const el = document.getElementById("cashFlowForecast");
  if (!el) return;
  const [recurring, txs] = await Promise.all([getAll(STORES.RECUR), getAll(STORES.TX)]);
  const som = startOfMonth(new Date());
  const monthKeyCur = monthKey(todayStr());
  let projectedExpense = 0;
  let projectedIncome = 0;

  recurring.forEach((r) => {
    const amt = parseFloat(r.amount) || 0;
    if (r.type === "income") projectedIncome += amt;
    else projectedExpense += amt;
  });

  txs.filter((t) => monthKey(t.date) === monthKeyCur).forEach((t) => {
    if (t.type === "income") projectedIncome += t.amount * 0; // already counted actuals separately
  });

  const actualSnap = await getReportSnapshot();
  const actualExp = actualSnap.expense;
  const actualInc = actualSnap.income;
  const forecastExp = actualExp + projectedExpense;
  const forecastInc = actualInc;
  const forecastNet = forecastInc - forecastExp;

  el.innerHTML = `
    <div class="grid-2">
      <div class="stat-box"><span class="muted">Actual expenses</span><strong>${formatCurrency(actualExp)}</strong></div>
      <div class="stat-box"><span class="muted">+ Recurring bills</span><strong>${formatCurrency(projectedExpense)}</strong></div>
    </div>
    <p class="muted">Projected month-end spending: <strong>${formatCurrency(forecastExp)}</strong></p>
    <p class="muted">Projected net (income − forecast): <strong>${formatCurrency(forecastNet)}</strong></p>`;
}

async function renderTaxReport(expenses, cats) {
  const el = document.getElementById("taxReport");
  if (!el) return;
  const { getMileageTaxTotal } = await import("./mileage.js");
  const year = new Date().getFullYear();
  const deductible = expenses.filter((t) => {
    const cat = cats.find((c) => c.id === t.categoryId);
    return cat?.isTaxDeductible;
  });
  const catTotal = deductible.reduce((s, t) => s + t.amount, 0);
  const mileageTotal = await getMileageTaxTotal(year);
  const grand = catTotal + mileageTotal;

  el.innerHTML = `
    <div class="grid-2">
      <div class="stat-box"><span class="muted">Deductible categories</span><strong>${formatCurrency(catTotal)}</strong></div>
      <div class="stat-box"><span class="muted">Mileage (${year})</span><strong>${formatCurrency(mileageTotal)}</strong></div>
    </div>
    <p>Estimated tax-deductible total: <strong>${formatCurrency(grand)}</strong></p>
    <p class="muted" style="font-size:0.8rem">Mark categories as tax-deductible in Settings. Mileage from Mileage panel.</p>`;
}
