const TAX_RULES = window.HK_TAX_RULES;
const TAX_ENGINE = window.HKTaxEngine;
const TAX_YEARS = TAX_RULES.years;
const PROGRESSIVE_BANDS = TAX_RULES.progressiveBands;

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
  base: { salary: 5, prhRent: 3.41, parentAllowance: 1.6, fee: 2.5 },
  conservative: { salary: 3, prhRent: 3, parentAllowance: 1.6, fee: 2 },
  stress: { salary: 5, prhRent: 5, parentAllowance: 1.6, fee: 4 },
};

const STORAGE_KEY = "hkTaxCalculatorState";

const ids = [
  "income",
  "otherIncome",
  "employmentMode",
  "basicSalary",
  "bonus",
  "commission",
  "directorFee",
  "cashAllowances",
  "housingAllowance",
  "rentalReimbursement",
  "actualRent",
  "employeeRentPaid",
  "housingMonths",
  "accommodationType",
  "employerScheme",
  "employerControl",
  "rentDocuments",
  "equityAwards",
  "gratuity",
  "taxableBenefits",
  "housingTreatment",
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
  "parentAllowanceGrowthRate",
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
  return TAX_ENGINE.cap(amount, max);
}

function progressiveTax(netChargeableIncome) {
  return TAX_ENGINE.progressiveTax(netChargeableIncome, TAX_RULES);
}

function progressiveBreakdown(netChargeableIncome) {
  return TAX_ENGINE.progressiveBreakdown(netChargeableIncome, TAX_RULES);
}

function standardTax(netIncome) {
  return TAX_ENGINE.standardTax(netIncome, TAX_RULES);
}

