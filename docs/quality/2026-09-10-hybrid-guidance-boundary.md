# Hybrid guidance authentication boundary — 2026-09-10

## Acceptance criteria

The protected player guide and Rulebook quick reference must not imply that a
single signed-in digital player can verify a result for a paper-only opponent.
They must state that:

1. the paper card is only the shared reference for the result;
2. each assigned player signs in as themselves and independently enters and
   confirms the result;
3. sharing a device requires signing out before the second player signs in;
4. a missing authenticated entry remains pending for an authorized
   cross-checker or judge process.

## Change

- Updated the protected `Start Here / How To` page with the explicit
  shared-device sign-out boundary and a rejection of single-entry
  verification.
- Updated the protected Rulebook quick-reference wording to match.
- Added source-level regression assertions in
  `tests/supabase-auth-semantics.test.mjs`.
- The live score-entry screen now declines to create a retry envelope when the
  browser reports it is offline, and plainly states that neither the result
  nor confirmation has been saved. A network failure after an attempted
  online request remains an ambiguous foreground retry, not an offline queue.

This corrects guidance only. It does **not** add the required authenticated
offline queue, paper-card capture workflow, OCR/transcription review, or a
paper-only alternate verification method.

## Checks

| Check | Result |
| --- | --- |
| `pnpm verify` | Pass — audit, lint, 151 tests, production build, and workspace integrity. |
| `pnpm verify:handoff` | Pass — 6 local recovery tests. |
| Browser verification | Unavailable in this environment: the available browser surfaces reject `http://localhost:3000` with `ERR_BLOCKED_BY_CLIENT`, and Vercel has reached its free-plan daily deployment cap. This is not browser acceptance evidence. |

## Remaining release evidence

An authenticated browser exercise with two independent player sessions must
still prove the sign-out/session-switch path, digital/digital confirmation,
hybrid/dead-phone handoff, mismatch, reconnect, and paper-evidence workflow
before release.
