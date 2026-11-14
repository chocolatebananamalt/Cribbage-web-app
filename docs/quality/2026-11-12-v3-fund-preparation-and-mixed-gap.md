# V3 Fund Preparation and Modern Mixed Dependency — 2026-11-12

## Completed local capability

The gated primary-Director Regular Prize Review page now includes an actual fund-preparation section backed by the existing `app.selected_step_final_review_source_v3` collector and `app.review_selected_step_fund_v3` transaction. New private wrappers are in `database/proposals/selected-step-fund-transport-v3.sql`; all are revoked and the transport gate is false. No SQL was executed.

The normal authenticated API rechecks subject, live user, session and primary Director before and after private service calls. Browser responses are allowlisted totals, classified expense candidates and review metadata; raw ownership, sporting captures, receipts and private identities are withheld. Actual current owned-source decoding and independently verified sporting proof are required for an available preview. Regular entry, Q and Side funds remain separate.

Director flow: inspect totals -> choose an existing classified sanctioning expense (or no expense for zero assessment) -> real collector checks coverage -> explicitly confirm reviewed zero income and enter reason -> refresh/revalidate source and intent -> retain exact request -> explicitly send/check/retry -> archive confirmed outcome before new review. Existing transaction revalidates source/version and fee coverage; no new arithmetic or policy. The assessment is covered by the already-subtracted expense, never deducted twice. Recorded/voided income and unsupported fee cases stay held. A saved modern prize proposal remains a prerequisite; this change does not add proposal authoring.

Request retention uses the existing coordinated IndexedDB store, with separate V3 account/event key and immutable outcome archive. Unknown bytes and uncertain replies stay retained. Exact operation recovery is authenticated and matched against persisted request/outcome, separately labeled historical; it does not establish current fund approval, award approval or payment. Independent review identified stale local consent; fixed using a committed intent lease invalidated synchronously by edits, uncheck, expense change, refresh and identity changes, rechecked after fresh source read before retention. Exact retries reuse the original request and do not require new consent.

## Focused evidence

- Five tests in `tests/selected-step-fund-connected-v3.test.mjs` pass: current collector/independent sporting projection and failure holds, exact retention/lost reply/reload/archive, unknown data/source drift, session/role checks and revoked wrappers, revoked consent during asynchronous fresh read.
- Offline actual-component Chrome checks at 390 and 1440 pass: retain before explicit send, no automatic send, lost reply recovery, historical/current distinction, account-loss concealment and enlarged-text no-overflow. Zero network requests; synthetic injected browser ports only. Evidence `test-results/selected-step-fund-browser-v3/result.json` and screenshots. This is not real provider or database acceptance.
- TypeScript no-emit and focused changed-path ESLint passed. Independent re-review GO: stale-consent P2 closed; SQL/provider acceptance remains unverified.
- No broad suite, database/container/resource creation, hosted operation, actual award/payment/submission, denied retry or frozen216 release modification.

## Genuine modern mixed-paper playoff gap

Inspection established that no existing ordinary persisted manual journal can simply be plugged into modern playoff proof:

1. `app.manual_mixed_handoff_v1`, hybrid/paper transcription/review and manual adjudication are bound by foreign keys to `app.canonical_games` and `app.score_submissions` (ordinary qualifying cards).
2. `app.native_mixed_playoff_*` paper/dispute journals are bound to synthetic simulation-start/context records and explicitly fictional evidence statements.
3. Modern `app.selected_step_series_match_source_v3` inherits the genuine match source's requirement for two checked-in linked DIGITAL roster rows (`distinct_linked_digital_players_required`). Its game proof schema references two actual digital submissions and confirmations. There is no compatible ordinary mixed match generation or persisted paper-verification proof to read.

These are SOURCE IMPLEMENTATION gaps, not a new membership/owner policy or a request for hosted access. No manual workflow code was relabeled or weakened. Existing qualifying Yes/No remains tentative; later qualifying play and independently verified manual cards are unchanged. No tentative row was admitted to qualification, playoff advancement, prize proof or Results.

Next actual manual implementation needs compatible ordinary paper-mode match authoring plus a generation/game/version-bound append-only handoff/transcription/independent-review/adjudication journal and reader. It must supply genuine verified result proof to parent progression and sporting/award readers, retaining holds after dependent advancement rather than inventing reversals. Existing digital and synthetic protocols must remain compatible and distinct. This is more than an adapter over existing journals, and remains unbuilt in this checkpoint.

## Acceptance limits

All new gates remain false; RPC EXECUTE remains revoked. SQL parsing/install, actual transactions/ACL/rollback/concurrency and real signed-in provider/device/IndexedDB full-reload acceptance are unverified. The narrow next acceptance is these wrappers with the genuine existing V3 collector/writer, fictional local inputs and exact history recovery; no full tournament rehearsal needed. No claim of complete mixed playoff or complete Setup-to-prize human flow.