function calculatePerson(prefix, rules) {
  const d = rules.deductions;
  const employment = calculateEmploymentIncome(prefix);
  const grossIncome = employment.assessableIncome + value(fieldId(prefix, "otherIncome"));
  const hasQualifyingChild = value("children") > 0;
  const homeLoanLimit = TAX_ENGINE.housingDeductionLimit(rules, hasQualifyingChild, "homeLoan");
  const rentLimit = TAX_ENGINE.housingDeductionLimit(rules, hasQualifyingChild, "rent");

  const ordinaryDeductions =
    cap(value(fieldId(prefix, "mpf")), d.mpf) +
    cap(value(fieldId(prefix, "education")), d.education) +
    cap(value(fieldId(prefix, "homeLoan")), homeLoanLimit) +
    cap(value(fieldId(prefix, "rent")), rentLimit) +
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
    employment,
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

function calculateEmploymentIncome(prefix) {
  if (prefix || value("employmentMode") !== "advanced") {
    const assessableIncome = value(fieldId(prefix, "income"));
    return {
      mode: "simple",
      cashEmploymentIncome: assessableIncome,
      assessableIncome,
      housingBenefit: {
        treatment: "none",
        eligibilityStatus: "NOT_APPLICABLE",
        taxableHousingAmount: 0,
        rentalValue: 0,
        cashEquivalent: 0,
        percentage: 0,
        months: 0,
        warnings: [],
      },
      normalCashScenarioIncome: assessableIncome,
    };
  }

  const cashEmploymentIncome =
    value("basicSalary") +
    value("bonus") +
    value("commission") +
    value("directorFee") +
    value("cashAllowances") +
    value("housingAllowance") +
    value("equityAwards") +
    value("gratuity") +
    value("taxableBenefits");
  const treatment = value("housingTreatment");
  const cashHousingAmount = treatment === "cashAllowance" ? value("rentalReimbursement") : 0;
  const housingBenefit = TAX_ENGINE.calculateHousingBenefit(
    {
      treatment,
      cashIncomeBase: cashEmploymentIncome,
      reimbursed: value("rentalReimbursement"),
      actualRent: value("actualRent"),
      employeeRentPaid: value("employeeRentPaid"),
      months: value("housingMonths"),
      accommodationType: value("accommodationType"),
      employerScheme: value("employerScheme"),
      employerControl: value("employerControl"),
      documentsAvailable: value("rentDocuments"),
    },
    TAX_RULES,
  );
  const taxableHousingAmount =
    treatment === "qualifyingRentalReimbursement" || treatment === "employerProvided"
      ? housingBenefit.taxableHousingAmount
      : cashHousingAmount;

  return {
    mode: "advanced",
    cashEmploymentIncome,
    assessableIncome: cashEmploymentIncome + taxableHousingAmount,
    housingBenefit,
    normalCashScenarioIncome: cashEmploymentIncome + Math.max(value("rentalReimbursement"), value("actualRent")),
  };
}

function taxAfterReduction(baseTax, rules) {
  return TAX_ENGINE.taxAfterReduction(baseTax, rules);
}

function calculateTax(netIncome, allowances, rules) {
  return TAX_ENGINE.calculateTax(netIncome, allowances, rules, TAX_RULES);
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
  normalizeAssessmentStatus();
  updateProgressiveDisclosure();
  const rules = TAX_YEARS[activeYear];
  const a = rules.allowances;
  const assessmentStatus = value("status");
  const isMarried = assessmentStatus === "married" || assessmentStatus === "marriedSeparate";
  const useJointAssessment = assessmentStatus === "married";
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
  const separateResult = aggregateTaxResults(singleResult, spouseSeparateResult);
  const separateTaxPayable = singleResult.taxPayable + spouseSeparateResult.taxPayable;
  const result = useJointAssessment ? jointResult : isMarried ? separateResult : singleResult;
  const selectedTaxPayable = result.taxPayable;
  const grossIncome = isMarried ? jointGrossIncome : person.grossIncome;
  const deductions = isMarried ? jointDeductions : person.deductions;
  const housingRentalValue = person.employment.housingBenefit.rentalValue || 0;
  const selectedAllowances = useJointAssessment ? allowances : isMarried ? individualAllowances + spouseAllowances : individualAllowances;
  const selectedLabel = useJointAssessment ? "合併" : isMarried ? "分開" : "個人";

  renderSummary({
    grossIncome,
    housingRentalValue,
    deductions,
    allowances: selectedAllowances,
    netIncome: isMarried ? jointNetIncome : person.netIncome,
    netChargeable: result.netChargeable,
    progressive: result.progressive,
    standard: result.standard,
    baseTax: result.baseTax,
    reduction: result.reduction,
    taxPayable: selectedTaxPayable,
    jointTax: jointResult.taxPayable,
    separateTax: isMarried ? separateTaxPayable : singleResult.taxPayable,
    assessmentMode: selectedLabel,
    isMarried,
    useJointAssessment,
    person,
    spouse,
    singleResult,
    spouseSeparateResult,
    separateResult,
    spouseAllowance: spouseAllowances,
  });
}

function aggregateTaxResults(primaryResult, spouseResult) {
  return {
    netChargeable: primaryResult.netChargeable + spouseResult.netChargeable,
    progressive: primaryResult.progressive + spouseResult.progressive,
    standard: primaryResult.standard + spouseResult.standard,
    baseTax: primaryResult.baseTax + spouseResult.baseTax,
    reduction: primaryResult.reduction + spouseResult.reduction,
    taxPayable: primaryResult.taxPayable + spouseResult.taxPayable,
  };
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
    employment: {
      mode: "simple",
      housingBenefit: {
        treatment: "none",
        eligibilityStatus: "NOT_APPLICABLE",
        taxableHousingAmount: 0,
        rentalValue: 0,
        cashEquivalent: 0,
        percentage: 0,
        months: 0,
        warnings: [],
      },
    },
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
    housingRentalValue: result.housingRentalValue,
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
  document.getElementById("pairLayout").classList.toggle("paired", result.isMarried);
  document.getElementById("spouseColumn").classList.toggle("visible", result.isMarried);
  renderProgressiveFormula(result);
  renderSpouseFormula(result);
  renderHousingBenefitExplanation(result);
  renderAdvice(result);
  renderOptimizer(result);
  renderHousingComparison(result);
  renderNotes();
  drawChart(result);
}

function renderProgressiveFormula(result) {
  if (result.isMarried && !result.useJointAssessment) {
    const list = document.getElementById("progressiveFormula");
    list.innerHTML = "";
    appendFormulaGroup(list, "本人", result.singleResult.netChargeable, result.singleResult.progressive);
    appendFormulaGroup(list, "配偶", result.spouseSeparateResult.netChargeable, result.spouseSeparateResult.progressive);
    appendFormulaTotal(list, result.progressive);
    return;
  }

  renderFormulaList("progressiveFormula", result.netChargeable, result.progressive);
}

function renderSpouseFormula(result) {
  renderFormulaList("spouseProgressiveFormula", result.spouseSeparateResult.netChargeable, result.spouseSeparateResult.progressive);
}

function renderHousingBenefitExplanation(result) {
  const list = document.getElementById("housingBenefitExplanation");
  const benefit = result.person.employment.housingBenefit;
  const items = [];

  if (result.person.employment.mode !== "advanced" || benefit.treatment === "none") {
    items.push("簡易模式或未輸入住屋福利：所有入息按普通薪酬處理。");
  } else if (benefit.treatment === "cashAllowance") {
    items.push(`普通現金房屋津貼按薪酬處理：${money.format(Math.round(benefit.taxableHousingAmount))} 已計入總入息。`);
  } else {
    items.push(`住所類型租值百分比：${(benefit.percentage * 100).toFixed(0)}%；租值：${money.format(Math.round(benefit.rentalValue))}。`);
    items.push(`資格狀態：${benefit.eligibilityStatus === "ELIGIBLE" ? "已按輸入資料確認" : "仍需確認"}。`);
    items.push("租金發還 / 僱主提供住所不是普通扣除額；合資格時以 IRD 租值規則加入入息。");
    items.push("只更改糧單字眼不足以建立合資格安排，必須保留僱主制度、審批及租金付款證明。");
    benefit.warnings.forEach((warning) => items.push(warning));
  }

  list.innerHTML = "";
  items.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    list.appendChild(item);
  });
}

