/** India income tax rules — FY 2025-26 (AY 2026-27) */
export const TAX_META = {
  fy: "2025-26",
  ay: "2026-27",
  lastUpdated: "2026-05-31",
  country: "India",
  sources: [
    "Union Budget 2025-26",
    "Section 115BAC (New Regime)",
    "Section 87A Rebate",
    "Income Tax Department FAQs",
  ],
  referenceLinks: [
    { name: "Income Tax Department", url: "https://www.incometax.gov.in/iec/foportal/" },
    { name: "EPFO (Provident Fund)", url: "https://www.epfindia.gov.in/" },
    { name: "UMANG — EPFO services", url: "https://web.umang.gov.in/web/department/epfo" },
    { name: "ClearTax — FY 2025-26 slabs", url: "https://cleartax.in/s/income-tax-slabs" },
    { name: "Section 80C guide (IT Dept)", url: "https://www.incometax.gov.in/iec/foportal/help/individual/return-preparation" },
  ],
};

export const NEW_SLABS = [
  { upto: 400000, rate: 0 },
  { upto: 800000, rate: 0.05 },
  { upto: 1200000, rate: 0.10 },
  { upto: 1600000, rate: 0.15 },
  { upto: 2000000, rate: 0.20 },
  { upto: 2400000, rate: 0.25 },
  { upto: Infinity, rate: 0.30 },
];

export const OLD_SLABS = [
  { upto: 250000, rate: 0 },
  { upto: 500000, rate: 0.05 },
  { upto: 1000000, rate: 0.20 },
  { upto: Infinity, rate: 0.30 },
];

export const OLD_SLABS_SENIOR = [
  { upto: 300000, rate: 0 },
  { upto: 500000, rate: 0.05 },
  { upto: 1000000, rate: 0.20 },
  { upto: Infinity, rate: 0.30 },
];

export const OLD_SLABS_SUPER_SENIOR = [
  { upto: 500000, rate: 0 },
  { upto: 1000000, rate: 0.05 },
  { upto: Infinity, rate: 0.30 },
];

export const STANDARD_DEDUCTION = { new: 75000, old: 50000 };
export const REBATE_87A = { new: { limit: 1200000, max: 60000 }, old: { limit: 500000, max: 12500 } };
export const CESS_RATE = 0.04;
export const DEDUCTION_CAPS = {
  sec80C: 150000,
  sec80D_self: 25000,
  sec80D_parents: 50000,
  sec80D_selfSenior: 50000,
  sec80CCD1B: 50000,
  sec24b_homeLoan: 200000,
  professionalTax: 2500,
  employerNpsNewPct: 0.14,
  employerNpsOldPct: 0.10,
  employerContribCap: 750000,
  epfEmployeePct: 0.12,
  epfEmployerPct: 0.12,
  epfWageCeilingMonthly: 15000,
};

export function computeSlabTax(taxableIncome, slabs) {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const slab of slabs) {
    if (taxableIncome <= prev) break;
    const band = Math.min(taxableIncome, slab.upto) - prev;
    if (band > 0) tax += band * slab.rate;
    prev = slab.upto;
  }
  return Math.round(tax);
}

export function applyRebate87A(tax, taxableIncome, regime) {
  const r = REBATE_87A[regime];
  if (taxableIncome <= r.limit) return Math.max(0, tax - Math.min(tax, r.max));
  return tax;
}

export function computeSurcharge(tax, totalIncome, regime) {
  if (tax <= 0 || totalIncome <= 5000000) return 0;
  let rate = 0;
  if (totalIncome <= 10000000) rate = 0.10;
  else if (totalIncome <= 20000000) rate = 0.15;
  else if (totalIncome <= 50000000) rate = 0.25;
  else rate = regime === "old" ? 0.37 : 0.25;
  return Math.round(tax * rate);
}

export function computeCess(taxPlusSurcharge) {
  return Math.round(taxPlusSurcharge * CESS_RATE);
}

