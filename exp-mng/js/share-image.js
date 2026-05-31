import { formatCurrency } from "./ui.js";
import { formatDisplayDateTime } from "./dates.js";
import { getLogoDataUri, EXPORT_APP_NAME, EXPORT_TAGLINE } from "./export-brand.js";

const W = 600;
const PAD = 28;
const FONT = "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
const COLORS = {
  bg: "#0a0a0b",
  surface: "#141416",
  surface2: "#1c1c1f",
  border: "rgba(255,255,255,0.1)",
  text: "#fafafa",
  muted: "#a1a1aa",
  dim: "#71717a",
  accent: "#2dd4bf",
  income: "#4ade80",
  expense: "#f87171",
};

let logoImagePromise = null;

function loadLogo() {
  if (!logoImagePromise) {
    logoImagePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = getLogoDataUri();
    });
  }
  return logoImagePromise;
}

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function formatDiff(amount) {
  const sign = amount >= 0 ? "+" : "−";
  return `${sign}${formatCurrency(Math.abs(amount)).slice(1)}`;
}

function countImageLines(snap, opts) {
  let h = PAD + 72 + 24 + 88 + 36; // header + stats + net
  if (snap.comparison) h += 28;
  const catLimit = opts.format === "summary" ? 5 : 8;
  if (snap.categories?.length) h += 28 + Math.min(catLimit, snap.categories.length) * 34;
  const showTx = opts.includeTx && snap.transactions?.length;
  if (showTx) {
    const limit = opts.format === "summary" ? Math.min(5, opts.txLimit) : opts.txLimit;
    h += 28 + Math.min(limit, snap.transactions.length) * 30;
    if (snap.transactions.length > limit) h += 22;
  }
  h += 52 + PAD;
  return Math.max(h, 320);
}

