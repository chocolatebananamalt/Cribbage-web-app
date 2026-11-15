# Reviewed draw native publication preflight — local checkpoint

Scope: parent authorized local non-fixture work toward native random seating publication, director authorization/recovery design and stale-roster/immutable-ID safeguards. Explicitly no fresh local or hosted database fixture, denied retry, hosted record, migration application, publication or invitation.

## Completed implementation
- src/lib/seating/reviewed-draw-publication.ts: pure, side-effect-free compiler from validated current roster workspace + immutable plan/draw + native seating workspace + explicit review to an unchanged native seating request preview and bound proposed envelope. It never establishes authorization, records an actual physical review, alters IDs, draws again, calls an API or publishes. Return prepared-not-authorized with explicit false write/schedule/distribution flags.
- src/lib/seating/reviewed-draw-recovery.ts: strict actor/tournament envelope reader and exact-byte remover. Malformed nested objects, wrong owner/scope and changed bytes are preserved; no storage writer or API client.
- tests/reviewed-draw-publication.test.mjs: seven tests using pure in-memory calculation inputs, no operational database fixture.
- docs/decisions/2026-11-04-reviewed-draw-native-publication-design.md: concrete intended authenticated atomic seam, source/receipt/assignment postconditions, lock hazards and exact verification approval boundary.

## Observable focused acceptance
Unmodified candidate IDs map exactly to rosterEntryId/tableSeat without renumbering. Existing publication yields fixed_ids_readonly; A18 is the only native-supported geometry. A valid Z18 candidate is rejected rather than padded or renamed. Source hash, immutable source snapshot, latest plan revision/config, native check-in/mode and registration drift all block preparation. Full 12-round independent movement projection is required. No physical/ACC correctness or authenticated authority is claimed by this pure preflight.

Review must be explicit, complete and reasoned, but client-supplied booleans are never authoritative evidence. The entire draw is retained for the future database equality check. Candidate publishable:false remains unchanged. Reason/UUID/version/attempt/slot/round/anchor/assignment/match validation is strict, with full movement validation for retained requests. Input data is not mutated.

Independent review found one P2: an initially shallow recovery codec could type nested null/invalid arrays as pending. It was corrected and a rejection regression added; malformed bytes remain blocked and unchanged. Initial stale-source test shared mutable source/config objects with its historical plan and was corrected to use independent immutable snapshots; no product guard was weakened.

## Critical runtime blockers
The executable authenticated transaction, RPC/route/UI action and migration are intentionally NOT implemented/enabled. Existing native publisher and random candidate code remain unchanged. Runtime concurrency cannot be verified without the currently forbidden fresh local database fixture.

0047 native seating locks actor/op then tournament FOR UPDATE. 0205 lifecycle starts with roster FOR UPDATE and can race source binding; naive reverse locking can deadlock through FK key-share. 0204 public contact locks tournament before the global actor/op nonce lock, which also requires cross-operation collision testing. A staged NO KEY UPDATE / roster FOR SHARE / tournament upgrade protocol is proposed for review, not claimed proven. No executable SQL was issued to test or bypass these hazards.

Required next permission is for ONE disposable LOCAL PostgreSQL verification database with 18 anonymous entries/test role identities, existing migrations/local proposals, concurrent source/role/manual publication/redraw/retry/nonce/rollback tests and verified deletion. No staging, production, credentials, invitations, money or deployment. That permission remains pending; owner is not being asked overnight. The previous denied fresh-fixture operation remains unexecuted and was not retried.

No UI changed, so this checkpoint has no new browser claim. Prior 27-group mixed-player UI and other verified backups remain separate and unchanged. No provider, database, human room, schedule publication/distribution, money or whole-weekend readiness claim.

## Final checks
Full verification and final source review results are appended only after completion.

Final pnpm verify and pnpm verify:handoff exited 0 (session42100): 1,344 application tests,6provider,8workspace,6handoff; build/lint/audit passed. Independent reviewer independently ran7/7focusedtests and cleared remainingP1/P2 after codec correction. No database verification was attempted. Final logs in test-results/reviewed-draw-preflight-verify-final.log and reviewed-draw-preflight-handoff-final.log.
