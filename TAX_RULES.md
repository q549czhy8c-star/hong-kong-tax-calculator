# Tax Rules

Last verified: 2026-09-14

Primary rule data lives in `tax-rules.js`. UI code must not redefine tax-law constants.

## Official Sources Used

- IRD 2026-27 Budget Tax Measures FAQ: allowances, 2025/26 one-off concession, 2026/27 elderly residential care cap.
- IRD 2024-25 Budget Tax Measures FAQ: two-tier standard-rate regime.
- IRD Tax Deduction for Domestic Rent: qualifying tenancy framework and HK$100,000 general ceiling.
- IRD Increased ceiling for home loan interest and domestic rent: HK$20,000 additional ceiling for qualifying taxpayers residing with a child.
- IRD Housing Benefits: rental value percentages of 10%, 8%, and 4%.
- IRD Completion and Filing of Tax Return - Individuals: BIR60 reporting context.

## Implemented Corrections

- Annual rules are now versioned independently for 2025/26 and 2026/27.
- Progressive bands and two-tier standard-rate bands are centralized.
- Domestic rent and home-loan interest use HK$100,000 as the base ceiling and HK$120,000 only when a qualifying child condition may apply.
- Rental Reimbursement / employer-provided accommodation is modeled separately from ordinary deductions.
- The rules tab displays active tax year, rule version, and last verified date.

## Remaining Verification Items

- Confirm enacted final 2026/27 legislative text when available against the current IRD Budget FAQ data.
- Add official worked examples beyond the current engine unit tests.
- Split QDAP and TVC into separate UI inputs while preserving their combined statutory cap behavior where applicable.
