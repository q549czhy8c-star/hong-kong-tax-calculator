const TAX_YEARS = {
  2025: {
    label: "2025/26",
    allowances: {
      basic: 132000,
      married: 264000,
      singleParent: 132000,
      child: 130000,
      newbornExtra: 130000,
      sibling: 37500,
      parent60: 50000,
      parent55: 25000,
      parent60Living: 50000,
      parent55Living: 25000,
      disability: 75000,
      disabledDependant: 75000,
    },
    deductions: {
      mpf: 18000,
      education: 100000,
      elderCare: 100000,
      homeLoan: 120000,
      rent: 120000,
      vhisPerPerson: 8000,
      annuity: 60000,
      reproductive: 100000,
    },
    taxReduction: 3000,
    notes: [
      "薪俸稅以累進稅率或標準稅率計算，取較低者。",
      "2025/26 年度有 100% 一次性寬減，上限 HK$3,000。",
      "子女免稅額最多計算首 9 名子女；新生子女額外免稅額按 2025/26 規則計一次。",
    ],
  },
  2026: {
    label: "2026/27",
    allowances: {
      basic: 145000,
      married: 290000,
      singleParent: 145000,
      child: 140000,
      newbornExtra: 140000,
      sibling: 37500,
      parent60: 55000,
      parent55: 27500,
      parent60Living: 55000,
      parent55Living: 27500,
      disability: 75000,
      disabledDependant: 75000,
    },
    deductions: {
      mpf: 18000,
      education: 100000,
      elderCare: 110000,
      homeLoan: 120000,
      rent: 120000,
      vhisPerPerson: 8000,
      annuity: 60000,
      reproductive: 100000,
    },
    taxReduction: 0,
    notes: [
      "2026/27 起基本、已婚、單親、子女及供養父母/祖父母免稅額按預算案建議提高。",
      "長者住宿照顧開支扣除上限提高至 HK$110,000。",
      "合資格出生後首兩個課稅年度子女可計額外子女免稅額。",
    ],
  },
};

const PROGRESSIVE_BANDS = [
  { limit: 50000, rate: 0.02 },
  { limit: 50000, rate: 0.06 },
  { limit: 50000, rate: 0.1 },
  { limit: 50000, rate: 0.14 },
  { limit: Infinity, rate: 0.17 },
];

const PRH_INCOME_LIMITS = {
  1: 13090,
  2: 20230,
  3: 25100,
  4: 31000,
  5: 38650,
  6: 45440,
  7: 49930,
  8: 55830,
  9: 61570,
  10: 67180,
};

const PRH_RENT_PRESETS = {
  hkIsland: 82,
  kowloon: 92,
  nt: 74,
};

const FORECAST_PRESETS = {
  base: { salary: 5, prhRent: 3.41, fee: 2.5 },
  conservative: { salary: 3, prhRent: 3, fee: 2 },
  stress: { salary: 5, prhRent: 5, fee: 4 },
};

const STORAGE_KEY = "hkTaxCalculatorState";

const ids = [
  "income",
  "otherIncome",
  "status",
  "singleParent",
  "personalDisability",
  "spouseIncome",
  "spouseOtherIncome",
  "spouseMpf",
  "spouseEducation",
  "spouseHomeLoan",
  "spouseRent",
  "spouseVhis",
  "spouseVhisPeople",
  "spouseAnnuity",
  "spouseElderCare",
  "spouseDonations",
  "spouseReproductive",
  "spouseParents60",
  "spouseParents60Living",
  "spouseParents55",
  "spouseParents55Living",
  "children",
  "newborns",
  "siblings",
  "disabledDependants",
  "parents60",
  "parents60Living",
  "parents55",
  "parents55Living",
  "mpf",
  "education",
  "homeLoan",
  "rent",
  "vhis",
  "vhisPeople",
  "annuity",
  "elderCare",
  "donations",
  "reproductive",
  "prhMembers",
  "prhMonthlyIncome",
  "prhNetRent",
  "prhRentPreset",
  "prhFloorArea",
  "prhRates",
  "ratesPreset",
  "removedMembers",
  "removedMonthlyIncome",
  "lostParents60",
  "lostParents55",
  "lostParentLivingAllowance",
  "hosPrice",
  "hosDownPaymentPercent",
  "downPaymentPreset",
  "hosInterestRate",
  "interestPreset",
  "hosLoanYears",
  "loanYearsPreset",
  "hosMonthlyFees",
  "managementFeePreset",
  "comparisonYears",
  "forecastPreset",
  "salaryGrowthRate",
  "prhRentGrowthRate",
  "feeGrowthRate",
];

let activeYear = "2025";

const money = new Intl.NumberFormat("zh-HK", {
  style: "currency",
  currency: "HKD",
  maximumFractionDigits: 0,
});

