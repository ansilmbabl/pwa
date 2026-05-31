import { renderAboutPanel } from "./about.js";

const SCREEN_TITLES = {
  appearance: "Appearance",
  notifications: "Notifications",
  security: "PIN lock",
  rules: "Smart rules",
  data: "Data & backup",
  organize: "Categories & tags",
  about: "About",
};

/** Map legacy section-tab pane ids (tour / old links) → drill screen keys */
const LEGACY_PANE_TO_SCREEN = {
  general: "appearance",
  data: "data",
  organize: "organize",
  about: "about",
};

export function openSettingsHub() {
  const hub = document.getElementById("settingsHubView");
  const drill = document.getElementById("settingsDrillView");
  hub?.classList.remove("hidden");
  drill?.classList.add("hidden");
  drill?.setAttribute("aria-hidden", "true");
  document.querySelectorAll("#settingsDrillView .settings-drill-pane").forEach((p) => {
    p.hidden = true;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * @param {string} screenId — appearance | notifications | security | rules | data | organize | about
 */
export function openSettingsScreen(screenId) {
  if (!SCREEN_TITLES[screenId]) return;
  const hub = document.getElementById("settingsHubView");
  const drill = document.getElementById("settingsDrillView");
  const title = document.getElementById("settingsDrillTitle");
  hub?.classList.add("hidden");
  drill?.classList.remove("hidden");
  drill?.setAttribute("aria-hidden", "false");
  document.querySelectorAll("#settingsDrillView .settings-drill-pane").forEach((p) => {
    p.hidden = p.dataset.settingsScreen !== screenId;
  });
  if (title) title.textContent = SCREEN_TITLES[screenId];
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (screenId === "about") renderAboutPanel();
}

/** For tour: `pane` was the old data-section-tabs pane id */
export function openSettingsScreenFromLegacyPane(pane) {
  const id = LEGACY_PANE_TO_SCREEN[pane] || "appearance";
  openSettingsScreen(id);
}

export function bindSettingsDrillNav() {
  document.getElementById("settingsBackBtn")?.addEventListener("click", () => openSettingsHub());
  document.querySelectorAll("#settingsHubView button[data-settings-screen]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openSettingsScreen(btn.dataset.settingsScreen);
    });
  });
}
