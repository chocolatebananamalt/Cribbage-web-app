Current status: the exact candidate now has broader local-fixture runtime proof, with cleanup verified. It remains uninstalled on hosted systems; minimum-51 and real-provider acceptance remain open. See the dated update below and the resolver runtime report.

# Read-only mixed qualification / Finance provider: local source candidate

The separate two-argument resolver is implemented and REVOKED. It has not been
installed or executed. The unchanged review getter already has earlier actual
local SQL proof; that proof does not establish this new wrapper's runtime.
Root owns normal Director intake/API composition and integrated verification.

## Contract and source inventory

`public.get_native_mixed_qualification_review_provider_v1(p_tournament_id uuid,
p_event_id uuid)` returns exactly:

```
{kind:'native-mixed-review-provider-v1',actorId,sessionId,tournamentId,eventId,
 review:<native-mixed-qualification-finance-review-v1>}
```

All unavailable, blocked, busy or denied outcomes return SQL NULL. No fabricated
zero, empty cards or partial receipt is returned. Actor/session come from the
normal signed own-subject JWT; no service identity or caller-supplied Start ID.
Current Director/co-director role is SHARE-locked. Read-only bounded pilot
permission is checked before and after proof. The event-unique immutable Start
is SHARE-locked, and review tournament/event/Start/source digest must match it.
The existing getter proves current root, all108 complete histories and current
sealed funding. A server integration must decode the envelope and unchanged
review DTO, perform normal cookie identity/role checks before/after, recapture
the same RPC and require identical full review digests before returning data.

Minimum additional SQL over the frozen51 package is exactly three new functions:

1. Existing `database/proposals/native-mixed-qualification-review-v1.sql`:
   `app.native_mixed_qualification_review_enabled_v1()` (false) and
   `app.native_mixed_qualification_review_v1(uuid,uuid,uuid)`.
2. New `database/proposals/native-mixed-qualification-review-provider-v1.sql`:
   `public.get_native_mixed_qualification_review_provider_v1(uuid,uuid)`.

Install order is frozen51, unchanged review source, separate wrapper. No new
table, existing-function replacement, data mutation, Finance accounting bridge,
Director lease/preparation reader, draw reservation or bootstrap-status reader
is needed for this completed-data read. Existing service-only started-source
API requires known Start/original actor and is unsuitable as normal intake.
The omitted bootstrap-status reader exposes only a started boolean, not Start ID.

Direct predecessor functions already in frozen51: game_own_subject,
game_root_current, game_complete_with_start, funding_seal_source,
simulation_hash and pilot_permitted (all `app.native_mixed_*_v1`). Direct tables
are tournament_roles, native_mixed_simulation_starts_v1,
native_mixed_game_evidence_v1, native_mixed_game_artifacts_v1,
paper_official_identity_bindings, native_mixed_attendance_seals_v1 and
native_mixed_attendance_scopes_v1. Their transitive locks/proofs remain intact.

## Exact byte continuity

| Artifact | SHA256 |
|---|---|
| Frozen release migration `database/release-packages/native-preparation51/supabase/migrations/20261107090229_native_preparation51_closed_install.sql` | `22f9145694802d79d13d50ab36d52e8dc030b1f86649b9cb8a5f2fe733187f58` |
| Earlier atomic51 closed-install body | `41000e612ade0fc36a6374bf6806f0ac13821fe0d18d9e1c2fc48660fbb6ce88` |
| Unchanged private review SQL | `ee216fee4313839e99b0176aa5be78bdd3eb163d6540805f3a43d4a0939b7459` |
| Unchanged TS review decoder | `d5ece2b7cab074446e905f2d9e2187b16bd0e95457a362b442f0e371243a041b` |
| New provider SQL | `b1896f8050060c22841fd24394185726abadf3c62879d3832abac8ffb38e0961` |

