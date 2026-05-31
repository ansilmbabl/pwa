import { STORES, getAll, put, add, remove, getCategories, getSetting, setSetting, findCategoryByName } from "./db.js";
import { formatCurrency, escapeHtml, toast } from "./ui.js";
import { computeMetrics } from "./transactions.js";

function normalizeIcon(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "📦";
  return [...trimmed][0] || "📦";
}

export async function getMonthlyBudget() {
  return Number(await getSetting("monthlyBudget", 0));
}

export async function setMonthlyBudget(amount) {
  await setSetting("monthlyBudget", Number(amount) || 0);
}

export async function renderBudgetPanel() {
  const [txs, cats, budget] = await Promise.all([
    getAll(STORES.TX),
    getCategories("expense"),
    getMonthlyBudget(),
  ]);
  const { monthlyExpense, catSpent, monthNet, leftToSpend } = computeMetrics(txs, cats, budget);

  const budgetInput = document.getElementById("monthlyBudgetInput");
  if (budgetInput) budgetInput.value = budget || "";
  document.getElementById("budgetSpent").textContent = formatCurrency(monthlyExpense);
  document.getElementById("budgetRemaining").textContent = formatCurrency(budget > 0 ? budget - monthlyExpense : leftToSpend);
  document.getElementById("monthNetDisplay").textContent = formatCurrency(monthNet);
  document.getElementById("leftToSpendDisplay").textContent = formatCurrency(leftToSpend);

  const bar = document.getElementById("budgetProgressBar");
  if (bar && budget > 0) {
    const pct = Math.min(100, (monthlyExpense / budget) * 100);
    bar.style.width = `${pct}%`;
    bar.className = `progress-fill${pct >= 100 ? " over" : pct >= 80 ? " warn" : ""}`;
  }

  const list = document.getElementById("categoryBudgetList");
  if (!list) return;
  list.innerHTML = cats.map((cat) => {
    const spent = catSpent[cat.id] || 0;
    const limit = cat.budgetLimit || 0;
    const rollover = cat.rollover || 0;
    const effective = limit + rollover;
    const pct = effective > 0 ? Math.min(100, (spent / effective) * 100) : 0;
    const over = effective > 0 && spent > effective;
    return `<div class="budget-cat-row${over ? " over-budget" : ""}">
      <div class="budget-cat-head">
        <span>${cat.icon || ""} ${escapeHtml(cat.name)}</span>
        <span>${formatCurrency(spent)}${effective ? ` / ${formatCurrency(effective)}` : ""}</span>
      </div>
      ${effective ? `<div class="progress-track"><div class="progress-fill${over ? " over" : pct >= 80 ? " warn" : ""}" style="width:${pct}%"></div></div>` : ""}
      <div class="budget-cat-edit">
        <input type="number" data-cat-id="${cat.id}" class="cat-limit-input" placeholder="Limit ₹" value="${limit || ""}" step="100">
        <input type="number" data-cat-id="${cat.id}" class="cat-rollover-input" placeholder="Rollover ₹" value="${rollover || ""}" step="100">
        <label><input type="checkbox" data-cat-id="${cat.id}" class="cat-fav-input" ${cat.isFavorite ? "checked" : ""}> Fav</label>
      </div>
    </div>`;
  }).join("");

  list.querySelectorAll(".cat-limit-input").forEach((inp) => {
    inp.onchange = async () => {
      const cat = cats.find((c) => c.id === Number(inp.dataset.catId));
      cat.budgetLimit = Number(inp.value) || 0;
      await put(STORES.CAT, cat);
      renderBudgetPanel();
    };
  });
  list.querySelectorAll(".cat-rollover-input").forEach((inp) => {
    inp.onchange = async () => {
      const cat = cats.find((c) => c.id === Number(inp.dataset.catId));
      cat.rollover = Number(inp.value) || 0;
      await put(STORES.CAT, cat);
      renderBudgetPanel();
    };
  });
  list.querySelectorAll(".cat-fav-input").forEach((inp) => {
    inp.onchange = async () => {
      const cat = cats.find((c) => c.id === Number(inp.dataset.catId));
      cat.isFavorite = inp.checked;
      await put(STORES.CAT, cat);
      toast("Category updated");
    };
  });
}

