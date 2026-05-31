import { initDB, getAll, STORES, getCategories } from "./db.js";
import { todayStr, setDefaultDateTimeFields, formatDisplayDateTime } from "./dates.js";
import { toast, showModal, formatCurrency, setLoading, escapeHtml } from "./ui.js";
import {
  saveTransaction, deleteTransaction, getTransactions,
  computeMetrics, computeDashMetrics, renderHistory, renderRecentActivity, bindHistoryControls,
  populateCategorySelect, fillFormFromTx, fillFormFromLastTx, resetForm, bindSplitControls,
  refreshAllCategorySelects, refreshHistoryCategoryFilter, bindTxCategoryPicker,
  collectSplitData, setEditId, syncTypePills, openAddSheet, closeAddSheet,
  bindMerchantAutoRule, bindReceiptAttach,
  getDashPeriod, setDashPeriod, loadDashPeriod,
} from "./transactions.js";
import { DASH_PERIOD_LABELS } from "./dates.js";
import { renderBudgetPanel, setMonthlyBudget, checkBudgetAlerts, renderCustomCategories, addCustomCategory, renderTagsManager, addTag, refreshCategoryParentSelect } from "./budget.js";
import { renderBillsPanel, addRecurringRule } from "./bills.js";
import { renderDuePanels, bindDueGlobal, bindDueAddPopupUi, migrateDueCleanup } from "./due.js";
import {
  bindNotificationSettings, loadNotificationSettingsForm, renderNotificationSettings,
  requestNotificationPermission, notificationPermission, runNotificationChecks, startNotificationScheduler,
} from "./notifications.js";
import { renderGoalsPanel, addSavingsGoal, addSinkingFund, renderEventsPanel, addEvent, populateEventSelect, renderSplitBillsPanel, addSplitGroup } from "./goals.js";
import {
  renderReports, setReportMonth, setReportRange, populateMonthPicker, buildPDFHtml, printPDFReport,
  exportFilteredCSV, exportFilteredJSON, getReportSnapshot,
  renderReportCategoryFilter, bindReportCategoryFilter,
} from "./reports.js";
import {
  exportJSON, exportCSVFile, importJSONFile, exportEncryptedBackup, importEncryptedBackup,
  handleClearAll, checkBackupReminder, pickBackupFolder, importFromBackupFolder, renderBackupFolderStatus,
} from "./settings.js";
import { openShareReportSheet } from "./share.js";
import { getMonthlyBudget } from "./budget.js";
import { importCSVFile } from "./import.js";
import { renderWalletsPanel, renderDashWallets, addWallet, transferFunds, populateTxFormSelects } from "./wallets.js";
import { renderRulesPanel, addAutoRule } from "./rules.js";
import { initLock, bindLockEvents, setupPin, removePin, renderPinSettings } from "./lock.js";
import { initTheme, toggleTheme, setAppCurrency, renderThemeSettings } from "./theme.js";
import { renderMileagePanel, addMileageEntry, setMileageRate } from "./mileage.js";
import { initAllSectionTabs, activatePane } from "./tabs.js";
import { bindTour, maybeShowTourOnFirstVisit } from "./tour.js";
import {
  registerServiceWorker, finishUpdateOnLaunch, bindUpdateControls,
  renderUpdatePanel, showUpdateBanner,
} from "./update.js";
import { bindTaxCalculator, renderTaxCalculatorPanel } from "./tax-ui.js";
import { renderSpendingCalendar, bindCalendarNav } from "./calendar.js";
import { renderAboutPanel } from "./about.js";
import {
  bindSettingsDrillNav,
  openSettingsHub,
  openSettingsScreen,
  openSettingsScreenFromLegacyPane,
} from "./settings-nav.js";

let deferredPrompt;

