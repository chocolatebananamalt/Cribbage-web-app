# Local recovery confirmation correction — incomplete verification

Scope: owner-approved local account-switch safety correction discovered during Preview sign-out verification. No publication, hosted retry, credentials, policy/settings change, migration or business operation. Existing user Chrome tabs remain intact. Prior denied Git work-tree operations were not retried or bypassed.

## Observable acceptance

- Installed Supabase empty-session `{data:null,error:null}` confirms signed out; valid nonempty string subject remains signed in. Malformed/undefined results, other auth failures and exceptions remain unconfirmed.
- Recovery initialization failures keep the boundary closed and expose only a fixed stage plus allowlisted code. Raw errors, credentials, actor IDs, storage values and full URLs are not retained/logged. No diagnostic telemetry or persistent diagnostic storage.
- Actual production headers, first installation, existing worker upgrade/controller takeover, handshake rejection/timeouts and storage failures require local browser proof before readiness. Phone/desktop boundary layout and route rejection/confirmation behavior also require browser proof.

## Changes

- `src/lib/auth/sign-out-claims.ts`: narrow SDK-result interpretation; `src/app/auth/sign-out-state/route.ts` uses it, preserving origin/body/private-response protections and returning 503 for unconfirmed results.
- `src/lib/recovery-diagnostic.ts`: in-memory allowlisted stage/code capture preserving original rejection.
- `src/lib/recovery-write-coordinator.ts`: annotate capability, registration/update/ready, controller, protocol and document lease failure stages without changing security policy or releasing failed barriers.
- `src/components/recovery-document-boundary.tsx`: catches initialization and owner-read failures, shows/logs sanitized diagnostic, preserves blocked state. Removed generic instructions to close tabs because this screen does not establish competing tabs as the cause.
- `tests/recovery-diagnostic.test.mjs`: installed SDK zero-network reproduction, success/malformed/error classification, privacy sentinel and nested stage/rejection checks.
- `tests/recovery-production-policy-browser.mjs`: disposable localhost candidate-policy harness using source-extracted production page policy and actual worker/coordinator. It does not establish effective Next worker-response header precedence; that remains a separate required proof.

## Executed checks (Windows PowerShell, Node 24.19.0)

- `node --experimental-strip-types --test tests/recovery-diagnostic.test.mjs`: PASS 5/5. Actual installed SDK makes zero mocked network requests and returns null/null. No real auth used.
- `node tests/run-application-tests.mjs`: PASS 930/930, exit 0 (final run including SDK regression).
- `node node_modules/eslint/bin/eslint.js src tests next.config.ts eslint.config.mjs`: PASS, 0 errors / 2 existing warnings (event-control unused import; shared-device-sign-out effect dependency).
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: PASS exit 0.
- `node scripts/check-provider-readiness.mjs`: PASS declared manual fallbacks; providers disabled.
- `pnpm verify`: unavailable, pnpm not on PATH. Production audit/build and aggregate gate not completed; no installation or settings workaround attempted.
- `node --test tests/workspace.test.mjs`: 6 pass / 1 fail / 1 skip. Git-dependent private-handoff ignore assertion received Git exit 128 in this environment; private handoff unavailable. No Git access retry.
- `node --test tests/handoff.test.mjs`: unavailable private source, ENOENT for original prototype. No import/source changes.
- `node tests/recovery-production-policy-browser.mjs`: DENIED navigation to disposable `http://127.0.0.1:52255/`, `net::ERR_NETWORK_ACCESS_DENIED`. Browser closes in harness finally. No retry, alternate-path browser access, CSP change or live-browser claim.
- `node tests/recovery-auth-browser.mjs`: DENIED fixture write, EPERM opening `test-results/recovery-auth-browser/package.json`. No retry or alternate destination. Browser/route proof not obtained.

## Review, risks and readiness

Independent read-only review of all five production files and both added tests found no P1/P2 source issues. Reviewer confirmed narrow null/null handling, retained origin/body/no-store protections, allowlisted diagnostics and fail-closed decisions. The zero-network SDK regression was independently judged sound. Reviewer explicitly confirmed that the browser harness supplies no runtime acceptance evidence and does not cover effective Next worker headers, real boundary/preflight UI or upgrade/takeover/timeout/storage-error branches. Minor limitation: module-global diagnostic state can misattribute concurrent failures after resets; this affects diagnosis only, never barrier decisions.

No git diff/status claim: repository work-tree access remains restricted. Changed files were directly read, and application/lint/type checks passed. This is implementation complete for the bounded source correction, **verification incomplete / publication held**. Hosted initialization error and live session remain unknown. Candidate CSP fallback and worker takeover paths are hypotheses requiring the blocked browser proof; screenshot feedback/frame/listener errors do not establish causality. No security-policy change is proposed without evidence and a separate decision.

## Resumed unaffected verification

Using the existing installed pnpm11.19.0 with process-only PATH and telemetry disabled, audit, lint, full application tests, provider checks and production build all exited0. Production audit found no known vulnerabilities; application suite passed930/930; lint0errors/2existingwarnings; Next production compile and TypeScript passed. Logs: test-results/recovery-correction-unaffected-verification.log.

Workspace subsequently completed7pass/1private-handoffskip using ordinary cwd tooling. The intended test-name exclusion did not exclude the Git ignore assertion; it ran and passed. No explicit --work-tree operation was invoked or access settings changed; do not characterize this as a retry of that denied explicit command. Log: test-results/recovery-correction-workspace-unaffected.log. The aggregate pnpm verify command itself was not invoked; its individual components ran. Both browser harness syntax checks passed without executing them.