function renderFormulaList(listId, netChargeable, progressive) {
  const list = document.getElementById(listId);
  list.innerHTML = "";
  appendFormulaGroup(list, "", netChargeable, progressive);
}

function appendFormulaGroup(list, label, netChargeable, progressive) {
  const bands = progressiveBreakdown(netChargeable);
  if (label) {
    const heading = document.createElement("li");
    heading.innerHTML = `<strong>${label}</strong>`;
    list.appendChild(heading);
  }

  bands.forEach((band) => {
    const item = document.createElement("li");
    const range =
      band.upperLimit === Infinity
        ? `${money.format(band.lowerLimit + 1)} 以上`
        : `${money.format(band.lowerLimit + 1)} - ${money.format(band.upperLimit)}`;
    item.innerHTML = `${range}：${money.format(Math.round(band.taxable))} × ${(band.rate * 100).toFixed(0)}% = <strong>${money.format(Math.round(band.tax))}</strong>`;
    list.appendChild(item);
  });

  appendFormulaTotal(list, progressive, label ? `${label}累進稅款` : "累進稅款合計");
}

function appendFormulaTotal(list, progressive, label = "累進稅款合計") {
  const total = document.createElement("li");
  total.innerHTML = `${label}：<strong>${money.format(Math.round(progressive))}</strong>`;
  list.appendChild(total);
}

