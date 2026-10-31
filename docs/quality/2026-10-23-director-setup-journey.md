# Director setup journey — local candidate, 2026-10-23

> Historical implementation checkpoint. Current verification and release limits are in
> [completed local database execution](2026-10-23-local-database-execution.md).
> Earlier audit, environment and approval states below are superseded.

## Scope and acceptance

User authorized the focused guided setup and clearer-message pass. Preserve the
scorecard, scoring rules, server authorization, append-only audit, existing
tournament data, and financial policy. No push, merge, deployment, production
mutation, real email, payment, provider/security setting, credential, migration,
or schema change is authorized by this implementation task.

Acceptance: a numbered director guide reports persisted completion/unknown/blocker
states and a next action; initial Setup receives Create's name/planned date without
inventing a start time or end date; saved setup values take precedence. Roster
intake explains unopened/closed registration and preserves server checks. Pending
requests must not look rejected; uncertain requests retain exact identity/input
across refresh/back. Intentional event-check-in closure must not trigger a QR
failure. Explicit amount owed remains separate from event fees, including a
director-entered zero. Auth uses supplied retry seconds only, announces once,
counts down quietly, blocks duplicate in-flight requests, and retains password
fallback. Generic quota/IP 429 never receives an invented reset time.

## Checkout and instructions

- Existing connected project inspected read-only at
  the separate existing checkout. It contains an
  older OneDrive-backed checkout; Git status could not reliably inspect its work
  tree. No changes, reset, stash, checkout, or fetch were made there.
- Isolated clone: a task-local `cribbage-director` directory.
- Branch: `codex/director-setup-journey`.
- `git ls-remote ... refs/heads/main` reverified
  `7b318e64ef15f769f7ac2219a3324da07ed3e8dd` before cloning.
- Read current AGENTS, START_HERE, PROJECT_STATUS, DURABLE_PROJECT_MEMORY,
  MODEL_ROUTING, verification/run instructions and recovery review. No .agents
  skill directory exists in this checkout. Memory files and raw sessions were
  neither needed nor changed. Bundled Next 16.3.4 use-client/Turbopack guides read.
- Applied lean-build, Supabase, and React review guidance. Existing RPCs/codecs
  supply state; no workflow or score engine was rebuilt.
- Active lead model: gpt-6.1-sol (already-running host substitution for preferred
  Terra); bounded UI implementation: gpt-5.6-luna medium; auth and independent
  review: separate gpt-5.6-sol high workers. Astra was not used.

## Implementation

- Read-only checklist uses existing actor-scoped setup, activation, seating,
  enrollment, obligations, schedule and attendance readers after the protected
  director gate. Failed reads show unknown rather than fabricated completion or
  zero counts. Later events remain visible. Existing exceptional tools remain.
- Create/Setup seeds come from the authorized persisted tournament chooser.
  Start date and time are separate controls; a planned date carries forward,
  with no implicit time/end date. Saved revisions always supply existing values.
- Create is actor-scoped and hydration/flight guarded. Strict accepted receipt
  clears the envelope; malformed success/network/server errors keep exact retry.
  Inputs stay locked while uncertain. Explicit rejection preserves editable input.
- Setup retains an unresolved exact request even if another writer has advanced
  the version. An accepted receipt updates confirmed revision/version/fingerprint
  before the secondary refresh, whose failure cannot turn success into failure.
- Manual/CSV/candidate roster intake shows explicit setup/registration guidance.
  Candidate promotion recovery validates accepted/rejected reconciliation;
  null/503 remains unresolved, retaining the exact envelope and locking new
  promotions. Existing backend authorization, freeze and identity guards remain.
- QR responses are generation-bound so closure/event switching invalidates stale
  results. Window changes require exact action/event receipts. Intentional closure
  removes the QR and suppresses reissue while old open props are being replaced.
