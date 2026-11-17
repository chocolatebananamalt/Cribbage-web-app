# V41: Consolation source and paused award recovery

## Completed local behavior

An exact retained regular-prize operation now has a separate optional Recover Exact Award Outcome action. It invokes only the existing historical operation getter and validates the exact accepted receipt plus immutable award record. It cannot call a writer or fall back to save. Normal recording/retry still requires its existing write gate. New recovery capability is literal false in product; only fixtures enable it.

Actual V40 route reproduction returns403 before providers while writes are disabled; candidate returns200 with matching historical proof and zero writers. The body is exactly `{recoverOnly:true,attempt}` under existing medium bounds and same-origin policy. False/extra/foreign bodies cannot bypass save authorization. Normal verified subject, getUser, pinned SID and current primary-Director role are required before and after awaited work.

The optional controller preserves operation/reason/raw bytes. It archives only accepted exact proof through the existing coordinated storage CAS and namespace. Missing/null/error/retry/mismatch/archive failure never permits replacement. Identity change aborts recovery; layout cleanup deactivates/aborts before passive cleanup. Existing callers without a recovery port display no new button. Recovered UI is explicitly historical unpaid evidence, not current Results, payment or absence of prior effects.

## Consolation source integration

Reused the existing actual Consolation fixture carrying its own linked-admission and conserved receipt-allocation proof; no Main-only DTO relabel. Its regular fund is10000minor, whole receipt35000, preserved Main share25000. Actual regular-Consolation final and closure decoders plus the V40 joint Results reader now pass required-approval/open/closed states with zero Main/pool fallback and no mutation. Missing linked identity proof holds, never zero awards. No payout defaults or SQL changes.

## Executed evidence

- Nine new executable groups;29 focused with adjacent source/controller suites;3895 full app tests pass.
- Sixteen Chrome cases at390/1440: actual SelectedStepAwardSection -> controller -> HTTP fixture -> actual API route VM -> actual transport/Consolation decoder. One fictional provider write commits, its HTTP response is lost503, reload disables recording, explicit recovery adds zero writers and archives only exact own request. Null/absent/error/archive failure/closed/foreign/SID cases retain; other local bytes unchanged, no overflow, listener closed.
- Real browser sessionStorage is used through an explicit synthetic storage/coordinator adapter. Auth/RPC/provider persistence are synthetic in-memory state. This is not actual NextSSR, native PostgreSQL, genuine Supabase Auth/PostgREST, mature writer/ACL or hosted acceptance.
- Independent review found a layout-to-passive lifetime window and uncertainty-copy issue; both corrected and tested before final acceptance. Hook tests call retained Recover after layout cleanup and release a held accepted reply before passive cleanup: no lookup/archive or byte loss.
- Initial browser fixture expected ASCII hyphen; actual accessible heading uses em dash. Captured actual accessible-name/visibility evidence established the fixture mismatch; corrected semantic selector, unchanged product heading.
- Aggregate command outcomes, dependency audit, source preimages, cumulative patch and recovery bundle are in adjacent package. Private handoff absent. No publication, hosted data/config/Auth/flag/grant/SQL, practice/session/draft or email action.

## Publication and milestone boundary

Prior cb6da091 push was rejected before process execution as an external commitment lacking specific new-deployment approval; not a test failure. The exact rejection and independently saved remote state are recorded in the support handoff, not freshly rechecked here. No retry. Current candidate needs its own scoped normal review; old SHA approval cannot be silently reused. Destination-specific callback approval and genuine user-controlled sign-in/read/recovery remain separate. New unverified recovery and other rollout gates remain off.