function renderHousingComparison(taxResult) {
  applyReferencePresets();
  const rules = TAX_YEARS[activeYear];
  const marginalRate = estimateMarginalRate(taxResult);
  const years = Math.min(30, Math.max(1, Math.round(value("comparisonYears"))));
  const currentPrh = calculatePrhRent(value("prhMembers"), value("prhMonthlyIncome"), value("prhNetRent"), value("prhRates"));
  const removedPrh = calculatePrhRent(value("removedMembers"), value("removedMonthlyIncome"), value("prhNetRent"), value("prhRates"));
  const removalTaxProjection = calculateRemovalTaxProjection(taxResult, rules, years);
  const mortgage = calculateMortgage();
  const annualHomeLoanTaxSaving = calculateHomeLoanTaxSaving(mortgage.firstYearInterest, rules, marginalRate);
  const forecast = renderForecastBudget(taxResult, {
    currentPrh,
    removedPrh,
    mortgage,
    annualHomeLoanTaxSaving,
    parentTaxCost: removalTaxProjection.total,
  });
  const currentPrhTotal = forecast.totals.current;
  const removedPrhTotal = forecast.totals.removed;
  const removedWithAnnuityTotal = forecast.totals.removedWithAnnuity;
  const hosTotal = forecast.totals.hos;
  const annuityOffset = {
    contribution: forecast.detailTotals.annuityContribution,
    taxSaving: forecast.detailTotals.annuityTaxSaving,
    uncoveredTaxCost: forecast.detailTotals.annuityUncoveredTaxCost,
  };

  const fields = {
    currentPrhRent: currentPrh.monthlyRent,
    removedPrhRent: removedPrh.monthlyRent,
    parentTaxCost: forecast.detailTotals.parentTaxCost,
    hosMortgage: mortgage.monthlyPayment,
    homeLoanTaxSaving: annualHomeLoanTaxSaving,
    currentPrhTotal,
    removedPrhTotal,
    removedWithAnnuityTotal,
    hosTotal,
  };

  for (const [id, amount] of Object.entries(fields)) {
    document.getElementById(id).textContent = money.format(Math.round(amount));
  }

  renderHousingRecommendation([
    { label: "維持現公屋申報", total: currentPrhTotal },
    { label: "除名後保留公屋", total: removedPrhTotal },
    { label: "除名 + 年金抵消稅項", total: removedWithAnnuityTotal },
    { label: "申請居屋供樓", total: hosTotal },
  ]);
  renderHousingWarnings({
    currentPrh,
    removedPrh,
    mortgage,
    annualHomeLoanTaxSaving,
    removalTaxProjection,
    annuityOffset,
    marginalRate,
    years,
  });
}

