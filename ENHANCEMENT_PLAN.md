# Enhancement Plan

## Completed In This Pass

- Audited the existing static app architecture and calculation concerns.
- Added versioned annual tax-rule data in `tax-rules.js`.
- Added a pure tax engine in `tax-engine.js`.
- Added regression tests for tax bands, allowances, deduction caps, tax concessions, housing benefit rental value, and full-engine scenario comparison.
- Added advanced employment income fields for the primary taxpayer.
- Added conservative Rental Reimbursement / Housing Benefit calculation and explanation UI.
- Corrected domestic rent and home-loan deduction caps to distinguish the HK$100,000 base ceiling from the HK$120,000 child-related ceiling.
- Added deterministic tax opportunity cards, declaration summary, and optimization score.
- Added repository-local agent-skill guardrail skeletons.

## Next Phases

1. Expand spouse advanced income and housing-benefit handling.
2. Split public-housing/HOS logic into a Housing Planner module and label outputs as scenario projections.
3. Convert the large form into a guided questionnaire.
4. Improve print/PDF output into a structured “My Tax Position” report.
5. Add browser-based visual and mobile regression checks.
