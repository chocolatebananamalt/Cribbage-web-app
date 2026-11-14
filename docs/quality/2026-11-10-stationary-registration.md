# Player stationary-seat requests and Director review

Local implementation, default off, 2026-11-10. No hosted change or publication retry. Database execution is blocked as described below; do not enable this candidate from source review alone.

## Built

Registration optionally shows Request a Stationary Seat. It collects a boolean preference, no medical reason, and states that a request does not reserve a chair or guarantee assignment. The server page and claim API share `ACC_STATIONARY_REGISTRATION_V1=enabled`; unset remains off. Old eight-field registration bodies and the existing V4 writer remain supported unchanged. The extra field must be boolean and cannot be silently discarded when the feature is off.

The additive SQL proposal wraps the existing signup writer. It proves the link digest before entering the same `registration-link-v2:` tournament lock, classifies fresh versus legacy under that serialization, then records the preference in the same transaction as the signup. A preference failure must roll back signup rather than return a false received acknowledgment. Exact retries preserve the original preference; a changed preference cannot overwrite it. Existing registrations are not retrofitted with assumed preferences.

Players and Registration gains a separately gated Stationary-Seat Requests section. Directors/Co-directors can record Reviewed for Consideration or Not Accommodated with a reason. Registration approval, roster creation and seating assignment remain separate. The reader follows claim IDs through roster provenance, never matches names to assign identities. Unknown reader state is distinct from an empty list.

Reviews are immutable, versioned rows with actor, operation ID, timestamp, reason, request hash and exact response. The writer checks current Director/Co-director authority, serializes the actor/operation and claim, and compares the expected revision. Only a permanently superseded body (current append-only revision strictly greater than expected) returns an exact actor/tournament/full-request/head-bound no-write proof. Future or unknown revision failures cannot clear pending. Retried accepted operations return the original response.

Director decisions are retained under an actor/tournament-scoped session-storage key through the existing recovery-owner coordinator before dispatch. Remount does not resend. Every send and cleanup rechecks recovery admission and exact stored bytes. Unknown/foreign/corrupt/displaced records are preserved and block new work. This is browser-tab recovery, not cross-device storage. Public registration retains its existing generic unknown-outcome/contact-Director behavior; raw registration credentials are not newly persisted.

## Files and rollout implications

- `database/proposals/stationary-registration-v1.sql`: two new forced-RLS immutable tables, two immutable-history triggers and five new functions (private false gate, immutable trigger helper, signup wrapper, authorized workspace reader and review writer). No application EXECUTE grants, existing function replacement, existing-data update or seat writer.
- `src/lib/api/stationary-registration-v1.ts`: rollout flag and strict review/workspace/receipt/supersession contracts.
- `src/lib/api/public-registration-v2.ts`, public registration claim route, registration page/form: backward-compatible optional preference and gated submission path.
- New `src/app/api/v1/tournaments/[id]/stationary-requests/route.ts`: same-origin, verified expected actor before/after RPC; normal authenticated client; DB owns role authorization.
- `src/components/stationary-request-review-v1.tsx`, roster page: current authorized reader, reasoned review and protected exact retry.
- `src/lib/client-session-storage.ts`: registers the new owned recovery prefix.
- Focused contract/browser tests and an unexecuted disposable-database runner are prepared.

No request guarantees assignment, and no numerical anchor limit is imposed here. These records do not automatically change an existing or reviewed draw. Director selection of an anchor and any seating publication/amendment remain explicit later operations. Initial public signup is covered; player self-service changes after registration and Director-entered walk-in preferences are not added by this checkpoint.

## Focused evidence

Five new contract/source tests and two existing public-registration-options checks pass under `--conditions=react-server`; TypeScript `--noEmit` and targeted ESLint pass. Independent source review found three issues, now corrected: legacy/fresh classification before the legacy lock; nondurable broad revision rejection; and retry dispatch without rechecking saved bytes/owner admission. Re-review GO. SQL SHA256 `750e64e15febb5cac8aed526b0e5bef730ce296cb298e78e1b85282f042e7deb`; review UI `34c4b089f56b2793f9681b237f5d8be09dbd4cdf92d6f32c28a32c457f05d29b`.

`test-results/stationary-registration-browser-20261110/result.json` and screenshots: actual registration and review React at390/1440px; checkbox in submitted request, retained-before-dispatch, exact retry, remount without resend, unknown-byte preservation and displaced retry with no dispatch pass; zero network requests. Fetch, router and recovery storage/owner are injected test ports. This is no real provider, session-storage, full-reload, database transaction or actual signup proof. No mock tournament was created for this UI check.

## Exact blocked operation

The attempted command `node tests/launch-stationary-registration-local.mjs`, in this repository, was to create one isolated fictional local database/container `cribbage-stationary-registration-20261110` / `fixture_stationary_registration_v1`, check the new signup/review transactions and rollback, and remove it. Automatic approval review rejected process creation before execution: “Although the test is local and disposable, the user explicitly instructed the agent to prioritize building over further testing and credit use, so this additional database test is not authorized.”

It was not executed or retried. No container/database/SQL grant or data write occurred from that command. Prepared scripts are not runtime evidence. Specific new authorization is required before retrying that exact denied operation. Runtime SQL, ACL, concurrent legacy submission and transaction rollback remain unverified; actual signed-in provider and device recovery acceptance also remain. Full pnpm verification/audit was not attempted. Keep both feature gates off and grants absent until the necessary runtime and later release approvals are satisfied.
