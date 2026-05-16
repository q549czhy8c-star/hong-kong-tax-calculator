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

function calculateSharedAllowances(rules) {
  const a = rules.allowances;
  const children = Math.min(9, value("children"));
  const newborns = Math.min(children, value("newborns"));

  return (
    (value("singleParent") ? a.singleParent : 0) +
    children * a.child +
    newborns * a.newbornExtra +
    value("siblings") * a.sibling +
    value("disabledDependants") * a.disabledDependant +
    value("parents60") * a.parent60 +
    value("parents60Living") * a.parent60Living +
    value("parents55") * a.parent55 +
    value("parents55Living") * a.parent55Living
  );
}

function calculate() {
  const rules = TAX_YEARS[activeYear];
  const a = rules.allowances;
  const isMarried = value("status") === "married";
  const person = calculatePerson("", rules);
  const spouse = isMarried ? calculatePerson("spouse", rules) : emptyPerson();
  const sharedAllowances = calculateSharedAllowances(rules);
  const disabilityAllowance = value("personalDisability") ? a.disability : 0;
  const individualAllowances = a.basic + disabilityAllowance + sharedAllowances;
  const allowances = (isMarried ? a.married : a.basic) + disabilityAllowance + sharedAllowances;
  const jointNetIncome = person.netIncome + spouse.netIncome;
  const jointGrossIncome = person.grossIncome + spouse.grossIncome;
  const jointDeductions = person.deductions + spouse.deductions;
  const jointResult = calculateTax(jointNetIncome, allowances, rules);
  const singleResult = calculateTax(person.netIncome, individualAllowances, rules);
  const spouseSeparateResult = isMarried ? calculateTax(spouse.netIncome, a.basic, rules) : zeroTax();
  const separateTaxPayable = singleResult.taxPayable + spouseSeparateResult.taxPayable;
  const result = isMarried ? jointResult : singleResult;
  const grossIncome = isMarried ? jointGrossIncome : person.grossIncome;
  const deductions = isMarried ? jointDeductions : person.deductions;

  renderSummary({
    grossIncome,
    deductions,
    allowances,
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
  });
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
  };

  for (const [id, amount] of Object.entries(fields)) {
    document.getElementById(id).textContent = money.format(Math.round(amount));
  }

  document.getElementById("assessmentMode").textContent = result.assessmentMode;
  document.getElementById("spouseSection").classList.toggle("visible", result.isMarried);
  renderAdvice(result);
  renderHousingComparison(result);
  renderNotes();
  drawChart(result);
}

function renderHousingComparison(taxResult) {
  applyReferencePresets();
  const rules = TAX_YEARS[activeYear];
  const marginalRate = estimateMarginalRate(taxResult);
  const years = Math.max(1, value("comparisonYears"));
  const months = years * 12;
  const currentPrh = calculatePrhRent(value("prhMembers"), value("prhMonthlyIncome"), value("prhNetRent"), value("prhRates"));
  const removedPrh = calculatePrhRent(value("removedMembers"), value("removedMonthlyIncome"), value("prhNetRent"), value("prhRates"));
  const parentTaxCost = calculateLostParentTaxCost(rules, marginalRate);
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
}

function applyNumericPreset(selectId, inputId) {
  const preset = value(selectId);
  if (preset === "custom") return;
  setNumberValue(inputId, Number(preset));
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

function calculateLostParentTaxCost(rules, marginalRate) {
  const a = rules.allowances;
  const livingMultiplier = value("lostParentLivingAllowance") ? 1 : 0;
  const lostAllowance =
    value("lostParents60") * (a.parent60 + a.parent60Living * livingMultiplier) +
    value("lostParents55") * (a.parent55 + a.parent55Living * livingMultiplier);
  return lostAllowance * marginalRate;
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

ids.forEach((id) => {
  document.getElementById(id).addEventListener("input", calculate);
  document.getElementById(id).addEventListener("change", calculate);
});

calculate();