/** HRA exemption (old regime) — least of three */
export function computeHraExemption({ hraReceived, basicSalary, rentPaid, isMetro }) {
  const hra = hraReceived || 0;
  const basic = basicSalary || 0;
  const rent = rentPaid || 0;
  if (!hra || !rent || !basic) return 0;
  const a = hra;
  const b = Math.max(0, rent - 0.1 * basic);
  const c = basic * (isMetro ? 0.5 : 0.4);
  return Math.round(Math.min(a, b, c));
}

function getOldSlabs(ageCategory) {
  if (ageCategory === "senior") return OLD_SLABS_SENIOR;
  if (ageCategory === "super") return OLD_SLABS_SUPER_SENIOR;
  return OLD_SLABS;
}

function computeEmployerNpsDeduction(basicSalary, employerNpsPct, regime) {
  const pct = regime === "new" ? DEDUCTION_CAPS.employerNpsNewPct : DEDUCTION_CAPS.employerNpsOldPct;
  const raw = (basicSalary || 0) * (employerNpsPct != null ? employerNpsPct / 100 : pct);
  return Math.round(Math.min(raw, DEDUCTION_CAPS.employerContribCap));
}

/** PF wage base — optional statutory ceiling on basic (₹15k/month) */
export function computePfWageBase(basicAnnual, useCeiling = true) {
  const basic = Number(basicAnnual) || 0;
  if (!useCeiling) return basic;
  return Math.min(basic, DEDUCTION_CAPS.epfWageCeilingMonthly * 12);
}

function withResolvedBasic(params) {
  const basic = resolveBasicSalary(params.grossSalary, params.basicSalary, params.basicRatio);
  return { ...params, basicSalary: basic };
}

/** Estimate basic as 40% of gross when not entered (for PF / NPS) */
export function resolveBasicSalary(gross, basic, ratio = 0.4) {
  const b = Number(basic);
  if (b > 0) return b;
  const g = Number(gross);
  if (g > 0) return Math.round(g * (Number(ratio) || 0.4));
  return 0;
}

export function computeEmployeePf(params) {
  if (params.includePf === false) return 0;
  const p = withResolvedBasic(params);
  if (!params.usePfCalc) return Math.round(Number(params.employeePfManual) || 0);
  const base = computePfWageBase(p.basicSalary, params.pfUseCeiling !== false);
  const pct = Number(params.employeePfPct) || DEDUCTION_CAPS.epfEmployeePct * 100;
  return Math.round(base * pct / 100);
}

export function computeEmployerPf(params) {
  if (params.includePf === false) return 0;
  const p = withResolvedBasic(params);
  if (!params.usePfCalc) return Math.round(Number(params.employerPfManual) || 0);
  const base = computePfWageBase(p.basicSalary, params.pfUseCeiling !== false);
  const pct = Number(params.employerPfPct) || DEDUCTION_CAPS.epfEmployerPct * 100;
  return Math.round(base * pct / 100);
}

function computeEmployerNpsAmount(params, regime) {
  const p = withResolvedBasic(params);
  const include = regime === "new" ? params.includeEmployerNpsNew : params.includeEmployerNpsOld;
  if (!include) return 0;
  const pct = regime === "new"
    ? params.employerNpsPctNew ?? params.employerNpsPct
    : params.employerNpsPctOld ?? params.employerNpsPct;
  return computeEmployerNpsDeduction(p.basicSalary, pct, regime);
}

/** Employer EPF + NPS + superannuation above ₹7.5L — taxable perquisite */
export function computeEmployerContribExcess(params, regime) {
  const employerPf = computeEmployerPf(params);
  const employerNps = computeEmployerNpsAmount(params, regime);
  const superannuation = Math.round(Number(params.superannuation) || 0);
  const total = employerPf + employerNps + superannuation;
  return Math.max(0, total - DEDUCTION_CAPS.employerContribCap);
}

