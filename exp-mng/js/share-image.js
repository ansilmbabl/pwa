import { formatCurrency } from "./ui.js";
import { formatDisplayDateTime } from "./dates.js";
import { getLogoDataUri, EXPORT_APP_NAME, EXPORT_TAGLINE } from "./export-brand.js";

/** Logical width (CSS px); canvas is scaled by EXPORT_SCALE for sharp PNGs */
const W = 640;
const PAD = 28;
const FONT = "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

function exportScale() {
  if (typeof window === "undefined" || !window.devicePixelRatio) return 2;
  return Math.min(2.5, Math.max(2, window.devicePixelRatio));
}

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
  let h = PAD + 72 + 24 + 110 + 36;
  if (snap.comparison) h += 52;
  const catLimit = opts.format === "summary" ? 5 : 8;
  if (snap.categories?.length) h += 28 + Math.min(catLimit, snap.categories.length) * 34;
  const showTx = opts.includeTx && snap.transactions?.length;
  if (showTx) {
    const limit = opts.format === "summary" ? Math.min(5, opts.txLimit) : opts.txLimit;
    h += 28 + Math.min(limit, snap.transactions.length) * 32;
    if (snap.transactions.length > limit) h += 22;
  }
  h += 52 + PAD;
  return Math.max(h, 360) + 32;
}

function drawHeader(ctx, y, logo, periodLabel, txCount) {
  roundRect(ctx, PAD, y, 44, 44, 10);
  ctx.fillStyle = COLORS.surface2;
  ctx.fill();
  ctx.drawImage(logo, PAD + 4, y + 4, 36, 36);

  ctx.fillStyle = COLORS.text;
  ctx.font = `700 22px ${FONT}`;
  ctx.textAlign = "left";
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
  ctx.textAlign = "left";
  ctx.fillText(label, x + 14, y + 22);
  ctx.fillStyle = color;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(value, x + 14, y + 48);
}

function drawCategoryRow(ctx, y, cat, maxAmount, contentW) {
  const rowH = 32;
  ctx.fillStyle = COLORS.text;
  ctx.font = `500 13px ${FONT}`;
  ctx.textAlign = "left";
  const label = truncate(ctx, `${cat.icon || ""} ${cat.name}`.trim(), contentW * 0.48);
  ctx.fillText(label, PAD, y + 18);

  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText(`${formatCurrency(cat.amount)} · ${cat.pct}%`, W - PAD, y + 18);
  ctx.textAlign = "left";

  const barY = y + rowH - 4;
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
  return y + rowH + 2;
}

function drawTxRow(ctx, y, tx, contentW) {
  const rowH = 32;
  const innerRight = W - PAD;
  const wDate = Math.floor(contentW * 0.34);
  const wAmt = Math.max(76, Math.floor(contentW * 0.24));
  const xDate = PAD;
  const xAmtRight = innerRight;
  const xCat = xDate + wDate + 10;
  const catMax = Math.max(80, xAmtRight - 10 - xCat);

  const midY = y + rowH / 2;
  ctx.textBaseline = "middle";

  ctx.fillStyle = COLORS.dim;
  ctx.font = `400 11px ${FONT}`;
  ctx.textAlign = "left";
  const dateStr = formatDisplayDateTime(tx.date, tx.time);
  ctx.fillText(truncate(ctx, dateStr, wDate - 2), xDate, midY);

  const sign = tx.type === "income" ? "+" : "−";
  const amtColor = tx.type === "income" ? COLORS.income : COLORS.expense;
  ctx.fillStyle = amtColor;
  ctx.font = `600 13px ${FONT}`;
  ctx.textAlign = "right";
  const amt = `${sign}${formatCurrency(tx.amount).slice(1)}`;
  ctx.fillText(truncate(ctx, amt, wAmt), xAmtRight, midY);

  ctx.fillStyle = COLORS.text;
  ctx.font = `500 12px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(truncate(ctx, tx.categoryName, catMax - 2), xCat, midY);

  ctx.textBaseline = "alphabetic";
  return y + rowH;
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
  const logicalHeight = countImageLines(snap, opts);
  const scale = exportScale();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(logicalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const contentW = W - PAD * 2;

  roundRect(ctx, 0, 0, W, logicalHeight, 16);
  const grad = ctx.createLinearGradient(0, 0, W, logicalHeight);
  grad.addColorStop(0, "#111114");
  grad.addColorStop(1, COLORS.bg);
  ctx.fillStyle = grad;
  ctx.fill();

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
  /* Extra gap so 22px Net line does not collide with stat value baselines (y+48 in 64px boxes) */
  y += 100;

  const netColor = snap.net >= 0 ? COLORS.income : COLORS.expense;
  const netStr = truncate(ctx, formatCurrency(snap.net), Math.max(120, boxW + boxW - 40));
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 13px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("Net", PAD, y);
  ctx.fillStyle = netColor;
  ctx.font = `700 22px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(netStr, W - PAD, y);
  ctx.textAlign = "left";
  y += 36;

  if (snap.comparison) {
    const { previousLabel, previousExpense, expenseDiff } = snap.comparison;
    const diffColor = expenseDiff > 0 ? COLORS.expense : COLORS.income;
    ctx.fillStyle = COLORS.dim;
    ctx.font = `400 12px ${FONT}`;
    ctx.fillText(`vs ${previousLabel}: ${formatCurrency(previousExpense)}`, PAD, y);
    y += 18;
    ctx.fillStyle = diffColor;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(formatDiff(expenseDiff), PAD, y);
    y += 22;
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

  y = logicalHeight - PAD - 20;
  ctx.strokeStyle = COLORS.border;
  ctx.beginPath();
  ctx.moveTo(PAD, y - 14);
  ctx.lineTo(W - PAD, y - 14);
  ctx.stroke();
  ctx.fillStyle = COLORS.dim;
  ctx.font = `400 11px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(`${EXPORT_APP_NAME} · ${new Date().toLocaleString("en-IN")}`, W / 2, y + 4);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create image"));
    }, "image/png", 1);
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