function calculateRemovalTaxProjection(taxResult, rules, years) {
  const salaryGrowth = value("salaryGrowthRate") / 100;
  const allowanceGrowth = value("parentAllowanceGrowthRate") / 100;
  const annualCosts = [];

  for (let year = 1; year <= years; year += 1) {
    const incomeFactor = Math.pow(1 + salaryGrowth, year - 1);
    const allowanceFactor = Math.pow(1 + allowanceGrowth, year - 1);
    const projectedTax = projectedTaxResult(taxResult, incomeFactor, rules);
    annualCosts.push(calculateLostParentTaxCost(projectedTax, rules, allowanceFactor));
  }

  return {
    firstYear: annualCosts[0] || 0,
    lastYear: annualCosts[annualCosts.length - 1] || 0,
    total: annualCosts.reduce((sum, amount) => sum + amount, 0),
  };
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
  setNumberValue("parentAllowanceGrowthRate", FORECAST_PRESETS[preset].parentAllowance);
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

function calculateLostParentTaxCost(taxResult, rules, allowanceFactor = 1) {
  const a = rules.allowances;
  const livingMultiplier = value("lostParentLivingAllowance") ? 1 : 0;
  const baseLostAllowance =
    value("lostParents60") * (a.parent60 + a.parent60Living * livingMultiplier) +
    value("lostParents55") * (a.parent55 + a.parent55Living * livingMultiplier);
  const lostAllowance = baseLostAllowance * allowanceFactor;
  if (lostAllowance <= 0) return 0;

  const adjustedAllowances = taxResult.allowances + (lostAllowance - baseLostAllowance);
  const currentTax = calculateTax(taxResult.netIncome, adjustedAllowances, rules);
  const removedTax = calculateTax(taxResult.netIncome, Math.max(0, adjustedAllowances - lostAllowance), rules);
  return Math.max(0, removedTax.taxPayable - currentTax.taxPayable);
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
  const allowanceGrowth = value("parentAllowanceGrowthRate") / 100;
  const feeGrowth = value("feeGrowthRate") / 100;
  const monthlyRate = value("hosInterestRate") / 100 / 12;
  let mortgageBalance = housing.mortgage.loanAmount;
  const rows = [];
  const totals = {
    current: 0,
    removed: 0,
    removedWithAnnuity: 0,
    hos: housing.mortgage.downPayment,
  };
  const detailTotals = {
    currentRent: 0,
    removedRent: 0,
    parentTaxCost: 0,
    annuityContribution: 0,
    annuityTaxSaving: 0,
    annuityUncoveredTaxCost: 0,
    mortgagePayments: 0,
    fees: 0,
    homeLoanSaving: 0,
    downPayment: housing.mortgage.downPayment,
  };

  for (let year = 1; year <= projectionYears; year += 1) {
    const incomeFactor = Math.pow(1 + salaryGrowth, year - 1);
    const rentFactor = Math.pow(1 + rentGrowth, year - 1);
    const allowanceFactor = Math.pow(1 + allowanceGrowth, year - 1);
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
    const parentTaxCost = calculateLostParentTaxCost(projectedTax, rules, allowanceFactor);
    const annuityOffset = calculateAnnualAnnuityOffset(parentTaxCost, rules, estimateMarginalRate(projectedTax));
    const amortization = annualMortgageAmortization(mortgageBalance, housing.mortgage.monthlyPayment, monthlyRate, year <= value("hosLoanYears"));
    mortgageBalance = amortization.endingBalance;
    const interest = amortization.interest;
    const homeLoanSaving = calculateHomeLoanTaxSaving(interest, rules, estimateMarginalRate(projectedTax));
    const mortgagePayments = year <= value("hosLoanYears") ? housing.mortgage.monthlyPayment * 12 : 0;
    const fees = value("hosMonthlyFees") * feeFactor * 12;
    const currentAnnual = currentRent * 12;
    const removedAnnual = removedRent * 12 + parentTaxCost;
    const removedWithAnnuityAnnual = removedRent * 12 + annuityOffset.contribution + annuityOffset.uncoveredTaxCost;
    const hosAnnual = mortgagePayments + fees - homeLoanSaving;

    totals.current += currentAnnual;
    totals.removed += removedAnnual;
    totals.removedWithAnnuity += removedWithAnnuityAnnual;
    totals.hos += hosAnnual;
    detailTotals.currentRent += currentAnnual;
    detailTotals.removedRent += removedRent * 12;
    detailTotals.parentTaxCost += parentTaxCost;
    detailTotals.annuityContribution += annuityOffset.contribution;
    detailTotals.annuityTaxSaving += annuityOffset.taxSaving;
    detailTotals.annuityUncoveredTaxCost += annuityOffset.uncoveredTaxCost;
    detailTotals.mortgagePayments += mortgagePayments;
    detailTotals.fees += fees;
    detailTotals.homeLoanSaving += homeLoanSaving;

    rows.push({
      year,
      income: value("prhMonthlyIncome") * incomeFactor,
      current: currentAnnual,
      removed: removedAnnual,
      removedWithAnnuity: removedWithAnnuityAnnual,
      hos: hosAnnual,
      parentTaxCost,
      annuityContribution: annuityOffset.contribution,
      homeLoanSaving,
    });
  }

  document.getElementById("forecastTitle").textContent = `未來 ${projectionYears} 年支出預算`;
  document.getElementById("forecastCurrentLabel").textContent = `${projectionYears} 年現公屋總支出`;
  document.getElementById("forecastRemovedLabel").textContent = `${projectionYears} 年除名方案總支出`;
  document.getElementById("forecastRemovedAnnuityLabel").textContent = `${projectionYears} 年年金抵消除名支出`;
  document.getElementById("forecastHosLabel").textContent = `${projectionYears} 年居屋現金流支出`;
  document.getElementById("forecastCurrentTotal").textContent = money.format(Math.round(totals.current));
  document.getElementById("forecastRemovedTotal").textContent = money.format(Math.round(totals.removed));
  document.getElementById("forecastRemovedAnnuityTotal").textContent = money.format(Math.round(totals.removedWithAnnuity));
  document.getElementById("forecastHosTotal").textContent = money.format(Math.round(totals.hos));
  document.getElementById("forecastBestOption").textContent = forecastBestOption(totals);
  renderForecastBreakdowns(detailTotals, totals, projectionYears);
  renderForecastRows(rows);

  return {
    totals,
    detailTotals,
  };
}

function calculateAnnualAnnuityOffset(targetTaxCost, rules, marginalRate) {
  const remainingLimit = Math.max(0, rules.deductions.annuity - value("annuity"));
  const requiredContribution = marginalRate > 0 ? targetTaxCost / marginalRate : 0;
  const contribution = Math.min(remainingLimit, requiredContribution);
  const taxSaving = contribution * marginalRate;

  return {
    contribution,
    taxSaving,
    uncoveredTaxCost: Math.max(0, targetTaxCost - taxSaving),
  };
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
  renderSimpleList("forecastAnnuityOffsetBreakdown", [
    `年金 / TVC 供款合計：${money.format(Math.round(details.annuityContribution))}`,
    `可抵消稅額合計：-${money.format(Math.round(details.annuityTaxSaving))}`,
    `未能抵消稅項：${money.format(Math.round(details.annuityUncoveredTaxCost))}`,
    `公式：除名租金 + 年金供款 + 未抵消稅項`,
    `${years} 年總支出：${money.format(Math.round(totals.removedWithAnnuity))}`,
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
    { label: "除名 + 年金抵消稅項", total: totals.removedWithAnnuity },
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
      <td>${money.format(Math.round(row.annuityContribution))}</td>
      <td>${money.format(Math.round(row.removedWithAnnuity))}</td>
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
    `除名稅務成本已按薪金及父母免稅額年增長逐年重算：首年約 ${money.format(Math.round(details.removalTaxProjection.firstYear))}，第 ${details.years} 年約 ${money.format(Math.round(details.removalTaxProjection.lastYear))}。`,
    `年金抵消方案：需要供款約 ${money.format(Math.round(details.annuityOffset.contribution))}，可抵消稅額約 ${money.format(Math.round(details.annuityOffset.taxSaving))}，未抵消稅項約 ${money.format(Math.round(details.annuityOffset.uncoveredTaxCost))}。`,
    "父母免稅額年增長預設 1.6%，按 GovHK 2020/21 至 2026/27 近年表由 HK$50,000 增至 HK$55,000 折算。",
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
    if (!field) return;
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

  normalizeAssessmentStatus();
  updateProgressiveDisclosure();
  calculate();
  return true;
}

function normalizeAssessmentStatus() {
  const status = document.getElementById("status");
  const validStatuses = ["single", "married", "marriedSeparate"];
  if (!validStatuses.includes(status.value)) {
    status.value = "single";
  }
}

function updateProgressiveDisclosure() {
  const isAdvanced = value("employmentMode") === "advanced";
  const housingTreatment = value("housingTreatment");
  const needsHousingQuestions = isAdvanced && housingTreatment !== "none";
  document.getElementById("tax-form").classList.toggle("advanced-mode", isAdvanced);
  document.querySelectorAll(".housing-benefit-input").forEach((item) => {
    item.classList.toggle("visible-benefit-field", needsHousingQuestions);
  });
}

function saveFormState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collectFormState()));
  setStatus("已保存到此瀏覽器");
}

