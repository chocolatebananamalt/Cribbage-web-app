# Compatibility revision — local design, no rollout

Current implementation evidence is in `2026-10-27-versioned-settlement-v5-local.md`. Expanded approval permitted the canonical shared boundary, tagged settlement storage, replay compatibility and local testing. Earlier unimplemented statements below describe the prior checkpoint. Blanket revocation remains withdrawn; no shared deployment occurred.

The initial 0240 proposal is **not a rollout candidate**. Its database-wide revocations and application-wide read-only settlement screens remove existing functionality without a complete replacement. The isolated validation proves that proposal's behavior, not that the behavior is an acceptable product release. No registration, application, publication or hosted change is authorized here.

## Exact affected writers

All are service-only RPCs. The proposal revokes these existing grants:

| Writer | Current caller / responsibility | Compatibility impact |
| --- | --- | --- |
| `record_standard_singles_playoff_placements_v1(uuid,uuid,uuid,uuid,integer,jsonb,uuid)` | Historical service entry; writes immutable unique placement versions, partial lists permitted | Older clients lose placement entry |
| `record_standard_singles_playoff_placements_v2(uuid,uuid,uuid,uuid,integer,jsonb,uuid)` | `src/lib/api/playoff-placement.ts`; complete qualifier list plus ambiguous `mrpPlayoffExitRound` | All current Standard Singles playoff entry loses its writer, including brackets beyond four qualifiers |
| `save_standard_singles_settlement_draft_v1(uuid,uuid,uuid,uuid,integer,jsonb,jsonb,uuid)` | Historical draft entry | Older manual draft workflow disabled |
| `save_standard_singles_settlement_draft_v2(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,uuid)` | Internal call from v3; adds immutable playoff-version binding | Breaks v3/v4 call chain, not merely obsolete public entry |
| `save_standard_singles_settlement_draft_v3(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,uuid)` | Internal call from v4; adds manual MRP claims | Breaks v4 settlement chain |
| `save_standard_singles_settlement_draft_v4(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,uuid)` | `src/lib/api/settlement-draft.ts`; validates automatic MRP claims then delegates v3→v2 | Current settlement draft entry disabled |
| `finalize_standard_singles_settlement_manual_v1(...)` | `src/lib/api/settlement-finalization.ts`; explicit director attestation, version/ledger/dispute/closure checks | Current manual finalization disabled |

These concern Standard Singles post-event workflows; this is not evidence that Doubles or satellite events were previously supported by these writers. Automatic MRP supports Main game counts 12/14/16/18/20/21/22 and Consolation 7/8/9/10/12. The proposed v3 replacement covers only Main, 12 games, exactly four qualifiers and no byes. Main/Consolation legacy MRP computation and general settlement therefore cannot be shut down as a side effect of that narrow feature.

The security motivation was real: v2 stores an ambiguous exit-round integer; its automatic calculator treats it as an MRP credit index, undercrediting a champion entered with the actual final round. Older v1–v3 settlement entry points can also bypass v4's automatic-claim equality check. However, global revocation is not a backward-compatible repair. Immutable historical rows/receipts must not be rewritten or reinterpreted as newly witnessed outcomes.

## Smallest safe separation

1. Restore the normal legacy API/UI workflow locally; keep the experimental v3 page separate from normal settlement navigation. Do not publish the current broad freeze.
2. Replace global revocations with atomic **event-scoped write-domain exclusion**: old placement inserts and new v3 writes must share the event lock and reject the opposite domain. A database guard must protect old clients as well as the new API. A request drain remains prudent, but a drain alone is not a permanent invariant.
3. Correct the legacy MRP boundary independently. Do not simply reinterpret every historical exit-round integer or trust unique third/fourth placement as ACC elimination evidence. Validate explicit elimination/win/bye evidence under a versioned contract; derive credit and claims on the server. Reject only the specific ambiguous or inconsistent new claim with an explanation and supported correction path. Old exact receipts/history remain readable/reconcilable.
4. Enforce the canonical claim invariant at the shared persistence/finalization boundary, not only the v4 endpoint. Otherwise old service entry points can bypass it. Preserve legitimate non-MRP accounting draft work where it does not attest an unsupported claim; do not fabricate complete MRPs or allow financial finalization to attest incomplete evidence.
5. Provide a v3 settlement binding/reader/writer replacement before enabling v3 adoption in a released deployment. This must preserve ledger snapshots, audit, replay and manual financial attestations without inventing payout policy. Merely adding a four-player result while leaving its settlement dead-ended is not release-ready.

