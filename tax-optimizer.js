(function (root) {
  "use strict";

  const STATUS = {
    ELIGIBLE: "ELIGIBLE",
    POSSIBLY_ELIGIBLE: "POSSIBLY_ELIGIBLE",
    REQUIRES_CONFIRMATION: "REQUIRES_CONFIRMATION",
    NOT_ELIGIBLE: "NOT_ELIGIBLE",
    ALREADY_MAXIMIZED: "ALREADY_MAXIMIZED",
  };

  function moneyAmount(amount) {
    return Math.max(0, Number(amount) || 0);
  }

  function unused(limit, currentClaim) {
    return Math.max(0, moneyAmount(limit) - moneyAmount(currentClaim));
  }

  function calculateDeductionSaving(context, additionalDeduction) {
    if (additionalDeduction <= 0 || context.baseTax.taxPayable <= 0) return 0;
    const before = context.taxEngine.calculateTax(context.netIncome, context.allowances, context.yearRules, context.taxRules);
    const after = context.taxEngine.calculateTax(
      Math.max(0, context.netIncome - additionalDeduction),
      context.allowances,
      context.yearRules,
      context.taxRules,
    );
    return Math.max(0, before.taxPayable - after.taxPayable);
  }

  function deductionOpportunity(context, config) {
    const remaining = unused(config.limit, config.currentClaim);
    let status = config.status || STATUS.POSSIBLY_ELIGIBLE;
    if (config.notEligible) status = STATUS.NOT_ELIGIBLE;
    if (!config.notEligible && config.currentClaim > 0 && remaining === 0) status = STATUS.ALREADY_MAXIMIZED;
    if (!config.notEligible && config.currentClaim > 0 && remaining > 0 && !config.status) status = STATUS.ELIGIBLE;

    return {
      id: config.id,
      name: config.name,
      eligibilityStatus: status,
      currentClaim: moneyAmount(config.currentClaim),
      maximumPotentialClaim: moneyAmount(config.limit),
      unusedAllowance: remaining,
      estimatedTaxSaving: calculateDeductionSaving(context, remaining),
      reason: config.reason,
      actionRequired: config.actionRequired,
      documentsRequired: config.documentsRequired || [],
      officialIRDReference: config.officialIRDReference,
    };
  }

  function buildOpportunities(context) {
    const d = context.yearRules.deductions;
    const sources = context.taxRules.sources;
    const hasTax = context.baseTax.taxPayable > 0;
    const hasChild = context.facts.children > 0;
    const rentLimit = context.taxEngine.housingDeductionLimit(context.yearRules, hasChild, "rent");
    const homeLoanLimit = context.taxEngine.housingDeductionLimit(context.yearRules, hasChild, "homeLoan");
    const opportunities = [
      deductionOpportunity(context, {
        id: "domesticRent",
        name: "住宅租金扣除",
        currentClaim: context.claims.rent,
        limit: rentLimit,
        status: context.claims.rent > 0 ? STATUS.ELIGIBLE : STATUS.REQUIRES_CONFIRMATION,
        reason: context.claims.rent > 0 ? "你已輸入住宅租金扣除。" : "如你租住香港主要居所並有合資格及已加蓋印花租約，可能可申索。",
        actionRequired: context.claims.rent > 0 ? "確認租約、租期、租客人數及實付租金。" : "確認是否有合資格租約，然後輸入合資格租金。",
        documentsRequired: ["租約", "印花紀錄", "租金付款紀錄"],
        officialIRDReference: sources.rent.officialSource,
      }),
      deductionOpportunity(context, {
        id: "homeLoan",
        name: "居所貸款利息",
        currentClaim: context.claims.homeLoan,
        limit: homeLoanLimit,
        status: context.claims.homeLoan > 0 ? STATUS.ELIGIBLE : STATUS.REQUIRES_CONFIRMATION,
        reason: context.claims.homeLoan > 0 ? "你已輸入居所貸款利息。" : "如物業為自住居所且符合擁有權及貸款條件，可能可申索。",
        actionRequired: "確認自住、業權比例、貸款用途及利息金額。",
        documentsRequired: ["按揭利息結單", "物業業權資料"],
        officialIRDReference: sources.additionalHomeLoanRent.officialSource,
      }),
      deductionOpportunity(context, {
        id: "annuityTvc",
        name: "合資格年金 / TVC",
        currentClaim: context.claims.annuity,
        limit: d.annuity,
        status: context.claims.annuity > 0 ? STATUS.ELIGIBLE : STATUS.POSSIBLY_ELIGIBLE,
        reason: context.claims.annuity > 0 ? "你已輸入合資格年金 / TVC。" : "如你有合資格年金保費或可扣稅自願性供款，可考慮申索。",
        actionRequired: "確認保單 / TVC 帳戶是否合資格並輸入實付金額。",
        documentsRequired: ["保費或 TVC 供款證明"],
        officialIRDReference: sources.bir60.officialSource,
      }),
      deductionOpportunity(context, {
        id: "vhis",
        name: "VHIS 自願醫保保費",
        currentClaim: context.claims.vhis,
        limit: d.vhisPerPerson * Math.max(0, context.facts.vhisPeople),
        status: context.facts.vhisPeople > 0 ? (context.claims.vhis > 0 ? STATUS.ELIGIBLE : STATUS.REQUIRES_CONFIRMATION) : STATUS.POSSIBLY_ELIGIBLE,
        reason: context.facts.vhisPeople > 0 ? "你已輸入 VHIS 受保人數。" : "如你為自己或指明親屬支付合資格 VHIS 保費，可能可申索。",
        actionRequired: "輸入受保人數及合資格保費；如沒有 VHIS，則不適用。",
        documentsRequired: ["VHIS 保單及保費證明"],
        officialIRDReference: sources.bir60.officialSource,
      }),
      deductionOpportunity(context, {
        id: "education",
        name: "自我進修開支",
        currentClaim: context.claims.education,
        limit: d.education,
        status: context.claims.education > 0 ? STATUS.ELIGIBLE : STATUS.POSSIBLY_ELIGIBLE,
        reason: context.claims.education > 0 ? "你已輸入自我進修開支。" : "如課程與受僱工作或業務需要相關並符合條件，可能可申索。",
        actionRequired: "確認課程及付款是否符合自我進修開支條件。",
        documentsRequired: ["課程收據", "課程資料"],
        officialIRDReference: sources.bir60.officialSource,
      }),
      deductionOpportunity(context, {
        id: "donations",
        name: "認可慈善捐款",
        currentClaim: context.claims.donations,
        limit: context.limits.donationCap,
        status: context.claims.donations > 0 ? STATUS.ELIGIBLE : STATUS.POSSIBLY_ELIGIBLE,
        reason: context.claims.donations > 0 ? "你已輸入認可慈善捐款。" : "如你有向認可慈善機構捐款且符合最低金額要求，可能可申索。",
        actionRequired: "確認收據上的機構及金額符合 IRD 要求。",
        documentsRequired: ["認可慈善捐款收據"],
        officialIRDReference: sources.bir60.officialSource,
      }),
      deductionOpportunity(context, {
        id: "elderCare",
        name: "長者住宿照顧開支",
        currentClaim: context.claims.elderCare,
        limit: d.elderCare,
        status: context.claims.elderCare > 0 ? STATUS.ELIGIBLE : STATUS.POSSIBLY_ELIGIBLE,
        reason: context.claims.elderCare > 0 ? "你已輸入長者住宿照顧開支。" : "如你為合資格長者支付認可院舍住宿照顧開支，可能可申索。",
        actionRequired: "確認院舍資格、受養人資格及實付金額。",
        documentsRequired: ["院舍收據", "受養人資料"],
        officialIRDReference: sources.bir60.officialSource,
      }),
      deductionOpportunity(context, {
        id: "reproductive",
        name: "輔助生育服務開支",
        currentClaim: context.claims.reproductive,
        limit: d.reproductive,
        status: context.claims.reproductive > 0 ? STATUS.ELIGIBLE : STATUS.POSSIBLY_ELIGIBLE,
        reason: context.claims.reproductive > 0 ? "你已輸入輔助生育服務開支。" : "如你有合資格輔助生育服務開支，可能可申索。",
        actionRequired: "確認服務及付款文件是否符合扣除條件。",
        documentsRequired: ["醫療服務及付款證明"],
        officialIRDReference: sources.bir60.officialSource,
      }),
    ];

    opportunities.push(buildRentalReimbursementOpportunity(context));
    opportunities.push(buildSpouseOpportunity(context));

    return opportunities
      .map((item) => ({
        ...item,
        estimatedTaxSaving: hasTax ? Math.round(item.estimatedTaxSaving) : 0,
      }))
      .sort((first, second) => second.estimatedTaxSaving - first.estimatedTaxSaving);
  }

  function buildRentalReimbursementOpportunity(context) {
    const benefit = context.housingBenefit || {};
    const sources = context.taxRules.sources;
    const saving = benefit.normalCashScenarioTaxPayable === undefined
      ? 0
      : Math.max(0, benefit.normalCashScenarioTaxPayable - context.baseTax.taxPayable);

    let status = STATUS.NOT_ELIGIBLE;
    if (benefit.treatment === "qualifyingRentalReimbursement" || benefit.treatment === "employerProvided") {
      status = benefit.eligibilityStatus === STATUS.ELIGIBLE ? STATUS.ELIGIBLE : STATUS.REQUIRES_CONFIRMATION;
    } else if (benefit.treatment === "cashAllowance") {
      status = STATUS.POSSIBLY_ELIGIBLE;
    }

    return {
      id: "rentalReimbursement",
      name: "租金發還 / 僱主提供住所",
      eligibilityStatus: status,
      currentClaim: moneyAmount(benefit.rentalValue),
      maximumPotentialClaim: moneyAmount(benefit.cashEquivalent),
      unusedAllowance: 0,
      estimatedTaxSaving: Math.round(saving),
      reason: status === STATUS.NOT_ELIGIBLE
        ? "你未選擇租金發還或僱主提供住所。"
        : "合資格安排以 IRD 租值規則計算，不是普通扣除額。",
      actionRequired: "確認僱主是否有正式制度、審批控制及完整租約/付款證明；不要只重寫糧單字眼。",
      documentsRequired: ["僱傭合約或公司政策", "租約", "租金付款紀錄", "僱主審批紀錄"],
      officialIRDReference: sources.housingBenefits.officialSource,
    };
  }

  function buildSpouseOpportunity(context) {
    const difference = Math.abs(context.spouse.jointTax - context.spouse.separateTax);
    let status = STATUS.NOT_ELIGIBLE;
    let reason = "未選擇已婚評稅或未輸入配偶資料。";
    if (context.spouse.isMarried) {
      status = difference > 0 ? STATUS.ELIGIBLE : STATUS.ALREADY_MAXIMIZED;
      reason = difference > 0
        ? "系統已比較合併及分開評稅，兩者稅款不同。"
        : "合併及分開評稅暫時相若。";
    }

    return {
      id: "spouseAssessment",
      name: "已婚人士合併 / 分開評稅比較",
      eligibilityStatus: status,
      currentClaim: 0,
      maximumPotentialClaim: 0,
      unusedAllowance: 0,
      estimatedTaxSaving: Math.round(difference),
      reason,
      actionRequired: "確認本人及配偶所有入息、扣除額及可分配免稅額。",
      documentsRequired: ["本人及配偶入息資料", "扣除額證明"],
      officialIRDReference: context.taxRules.sources.bir60.officialSource,
    };
  }

  function buildDeclarationSummary(context, opportunities) {
    const confirmed = [
      { name: "基本免稅額", amount: context.yearRules.allowances.basic, reason: "薪俸稅納稅人通常可享有基本免稅額。", source: context.taxRules.sources.allowances.officialSource },
    ];
    const possible = [];
    const notApplicable = [];

    if (context.claims.mpf > 0) {
      confirmed.push({ name: "強積金強制供款", amount: context.claims.mpf, reason: "你已輸入強積金強制供款。", source: context.taxRules.sources.bir60.officialSource });
    } else {
      possible.push({ name: "強積金強制供款", amount: 0, reason: "如你有僱員強制供款，應輸入實付金額。", source: context.taxRules.sources.bir60.officialSource });
    }

    if (context.facts.children > 0) {
      confirmed.push({ name: "子女免稅額", amount: context.facts.children * context.yearRules.allowances.child, reason: "你已輸入子女人數。", source: context.taxRules.sources.allowances.officialSource });
    } else {
      notApplicable.push({ name: "子女免稅額", amount: 0, reason: "你未輸入子女。", source: context.taxRules.sources.allowances.officialSource });
    }

    opportunities.forEach((item) => {
      const summaryItem = {
        name: item.name,
        amount: item.currentClaim || item.maximumPotentialClaim,
        reason: item.reason,
        source: item.officialIRDReference,
      };
      if (item.eligibilityStatus === STATUS.ELIGIBLE || item.eligibilityStatus === STATUS.ALREADY_MAXIMIZED) confirmed.push(summaryItem);
      if (item.eligibilityStatus === STATUS.POSSIBLY_ELIGIBLE || item.eligibilityStatus === STATUS.REQUIRES_CONFIRMATION) possible.push(summaryItem);
      if (item.eligibilityStatus === STATUS.NOT_ELIGIBLE) notApplicable.push(summaryItem);
    });

    return { confirmed, possible, notApplicable };
  }

  function optimizationScore(opportunities, declarationSummary) {
    const relevant = opportunities.filter((item) => item.eligibilityStatus !== STATUS.NOT_ELIGIBLE);
    const resolved = relevant.filter((item) => item.eligibilityStatus === STATUS.ELIGIBLE || item.eligibilityStatus === STATUS.ALREADY_MAXIMIZED);
    const confirmations = relevant.filter((item) => item.eligibilityStatus === STATUS.REQUIRES_CONFIRMATION).length;
    const possible = relevant.filter((item) => item.eligibilityStatus === STATUS.POSSIBLY_ELIGIBLE).length;
    const completion = relevant.length ? (resolved.length / relevant.length) * 70 : 70;
    const declarationBreadth = Math.min(20, declarationSummary.confirmed.length * 3);
    const uncertaintyPenalty = Math.min(25, confirmations * 5 + possible * 3);
    return Math.max(0, Math.min(100, Math.round(completion + declarationBreadth + 10 - uncertaintyPenalty)));
  }

  function buildOptimization(context) {
    const opportunities = buildOpportunities(context);
    const declarationSummary = buildDeclarationSummary(context, opportunities);
    const score = optimizationScore(opportunities, declarationSummary);
    const potentialAdditionalSaving = opportunities
      .filter((item) => item.eligibilityStatus === STATUS.ELIGIBLE || item.eligibilityStatus === STATUS.REQUIRES_CONFIRMATION || item.eligibilityStatus === STATUS.POSSIBLY_ELIGIBLE)
      .reduce((sum, item) => sum + item.estimatedTaxSaving, 0);

    return {
      score,
      opportunities,
      declarationSummary,
      potentialAdditionalSaving,
      confirmedOpportunities: opportunities.filter((item) => item.eligibilityStatus === STATUS.ELIGIBLE).length,
      requiresConfirmation: opportunities.filter((item) => item.eligibilityStatus === STATUS.REQUIRES_CONFIRMATION).length,
    };
  }

  const optimizer = {
    STATUS,
    buildOptimization,
    buildOpportunities,
    buildDeclarationSummary,
    calculateDeductionSaving,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = optimizer;
  }

  root.HKTaxOptimizer = optimizer;
})(typeof globalThis !== "undefined" ? globalThis : window);
