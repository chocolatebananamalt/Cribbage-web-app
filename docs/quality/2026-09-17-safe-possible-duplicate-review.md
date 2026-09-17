# Safe possible-duplicate review and rehearsal preparation — 2026-09-17

## Scope and acceptance criteria

This release fixes the unsafe/unclear gap in weak duplicate handling without
weakening hard identity protection.

- Matching ACC # remains a hard block.
- With no ACC #, matching normalized first name, last name, and email remains
  a hard block.
- A name-only or email-only match must be visibly reviewable by a director or
  co-director, who can reject it as the same person or record an immutable
  distinct-person decision before it is promoted.
- A confirmed distinct person may retain a shared family contact email but may
  not share an app account; Digital score entry still requires an individually
  linked account.
- Existing roster withdrawal is unmistakably separate from candidate review;
  it remains append-only with guarded reinstatement.

## Implementation and hosted database evidence

- Migration `0206_safe_possible_duplicate_review` is applied to the approved
  Supabase project. It keeps the private `app` schema and service boundaries
  unchanged; only authenticated, role-scoped public wrappers remain callable.
- The promotion wrapper now permits a `confirmed_distinct_person` decision
  only when the normal identity result is a weak review match. It continues to
  reject hard duplicate and withdrawn outcomes.
- The review projection now recognizes weak collisions with both registration
  claims and current active roster identities, eliminating the earlier path
  where a director could approve a claim but could not promote it.
- The director UI exposes the two distinct review choices, makes the existing
  roster-record removal warning explicit, and uses the requested withdrawn
  disclosure language plus a reinstatement confirmation.
- Read-only hosted inspection of Genesis Rehearsal found six intended active
  roster identities (including Maryn reinstated) and zero payment, check-in,
  seat, enrollment, start, or linked-account records. No test financial,
  attendance, seating, or score data was fabricated.

## Checks

| Check | Result |
| --- | --- |
| `pnpm exec tsc --noEmit` | Pass |
| `node --test tests/registration-claim-review-ui.test.mjs tests/roster-identity-guard.test.mjs` | Pass (10/10) |
| `pnpm verify` | Pass (541 application tests, audit, lint, provider-readiness, Production build, workspace checks) |
| `pnpm verify:handoff` | Pass (6/6) |
| `git diff --check` | Pass |
| Supabase function-definition inspection | Pass: hard-duplicate guard and roster-collision projection present |
| Supabase security advisor | No new release-specific finding. Existing app-schema closed-table and intentional scoped `SECURITY DEFINER` advisories remain; leaked-password protection remains an unrelated Auth warning. |
| GitHub Verify / Vercel Preview | Pass on PR #87 |
| Production | READY: `dpl_EFh8PHGwnzSa5UWN6vXFM8jMEBWj` |
| External Chrome | Pass: authenticated roster page shows requested removal/disclosure wording at desktop and 375px width; `scrollWidth === clientWidth` at phone width |
| Vercel runtime errors | None in the release scan window |

## Remaining physical evidence

The code and database are released. The operator must still perform the
independent-person portions of the rehearsal: individual email sign-ins,
witnessed account activation, cross-checker assignment, cash/check test
entries, registration closure and rejected-signup proof, then seating,
scheduling, scoring, recovery, results, and final reconciliation. The exact
corrected sequence through closure is
`docs/operations/GENESIS_REHEARSAL_STEPS_1_TO_9.md`.