Neither blocked browser operation was retried. Last blocked candidate-policy URL was http://127.0.0.1:52255/; the source binds127.0.0.1:0, so a future authorized same-harness run receives an OS-selected loopback port. Its actual worker/module paths remain same-origin. Auth fixture write target is test-results/recovery-auth-browser/package.json (absolute path within this repository); the harness serves Next at http://127.0.0.1:3237 with a separate localhost ephemeral mock provider, fictional credentials only. Read-only file metadata still reports32bytes/archive attribute and last-write2026-10-28T01:08:14.0995489Z; no writable-state claim is made.

ERR_NETWORK_ACCESS_DENIED and EPERM are observed access failures, not proof of which policy/OS component denied them. No explicit automatic-review rejection reason was supplied in the diagnostic record. pnpm absence was a separate tooling/PATH issue and is resolved without installation. A specific new approval can support one normal scoped retry of these exact disposable fixture writes/loopback browser tests if the execution service permits it; it cannot override OS/browser restrictions. If still denied, stop and report rather than changing ports/paths to evade the restriction. Current Chrome observation approval does not authorize these retries.

Browser verification remains incomplete: candidate-policy harness alone cannot prove actual Next worker-response header precedence, real boundary UI, upgrade/takeover, handshake-timeout or storage-failure behavior. No publication, hosted action, Chrome reload, sign-out retry, credentials, settings or source correction changes were performed in this resumed verification.

## Final approved local browser acceptance

The user specifically approved one supported scoped retry of both earlier access failures. Both original harnesses ran successfully through scoped tooling at their original fixture/loopback targets. The policy harness exited0 at390/1440; its unchanged production page policy allowed initialization. The fictional auth harness's original scoped retry exited0. There was no repeated access denial and no alternate route around one.

The same permitted auth fixture was then extended to close the missing acceptance gaps. It transcompiles the unchanged actual next.config.ts, imports actual proxy logic with a statically copied matcher, and runs next build/start with the real project's strict compiler options. It uses actual routes/components/coordinator/worker and a local fictional provider, never staging/Supabase production or real credentials. Final command: RECOVERY_AUTH_PRODUCTION=1 RECOVERY_AUTH_UPGRADE_ONLY=0 node tests/recovery-auth-browser.mjs; EXIT0. Log: test-results/recovery-auth-full-policy-proof.log; build log: test-results/recovery-auth-fixture-production-build.log.

Actual final browser evidence:
- First installation initializes at390/1440 under delivered production Next headers. Worker response has JavaScript content type, Service-Worker-Allowed:/, no-store, and the proxy-generated nonce CSP; the simpler dedicated next.config worker CSP does not win in this fixture. No header/security policy was changed. Initialization succeeds under the observed effective policy, so policy text alone is not a demonstrated cause of the hosted guard.
- Actual empty-session route returns signed_out using the installed SDK null/null result. Password sign-in then exactly one real local sign-out/confirmation succeeds at390/1440; a fresh context-shared server request independently renders Mock missing session after cookie clearing.
- Exact-origin/ownership/candidate-cookie isolation, same-owner retained recovery, unknown legacy blocking, one-time email code exchange, lost-response reconciliation without credential replay, actual score writer exact replay/conflicting overwrite rejection and nested actor-bound subtree hiding pass.
- Actual boundary register/update/protocol-timeout/storage-error cases at390/1440 show only allowlisted stage/code diagnostics, hide interactive children, avoid horizontal overflow and preserve retained bytes. Privacy sentinel never appears in the diagnostic UI or its sanitized warning.
- A same-origin/same-URL synthetic nonprotocol prior worker is installed in an isolated context. First upgraded load fails closed. After the replacement controller actually reaches activated and the exact protocol responds, a fresh coordinated reload becomes ready, preserving the original known-owner pending request bytes. This is a synthetic old script, not a historical released bundle. Earlier immediate test reload occurred during activating and correctly remained blocked; waiting for the existing activated-state requirement corrected that fixture assumption without modifying application checks.

Test-only issues corrected during expansion: response-body observation raced navigation (buffered/forwarded the actual response before delivery); Next's autogenerated fixture TypeScript settings did not match the project's explicit .ts-import support (copied the real strict options); upgrade-only mode initially skipped browser initialization (moved it before the mode branch). None was an application/auth/security-policy fix. No bypass of a denied operation occurred.

Independent final review is GO/noP1-P2 for both scoped source correction and expanded harness. Reviewer explicitly accepts the activated-state prerequisite as honest bounded upgrade recovery. Limits: generated fixture routes/layout rather than the full hosted app; fictional provider; nested actor transition rather than real full-root RSC identity replacement; synthetic prior worker; local Next header precedence rather than hosted/CDN proof. Actual BFCache restore, non-Chrome engines and browser-process crash ordering remain outside this correction's proof.

Final pnpm verify EXIT0:930/930 application tests, production audit no known vulnerabilities, lint0errors/2existingwarnings, provider checks, production build/TypeScript, workspace7pass/1unavailable-private-handoffskip. Log: test-results/recovery-correction-final-verify.log. Diff whitespace check passed. Final source HEAD remains e5cb19566649720b160dc01e50db876a7bff7dce; correction is uncommitted/unpublished. No database, production, settings, roles, money or hosted session actions. Disposable browser/server cleanup completed; port3237 confirmed clean.

Readiness: ready for a separately approved bounded Preview publication of the correction and sanitized diagnostics. Not a passing hosted acceptance: the stable Preview guard's actual cause and live session remain unknown. The SDK contract defect is proven locally; the activation-transition behavior and observed CSP precedence are local findings, not attribution of the live incident. Next safe hosted step after separate publication approval is read-only inspection of the new diagnostic, not an automatic clear/sign-out retry or tournament continuation.
