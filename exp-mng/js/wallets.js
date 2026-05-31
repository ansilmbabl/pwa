import { STORES, getAll, add, put, getDefaultWallet } from "./db.js";
import { todayStr, nowTimeStr } from "./dates.js";
import { formatCurrency, escapeHtml, toast } from "./ui.js";

export async function computeWalletBalances(txs, wallets) {
  const map = {};
  wallets.forEach((w) => { map[w.id] = 0; });
  txs.forEach((tx) => {
    if (!tx.walletId || !map[tx.walletId]) return;
    const amt = parseFloat(tx.amount);
    if (tx.type === "income") map[tx.walletId] += amt;
    else if (tx.type === "expense") map[tx.walletId] -= amt;
  });
  return map;
}

export async function renderWalletsPanel() {
  const container = document.getElementById("walletsList");
  if (!container) return;
  const [wallets, txs] = await Promise.all([getAll(STORES.WALLETS), getAll(STORES.TX)]);
  const balances = await computeWalletBalances(txs, wallets);

  container.innerHTML = wallets.length ? wallets.map((w) => `
    <div class="wallet-card" style="border-left:3px solid ${w.color || "#64748b"}">
      <div class="wallet-head">
        <span>${w.icon || "💳"} ${escapeHtml(w.name)}</span>
        <strong>${formatCurrency(balances[w.id] || 0)}</strong>
      </div>
      <small class="muted">${w.type}${w.isDefault ? " · default" : ""}</small>
    </div>`).join("") : `<p class="empty-msg">No wallets yet</p>`;

  const selFrom = document.getElementById("transferFrom");
  const selTo = document.getElementById("transferTo");
  const opts = wallets.map((w) => `<option value="${w.id}">${w.icon || ""} ${escapeHtml(w.name)}</option>`).join("");
  if (selFrom) selFrom.innerHTML = opts;
  if (selTo) selTo.innerHTML = opts;
  await populateTxWalletSelect(wallets);
}

export async function populateTxWalletSelect(walletsIn) {
  const selTx = document.getElementById("txWallet");
  if (!selTx) return;
  const wallets = walletsIn || await getAll(STORES.WALLETS);
  const prev = selTx.value;
  if (!wallets.length) {
    selTx.innerHTML = `<option value="">No wallet</option>`;
    return;
  }
  selTx.innerHTML = wallets.map((w) =>
    `<option value="${w.id}">${w.icon || "💳"} ${escapeHtml(w.name)}</option>`,
  ).join("");
  const def = wallets.find((w) => w.isDefault);
  if (prev && wallets.some((w) => String(w.id) === String(prev))) selTx.value = prev;
  else if (def) selTx.value = def.id;
}

export async function populateTxFormSelects() {
  const { populateEventSelect } = await import("./goals.js");
  await Promise.all([
    populateEventSelect(document.getElementById("txEvent")),
    populateTxWalletSelect(),
  ]);
}

export async function addWallet(name, type = "other", icon = "💳", color = "#64748b") {
  if (!name.trim()) throw new Error("Wallet name required");
  await add(STORES.WALLETS, { name: name.trim(), type, icon, color, isDefault: false, balance: 0 });
  toast("Wallet added", "success");
}

export async function transferFunds(fromId, toId, amount, date, time) {
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) throw new Error("Invalid amount");
  if (Number(fromId) === Number(toId)) throw new Error("Choose different wallets");
  const wallets = await getAll(STORES.WALLETS);
  const from = wallets.find((w) => w.id === Number(fromId));
  const to = wallets.find((w) => w.id === Number(toId));
  if (!from || !to) throw new Error("Wallet not found");

  const group = `xfer-${Date.now()}`;
  const d = date || todayStr();
  const t = time || nowTimeStr();

  await add(STORES.TX, {
    amount: amt, type: "expense", date: d, time: t,
    categoryId: null, categoryName: "Transfer",
    merchant: `→ ${to.name}`, paymentMethod: "Transfer",
    notes: `Transfer to ${to.name}`, tags: ["transfer"],
    walletId: from.id, transferGroup: group, eventId: null, recurringId: null, splits: [],
  });
  await add(STORES.TX, {
    amount: amt, type: "income", date: d, time: t,
    categoryId: null, categoryName: "Transfer",
    merchant: `← ${from.name}`, paymentMethod: "Transfer",
    notes: `Transfer from ${from.name}`, tags: ["transfer"],
    walletId: to.id, transferGroup: group, eventId: null, recurringId: null, splits: [],
  });
  toast(`Transferred ${formatCurrency(amt)}`, "success");
}

export async function renderDashWallets() {
  const el = document.getElementById("dashWallets");
  if (!el) return;
  const [wallets, txs] = await Promise.all([getAll(STORES.WALLETS), getAll(STORES.TX)]);
  const balances = await computeWalletBalances(txs, wallets);
  el.innerHTML = wallets.map((w) => `
    <div class="wallet-mini"><span>${w.icon || "💳"} ${escapeHtml(w.name)}</span><strong>${formatCurrency(balances[w.id] || 0)}</strong></div>`
  ).join("");
}

export async function populateWalletSelect(selectEl) {
  const wallets = await getAll(STORES.WALLETS);
  const def = await getDefaultWallet();
  selectEl.innerHTML = wallets.map((w) =>
    `<option value="${w.id}">${w.icon || ""} ${escapeHtml(w.name)}</option>`
  ).join("");
  if (def) selectEl.value = def.id;
}
