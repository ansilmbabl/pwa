import { STORES, getAll, getCategories } from "./db.js";
import { parseLocalDate, monthKey, formatMonthLabel, startOfMonth, todayStr, inRange } from "./dates.js";
import { formatCurrency, escapeHtml } from "./ui.js";
import { computeMetrics } from "./transactions.js";

let reportMonth = monthKey(todayStr());
let reportFrom = "";
let reportTo = "";

export function setReportMonth(m) { reportMonth = m; }
export function setReportRange(from, to) { reportFrom = from; reportTo = to; reportMonth = ""; }

function filterByPeriod(txs) {
  if (reportFrom && reportTo) return txs.filter((t) => inRange(t.date, reportFrom, reportTo));
  return txs.filter((t) => monthKey(t.date) === reportMonth);
}

export async function renderReports() {
  const [txs, cats] = await Promise.all([getAll(STORES.TX), getCategories()]);
  const periodTxs = filterByPeriod(txs);
  const expenses = periodTxs.filter((t) => t.type === "expense");
  const income = periodTxs.filter((t) => t.type === "income");
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = income.reduce((s, t) => s + t.amount, 0);

  document.getElementById("reportIncome").textContent = formatCurrency(totalInc);
  document.getElementById("reportExpense").textContent = formatCurrency(totalExp);
  document.getElementById("reportNet").textContent = formatCurrency(totalInc - totalExp);

  const weekly = computeWeeklyRecap(txs);
  const weeklyEl = document.getElementById("weeklyRecap");
  if (weeklyEl) weeklyEl.textContent = `This week you spent ${formatCurrency(weekly)}`;

  renderPieChart(expenses, cats);
  renderTopCategories(expenses, cats);
  renderTrendChart(txs);
  renderYearlySummary(txs);
  renderCategoryComparison(txs, cats);
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
    ctx.fillText("No expenses — add one from Dashboard", canvas.width / 2, canvas.height / 2);
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
  }).join("") : `<p class="empty-msg">No data</p>`;
}

function renderTrendChart(txs) {
  const canvas = document.getElementById("trendChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const daily = {};
  txs.filter((t) => t.type === "expense").forEach((t) => {
    daily[t.date] = (daily[t.date] || 0) + t.amount;
  });
  const dates = Object.keys(daily).sort().slice(-14);
  if (!dates.length) return;

  const max = Math.max(...dates.map((d) => daily[d]));
  const w = canvas.width, h = canvas.height;
  const barW = w / dates.length - 4;

  dates.forEach((d, i) => {
    const barH = (daily[d] / max) * (h - 20);
    ctx.fillStyle = "#2dd4bf";
    ctx.fillRect(i * (barW + 4) + 2, h - barH - 10, barW, barH);
  });
}

function renderYearlySummary(txs) {
  const el = document.getElementById("yearlySummary");
  if (!el) return;
  const year = new Date().getFullYear();
  const yearTxs = txs.filter((t) => t.date.startsWith(String(year)));
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
  const now = new Date();
  const thisKey = monthKey(todayStr());
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastKey = monthKey(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`);

  const sum = (key) => {
    const m = {};
    txs.filter((t) => t.type === "expense" && monthKey(t.date) === key)
      .forEach((t) => { m[t.categoryId] = (m[t.categoryId] || 0) + t.amount; });
    return m;
  };
  const thisM = sum(thisKey);
  const lastM = sum(lastKey);
  const ids = new Set([...Object.keys(thisM), ...Object.keys(lastM)]);

  el.innerHTML = ids.size ? [...ids].map((id) => {
    const cat = cats.find((c) => c.id === Number(id));
    const cur = thisM[id] || 0;
    const prev = lastM[id] || 0;
    const diff = cur - prev;
    return `<div class="list-card"><span>${escapeHtml(cat?.name || "?")}</span><span>${formatCurrency(cur)} vs ${formatCurrency(prev)} (${diff >= 0 ? "+" : ""}${formatCurrency(diff).slice(1)})</span></div>`;
  }).join("") : `<p class="empty-msg">Not enough data for comparison</p>`;
}

function computeWeeklyRecap(txs) {
  const sow = startOfMonth(new Date());
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return txs.filter((t) => t.type === "expense" && parseLocalDate(t.date) >= weekStart)
    .reduce((s, t) => s + t.amount, 0);
}

export function exportCSV(txs) {
  let csv = "ID,Amount,Type,Date,Category,Merchant,Payment,Notes,Tags\n";
  txs.forEach((r) => {
    const notes = (r.notes || "").replace(/"/g, '""');
    const tags = (r.tags || []).join(";");
    csv += `${r.id},${r.amount},${r.type},${r.date},${r.categoryName},${r.merchant},${r.paymentMethod},"${notes}","${tags}"\n`;
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
  const txs = filterByPeriod(await getAll(STORES.TX));
  const rows = txs.map((t) =>
    `<tr><td>${t.date}</td><td>${t.type}</td><td>${t.categoryName}</td><td>${t.merchant}</td><td>₹${t.amount.toFixed(2)}</td><td>${t.notes || ""}</td></tr>`
  ).join("");
  return `<h1>Ledger Core Report</h1><p>Period: ${reportFrom || reportMonth}</p>
    <table><tr><th>Date</th><th>Type</th><th>Category</th><th>Merchant</th><th>Amount</th><th>Notes</th></tr>${rows}</table>`;
}

export function populateMonthPicker(selectEl, txs) {
  const months = [...new Set(txs.map((t) => monthKey(t.date)))].sort().reverse();
  selectEl.innerHTML = months.map((m) => `<option value="${m}">${formatMonthLabel(m)}</option>`).join("");
  if (months.includes(reportMonth)) selectEl.value = reportMonth;
  else if (months.length) { reportMonth = months[0]; selectEl.value = reportMonth; }
}
