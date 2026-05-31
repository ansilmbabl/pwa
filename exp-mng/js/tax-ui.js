import {
  compareRegimes, computeHraExemption, getReferenceData, TAX_META, TAX_FIELD_HELP,
  computeEmployeePf, computeEmployerPf, solveRequiredGross, solveRequiredGrossBoth,
} from "./tax-india.js";
import { formatCurrency, escapeHtml, showModal } from "./ui.js";

function fmt(n) {
  return formatCurrency(n).replace(/\.00$/, "");
}

function infoBtn(key, label) {
  return `<button type="button" class="info-btn info-btn-sm" data-tax-help="${key}" aria-label="${escapeHtml(label)}">i</button>`;
}

function readAgeCategory() {
  const radio = document.querySelector('input[name="taxAge"]:checked');
  if (radio) return radio.value;
  return document.getElementById("taxAge")?.value || "general";
}

function syncAgeSelect() {
  const val = readAgeCategory();
  const sel = document.getElementById("taxAge");
  if (sel) sel.value = val;
}

export function readFormParams() {
  syncAgeSelect();
  return {
    grossSalary: document.getElementById("taxGross")?.value,
    basicSalary: document.getElementById("taxBasic")?.value,
    ageCategory: readAgeCategory(),
    includePf: document.getElementById("taxIncludePf")?.checked,
    usePfCalc: document.getElementById("taxUsePfCalc")?.checked,
    pfUseCeiling: document.getElementById("taxPfCeiling")?.checked,
    employeePfPct: document.getElementById("taxEmployeePfPct")?.value,
    employerPfPct: document.getElementById("taxEmployerPfPct")?.value,
    employeePfManual: document.getElementById("taxEmployeePfManual")?.value,
    employerPfManual: document.getElementById("taxEmployerPfManual")?.value,
    includePfIn80C: document.getElementById("taxPfIn80C")?.checked,
    sec80C: document.getElementById("tax80C")?.value,
    sec80D_self: document.getElementById("tax80Dself")?.value,
    sec80D_parents: document.getElementById("tax80Dparents")?.value,
    hraExemption: document.getElementById("taxHraManual")?.value,
    useHraCalc: document.getElementById("taxUseHraCalc")?.checked,
    hraReceived: document.getElementById("taxHraReceived")?.value,
    rentPaid: document.getElementById("taxRentPaid")?.value,
    isMetro: document.getElementById("taxMetro")?.checked,
    homeLoanInterest: document.getElementById("taxHomeLoan")?.value,
    sec80CCD1B: document.getElementById("taxNps1B")?.value,
    professionalTax: document.getElementById("taxProfTax")?.value || 2500,
    includeEmployerNpsNew: document.getElementById("taxEmployerNpsNew")?.checked,
    employerNpsPctNew: document.getElementById("taxEmployerNpsPctNew")?.value,
    includeEmployerNpsOld: document.getElementById("taxEmployerNpsOld")?.checked,
    employerNpsPctOld: document.getElementById("taxEmployerNpsPctOld")?.value,
  };
}

function renderRefLinks() {
  return `<div class="tax-ref-links">${TAX_META.referenceLinks.map((l) =>
    `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.name)} ↗</a>`,
  ).join("")}</div>`;
}

function resultRow(label, value, helpKey) {
  const help = helpKey ? infoBtn(helpKey, `Help: ${label}`) : "";
  return `<div class="tax-row"><span>${escapeHtml(label)} ${help}</span><span>${value}</span></div>`;
}

