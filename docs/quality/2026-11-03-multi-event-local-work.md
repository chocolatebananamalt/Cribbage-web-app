# Optional multi-event financial support and Side Pool selection — local work

Authorization: owner Sentinel_d00230733a58819185ecf06bca123956 approved preparation/implementation/testing locally. No push, hosted migration, publication, production or saved-draft changes. Lead uses Terra equivalent; independent Sol reviews high-risk changes, as AGENTS requires. Existing saved draft c029953d-7402-40bd-ac8c-c45b94e26921 remains version 2 and is not an acceptance fixture for these local changes.

## Observable acceptance

- Main-only remains valid; optional Consolation must retain a distinct declaration, financial source and results domain. No mandatory-Consolation rule.
- Altering Consolation terms must not stale an unchanged Main declaration; changing an event's own fee or pool terms must stale its own declaration. Stale UI requests must not bind silently to newer terms.
- Every receipt and expense has one source identity, explicit event/component allocations, total conservation and immutable audit. No tournament-wide receipt or expense counted twice; no inferred linkage of legacy Side receipts to roster receipts.
- Historical V1–V9 declarations/finals, schemas and exact accepted replays remain intact. New unsupported domains fail closed, never become apparent payout success.
- Side Pool type is distinct from its optional name; graduated choices round-trip, disclosed ratio must match, historical untyped pools remain untyped. Paid scorecard ranking is independent of qualification. Equal variants remain unavailable until their recipients/count/weight policy is explicit.
- Normal roles, immutable recovery, idempotence, current sources, concurrency and synthetic fixture restrictions remain enforced. Synthetic finance is visibly and durably distinguished from observed funds.

## Current implementation boundaries

0274 is new pristine opt-in financial persistence, not a V8/V9 bypass. It initially admits base receipts and explicit expense allocation only; it does not yet classify benefit eligibility or certify minimum participant return. Unsupported Q/Side components remain blocked until consent and single-source receipt contracts are integrated. Readers explicitly report accounting unavailable.

0275 adds typed graduated Side intent, exact replay validation, materialization/readback and ratio-disclosure binding. It does not publish a policy from a draft choice and does not invent equal-pool semantics.

0276 is a versioned per-event prize declaration store/reader/writer with its own settings fingerprint, role and pre-collection guards. It explicitly reports accountingReady=false; no activation binding or payout consumer is implied. Existing declaration paths remain unchanged.

Consolation completion remains a concrete implementation boundary: current canonical four- and five-qualifier playoff evidence gates are Main/12-game specific. A declaration alone does not establish Consolation playoff/MRP readiness. Those sources must be extended and tested against applicable cached rules before full multi-event accounting can be called complete.

## Local controlled Q scenario

tests/fixtures/twenty-player-multi-pool-plan.mjs generates 120 pairings, twelve games per fictional entrant, valid starting seats and five qualifiers. Qualification uses game points, wins, net spread points, then positive spread points; Q separately uses game points, wins, positive spread points. Sixteen planned paid Q entrants include exactly three qualifiers. Ranked Q awards are 65/50/30/15 dollars, totaling160; the fourth recipient is the highest eligible nonqualifier. Two local tests passed. This plan is not hosted evidence, played games, receipts or user-approved prize weights.

## Required final proof before rollout proposal

### Integration checkpoint: simulated finance dispatch

Payments now checks the database-owned financial mode before loading any ordinary receipt/expense controls on the test deployment. Only an exact verified `not_enabled` result permits the legacy view. Enrolled simulation uses the separately labelled named-selector workspace; errors, missing capability and unknown states block controls. This requires the reviewed database capability before application publication; missing RPC is never interpreted as non-enrollment. The event summary must match the requested tournament and is restricted to its enrolled synthetic event IDs. Each event selector still independently validates active/current bindings. The focused dispatch test passed; final combined page verification remains pending.

