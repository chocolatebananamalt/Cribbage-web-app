# Modern player scoring and V3 unpaid-award linkage — private source checkpoint

## Implemented

`database/proposals/selected-step-player-scoring-v3.sql` connects normal authenticated digital-player actions to the actual modern Start/generation source. It requires matching JWT subject/role/expiry, live nondeleted/nonbanned user and live owned session; the actual current checked-in digital participant, account link and preference version must match the persisted modern generation. This is checked before mutation and exact owned recovery. The generation's author is derived from the stored row, not a posted identity.

Fully revoked internal evidence constructors preserve all modern activation, primary-Director author, rule, qualification and parent-result validation while removing the inappropriate requirement that a PLAYER act as a service/Director. Gate and match capture/hash domains remain identical to modern authoring. No JWT or session claims are overwritten. The internal full source cannot be a player API response.

The versioned action writer preserves the original immutable operations/actions/submissions/confirmations/results and exact retry protocol. Two player submissions and their independent own confirmations remain required for actual verified games; source/game/generation/parent/version, sequence, latest-own-submission and winner checks remain. Null/unavailable modern sources reject safely. Finish rechecks live player identity and records separate session audit in the transaction. The redacted own-player view exposes names/fixed Tournament IDs, series progress, own submission/confirmation and only an opponent-submitted boolean; unfinished opponent answers, private captures, profile/session IDs and audit data are withheld. An unstarted game has no server-reserved game ID; no offline reservation claim.

`database/proposals/selected-step-awards-v3.sql` adds a genuine separate immutable unpaid-award journal whose fund-review foreign key references `selected_step_fund_reviews_v3` and whose prize-revision foreign key references the existing actual modern proposal journal. No legacy review/allocation row or ID is manufactured. The collector consumes the real current V3 fund, sporting results, proposal head/adjustments and conserved regular-only ledger fund. It reuses existing reviewed method/group arithmetic and rounding, preserves explicit unpaid finishing groups, equal group adjustments, fund balance/rank/recipient postconditions and Director review.

The new actor/session-bound writer rechecks source, actual V3 review ID, current proposal revision and live access before writing operations/set/groups/recipients/outcome/audit. Exact retries recover the saved result. The official record reader is historical/unpaid with `currentSourceVerified:false`; no disbursement or ACC award/submission is implied. Ungated reciprocal guards prevent duplicate regular liabilities across old/new domains and block incompatible post-final source revisions; standalone V3 Q/Side funds remain distinct and can coexist.

## Supported source chain and explicit holds

Modern policy/qualification -> reviewed modern playoff Start/generation -> normal digital-player independent game confirmations -> completed sporting source -> reviewed V3 ownership and separate Q/Side proof -> explicit zero-income/sanctioning coverage review -> current V3 fund -> saved-method proposal/group adjustments -> genuine V3 unpaid-award journal/readback.

This is **source implementation**, not a proven operational or device chain. Every new gate remains false; callable functions/tables are revoked. No route/provider/UI/grant has been enabled. Existing legacy functions, guards, journals and frozen216 package remain unchanged except the separately documented narrow modern Start-trigger dispatch from the prior checkpoint.

- The new scoring slice is digital/digital only. Paper/mixed tentative handoff, transcription, independent cross-check and adjudication remain their distinct established protocol. They are not converted to digital verification or silently accepted as completed modern playoff evidence. Modern mixed-paper prize integration remains a source gap.
- Recorded-income cases, including older/voided history, remain held for the actual modern income-lineage adapter. The supported fund review explicitly confirms zero; missing verification never implies complete funds.
- Graduated/winner-multiplier cases that pay first-round losers hold with `modern_entry_fee_reference_adapter_required`; no advertised/discounted/bundled fee is substituted. Equal/Winner Takes All and otherwise supported partial-field methods retain original rules. Imbalanced/impossible selected rounding remains held; no silent refund/method change.
- Actual application provider/transport/Results decoder and UI integration for these V3 contracts remain unbuilt/unmounted. Existing V2 DTOs must not be relabeled as V3.

## Focused evidence

- `node --conditions=react-server --experimental-strip-types --test tests/selected-step-player-scoring-v3.test.mjs`: **4/4 pass**.
- `node --conditions=react-server --experimental-strip-types --test tests/selected-step-awards-v3.test.mjs`: **6/6 pass**.
- Changed-path ESLint: passed (final result recorded in task response). No application TypeScript changed; no broad suite/build/audit/tournament replay.
- Independent source review GO for player authorization/privacy and V3 FK/reciprocal/source integrity. Review caught an uninitialized proposal-head variable in the new award-source prefix; it was restored, current head/input/source checked, and a focused retained-adjustment regression added. Fix re-reviewed GO.

These are actual-source seam/parity/privacy checks, not executed SQL or a synthetic upstream success claim. No database/container created, no cleanup obligation, hosted action, actual participant/award/payment/submission, public upload or denied-operation retry.

Smallest next acceptance: install exact candidates/prerequisites in one permitted fictional local fixture, use actual modern review/Start/generation functions and two authenticated fictional player sessions for one series, then actual current ledger/proposal/fund/award transactions with authorization, source drift, exact readback/retry and late rollback. Include current Q/Side contracts rather than replacing collectors. Do not call this provider/device acceptance. Full mixed-paper and recorded-income/fee cases require the explicit source adapters above, not an acceptance waiver.
