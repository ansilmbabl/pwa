import { initDB, getAll, STORES, getCategories } from "./db.js";
import { todayStr } from "./dates.js";
import { toast, showModal, formatCurrency, setLoading, escapeHtml } from "./ui.js";
import {
  saveTransaction, deleteTransaction, duplicateLastTransaction, getTransactions,
  computeMetrics, renderHistory, renderRecentActivity, bindHistoryControls,
  populateCategorySelect, fillFormFromTx, resetForm, bindSplitControls,
  collectSplitData, setEditId, syncTypePills, openAddSheet, closeAddSheet,
} from "./transactions.js";
import { renderBudgetPanel, setMonthlyBudget, checkBudgetAlerts, renderCustomCategories, addCustomCategory, renderTagsManager, addTag } from "./budget.js";
import { renderBillsPanel, addRecurringRule, requestNotificationPermission, checkBillReminders } from "./bills.js";
import { renderGoalsPanel, addSavingsGoal, addSinkingFund, renderEventsPanel, addEvent, populateEventSelect, renderSplitBillsPanel, addSplitGroup } from "./goals.js";
import { renderReports, setReportMonth, setReportRange, populateMonthPicker, buildPDFHtml, printPDFReport } from "./reports.js";
import { exportJSON, exportCSVFile, importJSONFile, exportEncryptedBackup, importEncryptedBackup, handleClearAll, checkBackupReminder } from "./settings.js";
import { getMonthlyBudget } from "./budget.js";

let deferredPrompt;

async function refreshAll() {
  setLoading(true);
  try {
    const [txs, cats, budget] = await Promise.all([
      getTransactions(),
      getCategories(),
      getMonthlyBudget(),
    ]);
    const m = computeMetrics(txs, cats, budget);

    document.getElementById("totalBalance").textContent = formatCurrency(m.totalBalance);
    document.getElementById("monthNet").textContent = formatCurrency(m.monthNet);
    document.getElementById("totalIncome").textContent = formatCurrency(m.monthlyIncome);
    document.getElementById("totalExpense").textContent = formatCurrency(m.monthlyExpense);
    document.getElementById("leftToSpendDisplay")?.textContent && (document.getElementById("leftToSpendDisplay").textContent = formatCurrency(m.leftToSpend));

    const bar = document.getElementById("dashBudgetBar");
    if (bar && budget > 0) {
      const pct = Math.min(100, (m.monthlyExpense / budget) * 100);
      bar.style.width = `${pct}%`;
      bar.className = `progress-fill${pct >= 100 ? " over" : ""}`;
    }

    if (!txs.length) {
      document.getElementById("emptyDash")?.classList.remove("hidden");
    } else {
      document.getElementById("emptyDash")?.classList.add("hidden");
    }

    await renderRecentActivity(document.getElementById("recentActivity"), 5);
    await renderHistory(document.getElementById("historyList"), refreshAll);
    await renderBudgetPanel();
    await renderBillsPanel();
    await renderGoalsPanel();
    await renderEventsPanel();
    await renderSplitBillsPanel();
    await renderReports();
    await checkBudgetAlerts();
  } finally {
    setLoading(false);
  }
}

function switchTab(target, btn) {
  document.querySelectorAll(".view-panel").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach((t) => t.classList.remove("active"));
  document.getElementById(`panel-${target}`)?.classList.add("active");
  if (btn) btn.classList.add("active");
  else document.querySelector(`[data-tab="${target}"]`)?.classList.add("active");
  if (target === "reports") renderReports();
}

