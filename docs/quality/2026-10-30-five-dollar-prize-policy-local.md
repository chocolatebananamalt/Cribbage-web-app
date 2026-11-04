# Standing $5 prize policy — local implementation evidence

Status: Local implementation and requested compatibility checks verified; hosted rollout and production gates remain open. Published release72c1c657 and all hosted fixtures remain unchanged. No hosted query, migration, payment, browser control or publication occurred in this local pass.

## Verified local Side Pool milestone — 2026-10-30

The versioned graduated Side Pool path now freezes the disclosed formula before collection, derives exact rank amounts from fully paid entrants, records an unpaid amount review bound to source versions, and keeps existing fixed policy/history separate. It does not choose beneficiaries or record disbursements. Recorded receipt amounts cannot decrease without a separately supported resolution. The writer uses the same tournament/role/event-start lock order as start play. Recovery is actor-scoped, coordinator-protected, exact-request reconciled and fail-closed on changed bytes/removal failures.

Evidence: `pnpm verify` passed 1,086 application tests, security audit, lint, provider checks, production build and eight workspace checks. Isolated SQL Side acceptance passed 18 groups with two independently observed different-actor start/election orderings, prepayment disclosure, partial/full funding, refund-resolution rejection, source/replay/roles, preserved legacy history and zero disbursements. Its disposable database/container were removed. Headless phone/desktop Side browser checks passed, including recovery failure and actor mismatch. Q v4 headless browser checks passed on both sizes. Prior real SQL v6/v7 history/rejection/reconciliation and Q/no-Q v8 accounting checks passed; v5 historical-cent replay and new rejected draft/final reconciliation passed against an actual disposable database. Independent read-only high-risk review found no remaining P1/P2 in the corrected Side Pool code and narrow legacy Side 409 mapping. It confirmed actor-bound recovery, current source/version checks, lock order and non-disbursement; review did not independently execute runtime tests. Legacy satellite/team controlled rejection and historical replay passed actual disposable SQL; independent route review found no P1/P2. Physical two-person/offline rehearsal, hosted restore and production launch remain separate gates.

Current unpublished local migration bytes/SHA256:
- 0256: 9,140; 41C544ED3FAE8585EC443A92FE33CFE01BA117B965B8ED206D3AA9811901399E
- 0257: 41,076; 9C0EA761522D74822F1A41E027605716FF106AD362BCD32C094E40CD1500813C
- 0258: 4,363; 822626BBC99785C18DD19D7B5718800A9A779F5D99794A739CA988C9F2A387E4
- 0259: 10,455; CB1C9D439D5E65D17188DE6F07D16F78295F4386CBD4A444CC82B653EF40C2AA
- 0260: 9,169; B4A5128F903F88B9FEF23D89A94B437CFAED3B2B2EC586FF942E9B9000362DD7
- 0261: 27,283; DDD0C25C1B6A58DBF82228A881D921352E66B5A781CE47900C921D65D9419C8E
- 0262: 2,834; C1103FD7FF76E94A39EC536F864266ECA80A68967840FA1FDDA02783D82E8F5D

No migration above was applied to staging or production. The 0261 hash is recorded independently in the test output; if this note and the file differ, the file hash is authoritative and rollout must stop for review.

## Verified legacy compatibility and team replacement correction

A genuine synthetic v5 historical cent draft was accepted before the new guard using supported receipt/expense/settlement RPCs; a preguard final succeeded only inside a rolled-back transaction. After guards, the exact accepted replay stayed unchanged, while new cent draft and final requests produced durable rejected receipts and exact reconciliation. Real satellite historical replay and rejected new cent save rolled back without altering history. A historical team replacement replay remained intact, a new replacement copying a cent award was rejected without changes, and a separate ordinary $5 team replacement succeeded. These are fictional database fixtures, not real payments. PostgreSQL 17.11 used an isolated container with no network, ports, mounts or privilege; database and exact container removal were verified.