- Payments explicitly explain the amount-owed prerequisite and have a guide
  anchor. Amount-owed transport now retains an actor/tournament/roster-scoped
  exact request, with strict rejection validation and explicit retry after
  interrupted navigation. No fees, charges, receipts or pools are auto-created.
  Shared-device cleanup recognizes both new recovery namespaces.
- Auth normalizes provider cooldown, project quota and numeric/request 429 errors.
  Supplied seconds produce a static initial alert and quiet countdown; unspecified
  timing truthfully remains unavailable. Password fallback remains available.

## Executed evidence

Environment: Windows host; bundled Node runtime; pinned pnpm11.19.0
and frozen lockfile. Chrome headless runs entirely against an isolated localhost
fixture importing the actual changed components. All outbound requests are
aborted except explicit synthetic intercepts. No production credentials/backend
are used. Generated browser fixture/types/logs/screenshots are moved outside the
application checkout after each run to avoid contaminating app type checking.

| Check | Result |
| --- | --- |
| Locked dependency install | PASS,382 packages; package/lock unchanged |
| `node tests/run-application-tests.mjs` | PASS,755/755 |
| Focused checklist/date/receipt/recovery/event checks | PASS,22/22 before the final two roster-recovery tests; those are included in755 |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | PASS |
| Full ESLint command from package.json | PASS,0 errors;2 existing warnings in event-control-client/shared-device-sign-out |
| Provider readiness | PASS; existing manual fallbacks declared, online payments/SMS/OCR disabled |
| `next build` | PASS on integrated candidate; final check recorded below |
| `git diff --check` | PASS; Git notes Windows line-ending normalization |
| `pnpm verify` | BLOCKED at production dependency audit:13 findings,1 low/5 moderate/4 high/3 critical; later stages executed separately |
| Local handoff | Private ignored handoff absent in clean clone; not claimed passed |

The first aggregate invocation failed because pnpm had no Windows command shim;
a task-local shim then reached the audit. One build attempt met a simultaneous
worker build lock; after that worker finished the integrated build passed. An
early workspace check ran before the build and correctly required its manifest;
the post-build result is recorded below. These earlier attempts are not passes.

Browser12 scenarios passed at390px and1440px: checklist/roster/create/auth/setup/
event-check-in/amount-owed have no horizontal overflow; unopened roster retains
input and explains its disabled add; saved setup name/date/time/venue survive
refresh and take precedence over seed; accepted save plus failed refresh stays
saved; cancelling finalization writes nothing; amount owed zero/reason survive
back navigation with identical explicit retry; uncertain Create survives refresh
with the same key; other actor sees no prior create; malformed Create2xx stays
uncertain while explicit rejection unlocks preserved input; candidate promotion
survives null reconciliation/reload and retries the same key; explicit auth wait
announces supplied seconds with quiet countdown/password fallback; generic quota
has no invented duration; malformed window success retains QR while exact close
removes it without an irrelevant refresh warning.

Latest preserved browser evidence at this checkpoint:
local-only browser evidence (not published) and screenshots.
Phone Setup and desktop checklist screenshots were visually inspected. This
proves component behavior with synthetic state, not a real full tournament.

## Review and remaining release risks

Independent Sol review caught and prompted fixes for actor-global creation
storage, unsafe version-based draft disposal, malformed success acceptance,
candidate promotion retries, false unpaid copy, inconsistent create recovery
copy and amount-owed uncertainty. Follow-up review result is recorded below.

Aggregate release gate remains failed because unchanged dependencies have13
audit findings. Dependency upgrades require a separately scoped, reviewed patch;
they were not hidden or mixed into this UX change. Real distinct-user backend,
digital multi-device/offline, eight-player tournament, pool payout/full final
results, actual SMTP/admin capacity, and real password sign-in are unverified.
Password fallback works only for accounts which already have a password; no
new password-setting/reset workflow was added. No live rehearsal record was
mutated, including protected test ID[protected test identifier omitted].

