import { STORES, getAll, getCategories } from "./db.js";
import { getMonthlyBudget } from "./budget.js";
import { monthKey, todayStr, formatMonthLabel, startOfWeek, parseLocalDate } from "./dates.js";
import { formatCurrency } from "./ui.js";

function prevMonthKey(key) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function pctChange(cur, prev) {
  if (!prev) return cur ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

/**
 * @returns {{ severity: 'good'|'warn'|'info', title: string, body: string }[]}
 */
export async function buildSpendingAdvice() {
  const [txs, cats, budget] = await Promise.all([
    getAll(STORES.TX),
    getCategories("expense"),
    getMonthlyBudget(),
  ]);
  const tips = [];
  const curKey = monthKey(todayStr());
  const prevKey = prevMonthKey(curKey);
  const curExp = txs.filter((t) => t.type === "expense" && monthKey(t.date) === curKey);
  const prevExp = txs.filter((t) => t.type === "expense" && monthKey(t.date) === prevKey);
  const curInc = txs.filter((t) => t.type === "income" && monthKey(t.date) === curKey);
  const curExpTotal = curExp.reduce((s, t) => s + t.amount, 0);
  const prevExpTotal = prevExp.reduce((s, t) => s + t.amount, 0);
  const curIncTotal = curInc.reduce((s, t) => s + t.amount, 0);

  if (!txs.length) {
    tips.push({
      severity: "info",
      title: "Start tracking",
      body: "Add a few transactions to unlock personalised spending suggestions.",
    });
    return tips;
  }

  if (budget > 0) {
    const remaining = budget - curExpTotal;
    const pct = (curExpTotal / budget) * 100;
    if (pct >= 100) {
      tips.push({
        severity: "warn",
        title: "Over monthly budget",
        body: `You've exceeded your ${formatCurrency(budget)} budget by ${formatCurrency(curExpTotal - budget)}. Review top categories in Charts.`,
      });
    } else if (pct >= 80) {
      tips.push({
        severity: "warn",
        title: "Budget almost used",
        body: `${pct.toFixed(0)}% of budget spent — ${formatCurrency(remaining)} left for ${formatMonthLabel(curKey).split(" ")[0]}.`,
      });
    } else if (pct <= 50 && curExpTotal > 0) {
      tips.push({
        severity: "good",
        title: "On track with budget",
        body: `${formatCurrency(remaining)} still available (${(100 - pct).toFixed(0)}% of budget unused).`,
      });
    }
  } else {
    tips.push({
      severity: "info",
      title: "Set a monthly budget",
      body: "Add a budget in the Budget panel to get overspend alerts and smarter tips.",
    });
  }

  const change = pctChange(curExpTotal, prevExpTotal);
  if (prevExpTotal > 0 && Math.abs(change) >= 10) {
    tips.push({
      severity: change > 0 ? "warn" : "good",
      title: change > 0 ? "Spending up vs last month" : "Spending down vs last month",
      body: `${change > 0 ? "Up" : "Down"} ${Math.abs(change).toFixed(0)}% compared to ${formatMonthLabel(prevKey)} (${formatCurrency(curExpTotal)} vs ${formatCurrency(prevExpTotal)}).`,
    });
  }

  if (curIncTotal > 0 && curExpTotal > curIncTotal) {
    tips.push({
      severity: "warn",
      title: "Spending exceeds income",
      body: `Expenses ${formatCurrency(curExpTotal)} vs income ${formatCurrency(curIncTotal)} this month — net ${formatCurrency(curIncTotal - curExpTotal)}.`,
    });
  } else if (curIncTotal > 0 && curExpTotal <= curIncTotal * 0.7) {
    tips.push({
      severity: "good",
      title: "Healthy savings rate",
      body: `You're spending ${((curExpTotal / curIncTotal) * 100).toFixed(0)}% of income — room to save or invest ${formatCurrency(curIncTotal - curExpTotal)}.`,
    });
  }

  const catMap = {};
  curExp.forEach((t) => { catMap[t.categoryId] = (catMap[t.categoryId] || 0) + t.amount; });
  const topCats = Object.entries(catMap)
    .map(([id, amount]) => ({
      id: Number(id),
      amount,
      name: cats.find((c) => c.id === Number(id))?.name || "?",
      pct: curExpTotal ? (amount / curExpTotal) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  if (topCats[0] && topCats[0].pct >= 35) {
    tips.push({
      severity: "info",
      title: `${topCats[0].name} dominates spending`,
      body: `${topCats[0].pct.toFixed(0)}% of expenses (${formatCurrency(topCats[0].amount)}). Consider a per-category limit in Budget → Categories.`,
    });
  }

  for (const cat of cats) {
    const spent = catMap[cat.id] || 0;
    const limit = (cat.budgetLimit || 0) + (cat.rollover || 0);
    if (limit > 0 && spent > limit) {
      tips.push({
        severity: "warn",
        title: `${cat.name} over category limit`,
        body: `Spent ${formatCurrency(spent)} vs ${formatCurrency(limit)} limit — trim ${formatCurrency(spent - limit)} or raise the cap.`,
      });
    }
  }

  const merchantMap = {};
  curExp.forEach((t) => {
    const m = (t.merchant || "").trim();
    if (!m) return;
    merchantMap[m] = (merchantMap[m] || 0) + t.amount;
  });
  const topMerchant = Object.entries(merchantMap).sort((a, b) => b[1] - a[1])[0];
  if (topMerchant && topMerchant[1] >= curExpTotal * 0.2) {
    tips.push({
      severity: "info",
      title: `Top merchant: ${topMerchant[0]}`,
      body: `${formatCurrency(topMerchant[1])} (${((topMerchant[1] / curExpTotal) * 100).toFixed(0)}% of spending). Check for subscriptions or repeat buys.`,
    });
  }

  const now = new Date();
  const sow = startOfWeek(now);
  let weekend = 0;
  let weekday = 0;
  curExp.forEach((t) => {
    const d = parseLocalDate(t.date);
    if (d >= sow && (d.getDay() === 0 || d.getDay() === 6)) weekend += t.amount;
    else weekday += t.amount;
  });
  if (weekend > weekday && weekend > 0) {
    tips.push({
      severity: "info",
      title: "Weekend spending spike",
      body: `This week, weekend spend (${formatCurrency(weekend)}) exceeds weekdays (${formatCurrency(weekday)}). Plan outings with a fixed cap.`,
    });
  }

  const foodCat = cats.find((c) => /food|dining|restaurant|grocer/i.test(c.name));
  if (foodCat && catMap[foodCat.id] && catMap[foodCat.id] > curExpTotal * 0.25) {
    tips.push({
      severity: "info",
      title: "Food & dining is high",
      body: `${formatCurrency(catMap[foodCat.id])} on ${foodCat.name}. Meal prep or weekly dining budget could free cash.`,
    });
  }

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = now.getDate();
  if (budget > 0 && day < daysInMonth * 0.6) {
    const dailyBurn = curExpTotal / day;
    const projected = dailyBurn * daysInMonth;
    if (projected > budget * 1.1) {
      tips.push({
        severity: "warn",
        title: "Pace alert — month-end overshoot",
        body: `At ${formatCurrency(dailyBurn)}/day you'll hit ~${formatCurrency(projected)} vs ${formatCurrency(budget)} budget. Slow down ${formatCurrency((projected - budget) / (daysInMonth - day))}/day.`,
      });
    }
  }

  if (!tips.length) {
    tips.push({
      severity: "good",
      title: "Looks balanced",
      body: "No major flags this period. Keep logging transactions for sharper insights.",
    });
  }

  const order = { warn: 0, info: 1, good: 2 };
  return tips.sort((a, b) => order[a.severity] - order[b.severity]);
}

export async function renderSpendingAdvice(container) {
  if (!container) return;
  const tips = await buildSpendingAdvice();
  container.innerHTML = tips.map((t) => `
    <div class="advice-card advice-${t.severity}">
      <strong>${t.title}</strong>
      <p>${t.body}</p>
    </div>`).join("");
}
