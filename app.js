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

const ids = [
  "income",
  "otherIncome",
  "status",
  "singleParent",
  "personalDisability",
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

function calculate() {
  const rules = TAX_YEARS[activeYear];
  const a = rules.allowances;
  const d = rules.deductions;
  const grossIncome = value("income") + value("otherIncome");

  const ordinaryDeductions =
    cap(value("mpf"), d.mpf) +
    cap(value("education"), d.education) +
    cap(value("homeLoan"), d.homeLoan) +
    cap(value("rent"), d.rent) +
    cap(value("vhis"), d.vhisPerPerson * value("vhisPeople")) +
    cap(value("annuity"), d.annuity) +
    cap(value("elderCare"), d.elderCare) +
    cap(value("reproductive"), d.reproductive);

  const donationBase = Math.max(0, grossIncome - ordinaryDeductions);
  const donations = cap(value("donations"), donationBase * 0.35);
  const deductions = ordinaryDeductions + donations;
  const netIncome = Math.max(0, grossIncome - deductions);

  const children = Math.min(9, value("children"));
  const newborns = Math.min(children, value("newborns"));
  const allowances =
    (value("status") === "married" ? a.married : a.basic) +
    (value("singleParent") ? a.singleParent : 0) +
    (value("personalDisability") ? a.disability : 0) +
    children * a.child +
    newborns * a.newbornExtra +
    value("siblings") * a.sibling +
    value("disabledDependants") * a.disabledDependant +
    value("parents60") * a.parent60 +
    value("parents60Living") * a.parent60Living +
    value("parents55") * a.parent55 +
    value("parents55Living") * a.parent55Living;

  const netChargeable = Math.max(0, netIncome - allowances);
  const progressive = progressiveTax(netChargeable);
  const standard = standardTax(netIncome);
  const baseTax = Math.min(progressive, standard);
  const reduction = Math.min(baseTax, rules.taxReduction);
  const taxPayable = Math.max(0, baseTax - reduction);

  renderSummary({
    grossIncome,
    deductions,
    allowances,
    netChargeable,
    progressive,
    standard,
    baseTax,
    reduction,
    taxPayable,
  });
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
  };

  for (const [id, amount] of Object.entries(fields)) {
    document.getElementById(id).textContent = money.format(Math.round(amount));
  }

  renderNotes();
  drawChart(result);
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