function exportJsonFile() {
  const payload = {
    app: "hong-kong-tax-calculator",
    version: 1,
    exportedAt: new Date().toISOString(),
    state: collectFormState(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hong-kong-tax-calculator-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus("已匯出 JSON 檔");
}

function importJsonFile(file) {
  if (!file) return;
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(reader.result);
      const state = payload.state || payload;
      if (!applyFormState(state)) throw new Error("Invalid state");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectFormState()));
      setStatus("已匯入 JSON 並更新計算");
    } catch {
      setStatus("JSON 檔格式不正確");
    }
  });

  reader.readAsText(file);
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

function maybeSetForecastCustom(id) {
  const forecastInputs = ["salaryGrowthRate", "prhRentGrowthRate", "parentAllowanceGrowthRate", "feeGrowthRate"];
  if (forecastInputs.includes(id)) {
    document.getElementById("forecastPreset").value = "custom";
  }
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
    const selectedAlternative = result.useJointAssessment ? "分開評稅" : "合併評稅";
    const selectedCost = result.useJointAssessment ? result.jointTax : result.separateTax;
    const alternativeCost = result.useJointAssessment ? result.separateTax : result.jointTax;
    const alternativeDifference = alternativeCost - selectedCost;

    if (alternativeDifference > 0) {
      items.push(`另一方案「${selectedAlternative}」估計要多交約 ${money.format(Math.round(alternativeDifference))}，現選方案較低。`);
    } else if (alternativeDifference < 0) {
      items.push(`另一方案「${selectedAlternative}」估計可少交約 ${money.format(Math.round(Math.abs(alternativeDifference)))}，建議考慮轉用。`);
    } else {
      items.push(`另一方案「${selectedAlternative}」與現選方案暫時相若；可再輸入配偶扣除額比較。`);
    }
  }

  if (rate === 0) {
    items.push("現時估算未有應繳稅款，新增扣除額未必即時慳稅。");
  }

  addCapAdvice(items, "年金 / TVC", value("annuity"), d.annuity, rate);
  addAnnuityPlanAdvice(items, value("annuity"), d.annuity, rate, "本人");
  addCapAdvice(items, "自我進修開支", value("education"), d.education, rate);
  addCapAdvice(items, "VHIS 保費", value("vhis"), d.vhisPerPerson * value("vhisPeople"), rate);
  addCapAdvice(items, "長者住宿照顧開支", value("elderCare"), d.elderCare, rate);
  addCapAdvice(items, "輔助生育服務開支", value("reproductive"), d.reproductive, rate);

  if (result.isMarried) {
    addCapAdvice(items, "配偶年金 / TVC", value("spouseAnnuity"), d.annuity, rate);
    addAnnuityPlanAdvice(items, value("spouseAnnuity"), d.annuity, rate, "配偶");
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

function buildOptimizerContext(result) {
  const rules = TAX_YEARS[activeYear];
  const spouseDonations = result.isMarried ? value("spouseDonations") : 0;
  const donationCap = Math.max(0, (result.grossIncome - result.deductions + result.person.donations + result.spouse.donations) * 0.35);
  const housingBenefit = { ...result.person.employment.housingBenefit };
  const normalCashDelta = Math.max(0, result.person.employment.normalCashScenarioIncome - result.person.employment.assessableIncome);
  if (normalCashDelta > 0) {
    housingBenefit.normalCashScenarioTaxPayable = calculateTax(result.netIncome + normalCashDelta, result.allowances, rules).taxPayable;
  }

  return {
    taxEngine: TAX_ENGINE,
    taxRules: TAX_RULES,
    yearRules: rules,
    netIncome: result.netIncome,
    allowances: result.allowances,
    baseTax: {
      taxPayable: result.taxPayable,
    },
    claims: {
      mpf: value("mpf") + (result.isMarried ? value("spouseMpf") : 0),
      education: value("education") + (result.isMarried ? value("spouseEducation") : 0),
      homeLoan: value("homeLoan") + (result.isMarried ? value("spouseHomeLoan") : 0),
      rent: value("rent") + (result.isMarried ? value("spouseRent") : 0),
      vhis: value("vhis") + (result.isMarried ? value("spouseVhis") : 0),
      annuity: value("annuity") + (result.isMarried ? value("spouseAnnuity") : 0),
      elderCare: value("elderCare") + (result.isMarried ? value("spouseElderCare") : 0),
      donations: value("donations") + spouseDonations,
      reproductive: value("reproductive") + (result.isMarried ? value("spouseReproductive") : 0),
    },
    limits: {
      donationCap,
    },
    facts: {
      children: value("children"),
      vhisPeople: value("vhisPeople") + (result.isMarried ? value("spouseVhisPeople") : 0),
    },
    housingBenefit,
    spouse: {
      isMarried: result.isMarried,
      jointTax: result.jointTax,
      separateTax: result.separateTax,
    },
  };
}

function renderOptimizer(result) {
  const optimization = window.HKTaxOptimizer.buildOptimization(buildOptimizerContext(result));
  document.getElementById("optimizationScore").textContent = `${optimization.score} / 100`;
  document.getElementById("potentialSaving").textContent = money.format(Math.round(optimization.potentialAdditionalSaving));
  renderDeclarationList("declareConfirmed", optimization.declarationSummary.confirmed.slice(0, 7));
  renderDeclarationList("declarePossible", optimization.declarationSummary.possible.slice(0, 7));
  renderDeclarationList("declareNotApplicable", optimization.declarationSummary.notApplicable.slice(0, 7));
  renderOpportunityCards(optimization.opportunities.slice(0, 8));
}

function renderDeclarationList(id, items) {
  const list = document.getElementById(id);
  list.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("li");
    row.textContent = `${item.name}：${item.amount ? money.format(Math.round(item.amount)) : "未輸入"} - ${item.reason}`;
    list.appendChild(row);
  });
}

