# Offline recovery startup: local verified repair

Status: locally verified, unpublished. No migration, hosted data change or user score entry.

## Observed failure and cause

During the single-operator two-device replacement rehearsal, both devices showed Offline Ready. B's phone was placed in airplane mode with Wi-Fi off and Game 3 was reloaded. The phone displayed Tournament recovery safety / Recovery safety could not be established. Reconnecting restored score entry; no Game 3 score was entered. This is a failed physical offline reload, not an offline acceptance pass. The phone's diagnostic stage was not directly observed.

The recovery coordinator registered the worker and unconditionally awaited registration.update on every new document. A genuine unavailable origin makes that update reject before local protocol/lock/owner establishment. Offline Ready only recorded successful online caching and did not guarantee that later network-dependent startup could finish. A fresh local Chrome probe confirmed the gap: context.setOffline(true) still allowed the service-worker update, while actually stopping the local origin caused TypeError with an activated controller still present. The earlier browser test therefore did not represent physical network loss for this startup operation.

## Narrow repair and safeguards

Only TypeError from worker registration or update can use the fallback. The controller must have existed before the attempt, remain activated, have the exact same-origin /offline-score-sw.js URL, and remain the identical controller object before and after a fresh v2 protocol probe. The probed object must equal that captured worker. Missing, replaced, wrong-path or incompatible workers and non-network exceptions remain rejected.

Normal document shared-lock acquisition, fresh protocol verification, pending recovery storage inspection, ownership checks, controller-change protection and safe account-switch barriers remain unchanged. No queue deletion, identity reassignment, score submission, confirmation or promotion to authoritative status is introduced. The previously verified unpublished score-confirmation refresh patch is preserved separately in the working tree.

## Executed evidence

- pnpm verify passed: production dependency audit clean; lint no errors; 1,160 app tests; providers; production build; eight workspace checks.
- pnpm verify:handoff passed: six checks.
- Focused diagnostic/coordinator/safe-switch tests: thirteen passed.
- Full connectivity browser run: 23 groups passed, comprising the existing eleven connectivity cases plus twelve actual origin-down cases. Phone/desktop production-built component and actual service worker were used.
- Final strengthened origin-down-only run: twelve passed with the task-owned origin stopped, Node fetch rejection asserted, and all mocked API transports aborted after stop. Cases cover both navigator.onLine true and false; pending and no-queue pages; register-network fallback; missing/wrong/changed controllers; protocol failure; SecurityError; lock failure; ownership mismatch. Pending queue record bytes and existing local/session data are retained; blocked pages expose no scoring controls and no local verified result is invented.
- Existing recovery-auth browser suite passed, including register/update/protocol/storage failures at phone and desktop widths, legacy-worker upgrade and identity/recovery protection. No hosted requests or real credentials.
- Final independent Sol review found no P1/P2 issue. Review requested online=true coverage and captured-controller pinning; both are included.

Generated logs: test-results/offline-startup-final-verify.log, offline-startup-final-handoff.log, offline-startup-focused.log, offline-startup-final-connectivity.log, offline-startup-origin-down-final.log, offline-startup-auth-regression.log and offline-startup-final-focused-lint.log. Generated evidence and browser profiles are excluded from publication/source backup.

## Limits and next gate

These are isolated local tests, not successful physical-phone acceptance. With navigator.onLine true but an unreachable origin, the adjacent page-preparation code can still show Preparing Offline Use rather than recognize the existing cached page. The form and preserved pending record remain safely available; readiness-copy refinement is not included in this coordinator-only fix. Online-only confirmations still require server access. No claim is made that the phone's exact diagnostic was captured.

Implementation scope added here: src/lib/recovery-write-coordinator.ts and tests/live-score-connectivity-browser.mjs, plus this report and status/memory updates. No SQL or permission change. Publication requires separate approval, followed by a bounded phone offline reload retest after the current page is prepared on that exact deployed release. Do not ask the user to clear data, change security settings or repeat activation. Keep both previously verified games and all other fixtures intact.
