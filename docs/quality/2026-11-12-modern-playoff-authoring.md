# Compatible modern playoff review, Start and generation authoring

Local/default-off candidate: `database/proposals/selected-step-playoff-authoring-v3.sql`. Dependency order: current settings/prize activation and series prerequisites -> current V3 ownership/gate -> selected-step regular ledger -> selected-step final-review adapter -> this authoring candidate. No hosted/package/frozen-release change.

## Implemented source chain

The existing live service-role/primary-Director/actor/session access check is required at each new entry and finish function. New versioned rules review, confirmed playoff Start, match-generation authoring and operation recovery use the actual immutable existing journals. New request kinds distinguish this authoring path; original table hash namespaces, request/outcome values and old records remain intact. Finish functions record a separate actor/session/request/outcome audit event; audit failure shares transaction rollback. Exact retries use the original stored receipt and do not create a second audit/action.

Rules review and Start bind the actual modern activation/rule/qualification source. Generation uses the same V3 series source as the current-fund collector, preserving actual slot/parent/result provenance, current generation/version pins and existing no-rebase-after-player-work recovery holds. Existing <=64 verified placement and large-field feature gates remain unchanged; no new seed or series rules are invented. No game, result, award or payment is created by this authoring slice.

The existing Start table trigger previously always called the legacy source, so an additional writer alone would still fail. The candidate narrowly changes that one lookup: an authoritative operational-binding/activation-pin join selects the modern branch, which requires its new default-off authoring gate and existing service primary-Director scope. It then validates the actual V3 source. Failed modern admission raises; it cannot fall back to legacy. Nonmodern records still call the unchanged legacy source. The trigger retains its original OID, qualification/review/current-head/version/lifecycle checks and grants; new callable functions are revoked. Its existing table access remains private; live-session admission is in every new authoring/finish function.

## Evidence and limits

`node --conditions=react-server --experimental-strip-types --test tests/selected-step-playoff-authoring-v3.test.mjs`: **5/5 pass**. Changed-file ESLint exits **0**. Independent sensitive source review GO, with no material finding. Focused source tests apply every exact-count installer patch to actual original sources plus the existing large-field modification, verify original receipt/hash compatibility, review/current-head/provenance/no-rebase checks, separate audit and exact trigger parity outside the dispatch seam. These are source/parity checks, not SQL/runtime/provider acceptance. No broad suite/rehearsal; no DB/container created or cleanup needed. No denied retry.

Remaining **source** work:

- Actual player scoring still obtains its current match/game source through the legacy reader. This candidate does not authorize a player by impersonating a Director or service identity. A properly session/player-bound modern scoring source/transaction integration is needed before these newly authored matches can be played normally and furnish completed evidence to the collector. Paper/mixed-specific playoff protocols require their own established evidence, not digital substitutes.
- Durable modern award transaction/schema still references V1 fund-review FK. It needs a genuine V3 journal/FK path, preserving reciprocal liability guards and unpaid accounting. Never alias V3 IDs into V1 review rows.
- Recorded additional income and fee-reference cases remain explicitly held where their actual modern lineage adapters are not implemented. No policy was invented or hold waived.

Remaining **acceptance**: SQL parser/install and trigger/function compatibility on exact prerequisites, authorized/outsider/expired-session tests, exact save/readback/retry and rollback. After the scoring and award source gaps close, one bounded real-source fixture can prove the joined chain. No signed-in provider, browser/device or operational-readiness claim follows from these source checks.