function renderOpportunityCards(opportunities) {
  const container = document.getElementById("opportunityCards");
  container.innerHTML = "";

  opportunities.forEach((opportunity) => {
    const card = document.createElement("article");
    card.className = "opportunity-card";

    const header = document.createElement("header");
    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = opportunity.name;
    const meta = document.createElement("span");
    meta.className = "opportunity-meta";
    meta.textContent = `Status: ${opportunity.eligibilityStatus}`;
    titleWrap.append(title, meta);

    const status = document.createElement("span");
    status.className = `status-pill ${opportunity.eligibilityStatus.toLowerCase().replaceAll("_", "-")}`;
    status.textContent = opportunity.eligibilityStatus;
    header.append(titleWrap, status);

    const numbers = document.createElement("div");
    numbers.className = "opportunity-numbers";
    [
      ["Current Claim", opportunity.currentClaim],
      ["Potential Claim", opportunity.maximumPotentialClaim],
      ["Estimated Saving", opportunity.estimatedTaxSaving],
    ].forEach(([label, amount]) => {
      const cell = document.createElement("div");
      const cellLabel = document.createElement("span");
      const cellValue = document.createElement("strong");
      cellLabel.textContent = label;
      cellValue.textContent = money.format(Math.round(amount));
      cell.append(cellLabel, cellValue);
      numbers.appendChild(cell);
    });

    const details = document.createElement("ul");
    [
      `Why: ${opportunity.reason}`,
      `Action: ${opportunity.actionRequired}`,
      `Documents: ${opportunity.documentsRequired.join("、") || "按個案確認"}`,
    ].forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      details.appendChild(item);
    });

    const source = document.createElement("a");
    source.href = opportunity.officialIRDReference;
    source.target = "_blank";
    source.rel = "noreferrer";
    source.textContent = "IRD reference";

    card.append(header, numbers, details, source);
    container.appendChild(card);
  });
}

