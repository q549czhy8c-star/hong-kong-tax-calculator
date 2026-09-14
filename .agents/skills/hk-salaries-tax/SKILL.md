# Hong Kong Salaries Tax Skill

Use this skill for Hong Kong Salaries Tax rules, calculations, allowances, deductions, tax concessions, standard-rate versus progressive-rate comparisons, housing-benefit taxation, and spouse assessment rules.

## Guardrails

1. Official IRD / legislation overrides existing application code and model knowledge.
2. Every calculation must explicitly identify the Year of Assessment.
3. Never automatically carry tax rules from one assessment year to another.
4. UI code must not independently contain tax-law logic.
5. Recommendation logic must not independently define tax-law constants.
6. Rental Reimbursement is not an ordinary tax deduction.
7. Cash Housing Allowance and qualifying Rental Reimbursement are not automatically equivalent.
8. Do not allow prohibited double claims involving housing benefits and Domestic Rent Deduction.
9. Missing eligibility facts must produce `REQUIRES_CONFIRMATION` rather than an assumption.
10. Potential tax saving must be calculated through full before/after tax-engine comparison.
11. Never modify factual taxpayer data simply to generate a lower-tax scenario.
12. Never encourage false declarations, artificial arrangements, fabricated tenancy arrangements, unsupported dependant claims, or remuneration misclassification.
13. Every tax-engine modification requires regression testing.

## Scope

- Maintain authoritative tax-rule references.
- Maintain `tax-rules.js` and pure calculation behavior in `tax-engine.js`.
- Do not make UI design decisions.
