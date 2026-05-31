import { STORES, getAll, put, add, remove } from "./db.js";
import { formatCurrency, escapeHtml, toast } from "./ui.js";

export async function renderGoalsPanel() {
  const goals = await getAll(STORES.GOALS);
  const funds = await getAll(STORES.FUNDS);
  const goalsEl = document.getElementById("savingsGoalsList");
  const fundsEl = document.getElementById("sinkingFundsList");

  if (goalsEl) {
    goalsEl.innerHTML = goals.length ? goals.map((g) => {
      const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
      return `<div class="list-card">
        <div><strong>${escapeHtml(g.name)}</strong><span class="muted">Target: ${formatCurrency(g.targetAmount)}</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="goal-actions">
          <span>${formatCurrency(g.currentAmount)} (${pct.toFixed(0)}%)</span>
          <button type="button" class="btn-sm add-to-goal" data-id="${g.id}">+₹</button>
          <button type="button" class="btn-sm btn-danger del-goal" data-id="${g.id}">✕</button>
        </div>
      </div>`;
    }).join("") : `<p class="empty-msg">No savings goals yet</p>`;

    goalsEl.querySelectorAll(".add-to-goal").forEach((btn) => {
      btn.onclick = async () => {
        const amt = prompt("Amount to add:");
        if (!amt) return;
        const g = goals.find((x) => x.id === Number(btn.dataset.id));
        g.currentAmount = (g.currentAmount || 0) + parseFloat(amt);
        await put(STORES.GOALS, g);
        renderGoalsPanel();
      };
    });
    goalsEl.querySelectorAll(".del-goal").forEach((btn) => {
      btn.onclick = async () => {
        await remove(STORES.GOALS, Number(btn.dataset.id));
        renderGoalsPanel();
      };
    });
  }

  if (fundsEl) {
    fundsEl.innerHTML = funds.length ? funds.map((f) => {
      const pct = f.targetAmount > 0 ? Math.min(100, (f.allocatedAmount / f.targetAmount) * 100) : 0;
      return `<div class="list-card">
        <div><strong>${escapeHtml(f.name)}</strong></div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <span>${formatCurrency(f.allocatedAmount)} / ${formatCurrency(f.targetAmount)}</span>
        <button type="button" class="btn-sm btn-danger del-fund" data-id="${f.id}">✕</button>
      </div>`;
    }).join("") : `<p class="empty-msg">No sinking funds yet</p>`;

    fundsEl.querySelectorAll(".del-fund").forEach((btn) => {
      btn.onclick = async () => {
        await remove(STORES.FUNDS, Number(btn.dataset.id));
        renderGoalsPanel();
      };
    });
  }
}

export async function addSavingsGoal(name, targetAmount, deadline) {
  await add(STORES.GOALS, {
    name, targetAmount: parseFloat(targetAmount), currentAmount: 0,
    deadline: deadline || "", color: "#3b82f6",
  });
  toast("Savings goal created", "success");
}

export async function addSinkingFund(name, targetAmount) {
  await add(STORES.FUNDS, {
    name, targetAmount: parseFloat(targetAmount), allocatedAmount: 0, color: "#10b981",
  });
  toast("Sinking fund created", "success");
}

