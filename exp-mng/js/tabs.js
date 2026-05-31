/** Section-level tab switching within a view panel */
export function initSectionTabs(root) {
  if (!root) return;
  const tabs = root.querySelectorAll(".section-tab");
  const panes = root.querySelectorAll(".tab-pane");
  if (!tabs.length || !panes.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const paneId = tab.dataset.pane;
      activatePane(root, paneId);
      if (root.id === "panel-reports") {
        requestAnimationFrame(() => window.dispatchEvent(new Event("report-pane-change")));
      }
    });
  });
}

export function activatePane(root, paneId) {
  if (!root || !paneId) return;
  root.querySelectorAll(".section-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.pane === paneId);
    t.setAttribute("aria-selected", t.dataset.pane === paneId ? "true" : "false");
  });
  root.querySelectorAll(".tab-pane").forEach((p) => {
    p.classList.toggle("active", p.dataset.pane === paneId);
  });
}

export function initAllSectionTabs() {
  document.querySelectorAll("[data-section-tabs]").forEach(initSectionTabs);
}