function inHandBreakdown(r, includePf) {
  const pfNote = includePf && r.basicEstimated
    ? `<p class="muted hint">Basic estimated at 40% of gross for PF — enter actual basic for accuracy. ${infoBtn("basicEstimate", "Help")}</p>`
    : includePf && !r.employeePf
      ? `<p class="muted hint">PF is ₹0 — enable “Include PF” and enter basic (or gross) above.</p>`
      : "";
  return `
    ${pfNote}
    <div class="inhand-breakdown">
      <div class="tax-row"><span>Gross / month</span><span>${fmt(r.monthlyGross)}</span></div>
      ${includePf !== false ? resultRow("− Employee PF", fmt(r.monthlyPf), "pfEmployee") : ""}
      <div class="tax-row"><span>− Income tax</span><span>${fmt(r.monthlyTax)}</span></div>
      ${resultRow("− Professional tax", fmt(r.monthlyProfTax), "profTax")}
      <div class="tax-row highlight"><span>= In-hand / month</span><strong>${fmt(r.inHandMonthly)}</strong></div>
    </div>`;
}

function resultCard(label, result, isWinner, includePf) {
  const pfLines = includePf !== false
    ? `${resultRow("Employee PF (EPF/yr)", fmt(result.employeePf), "pfEmployee")}
      ${resultRow("Employer PF (EPF/yr)", fmt(result.employerPf), "pfEmployer")}
      ${result.employerContribExcess ? resultRow("Taxable employer excess", fmt(result.employerContribExcess), "pfExcess") : ""}
      ${result.sec80CWithPf && result.regime === "old" ? `<div class="tax-row"><span>80C (incl. PF)</span><span>${fmt(result.sec80CWithPf)}</span></div>` : ""}`
    : "";

  return `
    <div class="tax-result-card${isWinner ? " winner" : ""}">
      <h4>${escapeHtml(label)}${isWinner ? " ✓ Better" : ""}</h4>
      ${pfLines}
      <div class="tax-row"><span>Total tax deductions</span><strong>${fmt(result.totalDeductions)}</strong></div>
      <div class="tax-row"><span>Taxable income</span><strong>${fmt(result.taxableIncome)}</strong></div>
      ${resultRow("Slab tax", fmt(result.slabTax))}
      ${result.rebate ? resultRow("Rebate u/s 87A", `−${fmt(result.rebate)}`, "rebate87A") : ""}
      ${result.surcharge ? resultRow("Surcharge", fmt(result.surcharge), "surcharge") : ""}
      ${resultRow("Cess (4%)", fmt(result.cess), "cess")}
      <div class="tax-row total"><span>Total tax / year</span><strong>${fmt(result.totalTax)}</strong></div>
      <h4 style="margin:14px 0 6px;font-size:0.85rem">Monthly in-hand breakdown</h4>
      ${inHandBreakdown(result, includePf)}
      <div class="tax-row"><span>Effective tax rate</span><span>${result.effectiveRate}%</span></div>
    </div>`;
}

function updatePfPreview() {
  const el = document.getElementById("taxPfPreview");
  if (!el || !document.getElementById("taxIncludePf")?.checked) {
    el?.classList.add("hidden");
    return;
  }
  const params = readFormParams();
  const emp = computeEmployeePf(params);
  const er = computeEmployerPf(params);
  el.classList.remove("hidden");
  const est = !document.getElementById("taxBasic")?.value && document.getElementById("taxGross")?.value
    ? " · basic estimated at 40% of gross" : "";
  el.innerHTML = `<span>Employee PF: <strong>${fmt(emp)}</strong>/yr · Employer PF: <strong>${fmt(er)}</strong>/yr${est}</span>`;
}

function togglePfFields(useCalc) {
  document.getElementById("taxPfCalcFields")?.classList.toggle("hidden", !useCalc);
  document.getElementById("taxPfManualFields")?.classList.toggle("hidden", useCalc);
  updatePfPreview();
}

function renderCompareResult(container, cmp) {
  const includePf = readFormParams().includePf;
  container.innerHTML = `
    <p class="recap-card">${cmp.better === "new"
      ? `New regime saves <strong>${fmt(cmp.savings)}</strong> per year`
      : `Old regime saves <strong>${fmt(cmp.savings)}</strong> per year`}</p>
    <div class="tax-compare-grid">
      ${resultCard("New regime", cmp.new, cmp.better === "new", includePf)}
      ${resultCard("Old regime", cmp.old, cmp.better === "old", includePf)}
    </div>`;
}

