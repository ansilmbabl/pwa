import { STORES, getAll, add, put, remove, getById, getCategories, formatCategoryLabel } from "./db.js";
import { todayStr, nowTimeStr, formatDisplayDateTime } from "./dates.js";
import { formatCurrency, escapeHtml, toast } from "./ui.js";
import { saveTransaction } from "./transactions.js";

/** UPI intent — Android often offers installed payment apps (amount + note only). */
export function buildGenericUpiPayUri(amount, note) {
  const params = new URLSearchParams();
  params.set("cu", "INR");
  const n = Number(amount);
  if (n > 0) params.set("am", String(Math.round(n * 100) / 100));
  const tn = (note || "Payment").trim().slice(0, 80);
  if (tn) params.set("tn", tn);
  return `upi://pay?${params.toString()}`;
}

function tryOpenUri(uri) {
  if (!uri) return;
  const a = document.createElement("a");
  a.href = uri;
  a.rel = "noopener";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function copyText(text) {
  const t = String(text || "");
  if (!t) return;
  try {
    await navigator.clipboard.writeText(t);
    toast("Copied", "success");
  } catch {
    toast("Could not copy", "error");
  }
}

function displayNotes(d) {
  const n = (d.notes || "").trim();
  if (n) return n;
  return (d.title || "").trim();
}

function sortOpenDues(rows) {
  const open = rows.filter((r) => r.status !== "done");
  return open.sort((a, b) => {
    const ad = a.dueDate || "";
    const bd = b.dueDate || "";
    if (ad && bd && ad !== bd) return ad.localeCompare(bd);
    if (ad && !bd) return -1;
    if (!ad && bd) return 1;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
}

function dueCardHtml(d) {
  const overdue = d.dueDate && d.dueDate < todayStr();
  const dueLine = d.dueDate
    ? `<span class="muted${overdue ? " due-overdue" : ""}">Due ${formatDisplayDateTime(d.dueDate, "")}${overdue ? " · overdue" : ""}</span>`
    : `<span class="muted">No date</span>`;
  const noteBlock = displayNotes(d);
  const noteHtml = noteBlock ? `<div class="due-card-notes">${escapeHtml(noteBlock)}</div>` : "";
  const noteForUri = noteBlock.slice(0, 80) || "Payment";
  const catLine = d.categoryName
    ? `<div class="due-card-cat muted">${escapeHtml(d.categoryName)}</div>`
    : "";

  return `
    <div class="list-card due-card${overdue ? " due-card-overdue" : ""}" data-due-id="${d.id}">
      <div class="due-card-main">
        <div class="due-card-text">
          ${catLine}
          ${noteHtml || `<span class="muted">No notes</span>`}
          <div class="due-card-meta">${dueLine}</div>
        </div>
        <div class="due-card-amt">${formatCurrency(d.amount)}</div>
      </div>
      <div class="due-pay-row">
        <button type="button" class="btn-sm btn-secondary due-pay-apps" data-amt="${d.amount}" data-note-enc="${encodeURIComponent(noteForUri)}">Payment apps</button>
        <button type="button" class="btn-sm btn-ghost due-copy-amt" data-amt="${d.amount}">Copy amount</button>
      </div>
      <div class="due-card-actions">
        <button type="button" class="btn-sm btn-secondary due-done-btn" data-id="${d.id}">Mark paid</button>
        <button type="button" class="btn-sm btn-ghost due-edit-btn" data-id="${d.id}">Edit</button>
        <button type="button" class="btn-sm btn-danger due-del-btn" data-id="${d.id}">Delete</button>
      </div>
    </div>`;
}

function renderListInto(root, all) {
  if (!root) return;
  const openList = root.querySelector("[data-due-open-list]");
  const stat = root.querySelector("[data-due-stat]");
  const open = sortOpenDues(all);
  const sumOpen = open.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  if (stat) {
    stat.textContent = open.length ? `${open.length} pending · ${formatCurrency(sumOpen)}` : "Nothing pending";
  }
  if (openList) {
    openList.innerHTML = open.length
      ? open.map((d) => dueCardHtml(d)).join("")
      : `<p class="empty-msg">No pending items. Tap <strong>+ Add</strong> above.</p>`;
  }
}

export async function renderDueInto(rootEl) {
  const all = await getAll(STORES.DUES);
  renderListInto(rootEl, all);
}

export async function renderDuePanels() {
  await renderDueInto(document.getElementById("dueRootMain"));
  await renderDashDueStrip();
  updateDueHeaderBadge();
}

async function pickDefaultExpenseCategoryId() {
  const cats = await getCategories("expense");
  if (!cats.length) return null;
  const bills = cats.find((c) => c.name.trim().toLowerCase() === "bills");
  return (bills || cats[0]).id;
}

export async function migrateDueCleanup() {
  const all = await getAll(STORES.DUES);
  for (const d of all) {
    if (d.status === "done") await remove(STORES.DUES, d.id);
  }
}

async function renderDashDueStrip() {
  const el = document.getElementById("dashDueStrip");
  if (!el) return;
  const all = await getAll(STORES.DUES);
  const open = sortOpenDues(all);
  const n = open.length;
  const sum = open.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  if (!n) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  el.classList.remove("hidden");
  const overdue = open.filter((d) => d.dueDate && d.dueDate < todayStr()).length;
  el.innerHTML = `
    <button type="button" class="dash-due-strip-btn" data-tab-jump="due">
      <span class="dash-due-strip-title">Due</span>
      <span class="dash-due-strip-detail">${n} pending${overdue ? ` · ${overdue} overdue` : ""} · ${formatCurrency(sum)}</span>
    </button>`;
}

function updateDueHeaderBadge() {
  const badge = document.getElementById("dueHeaderBadge");
  const btn = document.getElementById("dueHeaderBtn");
  if (!badge || !btn) return;
  getAll(STORES.DUES).then((all) => {
    const n = sortOpenDues(all).length;
    badge.textContent = String(n);
    badge.classList.toggle("hidden", n === 0);
    btn.setAttribute("aria-label", n ? `Due payments, ${n} pending` : "Due payments");
  });
}

function getDueAddPopup() {
  return document.getElementById("dueAddPopup");
}

async function populateDueCategorySelect(selectedId) {
  const sel = document.getElementById("dueAddCat");
  if (!sel) return;
  const cats = await getCategories("expense");
  sel.innerHTML = cats
    .map(
      (c) =>
        `<option value="${c.id}">${escapeHtml(formatCategoryLabel(c, cats))}</option>`,
    )
    .join("");
  if (selectedId != null && String(selectedId) !== "") {
    sel.value = String(selectedId);
  }
}

export async function openDueAddPopup(opts = {}) {
  const popup = getDueAddPopup();
  if (!popup) return;
  const form = document.getElementById("dueAddForm");
  const titleEl = document.getElementById("dueAddTitle");
  const submitBtn = form?.querySelector("[type=submit]");

  if (opts.editId != null) {
    const d = await getById(STORES.DUES, Number(opts.editId));
    if (!d || d.status === "done") return;
    await populateDueCategorySelect(d.categoryId);
    if (titleEl) titleEl.textContent = "Edit due";
    if (form) {
      form.dataset.editId = String(opts.editId);
      const amt = form.querySelector("[name=dueAmount]");
      const dt = form.querySelector("[name=dueDate]");
      const nt = form.querySelector("[name=dueNotes]");
      const cat = form.querySelector("[name=dueCategoryId]");
      if (amt) amt.value = d.amount;
      if (dt) dt.value = d.dueDate || "";
      if (nt) nt.value = displayNotes(d);
      if (cat && d.categoryId) cat.value = String(d.categoryId);
    }
    if (submitBtn) submitBtn.textContent = "Save";
  } else {
    if (form) delete form.dataset.editId;
    await populateDueCategorySelect();
    form?.reset();
    if (titleEl) titleEl.textContent = "Add due";
    if (submitBtn) submitBtn.textContent = "Save";
  }

  popup.classList.add("open");
  popup.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

export function closeDueAddPopup() {
  const popup = getDueAddPopup();
  if (!popup) return;
  popup.classList.remove("open");
  popup.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

let dueAddPopupUiBound = false;

export function bindDueAddPopupUi() {
  if (dueAddPopupUiBound) return;
  dueAddPopupUiBound = true;
  const popup = getDueAddPopup();
  document.getElementById("duePanelAddBtn")?.addEventListener("click", () => openDueAddPopup());
  document.getElementById("dueAddPopupClose")?.addEventListener("click", closeDueAddPopup);
  popup?.addEventListener("click", (e) => {
    if (e.target === popup) closeDueAddPopup();
  });
}

export async function addDueFromForm(form) {
  const amount = Number(form.querySelector("[name=dueAmount]")?.value);
  const notes = form.querySelector("[name=dueNotes]")?.value?.trim() || "";
  const categoryId = Number(form.querySelector("[name=dueCategoryId]")?.value);
  if (!amount || amount <= 0) throw new Error("Enter a valid amount");
  if (!categoryId) throw new Error("Choose a category");
  const cats = await getCategories("expense");
  const cat = cats.find((c) => c.id === categoryId);
  const categoryName = cat ? formatCategoryLabel(cat, cats) : "";
  await add(STORES.DUES, {
    amount,
    dueDate: form.querySelector("[name=dueDate]")?.value || "",
    notes,
    categoryId,
    categoryName,
    title: "",
    payee: "",
    upiVpa: "",
    paymentUrl: "",
    recurringId: null,
    status: "open",
    completedAt: "",
    createdAt: new Date().toISOString(),
  });
}

export async function addDueFromRecurringRule(rule) {
  if (!rule?.id) return;
  const cats = await getCategories("expense");
  const cid = Number(rule.categoryId);
  const cat = cats.find((c) => c.id === cid);
  const categoryName = cat ? formatCategoryLabel(cat, cats) : "";
  const label = (rule.merchant || rule.notes || "Bill").trim() || "Bill payment";
  await add(STORES.DUES, {
    amount: Number(rule.amount) || 0,
    dueDate: rule.nextDate || "",
    notes: `${label} — from recurring (${rule.frequency || "monthly"})`,
    categoryId: cid || null,
    categoryName,
    title: "",
    payee: "",
    upiVpa: "",
    paymentUrl: "",
    recurringId: rule.id,
    status: "open",
    completedAt: "",
    createdAt: new Date().toISOString(),
  });
  toast("Added to Due list", "success");
}

export async function markDuePaidAndLogExpense(id) {
  const d = await getById(STORES.DUES, Number(id));
  if (!d) return;
  let catId = Number(d.categoryId);
  if (!Number.isFinite(catId) || catId <= 0) catId = await pickDefaultExpenseCategoryId();
  if (!catId) {
    toast("Add an expense category first", "error");
    return;
  }
  const txDate = !d.dueDate || d.dueDate > todayStr() ? todayStr() : d.dueDate;
  const rawNotes = displayNotes(d);
  const merchant = rawNotes ? rawNotes.split("\n")[0].trim().slice(0, 120) : "Due payment";
  const notesBody = rawNotes || "From Due list";

  await saveTransaction(
    {
      amount: d.amount,
      type: "expense",
      date: txDate,
      time: nowTimeStr(),
      categoryId: catId,
      merchant,
      paymentMethod: "UPI",
      notes: notesBody,
      tags: [],
      eventId: null,
      walletId: null,
    },
    true,
    { quiet: true },
  );
  await remove(STORES.DUES, Number(id));
  toast("Expense saved — see History", "success");
}

export async function deleteDue(id) {
  await remove(STORES.DUES, Number(id));
  toast("Removed", "success");
}

async function saveDueEdit(id, form) {
  const d = await getById(STORES.DUES, Number(id));
  if (!d) return;
  const amount = Number(form.querySelector("[name=dueAmount]")?.value);
  const notes = form.querySelector("[name=dueNotes]")?.value?.trim() || "";
  const categoryId = Number(form.querySelector("[name=dueCategoryId]")?.value);
  if (!amount || amount <= 0) throw new Error("Enter a valid amount");
  if (!categoryId) throw new Error("Choose a category");
  const cats = await getCategories("expense");
  const cat = cats.find((c) => c.id === categoryId);
  const categoryName = cat ? formatCategoryLabel(cat, cats) : "";
  await put(STORES.DUES, {
    ...d,
    amount,
    dueDate: form.querySelector("[name=dueDate]")?.value || "",
    notes,
    categoryId,
    categoryName,
  });
  toast("Saved", "success");
}

let dueDelegatedBound = false;

export function bindDueGlobal(refreshAll) {
  const form = document.getElementById("dueAddForm");
  if (form && !form.dataset.dueBound) {
    form.dataset.dueBound = "1";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const editId = form.dataset.editId;
        if (editId) {
          await saveDueEdit(editId, form);
          delete form.dataset.editId;
        } else {
          await addDueFromForm(form);
          toast("Added to Due list", "success");
        }
        form.reset();
        const submitBtn = form.querySelector("[type=submit]");
        if (submitBtn) submitBtn.textContent = "Save";
        const titleEl = document.getElementById("dueAddTitle");
        if (titleEl) titleEl.textContent = "Add due";
        closeDueAddPopup();
        await refreshAll();
      } catch (err) {
        toast(err.message || "Failed", "error");
      }
    });
    form.querySelector(".due-cancel-edit")?.addEventListener("click", () => {
      delete form.dataset.editId;
      form.reset();
      const submitBtn = form.querySelector("[type=submit]");
      if (submitBtn) submitBtn.textContent = "Save";
      const titleEl = document.getElementById("dueAddTitle");
      if (titleEl) titleEl.textContent = "Add due";
      closeDueAddPopup();
    });
  }

  if (dueDelegatedBound) return;
  dueDelegatedBound = true;

  document.body.addEventListener("click", async (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const payApps = t.closest(".due-pay-apps");
    if (payApps != null) {
      const amt = payApps.dataset.amt;
      let note = "Payment";
      try {
        note = decodeURIComponent(payApps.dataset.noteEnc || "") || "Payment";
      } catch {
        /* ignore */
      }
      tryOpenUri(buildGenericUpiPayUri(amt, note));
      return;
    }

    const amtBtn = t.closest(".due-copy-amt");
    if (amtBtn?.dataset.amt != null) {
      await copyText(String(amtBtn.dataset.amt));
      return;
    }

    const doneBtn = t.closest(".due-done-btn");
    if (doneBtn?.dataset.id) {
      if (!confirm("Mark as paid? This saves an expense to History and removes this Due item.")) return;
      await markDuePaidAndLogExpense(doneBtn.dataset.id);
      await refreshAll();
      return;
    }

    const delBtn = t.closest(".due-del-btn");
    if (delBtn?.dataset.id) {
      if (!confirm("Remove this Due item?")) return;
      await deleteDue(delBtn.dataset.id);
      await refreshAll();
      return;
    }

    const editBtn = t.closest(".due-edit-btn");
    if (editBtn?.dataset.id) {
      await openDueAddPopup({ editId: editBtn.dataset.id });
      return;
    }
  });
}
