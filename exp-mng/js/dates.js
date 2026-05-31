export function parseLocalDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function parseDateTime(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh = 0, mm = 0] = (timeStr || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export function nowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

export function txSortKey(tx) {
  return `${tx.date}T${tx.time || "00:00"}`;
}

export function formatDisplayDateTime(date, time) {
  if (!date) return "";
  const d = parseLocalDate(date);
  const datePart = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return time ? `${datePart}, ${time}` : datePart;
}

export function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

export function formatMonthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function addMonths(dateStr, n) {
  const d = parseLocalDate(dateStr);
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(dateStr, n) {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1);
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function startOfWeek(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
}

export function isInDashPeriod(dateStr, period) {
  if (period === "all") return true;
  const d = parseLocalDate(dateStr);
  const now = new Date();
  if (period === "week") return d >= startOfWeek(now);
  if (period === "month") return d >= startOfMonth(now);
  if (period === "year") return d >= startOfYear(now);
  return true;
}

export const DASH_PERIOD_LABELS = {
  week: "This week",
  month: "This month",
  year: "This year",
  all: "All time",
};

export function inRange(dateStr, from, to) {
  const t = parseLocalDate(dateStr).getTime();
  if (from && t < parseLocalDate(from).getTime()) return false;
  if (to && t > parseLocalDate(to).getTime()) return false;
  return true;
}

export function daysUntil(dateStr) {
  const today = parseLocalDate(todayStr());
  const target = parseLocalDate(dateStr);
  return Math.round((target - today) / 86400000);
}

export function setDefaultDateTimeFields(dateEl, timeEl) {
  if (dateEl) dateEl.value = todayStr();
  if (timeEl) timeEl.value = nowTimeStr();
}
