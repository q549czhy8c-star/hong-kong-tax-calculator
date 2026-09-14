const test = require("node:test");
const assert = require("node:assert/strict");

const rules = require("../tax-rules.js");
const engine = require("../tax-engine.js");

function year(key) {
  return rules.years[key];
}

test("zero income produces zero tax", () => {
  const result = engine.calculateTax(0, year(2025).allowances.basic, year(2025), rules);
  assert.equal(result.netChargeable, 0);
  assert.equal(result.taxPayable, 0);
});

test("2025/26 low income below basic allowance produces zero tax", () => {
  const result = engine.calculateTax(120000, year(2025).allowances.basic, year(2025), rules);
  assert.equal(result.netChargeable, 0);
  assert.equal(result.taxPayable, 0);
});

test("2025/26 middle income applies progressive bands and tax concession", () => {
  const result = engine.calculateTax(720000 - 18000, year(2025).allowances.basic, year(2025), rules);
  assert.equal(result.netChargeable, 570000);
  assert.equal(result.progressive, 78900);
  assert.equal(result.standard, 105300);
  assert.equal(result.baseTax, 78900);
  assert.equal(result.reduction, 3000);
  assert.equal(result.taxPayable, 75900);
});

test("high income can use two-tier standard-rate tax when lower", () => {
  const result = engine.calculateTax(10000000, 0, year(2026), rules);
  assert.equal(Math.round(result.progressive), 1682000);
  assert.equal(result.standard, 1550000);
  assert.equal(result.baseTax, 1550000);
});

test("2026/27 allowance increase changes net chargeable income", () => {
  const income = 650000;
  const result2025 = engine.calculateTax(income, year(2025).allowances.basic, year(2025), rules);
  const result2026 = engine.calculateTax(income, year(2026).allowances.basic, year(2026), rules);
  assert.equal(result2025.netChargeable, 518000);
  assert.equal(result2026.netChargeable, 505000);
  assert.ok(result2026.taxPayable > result2025.taxPayable, "2025/26 includes a one-off concession, so final tax may be lower");
});

test("married-person allowance differs by assessment year", () => {
  assert.equal(year(2025).allowances.married, 264000);
  assert.equal(year(2026).allowances.married, 290000);
});

test("child and newborn allowances are independently versioned", () => {
  assert.equal(year(2025).allowances.child + year(2025).allowances.newbornExtra, 260000);
  assert.equal(year(2026).allowances.child + year(2026).allowances.newbornExtra, 280000);
});

test("dependent parent allowances cover 55-59, 60+, and co-residing increments", () => {
  assert.equal(year(2025).allowances.parent55 + year(2025).allowances.parent55Living, 50000);
  assert.equal(year(2026).allowances.parent60 + year(2026).allowances.parent60Living, 110000);
});

test("common deduction caps are present", () => {
  const deductions = year(2026).deductions;
  assert.equal(deductions.mpf, 18000);
  assert.equal(deductions.education, 100000);
  assert.equal(deductions.vhisPerPerson, 8000);
  assert.equal(deductions.annuity, 60000);
  assert.equal(deductions.qdap, 60000);
  assert.equal(deductions.reproductive, 100000);
});

test("elderly residential care cap rises in 2026/27", () => {
  assert.equal(year(2025).deductions.elderCare, 100000);
  assert.equal(year(2026).deductions.elderCare, 110000);
});

test("home loan interest and domestic rent use base and child-related ceilings", () => {
  assert.equal(engine.housingDeductionLimit(year(2025), false, "homeLoan"), 100000);
  assert.equal(engine.housingDeductionLimit(year(2025), true, "homeLoan"), 120000);
  assert.equal(engine.housingDeductionLimit(year(2026), false, "rent"), 100000);
  assert.equal(engine.housingDeductionLimit(year(2026), true, "rent"), 120000);
});

test("approved charitable donation cap can be applied at 35% of post-ordinary-deduction income", () => {
  const grossIncome = 500000;
  const ordinaryDeductions = 18000;
  const donationCap = (grossIncome - ordinaryDeductions) * 0.35;
  assert.equal(engine.cap(300000, donationCap), 168700);
});

test("employer-provided residential unit uses 10% rental value when evidence is confirmed", () => {
  const benefit = engine.calculateHousingBenefit(
    {
      treatment: "employerProvided",
      cashIncomeBase: 600000,
      months: 12,
      accommodationType: "residentialUnit",
      employerScheme: true,
      employerControl: true,
      documentsAvailable: true,
    },
    rules,
  );
  assert.equal(benefit.eligibilityStatus, "ELIGIBLE");
  assert.equal(benefit.rentalValue, 60000);
});

test("one hotel room uses 4% rental value and prorates by months", () => {
  const benefit = engine.calculateHousingBenefit(
    {
      treatment: "qualifyingRentalReimbursement",
      cashIncomeBase: 600000,
      months: 6,
      accommodationType: "hotelOneRoom",
      employerScheme: true,
      employerControl: true,
      documentsAvailable: true,
    },
    rules,
  );
  assert.equal(benefit.rentalValue, 12000);
});

test("rental reimbursement requires confirmation when evidence is missing", () => {
  const benefit = engine.calculateHousingBenefit(
    {
      treatment: "qualifyingRentalReimbursement",
      cashIncomeBase: 600000,
      reimbursed: 180000,
      months: 12,
      accommodationType: "residentialUnit",
      employerScheme: false,
      employerControl: true,
      documentsAvailable: false,
    },
    rules,
  );
  assert.equal(benefit.eligibilityStatus, "REQUIRES_CONFIRMATION");
  assert.equal(benefit.rentalValue, 60000);
});

test("cash housing allowance is treated as ordinary taxable cash", () => {
  const benefit = engine.calculateHousingBenefit(
    {
      treatment: "cashAllowance",
      reimbursed: 120000,
      cashIncomeBase: 600000,
    },
    rules,
  );
  assert.equal(benefit.taxableHousingAmount, 120000);
  assert.equal(benefit.rentalValue, 0);
});

test("full-engine scenario comparison returns actual before/after saving", () => {
  const scenario = ({ annuity }) => {
    const netIncome = 720000 - engine.cap(annuity, year(2025).deductions.annuity);
    return engine.calculateTax(netIncome, year(2025).allowances.basic, year(2025), rules);
  };
  const comparison = engine.compareFullEngineSaving({ annuity: 0 }, { annuity: 60000 }, scenario);
  assert.equal(comparison.estimatedTaxSaving, 10200);
});