function renderSalaryTargetResult(container) {
  const target = document.getElementById("salaryTargetInHand")?.value;
  const regime = document.querySelector('input[name="salaryRegime"]:checked')?.value || "new";
  const params = readFormParams();

  if (!target || Number(target) <= 0) {
    container.innerHTML = `<p class="empty-msg">Enter desired monthly in-hand amount</p>`;
    return;
  }

  if (regime === "both") {
    const both = solveRequiredGrossBoth(params, target);
    if (!both.new || !both.old) return;
    container.innerHTML = `
      <p class="recap-card">To get <strong>${fmt(Number(target))}</strong>/month in-hand, ask for at least:</p>
      <div class="tax-compare-grid">
        <div class="tax-result-card${both.better === "new" ? " winner" : ""}">
          <h4>New regime${both.better === "new" ? " ✓ Lower CTC" : ""}</h4>
          <div class="tax-row total"><span>Required gross (LPA)</span><strong>${both.new.lpa} LPA</strong></div>
          <div class="tax-row"><span>Annual gross</span><span>${fmt(both.new.gross)}</span></div>
          ${inHandBreakdown(both.new.result, params.includePf)}
        </div>
        <div class="tax-result-card${both.better === "old" ? " winner" : ""}">
          <h4>Old regime${both.better === "old" ? " ✓ Lower CTC" : ""}</h4>
          <div class="tax-row total"><span>Required gross (LPA)</span><strong>${both.old.lpa} LPA</strong></div>
          <div class="tax-row"><span>Annual gross</span><span>${fmt(both.old.gross)}</span></div>
          ${inHandBreakdown(both.old.result, params.includePf)}
        </div>
      </div>
      <p class="muted hint">Configure PF, 80C, HRA etc. on the Calculator tab — those settings apply here too.</p>`;
    return;
  }

  const solved = solveRequiredGross(params, target, regime);
  if (!solved) return;
  const regimeLabel = regime === "old" ? "Old regime" : "New regime";
  container.innerHTML = `
    <div class="tax-result-card winner">
      <h4>${regimeLabel} — required package</h4>
      <div class="tax-row total"><span>Negotiate at least</span><strong>${solved.lpa} LPA</strong></div>
      <div class="tax-row"><span>Annual gross</span><span>${fmt(solved.gross)}</span></div>
      <div class="tax-row"><span>Monthly gross</span><span>${fmt(solved.result.monthlyGross)}</span></div>
      ${inHandBreakdown(solved.result, params.includePf)}
    </div>
    <p class="muted hint">Uses deduction settings from the Calculator tab. Round up when negotiating.</p>`;
}

function renderReference(container) {
  const ref = getReferenceData();
  container.innerHTML = `
    <div class="form-card">
      <h4>Official &amp; reference links</h4>
      ${renderRefLinks()}
    </div>
    <div class="form-card tax-regime-card tax-regime-new">
      <div class="tax-regime-head"><h4>New regime slabs (FY ${ref.meta.fy})</h4>${infoBtn("newRegime", "Help: new regime")}</div>
      ${slabTable(ref.newSlabs)}
      <p class="muted hint">Standard deduction: ₹75,000 · Rebate 87A up to ₹60,000 (taxable ≤ ₹12L)</p>
    </div>
    <div class="form-card tax-regime-card tax-regime-old">
      <div class="tax-regime-head"><h4>Old regime slabs</h4>${infoBtn("oldRegime", "Help: old regime")}</div>
      ${slabTable(ref.oldSlabs)}
      <p class="muted hint">Standard deduction: ₹50,000 · Rebate 87A up to ₹12,500 (taxable ≤ ₹5L)</p>
    </div>
    <div class="form-card">
      <h4>Surcharge ${infoBtn("surcharge", "Help: surcharge")}</h4>
      ${ref.surcharge.map((s) => `<div class="list-card"><span>${s.range}</span><span>New ${s.new} · Old ${s.old}</span></div>`).join("")}
    </div>
    <div class="form-card tax-regime-card tax-regime-old">
      <h4>Old regime deductions</h4>
      ${ref.oldDeductions.map((d) => `<div class="list-card"><span>${escapeHtml(d.name)} (${d.cap})</span><span class="muted">${escapeHtml(d.items)}</span></div>`).join("")}
    </div>
    <div class="form-card tax-regime-card tax-regime-new">
      <h4>New regime deductions</h4>
      ${ref.newDeductions.map((d) => `<div class="list-card"><span>${escapeHtml(d.name)} (${d.cap})</span><span class="muted">${escapeHtml(d.items)}</span></div>`).join("")}
    </div>
    <div class="form-card">
      <h4>Important notes</h4>
      <ul class="tax-notes">${ref.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
    </div>`;
}

