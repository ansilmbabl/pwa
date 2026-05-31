import { formatCurrency, escapeHtml, toast } from "./ui.js";
import { formatDisplayDateTime } from "./dates.js";
import { EXPORT_APP_NAME, EXPORT_TAGLINE } from "./export-brand.js";
import {
  buildReportShareImageBlob, shareImageBlob, downloadImageBlob, imageFilenameForPeriod,
} from "./share-image.js";

const SHARE_DEFAULTS = { format: "summary", includeTx: true, txLimit: 10 };

export async function shareContent(title, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch (e) {
      if (e.name === "AbortError") return false;
    }
  }
  return copyShareText(text);
}

export async function copyShareText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard", "success");
    return true;
  } catch {
    toast("Copy failed on this device", "error");
    return false;
  }
}

async function shareTextWithFallback(title, text, filename) {
  if (navigator.share) {
    try {
      if (navigator.canShare) {
        const file = new File([text], filename, { type: "text/plain" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title, text: text.slice(0, 500), files: [file] });
          return true;
        }
      }
      await navigator.share({ title, text });
      return true;
    } catch (e) {
      if (e.name === "AbortError") return false;
    }
  }
  return copyShareText(text);
}

function formatDiff(amount) {
  const sign = amount >= 0 ? "+" : "−";
  return `${sign}${formatCurrency(Math.abs(amount)).slice(1)}`;
}

export function formatReportShare(snap, options = {}) {
  const opts = { ...SHARE_DEFAULTS, ...options };
  const lines = [];
  const divider = "────────────────────────";

  lines.push(`📊 ${EXPORT_APP_NAME}`);
  lines.push(`Expense report · ${snap.periodLabel}`);
  lines.push(divider, "");

  lines.push("💰 Summary");
  lines.push(`   Income     ${formatCurrency(snap.income)}`);
  lines.push(`   Expenses   ${formatCurrency(snap.expense)}`);
  lines.push(`   Net        ${formatCurrency(snap.net)}`);
  if (snap.txCount != null) lines.push(`   Entries    ${snap.txCount}`);

  if (snap.comparison) {
    const { previousLabel, previousExpense, expenseDiff } = snap.comparison;
    lines.push("");
    lines.push(`📈 vs ${previousLabel}`);
    lines.push(`   Last month  ${formatCurrency(previousExpense)}`);
    lines.push(`   Change      ${formatDiff(expenseDiff)}`);
  }

  if (snap.categories?.length) {
    lines.push("", "📁 Top categories");
    const limit = opts.format === "summary" ? 5 : 8;
    snap.categories.slice(0, limit).forEach((c, i) => {
      const icon = c.icon ? `${c.icon} ` : "";
      lines.push(`   ${i + 1}. ${icon}${c.name} — ${formatCurrency(c.amount)} (${c.pct}%)`);
    });
  }

  const showTx = opts.includeTx && snap.transactions?.length;
  if (showTx) {
    const limit = opts.format === "summary" ? Math.min(5, opts.txLimit) : opts.txLimit;
    lines.push("", `📝 Transactions (${Math.min(limit, snap.transactions.length)} of ${snap.transactions.length})`);
    snap.transactions.slice(0, limit).forEach((t) => {
      const sign = t.type === "income" ? "+" : "−";
      const merchant = t.merchant ? ` @ ${t.merchant}` : "";
      lines.push(`   • ${formatDisplayDateTime(t.date, t.time)}  ${sign}${formatCurrency(t.amount).slice(1)}  ${t.categoryName}${merchant}`);
    });
    if (snap.transactions.length > limit) {
      lines.push(`   … ${snap.transactions.length - limit} more not shown`);
    }
  }

  lines.push("", divider);
  lines.push(`Generated ${new Date().toLocaleString("en-IN")}`);
  lines.push(`${EXPORT_APP_NAME} · ${EXPORT_TAGLINE}`);
  return lines.join("\n");
}