function value(id) {
  const field = document.getElementById(id);
  if (field.type === "checkbox") return field.checked;
  if (field.tagName === "SELECT") return field.value;
  return Math.max(0, Number(field.value) || 0);
}

function setNumberValue(id, amount) {
  document.getElementById(id).value = Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function setStatus(message) {
  const status = document.getElementById("saveStatus");
  status.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    status.textContent = "";
  }, 3000);
}

function cap(amount, max) {
  return Math.min(Math.max(0, amount), max);
}

function progressiveTax(netChargeableIncome) {
  let remaining = Math.max(0, netChargeableIncome);
  let total = 0;

  for (const band of PROGRESSIVE_BANDS) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, band.limit);
    total += taxable * band.rate;
    remaining -= taxable;
  }

  return total;
}

function progressiveBreakdown(netChargeableIncome) {
  let remaining = Math.max(0, netChargeableIncome);
  let lowerLimit = 0;

  return PROGRESSIVE_BANDS.map((band) => {
    const taxable = Math.min(remaining, band.limit);
    const tax = Math.max(0, taxable) * band.rate;
    const upperLimit = band.limit === Infinity ? Infinity : lowerLimit + band.limit;
    remaining = Math.max(0, remaining - band.limit);

    const item = {
      lowerLimit,
      upperLimit,
      taxable: Math.max(0, taxable),
      rate: band.rate,
      tax,
    };
    lowerLimit = upperLimit;
    return item;
  });
}

function standardTax(netIncome) {
  const income = Math.max(0, netIncome);
  const firstTier = Math.min(income, 5000000) * 0.15;
  const secondTier = Math.max(0, income - 5000000) * 0.16;
  return firstTier + secondTier;
}

function calculatePerson(prefix, rules) {
  const d = rules.deductions;
  const grossIncome = value(fieldId(prefix, "income")) + value(fieldId(prefix, "otherIncome"));

  const ordinaryDeductions =
    cap(value(fieldId(prefix, "mpf")), d.mpf) +
    cap(value(fieldId(prefix, "education")), d.education) +
    cap(value(fieldId(prefix, "homeLoan")), d.homeLoan) +
    cap(value(fieldId(prefix, "rent")), d.rent) +
    cap(value(fieldId(prefix, "vhis")), d.vhisPerPerson * value(fieldId(prefix, "vhisPeople"))) +
    cap(value(fieldId(prefix, "annuity")), d.annuity) +
    cap(value(fieldId(prefix, "elderCare")), d.elderCare) +
    cap(value(fieldId(prefix, "reproductive")), d.reproductive);

  const donationBase = Math.max(0, grossIncome - ordinaryDeductions);
  const donations = cap(value(fieldId(prefix, "donations")), donationBase * 0.35);
  const deductions = ordinaryDeductions + donations;
  const netIncome = Math.max(0, grossIncome - deductions);

  return {
    grossIncome,
    ordinaryDeductions,
    donations,
    deductions,
    netIncome,
  };
}