The team test uncovered an existing transfer writer that attempted to insert generated scorer status. Additive local migration 0263 removes that attempted column/value and lets the database derive the status; independent source review passed. It is 770 bytes, SHA256 5DBC8A283F178F6602C9394B706DD6B1AF8761C0935CBCA86403821765439DB9. It was applied locally before historical fixture capture, followed by 0260–0262. No existing hosted record or permission was changed. `pnpm verify` after these changes passed 1,091 application tests plus audit, lint, provider checks, build and eight workspace checks.

## Final local compatibility verification

A separate clean isolated PostgreSQL run applied 0256–0263 in numerical order and passed the Q and no-Q accounting lifecycles, with exact database/container cleanup. Satellite phone and desktop browser checks passed exact 409 rejection, unchanged historical $5.01 display, generic unavailable handling, accepted response, no overflow or page errors. Initial mock success had a hyphen in place of the codec-required em dash; correcting this fictional fixture resolved the failure without a product change. The UI test used intercepted fictional API responses; real accepted historical replay and rollback are separately proven by SQL. Independent satellite/team review found no P1/P2.

## Accepted rule

Every new prize award is a $5 multiple. For regular awards, round the base-entry prize budget down if verified eligible benefits plus that target meet the exact required return; otherwise round up. Preserve equal same-round awards. Select the allocation automatically using exact weighted-share deviation, then higher-place lexicographic priority when objectives tie. Keep each pool separate. A positive adjustment requires recorded funding evidence before unpaid finalization; a negative adjustment remains an explicit restricted event balance. No receipt, donor, transfer or expense is fabricated.

For $510 gross, $229.50 expenses and $153 benefits, the original $280.50 target becomes $285; $4.50 additional funding is required. Weights4:3:2:2:1 yield $95/$75/$45/$45/$25, conserving $285 and equal semifinal awards. With sufficient benefits the same original budget may round down to $280, retaining $0.50 separately.

## Implemented, under verification

- Versioned regular math and private SQL helper0256, bounded through $100,000 rounded target.
- New regular declaration, setup estimate and v8 accounting route; historical schedules remain intact.
- Additive0257 private append-only drafts, funding/correction history and unpaid finals. Exact core/funding versions, current director authorization, operation replay/reconciliation, conservation and cross-check gates.
- Shared amount-only graduated kernel0258 uses observed ACC weights plus app-owned exact conserving $5 largest remainder. No recipient selection or transfer occurs in this kernel.
- New Q policy0259 integration is in progress; old policies and accepted reviews must remain unchanged.

## Checks actually completed so far

-19 focused math/API/recovery groups passed; six setup/percentage groups passed after updated policy wording.
- TypeScript passed on the then-current integration.
- Full application run:1068/1069 passed; the one failure was an obsolete static assertion demanding the old penny-rounding setup literal. That test was updated and its focused suite passed. Final full rerun pending subsequent edits.
- Real isolated PostgreSQL applied0256–0258; all180 regular TS/SQL cases and1789 graduated cases passed, including1536 historical numerical-domain comparisons. Helpers are private immutable invoker functions with empty search paths.
- The local synthetic Q fixture completed102 verified qualifying matches and five-qualifier playoff evidence. Draft, funding shortfall, partial/full receipts and positive-amount void/replacement checks reached the stale-source phase; a test SQL missing-space error was repaired. Terminal lifecycle pass is not yet claimed.
- Temporary containers from failed runs were removed with exact-ID absence checks; current run remains owned by its runner.

## Remaining gates

Complete Q/no-Q funding and finalization SQL workflows, conflicting/repeated requests and post-final corrections; independent security review; phone/desktop isolated headless acceptance; final full verification; exact migration hashes and security manifest; verified private source snapshot refresh. Operational Side Pool formula integration is a distinct remaining seam: existing payout RPCs record disbursements and must never be called automatically by an amount preview. Equal-Q cases that cannot maintain both equality and the $5 lattice must block rather than manufacture a policy.

No current implementation result is evidence of production readiness or a physical paper/camera/offline rehearsal.