function computeSec80C(params) {
  const other = Number(params.sec80C) || 0;
  const pfPart = params.includePf && params.includePfIn80C !== false
    ? computeEmployeePf(params)
    : 0;
  return Math.min(other + pfPart, DEDUCTION_CAPS.sec80C);
}

export function computeRegimeTax(params, regime) {
  const p = withResolvedBasic(params);
  const gross = Number(p.grossSalary) || 0;
  const ageCategory = p.ageCategory || "general";
  const includePf = p.includePf !== false;

  const employeePf = includePf ? computeEmployeePf(p) : 0;
  const employerPf = includePf ? computeEmployerPf(p) : 0;
  const employerContribExcess = includePf ? computeEmployerContribExcess(p, regime) : 0;
  const profTax = Math.min(Number(p.professionalTax) || 0, DEDUCTION_CAPS.professionalTax);

  let deductions = 0;
  let employerNpsDed = 0;

  if (regime === "new") {
    deductions = STANDARD_DEDUCTION.new;
    if (p.includeEmployerNpsNew) {
      employerNpsDed = computeEmployerNpsAmount(p, "new");
      deductions += employerNpsDed;
    }
  } else {
    const cap80C = computeSec80C(p);
    const cap80D = Math.min(
      (Number(p.sec80D_self) || 0) + (Number(p.sec80D_parents) || 0),
      DEDUCTION_CAPS.sec80D_self + DEDUCTION_CAPS.sec80D_parents,
    );
    const hra = p.useHraCalc
      ? computeHraExemption({
          hraReceived: p.hraReceived,
          basicSalary: p.basicSalary,
          rentPaid: p.rentPaid,
          isMetro: p.isMetro,
        })
      : Math.min(Number(p.hraExemption) || 0, gross);
    const homeLoan = Math.min(Number(p.homeLoanInterest) || 0, DEDUCTION_CAPS.sec24b_homeLoan);
    const nps1B = Math.min(Number(p.sec80CCD1B) || 0, DEDUCTION_CAPS.sec80CCD1B);
    if (p.includeEmployerNpsOld) {
      employerNpsDed = computeEmployerNpsAmount(p, "old");
    }

    deductions = STANDARD_DEDUCTION.old + cap80C + cap80D + hra + homeLoan + nps1B + profTax + employerNpsDed;
  }

  const taxableIncome = Math.max(0, gross - deductions + employerContribExcess);
  const slabs = regime === "new" ? NEW_SLABS : getOldSlabs(ageCategory);
  const slabTax = computeSlabTax(taxableIncome, slabs);
  const afterRebate = applyRebate87A(slabTax, taxableIncome, regime);
  const surcharge = computeSurcharge(afterRebate, gross, regime);
  const cess = computeCess(afterRebate + surcharge);
  const totalTax = afterRebate + surcharge + cess;
  const monthlyTax = Math.round(totalTax / 12);
  const annualNet = gross - totalTax - employeePf - profTax;
  const inHandMonthly = Math.round(annualNet / 12);
  const basicUsed = p.basicSalary;
  const basicEstimated = !Number(params.basicSalary) && basicUsed > 0;

  return {
    regime,
    grossSalary: gross,
    basicUsed,
    basicEstimated,
    employeePf,
    employerPf,
    employerNpsDed,
    employerContribExcess,
    profTax,
    sec80CWithPf: regime === "old" ? computeSec80C(p) : 0,
    sec80CPfPart: regime === "old" && p.includePfIn80C !== false ? employeePf : 0,
    totalDeductions: Math.round(deductions),
    taxableIncome: Math.round(taxableIncome),
    slabTax,
    rebate: slabTax - afterRebate,
    surcharge,
    cess,
    totalTax,
    monthlyTax,
    monthlyGross: Math.round(gross / 12),
    monthlyPf: Math.round(employeePf / 12),
    monthlyProfTax: Math.round(profTax / 12),
    inHandAnnual: annualNet,
    inHandMonthly,
    effectiveRate: gross ? ((totalTax / gross) * 100).toFixed(2) : "0.00",
  };
}