function slabTable(slabs) {
  let prev = 0;
  return slabs.map((s) => {
    const from = prev === 0 ? 0 : prev + 1;
    const to = s.upto === Infinity ? "Above" : fmt(s.upto);
    const row = `<div class="list-card"><span>${from === 0 ? "Up to" : fmt(from)} – ${to}</span><span>${s.rate * 100}%</span></div>`;
    prev = s.upto === Infinity ? prev : s.upto;
    return row;
  }).join("");
}

function renderHraResult(container) {
  const ex = computeHraExemption({
    hraReceived: document.getElementById("hraReceived")?.value,
    basicSalary: document.getElementById("hraBasic")?.value,
    rentPaid: document.getElementById("hraRent")?.value,
    isMetro: document.getElementById("hraMetro")?.checked,
  });
  const basic = Number(document.getElementById("hraBasic")?.value) || 0;
  const rent = Number(document.getElementById("hraRent")?.value) || 0;
  const hra = Number(document.getElementById("hraReceived")?.value) || 0;
  const a = hra;
  const b = Math.max(0, rent - 0.1 * basic);
  const c = basic * (document.getElementById("hraMetro")?.checked ? 0.5 : 0.4);

  container.innerHTML = `
    <p class="recap-card">HRA exemption: <strong>${fmt(ex)}</strong> / year</p>
    <div class="list-card"><span>① Actual HRA received</span><span>${fmt(a)}</span></div>
    <div class="list-card"><span>② Rent − 10% of basic</span><span>${fmt(b)}</span></div>
    <div class="list-card"><span>③ 50%/40% of basic</span><span>${fmt(c)}</span></div>
    <p class="muted hint">Exemption = lowest of the three (old regime only).</p>`;
}

function showTaxHelp(key) {
  const h = TAX_FIELD_HELP[key];
  if (!h) return;
  showModal(h.title, `<p class="tax-help-body">${escapeHtml(h.body)}</p>`);
}

export function clearTaxForm() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const check = (id, on) => { const el = document.getElementById(id); if (el) el.checked = on; };

  set("taxGross", "");
  set("taxBasic", "");
  set("tax80C", "");
  set("tax80Dself", "");
  set("tax80Dparents", "");
  set("taxNps1B", "");
  set("taxHomeLoan", "");
  set("taxProfTax", "2500");
  set("taxHraManual", "");
  set("taxHraReceived", "");
  set("taxRentPaid", "");
  set("taxEmployeePfManual", "");
  set("taxEmployerPfManual", "");
  set("taxEmployeePfPct", "12");
  set("taxEmployerPfPct", "12");
  set("taxEmployerNpsPctNew", "14");
  set("taxEmployerNpsPctOld", "10");
  set("hraReceived", "");
  set("hraBasic", "");
  set("hraRent", "");
  set("salaryTargetInHand", "");

  check("taxIncludePf", true);
  check("taxUsePfCalc", true);
  check("taxPfCeiling", true);
  check("taxPfIn80C", true);
  check("taxUseHraCalc", false);
  check("taxMetro", false);
  check("taxEmployerNpsNew", false);
  check("taxEmployerNpsOld", false);
  check("hraMetro", false);

  document.querySelector('input[name="taxAge"][value="general"]')?.click();
  document.querySelector('input[name="salaryRegime"][value="new"]')?.click();

  document.getElementById("hraCalcFields")?.classList.add("hidden");
  document.getElementById("hraManualField")?.classList.remove("hidden");
  togglePfFields(true);

  document.getElementById("taxCompareResult").innerHTML = "";
  document.getElementById("salaryTargetResult").innerHTML = "";
  document.getElementById("hraResult").innerHTML = "";
  syncAgeSelect();
}

