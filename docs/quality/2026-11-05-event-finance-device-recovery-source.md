# Finance device-draft recovery: source checkpoint

## Scope and boundary

Default-off local proposal recovery connects the strictly scope-bound prepared Finance read contract to the existing Finance UI. It does not implement an operational ledger save, grant access, record a receipt/payment, or publish anything. No SQL, browser storage or database was executed for this source checkpoint. A later approval for disposable local setup/Finance database tests is a separate runtime phase; it does not turn this source proof into storage or provider acceptance.

Source inspection found `database/proposals/event-regular-finance-draft-v1.sql` explicitly binds setup-event VERSION IDs, whereas the new UI uses operational event IDs. The old SQL also stores the earlier plain finance history, not the complete named editor/forms/whole-band override state. No IDs were coerced and no old writer was connected. Native persistence needs a reviewed operational source binding and runtime tests, not renamed request fields.

## Implemented source

- `event-finance-source-contract-v1.ts` decodes the prepared read result against the separate fixed actor/tournament/event scope. The default-off server read contract now preserves its checked actor/tournament/event metadata. Shape decoding does not authenticate a posted object. Provider/atomicity/write/payment flags remain false.
- `event-finance-draft-codec-v1.ts` preserves the exact editor, including explicit zero/false/null, invalid incomplete form typing, source prefixes, names and append-only line/whole-band histories. Stale overrides validate against their OWN saved planning basis/history/input before comparison with the current source. New suffixes cannot change Q/Side/restricted source rows; new applied reasons follow the editor validation. Existing historical prefixes are preserved verbatim. Oversized or malformed records are rejected, never truncated; the 4 MiB bound is technical, not a business category cap.
- `event-finance-draft-session-v1.ts` is a fixed-account, default-inactive device session. It discovers retained bytes before allowing edits, uses exact rendered leases, saves a captured proposal through CAS plus archive plus readback, and labels an older copy if newer edits occurred during the write. Unknown outcomes retain the exact attempt for check/retry. Concurrent-tab conflicts retain memory and stored bytes without merging/overwriting. Deactivation hides financial data, aborts uncommitted transitions and ignores late callbacks; it never deletes old-account bytes. Source loss/recovery does not strand a busy session or replace an existing edited draft.
- `event-finance-draft-retained-v1.ts` is a lazy IndexedDB SOURCE adapter, keyed by actor/tournament/event rather than source revision. Atomic version archives are separate from current drafts. Import/construction does not open storage. No actual IndexedDB API was called in verification.
- `event-finance-recovered-section-v1.tsx` injects the fixed session, hides scope mismatches, separates owner cleanup from normal source refresh and fences all callbacks by owner/snapshot/view. Save Draft on This Device, Check Saved Device Copy and exact retry labels explicitly deny ledger/payment/cross-device-sync authority. The device clock/revision is distinct from the server-source saved timestamp. No default session/storage/route is enabled.

## Verification

Thirteen codec groups and fifteen memory-port session groups passed, including zero override, incomplete typing, history preservation, stale source, readback loss, same-account concurrency, distinct accounts, deactivation, corrupt bytes and source loss/recovery. Eight read-contract groups include the prepared-response-to-local-session binding. SSR/static checks passed for disabled/foreign-account hiding, no effects on server render, lifecycle separation and device-only copy. TypeScript and focused ESLint passed. Independent reviews found no remaining P1/P2 after closing source-loss liveness and first-valid-source initialization gaps.

Full `pnpm verify` exited 0: 1,724 application tests, six provider checks, audit (no known vulnerabilities), lint, production build and eight workspace checks. `pnpm verify:handoff` passed six checks. Logs: `test-results/event-finance-device-recovery-verify.log`, `event-finance-device-recovery-handoff.log`, `event-finance-draft-focused.log` and `event-finance-draft-recovered-ssr.log`.

These are source/model/memory/SSR proofs. The previous Finance browser checkpoint tested the underlying editor; it does NOT prove this new wrapper's mounted lifecycle, real reload recovery or IndexedDB semantics.

## Remaining gates

- Real IndexedDB quota/blocked/upgrade/transaction/abort/concurrent-tab/reload tests and mounted wrapper behavior. Device durability is not yet an accepted live feature.
- Host authenticated scope and global shared-device/sign-in/sign-out ownership integration. Namespace checks prevent accidental mixing but are not encryption or a browser storage authorization boundary against arbitrary same-origin scripts.
- Complete native Finance source assembler and correctly bound operational proposal persistence, actual roles/ACL/transactions, retry/concurrency/rollback and save-to-payout acceptance in a disposable local database. Newly approved local testing remains isolated from staging/production.
- Explicit conflict comparison/archive/export/review UX; no automatic discard/rebase/pruning or expiry policy was invented. If conflict/unknown storage occurs the page and pending work must be kept intact.
- Existing custom ratio/recipient-policy gaps, reviewed final result/payment evidence and financial finalization. Optional funds and historical awards are unchanged.

No production/staging access, publication, invitations or real money occurred. Source archives are not database recovery backups.
