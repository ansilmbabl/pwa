import { getSetting, setSetting } from "./db.js";

const STEPS = [
  {
    title: "Welcome to Ledger Core",
    body: "Your offline expense tracker — data stays on this device. We'll walk through the main areas.",
    placement: "bottom",
  },
  {
    title: "Home dashboard",
    body: "Balance, monthly stats, budget progress, wallets, and recent activity live here.",
    tab: "dash",
    highlightSel: ".hero-card",
    placement: "below",
  },
  {
    title: "Add a transaction",
    body: "Tap + anytime to log income or expenses with date, time, category, and optional details.",
    tab: "dash",
    highlight: "navAdd",
    placement: "above",
  },
  {
    title: "History",
    body: "Search and filter all transactions. Tap entries to view, edit, share, or delete.",
    tab: "history",
    highlightSel: '[data-tab="history"]',
    placement: "above",
  },
  {
    title: "Reports",
    body: "Charts, merchants, heatmap, forecasts, and tax summaries — filter by month or date range.",
    tab: "reports",
    highlightSel: '[data-tab="reports"]',
    placement: "above",
  },
  {
    title: "More features",
    body: "Open <strong>Due</strong> from the header or More for outgoing payments. The <strong>+ Add</strong> button opens a short form; full expense history stays under <strong>History</strong>. Other tools live under More.",
    highlightSel: "#morePopup .popup",
    placement: "above",
    openMore: true,
  },
  {
    title: "Settings",
    body: "Theme, currency, PIN, smart rules, backups, import/export, categories & tags — grouped in Settings.",
    tab: "settings",
    highlight: "settingsBtn",
    placement: "below",
    closeMore: true,
  },
  {
    title: "Backup & share",
    body: "Open Settings → Data & backup to export JSON, import CSV, and print or share reports.",
    tab: "settings",
    pane: "data",
    highlightSel: "#settings-pane-data",
    placement: "below",
  },
  {
    title: "You're ready!",
    body: "Add your first transaction with +. Tap ? anytime to replay this tour.",
    highlight: "tourBtn",
    placement: "below",
  },
];

let stepIndex = 0;
let rootEl = null;
let spotlightEl = null;
let tooltipEl = null;
let backdropEl = null;
let onNavigate = null;
let repositionHandler = null;

function getTarget(step) {
  if (step.highlight) return document.getElementById(step.highlight);
  if (step.highlightSel) return document.querySelector(step.highlightSel);
  return null;
}

function createRoot() {
  rootEl = document.createElement("div");
  rootEl.className = "tour-root";
  rootEl.innerHTML = `
    <div class="tour-backdrop" aria-hidden="true"></div>
    <div class="tour-spotlight" hidden></div>
    <div class="tour-tooltip" role="dialog" aria-labelledby="tourTitle"></div>
  `;
  document.body.appendChild(rootEl);
  backdropEl = rootEl.querySelector(".tour-backdrop");
  spotlightEl = rootEl.querySelector(".tour-spotlight");
  tooltipEl = rootEl.querySelector(".tour-tooltip");

  backdropEl.addEventListener("click", endTour);
}

function removeRoot() {
  if (repositionHandler) {
    window.removeEventListener("resize", repositionHandler);
    window.removeEventListener("scroll", repositionHandler, true);
    repositionHandler = null;
  }
  rootEl?.remove();
  rootEl = null;
  spotlightEl = null;
  tooltipEl = null;
  backdropEl = null;
}

