(function (root) {
  "use strict";

  function cap(amount, max) {
    return Math.min(Math.max(0, Number(amount) || 0), max);
  }

  function sumBands(amount, bands) {
    let remaining = Math.max(0, Number(amount) || 0);
    let total = 0;

    for (const band of bands) {
      if (remaining <= 0) break;
      const taxable = Math.min(remaining, band.limit);
      total += taxable * band.rate;
      remaining -= taxable;
    }

    return total;
  }

  function progressiveTax(netChargeableIncome, taxRules) {
    return sumBands(netChargeableIncome, taxRules.progressiveBands);
  }

  function standardTax(netIncome, taxRules) {
    return sumBands(netIncome, taxRules.standardRateBands);
  }

  function progressiveBreakdown(netChargeableIncome, taxRules) {
    let remaining = Math.max(0, Number(netChargeableIncome) || 0);
    let lowerLimit = 0;

    return taxRules.progressiveBands.map((band) => {
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

  function taxAfterReduction(baseTax, rules) {
    const reduction = Math.min(baseTax, rules.taxReduction || 0);
    return {
      reduction,
      taxPayable: Math.max(0, baseTax - reduction),
    };
  }

  function calculateTax(netIncome, allowances, yearRules, taxRules) {
    const netChargeable = Math.max(0, (Number(netIncome) || 0) - (Number(allowances) || 0));
    const progressive = progressiveTax(netChargeable, taxRules);
    const standard = standardTax(netIncome, taxRules);
    const baseTax = Math.min(progressive, standard);

    return {
      netChargeable,
      progressive,
      standard,
      baseTax,
      ...taxAfterReduction(baseTax, yearRules),
    };
  }

  function housingDeductionLimit(yearRules, hasQualifyingChild, kind) {
    if (kind === "homeLoan") {
      return hasQualifyingChild ? yearRules.deductions.homeLoanWithChild : yearRules.deductions.homeLoan;
    }

    if (kind === "rent") {
      return hasQualifyingChild ? yearRules.deductions.rentWithChild : yearRules.deductions.rent;
    }

    return 0;
  }

  function calculateHousingBenefit(input, taxRules) {
    const treatment = input.treatment || "none";
    const months = cap(input.months || 12, 12);
    const periodFactor = months / 12;
    const actualRent = Number(input.actualRent) || 0;
    const reimbursed = Number(input.reimbursed) || 0;
    const employeeRentPaid = Number(input.employeeRentPaid) || 0;
    const cashIncomeBase = Math.max(0, Number(input.cashIncomeBase) || 0);
    const percentages = taxRules.housingBenefit.rentalValuePercentages;
    const percentage = percentages[input.accommodationType] || percentages.residentialUnit;
    const eligibilityConfirmed = Boolean(input.employerScheme && input.employerControl && input.documentsAvailable);
    const rentalValue = Math.max(0, cashIncomeBase * percentage * periodFactor - employeeRentPaid);

    if (treatment === "qualifyingRentalReimbursement" || treatment === "employerProvided") {
      return {
        treatment,
        eligibilityStatus: eligibilityConfirmed ? "ELIGIBLE" : "REQUIRES_CONFIRMATION",
        taxableHousingAmount: rentalValue,
        rentalValue,
        cashEquivalent: treatment === "qualifyingRentalReimbursement" ? reimbursed : Math.min(actualRent, reimbursed || actualRent),
        percentage,
        months,
        warnings: eligibilityConfirmed
          ? []
          : ["Rental reimbursement or employer-provided accommodation treatment requires employer scheme/control and supporting documents."],
      };
    }

    return {
      treatment,
      eligibilityStatus: treatment === "cashAllowance" ? "ELIGIBLE" : "NOT_APPLICABLE",
      taxableHousingAmount: treatment === "cashAllowance" ? reimbursed : 0,
      rentalValue: 0,
      cashEquivalent: treatment === "cashAllowance" ? reimbursed : 0,
      percentage: 0,
      months,
      warnings: [],
    };
  }

  function compareFullEngineSaving(baseInput, changedInput, calculateScenario) {
    const before = calculateScenario(baseInput);
    const after = calculateScenario(changedInput);
    return {
      before,
      after,
      estimatedTaxSaving: Math.max(0, before.taxPayable - after.taxPayable),
    };
  }

  const engine = {
    cap,
    progressiveTax,
    progressiveBreakdown,
    standardTax,
    taxAfterReduction,
    calculateTax,
    housingDeductionLimit,
    calculateHousingBenefit,
    compareFullEngineSaving,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = engine;
  }

  root.HKTaxEngine = engine;
})(typeof globalThis !== "undefined" ? globalThis : window);
