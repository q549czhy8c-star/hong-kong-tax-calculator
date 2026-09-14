const test = require("node:test");
const assert = require("node:assert/strict");

const rules = require("../tax-rules.js");
const engine = require("../tax-engine.js");
const optimizer = require("../tax-optimizer.js");

function baseContext(overrides = {}) {
  const yearRules = rules.years[2025];
  const netIncome = 702000;
  const allowances = yearRules.allowances.basic;
  const baseTax = engine.calculateTax(netIncome, allowances, yearRules, rules);
  return {
    taxEngine: engine,
    taxRules: rules,
    yearRules,
    netIncome,
    allowances,
    baseTax,
    claims: {
      mpf: 18000,
      education: 0,
      homeLoan: 0,
      rent: 0,
      vhis: 0,
      annuity: 0,
      elderCare: 0,
      donations: 0,
      reproductive: 0,
    },
    limits: {
      donationCap: (720000 - 18000) * 0.35,
    },
    facts: {
      children: 0,
      vhisPeople: 0,
    },
    housingBenefit: {
      treatment: "none",
      eligibilityStatus: "NOT_APPLICABLE",
      rentalValue: 0,
      cashEquivalent: 0,
    },
    spouse: {
      isMarried: false,
      jointTax: baseTax.taxPayable,
      separateTax: baseTax.taxPayable,
    },
    ...overrides,
  };
}

test("optimizer returns opportunity cards and declaration summary", () => {
  const result = optimizer.buildOptimization(baseContext());
  assert.ok(result.opportunities.length >= 8);
  assert.ok(result.declarationSummary.confirmed.some((item) => item.name === "基本免稅額"));
  assert.ok(result.declarationSummary.possible.some((item) => item.name === "合資格年金 / TVC"));
});

test("annuity / TVC saving is calculated by full before-after tax engine", () => {
  const result = optimizer.buildOptimization(baseContext());
  const annuity = result.opportunities.find((item) => item.id === "annuityTvc");
  const before = engine.calculateTax(702000, 132000, rules.years[2025], rules);
  const after = engine.calculateTax(642000, 132000, rules.years[2025], rules);
  assert.equal(annuity.estimatedTaxSaving, Math.round(before.taxPayable - after.taxPayable));
  assert.equal(annuity.estimatedTaxSaving, 10200);
});

test("rent opportunity uses base HK$100,000 ceiling without child facts", () => {
  const result = optimizer.buildOptimization(baseContext());
  const rent = result.opportunities.find((item) => item.id === "domesticRent");
  assert.equal(rent.maximumPotentialClaim, 100000);
  assert.equal(rent.eligibilityStatus, optimizer.STATUS.REQUIRES_CONFIRMATION);
});

test("rent opportunity uses HK$120,000 ceiling when child facts are present", () => {
  const result = optimizer.buildOptimization(
    baseContext({
      facts: {
        children: 1,
        vhisPeople: 0,
      },
    }),
  );
  const rent = result.opportunities.find((item) => item.id === "domesticRent");
  assert.equal(rent.maximumPotentialClaim, 120000);
});

test("rental reimbursement stays requires confirmation when evidence is incomplete", () => {
  const result = optimizer.buildOptimization(
    baseContext({
      housingBenefit: {
        treatment: "qualifyingRentalReimbursement",
        eligibilityStatus: "REQUIRES_CONFIRMATION",
        rentalValue: 60000,
        cashEquivalent: 180000,
        normalCashScenarioTaxPayable: 93000,
      },
    }),
  );
  const rentalReimbursement = result.opportunities.find((item) => item.id === "rentalReimbursement");
  assert.equal(rentalReimbursement.eligibilityStatus, optimizer.STATUS.REQUIRES_CONFIRMATION);
  assert.ok(rentalReimbursement.estimatedTaxSaving > 0);
});

test("married assessment opportunity reports household difference", () => {
  const result = optimizer.buildOptimization(
    baseContext({
      spouse: {
        isMarried: true,
        jointTax: 50000,
        separateTax: 62000,
      },
    }),
  );
  const spouse = result.opportunities.find((item) => item.id === "spouseAssessment");
  assert.equal(spouse.eligibilityStatus, optimizer.STATUS.ELIGIBLE);
  assert.equal(spouse.estimatedTaxSaving, 12000);
});

test("zero tax suppresses displayed opportunity savings", () => {
  const yearRules = rules.years[2025];
  const zeroTax = engine.calculateTax(100000, yearRules.allowances.basic, yearRules, rules);
  const result = optimizer.buildOptimization(
    baseContext({
      netIncome: 100000,
      baseTax: zeroTax,
    }),
  );
  assert.equal(result.potentialAdditionalSaving, 0);
});
