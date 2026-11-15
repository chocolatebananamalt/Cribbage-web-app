# Mixed player workflow scope safety — local only

Acceptance: selecting an assigned game immediately invalidates prior game-specific evidence and readiness; no stale acknowledgment or script can appear or be submitted for another game. Fresh scope-validated evidence is required. Missing evidence, unavailable status and role changes fail closed. Existing exact retained retries, ownership and independent official safeguards remain unchanged. Test only pure in-memory browser response objects; no database fixture or hosted records. Full verification and focused independent review required; real-provider/multi-user backend acceptance cannot be re-established under the present no-fixture restriction.

Status: implementation and verification in progress. No publication, migration or user-page interaction authorized.

## Implemented scope
Only src/components/mixed-rehearsal-client.tsx and tests/mixed-rehearsal-browser.mjs changed for this checkpoint. Game selection immediately invalidates the read generation, own/official evidence, capability and loaded state. An acknowledgment only renders for the selected exact tournament/event/game. Prior consent is not carried into the next game.

Capability and official workspace must validate against current actor/tournament/event props before display or preparation. Fresh preparation requires loaded status and current scope. Retained exact retries keep their existing readiness exception but must belong to the current scope. A commit-time layout-effect scope ref prevents late success/network-failure and rejected-resolution responses from changing another event's messages, workspace or saved bytes. Late accepted requests retain their original bytes until their original context can reconcile them. No new request is synthesized or silently repeated.

## Evidence
Final focused local browser run passed 27 groups: 320/390/1440px own acknowledgment, PP/PD capture and review, delayed selection and role-loss behavior, event-prop reuse, late accepted/network-failed old-event responses, freshest official capability gates, target-specific rejected resolution and changed-request preservation. Doubled computed text checks and 390px player screenshot visually inspected. Test backend is intercepted in-memory HTTP responses only; no new database fixture or authentication provider. Port 3331 listener absent after cleanup. Independent reviewer found no remaining concrete P1/P2.

Intermediate checks are retained: initial browser locator was too exact for the select's accessible name; a source edit during a running browser check temporarily broke ready(); both were corrected. A generated scope test page needed literal typing. A baseline .tsx evidence copy was accidentally included by the global compiler glob, then renamed .tsx.txt. No production guard was removed. Final full verification results are recorded below only after terminal completion.

## Remaining readiness gaps
This is a local safety correction, not a complete player-facing rollout. Current mixed rehearsal is default-off and loopback-only. Actual provider sign-in, six people's accepted accounts, independent nonself officials, normal-route return-to-rehearsal discovery and end-to-end real-session/backend acceptance remain outstanding. Existing earlier representative backend evidence is preserved, not rerun or claimed fresh. The current no-fixture restriction prevents renewing that acceptance; no denial was retried.

The eventual random draw, approved anchor/family constraints, native immutable-ID/schedule publication and distribution remain separate integration work. Actual room layout and walking paths require physical confirmation. The new answer-key tool accepts the eventual draw and real DD results, but does not create them or establish independent attestations. Payout policy decisions and synthetic fund enrollment remain unresolved/separately authorized. No real-money readiness is claimed; no user decision is needed merely to retain this local patch.

## Final verification
Final pnpm verify and pnpm verify:handoff exited 0 (session 91141): 1,337 application tests, 6 provider checks, 8 workspace checks, 6 handoff checks; build, lint (0 errors) and dependency audit passed. Logs: test-results/mixed-player-scope-verify-final3.log and mixed-player-scope-handoff-final3.log. Browser final result has 27 passing groups. Previous failed intermediate logs are not release evidence. No database/provider renewal or publication occurred.