function addCapAdvice(items, label, used, limit, rate) {
  const remaining = Math.max(0, limit - used);
  if (limit <= 0 || remaining <= 0 || rate <= 0) return;
  const saving = remaining * rate;
  items.push(`${label}仍有約 ${money.format(Math.round(remaining))} 上限；若合資格，按現時邊際稅率可慳約 ${money.format(Math.round(saving))}。`);
}

function addAnnuityPlanAdvice(items, used, limit, rate, owner) {
  if (used > 0 || rate <= 0) return;
  const scenarios = [12000, 30000, limit].map((amount) => {
    const saving = Math.min(amount, limit) * rate;
    return `${money.format(amount)} 可慳約 ${money.format(Math.round(saving))}`;
  });
  items.push(`${owner}未輸入年金 / TVC：可比較 ${scenarios.join("、")}；上限為每年 ${money.format(limit)}。`);
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
  const rules = TAX_YEARS[activeYear];
  list.innerHTML = "";

  [
    `課稅年度：${rules.label}`,
    `規則版本：${rules.ruleVersion}`,
    `最後核對：${TAX_RULES.meta.lastVerifiedDate}`,
    ...rules.notes,
  ].forEach((note) => {
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
  const field = document.getElementById(id);
  if (!field) return;
  field.addEventListener("input", () => {
    maybeSetForecastCustom(id);
    calculate();
  });
  field.addEventListener("change", () => {
    maybeSetForecastCustom(id);
    calculate();
  });
});

document.getElementById("saveData").addEventListener("click", saveFormState);
document.getElementById("clearData").addEventListener("click", clearFormState);
document.getElementById("exportJson").addEventListener("click", exportJsonFile);
document.getElementById("importJson").addEventListener("click", () => {
  document.getElementById("importJsonFile").click();
});
document.getElementById("importJsonFile").addEventListener("change", (event) => {
  importJsonFile(event.target.files[0]);
  event.target.value = "";
});
document.getElementById("printPdf").addEventListener("click", () => {
  setStatus("請在列印視窗選擇另存為 PDF");
  window.print();
});

if (!loadFormState()) {
  calculate();
}
