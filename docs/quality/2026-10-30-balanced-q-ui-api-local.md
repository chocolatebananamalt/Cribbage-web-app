# Balanced Q policy UI/API local acceptance

Scope: director disclosure and pre-payment freezing of the versioned `acc-weighted-largest-remainder-5usd-v1` policy; read-only actual-funded previews; exact recovery/reconciliation. This is local implementation and synthetic acceptance, not publication or production approval.

## Acceptance and preserved behavior

- New graduated publication uses the dedicated v3 route/RPC and exact full-request reconciliation. Actor identity is server-derived; same-origin, UUID, strict body/result and private service boundaries remain enforced.
- Actual preview counts current fully funded, explicitly pre-play elected members of the named pool with the exact saved policy acknowledgment. `paidEntryEligible` alone does not establish pre-play election.
- The observed ACC raw weights use the separately tested app-owned exact rational/$5 largest-remainder calculator. The UI labels this modification accurately, shows total award equality and requires explicit disclosure. Illustrated entry counts do not freeze future amounts.
- Sixteen $10 paid entries produce $80/$55/$25 under the new method; the preserved historical chart still produces $80/$50/$30. The $590 example produces $70/$65/$60/$55/$50/$50/$45/$40/$35/$30/$25/$20/$20/$15/$10.
- New balanced cash ties block. Historical cut records remain visible and unchanged but cannot resolve a current chart cash tie either, matching current server review behavior. The pure historical oracle and immutable history are not rewritten.
- Equal Q remains on v2, including its existing zero-eligible unpaid-refund convention. Regular playoff prizes remain separate and their percentage-to-equal-semifinal-weight conversion requires renewed review.
- Retained v2 keys/requests stay on their original route. Since old reconciliation cannot prove the full payload, a returned old receipt does not clear recovery; explicit exact replay to the old writer must validate it. New v3 lost responses reconcile using the entire original request, without an automatic duplicate POST.
- Unknown/multiple/cross-version recovery data is preserved and blocks new work; unknown ownership blocks the document. No sign-out or storage-clearing workflow is exercised against the user's browser.

## Executed checks

`node --experimental-strip-types --test tests/q-operating-balanced.test.mjs tests/q-operating-contracts.test.mjs tests/q-operating-schedule.test.mjs`: **23/23 passed** after review corrections.

`node node_modules/typescript/bin/tsc --noEmit`: passed. Targeted ESLint for the API, preview, client/page, v3 routes and new tests: passed. Lead runs the final repository-wide verification and independent review separately.

`node tests/q-operating-browser.mjs` now delegates to the current `q-operating-balanced-browser.mjs`, retaining historical chart/equal/recovery and regular-prize checks. Former controls for publishing a new friend chart or recording a new cash cut are intentionally superseded; historical display and strict legacy request replay remain covered.

Final browser run: **14 grouped checks passed** at 390/1440, including the independent pre-play flag and tied historical-chart-plus-cut rejection cases. Browser evidence is recorded in `test-results/q-operating-balanced-browser-result.json`, screenshots `q-balanced-current-{390,1440}.png` and `q-balanced-disclosure-{390,1440}.png`, and the task-owned cleanup record. Screenshots were visually inspected. The task-owned server PID3252 exited, port3256 has no listener and its generated fixture directory is absent. Earlier failed attempts are not passes.

## Diagnosed test-fixture failures

An exact select-label locator included option text and was replaced with an unambiguous combobox locator. A legacy request manually seeded without a recovery-owner marker correctly triggered `Recovery account mismatch`, preserving the record; the owned-recovery case was corrected to include a fictional non-auth ownership marker, with a separate unknown-owner rejection case retained. A pre-existing prize weight label uses different dash punctuation; its test locator now matches the semantic label without changing the application. No guard was relaxed for these corrections.

## Limits

The browser uses actual React/recovery components and isolated local Chrome contexts, but intercepted fictional APIs. It does not prove SQL persistence, real authenticated independent-user operation, physical cut evidence, hosted deployment or production isolation. Lead-owned disposable SQL tests establish backend persistence/races/access separately. No money moved, obligations were created by the browser, or hosted state changed. Fees/counts outside the approved calculator domain and unresolved cash ties remain explicitly blocked.