function renderDashboard(txs, cats, budget) {
  const period = getDashPeriod();
  const m = computeDashMetrics(txs, cats, budget, period);

  document.getElementById("dashHeroLabel").textContent = m.heroLabel;
  document.getElementById("totalBalance").textContent = formatCurrency(m.heroAmount);
  document.getElementById("totalIncome").textContent = formatCurrency(m.income);
  document.getElementById("totalExpense").textContent = formatCurrency(m.expense);
  document.getElementById("monthNet").textContent = formatCurrency(m.net);

  const extraChip = document.getElementById("dashExtraChip");
  const extraLabel = document.getElementById("dashExtraLabel");
  const extraValue = document.getElementById("leftToSpendDisplay");
  const budgetBarWrap = document.querySelector(".dash-budget-bar");

  if (period === "month" && m.leftToSpend != null) {
    extraLabel.textContent = "Left to spend";
    extraValue.textContent = formatCurrency(m.leftToSpend);
    extraChip?.classList.remove("hidden");
    budgetBarWrap?.classList.remove("hidden");
    const bar = document.getElementById("dashBudgetBar");
    if (bar && budget > 0) {
      const pct = Math.min(100, (m.expense / budget) * 100);
      bar.style.width = `${pct}%`;
      bar.className = `progress-fill${pct >= 100 ? " over" : pct >= 80 ? " warn" : ""}`;
    } else if (bar) {
      bar.style.width = "0%";
      bar.className = "progress-fill";
    }
  } else {
    extraLabel.textContent = "Entries";
    extraValue.textContent = String(m.txCount);
    extraChip?.classList.remove("hidden");
    budgetBarWrap?.classList.add("hidden");
  }

  document.getElementById("recentSectionLabel").textContent =
    period === "all" ? "Recent" : `Recent · ${DASH_PERIOD_LABELS[period]}`;

  document.querySelectorAll("[data-dash-period]").forEach((tab) => {
    const active = tab.dataset.dashPeriod === period;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function bindDashPeriodTabs() {
  document.querySelectorAll("[data-dash-period]").forEach((tab) => {
    tab.addEventListener("click", async () => {
      const period = tab.dataset.dashPeriod;
      if (period === getDashPeriod()) return;
      await setDashPeriod(period);
      await refreshAll();
    });
  });
}

async function refreshAll() {
  setLoading(true);
  try {
    const [txs, cats, budget] = await Promise.all([
      getTransactions(),
      getCategories(),
      getMonthlyBudget(),
    ]);
    renderDashboard(txs, cats, budget);

    if (!txs.length) {
      document.getElementById("emptyDash")?.classList.remove("hidden");
    } else {
      document.getElementById("emptyDash")?.classList.add("hidden");
    }

    await renderRecentActivity(document.getElementById("recentActivity"), 5, getDashPeriod());
    await renderHistory(document.getElementById("historyList"), refreshAll);
    await renderBudgetPanel();
    await renderBillsPanel();
    await renderGoalsPanel();
    await renderEventsPanel();
    await renderSplitBillsPanel();
    await renderReports();
    await renderWalletsPanel();
    await renderDashWallets();
    await renderMileagePanel();
    await checkBudgetAlerts();
    await runNotificationChecks();
    await renderDuePanels();
  } finally {
    setLoading(false);
  }
}

function switchTab(target, btn) {
  if (target !== "settings") openSettingsHub();
  document.querySelectorAll(".view-panel").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach((t) => t.classList.remove("active"));
  document.getElementById(`panel-${target}`)?.classList.add("active");
  if (btn && !btn.classList.contains("nav-add")) btn.classList.add("active");
  else document.querySelector(`[data-tab="${target}"]`)?.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (target === "reports") renderReports();
  if (target === "settings") {
    renderBackupFolderStatus();
    renderThemeSettings();
    renderPinSettings();
    renderRulesPanel();
    renderUpdatePanel();
    loadNotificationSettingsForm();
    renderAboutPanel();
    openSettingsHub();
  }
  if (target === "wallets") renderWalletsPanel();
  if (target === "calendar") renderSpendingCalendar();
  if (target === "mileage") renderMileagePanel();
  if (target === "taxcalc") renderTaxCalculatorPanel();
  if (target === "due") renderDuePanels();
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

function openDayReport() {
  closeMorePopup();
  switchTab("reports");
  activatePane(document.getElementById("panel-reports"), "overview");
  renderReports();
}

function bindNav() {
  document.querySelectorAll(".nav-tab[data-tab]").forEach((btn) => {
    btn.onclick = () => switchTab(btn.dataset.tab, btn);
  });
  document.getElementById("moreToggle")?.addEventListener("click", openMorePopup);
  document.getElementById("settingsBtn")?.addEventListener("click", () => switchTab("settings"));
  document.getElementById("navAdd")?.addEventListener("click", () => {
    resetForm();
    openAddSheet();
  });
  document.getElementById("dueHeaderBtn")?.addEventListener("click", () => switchTab("due"));
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
        time: document.getElementById("txTime").value,
        categoryId: catSel.value,
        merchant: document.getElementById("txMerchant").value,
        paymentMethod: document.getElementById("txPayment").value,
        notes: document.getElementById("txNotes").value,
        tags,
        eventId: document.getElementById("txEvent")?.value,
        walletId: document.getElementById("txWallet")?.value,
        splits: collectSplitData(),
      });
      resetForm();
      closeAddSheet();
      await populateCategorySelect(catSel, typeSel.value);
      await refreshAll();
    } catch (err) {
      if (err.message !== "Cancelled") toast(err.message, "error");
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

  document.getElementById("dupLastBtn")?.addEventListener("click", () => fillFormFromLastTx());

  bindSplitControls();
  bindMerchantAutoRule();
  bindReceiptAttach();
  bindTxCategoryPicker();
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
    activatePane(document.getElementById("panel-bills"), "rules");
    await refreshAll();
  });
  document.getElementById("enableNotifBtn")?.addEventListener("click", async () => {
    switchTab("settings");
    openSettingsScreen("notifications");
    await loadNotificationSettingsForm();
    if (notificationPermission() === "default") await requestNotificationPermission();
    renderNotificationSettings();
  });
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
    document.getElementById("reportFrom").value = "";
    document.getElementById("reportTo").value = "";
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
  document.getElementById("clearReportRange")?.addEventListener("click", () => {
    document.getElementById("reportFrom").value = "";
    document.getElementById("reportTo").value = "";
    const monthSel = document.getElementById("reportMonth");
    if (monthSel?.value) setReportMonth(monthSel.value);
    renderReports();
  });

  document.getElementById("reportShareBtn")?.addEventListener("click", async () => {
    openShareReportSheet(await getReportSnapshot());
  });
  document.getElementById("reportExportCsvBtn")?.addEventListener("click", async () => {
    try {
      const n = await exportFilteredCSV();
      toast(`Exported ${n} transactions`, "success");
    } catch (e) { toast(e.message, "error"); }
  });
  document.getElementById("reportExportJsonBtn")?.addEventListener("click", async () => {
    try {
      const n = await exportFilteredJSON();
      toast(`Exported ${n} transactions`, "success");
    } catch (e) { toast(e.message, "error"); }
  });
  document.getElementById("reportExportPdfBtn")?.addEventListener("click", async () => {
    const snap = await getReportSnapshot();
    printPDFReport("Expense Report", await buildPDFHtml(), { subtitle: snap.periodLabel });
  });

  document.getElementById("exportJsonBtn")?.addEventListener("click", exportJSON);
  document.getElementById("exportCsvBtn")?.addEventListener("click", exportCSVFile);
  document.getElementById("exportPdfBtn")?.addEventListener("click", async () => {
    const snap = await getReportSnapshot();
    printPDFReport("Expense Report", await buildPDFHtml(), { subtitle: snap.periodLabel });
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
  document.getElementById("importCsvInput")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) try { await importCSVFile(file, true); } catch (err) { toast(err.message, "error"); }
    e.target.value = "";
  });
}

