export function parseLocalDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
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

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function startOfWeek(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
}

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
