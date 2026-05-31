import { formatCurrency } from "./ui.js";
import { formatDisplayDateTime } from "./dates.js";
import { toast } from "./ui.js";

export async function shareContent(title, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch (e) {
      if (e.name === "AbortError") return false;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard", "success");
    return true;
  } catch {
    toast("Share not available on this device", "error");
    return false;
  }
}

export function formatTransactionShare(tx) {
  const sign = tx.type === "income" ? "+" : "−";
  const lines = [
    "📒 Ledger Core — Transaction",
    "",
    `${sign}${formatCurrency(tx.amount).slice(1)} · ${tx.categoryName}`,
    `Type: ${tx.type}`,
    `When: ${formatDisplayDateTime(tx.date, tx.time)}`,
  ];
  if (tx.merchant) lines.push(`Merchant: ${tx.merchant}`);
  if (tx.paymentMethod) lines.push(`Payment: ${tx.paymentMethod}`);
  if (tx.notes) lines.push(`Notes: ${tx.notes}`);
  if (tx.tags?.length) lines.push(`Tags: ${tx.tags.join(", ")}`);
  lines.push("", "— Ledger Core (offline expense tracker)");
  return lines.join("\n");
}

export function formatReportShare({ periodLabel, income, expense, net, categories, transactions }) {
  const lines = [
    "📊 Ledger Core — Report",
    `Period: ${periodLabel}`,
    "",
    `Income:   ${formatCurrency(income)}`,
    `Expenses: ${formatCurrency(expense)}`,
    `Net:      ${formatCurrency(net)}`,
    "",
  ];
  if (categories?.length) {
    lines.push("Top categories:");
    categories.slice(0, 8).forEach((c, i) => {
      lines.push(`${i + 1}. ${c.name} — ${formatCurrency(c.amount)} (${c.pct}%)`);
    });
    lines.push("");
  }
  if (transactions?.length) {
    lines.push("Recent entries:");
    transactions.slice(0, 15).forEach((t) => {
      const sign = t.type === "income" ? "+" : "−";
      lines.push(`• ${formatDisplayDateTime(t.date, t.time)} ${sign}${formatCurrency(t.amount).slice(1)} ${t.categoryName}${t.merchant ? ` @ ${t.merchant}` : ""}`);
    });
    if (transactions.length > 15) lines.push(`… and ${transactions.length - 15} more`);
    lines.push("");
  }
  lines.push("— Exported from Ledger Core");
  return lines.join("\n");
}

export function formatSummaryShare(stats) {
  return [
    "📒 Ledger Core — Summary",
    "",
    `Total balance: ${formatCurrency(stats.totalBalance)}`,
    `This month income: ${formatCurrency(stats.monthlyIncome)}`,
    `This month spent: ${formatCurrency(stats.monthlyExpense)}`,
    `Month net: ${formatCurrency(stats.monthNet)}`,
    "",
    "— Ledger Core",
  ].join("\n");
}

export async function shareTransaction(tx) {
  return shareContent("Ledger Core Transaction", formatTransactionShare(tx));
}

export async function shareReport(data) {
  return shareContent("Ledger Core Report", formatReportShare(data));
}