/** Given target monthly in-hand, find minimum gross salary (LPA) */
export function solveRequiredGross(params, targetMonthlyInHand, regime = "new") {
  const target = Math.round(Number(targetMonthlyInHand));
  if (!target || target <= 0) return null;

  let lo = target * 12;
  let hi = Math.max(lo * 3, 50000000);

  for (let i = 0; i < 64 && lo < hi; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const result = computeRegimeTax({ ...params, grossSalary: mid }, regime);
    if (result.inHandMonthly >= target) hi = mid;
    else lo = mid + 1;
  }

  const gross = lo;
  const result = computeRegimeTax({ ...params, grossSalary: gross }, regime);
  return { gross, lpa: +(gross / 100000).toFixed(2), regime, result };
}

export function solveRequiredGrossBoth(params, targetMonthlyInHand) {
  const newR = solveRequiredGross(params, targetMonthlyInHand, "new");
  const oldR = solveRequiredGross(params, targetMonthlyInHand, "old");
  const better = newR && oldR ? (newR.gross <= oldR.gross ? "new" : "old") : "new";
  return { new: newR, old: oldR, better, recommended: better === "new" ? newR : oldR };
}

export function compareRegimes(params) {
  const newR = computeRegimeTax(params, "new");
  const oldR = computeRegimeTax(params, "old");
  const better = newR.totalTax <= oldR.totalTax ? "new" : "old";
  const savings = Math.abs(newR.totalTax - oldR.totalTax);
  return { new: newR, old: oldR, better, savings };
}

export function getReferenceData() {
  return {
    meta: TAX_META,
    newSlabs: NEW_SLABS,
    oldSlabs: OLD_SLABS,
    standardDeduction: STANDARD_DEDUCTION,
    rebate87A: REBATE_87A,
    cess: `${CESS_RATE * 100}% Health & Education Cess`,
    surcharge: [
      { range: "Up to ₹50 lakh", new: "Nil", old: "Nil" },
      { range: "₹50L – ₹1Cr", new: "10%", old: "10%" },
      { range: "₹1Cr – ₹2Cr", new: "15%", old: "15%" },
      { range: "₹2Cr – ₹5Cr", new: "25%", old: "25%" },
      { range: "Above ₹5Cr", new: "25% (cap)", old: "37%" },
    ],
    oldDeductions: [
      { name: "Section 80C", cap: "₹1,50,000", items: "EPF (employee), PPF, ELSS, LIC, home loan principal, tuition fees" },
      { name: "Section 80D", cap: "₹25,000 self + ₹50,000 parents", items: "Health insurance premiums" },
      { name: "Section 80CCD(1B)", cap: "₹50,000", items: "Additional NPS (self)" },
      { name: "Section 24(b)", cap: "₹2,00,000", items: "Home loan interest (self-occupied)" },
      { name: "HRA", cap: "Calculated", items: "House rent allowance exemption" },
      { name: "Standard deduction", cap: "₹50,000", items: "Salaried & pensioners" },
      { name: "Professional tax", cap: "₹2,500", items: "State professional tax paid" },
    ],
    newDeductions: [
      { name: "Standard deduction", cap: "₹75,000", items: "Salaried & pensioners" },
      { name: "Section 80CCD(2)", cap: "14% of basic", items: "Employer NPS contribution only" },
      { name: "Employer EPF", cap: "Tax-free within ₹7.5L", items: "Employer PF not deductible; excess employer EPF+NPS+superannuation is taxable" },
      { name: "Section 24(b)", cap: "Actual", items: "Home loan interest on let-out property only" },
      { name: "Family pension", cap: "₹25,000", items: "Deduction on family pension income" },
    ],
    notes: [
      "New tax regime is the default from FY 2023-24 onward; opt into old regime at filing if eligible.",
      "Section 87A: nil tax up to ₹12L taxable income (new) / ₹5L (old) for residents.",
      "Salaried under new regime: gross up to ~₹12.75L can be effectively tax-free with ₹75k standard deduction.",
      "Employer EPF + NPS + superannuation combined tax-free cap: ₹7.5 lakh/year — excess is taxable.",
      "Employee EPF (12% of basic) counts under Section 80C in the old regime only.",
      "This calculator is for planning only — verify with a CA or incometax.gov.in before filing.",
    ],
  };
}