export async function renderEventsPanel() {
  const events = await getAll(STORES.EVENTS);
  const txs = await getAll(STORES.TX);
  const el = document.getElementById("eventsList");
  if (!el) return;

  el.innerHTML = events.length ? events.map((ev) => {
    const spent = txs.filter((t) => t.eventId === ev.id && t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    return `<div class="list-card">
      <div><strong>${escapeHtml(ev.name)}</strong><span class="muted">${ev.startDate}${ev.endDate ? " → " + ev.endDate : ""}</span></div>
      <span>Spent: ${formatCurrency(spent)}${ev.budget ? ` / ${formatCurrency(ev.budget)}` : ""}</span>
      <button type="button" class="btn-sm btn-danger del-event" data-id="${ev.id}">✕</button>
    </div>`;
  }).join("") : `<p class="empty-msg">No events/trips yet</p>`;

  el.querySelectorAll(".del-event").forEach((btn) => {
    btn.onclick = async () => {
      await remove(STORES.EVENTS, Number(btn.dataset.id));
      renderEventsPanel();
    };
  });
}

export async function addEvent(name, startDate, endDate, budget) {
  await add(STORES.EVENTS, { name, startDate, endDate: endDate || "", budget: parseFloat(budget) || 0, color: "#a855f7" });
  toast("Event created", "success");
}

export async function populateEventSelect(selectEl) {
  const events = await getAll(STORES.EVENTS);
  selectEl.innerHTML = `<option value="">No event</option>` +
    events.map((e) => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join("");
}

export async function renderSplitBillsPanel() {
  const groups = await getAll(STORES.SPLITS);
  const el = document.getElementById("splitGroupsList");
  if (!el) return;

  el.innerHTML = groups.length ? groups.map((g) => {
    const balances = computeSplitBalances(g);
    const settlements = suggestSettlements(balances);
    return `<div class="list-card split-group">
      <strong>${escapeHtml(g.name)}</strong>
      <div class="muted">Members: ${(g.members || []).map((m) => escapeHtml(m.name)).join(", ")}</div>
      <div>Expenses: ${(g.expenses || []).length}</div>
      ${settlements.length ? `<div class="settlements">${settlements.map((s) =>
        `<div>${escapeHtml(s.from)} pays ${escapeHtml(s.to)} ${formatCurrency(s.amount)}</div>`
      ).join("")}</div>` : ""}
      <button type="button" class="btn-sm btn-danger del-split" data-id="${g.id}">✕</button>
    </div>`;
  }).join("") : `<p class="empty-msg">No split groups yet</p>`;

  el.querySelectorAll(".del-split").forEach((btn) => {
    btn.onclick = async () => {
      await remove(STORES.SPLITS, Number(btn.dataset.id));
      renderSplitBillsPanel();
    };
  });
}

function computeSplitBalances(group) {
  const balances = {};
  (group.members || []).forEach((m) => { balances[m.name] = 0; });
  (group.expenses || []).forEach((exp) => {
    const payer = exp.paidBy;
    balances[payer] = (balances[payer] || 0) + exp.amount;
    (exp.splits || []).forEach((s) => {
      balances[s.member] = (balances[s.member] || 0) - s.amount;
    });
  });
  return balances;
}

function suggestSettlements(balances) {
  const debtors = [], creditors = [];
  Object.entries(balances).forEach(([name, bal]) => {
    if (bal < -0.01) debtors.push({ name, amount: -bal });
    if (bal > 0.01) creditors.push({ name, amount: bal });
  });
  const settlements = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].amount, creditors[j].amount);
    settlements.push({ from: debtors[i].name, to: creditors[j].name, amount: amt });
    debtors[i].amount -= amt;
    creditors[j].amount -= amt;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }
  return settlements;
}

export async function addSplitGroup(name, memberNames, expense) {
  const members = memberNames.split(",").map((n) => n.trim()).filter(Boolean).map((name) => ({ name }));
  const group = { name, members, expenses: expense ? [expense] : [] };
  await add(STORES.SPLITS, group);
  toast("Split group created", "success");
}

export async function addSplitExpense(groupId, description, amount, paidBy, splitType, members) {
  const groups = await getAll(STORES.SPLITS);
  const group = groups.find((g) => g.id === groupId);
  if (!group) return;
  const splits = members.map((m) => ({
    member: m,
    amount: splitType === "equal" ? amount / members.length : amount / members.length,
  }));
  group.expenses = group.expenses || [];
  group.expenses.push({ description, amount: parseFloat(amount), paidBy, splits });
  await put(STORES.SPLITS, group);
}