export function buildShareReportPreviewHtml(snap, options = {}) {
  const opts = { ...SHARE_DEFAULTS, ...options };
  const netClass = snap.net >= 0 ? "income-label" : "expense-label";

  let html = `
    <div class="share-preview-stats grid-2">
      <div class="stat-box"><span class="income-label">Income</span><strong>${formatCurrency(snap.income)}</strong></div>
      <div class="stat-box"><span class="expense-label">Expenses</span><strong>${formatCurrency(snap.expense)}</strong></div>
    </div>
    <p class="share-preview-net">Net: <strong class="${netClass}">${formatCurrency(snap.net)}</strong></p>`;

  if (snap.comparison) {
    const { previousLabel, previousExpense, expenseDiff } = snap.comparison;
    const diffClass = expenseDiff > 0 ? "expense-label" : "income-label";
    html += `<p class="muted share-preview-compare">vs ${escapeHtml(previousLabel)}: ${formatCurrency(previousExpense)} · <span class="${diffClass}">${formatDiff(expenseDiff)}</span></p>`;
  }

  if (snap.categories?.length) {
    const limit = opts.format === "summary" ? 5 : 8;
    html += `<div class="share-preview-cats">`;
    snap.categories.slice(0, limit).forEach((c) => {
      html += `<div class="share-cat-row"><span>${escapeHtml(c.icon || "")} ${escapeHtml(c.name)}</span><span>${formatCurrency(c.amount)} <small class="muted">${c.pct}%</small></span></div>`;
    });
    html += `</div>`;
  }

  if (opts.includeTx && snap.transactions?.length) {
    const limit = opts.format === "summary" ? Math.min(5, opts.txLimit) : opts.txLimit;
    html += `<div class="share-preview-tx">`;
    snap.transactions.slice(0, limit).forEach((t) => {
      const sign = t.type === "income" ? "+" : "−";
      const cls = t.type === "income" ? "income-label" : "expense-label";
      html += `<div class="share-tx-row"><span class="muted">${escapeHtml(formatDisplayDateTime(t.date, t.time))}</span><span class="${cls}">${sign}${formatCurrency(t.amount).slice(1)}</span><span>${escapeHtml(t.categoryName)}</span></div>`;
    });
    if (snap.transactions.length > limit) {
      html += `<p class="muted hint">+ ${snap.transactions.length - limit} more entries in shared text</p>`;
    }
    html += `</div>`;
  }

  if (!snap.txCount) {
    html = `<p class="empty-msg">No transactions in this period. Adjust the date filter and try again.</p>`;
  }

  return html;
}

function readShareOptions(root) {
  const format = root.querySelector('input[name="shareFmt"]:checked')?.value || "summary";
  return {
    format,
    includeTx: root.querySelector("#shareIncludeTx")?.checked ?? true,
    txLimit: Number(root.querySelector("#shareTxLimit")?.value) || 10,
  };
}

function updateSharePreview(root, snap) {
  const preview = root.querySelector("#shareReportPreview");
  if (!preview) return;
  preview.innerHTML = buildShareReportPreviewHtml(snap, readShareOptions(root));
}