export function runTaxCalculation() {
  const cmp = compareRegimes(readFormParams());
  renderCompareResult(document.getElementById("taxCompareResult"), cmp);
}

export function renderTaxCalculatorPanel() {
  const footer = document.getElementById("taxFooterMeta");
  if (footer) {
    footer.innerHTML = `
      <p class="tax-disclaimer">Planning tool only — not official tax advice. Rules per Union Budget FY ${TAX_META.fy} (AY ${TAX_META.ay}). Tap <span class="info-btn info-btn-inline">i</span> for help.</p>
      <p class="tax-updated"><strong>Tax rules last updated:</strong> ${new Date(TAX_META.lastUpdated).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
      <h4 style="margin:16px 0 8px;font-size:0.85rem">Reference links</h4>
      ${renderRefLinks()}`;
  }
}

function bindTaxHelpButtons() {
  document.getElementById("panel-taxcalc")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tax-help]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    showTaxHelp(btn.dataset.taxHelp);
  });
}

export function bindTaxCalculator() {
  document.getElementById("taxCalcBtn")?.addEventListener("click", runTaxCalculation);
  document.getElementById("taxClearBtn")?.addEventListener("click", clearTaxForm);
  document.getElementById("salaryTargetBtn")?.addEventListener("click", () => {
    renderSalaryTargetResult(document.getElementById("salaryTargetResult"));
  });
  document.getElementById("salaryClearBtn")?.addEventListener("click", () => {
    document.getElementById("salaryTargetInHand").value = "";
    document.getElementById("salaryTargetResult").innerHTML = "";
  });
  document.getElementById("taxHraCalcBtn")?.addEventListener("click", () => {
    renderHraResult(document.getElementById("hraResult"));
  });
  document.getElementById("taxUseHraCalc")?.addEventListener("change", (e) => {
    document.getElementById("hraCalcFields")?.classList.toggle("hidden", !e.target.checked);
    document.getElementById("hraManualField")?.classList.toggle("hidden", e.target.checked);
  });
  document.getElementById("taxUsePfCalc")?.addEventListener("change", (e) => togglePfFields(e.target.checked));
  document.getElementById("taxIncludePf")?.addEventListener("change", updatePfPreview);
  document.querySelectorAll('input[name="taxAge"]').forEach((r) => {
    r.addEventListener("change", syncAgeSelect);
  });
  ["taxGross", "taxBasic", "taxEmployeePfPct", "taxEmployerPfPct", "taxEmployeePfManual", "taxEmployerPfManual"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updatePfPreview);
  });
  document.getElementById("taxPfCeiling")?.addEventListener("change", updatePfPreview);
  document.getElementById("taxGross")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runTaxCalculation();
  });
  document.getElementById("salaryTargetInHand")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") renderSalaryTargetResult(document.getElementById("salaryTargetResult"));
  });

  bindTaxHelpButtons();
  togglePfFields(document.getElementById("taxUsePfCalc")?.checked ?? true);
  renderReference(document.getElementById("taxReference"));
  renderTaxCalculatorPanel();
}
