# Recovery correction Preview rollout — 2026-10-28

Published commit: `4d6b4c2cd49bae7f4fc09bbb6cfdf2c74edbad3c` on `codex/director-setup-journey`. PR 122 remains open and draft. Non-force push and remote SHA were verified. Main remained `7b318e64ef15f769f7ac2219a3324da07ed3e8dd`.

Exact-commit Verify runs passed: push `40634978227` and pull request `40634983490`.

Normal Git-created Vercel Preview `dpl_9ePWSsfskbhv9rfHbWS5WLTvVd3t` reached READY at https://cribbage-web-anjlc0lcc-cribbage-app.vercel.app. Vercel confirmed that https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app/ resolves to this deployment and commit. No redeploy or promotion was invoked.

After reconnecting, Chrome was verified as browser 3. The former stable tab was absent; a fresh stable-alias tab 336434205 was opened without discarding an existing form. It rendered “Tournament access” and “Sign in by email.” No recovery guard or diagnostic stage/code appeared, and the filtered recovery initialization warning/error log was empty. The tab was marked for handoff. No credentials were entered, and sign-out/clearing was not retried.

This proves successful initialization and an anonymous access page in the fresh document. It does not retrospectively establish the outcome or cause of the earlier uncertain sign-out, or prove revocation of every prior token. Older immutable-host tabs were preserved and are not current-session evidence.

Read-only staging comparisons before and after observation matched five scoped row digests: funded tournament `ab275686-6349-40e3-8771-bdfb1fe18f65`, its event `cf40e6de-2264-4110-8c06-9e18c9bd6c5d`, earlier tournament `c59f74ae-1174-4e3a-b1d4-4d9d0ddebc2d`, its event `4af492ef-18ea-48de-91eb-9e5fa07fbcca`, and nomination `fc9587a0-e256-4950-b846-959d36063ebe`. The latter remains pending for cross_checker. These checks do not hash every business table. No business mutation, migration, role change, credential entry, or production operation was performed.

Local verification supporting publication is recorded in `2026-10-28-recovery-confirmation-local-correction.md`: 930 application tests, full verification/build/audit, approved local browser retries, and independent review passed. Cross-engine, actual BFCache restoration and process-crash ordering remain outside established coverage.

Next safe step: user-controlled sign-in when the tournament rehearsal resumes; then reconcile the existing pending B invitation. No further action is required for this publication task. This evidence record is local and was not included in another publication.
