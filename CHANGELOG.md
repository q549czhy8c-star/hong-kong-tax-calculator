# Changelog

## 2026-09-14

### Added

- `tax-rules.js` with versioned 2025/26 and 2026/27 Hong Kong Salaries Tax rules, source metadata, and last-verified date.
- `tax-engine.js` with pure calculation functions for progressive tax, standard tax, reductions, housing deduction caps, housing benefits, and full-engine scenario comparisons.
- Advanced employment income inputs and primary taxpayer housing-benefit treatment.
- Housing benefit explanation panel in the tax breakdown.
- Regression tests in `tests/tax-engine.test.js`.
- `AUDIT.md`, `TAX_RULES.md`, and `ENHANCEMENT_PLAN.md`.

### Changed

- Replaced hard-coded top-level tax constants in `app.js` with shared rule data.
- Domestic rent and home-loan interest now use HK$100,000 base caps and only apply HK$120,000 when the user has children, reflecting the additional ceiling structure.
- Rules tab now displays active tax year, rule version, and last verified date.

### Fixed

- Reduced risk of stale tax constants by centralizing rules.
- Prevented rental reimbursement from being modeled as an ordinary deduction.