function openMorePopup() {
  const popup = document.getElementById("morePopup");
  popup?.classList.add("open");
  popup?.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeMorePopup() {
  const popup = document.getElementById("morePopup");
  popup?.classList.remove("open");
  popup?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function bindPopupCloses() {
  document.getElementById("txPopupClose")?.addEventListener("click", () => {
    resetForm();
    closeAddSheet();
  });
  document.getElementById("txPopup")?.addEventListener("click", (e) => {
    if (e.target.id === "txPopup") {
      resetForm();
      closeAddSheet();
    }
  });
  document.getElementById("morePopupClose")?.addEventListener("click", closeMorePopup);
  document.getElementById("morePopup")?.addEventListener("click", (e) => {
    if (e.target.id === "morePopup") closeMorePopup();
  });
  document.getElementById("openTxBtn")?.addEventListener("click", () => {
    resetForm();
    openAddSheet();
  });
}

function bindNav() {
  document.querySelectorAll(".nav-tab[data-tab]").forEach((btn) => {
    btn.onclick = () => switchTab(btn.dataset.tab, btn);
  });
  document.getElementById("moreToggle")?.addEventListener("click", openMorePopup);
  document.getElementById("refreshBtn")?.addEventListener("click", refreshAll);
}

function bindForm() {
  const form = document.getElementById("txForm");
  const typeSel = document.getElementById("txType");
  const catSel = document.getElementById("txCat");

  document.querySelectorAll(".type-pill").forEach((pill) => {
    pill.addEventListener("click", async () => {
      syncTypePills(pill.dataset.type);
      await populateCategorySelect(catSel, pill.dataset.type);
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const tags = document.getElementById("txTags").value.split(",").map((t) => t.trim()).filter(Boolean);
      await saveTransaction({
        amount: document.getElementById("txAmt").value,
        type: typeSel.value,
        date: document.getElementById("txDate").value,
        categoryId: catSel.value,
        merchant: document.getElementById("txMerchant").value,
        paymentMethod: document.getElementById("txPayment").value,
        notes: document.getElementById("txNotes").value,
        tags,
        eventId: document.getElementById("txEvent")?.value,
        splits: collectSplitData(),
      });
      resetForm();
      closeAddSheet();
      await populateCategorySelect(catSel, typeSel.value);
      await refreshAll();
    } catch (err) {
      toast(err.message, "error");
    }
  });

  document.getElementById("txCancelBtn")?.addEventListener("click", async () => {
    resetForm();
    closeAddSheet();
    await populateCategorySelect(catSel, typeSel.value);
  });

  document.querySelectorAll(".quick-amt").forEach((btn) => {
    btn.onclick = () => { document.getElementById("txAmt").value = btn.dataset.amt; };
  });

  document.getElementById("dupLastBtn")?.addEventListener("click", async () => {
    await duplicateLastTransaction();
    await refreshAll();
  });

  bindSplitControls();
}

function bindBudget() {
  document.getElementById("saveBudgetBtn")?.addEventListener("click", async () => {
    await setMonthlyBudget(document.getElementById("monthlyBudgetInput").value);
    toast("Budget saved", "success");
    await refreshAll();
  });
}

function bindBills() {
  document.getElementById("recurForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await addRecurringRule({
      amount: document.getElementById("recurAmt").value,
      type: "expense",
      categoryId: document.getElementById("recurCat").value,
      merchant: document.getElementById("recurMerchant").value,
      frequency: document.getElementById("recurFreq").value,
      nextDate: document.getElementById("recurNext").value,
      isSubscription: document.getElementById("recurSub").checked,
      notes: document.getElementById("recurNotes").value,
    });
    e.target.reset();
    document.getElementById("recurNext").value = todayStr();
    await refreshAll();
  });
  document.getElementById("enableNotifBtn")?.addEventListener("click", requestNotificationPermission);
}

function bindGoals() {
  document.getElementById("goalForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await addSavingsGoal(
      document.getElementById("goalName").value,
      document.getElementById("goalTarget").value,
      document.getElementById("goalDeadline").value,
    );
    e.target.reset();
    await refreshAll();
  });
  document.getElementById("fundForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await addSinkingFund(document.getElementById("fundName").value, document.getElementById("fundTarget").value);
    e.target.reset();
    await refreshAll();
  });
  document.getElementById("eventForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await addEvent(
      document.getElementById("eventName").value,
      document.getElementById("eventStart").value,
      document.getElementById("eventEnd").value,
      document.getElementById("eventBudget").value,
    );
    e.target.reset();
    await populateEventSelect(document.getElementById("txEvent"));
    await refreshAll();
  });
  document.getElementById("splitForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await addSplitGroup(
      document.getElementById("splitName").value,
      document.getElementById("splitMembers").value,
    );
    e.target.reset();
    await refreshAll();
  });
}

function bindReports() {
  document.getElementById("reportMonth")?.addEventListener("change", (e) => {
    setReportMonth(e.target.value);
    renderReports();
  });
  document.getElementById("reportFrom")?.addEventListener("change", () => {
    setReportRange(document.getElementById("reportFrom").value, document.getElementById("reportTo").value);
    renderReports();
  });
  document.getElementById("reportTo")?.addEventListener("change", () => {
    setReportRange(document.getElementById("reportFrom").value, document.getElementById("reportTo").value);
    renderReports();
  });
  document.getElementById("exportJsonBtn")?.addEventListener("click", exportJSON);
  document.getElementById("exportCsvBtn")?.addEventListener("click", exportCSVFile);
  document.getElementById("exportPdfBtn")?.addEventListener("click", async () => {
    printPDFReport("Ledger Core Report", await buildPDFHtml());
  });
  document.getElementById("exportEncBtn")?.addEventListener("click", async () => {
    const pw = prompt("Encryption password:");
    if (pw) try { await exportEncryptedBackup(pw); } catch (e) { toast(e.message, "error"); }
  });
  document.getElementById("importJsonInput")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) try { await importJSONFile(file, true); } catch (err) { toast(err.message, "error"); }
    e.target.value = "";
  });
  document.getElementById("importEncInput")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    const pw = prompt("Decryption password:");
    if (file && pw) try { await importEncryptedBackup(file, pw); } catch (err) { toast(err.message, "error"); }
    e.target.value = "";
  });
}

