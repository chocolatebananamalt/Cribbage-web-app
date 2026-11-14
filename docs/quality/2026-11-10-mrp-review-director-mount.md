# Director-page membership review integration — 2026-11-10

## Mount and authority

Mounted the local Membership Evidence Review on **Event Participants**, after the existing enrollment controls, using that page's already-authorized `EventRosterEnrollmentWorkspace`. No additional workspace query or new admin client was added. The mount requires the existing literal-false manual-review route gate AND the page's Director role. Co-director access to ordinary enrollment is unchanged; it does not expose this feature. All routes remain off. Actual primary-director authorization remains in the unchanged SQL helper/reader/writer, not a client role label.

The new browser provider checks the configured public project URL before creating the normal browser client; validates getUser + claims subject/session/expiry and normal get_tournament_role; and pins the first verified session. Auth events, focus, pagehide, expiry and errors synchronously conceal/inert the region. Revisioned auth state guarantees a committed owner check before reopening, including coalesced same-session refreshes. A different actor/SID never silently rebinds the existing pending operation. Each actual API call still rechecks identity and SQL primary-director access.

## Selection and recovery

Event choices are Main/Consolation Standard Singles; player choices come only from that event's enrolled roster IDs. Duplicate names display immutable Tournament IDs, or an explicit Roster Entry ID when no Tournament ID exists; ACC numbers are never used as Tournament IDs. No membership/admission rule is inferred from attendance or missing ACC data.

The form synchronously publishes pending status before dispatch, locking event/player selectors even for held pre-commit handlers. Runtime identity is stable across equivalent roster refreshes. Name/ID/enrollment changes close authoring without unmounting the pending form. Cached evidence fields and write retries are hidden under drift; only exact historical reconciliation can remain available under the same verified account/session/project. Transport has a separate read-only recovery admission; current-source admission is still required for fresh reads/writes. Accepted historical receipts never authorize a new head or eligibility. Confirmed rejection acknowledgement is exact-pending leased. No-receipt/unknown outcomes remain held rather than silently cleared, including permanent source drift; no administrative resolution for that case is claimed.

Review Pending/no awards/no grace-period or effective-date inference remain unchanged. All journal writes are evidence-only, no MRP, registration or game-result changes.

## Verification

27 focused handler/decoder/transport tests pass, including the new source-drift recovery-only transport case. Existing form offline browser checks at390/1440 pass after integration. New actual provider+form browser checks at390/1440 use fictional auth module and fetch responses, no network: default-off creates no client; correct event/enrollment scope; duplicate names by fixed ID; pending lock before write and after held callback; synchronous masking; coalesced held auth/focus refresh recovery; role/new-SID holds; changed roster label hides fields/retry but exact historical503/accepted checks work; original request/op/SID remain unchanged; selectors unlock after known accepted receipt; auth subscription cleanup. Fake UUID factory substitutes only the secure-context UUID API unavailable on about:blank; this is not proof of real-device crypto/auth. Contexts close and requests remain0.

Evidence: `test-results/mrp-review-mount-tests-20261110.log`, `test-results/mrp-review-mount-20261110/result.json`, screenshots, manifest, types/lint logs. Independent source review found and verified fixes for synchronous concealment, pre-commit pending locking and recovery admission. Final source review GO, no narrow P1/P2. Earlier harness/source failures were reconciled before passing final checks.

## Limits

Source is mounted behind an OFF gate, not activated or deployed. Browser identity/role checks used fictional SDK responses; live provider, current primary-director ACL, real account/session transitions and device acceptance remain release gates. Server SQL remains exact SHA f16fd5453c691d866b821c41310aab52fdc4404cf22c2c867edfbbf32a0fd4e7 with prior isolated runtime evidence reused; no new database test/update was needed.

Pending is retained only within the mounted page, including temporary admission/source loss. Full reload, navigation, explicit scope/project remount or component disable can lose the browser request copy; no durable recovery claim or new browser persistence. A new SID is held, not automatically transferred; do not call this cross-session recovery. Existing server journal/receipts remain immutable. No hosted reads/writes, grants, access activation, publication/retry, new fixture, external source query or real money. Full pnpm verify unavailable; denied audit/browser-origin access was not retried or bypassed.
Final phone visual review found the name-first option could truncate its disambiguating ID. Changed options to Tournament ID first (or explicit roster ID first) and reran actual provider checks390/1440 successfully; final pending/known-receipt screenshot inspected. No assertion of hosted SQL availability; future installation/access and real-provider acceptance are still required.