All51 source hashes in
`test-results/native-mixed-bootstrap-atomic51-20261107/closed-install-manifest.json`
match current files. `catalog-comparison.json` records781 predecessors +379
new functions, two reviewed activation body changes and preserved old owner/ACL.
The later installed release receipt is
`test-results/native-preparation51-staging-install-20261107.json`:293 migrations,
1160 functions,252 prior data tables preserved,370 table metadata equivalents,
118 new RLS tables, deployment/pilot/funding/attendance scope counts0 and RPCs
closed. This assessment reads local receipts only, not current hosted state.
The published preparation preview is recorded READY at
`3c3d6533f4ad384a0ba84064b6849e389e91b77e`; it does not contain this addition.

## Release and recovery gates

The getter, wrapper and server intake remain disabled/revoked. For a later
approved read-only cohort, only this public wrapper would need authenticated
EXECUTE. No anon/public/service-role grant, table grant or private-function
grant is needed. No future writer needs exposure. Pilot deployment marker,
named actor/event scope, expiry and `writes_enabled=false` remain explicit
authorization gates; this source creates none.

Available proof requires the existing shared Start, publication, attendance
and funding flags, plus the new private review flag. Those shared flags also
gate writers. Merely calling the new slice read-only does not make those
predicates read-only: exact writer ACLs and default-disabled server transports
must remain closed and be independently verified. Game write/recovery,
ordinary qualification/finalization, optional pools and payouts need no enablement.
Completed18-player mixed simulation evidence must already exist and remain
current. Preparation preview alone is not completed evidence.

Before any future release: independently review this source, execute the exact
three-function addition on the approved disposable restored baseline, test
Director/co-director success and player/cross-checker/service/foreign-session/
wrong-scope denial, expiry/revocation/held-lock/source drift and two-capture
agreement. Compare all prior definitions/owners/ACLs, table metadata/data,
ordinary scoring/qualification/Finance records and migration history; assert no
new records from reads. Prove atomic rollback and closed ACLs. Fresh target
drift review and verified current recovery/restore evidence remain necessary
before separately approved hosted installation/flag/grant/publication actions.
Do not overwrite the frozen51 artifact or repair prior ledger rows. Disabling
the intake/revoking the new wrapper is the reversible exposure stop; existing
history must be preserved. No recovery point was captured in this task.

## Checks and limits

Focused command:
`node --conditions=react-server --experimental-strip-types --test tests/native-mixed-qualification-review-v1.test.mjs tests/native-mixed-qualification-review-provider-v1.test.mjs`.
Result: exit0,26/26 PASS, including all51 source hash comparisons. These are
source/decoder checks only; runtime, authenticated provider, browser, integration
build and complete repository verification belong to the lead's next gates.
No SQL/DB fixture, hosted request, grant, cohort change, publication or payment
was performed. Costs/net/awards remain null; simulated gross is not received
money, and this reader does not authorize ordinary qualification or Finance.

## 2026-11-08 Local runtime status update

The exact resolver candidate SHA256 above now has broader disposable-fixture runtime proof: completed 18/108 data, actual PostgreSQL-role authorization, 16 resolver groups, atomic rollback and preservation; restored 39-head partial data returns unavailable; gates/ACLs closed by readback; all owned containers removed. It remains uninstalled on hosted systems and revoked/default-disabled in source. This does not establish minimum-51 runtime compatibility, actual signed-in provider/device acceptance or funding-drift handling. See `2026-11-08-native-mixed-resolver-runtime.md` for limits and failed test-harness attempts retained as evidence.

## Later local verification: minimum51 and supported drift now pass

The exact frozen51 schema plus only the three review functions now passes local populated-fictional compatibility, unchanged source/review digests and the supported expense-drift/rollback test. This supersedes those two remaining-local-gate entries above; real provider/device and hosted release gates remain. See `2026-11-08-native-mixed-minimum51-and-funding-drift.md` for the exact scope, construction limitations, diagnostic permission correction and cleanup. No hosted system was changed.