function tourActivatePane(panelId, pane) {
  if (panelId === "panel-settings") {
    openSettingsScreenFromLegacyPane(pane);
    return;
  }
  const root = document.getElementById(panelId);
  if (root && pane) activatePane(root, pane);
}

function bindSettings() {
  document.getElementById("clearDataBtn")?.addEventListener("click", handleClearAll);
  document.getElementById("pickBackupFolderBtn")?.addEventListener("click", async () => {
    await pickBackupFolder();
    await renderBackupFolderStatus();
  });
  document.getElementById("restoreFromFolderBtn")?.addEventListener("click", () => importFromBackupFolder(false));
  document.getElementById("addCatBtn")?.addEventListener("click", async () => {
    const name = document.getElementById("newCatName").value;
    const type = document.getElementById("newCatType").value;
    if (!name.trim()) return;
    try {
      await addCustomCategory(
        name, type,
        document.getElementById("newCatColor").value,
        document.getElementById("newCatIcon").value,
        document.getElementById("newCatParent")?.value,
      );
      document.getElementById("newCatName").value = "";
      document.getElementById("newCatIcon").value = "";
      await renderCustomCategories(document.getElementById("categoriesList"));
      await refreshAllCategorySelects();
      await renderReportCategoryFilter();
      await renderRulesPanel();
      toast("Category added", "success");
    } catch (e) {
      toast(e.message, "error");
    }
  });
  document.getElementById("newCatType")?.addEventListener("change", async () => {
    const cats = await getAll(STORES.CAT);
    refreshCategoryParentSelect(cats, document.getElementById("newCatType").value);
  });
  document.getElementById("addTagBtn")?.addEventListener("click", async () => {
    await addTag(document.getElementById("newTagName").value);
    document.getElementById("newTagName").value = "";
    await renderTagsManager(document.getElementById("tagsList"));
  });
  document.getElementById("themeToggleBtn")?.addEventListener("click", async () => {
    await toggleTheme();
    await renderThemeSettings();
  });
  document.getElementById("currencySelect")?.addEventListener("change", async (e) => {
    await setAppCurrency(e.target.value);
    await refreshAll();
  });
  document.getElementById("setPinBtn")?.addEventListener("click", async () => {
    try {
      await setupPin(document.getElementById("newPin").value, document.getElementById("confirmPin").value);
      document.getElementById("newPin").value = "";
      document.getElementById("confirmPin").value = "";
      await renderPinSettings();
      toast("PIN set", "success");
    } catch (e) { toast(e.message, "error"); }
  });
  document.getElementById("removePinBtn")?.addEventListener("click", async () => {
    const pw = prompt("Enter current PIN to remove:");
    if (!pw) return;
    try {
      await removePin(pw);
      await renderPinSettings();
      toast("PIN removed", "success");
    } catch (e) { toast(e.message, "error"); }
  });
  document.getElementById("addRuleBtn")?.addEventListener("click", async () => {
    try {
      await addAutoRule(document.getElementById("rulePattern").value, document.getElementById("ruleCat").value);
      document.getElementById("rulePattern").value = "";
      await renderRulesPanel();
    } catch (e) { toast(e.message, "error"); }
  });

  document.querySelectorAll(".emoji-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById("newCatIcon");
      if (input) input.value = btn.dataset.emoji || btn.textContent.trim();
    });
  });
  bindSettingsDrillNav();
}