export function openShareReportSheet(snap) {
  const existing = document.getElementById("shareReportSheet");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "shareReportSheet";
  overlay.className = "popup-overlay open";
  overlay.setAttribute("aria-hidden", "false");
  overlay.innerHTML = `
    <div class="popup share-sheet" role="dialog" aria-labelledby="shareReportTitle">
      <div class="popup-head">
        <h4 id="shareReportTitle">Share report</h4>
        <button type="button" class="icon-btn share-sheet-close" aria-label="Close">✕</button>
      </div>
      <div class="popup-body">
        <p class="muted share-period">${escapeHtml(snap.periodLabel)}${snap.txCount ? ` · ${snap.txCount} entries` : ""}</p>
        <div id="shareReportPreview" class="share-preview"></div>
        <div class="share-options">
          <p class="section-label">Format</p>
          <div class="radio-chips share-fmt-chips">
            <label class="radio-chip"><input type="radio" name="shareFmt" value="summary" checked> Summary</label>
            <label class="radio-chip"><input type="radio" name="shareFmt" value="full"> Detailed</label>
          </div>
          <label class="field-block notif-toggle"><input type="checkbox" id="shareIncludeTx" checked> Include transactions</label>
          <label class="field-block share-tx-limit">Show <select id="shareTxLimit"><option value="5">5</option><option value="10" selected>10</option><option value="15">15</option><option value="25">25</option></select> entries</label>
        </div>
        <pre id="shareTextPreview" class="share-text-preview" aria-label="Share text preview"></pre>
      </div>
      <div class="popup-actions share-sheet-actions share-sheet-actions-grid">
        <button type="button" id="shareReportGo" class="btn">Share text</button>
        <button type="button" id="shareReportImage" class="btn btn-secondary">Share image</button>
        <button type="button" id="shareReportCopy" class="btn btn-ghost">Copy text</button>
        <button type="button" id="shareReportSaveImage" class="btn btn-ghost">Save image</button>
      </div>
    </div>`;

  const close = () => {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    overlay.remove();
  };

  const refresh = () => {
    updateSharePreview(overlay, snap);
    const text = formatReportShare(snap, readShareOptions(overlay));
    const pre = overlay.querySelector("#shareTextPreview");
    if (pre) pre.textContent = text;
  };

  overlay.querySelector(".share-sheet-close")?.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  overlay.querySelectorAll('input[name="shareFmt"], #shareIncludeTx, #shareTxLimit').forEach((el) => {
    el.addEventListener("change", refresh);
  });

  overlay.querySelector("#shareReportCopy")?.addEventListener("click", async () => {
    const text = formatReportShare(snap, readShareOptions(overlay));
    await copyShareText(text);
  });

  overlay.querySelector("#shareReportGo")?.addEventListener("click", async () => {
    const text = formatReportShare(snap, readShareOptions(overlay));
    const ok = await shareTextWithFallback(
      `${EXPORT_APP_NAME} — ${snap.periodLabel}`,
      text,
      `ledger-report-${snap.periodLabel.replace(/\s+/g, "-")}.txt`,
    );
    if (ok) close();
  });

  const runImageShare = async (mode) => {
    const imageBtn = overlay.querySelector("#shareReportImage");
    const saveBtn = overlay.querySelector("#shareReportSaveImage");
    imageBtn && (imageBtn.disabled = true);
    saveBtn && (saveBtn.disabled = true);
    const prevLabel = imageBtn?.textContent;
    if (imageBtn) imageBtn.textContent = "Creating…";
    try {
      const opts = readShareOptions(overlay);
      const blob = await buildReportShareImageBlob(snap, opts);
      const filename = imageFilenameForPeriod(snap.periodLabel);
      if (mode === "save") {
        downloadImageBlob(blob, filename);
        toast("Image saved", "success");
      } else {
        const result = await shareImageBlob(blob, filename, `${EXPORT_APP_NAME} — ${snap.periodLabel}`);
        if (result === "shared") {
          toast("Image shared", "success");
          close();
        } else if (result === "downloaded") {
          toast("Image saved — share from gallery if needed", "success");
        }
      }
    } catch (e) {
      toast(e.message || "Could not create image", "error");
    } finally {
      if (imageBtn) {
        imageBtn.disabled = false;
        imageBtn.textContent = prevLabel || "Share image";
      }
      saveBtn && (saveBtn.disabled = false);
    }
  };

  overlay.querySelector("#shareReportImage")?.addEventListener("click", () => runImageShare("share"));
  overlay.querySelector("#shareReportSaveImage")?.addEventListener("click", () => runImageShare("save"));

  document.body.style.overflow = "hidden";
  document.body.appendChild(overlay);
  refresh();

  const hasData = !!snap.txCount;
  overlay.querySelector("#shareReportImage")?.toggleAttribute("disabled", !hasData);
  overlay.querySelector("#shareReportSaveImage")?.toggleAttribute("disabled", !hasData);
}

export function formatTransactionShare(tx) {
  const sign = tx.type === "income" ? "+" : "−";
  const lines = [
    `📒 ${EXPORT_APP_NAME} — Transaction`,
    "",
    `${sign}${formatCurrency(tx.amount).slice(1)} · ${tx.categoryName}`,
    `Type: ${tx.type}`,
    `When: ${formatDisplayDateTime(tx.date, tx.time)}`,
  ];
  if (tx.merchant) lines.push(`Merchant: ${tx.merchant}`);
  if (tx.paymentMethod) lines.push(`Payment: ${tx.paymentMethod}`);
  if (tx.notes) lines.push(`Notes: ${tx.notes}`);
  if (tx.tags?.length) lines.push(`Tags: ${tx.tags.join(", ")}`);
  lines.push("", `— ${EXPORT_APP_NAME}`);
  return lines.join("\n");
}

export function formatSummaryShare(stats) {
  return [
    `📒 ${EXPORT_APP_NAME} — Summary`,
    "",
    `Total balance: ${formatCurrency(stats.totalBalance)}`,
    `This month income: ${formatCurrency(stats.monthlyIncome)}`,
    `This month spent: ${formatCurrency(stats.monthlyExpense)}`,
    `Month net: ${formatCurrency(stats.monthNet)}`,
    "",
    `— ${EXPORT_APP_NAME}`,
  ].join("\n");
}

export async function shareTransaction(tx) {
  return shareContent(`${EXPORT_APP_NAME} Transaction`, formatTransactionShare(tx));
}

export async function shareReport(data) {
  return shareContent(`${EXPORT_APP_NAME} Report`, formatReportShare(data));
}