function drawHeader(ctx, y, logo, periodLabel, txCount) {
  roundRect(ctx, PAD, y, 44, 44, 10);
  ctx.fillStyle = COLORS.surface2;
  ctx.fill();
  ctx.drawImage(logo, PAD + 4, y + 4, 36, 36);

  ctx.fillStyle = COLORS.text;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(EXPORT_APP_NAME, PAD + 56, y + 22);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 13px ${FONT}`;
  ctx.fillText(EXPORT_TAGLINE, PAD + 56, y + 42);

  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.accent;
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText(periodLabel, W - PAD, y + 22);
  if (txCount != null) {
    ctx.fillStyle = COLORS.dim;
    ctx.font = `400 12px ${FONT}`;
    ctx.fillText(`${txCount} entries`, W - PAD, y + 42);
  }
  ctx.textAlign = "left";
  return y + 72;
}

function drawStatBox(ctx, x, y, w, h, label, value, color) {
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = COLORS.surface;
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = COLORS.dim;
  ctx.font = `500 11px ${FONT}`;
  ctx.fillText(label, x + 14, y + 22);
  ctx.fillStyle = color;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(value, x + 14, y + 48);
}

function drawCategoryRow(ctx, y, cat, maxAmount, contentW) {
  const rowH = 30;
  ctx.fillStyle = COLORS.text;
  ctx.font = `500 13px ${FONT}`;
  const label = truncate(ctx, `${cat.icon || ""} ${cat.name}`.trim(), contentW * 0.45);
  ctx.fillText(label, PAD, y + 18);

  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText(`${formatCurrency(cat.amount)} · ${cat.pct}%`, W - PAD, y + 18);
  ctx.textAlign = "left";

  const barY = y + rowH - 2;
  const barW = contentW;
  roundRect(ctx, PAD, barY, barW, 4, 2);
  ctx.fillStyle = COLORS.surface2;
  ctx.fill();
  const fillW = maxAmount ? (cat.amount / maxAmount) * barW : 0;
  if (fillW > 0) {
    roundRect(ctx, PAD, barY, fillW, 4, 2);
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
  }
  return y + 34;
}

function drawTxRow(ctx, y, tx, contentW) {
  ctx.fillStyle = COLORS.dim;
  ctx.font = `400 11px ${FONT}`;
  const dateStr = formatDisplayDateTime(tx.date, tx.time);
  ctx.fillText(truncate(ctx, dateStr, contentW * 0.38), PAD, y + 16);

  const sign = tx.type === "income" ? "+" : "−";
  const amtColor = tx.type === "income" ? COLORS.income : COLORS.expense;
  ctx.fillStyle = amtColor;
  ctx.font = `600 13px ${FONT}`;
  const amt = `${sign}${formatCurrency(tx.amount).slice(1)}`;
  const amtW = ctx.measureText(amt).width;
  ctx.fillText(amt, PAD + contentW * 0.42, y + 16);

  ctx.fillStyle = COLORS.text;
  ctx.font = `500 12px ${FONT}`;
  const catX = PAD + contentW * 0.42 + amtW + 12;
  ctx.fillText(truncate(ctx, tx.categoryName, W - PAD - catX), catX, y + 16);
  return y + 30;
}

export async function buildReportShareImageBlob(snap, options = {}) {
  const opts = {
    format: "summary",
    includeTx: true,
    txLimit: 10,
    ...options,
  };

  if (!snap.txCount) throw new Error("No data to share as image");

  const logo = await loadLogo();
  const height = countImageLines(snap, opts);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const contentW = W - PAD * 2;

  // Background
  roundRect(ctx, 0, 0, W, height, 16);
  const grad = ctx.createLinearGradient(0, 0, W, height);
  grad.addColorStop(0, "#111114");
  grad.addColorStop(1, COLORS.bg);
  ctx.fillStyle = grad;
  ctx.fill();

  // Accent top line
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(0, 0, W, 3);

  let y = PAD + 8;
  y = drawHeader(ctx, y, logo, snap.periodLabel, snap.txCount);

  y += 12;
  ctx.strokeStyle = COLORS.border;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 20;

  const boxW = (contentW - 12) / 2;
  drawStatBox(ctx, PAD, y, boxW, 64, "Income", formatCurrency(snap.income), COLORS.income);
  drawStatBox(ctx, PAD + boxW + 12, y, boxW, 64, "Expenses", formatCurrency(snap.expense), COLORS.expense);
  y += 80;

  const netColor = snap.net >= 0 ? COLORS.income : COLORS.expense;
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText("Net", PAD, y);
  ctx.fillStyle = netColor;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(formatCurrency(snap.net), PAD + 36, y);
  y += 28;

  if (snap.comparison) {
    const { previousLabel, previousExpense, expenseDiff } = snap.comparison;
    const diffColor = expenseDiff > 0 ? COLORS.expense : COLORS.income;
    ctx.fillStyle = COLORS.dim;
    ctx.font = `400 12px ${FONT}`;
    ctx.fillText(`vs ${previousLabel}: ${formatCurrency(previousExpense)}`, PAD, y);
    ctx.fillStyle = diffColor;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(formatDiff(expenseDiff), PAD + 200, y);
    y += 28;
  }

  const catLimit = opts.format === "summary" ? 5 : 8;
  if (snap.categories?.length) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText("TOP CATEGORIES", PAD, y);
    y += 18;
    const maxCat = snap.categories[0]?.amount || 1;
    snap.categories.slice(0, catLimit).forEach((cat) => {
      y = drawCategoryRow(ctx, y, cat, maxCat, contentW);
    });
    y += 8;
  }

  const showTx = opts.includeTx && snap.transactions?.length;
  if (showTx) {
    const limit = opts.format === "summary" ? Math.min(5, opts.txLimit) : opts.txLimit;
    ctx.fillStyle = COLORS.muted;
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText("TRANSACTIONS", PAD, y);
    y += 18;
    snap.transactions.slice(0, limit).forEach((tx) => {
      y = drawTxRow(ctx, y, tx, contentW);
    });
    if (snap.transactions.length > limit) {
      ctx.fillStyle = COLORS.dim;
      ctx.font = `400 11px ${FONT}`;
      ctx.fillText(`+ ${snap.transactions.length - limit} more entries`, PAD, y + 12);
      y += 22;
    }
  }

  // Footer
  y = height - PAD - 20;
  ctx.strokeStyle = COLORS.border;
  ctx.beginPath();
  ctx.moveTo(PAD, y - 14);
  ctx.lineTo(W - PAD, y - 14);
  ctx.stroke();
  ctx.fillStyle = COLORS.dim;
  ctx.font = `400 11px ${FONT}`;
  const footer = `${EXPORT_APP_NAME} · ${new Date().toLocaleString("en-IN")}`;
  ctx.textAlign = "center";
  ctx.fillText(footer, W / 2, y + 4);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create image"));
    }, "image/png", 0.92);
  });
}

export function downloadImageBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareImageBlob(blob, filename, title) {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title, files: [file] });
      return "shared";
    } catch (e) {
      if (e.name === "AbortError") return "cancelled";
    }
  }
  downloadImageBlob(blob, filename);
  return "downloaded";
}

export function imageFilenameForPeriod(periodLabel) {
  const safe = String(periodLabel).replace(/[^\w\-]+/g, "-").replace(/-+/g, "-");
  return `ledger-report-${safe}.png`;
}