The event-scoped guard and broader canonical legacy evidence contract require independent design review before changing the SQL proposal. Existing tests must be revised to assert preservation of legitimate legacy permissions/workflows, not the rejected blanket shutdown. No safe-release recommendation is made until both claim integrity and compatibility evidence pass.

Local implementation checkpoint: normal legacy routes, settlement page and editors are restored. The experimental v3 page remains standalone, unlinked from normal settlement. Legacy placement retry recovery retains malformed requests, prevents in-flight duplicates and compares the exact retained envelope before clearing it. A separate, unexecuted symmetric database trigger proposal is in `2026-10-27-proposed-event-playoff-domain-guard.sql`; it acquires the shared event advisory lock and rejects only an opposite-domain insert in the same event. It revokes no legacy grants. This is not a migration and must not be combined with the withdrawn global-revocation tail.

Independent design review confirmed that champion-depth plus exact loser cohorts can validate a complete power-of-two no-bye bracket. Bye brackets need participant-specific immutable bye/series evidence; aggregate counts cannot prove who earned the bye credit. The shared canonical validator and v3 settlement binding remain unimplemented. Consequently the legacy MRP defect remains diagnosed but unresolved, and neither the new guard nor restored UI is a release candidate. Restoring the original workflows avoids introducing the blanket regression; it does not certify their existing MRP semantics.

Guard review found no supported-path lock-order or authorization widening issue. Added an explicit preflight refusing any event already containing both domains. A further prerequisite remains: existing writers must map cross-domain conflicts into structured rejection receipts; a trigger exception alone is a safe storage backstop but produces an unhelpful generic request error. This unexecuted proposal is not a complete migration or caller contract. Restored UI copy must warn that legacy MRP arithmetic is under review and distinguish its unique recorded order from ACC elimination cohorts.

## Decisions and gates

No new payout or semifinal-ranking product decision is needed to remove the blanket freeze: source-backed MRP semantics remain rounds won, awarded byes and same-round elimination cohorts; optional trophy/prize ordering remains separate. A broader bracket evidence contract is engineering work, not authority to invent played matches or payment records. If a legacy result lacks sufficient evidence, the UI must identify that specific record and request a supervised correction, rather than silently changing its history or globally disabling other events.

Build/browser blockers remain the previously observed generated-directory EPERM and controller localhost timeout. No permission change or alternate route around a denied action is authorized. Hosted director session, production and published head remain untouched.

## Verification checkpoint

Compatibility application run: **819 tests, 818 passed, 1 failed**. The sole failure remains the strict RPC-to-registered-migration check for the three experimental v3 RPCs; it is preserved. Focused restored legacy/v3 checks passed 20/20 in the worker run and 19/19 in the lead run; the final warning-copy/guard checks passed 6/6. TypeScript and changed-file ESLint passed. Diff whitespace checks passed after removing generated trailing blank lines. No SQL execution is claimed for the new event-domain guard; prior isolated tests exercised the now-withdrawn revocation design only.

The restored editor now warns that legacy MRP calculation and champion playoff credit are under review and cannot serve as final MRP/ACC attestation. Its unique third-and-later order is labeled legacy recorded place, rather than an ACC elimination distinction. Pending-receipt reconciliation preserves a newer retained request without resetting editable fields; malformed or conflicting stored requests block overwrite. These are local compatibility/recovery fixes, not a substitute for the still-required canonical server validator.

No additional owner policy decision is required at this point. The next bounded engineering work is an explicit typed bracket/evidence contract plus one canonical server validator used by automatic display, every settlement entry point and finalization, followed by a direct v3 settlement binding. Until those replacements and compatibility tests exist, no registration, staging rollout or publication is recommended.