export async function checkBudgetAlerts() {
  const [txs, cats, budget] = await Promise.all([
    getAll(STORES.TX),
    getCategories("expense"),
    getMonthlyBudget(),
  ]);
  const { monthlyExpense, catSpent } = computeMetrics(txs, cats, budget);
  if (budget > 0 && monthlyExpense > budget) {
    toast(`Monthly budget exceeded by ${formatCurrency(monthlyExpense - budget)}`, "error");
  }
  cats.forEach((cat) => {
    const spent = catSpent[cat.id] || 0;
    const limit = (cat.budgetLimit || 0) + (cat.rollover || 0);
    if (limit > 0 && spent > limit) {
      toast(`${cat.name} over budget`, "error");
    }
  });
}

export async function addCustomCategory(name, type, color, icon, parentId = null, isTaxDeductible = false) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("Category name required");
  const existing = await findCategoryByName(trimmed, type);
  if (existing) throw new Error(`"${trimmed}" already exists`);
  await add(STORES.CAT, {
    name: trimmed, type, color: color || "#64748b", icon: normalizeIcon(icon),
    budgetLimit: 0, isFavorite: false, rollover: 0,
    parentId: parentId ? Number(parentId) : null,
    isTaxDeductible: !!isTaxDeductible,
  });
}

export async function renderCustomCategories(container) {
  const cats = await getAll(STORES.CAT);
  container.innerHTML = cats.map((c) => {
    const parent = c.parentId ? cats.find((p) => p.id === c.parentId) : null;
    const tax = c.isTaxDeductible ? " · tax" : "";
    return `
    <div class="settings-row">
      <span>${c.icon || "📦"} ${escapeHtml(c.name)}${parent ? ` <small>(under ${escapeHtml(parent.name)})</small>` : ""} <small>(${c.type}${tax})</small></span>
      <label class="tax-check" title="Tax deductible"><input type="checkbox" data-id="${c.id}" class="cat-tax-input" ${c.isTaxDeductible ? "checked" : ""}> Tax</label>
      <input type="color" value="${c.color}" data-id="${c.id}" class="cat-color-input">
      <button type="button" class="btn-sm btn-danger del-cat" data-id="${c.id}">✕</button>
    </div>`;
  }).join("");

  container.querySelectorAll(".cat-color-input").forEach((inp) => {
    inp.onchange = async () => {
      const cat = cats.find((c) => c.id === Number(inp.dataset.id));
      cat.color = inp.value;
      await put(STORES.CAT, cat);
    };
  });
  container.querySelectorAll(".cat-tax-input").forEach((inp) => {
    inp.onchange = async () => {
      const cat = cats.find((c) => c.id === Number(inp.dataset.id));
      cat.isTaxDeductible = inp.checked;
      await put(STORES.CAT, cat);
      toast("Category updated");
    };
  });
  container.querySelectorAll(".del-cat").forEach((btn) => {
    btn.onclick = async () => {
      await remove(STORES.CAT, Number(btn.dataset.id));
      await renderCustomCategories(container);
      window.dispatchEvent(new Event("refresh-categories"));
      toast("Category removed");
    };
  });

  const parentSel = document.getElementById("newCatParent");
  if (parentSel) {
    parentSel.innerHTML = `<option value="">No parent (top-level)</option>` +
      cats.filter((c) => c.type === "expense" && !c.parentId).map((c) =>
        `<option value="${c.id}">${escapeHtml(c.name)}</option>`
      ).join("");
  }
}

export async function renderTagsManager(container) {
  const tags = await getAll(STORES.TAG);
  container.innerHTML = tags.length
    ? tags.map((t) => `<span class="tag-chip">${escapeHtml(t.name)} <button type="button" data-id="${t.id}" class="del-tag">✕</button></span>`).join("")
    : `<p class="empty-msg">No tags yet</p>`;

  container.querySelectorAll(".del-tag").forEach((btn) => {
    btn.onclick = async () => {
      await remove(STORES.TAG, Number(btn.dataset.id));
      renderTagsManager(container);
    };
  });
}

export async function addTag(name) {
  if (!name.trim()) return;
  await add(STORES.TAG, { name: name.trim(), color: "#3b82f6" });
}