Financial policy decision kept separate: deriving amount owed automatically from
selected event fees/pools would require agreement about waivers, fee inclusion,
corrections and existing obligations. This candidate only explains/links the
existing director-entered prerequisite and makes its transport retry safe.

Next release step: resolve dependency findings in a separately reviewed change,
complete independent review and staging/real-session acceptance with synthetic
data, then request approval for a draft PR. No push, PR, merge or deployment has
been performed by this task.

## Final local check and independent-review result

- Final integrated `next build`: PASS, exit0, all operational routes dynamic.
- Post-build `node --test tests/workspace.test.mjs`:7 pass/0 fail/1 skip
  (private ignored handoff unavailable), exit0.
- Final full application suite:755 pass/0 fail/0 skip, exit0.
- Full lint:0 errors/2 established warnings, exit0.
- Final typecheck with `--noEmit --incremental false`: PASS, exit0.
- Provider readiness: PASS, exit0.
- Independent gpt-5.6-sol high source review: PASS; no remaining introduced
  blocker found after examining requirements, final diff, tests, browser proof
  and recovery fixes. This is source acceptance, not release approval.
- Audit remains13 vulnerabilities, including3 critical Next.js advisories;
  package.json and pnpm-lock.yaml are unchanged.
- Raw command logs preserved under ignored `test-results/director-setup/`.
- Screenshots and synthetic browser evidence preserved outside the checkout at
  local-only browser evidence (not published).

Official rate-limit documentation was checked read-only:
<https://supabase.com/docs/guides/auth/rate-limits>. It separates built-in
project-wide email capacity from per-user resend intervals; no current project
settings were inferred from defaults or changed. The changelog Markdown fetch
was unsupported by the browser reader; no SDK/API behavior was upgraded here.

## Changed files

- `docs/decisions/2026-10-23-guided-director-setup.md`
- `docs/quality/2026-10-23-director-setup-journey.md`
- `PROJECT_STATUS.md`
- `src/app/director/tournaments/new/new-tournament-client.tsx`
- `src/app/director/tournaments/new/page.tsx`
- `src/app/globals.css`
- `src/app/sign-in/sign-in-form.tsx`
- `src/app/tournament/[tournamentId]/director-checklist.tsx`
- `src/app/tournament/[tournamentId]/event-check-in/event-check-in-client.tsx`
- `src/app/tournament/[tournamentId]/page.tsx`
- `src/app/tournament/[tournamentId]/payments/page.tsx`
- `src/app/tournament/[tournamentId]/payments/payment-obligation-client.tsx`
- `src/app/tournament/[tournamentId]/roster/page.tsx`
- `src/app/tournament/[tournamentId]/roster/roster-client.tsx`
- `src/app/tournament/[tournamentId]/setup/page.tsx`
- `src/app/tournament/[tournamentId]/setup/setup-client.tsx`
- `src/lib/api/event-check-in-window.ts`
- `src/lib/api/payment-obligation.ts`
- `src/lib/api/roster.ts`
- `src/lib/auth/email-sign-in-error.ts`
- `src/lib/client-session-storage.ts`
- `src/lib/director-checklist-reader.ts`
- `src/lib/director-checklist.ts`
- `src/lib/setup-dates.ts`
- `tests/create-setup-flow-ui.test.mjs`
- `tests/director-browser.mjs`
- `tests/director-checklist.test.mjs`
- `tests/director-roster-recovery.test.mjs`
- `tests/email-sign-in-rate-limit.test.mjs`
- `tests/event-check-in-window.test.mjs`
- `tests/event-check-in.test.mjs`
- `tests/payment-obligation-client-recovery.test.mjs`
- `tests/setup-dates.test.mjs`
- `tests/supabase-auth-semantics.test.mjs`

## Follow-up evidence

Dependency remediation, additional start recovery, team checklist corrections,
and the local-only SQL guard candidate are recorded in
`2026-10-23-dependency-security-and-start-recovery.md`. The audit/test counts
above describe the earlier first pass and are retained as historical evidence.
