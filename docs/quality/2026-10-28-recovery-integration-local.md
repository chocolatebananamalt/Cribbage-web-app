# App-wide recovery and authentication coordination — local implementation

## Scope and preserved state

This completes the approved LOCAL extension of safe sign-out, app-wide retained writers and existing authentication entry paths. No publication, deployment, migration, hosted storage clearing/sign-out, credential access, real authentication, security-setting change or hosted tournament write occurred. Published branch head remains 569ab9fac4a08f572902c9b64dff5935d928218a. The director session, pending B invitation and funded/negative fixtures were preserved. Local reproductions do not establish the actual cause of the earlier hosted failure. Memory files were not edited.

## Integrated behavior

- Root interaction waits for the exact worker/controller protocol and document shared Web Lock; actor changes immediately hide the previous actor's interactive subtree until reverified. The explicit demo remains separate.

- All 27 inventoried retained-storage modules (33 write calls) use the guarded exact-value writer. Unknown, conflicting and malformed retained records are preserved; unequal replacements reject. Missing owner metadata is never assigned merely from the currently signed-in actor. Async queue, key/capability, deletion and offline-page preparation operations are tracked through their entire promise lifetime and drained before switching.

- A switch inventories every same-origin window, including uncontrolled/legacy windows. Other windows block it even when idle. Under exclusive ownership the inventory and controller are checked again. Navigation has a worker shared-lease bridge with versioned document ACK. Before releasing its own shared lease, the switch additionally requires two task-separated lock snapshots containing exactly its one shared recovery lock and no pending recovery locks. A bounded deadline is failure, never permission to clear. Closed navigation destinations release their obsolete bridge rather than continuing to retry an absent client.

- Cleanup is targeted to this app's IndexedDB, page caches and registered sessionStorage keys, with postconditions. Broad Clear-Site-Data was removed. Blocked IndexedDB deletion stays pending and single-flight; it cannot be cancelled by pretending timeout means failure. Partial cleanup retains exclusive ownership and closed writers. Ordinary sign-out keeps recovery data. Malformed success or unconfirmed cookie/session state never authorizes handoff.

- Password fallback and email-code exchange obtain coordinated preflight/exclusive ownership. The server accumulates candidate Supabase cookies privately and publishes them only for a real returned session matching known recovery ownership. GET callback never exchanges a code; it sends a relative private no-referrer redirect to a browser-local fragment, which is scrubbed and retained only in component memory for explicit POST. Same-account recovery survives. A lost response is reconciled against the exact HttpOnly attempt receipt and verified current subject, without automatically replaying passwords or one-time codes.

- Anonymous public check-in can write only its exact completion key, marked unknown first. Strictly valid expired completion bytes may be removed by compare-before-remove; malformed, active or replaced bytes remain. Subsequent authentication remains blocked on unknown ownership until explicit exclusive safe-clear verifies zero pending work. Both sign-in screens expose that supported flow; no guest form silently clears global ownership.

- Origin checks use the actual validated HTTP Host authority rather than trusting forwarded-host headers. This handles Next's localhost normalization while preserving exact browser Origin/Fetch Metadata rejection. No claim is made that this caused the hosted failure.

## Verification record

The final integrated full gate exited 0 after the navigation-drain correction. Earlier 906/910 passes in historical checkpoint documents are historical only.

Final `pnpm verify`: 925/925 application tests; production audit with no known vulnerabilities; lint zero errors/two warnings (unchanged unused event-control import and existing shared-sign-out effect dependency warning); provider checks, production build and TypeScript passed; workspace 7 pass/1 unavailable private-handoff skip. Log: `test-results/recovery-integration-verify.log`.

Actual localhost auth transport/component suite passes: accepted/rejected/candidate-without-session cookies, owner mismatch with old session preserved, exact-origin rejection before provider, same-owner pending work preserved, unknown legacy work blocks before provider, phone/desktop password sign-in, actual PKCE callback explicit exchange once, response-loss reconciliation with exactly one password POST, actual score retry helper exact replay and unequal overwrite rejection, exclusive writer rejection, and actor-change subtree hiding. Only fictional credentials, fake local provider responses and headless disposable contexts were used. Log: `test-results/recovery-auth-browser-run.log`.

