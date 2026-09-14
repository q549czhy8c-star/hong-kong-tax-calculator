# Hong Kong Tax Calculator

A static web app for estimating Hong Kong salaries tax for 2025/26 and 2026/27.

## Features

- Salaries tax calculation using progressive and standard rates
- Allowances for marital status, children, parents/grandparents, disability, and dependants
- Common deductions including MPF, rent, home loan interest, education, VHIS, annuity/TVC, donations, elder care, and reproductive services
- 2025/26 tax reduction support
- Public rental housing rent scenario comparison
- HOS mortgage cash-flow comparison with home loan interest tax prompt
- Selectable reference values for PRH rent, rates, HOS down payment, interest rate, repayment term, and management-fee budget
- 30-year scenario budget with salary growth, PRH rent growth, fee growth, mortgage interest, and tax effects
- Versioned 2025/26 and 2026/27 tax rules with source metadata
- Advanced employment income breakdown for the primary taxpayer
- Rental Reimbursement / employer-provided housing benefit rental-value estimate with eligibility warnings
- Regression tests for the pure tax engine

## Run Locally

Open `index.html` in a browser.

## Test

```bash
node --test tests/tax-engine.test.js
```

## Key Files

- `tax-rules.js` - versioned Hong Kong Salaries Tax rule data and official source metadata
- `tax-engine.js` - pure tax calculation helpers shared by the app and tests
- `app.js` - browser UI orchestration, state, projection, and rendering logic
- `AUDIT.md` - repository audit and migration plan
- `TAX_RULES.md` - tax-rule notes and verification status
- `ENHANCEMENT_PLAN.md` - phased implementation plan

## Sources

- Hong Kong Inland Revenue Department tax rate table
- Hong Kong Inland Revenue Department 2026-27 Budget tax measures
- Hong Kong Housing Authority Well-off Tenants Policies
- Hong Kong Housing Authority subsidised sale flats mortgage arrangement notes
- Hong Kong Housing Authority Housing in Figures 2025
- Rating and Valuation Department rates notes
- Hong Kong Monetary Authority interest-rate statistics
- Rating and Valuation Department property market annual summaries