function fieldId(prefix, name) {
  if (!prefix) return name;
  return `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

function taxAfterReduction(baseTax, rules) {
  const reduction = Math.min(baseTax, rules.taxReduction);
  return {
    reduction,
    taxPayable: Math.max(0, baseTax - reduction),
  };
}

function calculateTax(netIncome, allowances, rules) {
  const netChargeable = Math.max(0, netIncome - allowances);
  const progressive = progressiveTax(netChargeable);
  const standard = standardTax(netIncome);
  const baseTax = Math.min(progressive, standard);

  return {
    netChargeable,
    progressive,
    standard,
    baseTax,
    ...taxAfterReduction(baseTax, rules),
  };
}

function calculateSharedAllowances(rules, isMarried) {
  const a = rules.allowances;
  const children = Math.min(9, value("children"));
  const newborns = Math.min(children, value("newborns"));

  return (
    (value("singleParent") ? a.singleParent : 0) +
    children * a.child +
    newborns * a.newbornExtra +
    value("siblings") * a.sibling +
    value("disabledDependants") * a.disabledDependant +
    parentAllowances("", a) +
    (isMarried ? parentAllowances("spouse", a) : 0)
  );
}

function parentAllowances(prefix, allowances) {
  return (
    value(fieldId(prefix, "parents60")) * allowances.parent60 +
    value(fieldId(prefix, "parents60Living")) * allowances.parent60Living +
    value(fieldId(prefix, "parents55")) * allowances.parent55 +
    value(fieldId(prefix, "parents55Living")) * allowances.parent55Living
  );
}

function calculate() {
  const rules = TAX_YEARS[activeYear];
  const a = rules.allowances;
  const isMarried = value("status") === "married";
  const person = calculatePerson("", rules);
  const spouse = isMarried ? calculatePerson("spouse", rules) : emptyPerson();
  const sharedAllowances = calculateSharedAllowances(rules, isMarried);
  const disabilityAllowance = value("personalDisability") ? a.disability : 0;
  const individualAllowances = a.basic + disabilityAllowance + calculateSharedAllowancesForPrimary(rules);
  const allowances = (isMarried ? a.married : a.basic) + disabilityAllowance + sharedAllowances;
  const spouseAllowances = isMarried ? a.basic + parentAllowances("spouse", a) : 0;
  const jointNetIncome = person.netIncome + spouse.netIncome;
  const jointGrossIncome = person.grossIncome + spouse.grossIncome;
  const jointDeductions = person.deductions + spouse.deductions;
  const jointResult = calculateTax(jointNetIncome, allowances, rules);
  const singleResult = calculateTax(person.netIncome, individualAllowances, rules);
  const spouseSeparateResult = isMarried ? calculateTax(spouse.netIncome, spouseAllowances, rules) : zeroTax();
  const separateTaxPayable = singleResult.taxPayable + spouseSeparateResult.taxPayable;
  const result = isMarried ? jointResult : singleResult;
  const grossIncome = isMarried ? jointGrossIncome : person.grossIncome;
  const deductions = isMarried ? jointDeductions : person.deductions;

  renderSummary({
    grossIncome,
    deductions,
    allowances,
    netIncome: isMarried ? jointNetIncome : person.netIncome,
    netChargeable: result.netChargeable,
    progressive: result.progressive,
    standard: result.standard,
    baseTax: result.baseTax,
    reduction: result.reduction,
    taxPayable: result.taxPayable,
    jointTax: jointResult.taxPayable,
    separateTax: isMarried ? separateTaxPayable : singleResult.taxPayable,
    assessmentMode: isMarried ? "合併" : "個人",
    isMarried,
    person,
    spouse,
    singleResult,
    spouseSeparateResult,
    spouseAllowance: spouseAllowances,
  });
}

function calculateSharedAllowancesForPrimary(rules) {
  const a = rules.allowances;
  const children = Math.min(9, value("children"));
  const newborns = Math.min(children, value("newborns"));

  return (
    (value("singleParent") ? a.singleParent : 0) +
    children * a.child +
    newborns * a.newbornExtra +
    value("siblings") * a.sibling +
    value("disabledDependants") * a.disabledDependant +
    parentAllowances("", a)
  );
}

function emptyPerson() {
  return {
    grossIncome: 0,
    ordinaryDeductions: 0,
    donations: 0,
    deductions: 0,
    netIncome: 0,
  };
}

function zeroTax() {
  return {
    netChargeable: 0,
    progressive: 0,
    standard: 0,
    baseTax: 0,
    reduction: 0,
    taxPayable: 0,
  };
}

function renderSummary(result) {
  const fields = {
    taxPayable: result.taxPayable,
    grossIncome: result.grossIncome,
    deductions: result.deductions,
    allowances: result.allowances,
    netChargeable: result.netChargeable,
    progressiveTax: result.progressive,
    standardTax: result.standard,
    baseTax: result.baseTax,
    reduction: result.reduction,
    jointTax: result.jointTax,
    separateTax: result.separateTax,
    spouseGrossIncome: result.spouse.grossIncome,
    spouseDeductions: result.spouse.deductions,
    spouseAllowances: result.spouseAllowance,
    spouseNetChargeable: result.spouseSeparateResult.netChargeable,
    spouseProgressiveTax: result.spouseSeparateResult.progressive,
    spouseStandardTax: result.spouseSeparateResult.standard,
    spouseTaxPayable: result.spouseSeparateResult.taxPayable,
  };

  for (const [id, amount] of Object.entries(fields)) {
    document.getElementById(id).textContent = money.format(Math.round(amount));
  }

  document.getElementById("assessmentMode").textContent = result.assessmentMode;
  document.getElementById("spouseSection").classList.toggle("visible", result.isMarried);
  document.getElementById("spouseBanner").classList.toggle("visible", result.isMarried);
  renderProgressiveFormula(result);
  renderSpouseFormula(result);
  renderAdvice(result);
  renderHousingComparison(result);
  renderNotes();
  drawChart(result);
}

function renderProgressiveFormula(result) {
  renderFormulaList("progressiveFormula", result.netChargeable, result.progressive);
}

function renderSpouseFormula(result) {
  renderFormulaList("spouseProgressiveFormula", result.spouseSeparateResult.netChargeable, result.spouseSeparateResult.progressive);
}

function renderFormulaList(listId, netChargeable, progressive) {
  const list = document.getElementById(listId);
  const bands = progressiveBreakdown(netChargeable);
  list.innerHTML = "";
  bands.forEach((band) => {
    const item = document.createElement("li");
    const range =
      band.upperLimit === Infinity
        ? `${money.format(band.lowerLimit + 1)} 以上`
        : `${money.format(band.lowerLimit + 1)} - ${money.format(band.upperLimit)}`;
    item.innerHTML = `${range}：${money.format(Math.round(band.taxable))} × ${(band.rate * 100).toFixed(0)}% = <strong>${money.format(Math.round(band.tax))}</strong>`;
    list.appendChild(item);
  });

  const total = document.createElement("li");
  total.innerHTML = `累進稅款合計：<strong>${money.format(Math.round(progressive))}</strong>`;
  list.appendChild(total);
}

function renderHousingComparison(taxResult) {
  applyReferencePresets();
  const rules = TAX_YEARS[activeYear];
  const marginalRate = estimateMarginalRate(taxResult);
  const years = Math.max(1, value("comparisonYears"));
  const months = years * 12;
  const currentPrh = calculatePrhRent(value("prhMembers"), value("prhMonthlyIncome"), value("prhNetRent"), value("prhRates"));
  const removedPrh = calculatePrhRent(value("removedMembers"), value("removedMonthlyIncome"), value("prhNetRent"), value("prhRates"));
  const parentTaxCost = calculateLostParentTaxCost(taxResult, rules);
  const mortgage = calculateMortgage();
  const annualHomeLoanTaxSaving = calculateHomeLoanTaxSaving(mortgage.firstYearInterest, rules, marginalRate);

  const currentPrhTotal = currentPrh.monthlyRent * months;
  const removedPrhTotal = removedPrh.monthlyRent * months + parentTaxCost * years;
  const hosTotal = mortgage.downPayment + (mortgage.monthlyPayment + value("hosMonthlyFees")) * months - annualHomeLoanTaxSaving * years;

  const fields = {
    currentPrhRent: currentPrh.monthlyRent,
    removedPrhRent: removedPrh.monthlyRent,
    parentTaxCost,
    hosMortgage: mortgage.monthlyPayment,
    homeLoanTaxSaving: annualHomeLoanTaxSaving,
    currentPrhTotal,
    removedPrhTotal,
    hosTotal,
  };

  for (const [id, amount] of Object.entries(fields)) {
    document.getElementById(id).textContent = money.format(Math.round(amount));
  }

  renderHousingRecommendation([
    { label: "維持現公屋申報", total: currentPrhTotal },
    { label: "除名後保留公屋", total: removedPrhTotal },
    { label: "申請居屋供樓", total: hosTotal },
  ]);
  renderHousingWarnings({
    currentPrh,
    removedPrh,
    mortgage,
    annualHomeLoanTaxSaving,
    marginalRate,
    years,
  });
  renderForecastBudget(taxResult, {
    currentPrh,
    removedPrh,
    mortgage,
    annualHomeLoanTaxSaving,
    parentTaxCost,
  });
}

function applyReferencePresets() {
  const rentPreset = value("prhRentPreset");
  if (rentPreset !== "custom") {
    setNumberValue("prhNetRent", (PRH_RENT_PRESETS[rentPreset] || 0) * value("prhFloorArea"));
  }

  const ratesPreset = value("ratesPreset");
  if (ratesPreset === "none") {
    setNumberValue("prhRates", 0);
  } else if (ratesPreset === "rvd5") {
    setNumberValue("prhRates", value("prhNetRent") * 0.05);
  } else if (ratesPreset !== "custom") {
    setNumberValue("prhRates", Number(ratesPreset));
  }

  applyNumericPreset("downPaymentPreset", "hosDownPaymentPercent");
  applyNumericPreset("interestPreset", "hosInterestRate");
  applyNumericPreset("loanYearsPreset", "hosLoanYears");
  applyNumericPreset("managementFeePreset", "hosMonthlyFees");
  applyForecastPreset();
}

function applyNumericPreset(selectId, inputId) {
  const preset = value(selectId);
  if (preset === "custom") return;
  setNumberValue(inputId, Number(preset));
}

function applyForecastPreset() {
  const preset = value("forecastPreset");
  if (preset === "custom" || !FORECAST_PRESETS[preset]) return;
  setNumberValue("salaryGrowthRate", FORECAST_PRESETS[preset].salary);
  setNumberValue("prhRentGrowthRate", FORECAST_PRESETS[preset].prhRent);
  setNumberValue("feeGrowthRate", FORECAST_PRESETS[preset].fee);
}

function calculatePrhRent(members, monthlyIncome, netRent, rates) {
  const householdSize = Math.min(10, Math.max(1, Math.round(members)));
  const incomeLimit = PRH_INCOME_LIMITS[householdSize] || PRH_INCOME_LIMITS[10];
  const ratio = incomeLimit > 0 ? monthlyIncome / incomeLimit : 0;
  let multiplier = 1;
  let status = "一般租金";

  if (ratio > 5) {
    multiplier = 4.5;
    status = "超過 5 倍入息限額，或須遷出";
  } else if (ratio > 4) {
    multiplier = 4.5;
    status = "4 至 5 倍入息限額";
  } else if (ratio > 3) {
    multiplier = 3.5;
    status = "3 至 4 倍入息限額";
  } else if (ratio > 2) {
    multiplier = 2.5;
    status = "2 至 3 倍入息限額";
  }

  return {
    householdSize,
    incomeLimit,
    ratio,
    multiplier,
    status,
    monthlyRent: netRent * multiplier + rates,
  };
}

function calculateLostParentTaxCost(taxResult, rules) {
  const a = rules.allowances;
  const livingMultiplier = value("lostParentLivingAllowance") ? 1 : 0;
  const lostAllowance =
    value("lostParents60") * (a.parent60 + a.parent60Living * livingMultiplier) +
    value("lostParents55") * (a.parent55 + a.parent55Living * livingMultiplier);
  if (lostAllowance <= 0) return 0;

  const recalculated = calculateTax(taxResult.netIncome, Math.max(0, taxResult.allowances - lostAllowance), rules);
  return Math.max(0, recalculated.taxPayable - taxResult.taxPayable);
}

function calculateMortgage() {
  const price = value("hosPrice");
  const downPayment = price * cap(value("hosDownPaymentPercent"), 100) / 100;
  const loanAmount = Math.max(0, price - downPayment);
  const months = Math.max(1, value("hosLoanYears") * 12);
  const monthlyRate = value("hosInterestRate") / 100 / 12;
  const monthlyPayment =
    monthlyRate === 0
      ? loanAmount / months
      : (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));

  return {
    price,
    downPayment,
    loanAmount,
    monthlyPayment,
    firstYearInterest: firstYearInterest(loanAmount, monthlyPayment, monthlyRate),
  };
}

function firstYearInterest(loanAmount, monthlyPayment, monthlyRate) {
  let balance = loanAmount;
  let interestTotal = 0;

  for (let month = 0; month < 12 && balance > 0; month += 1) {
    const interest = balance * monthlyRate;
    const principal = monthlyPayment - interest;
    interestTotal += interest;
    balance = Math.max(0, balance - principal);
  }

  return interestTotal;
}

function calculateHomeLoanTaxSaving(firstYearInterestAmount, rules, marginalRate) {
  const deductibleInterest = Math.min(firstYearInterestAmount, rules.deductions.homeLoan);
  return deductibleInterest * marginalRate;
}

function renderForecastBudget(taxResult, housing) {
  const rules = TAX_YEARS[activeYear];
  const projectionYears = Math.min(30, Math.max(1, Math.round(value("comparisonYears"))));
  const salaryGrowth = value("salaryGrowthRate") / 100;
  const rentGrowth = value("prhRentGrowthRate") / 100;
  const feeGrowth = value("feeGrowthRate") / 100;
  const monthlyRate = value("hosInterestRate") / 100 / 12;
  let mortgageBalance = housing.mortgage.loanAmount;
  const rows = [];
  const totals = {
    current: 0,
    removed: 0,
    hos: housing.mortgage.downPayment,
  };
  const detailTotals = {
    currentRent: 0,
    removedRent: 0,
    parentTaxCost: 0,
    mortgagePayments: 0,
    fees: 0,
    homeLoanSaving: 0,
    downPayment: housing.mortgage.downPayment,
  };

  for (let year = 1; year <= projectionYears; year += 1) {
    const incomeFactor = Math.pow(1 + salaryGrowth, year - 1);
    const rentFactor = Math.pow(1 + rentGrowth, year - 1);
    const feeFactor = Math.pow(1 + feeGrowth, year - 1);
    const projectedTax = projectedTaxResult(taxResult, incomeFactor, rules);
    const currentRent = calculatePrhRent(
      value("prhMembers"),
      value("prhMonthlyIncome") * incomeFactor,
      value("prhNetRent") * rentFactor,
      value("prhRates") * rentFactor,
    ).monthlyRent;
    const removedRent = calculatePrhRent(
      value("removedMembers"),
      value("removedMonthlyIncome") * incomeFactor,
      value("prhNetRent") * rentFactor,
      value("prhRates") * rentFactor,
    ).monthlyRent;
    const parentTaxCost = calculateLostParentTaxCost(projectedTax, rules);
    const amortization = annualMortgageAmortization(mortgageBalance, housing.mortgage.monthlyPayment, monthlyRate, year <= value("hosLoanYears"));
    mortgageBalance = amortization.endingBalance;
    const interest = amortization.interest;
    const homeLoanSaving = calculateHomeLoanTaxSaving(interest, rules, estimateMarginalRate(projectedTax));
    const mortgagePayments = year <= value("hosLoanYears") ? housing.mortgage.monthlyPayment * 12 : 0;
    const fees = value("hosMonthlyFees") * feeFactor * 12;
    const currentAnnual = currentRent * 12;
    const removedAnnual = removedRent * 12 + parentTaxCost;
    const hosAnnual = mortgagePayments + fees - homeLoanSaving;

    totals.current += currentAnnual;
    totals.removed += removedAnnual;
    totals.hos += hosAnnual;
    detailTotals.currentRent += currentAnnual;
    detailTotals.removedRent += removedRent * 12;
    detailTotals.parentTaxCost += parentTaxCost;
    detailTotals.mortgagePayments += mortgagePayments;
    detailTotals.fees += fees;
    detailTotals.homeLoanSaving += homeLoanSaving;

    rows.push({
      year,
      income: value("prhMonthlyIncome") * incomeFactor,
      current: currentAnnual,
      removed: removedAnnual,
      hos: hosAnnual,
      parentTaxCost,
      homeLoanSaving,
    });
  }

  document.getElementById("forecastTitle").textContent = `未來 ${projectionYears} 年支出預算`;
  document.getElementById("forecastCurrentLabel").textContent = `${projectionYears} 年現公屋總支出`;
  document.getElementById("forecastRemovedLabel").textContent = `${projectionYears} 年除名方案總支出`;
  document.getElementById("forecastHosLabel").textContent = `${projectionYears} 年居屋現金流支出`;
  document.getElementById("forecastCurrentTotal").textContent = money.format(Math.round(totals.current));
  document.getElementById("forecastRemovedTotal").textContent = money.format(Math.round(totals.removed));
  document.getElementById("forecastHosTotal").textContent = money.format(Math.round(totals.hos));
  document.getElementById("forecastBestOption").textContent = forecastBestOption(totals);
  renderForecastBreakdowns(detailTotals, totals, projectionYears);
  renderForecastRows(rows);
}

function renderForecastBreakdowns(details, totals, years) {
  renderSimpleList("forecastCurrentBreakdown", [
    `逐年公屋租金合計：${money.format(Math.round(details.currentRent))}`,
    `公式：每年租金 = 當年淨租金 × 富戶倍數 × 12 + 差餉 × 12`,
    `${years} 年總支出：${money.format(Math.round(totals.current))}`,
  ]);
  renderSimpleList("forecastRemovedBreakdown", [
    `逐年除名後公屋租金合計：${money.format(Math.round(details.removedRent))}`,
    `失去父母免稅額稅務成本合計：${money.format(Math.round(details.parentTaxCost))}`,
    `公式：租金 + 重算稅款差額`,
    `${years} 年總支出：${money.format(Math.round(totals.removed))}`,
  ]);
  renderSimpleList("forecastHosBreakdown", [
    `首期：${money.format(Math.round(details.downPayment))}`,
    `供款合計：${money.format(Math.round(details.mortgagePayments))}`,
    `管理費 / 維修合計：${money.format(Math.round(details.fees))}`,
    `供樓利息扣稅合計：-${money.format(Math.round(details.homeLoanSaving))}`,
    `公式：首期 + 供款 + 管理費/維修 - 供樓利息扣稅`,
  ]);
}

function renderSimpleList(id, items) {
  const list = document.getElementById(id);
  list.innerHTML = "";
  items.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    list.appendChild(item);
  });
}

function projectedTaxResult(taxResult, incomeFactor, rules) {
  const netIncome = taxResult.netIncome * incomeFactor;
  const projected = calculateTax(netIncome, taxResult.allowances, rules);
  return {
    ...taxResult,
    ...projected,
    netIncome,
  };
}

function annualMortgageAmortization(startingBalance, monthlyPayment, monthlyRate, isActive) {
  let workingBalance = startingBalance;
  let interestTotal = 0;

  for (let month = 0; month < 12 && workingBalance > 0 && isActive; month += 1) {
    const interest = workingBalance * monthlyRate;
    const principal = monthlyPayment - interest;
    interestTotal += interest;
    workingBalance = Math.max(0, workingBalance - principal);
  }

  return {
    interest: interestTotal,
    endingBalance: workingBalance,
  };
}

function forecastBestOption(totals) {
  const options = [
    { label: "維持現公屋申報", total: totals.current },
    { label: "除名後保留公屋", total: totals.removed },
    { label: "申請居屋供樓", total: totals.hos },
  ];
  return options.sort((first, second) => first.total - second.total)[0].label;
}

function renderForecastRows(rows) {
  const body = document.getElementById("forecastRows");
  body.innerHTML = "";

  rows.forEach((row) => {
    const item = document.createElement("tr");
    item.innerHTML = `
      <td>第 ${row.year} 年</td>
      <td>${money.format(Math.round(row.income))}</td>
      <td>${money.format(Math.round(row.current))}</td>
      <td>${money.format(Math.round(row.removed))}</td>
      <td>${money.format(Math.round(row.hos))}</td>
      <td>${money.format(Math.round(row.parentTaxCost))}</td>
      <td>-${money.format(Math.round(row.homeLoanSaving))}</td>
    `;
    body.appendChild(item);
  });
}

function renderHousingRecommendation(options) {
  const recommendation = [...options].sort((first, second) => first.total - second.total)[0];
  document.getElementById("housingRecommendation").textContent =
    `以現金流計，${recommendation.label}在比較期內最低，約 ${money.format(Math.round(recommendation.total))}。`;
}

function renderHousingWarnings(details) {
  const list = document.getElementById("housingWarnings");
  const warnings = [
    `現公屋租金狀態：${details.currentPrh.status}；除名後狀態：${details.removedPrh.status}。`,
    "公屋租金參考採用房委會 2025 年按地區每平方米平均月租；實際租金、差餉和寬減以租約及繳款通知為準。",
    "房委會由 2025 年 10 月申報周期起按 2.5 / 3.5 / 4.5 倍淨租金另加差餉計算富戶額外租金。",
    "首期、利率、年期和管理費參考值只作快速套用，銀行可按個案調整或拒批按揭。",
    "購買居屋 / 資助出售單位後，公屋戶主及成員須按房委會規定申報，並在指定階段交回單位或刪除戶籍。",
    "居屋比較是現金流估算，未計樓價升跌、轉售補地價、印花稅、裝修、律師費及保險。",
  ];

  if (details.currentPrh.ratio > 5 || details.removedPrh.ratio > 5) {
    warnings.push("家庭入息如超過 5 倍公屋入息限額，可能不只是加租，而是涉及遷出要求。");
  }

  if (details.annualHomeLoanTaxSaving > 0) {
    warnings.push(`如居屋作自住並符合稅務條件，首年供樓利息可帶來約 ${money.format(Math.round(details.annualHomeLoanTaxSaving))} 稅務節省；實際以 IRD 批核為準。`);
  } else if (details.mortgage.firstYearInterest > 0) {
    warnings.push("有供樓利息，但現時估算邊際稅率為 0 或沒有應繳稅款，供樓免稅額未必即時慳稅。");
  }

  list.innerHTML = "";
  warnings.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    list.appendChild(item);
  });
}

function collectFormState() {
  const state = { activeYear, fields: {} };

  ids.forEach((id) => {
    const field = document.getElementById(id);
    state.fields[id] = field.type === "checkbox" ? field.checked : field.value;
  });

  return state;
}

function applyFormState(state) {
  if (!state || !state.fields) return false;

  activeYear = state.activeYear || activeYear;
  document.querySelectorAll("[data-year]").forEach((button) => {
    button.classList.toggle("active", button.dataset.year === activeYear);
  });

  ids.forEach((id) => {
    const field = document.getElementById(id);
    if (!field || state.fields[id] === undefined) return;
    if (field.type === "checkbox") {
      field.checked = Boolean(state.fields[id]);
    } else {
      field.value = state.fields[id];
    }
  });

  calculate();
  return true;
}

function saveFormState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collectFormState()));
  setStatus("已保存到此瀏覽器");
}

function loadFormState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? applyFormState(JSON.parse(saved)) : false;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

function clearFormState() {
  localStorage.removeItem(STORAGE_KEY);
  document.getElementById("tax-form").reset();
  activeYear = "2025";
  document.querySelectorAll("[data-year]").forEach((button) => {
    button.classList.toggle("active", button.dataset.year === activeYear);
  });
  calculate();
  setStatus("已清除並回復預設值");
}

function renderAdvice(result) {
  const list = document.getElementById("adviceList");
  const rules = TAX_YEARS[activeYear];
  const d = rules.deductions;
  const rate = estimateMarginalRate(result);
  const items = [];

  if (result.isMarried && result.spouse.grossIncome === 0) {
    items.push("合併評稅要填配偶入息及扣除額；如果留空，估算只反映你的資料。");
  }

  if (result.isMarried) {
    const difference = result.separateTax - result.jointTax;
    if (difference > 0) {
      items.push(`按現有資料，合併評稅比粗略分開評稅少約 ${money.format(Math.round(difference))}。`);
    } else if (difference < 0) {
      items.push(`按現有資料，分開評稅或會比合併少約 ${money.format(Math.round(Math.abs(difference)))}。`);
    } else {
      items.push("合併與分開評稅暫時相若；可再輸入配偶扣除額比較。");
    }
  }

  if (rate === 0) {
    items.push("現時估算未有應繳稅款，新增扣除額未必即時慳稅。");
  }

  addCapAdvice(items, "年金 / TVC", value("annuity"), d.annuity, rate);
  addCapAdvice(items, "自我進修開支", value("education"), d.education, rate);
  addCapAdvice(items, "VHIS 保費", value("vhis"), d.vhisPerPerson * value("vhisPeople"), rate);
  addCapAdvice(items, "長者住宿照顧開支", value("elderCare"), d.elderCare, rate);
  addCapAdvice(items, "輔助生育服務開支", value("reproductive"), d.reproductive, rate);

  if (result.isMarried) {
    addCapAdvice(items, "配偶年金 / TVC", value("spouseAnnuity"), d.annuity, rate);
    addCapAdvice(items, "配偶 VHIS 保費", value("spouseVhis"), d.vhisPerPerson * value("spouseVhisPeople"), rate);
  }

  const spouseDonations = result.isMarried ? value("spouseDonations") : 0;
  const donationCap = Math.max(0, (result.grossIncome - result.deductions + result.person.donations + result.spouse.donations) * 0.35);
  addCapAdvice(items, "認可慈善捐款", value("donations") + spouseDonations, donationCap, rate);

  if (value("homeLoan") > 0 && value("rent") > 0) {
    items.push("你同時輸入居所貸款利息及住宅租金；實際可否同時扣除要按資格及 IRD 規則確認。");
  }

  if (items.length === 0) {
    items.push("暫時未見明顯扣減空間；可補充 VHIS 人數、TVC、慈善捐款或配偶資料再估算。");
  }

  list.innerHTML = "";
  items.slice(0, 7).forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    list.appendChild(item);
  });
}

function addCapAdvice(items, label, used, limit, rate) {
  const remaining = Math.max(0, limit - used);
  if (limit <= 0 || remaining <= 0 || rate <= 0) return;
  const saving = remaining * rate;
  items.push(`${label}仍有約 ${money.format(Math.round(remaining))} 上限；若合資格，按現時邊際稅率可慳約 ${money.format(Math.round(saving))}。`);
}

function estimateMarginalRate(result) {
  if (result.baseTax <= 0 || result.netChargeable <= 0) return 0;
  if (result.standard <= result.progressive) return result.netChargeable > 5000000 ? 0.16 : 0.15;
  if (result.netChargeable <= 50000) return 0.02;
  if (result.netChargeable <= 100000) return 0.06;
  if (result.netChargeable <= 150000) return 0.1;
  if (result.netChargeable <= 200000) return 0.14;
  return 0.17;
}

function renderNotes() {
  const list = document.getElementById("ruleNotes");
  list.innerHTML = "";

  TAX_YEARS[activeYear].notes.forEach((note) => {
    const item = document.createElement("li");
    item.textContent = note;
    list.appendChild(item);
  });
}

function drawChart(result) {
  const canvas = document.getElementById("taxChart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth * dpr;
  const height = canvas.clientHeight * dpr;
  canvas.width = width;
  canvas.height = height;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  const items = [
    { label: "累進", value: result.progressive, color: "#ffffff" },
    { label: "標準", value: result.standard, color: "#f2c46d" },
    { label: "寬減後", value: result.taxPayable, color: "#69d2cb" },
  ];
  const max = Math.max(1, ...items.map((item) => item.value));
  const chartWidth = canvas.clientWidth - 96;
  const rowHeight = 42;

  ctx.font = "700 13px system-ui, sans-serif";
  ctx.textBaseline = "middle";

  items.forEach((item, index) => {
    const y = 22 + index * rowHeight;
    const barWidth = Math.max(3, (item.value / max) * (chartWidth - 112));
    const amount = money.format(Math.round(item.value));

    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(54, y, chartWidth, 18);
    ctx.fillStyle = item.color;
    ctx.fillRect(54, y, barWidth, 18);
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.fillText(item.label, 0, y + 9);
    ctx.fillText(amount, 62 + barWidth, y + 9);
  });
}

document.querySelectorAll("[data-year]").forEach((button) => {
  button.addEventListener("click", () => {
    activeYear = button.dataset.year;
    document.querySelectorAll("[data-year]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    calculate();
  });
});

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panel === tab);
    });
  });
});

ids.forEach((id) => {
  document.getElementById(id).addEventListener("input", calculate);
  document.getElementById(id).addEventListener("change", calculate);
});

document.getElementById("saveData").addEventListener("click", saveFormState);
document.getElementById("clearData").addEventListener("click", clearFormState);
document.getElementById("printPdf").addEventListener("click", () => {
  setStatus("請在列印視窗選擇另存為 PDF");
  window.print();
});

if (!loadFormState()) {
  calculate();
}
