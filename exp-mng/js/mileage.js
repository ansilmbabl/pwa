import { STORES, getAll, add, remove } from "./db.js";
import { todayStr } from "./dates.js";
import { formatCurrency, escapeHtml, toast } from "./ui.js";

const DEFAULT_RATE = 15;

export async function getMileageRate() {
  const { getSetting } = await import("./db.js");
  return Number(await getSetting("mileageRate", DEFAULT_RATE));
}

export async function setMileageRate(rate) {
  const { setSetting } = await import("./db.js");
  await setSetting("mileageRate", Number(rate) || DEFAULT_RATE);
}

export async function addMileageEntry(miles, purpose, date) {
  const m = parseFloat(miles);
  if (!m || m <= 0) throw new Error("Miles must be > 0");
  const rate = await getMileageRate();
  await add(STORES.MILEAGE, {
    miles: m,
    purpose: purpose.trim(),
    date: date || todayStr(),
    amount: m * rate,
    rate,
  });
  toast("Mileage logged", "success");
}

export async function renderMileagePanel() {
  const list = document.getElementById("mileageList");
  const totalEl = document.getElementById("mileageTotal");
  const rateInp = document.getElementById("mileageRate");
  if (!list) return;

  const rate = await getMileageRate();
  if (rateInp) rateInp.value = rate;

  const entries = (await getAll(STORES.MILEAGE)).sort((a, b) => b.date.localeCompare(a.date));
  const totalMiles = entries.reduce((s, e) => s + e.miles, 0);
  const totalAmt = entries.reduce((s, e) => s + e.amount, 0);
  if (totalEl) totalEl.textContent = `${totalMiles.toFixed(1)} mi · ${formatCurrency(totalAmt)}`;

  list.innerHTML = entries.length ? entries.map((e) => `
    <div class="list-card">
      <span>${e.date} · ${escapeHtml(e.purpose)} · ${e.miles} mi</span>
      <span>${formatCurrency(e.amount)} <button type="button" class="btn-sm btn-danger del-mile" data-id="${e.id}">✕</button></span>
    </div>`).join("") : `<p class="empty-msg">No mileage entries</p>`;

  list.querySelectorAll(".del-mile").forEach((btn) => {
    btn.onclick = async () => {
      await remove(STORES.MILEAGE, Number(btn.dataset.id));
      renderMileagePanel();
    };
  });
}

export async function getMileageTaxTotal(year) {
  const entries = await getAll(STORES.MILEAGE);
  return entries.filter((e) => e.date.startsWith(String(year))).reduce((s, e) => s + e.amount, 0);
}