function positionSpotlight(rect) {
  if (!spotlightEl || !rect) {
    if (spotlightEl) spotlightEl.hidden = true;
    return;
  }
  const pad = 10;
  spotlightEl.hidden = false;
  spotlightEl.style.top = `${Math.max(8, rect.top - pad)}px`;
  spotlightEl.style.left = `${Math.max(8, rect.left - pad)}px`;
  spotlightEl.style.width = `${rect.width + pad * 2}px`;
  spotlightEl.style.height = `${rect.height + pad * 2}px`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function positionTooltip(rect, placement) {
  if (!tooltipEl) return;
  const margin = 12;
  const navSafe = 88;
  const tt = tooltipEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top;
  let left;

  if (!rect || placement === "bottom") {
    top = vh - tt.height - navSafe - margin;
    left = clamp((vw - tt.width) / 2, margin, vw - tt.width - margin);
  } else if (placement === "above") {
    top = rect.top - tt.height - margin;
    left = clamp(rect.left + rect.width / 2 - tt.width / 2, margin, vw - tt.width - margin);
    if (top < margin) top = rect.bottom + margin;
  } else {
    top = rect.bottom + margin;
    left = clamp(rect.left + rect.width / 2 - tt.width / 2, margin, vw - tt.width - margin);
    if (top + tt.height > vh - navSafe) top = rect.top - tt.height - margin;
  }

  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.left = `${left}px`;
}

function layoutStep(step) {
  const target = getTarget(step);
  const rect = target?.getBoundingClientRect() ?? null;

  if (backdropEl) {
    backdropEl.classList.toggle("tour-backdrop--light", !rect);
    backdropEl.classList.toggle("tour-backdrop--spot", !!rect);
  }

  positionSpotlight(rect);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const r = target?.getBoundingClientRect() ?? rect;
      if (r) positionSpotlight(r);
      positionTooltip(r, step.placement || (r ? "below" : "bottom"));
    });
  });

  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    setTimeout(() => {
      const r = target.getBoundingClientRect();
      positionSpotlight(r);
      positionTooltip(r, step.placement || "below");
    }, 350);
  }
}

function bindTooltipActions(isFirst, isLast) {
  tooltipEl.querySelector(".tour-skip")?.addEventListener("click", endTour);
  tooltipEl.querySelector(".tour-back")?.addEventListener("click", () => goStep(-1));
  tooltipEl.querySelector(".tour-next")?.addEventListener("click", () => {
    if (isLast) endTour();
    else goStep(1);
  });
}

function renderStep() {
  const step = STEPS[stepIndex];
  const total = STEPS.length;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;

  if (!rootEl) createRoot();

  tooltipEl.innerHTML = `
    <div class="tour-progress">
      ${STEPS.map((_, i) => `<span class="tour-dot${i === stepIndex ? " active" : i < stepIndex ? " done" : ""}"></span>`).join("")}
    </div>
    <h2 id="tourTitle">${step.title}</h2>
    <p class="tour-body">${step.body}</p>
    <div class="tour-meta">Step ${stepIndex + 1} of ${total}</div>
    <div class="tour-actions">
      <button type="button" class="btn-sm btn-ghost tour-skip">Skip</button>
      <div class="tour-nav">
        ${!isFirst ? `<button type="button" class="btn btn-secondary tour-back">Back</button>` : ""}
        <button type="button" class="btn tour-next">${isLast ? "Finish" : "Next"}</button>
      </div>
    </div>`;

  bindTooltipActions(isFirst, isLast);
  layoutStep(step);

  if (!repositionHandler) {
    repositionHandler = () => layoutStep(STEPS[stepIndex]);
    window.addEventListener("resize", repositionHandler);
    window.addEventListener("scroll", repositionHandler, true);
  }
}

async function applyStepNavigation(step) {
  if (!onNavigate || !step) return;
  if (step.closeMore) onNavigate.closeMore?.();
  if (step.openMore) {
    onNavigate.closeMore?.();
    if (step.tab) onNavigate.switchTab(step.tab || "dash");
    await new Promise((r) => setTimeout(r, 150));
    onNavigate.openMore?.();
    await new Promise((r) => setTimeout(r, 200));
    return;
  }
  onNavigate.closeMore?.();
  if (step.tab) onNavigate.switchTab(step.tab);
  if (step.pane && step.tab) {
    await new Promise((r) => requestAnimationFrame(r));
    onNavigate.activatePane?.(`panel-${step.tab}`, step.pane);
  }
  await new Promise((r) => setTimeout(r, 120));
}

async function goStep(delta) {
  stepIndex = Math.max(0, Math.min(STEPS.length - 1, stepIndex + delta));
  await applyStepNavigation(STEPS[stepIndex]);
  renderStep();
}

export async function startTour(navCallbacks) {
  onNavigate = navCallbacks;
  stepIndex = 0;
  removeRoot();
  await applyStepNavigation(STEPS[0]);
  renderStep();
}

export async function endTour() {
  removeRoot();
  onNavigate?.closeMore?.();
  await setSetting("tourCompleted", true);
}

export function bindTour(navCallbacks) {
  onNavigate = navCallbacks;
  document.getElementById("tourBtn")?.addEventListener("click", () => startTour(navCallbacks));
}

export async function maybeShowTourOnFirstVisit(navCallbacks) {
  const done = await getSetting("tourCompleted");
  if (!done) setTimeout(() => startTour(navCallbacks), 600);
}
