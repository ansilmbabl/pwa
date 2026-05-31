import { getSetting, setSetting } from "./db.js";
import { setCurrencySymbol } from "./ui.js";

const THEMES = { dark: "dark", light: "light" };

export async function initTheme() {
  const theme = (await getSetting("theme")) || THEMES.dark;
  applyTheme(theme);
  const currency = (await getSetting("currency")) || "INR";
  applyCurrency(currency);
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === THEMES.light ? "light" : "dark";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === THEMES.light ? "#f4f4f5" : "#0a0a0b";
}

export async function toggleTheme() {
  const cur = (await getSetting("theme")) || THEMES.dark;
  const next = cur === THEMES.dark ? THEMES.light : THEMES.dark;
  await setSetting("theme", next);
  applyTheme(next);
  return next;
}

export const CURRENCIES = {
  INR: { symbol: "₹", label: "Indian Rupee (₹)" },
  USD: { symbol: "$", label: "US Dollar ($)" },
  EUR: { symbol: "€", label: "Euro (€)" },
  GBP: { symbol: "£", label: "British Pound (£)" },
  JPY: { symbol: "¥", label: "Japanese Yen (¥)" },
};

export function applyCurrency(code) {
  setCurrencySymbol(CURRENCIES[code]?.symbol || "₹");
}

export async function setAppCurrency(code) {
  await setSetting("currency", code);
  applyCurrency(code);
}

export async function renderThemeSettings() {
  const theme = (await getSetting("theme")) || THEMES.dark;
  const btn = document.getElementById("themeToggleBtn");
  if (btn) btn.textContent = theme === THEMES.dark ? "Use light theme" : "Use dark theme";
  const sel = document.getElementById("currencySelect");
  if (sel) {
    const cur = (await getSetting("currency")) || "INR";
    sel.innerHTML = Object.entries(CURRENCIES).map(([code, c]) =>
      `<option value="${code}"${code === cur ? " selected" : ""}>${c.label}</option>`
    ).join("");
  }
}