/** Plain-language help for tax form fields (shown via ⓘ buttons) */
export const TAX_FIELD_HELP = {
  gross: {
    title: "Gross salary",
    body: "Your total annual salary before tax — includes basic, HRA, allowances, and bonuses as per Form 16 / salary slips. Do not subtract PF or tax already deducted.",
  },
  basic: {
    title: "Basic salary",
    body: "Annual basic component only (not gross). Needed for HRA exemption and employer NPS calculations. Usually 40–50% of CTC for salaried employees.",
  },
  age: {
    title: "Age category",
    body: "Affects old-regime tax slabs only. Senior citizen: 60–80 years (higher exemption). Super senior: 80+ years. New regime slabs are the same for all ages.",
  },
  stdDedNew: {
    title: "Standard deduction (new regime)",
    body: "₹75,000 automatically deducted for salaried employees and pensioners under the new regime. You don't need to enter anything — it's applied in the calculation.",
  },
  stdDedOld: {
    title: "Standard deduction (old regime)",
    body: "₹50,000 automatically deducted for salaried employees under the old regime. Applied automatically — no input needed.",
  },
  employerNpsNew: {
    title: "Employer NPS — new regime",
    body: "Employer's contribution to your NPS under Section 80CCD(2). Deductible up to 14% of basic salary in the new regime. Check your salary slip or HR for this amount.",
  },
  employerNpsOld: {
    title: "Employer NPS — old regime",
    body: "Employer's NPS contribution under Section 80CCD(2). Deductible up to 10% of basic in the old regime (14% in new). Combined employer EPF + NPS + superannuation cap: ₹7.5 lakh/year.",
  },
  sec80C: {
    title: "Section 80C",
    body: "Investments and expenses deductible up to ₹1,50,000/year — EPF, PPF, ELSS mutual funds, LIC premiums, home loan principal, children's tuition fees. Old regime only.",
  },
  sec80D: {
    title: "Section 80D — self & family",
    body: "Health insurance premium for you, spouse, and dependent children. Max ₹25,000/year (₹50,000 if you are 60+). Old regime only.",
  },
  sec80Dparents: {
    title: "Section 80D — parents",
    body: "Health insurance for parents. Max ₹25,000 (₹50,000 if parents are 60+). Can be combined with self/family 80D. Old regime only.",
  },
  nps1B: {
    title: "NPS 80CCD(1B)",
    body: "Extra ₹50,000 deduction for your own NPS contribution, over and above the ₹1.5L 80C limit. Old regime only.",
  },
  homeLoan: {
    title: "Home loan interest (24b)",
    body: "Interest paid on home loan for a self-occupied house. Deductible up to ₹2,00,000/year under old regime. Principal repayment goes under 80C.",
  },
  profTax: {
    title: "Professional tax",
    body: "State professional tax deducted from salary (e.g. ₹200/month in many states). Max ₹2,500/year deductible in old regime.",
  },
  hra: {
    title: "HRA exemption",
    body: "House Rent Allowance exemption — old regime only. Exemption is the lowest of: (1) actual HRA received, (2) rent paid minus 10% of basic, (3) 50% of basic (metro) or 40% (non-metro).",
  },
  hraReceived: {
    title: "HRA received",
    body: "Total HRA component in your salary for the year (annual). Found on your salary slip.",
  },
  hraRent: {
    title: "Rent paid",
    body: "Total rent you paid in the financial year. Keep rent receipts — required if claiming HRA.",
  },
  hraMetro: {
    title: "Metro city",
    body: "Delhi, Mumbai, Kolkata, and Chennai use the 50%-of-basic rule. All other cities use 40%.",
  },
  rebate87A: {
    title: "Rebate u/s 87A",
    body: "Tax rebate for resident individuals. New regime: up to ₹60,000 rebate if taxable income ≤ ₹12L (often zero tax up to ~₹12.75L gross with std deduction). Old regime: ₹12,500 if taxable income ≤ ₹5L.",
  },
  surcharge: {
    title: "Surcharge",
    body: "Extra tax on high incomes: 10% above ₹50L, 15% above ₹1Cr, 25% above ₹2Cr. Above ₹5Cr: capped at 25% (new) vs 37% (old). Applied on tax before cess.",
  },
  cess: {
    title: "Health & Education Cess",
    body: "4% levied on income tax plus surcharge. Applies in both regimes.",
  },
  newRegime: {
    title: "New tax regime",
    body: "Default from FY 2023-24. Lower slab rates, ₹75k standard deduction, and a higher 87A rebate. Most deductions (80C, HRA, 80D) are not allowed — only employer NPS and limited others.",
  },
  oldRegime: {
    title: "Old tax regime",
    body: "Opt-in at filing if you have significant deductions. Allows 80C, 80D, HRA, home loan interest, etc. Higher slab rates but can be cheaper if total deductions exceed ~₹3.5–4 lakh.",
  },
  pfEpf: {
    title: "Provident Fund (EPF)",
    body: "Employee and employer each typically contribute 12% of basic salary to EPF. Employee contribution is deducted from salary and qualifies for Section 80C (old regime). Employer contribution is not part of your salary but counts toward the ₹7.5 lakh/year tax-free employer contribution limit (with employer NPS and superannuation).",
  },
  pfEmployee: {
    title: "Employee PF contribution",
    body: "Your share of EPF deducted from salary — usually 12% of basic (or 12% of ₹15,000/month if wage ceiling applies). Counts under Section 80C up to the overall ₹1.5 lakh 80C limit in the old regime. Not a tax deduction in the new regime.",
  },
  pfEmployer: {
    title: "Employer PF contribution",
    body: "Employer's 12% EPF match is not added to your taxable salary if total employer EPF + NPS + superannuation stays within ₹7.5 lakh/year. Amount above that cap is taxed as a perquisite in both regimes.",
  },
  pfCeiling: {
    title: "PF wage ceiling",
    body: "Statutory EPF is often calculated on basic up to ₹15,000/month (₹1.8 lakh/year). Uncheck if your employer calculates PF on full basic (common in many private companies).",
  },
  pfIn80C: {
    title: "PF in Section 80C",
    body: "When enabled, your employee PF is automatically added to other 80C investments (PPF, ELSS, etc.) with a combined cap of ₹1,50,000 under the old regime.",
  },
  pfExcess: {
    title: "Taxable employer contributions",
    body: "If employer EPF + employer NPS + superannuation exceeds ₹7.5 lakh in a year, the excess is added to your taxable income as a perquisite under both regimes.",
  },
  sec80Cother: {
    title: "Other Section 80C",
    body: "80C investments besides employee PF — PPF, ELSS, LIC, home loan principal, tuition fees, etc. Combined with employee PF, the total 80C deduction is capped at ₹1,50,000.",
  },
  salaryTarget: {
    title: "Salary target (reverse calculator)",
    body: "Enter the monthly in-hand amount you need after income tax, employee PF, and professional tax. The calculator finds the gross salary (LPA) you should negotiate, using the same PF and deduction settings from the Calculator tab.",
  },
  basicEstimate: {
    title: "Estimated basic salary",
    body: "If you leave basic blank, we assume basic = 40% of gross for PF and NPS calculations. Enter your actual basic from your offer letter for accurate results.",
  },
};