The 176-game fixture reached normal roster check-in, registration closure, official binding, initial seating and event attendance opening. Its first desk check-in exposed the old payment predicate's inability to recognize the new immutable simulated receipts. Local migration 0286 addresses that compatibility boundary without fabricated legacy receipts or bypassing attendance. Combined-schema tests passed original function OID/owner/ACL preservation, legacy comp eligibility, one paid entrant while another is unpaid, and rejection of unpaid/wrong/stale shared sources. Independent review and the resumed full lifecycle remain required.

### Executed intermediate milestone (not a release approval)

The structured lifecycle has now passed all 176 actual generated-paper capture/review operations (120 Main, 56 Consolation), normal roster/attendance/seating/schedule/start controls, current five/four-player qualification, both source-bound playoffs and successful actual 0281 previews. Q1 produced 65/50/30/15 dollars, including the planned paid nonqualifier; equal Q2 produced five 80-dollar awards. Outsider access, stale Main invalidating dependent Consolation, mode replay and truthful synthetic provenance were checked. No legacy receipts were inserted. The exact network-disabled disposable container and database were removed. This proves previews, not final unpaid accounting or hosted acceptance.

The first scoped financial completion will use **joint tournament closure** after all supported Main/Consolation events have current declarations, sources, qualification, playoffs, cross-check closure and unpaid drafts. This is a conservative implementation boundary, not a newly claimed user payout policy. Existing financial source currentness includes tournament-wide base-source validation; pretending to independently finalize Main while Consolation changes would be unsafe. Before joint closure, normal event progress remains available. At joint financial closure, all referenced finance dependencies must be frozen together. Unsupported mixed event domains must fail closed. No real disbursement is introduced.

The full repository suite passed 1,188 app tests, audit (no known production vulnerabilities), ESLint, production build, provider checks and eight workspace checks; six private handoff checks passed. Logs: test-results/multi-event-verify-reviewed.log and test-results/multi-event-handoff.log. Later source changes still require final verification against frozen hashes.

Side selector: 29 focused tests and 22 phone/desktop scenarios passed; real isolated PostgreSQL tests include exact request binding, old-format carry-forward, lost first Side write, conflicting replay, concurrent reservations, lifecycle/lock-order checks, typed readback and disclosed ratio. Current 0275 SHA256: 7296e30b361deaf8d0334e0adaac442626c5ab7eef25a3fea70c45e5c10af2b0. A crossing in-flight legacy request fails closed and needs explicit recovery; no automatic discard.

Real isolated database tests passed the source-ledger and declaration/activation chain through 0280 (0278 also passed its own combined predecessor chain). These tests include 20 source receipts, distinct base/Q/Side funds, source-currentness, a shared $74 expense split $60 Main/$14 Consolation, actual expense-review persistence/replay/staleness, two-event declaration binding, stale atomic rejection and legacy V1 activation after the trigger extension. Original trigger OID/owner/ACL/enabled state stayed unchanged. This is not yet complete award/finalization proof.

0278 now has a reviewed immutable synthetic Consolation playoff writer and owner-prepared artifact provenance; source/eligibility, 7/8/9/10-game MRP thresholds, same-round equality, roles, replay, conflicting writes and both financial race orders passed. Its initial qualification fixture uses explicitly unstructured synthetic score rows; do not mislabel that as structured paper capture/review acceptance. A new 176-game structured two-event fixture is being built to test the whole current path.

0279 classifies only each event's allocated expense share, conserving all sources and requiring the exact event sanction assessment. It preserves all nonclassification blockers. 0281's pool allocation kernel passes the controlled Q example and rejection tests; successful source-backed award preview remains pending. No new draft/final accounting writer is accepted or published.

Recovered Q policy: docs/decisions/2026-10-29-q-v2-canonical-unpaid-accounting.md and docs/quality/2026-10-29-q-operating-schedules-progress.md explicitly distinguish graduated paid-card ranking (game points, wins, positive spread points) from regular playoff prizes and equal paid-qualifier Q. Do not reinterpret this as graduated Q following final playoff order.

Full migration-chain tests, persisted two-event fixture assertions, races/replays, historical fingerprints/ACLs, API and browser checks, independent final review, pnpm verify and private handoff checks. No completed or publishable claim until these are recorded. Exact staged migration/application and publication approval will be requested separately after review; existing draft and production remain untouched.
