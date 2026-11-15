# Post-Start simulated game admission — tested observation contract only

## What was built

A pure source protocol observation reuses the existing strict current simulated-Start receipt and native108-game publication observers. It binds one actual modeled canonical game ID/round/sides/fixed Tournament IDs to Start/publication and current supplied consent, roles, ordinary-state and simulation-history models. DD/PD/PP is derived from the pinned6 Digital/12 Paper roster, never a hardcoded pairing count. No new table, SQL function, producer, provider, route, grant or fixture was created.

The typed future private-history envelope explicitly distinguishes known empty from unavailable. Each entry binds tournament/event/Start/game/source, sequence, actor+operation, receipt ID and payload-digest field. Cross-game/Start substitutions, duplicate IDs, stale refs, unsupported actions, extra authority fields and unknown history fail closed. Payload digests/receipt IDs are structural fields ONLY; no database provenance or cryptographic receipt verification is claimed.

Required evidence sequences:

- DD: two different linked Digital players submit their own normalized result, then both confirm the exact two submission IDs. One acknowledgement per side is insufficient.
- PD: linked Digital own submission and exact confirmation plus one fictional Paper side claim/capture and distinct nonself official review. Confirmation binds submission+capture+review.
- PP: both fictional Paper side claims in a capture, followed by distinct nonself official review.

Capture requires current supplied cross-checker; review preserves the existing per-game director/co-director/cross-checker role set. Reviewers cannot be the preparer or either Digital side of that game. A Digital official may review a different game. Pre-draw Paper declaration roles are separate and were not substituted for per-game capture rules. Baseline sources: synthetic-mixed-evidence-v1.sql dispatch plus0144 complete_paper_vs_paper_game_v1/review and0148 hybrid review core. These concepts are reused, NOT their ordinary writers.

Paper evidence explicitly says physicalOriginal=false,fictionalOpponentPlayed=false,independentHumanPlayClaimed=false. Mismatches produce mismatch-needs-review with no next actions/result; extra submissions/corrections cannot silently overwrite immutable evidence. The separate judge/correction producer is not implemented or guessed.

Ordinary-state model must be bound to this tournament/event/Start/game, all canonical games pending, six explicit Start/attendance zero fields, and a named empty=true check for app.native_mixed_admission_score_history_empty_v1. That existing guard covers submissions, confirmations, card lines, paper/hybrid, device recovery, corrections, forfeits, disputes, standings eligibility, excluded extras, schedule amendments, makeup and qualification. Future server code must EXECUTE this full guard under locks, not trust posted booleans or partial counts.

Every output carries sourceObservation=provided-models-not-atomic and false databaseProvenanceVerified,identitySubjectVerified,writeAuthorized,normalStartAuthorized,scoringAuthorized,officialResultVerified,humanPlayVerified,physicalOriginalVerified,moneyMoved,payoutAuthorized. Even simulation-evidence-complete is only a structural model phase. No score was recorded.

## Executed checks / review

8 focused tests pass, including all108 supplied model mappings across DD/PD/PP, all fixed IDs,2+2 confirmations, exact references, self/other-game officials, revocation/stale roots, unknown history, corruption and mismatches. These are in-memory models, NOT a database fixture or108 actual score writes. Full application2222/2222 pass; production build pass; provider readiness pass; workspace/handoff14/14 pass. Full lint0 errors/137 existing warnings, focused changed-file lint0/0.

Independent review GO on source SHA 78738ccc3e7dce04148842ba62ec881d7f202af5ef82f5e96505af4905342ef4; no remaining P1/P2 at observation scope. Clarified per-game versus declaration roles, specified full ordinary-history coverage, added explicit no-human-play claim. Initial TypeScript build exposed a property-narrowing issue; captured the ordinary model in a const and final build passed. An initial test duplicated an existing official model; corrected the test and verified the actual nonself rejection path. No audit or browser-access denial was retried. Safe verify components ran separately; aggregate pnpm verify is not claimed because its audit remains unavailable.

No DB/SQL/hosted/deployment/invitation/payment/credential/grant action occurred; prior three disposable fixture cleanup records remain verified. Existing saved draft, prototype, history and ordinary scoring logic unchanged.

## Operational route to18-player trial — still NO-GO

No essential new owner policy question was found for this bounded contract. Remaining work is implementation/verification, not just fixture permission:

1. Verify the existing simulated-Start SQL candidate in an expressly approved fresh isolated DB (positive record, ACL, races, rollback, revoked/current versus historical proof). It has not run.
2. Implement a PRIVATE simulation-only immutable evidence/artifact producer using this protocol, generic actor-operation receipt/audit binding, per-event/game locks and history-version CAS. Recheck current Start/native source/consent/fixed IDs and actual ordinary-history guard on every fresh write. Its OWN private journal rows must not change ordinary canonical/score/attendance rows, so current ordinary-prescoring predicates remain valid. Bind each artifact/hash/claim to this Start/game; do not accept structurally valid posted models as provenance.
3. Digital own submissions/confirmations require an authenticated own-subject DB boundary (auth.uid/session and exact active roster link/current consent); Director/service callers must never impersonate them. Paper actions require actual current paper_official_identity_is_current_valid/paper_official_is_independent checks under locks, not merely this supplied role array. Preserve nonself and mandatory DD2+2.
4. Test all108 mixed results through the real private producer with an independent expected-results oracle: legal margins, exact retries/lost responses, stale histories, cross-game/event/actor operation collisions, current-role/consent revocation and controlled rollback. Leave ordinary Start/score/qualification/Finance untouched. Every temporary test resource must be removed/absence verified. No new fixture is authorized by this document.
5. Only after backend acceptance, wire existing score-entry presentation to an explicitly labeled rehearsal scope with durable pending/unknown recovery and genuine separate signed-in users; no fabricated play attestations. Judge correction, simulated standings/qualification/playoffs and financial closure require their own reviewed integration. No publication or real-money readiness follows from this contract.

Evidence: test-results/native-mixed-post-start-contract-20261106 logs/manifest/summary.