function bindSettings() {
  document.getElementById("clearDataBtn")?.addEventListener("click", handleClearAll);
  document.getElementById("addCatBtn")?.addEventListener("click", async () => {
    const name = document.getElementById("newCatName").value;
    const type = document.getElementById("newCatType").value;
    if (!name) return;
    await addCustomCategory(name, type, document.getElementById("newCatColor").value, document.getElementById("newCatIcon").value);
    document.getElementById("newCatName").value = "";
    await renderCustomCategories(document.getElementById("categoriesList"));
    toast("Category added", "success");
  });
  document.getElementById("addTagBtn")?.addEventListener("click", async () => {
    await addTag(document.getElementById("newTagName").value);
    document.getElementById("newTagName").value = "";
    await renderTagsManager(document.getElementById("tagsList"));
  });
}

function bindPWA() {
  const pwaBtn = document.getElementById("pwaBtn");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaBtn) pwaBtn.style.display = "block";
  });
  pwaBtn?.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted" && pwaBtn) pwaBtn.style.display = "none";
    deferredPrompt = null;
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        nw?.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            toast("Update available — refresh the app", "info");
          }
        });
      });
    });
  }
}

function bindEvents() {
  window.addEventListener("refresh-app", refreshAll);
  window.addEventListener("refresh-history", () => renderHistory(document.getElementById("historyList"), refreshAll));

  window.addEventListener("edit-tx", (e) => fillFormFromTx(e.detail));
  window.addEventListener("show-tx-detail", (e) => {
    const tx = e.detail;
    showModal("Transaction Details", `
      <p><strong>${escapeHtml(tx.categoryName)}</strong> — ${formatCurrency(tx.amount)}</p>
      <p>Type: ${tx.type} • Date: ${tx.date}</p>
      <p>Merchant: ${escapeHtml(tx.merchant || "—")}</p>
      <p>Payment: ${escapeHtml(tx.paymentMethod || "—")}</p>
      <p>Notes: ${escapeHtml(tx.notes || "—")}</p>
      ${tx.tags?.length ? `<p>Tags: ${tx.tags.map(escapeHtml).join(", ")}</p>` : ""}
    `, [{ label: "Close", className: "btn btn-secondary", onClick: () => {} }]);
  });

  document.getElementById("fabAdd")?.addEventListener("click", () => {
    switchTab("dash");
    resetForm();
    openAddSheet();
  });

  document.querySelectorAll(".more-link").forEach((link) => {
    link.addEventListener("click", () => {
      closeMorePopup();
      switchTab(link.dataset.panel);
    });
  });
}

async function populateSelects() {
  await populateCategorySelect(document.getElementById("txCat"), "expense");
  await populateCategorySelect(document.getElementById("recurCat"), "expense");
  await populateEventSelect(document.getElementById("txEvent"));
  const txs = await getTransactions();
  populateMonthPicker(document.getElementById("reportMonth"), txs);

  const cats = await getAll(STORES.CAT);
  const histCat = document.getElementById("historyCatFilter");
  if (histCat) {
    histCat.innerHTML = `<option value="">All categories</option>` +
      cats.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  }

  await renderCustomCategories(document.getElementById("categoriesList"));
  await renderTagsManager(document.getElementById("tagsList"));
}

export async function initApp() {
  await initDB();
  document.getElementById("txDate").value = todayStr();
  document.getElementById("recurNext") && (document.getElementById("recurNext").value = todayStr());

  bindNav();
  bindPopupCloses();
  bindForm();
  bindBudget();
  bindBills();
  bindGoals();
  bindReports();
  bindSettings();
  bindPWA();
  bindEvents();
  bindHistoryControls();

  await populateSelects();
  await refreshAll();
  await checkBillReminders();
  await checkBackupReminder();
}

document.addEventListener("DOMContentLoaded", initApp);
