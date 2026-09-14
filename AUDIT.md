# Audit

Last audited: 2026-09-14

## Current Architecture

- Static vanilla web app: `index.html`, `styles.css`, `app.js`.
- No build step, package manager, framework, server, or prior automated tests.
- State is stored in browser `localStorage` and can be imported/exported as JSON.
- PDF export is browser print-to-PDF via `window.print()`.
- The app combines calculator UI, tax rules, calculation logic, advice text, public-housing/HOS scenario logic, projections, chart drawing, persistence, and export behavior in one large `app.js`.

## Existing Functionality

- 2025/26 and 2026/27 salaries tax estimates.
- Progressive-rate versus standard-rate comparison.
- Basic, married, single-parent, child/newborn, parent/grandparent, sibling, disability, and disabled-dependant allowances.
- Common deductions: MPF, self-education, home loan interest, domestic rent, VHIS, annuity/TVC, elderly residential care, charitable donations, assisted reproductive services.
- Married joint/separate rough comparison.
- Public rental housing and HOS cash-flow planner with long-term scenario projection.
- JSON import/export and print-to-PDF.
- Rule/source links are shown in a rules tab.

## Calculation Issues Found

- Tax constants were embedded directly in `app.js`, making annual updates risky and hard to audit.
- Home-loan interest and domestic-rent deductions used HK$120,000 as the blanket cap. IRD materials state the general cap is HK$100,000, with an additional HK$20,000 ceiling from 2024/25 when child-related conditions are met.
- Rental reimbursement / employer-provided accommodation was not modeled. Housing allowance was effectively only an ordinary income field.
- Tax-saving advice estimated savings using a marginal-rate shortcut instead of full before/after engine comparisons.
- Spouse assessment is useful but simplified; it does not yet compare all legally valid allocation permutations.
- Public-housing and HOS assumptions are mixed into the tax calculator and can look more certain than a projection should.

## Tax-Rule Issues

- Versioning was implicit (`2025`, `2026`) rather than documented with rule version, source, and verification date.
- Official-source references were not attached to individual rule groups.
- Deductions such as TVC and QDAP were combined in the UI rather than represented distinctly in rule data.
- Eligibility rules were mostly text warnings rather than structured statuses.

## UX Issues

- The form exposes too many fields at once.
- Housing planner content competes with core Salaries Tax tasks.
- Advanced employment income categories were missing.
- Users can see recommendations without a clear “why am I seeing this?” structure.
- Tax-return declaration guidance is not yet separated into confirmed, possible, and not applicable items.

## Technical Debt

- Large single-file JavaScript module.
- DOM, calculation, recommendation, persistence, and projection code are tightly coupled.
- No automated tests before this enhancement pass.
- Several calculations are difficult to verify because intermediate assumptions are not represented as data.

## Recommended Architecture

- `tax-rules.js`: authoritative, versioned annual rule data with sources and verification date.
- `tax-engine.js`: pure calculation functions usable by browser UI and tests.
- `app.js`: DOM orchestration only.
- Future `optimizer.js`: deterministic recommendation/scenario engine that consumes `tax-engine.js`.
- Future `housing-planner.js`: public-housing/HOS projection module separate from salaries-tax rules.

## Migration Plan

1. Extract versioned tax rules and pure calculation helpers.
2. Add regression tests around tax bands, allowances, deductions, concessions, and housing benefit treatment.
3. Correct cap and eligibility bugs before cosmetic redesign.
4. Add detailed employment income and Rental Reimbursement / Housing Benefit treatment.
5. Build deterministic recommendations from full-engine scenario comparisons.
6. Move public-housing/HOS projections into a separate planner section/module.
7. Redesign the UI into a guided wizard after calculation behavior is stable.
