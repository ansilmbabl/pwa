import { STORES, getAll, add, remove, getCategories } from "./db.js";
import { escapeHtml, toast, categoryOptionLabel } from "./ui.js";

export async function applyAutoRules(merchant, type) {
  if (!merchant?.trim()) return null;
  const rules = await getAll(STORES.AUTO_RULES);
  const m = merchant.toLowerCase();
  const match = rules.find((r) => r.enabled !== false && r.type === type && m.includes(r.pattern.toLowerCase()));
  return match ? Number(match.categoryId) : null;
}

export async function renderRulesPanel() {
  const el = document.getElementById("autoRulesList");
  if (!el) return;
  const [rules, cats] = await Promise.all([getAll(STORES.AUTO_RULES), getAll(STORES.CAT)]);
  el.innerHTML = rules.length ? rules.map((r) => {
    const cat = cats.find((c) => c.id === r.categoryId);
    return `<div class="list-card">
      <span>"${escapeHtml(r.pattern)}" → ${escapeHtml(cat?.name || "?")}</span>
      <button type="button" class="btn-sm btn-danger del-rule" data-id="${r.id}">✕</button>
    </div>`;
  }).join("") : `<p class="empty-msg">No rules — add one below</p>`;

  el.querySelectorAll(".del-rule").forEach((btn) => {
    btn.onclick = async () => {
      await remove(STORES.AUTO_RULES, Number(btn.dataset.id));
      renderRulesPanel();
    };
  });

  const sel = document.getElementById("ruleCat");
  if (sel) {
    const expenseCats = await getCategories("expense");
    sel.innerHTML = expenseCats.map((c) =>
      `<option value="${c.id}">${categoryOptionLabel(c)}</option>`,
    ).join("");
  }
}

export async function addAutoRule(pattern, categoryId, type = "expense") {
  if (!pattern.trim()) throw new Error("Pattern required");
  await add(STORES.AUTO_RULES, { pattern: pattern.trim(), categoryId: Number(categoryId), type, enabled: true });
  toast("Rule added", "success");
}
