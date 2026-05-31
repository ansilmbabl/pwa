import { getInstalledVersion } from "./update.js";

export const APP_REPO_URL = "https://github.com/ansilmbabl/pwa";

export async function renderAboutPanel() {
  const el = document.getElementById("aboutPanelContent");
  if (!el) return;
  const version = await getInstalledVersion();
  el.innerHTML = `
    <div class="about-brand">
      <img src="icons/icon.svg" alt="" width="56" height="56" class="about-logo">
      <div>
        <strong>Ledger Core</strong>
        <p class="muted">Offline personal expense tracker</p>
      </div>
    </div>
    <dl class="about-meta">
      <dt>Version</dt><dd>${version}</dd>
      <dt>Storage</dt><dd>Local only (IndexedDB)</dd>
      <dt>License</dt><dd>Open source</dd>
    </dl>
    <p class="muted hint">Track expenses, budgets, bills, reports, and tax tools — all on your device. Nothing leaves your phone unless you export or share.</p>
    <a href="${APP_REPO_URL}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary about-link">View source on GitHub</a>`;
}