function bindWallets() {
  document.getElementById("walletForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await addWallet(
        document.getElementById("walletName").value,
        document.getElementById("walletType").value,
        document.getElementById("walletIcon").value,
      );
      e.target.reset();
      activatePane(document.getElementById("panel-wallets"), "balances");
      await refreshAll();
    } catch (err) { toast(err.message, "error"); }
  });
  document.getElementById("transferForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await transferFunds(
        document.getElementById("transferFrom").value,
        document.getElementById("transferTo").value,
        document.getElementById("transferAmt").value,
      );
      e.target.reset();
      activatePane(document.getElementById("panel-wallets"), "balances");
      await refreshAll();
    } catch (err) { toast(err.message, "error"); }
  });
}

function bindMileage() {
  document.getElementById("mileageDate") && (document.getElementById("mileageDate").value = todayStr());
  document.getElementById("mileageForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await setMileageRate(document.getElementById("mileageRate").value);
    await addMileageEntry(
      document.getElementById("mileageMiles").value,
      document.getElementById("mileagePurpose").value,
      document.getElementById("mileageDate").value,
    );
    e.target.reset();
    document.getElementById("mileageDate").value = todayStr();
    await refreshAll();
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

  registerServiceWorker(() => showUpdateBanner());
  bindUpdateControls();
}

function bindEvents() {
  window.addEventListener("refresh-app", async () => {
    await refreshAllCategorySelects();
    await renderRulesPanel();
    await refreshAll();
  });
  window.addEventListener("refresh-categories", async () => {
    await refreshAllCategorySelects();
    await renderRulesPanel();
  });
  window.addEventListener("refresh-history", () => renderHistory(document.getElementById("historyList"), refreshAll));
  window.addEventListener("report-pane-change", () => renderReports());

  window.addEventListener("edit-tx", (e) => fillFormFromTx(e.detail));
  window.addEventListener("show-tx-detail", (e) => {
    const tx = e.detail;
    showModal("Transaction Details", `
      <p><strong>${escapeHtml(tx.categoryName)}</strong> — ${formatCurrency(tx.amount)}</p>
      <p>Type: ${tx.type} • ${formatDisplayDateTime(tx.date, tx.time)}</p>
      <p>Merchant: ${escapeHtml(tx.merchant || "—")}</p>
      <p>Payment: ${escapeHtml(tx.paymentMethod || "—")}</p>
      <p>Notes: ${escapeHtml(tx.notes || "—")}</p>
      ${tx.tags?.length ? `<p>Tags: ${tx.tags.map(escapeHtml).join(", ")}</p>` : ""}
      ${tx.receiptThumb ? `<p><img src="${tx.receiptThumb}" alt="Receipt" class="receipt-thumb"></p>` : ""}
    `, [{ label: "Close", className: "btn btn-secondary", onClick: () => {} }]);
  });

  document.body.addEventListener("click", (e) => {
    const jump = e.target.closest("[data-tab-jump]");
    if (jump?.dataset.tabJump) {
      e.preventDefault();
      closeMorePopup();
      switchTab(jump.dataset.tabJump);
    }
  });

  document.querySelectorAll(".more-link[data-panel]").forEach((link) => {
    link.addEventListener("click", () => {
      closeMorePopup();
      switchTab(link.dataset.panel);
    });
  });

  window.addEventListener("app-switch-tab", (e) => {
    const tab = e.detail;
    if (typeof tab === "string") switchTab(tab);
  });
}

async function populateSelects() {
  await refreshAllCategorySelects();
  await populateTxFormSelects();
  const txs = await getTransactions();
  populateMonthPicker(document.getElementById("reportMonth"), txs);
  await renderReportCategoryFilter();

  await renderCustomCategories(document.getElementById("categoriesList"));
  await renderTagsManager(document.getElementById("tagsList"));
  await renderBackupFolderStatus();
  await renderRulesPanel();
  await renderUpdatePanel();
}

export async function initApp() {
  document.body.classList.remove("loading");
  document.body.style.overflow = "";

  setDefaultDateTimeFields(document.getElementById("txDate"), document.getElementById("txTime"));
  document.getElementById("recurNext") && (document.getElementById("recurNext").value = todayStr());

  bindNav();
  bindDashPeriodTabs();
  bindPopupCloses();
  bindForm();
  bindBudget();
  bindBills();
  bindGoals();
  bindWallets();
  bindMileage();
  bindReports();
  bindReportCategoryFilter();
  bindSettings();
  bindNotificationSettings();
  bindCalendarNav(() => renderSpendingCalendar(), openDayReport);
  bindPWA();
  bindDueAddPopupUi();
  bindDueGlobal(refreshAll);
  bindEvents();
  bindHistoryControls();
  bindLockEvents();
  initAllSectionTabs();
  bindTaxCalculator();
  document.getElementById("openTaxCalcBtn")?.addEventListener("click", () => switchTab("taxcalc"));
  bindTour({
    switchTab: (t) => switchTab(t),
    openMore: openMorePopup,
    closeMore: closeMorePopup,
    activatePane: tourActivatePane,
  });

  try {
  await initDB();
  await migrateDueCleanup();
  await finishUpdateOnLaunch();
  await initTheme();

  await populateSelects();
  await loadDashPeriod();
  await renderAboutPanel();
  await refreshAll();
  await checkBackupReminder();
  await initLock();
  startNotificationScheduler();
  await loadNotificationSettingsForm();

  maybeShowTourOnFirstVisit({
    switchTab: (t) => switchTab(t),
    openMore: openMorePopup,
    closeMore: closeMorePopup,
    activatePane: tourActivatePane,
  });
  } catch (err) {
    console.error("initApp failed:", err);
    setLoading(false);
    document.body.style.overflow = "";
    toast(err?.message || "App failed to start — try a hard refresh", "error");
  }
}

document.addEventListener("DOMContentLoaded", initApp);
