# Mixed rehearsal Results display - private checkpoint

## Observable scope

Connect the existing verified Main-singles rehearsal sources to the ordinary Results location, without turning simulations into ordinary qualification, official results, MRPs, paid awards or real funds. Show names with unchanged Tournament IDs, separate qualifying rank from playoff placement, separate Main prizes from optional pools, and show unavailable information as unknown. Fail closed on source, session, scope or repeated-capture drift. Preserve existing Main/Consolation/Satellite/team results paths and existing permissions. No new payout calculation, SQL, financial write or access grant.

## Implemented

The ordinary `/tournament/[tournamentId]/results?event=...` page has a private `practice=mixed` branch behind a literal-false code gate. The gate, explicit opt-in and existing official-role check precede normal client construction. Standard results remain unchanged. This branch is not advertised or enabled; it needs a reviewed release/navigation decision before use.

The server-only reader uses existing normal-auth APIs. It checks the exact test project, actor, session, issuer, expiry and current official roles; captures twice and requires matching detached observations plus a final identity/role recheck. It does not use the page's existing administrative client as a fallback. Preparation and pool workspace both take the same existing event try-advisory lock, so the reads are deliberately serialized. A targeted delayed-lock regression proves the composition does not race its own read transactions. This preserves database guards and is not an atomic cross-section transaction.

Completed Main finance already includes source-verified playoff completion and its exact frozen qualifying review. The results projection binds that entire review, entry gross and funding digest to the qualifying snapshot; names join participant, roster and fixed Tournament IDs from the current preparation reader. Before completion, the existing qualifying-review resolver supplies only completed practice cards; it never supplies a playoff winner. Missing or mismatched Main sources leave placements and regular prizes unavailable.

The read-only view shows 18 verified practice cards, five qualifying places only when ties are resolved, completed equal finishing groups, reviewed or unreviewed fund status, and actual saved **UNPAID_SIMULATED** group awards. It does not display a calculated estimate as final. Main fund and optional pool funds remain separate. No record is created, changed, paid or finalized.

The new pool projector reuses the existing strict preparation/workspace join and additionally reconciles every policy's aggregate elected/contributor counts against its full Director election list. Unsupported or unconfigured amounts are null; actual recorded zero is different. It projects only saved labels/type/slot and counts/funds, never individual elections, receipts or claims of final awards.

## Exact remaining pool gap

The normal pool getter does not expose final awards. Its existing operation recovery proves only an actor-owned historical receipt, explicitly not current source authority. Therefore this view clearly says **final pool awards unavailable**. It does not treat a historical final ACK, calculation fixture or funding total as proof of current obligations. A dedicated current-final proof/reader is still missing; this is an implementation/verification gap, not a new payout-policy decision.

That reader would need to bind final/seal/policy/election/funding lineage, current funding/setup and untied qualifying review, and exact obligation equality. It must not backdate records or bypass pre-Start/seal guards to manufacture a fixture. No new database was created and no scoring simulation was repeated for this display change.

## Access and unsupported events

The complete source bridge currently depends on existing actual-Director-only Main/preparation readers. A Co-director's unavailable response is not zero, and no administrative fallback broadens access. Existing Co-director standard-results access is retained. Only native Main singles18/five-qualifier results are supported by the combined display. Consolation, Satellite, doubles and custom events are explicitly unsupported in this branch and retain their separate standard paths. No Main prize or qualification rule is reused for them.

## Verification and limitations

- Eight results/reader groups and nine pool-projector groups, plus 21 RPC contract groups: **38 focused groups pass**. Cases cover matching sources, equal finishing groups, no playoff inference from rank, no pending-award zero, fixed-ID/event/funding drift, role/session/default-off rejection, changed repeated reads, disabled-during-read, separate funds, omitted-election detection and same-event read-lock serialization.
- **3,027 application tests** and production build pass before the final narrow read-serialization change. That change and its new regression subsequently pass the focused suite, final TypeScript and scoped lint. No unnecessary full-suite or simulation repeat.
- Actual offline React at phone390/desktop1440, normal/doubled text: 18 rows, stable IDs, unpaid labels, equal 3rd-4th group, separate funds, unknown source removes amounts, keyboard-focusable scroll region, no page clipping and zero network requests. Unit fixture only, not signed-in provider acceptance.
- Initial test construction passed an actor-bearing scope to an exact tid/eid-only Main decoder; tests rejected it. The call sites were corrected rather than weakening the decoder. An old retained preparation witness predates required rounding metadata and correctly failed decoding; it was not relabeled as a current DTO. The temporary unused copied fixture was removed. New tests reuse the existing fictional practice-card fixture and explicitly constructed protocol fixtures; no claim of new actual SQL execution.
- Independent source review passed; Root separately reviewed the pool projector. Full pnpm/audit-chain verification remains unavailable; no denied operation was retried. Real provider/session/real-origin acceptance is still pending.

Evidence: `test-results/native-mixed-event-results-20261109/` (focused/app/build/type/lint logs and browser results/screenshots). No hosted reads/writes, SQL, fresh fixture, grants, public upload, blocked-publication retry or money movement occurred.