Actual component suite exited 0: phone/desktop repeated clear, other-window block/close/explicit retry, cache failure, injected storage failure after database cleanup, refused owner-cookie deletion, HTTP failure, interrupted HTTP, retained recovery, malformed success, unconfirmed session-state, uncertain retry reconciliation and ordinary recovery-preserving sign-out. Failed/uncertain cases retain the exclusive barrier and do not issue extra sign-out POSTs. Log: `test-results/safe-sign-out-browser-run.log`. The separate low-level production deletion diagnostic passed real IndexedDB blocking/late completion, shared in-flight promise, cache failure and blocked-then-error safe settled retry.

## Supported limits and rollout boundary

Only current Chrome desktop/headless contexts and phone viewport simulations are established here. A real device, other engines, simultaneous hosted users and physical offline devices are not claimed. Actual back navigation used a fresh document in the lifecycle harness; persisted-page event injection proves the synchronous frozen shield and write rejection, not an observed real BFCache restore. Unsupported Web Locks, worker protocol/controller, uncertain ownership/inventory and stale versions stay blocked. All future/rollback workers must retain the navigation locking protocol; an incompatible worker can block availability and must never be used to bypass the barrier.

This is not password saving or autonomous login: nothing retrieves a vault/password-manager secret. Publication requires a separate reviewed decision, including the changed credential data flow: password fallback transiently reaches the app server, then the already configured Supabase Auth service. Passwords and codes are not stored or logged. Passwords never enter a URL; the original callback code moves only into a browser-local fragment that is scrubbed before explicit exchange. There is no database migration or new role/credential grant. A hosted retry requires separate approval, exact deployment/staging isolation, no uncertain pending data, and all other same-origin app windows closed. Preserve/reconcile the current director/B invitation before any such handoff.

## Investigation corrections

The callback browser fixture initially reexported Next route configuration in a form Next cannot statically analyze; a literal local config fixed that fixture. The component fixture initially matched a development-tools alert; restricting assertions to the real component fixed the early-wait error. Neither result was a hosted application diagnosis. The production navigation bridge also had a genuine readiness gap: a document could acquire shared ownership before its own worker bridge released. The two-snapshot drain fence fixed immediate exclusive acquisition in actual auth/writer/component tests; timeout remains fail-closed. No permission failure was bypassed and no security setting was changed.


## Final independent review

Independent app/auth review found no remaining P1/P2 findings after validating strict sign-out success plus current session confirmation and the guest safe-clear path. Independent coordinator/worker review also found no remaining defect. Its final actual Chrome suite exited 0 after adding immediate post-navigation exclusive acquisition, closed unready-client bridge release (under six seconds), extra held shared lease and queued exclusive lease. Both contention cases reached the 12-second failure deadline, retained ownership/pending state and blocked writes. All prior legacy/full-timeout, late-navigation second inventory, full async drain, partial cleanup, controller replacement, worker-process termination and frozen-page cases remained green. Focused syntax/lint/diff checks passed. Disposable test port 3241 was confirmed clean. No forced timeout became success.

React review: stateful authentication/switch actions remain in event handlers with a synchronous shared gate; actor-bound render checks precede interactive children; transient code/password values are not durable state; controls have explicit labels/status/error text. The existing effect dependency warning captures only stable storage operations and was reviewed rather than suppressed. Physical screen-reader/accessibility audit is not claimed.

Readiness: coherent LOCAL patch is reviewable for a separately authorized app-only staging Preview rollout. No database migration is required. No hosted retry or publication has occurred. Remaining acceptance gaps are hosted end-to-end behavior, actual BFCache restore, other browser engines and process-crash timing; unsupported/uncertain cases fail closed. Staging funded rehearsal remains paused at its existing B acceptance handoff.
