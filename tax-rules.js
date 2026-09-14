(function (root) {
  "use strict";

  const IRD_BUDGET_2026_27 = "https://www.ird.gov.hk/eng/faq/budget2026_27.htm";
  const IRD_BUDGET_2024_25 = "https://www.ird.gov.hk/eng/faq/budget2024_25.htm";
  const IRD_DOMESTIC_RENT = "https://www.ird.gov.hk/eng/tax/drd.htm";
  const IRD_ADDITIONAL_DEDUCTIONS = "https://www.ird.gov.hk/eng/tax/adc.htm";
  const IRD_HOUSING_BENEFITS = "https://www.ird.gov.hk/eng/tax/ere_house.htm";
  const IRD_RETURN_INDIVIDUALS = "https://www.ird.gov.hk/eng/tax/ind_ctr.htm";

  const commonRuleMeta = {
    jurisdiction: "Hong Kong",
    taxType: "Salaries Tax",
    lastVerifiedDate: "2026-09-14",
  };

  const progressiveBands = [
    { limit: 50000, rate: 0.02 },
    { limit: 50000, rate: 0.06 },
    { limit: 50000, rate: 0.1 },
    { limit: 50000, rate: 0.14 },
    { limit: Infinity, rate: 0.17 },
  ];

  const standardRateBands = [
    { limit: 5000000, rate: 0.15 },
    { limit: Infinity, rate: 0.16 },
  ];

  const deductionCaps = {
    mpf: 18000,
    education: 100000,
    elderCare2025: 100000,
    elderCare2026: 110000,
    homeLoanBase: 100000,
    homeLoanWithChild: 120000,
    rentBase: 100000,
    rentWithChild: 120000,
    vhisPerPerson: 8000,
    annuity: 60000,
    tvc: 60000,
    qdap: 60000,
    reproductive: 100000,
  };

  const sourceMap = {
    allowances: {
      sourceName: "IRD 2026-27 Budget Tax Measures FAQ",
      officialSource: IRD_BUDGET_2026_27,
      lastVerifiedDate: commonRuleMeta.lastVerifiedDate,
    },
    twoTierStandardRate: {
      sourceName: "IRD 2024-25 Budget Tax Measures FAQ",
      officialSource: IRD_BUDGET_2024_25,
      lastVerifiedDate: commonRuleMeta.lastVerifiedDate,
    },
    rent: {
      sourceName: "IRD Tax Deduction for Domestic Rent",
      officialSource: IRD_DOMESTIC_RENT,
      lastVerifiedDate: commonRuleMeta.lastVerifiedDate,
    },
    additionalHomeLoanRent: {
      sourceName: "IRD Increased ceiling for home loan interest and domestic rent",
      officialSource: IRD_ADDITIONAL_DEDUCTIONS,
      lastVerifiedDate: commonRuleMeta.lastVerifiedDate,
    },
    housingBenefits: {
      sourceName: "IRD Housing Benefits",
      officialSource: IRD_HOUSING_BENEFITS,
      lastVerifiedDate: commonRuleMeta.lastVerifiedDate,
    },
    bir60: {
      sourceName: "IRD Completion and Filing of Tax Return - Individuals",
      officialSource: IRD_RETURN_INDIVIDUALS,
      lastVerifiedDate: commonRuleMeta.lastVerifiedDate,
    },
  };

  const rules = {
    meta: commonRuleMeta,
    progressiveBands,
    standardRateBands,
    housingBenefit: {
      source: sourceMap.housingBenefits,
      rentalValuePercentages: {
        residentialUnit: 0.1,
        servicedApartment: 0.1,
        hotelTwoRooms: 0.08,
        hotelOneRoom: 0.04,
      },
      eligibilityQuestions: [
        "Employer operates a formal Rental Reimbursement Scheme",
        "Employer has control over reimbursement and tenancy evidence",
        "Tenancy and rent payment documents are available",
        "The arrangement is not merely a payslip relabelling of salary",
      ],
    },
    sources: sourceMap,
    years: {
      2025: {
        label: "2025/26",
        ruleVersion: "2025-26.2026-09-14",
        effectiveYear: "2025/26",
        sources: sourceMap,
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
          mpf: deductionCaps.mpf,
          education: deductionCaps.education,
          elderCare: deductionCaps.elderCare2025,
          homeLoan: deductionCaps.homeLoanBase,
          homeLoanWithChild: deductionCaps.homeLoanWithChild,
          rent: deductionCaps.rentBase,
          rentWithChild: deductionCaps.rentWithChild,
          vhisPerPerson: deductionCaps.vhisPerPerson,
          annuity: deductionCaps.annuity,
          tvc: deductionCaps.tvc,
          qdap: deductionCaps.qdap,
          reproductive: deductionCaps.reproductive,
        },
        taxReduction: 3000,
        notes: [
          "薪俸稅以累進稅率或標準稅率計算，取較低者。",
          "2025/26 年度有 100% 一次性寬減，上限 HK$3,000。",
          "子女免稅額最多計算首 9 名子女；合資格新生子女額外免稅額按 2025/26 規則計一次。",
          "居所貸款利息及住宅租金基本扣除上限為 HK$100,000；如符合與子女同住等額外條件，總上限可達 HK$120,000。",
        ],
      },
      2026: {
        label: "2026/27",
        ruleVersion: "2026-27.2026-09-14",
        effectiveYear: "2026/27",
        sources: sourceMap,
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
          mpf: deductionCaps.mpf,
          education: deductionCaps.education,
          elderCare: deductionCaps.elderCare2026,
          homeLoan: deductionCaps.homeLoanBase,
          homeLoanWithChild: deductionCaps.homeLoanWithChild,
          rent: deductionCaps.rentBase,
          rentWithChild: deductionCaps.rentWithChild,
          vhisPerPerson: deductionCaps.vhisPerPerson,
          annuity: deductionCaps.annuity,
          tvc: deductionCaps.tvc,
          qdap: deductionCaps.qdap,
          reproductive: deductionCaps.reproductive,
        },
        taxReduction: 0,
        notes: [
          "2026/27 起基本、已婚、單親、子女及供養父母/祖父母免稅額按預算案建議提高。",
          "長者住宿照顧開支扣除上限提高至 HK$110,000。",
          "合資格出生後首兩個課稅年度子女可計額外子女免稅額。",
          "2026/27 暫未套用 2025/26 的一次性 HK$3,000 寬減。",
        ],
      },
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = rules;
  }

  root.HK_TAX_RULES = rules;
})(typeof globalThis !== "undefined" ? globalThis : window);
