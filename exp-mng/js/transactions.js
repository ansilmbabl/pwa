import { STORES, getAll, getById, put, add, remove, getCategories, getSetting, setSetting, getDefaultWallet } from "./db.js";
import { parseLocalDate, parseDateTime, todayStr, nowTimeStr, monthKey, formatMonthLabel, startOfMonth, startOfWeek, inRange, formatDisplayDateTime, setDefaultDateTimeFields } from "./dates.js";
import { toast, formatCurrency, categoryDot, escapeHtml, confirmInline, categoryOptionLabel } from "./ui.js";
import { shareTransaction } from "./share.js";
import { applyAutoRules } from "./rules.js";
import { activatePane } from "./tabs.js";

let editId = null;
let historySort = "date-desc";
let historyFilter = { q: "", type: "all", categoryId: "" };
let pendingReceipt = null;

export function getEditId() { return editId; }
export function setEditId(id) { editId = id; }

export async function findDuplicate(data, excludeId = null) {
  const txs = await getAll(STORES.TX);
  return txs.find((t) => {
    if (excludeId && t.id === excludeId) return false;
    return t.amount === parseFloat(data.amount) &&
      t.date === data.date &&
      t.categoryId === Number(data.categoryId) &&
      (t.merchant || "") === (data.merchant || "");
  });
}

export async function getTransactions() {
  const txs = await getAll(STORES.TX);
  return txs.sort((a, b) => parseDateTime(b.date, b.time) - parseDateTime(a.date, a.time));
}

export async function saveTransaction(data, skipDupCheck = false) {
  if (!data.amount || data.amount <= 0) throw new Error("Amount must be greater than 0");
  const cats = await getCategories(data.type);
  let categoryId = Number(data.categoryId);
  if (!categoryId && data.merchant) {
    const autoCat = await applyAutoRules(data.merchant, data.type);
    if (autoCat) categoryId = autoCat;
  }
  const cat = cats.find((c) => c.id === categoryId);
  const defaultWallet = await getDefaultWallet();

  if (!skipDupCheck && !editId) {
    const dup = await findDuplicate({ ...data, categoryId });
    if (dup && !confirm(
      `Possible duplicate: ${dup.categoryName} ${formatCurrency(dup.amount)} on ${formatDisplayDateTime(dup.date, dup.time)}.\n\nSave anyway?`
    )) {
      throw new Error("Cancelled");
    }
  }

  const record = {
    amount: parseFloat(data.amount),
    type: data.type,
    date: data.date,
    time: data.time || nowTimeStr(),
    categoryId,
    categoryName: cat ? cat.name : "Other",
    merchant: data.merchant || "",
    paymentMethod: data.paymentMethod || "Cash",
    notes: data.notes || "",
    tags: data.tags || [],
    eventId: data.eventId ? Number(data.eventId) : null,
    recurringId: data.recurringId || null,
    splits: data.splits || [],
    walletId: data.walletId ? Number(data.walletId) : (defaultWallet?.id || null),
    receiptThumb: data.receiptThumb ?? pendingReceipt ?? null,
  };
  if (editId) {
    record.id = editId;
    await put(STORES.TX, record);
    toast("Transaction updated", "success");
    editId = null;
  } else {
    await add(STORES.TX, record);
    toast("Transaction saved", "success");
  }
  await setSetting("lastCategory", { type: data.type, categoryId });
  pendingReceipt = null;
  clearReceiptPreview();
  return record;
}

export async function deleteTransaction(id) {
  await remove(STORES.TX, id);
  toast("Transaction deleted", "success");
}

export async function duplicateLastTransaction() {
  const txs = await getTransactions();
  if (!txs.length) return toast("No transactions to duplicate", "error");
  const last = { ...txs[0] };
  delete last.id;
  last.date = todayStr();
  last.time = nowTimeStr();
  await add(STORES.TX, last);
  toast("Duplicated last entry", "success");
}

export function computeMetrics(txs, cats, monthlyBudget = 0) {
  const now = new Date();
  const som = startOfMonth(now);
  const sow = startOfWeek(now);

  let totalBalance = 0, monthlyIncome = 0, monthlyExpense = 0, weeklyExpense = 0;
  const catSpent = {};

  txs.forEach((tx) => {
    const amt = parseFloat(tx.amount);
    const d = parseLocalDate(tx.date);
    if (tx.type === "income") {
      totalBalance += amt;
      if (d >= som) monthlyIncome += amt;
    } else {
      totalBalance -= amt;
      if (d >= som) {
        monthlyExpense += amt;
        catSpent[tx.categoryId] = (catSpent[tx.categoryId] || 0) + amt;
      }
      if (d >= sow) weeklyExpense += amt;
    }
  });

  const monthNet = monthlyIncome - monthlyExpense;
  const leftToSpend = monthlyBudget > 0 ? monthlyBudget - monthlyExpense : monthNet;

  return { totalBalance, monthlyIncome, monthlyExpense, monthNet, weeklyExpense, leftToSpend, catSpent };
}

function filterTxs(txs) {
  return txs.filter((tx) => {
    if (historyFilter.type !== "all" && tx.type !== historyFilter.type) return false;
    if (historyFilter.categoryId && tx.categoryId !== Number(historyFilter.categoryId)) return false;
    if (historyFilter.q) {
      const q = historyFilter.q.toLowerCase();
      const hay = `${tx.categoryName} ${tx.merchant} ${tx.notes} ${tx.amount} ${tx.time || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function sortTxs(txs) {
  const copy = [...txs];
  if (historySort === "date-asc") copy.sort((a, b) => parseDateTime(a.date, a.time) - parseDateTime(b.date, b.time));
  else if (historySort === "amount-desc") copy.sort((a, b) => b.amount - a.amount);
  else if (historySort === "amount-asc") copy.sort((a, b) => a.amount - b.amount);
  else copy.sort((a, b) => parseDateTime(b.date, b.time) - parseDateTime(a.date, a.time));
  return copy;
}

function bucketLabel(tx, now) {
  const d = parseLocalDate(tx.date);
  const today = parseLocalDate(todayStr());
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const sow = startOfWeek(now);
  const som = startOfMonth(now);

  if (d >= today) return "Today";
  if (d >= yesterday && d < today) return "Yesterday";
  if (d >= sow) return "This Week";
  if (d >= som) return "This Month";
  return formatMonthLabel(monthKey(tx.date));
}

export function renderTxItem(tx, cats, onRefresh) {
  const cat = cats.find((c) => c.id === tx.categoryId);
  const el = document.createElement("div");
  el.className = "tx-item";
  el.dataset.id = tx.id;
  const sign = tx.type === "income" ? "+" : "-";
  const when = formatDisplayDateTime(tx.date, tx.time);
  const meta = [tx.merchant, tx.paymentMethod, tx.notes].filter(Boolean).join(" • ");
  el.innerHTML = `
    <div class="tx-details">
      <strong>${categoryDot(cat?.color)} ${escapeHtml(tx.categoryName)}</strong>
      <span>${escapeHtml(meta || when)} • ${when}</span>
      ${tx.tags?.length ? `<span class="tag-row">${tx.tags.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join("")}</span>` : ""}
    </div>
    <div class="tx-actions">
      <span class="tx-amount ${tx.type}">${sign}${formatCurrency(tx.amount).slice(1)}</span>
      <button type="button" class="icon-btn share-btn" title="Share">⎘</button>
      <button type="button" class="icon-btn edit-btn" title="Edit">✎</button>
      <button type="button" class="icon-btn del-btn" title="Delete">✕</button>
    </div>`;

  el.querySelector(".share-btn").onclick = (e) => {
    e.stopPropagation();
    shareTransaction(tx);
  };

  el.querySelector(".edit-btn").onclick = () => {
    setEditId(tx.id);
    window.dispatchEvent(new CustomEvent("edit-tx", { detail: tx }));
    document.querySelector('[data-tab="dash"]')?.click();
  };

  const confirmSlot = document.createElement("div");
  el.querySelector(".del-btn").onclick = () => {
    confirmSlot.className = "confirm-slot";
    el.appendChild(confirmSlot);
    confirmInline(confirmSlot, "Delete this entry?", async () => {
      await deleteTransaction(tx.id);
      onRefresh();
    });
  };

  el.addEventListener("click", (e) => {
    if (e.target.closest(".icon-btn") || e.target.closest(".confirm-slot")) return;
    window.dispatchEvent(new CustomEvent("show-tx-detail", { detail: tx }));
  });

  return el;
}

export async function renderHistory(container, onRefresh) {
  const [txs, cats] = await Promise.all([getTransactions(), getCategories()]);
  const filtered = sortTxs(filterTxs(txs));
  const now = new Date();
  const buckets = new Map();

  filtered.forEach((tx) => {
    const label = bucketLabel(tx, now);
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label).push(tx);
  });

  container.innerHTML = "";
  if (!filtered.length) {
    container.innerHTML = `<p class="empty-msg">No transactions found. Add one from Dashboard.</p>`;
    return;
  }

  buckets.forEach((items, label) => {
    const section = document.createElement("div");
    section.className = "time-section";
    section.innerHTML = `<h4 class="sticky-header">${escapeHtml(label)}</h4>`;
    const list = document.createElement("div");
    items.forEach((tx) => list.appendChild(renderTxItem(tx, cats, onRefresh)));
    section.appendChild(list);
    container.appendChild(section);
  });
}

export async function renderRecentActivity(container, limit = 5) {
  const [txs, cats] = await Promise.all([getTransactions(), getCategories()]);
  container.innerHTML = "";
  if (!txs.length) {
    container.innerHTML = `<p class="empty-msg">No recent activity</p>`;
    return;
  }
  txs.slice(0, limit).forEach((tx) => {
    container.appendChild(renderTxItem(tx, cats, () => window.dispatchEvent(new Event("refresh-app"))));
  });
}

export function bindHistoryControls() {
  const search = document.getElementById("historySearch");
  const typeFilter = document.getElementById("historyTypeFilter");
  const sortSelect = document.getElementById("historySort");
  const catFilter = document.getElementById("historyCatFilter");

  if (search) search.oninput = () => { historyFilter.q = search.value; window.dispatchEvent(new Event("refresh-history")); };
  if (typeFilter) typeFilter.onchange = () => { historyFilter.type = typeFilter.value; window.dispatchEvent(new Event("refresh-history")); };
  if (sortSelect) sortSelect.onchange = () => { historySort = sortSelect.value; window.dispatchEvent(new Event("refresh-history")); };
  if (catFilter) catFilter.onchange = () => { historyFilter.categoryId = catFilter.value; window.dispatchEvent(new Event("refresh-history")); };
}


export async function populateCategorySelect(selectEl, type) {
  if (!selectEl) return;
  const prev = selectEl.value;
  const cats = await getCategories(type);
  const last = await getSetting("lastCategory");
  selectEl.innerHTML = cats.map((c) =>
    `<option value="${c.id}">${categoryOptionLabel(c)}</option>`,
  ).join("");
  if (prev && cats.some((c) => c.id === Number(prev))) {
    selectEl.value = prev;
  } else if (last && last.type === type && cats.some((c) => c.id === Number(last.categoryId))) {
    selectEl.value = last.categoryId;
  }
}

export async function refreshAllCategorySelects() {
  const txType = document.getElementById("txType")?.value || "expense";
  await populateCategorySelect(document.getElementById("txCat"), txType);
  await populateCategorySelect(document.getElementById("recurCat"), "expense");

  const histCat = document.getElementById("historyCatFilter");
  if (histCat) {
    const prev = histCat.value;
    const cats = await getCategories();
    histCat.innerHTML = `<option value="">All categories</option>` +
      cats.map((c) => `<option value="${c.id}">${categoryOptionLabel(c)}</option>`).join("");
    if (prev && cats.some((c) => c.id === Number(prev))) histCat.value = prev;
  }
}

export function bindMerchantAutoRule() {
  const merchantEl = document.getElementById("txMerchant");
  const catSel = document.getElementById("txCat");
  const typeSel = document.getElementById("txType");
  if (!merchantEl) return;
  merchantEl.addEventListener("blur", async () => {
    const m = merchantEl.value.trim();
    if (!m || editId) return;
    const catId = await applyAutoRules(m, typeSel?.value || "expense");
    if (catId && catSel) {
      catSel.value = catId;
      toast("Category auto-matched", "info");
    }
  });
}

export function bindReceiptAttach() {
  const input = document.getElementById("txReceipt");
  const preview = document.getElementById("receiptPreview");
  input?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 600000) return toast("Image too large (max ~600KB)", "error");
    const reader = new FileReader();
    reader.onload = () => {
      pendingReceipt = reader.result;
      if (preview) {
        preview.innerHTML = `<img src="${pendingReceipt}" alt="Receipt" class="receipt-thumb"><button type="button" id="clearReceipt" class="btn-sm btn-ghost">Remove</button>`;
        document.getElementById("clearReceipt")?.addEventListener("click", () => {
          pendingReceipt = null;
          clearReceiptPreview();
          input.value = "";
        });
      }
    };
    reader.readAsDataURL(file);
  });
}

function clearReceiptPreview() {
  const preview = document.getElementById("receiptPreview");
  if (preview) preview.innerHTML = "";
  const input = document.getElementById("txReceipt");
  if (input) input.value = "";
}

export async function fillFormFromTx(tx) {
  document.getElementById("txFormTitle").textContent = "Edit transaction";
  document.getElementById("txAmt").value = tx.amount;
  syncTypePills(tx.type);
  document.getElementById("txDate").value = tx.date;
  document.getElementById("txTime").value = tx.time || "12:00";
  document.getElementById("txMerchant").value = tx.merchant || "";
  document.getElementById("txPayment").value = tx.paymentMethod || "Cash";
  document.getElementById("txNotes").value = tx.notes || "";
  document.getElementById("txTags").value = (tx.tags || []).join(", ");
  if (tx.eventId) document.getElementById("txEvent").value = tx.eventId;
  if (tx.walletId) document.getElementById("txWallet").value = tx.walletId;
  pendingReceipt = tx.receiptThumb || null;
  const preview = document.getElementById("receiptPreview");
  if (preview && pendingReceipt) {
    preview.innerHTML = `<img src="${pendingReceipt}" alt="Receipt" class="receipt-thumb"><button type="button" id="clearReceipt" class="btn-sm btn-ghost">Remove</button>`;
    document.getElementById("clearReceipt")?.addEventListener("click", () => {
      pendingReceipt = null;
      clearReceiptPreview();
    });
  }
  await populateCategorySelect(document.getElementById("txCat"), tx.type);
  document.getElementById("txCat").value = tx.categoryId;
  if (tx.splits?.length) {
    document.getElementById("splitSection").style.display = "block";
    renderSplitRows(tx.splits);
  }
  activatePane(document.getElementById("txForm"), tx.merchant || tx.notes || tx.tags?.length ? "details" : "essentials");
  openAddSheet();
}

export function syncTypePills(type) {
  const typeSel = document.getElementById("txType");
  if (typeSel) typeSel.value = type;
  document.querySelectorAll(".type-pill").forEach((p) => {
    p.classList.remove("active-expense", "active-income");
    if (p.dataset.type === type) {
      p.classList.add(type === "income" ? "active-income" : "active-expense");
    }
  });
}

export function openAddSheet() {
  const popup = document.getElementById("txPopup");
  if (popup) {
    popup.classList.add("open");
    popup.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => document.getElementById("txAmt")?.focus(), 100);
  }
}

export function closeAddSheet() {
  const popup = document.getElementById("txPopup");
  if (popup) {
    popup.classList.remove("open");
    popup.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
}

export function resetForm() {
  editId = null;
  document.getElementById("txFormTitle").textContent = "Add transaction";
  document.getElementById("txForm").reset();
  setDefaultDateTimeFields(document.getElementById("txDate"), document.getElementById("txTime"));
  document.getElementById("splitSection").style.display = "none";
  document.getElementById("splitRows").innerHTML = "";
  pendingReceipt = null;
  clearReceiptPreview();
  syncTypePills("expense");
  activatePane(document.getElementById("txForm"), "essentials");
}

function renderSplitRows(splits) {
  const container = document.getElementById("splitRows");
  container.innerHTML = splits.map((s, i) => splitRowHtml(i, s)).join("");
}

function splitRowHtml(i, s = {}) {
  return `<div class="split-row" data-i="${i}">
    <input type="text" class="split-cat" placeholder="Category" value="${escapeHtml(s.categoryName || "")}">
    <input type="number" class="split-amt" placeholder="Amount" step="0.01" value="${s.amount || ""}">
    <button type="button" class="icon-btn remove-split">✕</button>
  </div>`;
}

export function bindSplitControls() {
  document.getElementById("addSplitBtn")?.addEventListener("click", () => {
    document.getElementById("splitSection").style.display = "block";
    const container = document.getElementById("splitRows");
    const i = container.children.length;
    container.insertAdjacentHTML("beforeend", splitRowHtml(i));
  });
  document.getElementById("splitRows")?.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-split")) e.target.closest(".split-row").remove();
  });
}

export function collectSplitData() {
  const rows = document.querySelectorAll(".split-row");
  if (!rows.length) return [];
  return [...rows].map((r) => ({
    categoryName: r.querySelector(".split-cat").value,
    amount: parseFloat(r.querySelector(".split-amt").value) || 0,
  })).filter((s) => s.categoryName && s.amount > 0);
}

export { filterTxs, sortTxs, inRange, monthKey };
