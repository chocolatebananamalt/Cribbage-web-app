# Pre-launch defect sweep

**Date:** 2026-09-18
**Scope:** an independent production readiness review of the whole application,
run against the repository, the deployed site, and the pilot database.

Nine defects were found and eight are fixed in this change set. The ninth is a
database migration that is written but deliberately not applied, because
applying it is a production database change and that decision is not this
review's to make.

The single most important finding is that self-service QR event check-in could
not work at all. It returned 503 on every submission.

An earlier, narrower note covering findings 5 and 7 only was merged into this
document and removed, so there is one record of this sweep rather than two.

## Verdict

| Finding | Severity | State |
| --- | --- | --- |
| 1. QR event check-in called its RPC with an argument name the function does not declare | Critical | Fixed |
| 2. Director authorization on team side-pool money elections has been absent since migration 0187 | Critical | Migration written, NOT applied |
| 3. Three of four PDF builders crash on any Hawaiian name | Critical | Fixed |
| 4. The player whose entry completes a match never sees the Confirm button | High | Fixed |
| 5. Side Pool operations GET reported a false outage to unauthenticated callers | Medium | Fixed |
| 6. Roster CSV import rejected legacy-shaped tournament ids | Medium | Fixed |
| 7. The repository gate could not run on a Windows checkout | Medium | Fixed, with a caveat below |
| 8. Two interactive pages were prerendered, so under the nonce-only CSP their scripts never ran | Critical | Fixed |
| 9. A dead session produced a permanent 404 with no way back to sign-in | High | Fixed |

## Finding 1: every self-service QR check-in returned 503

### Observed

`POST /api/v1/event-check-in` called `submit_event_check_in_completion_v1` with
an argument named `p_credential_id`. The function declares `p_completion_id`.

PostgREST resolves an RPC by the set of argument NAMES, so an undeclared name is
not a type error and not a coercion failure: the function simply does not
resolve, PostgREST answers `PGRST202`, and the route reports that as
`503 operation_unavailable`. The failure is total. No check-in could succeed.

The value being passed was already correct. `credential.credentialId` is the
completion session's id, which is exactly what the sibling call in
`src/lib/event-check-in-issuer.ts:36` passes under the correct name. Only the
key was wrong.

### Change

`src/app/api/v1/event-check-in/route.ts` now passes `p_completion_id`.

### Why the existing suite could not catch it

Nothing in 554 tests compared an `.rpc()` call's argument names against the
migration that declares them. A name mismatch is invisible to TypeScript, to
ESLint, and to every test in the suite, and only appears as a runtime 503.

`tests/rpc-argument-names-match-migrations.test.mjs` closes that gap for the
whole codebase. It replays every migration to determine each function's current
parameter names, honouring `create or replace` and `alter function ... rename
to`, then checks all 201 `.rpc()` call sites in `src` against them.

The parser resolves arguments passed as a bare identifier and arguments merged
in with a spread, because the first version of this test did not, and that blind
spot silently exempted both call sites in
`src/app/api/v1/tournaments/[id]/schedule-amendments/route.ts`. A separate
assertion now fails if any call site cannot be parsed at all, so silence and a
clean result cannot look the same.

Verified by re-introducing the defect: the test fails and names the file, the
line, the offending argument, and the six the function actually declares.

## Finding 2: any signed-in user can write a team's side-pool money election

### Observed, in the pilot database

| Check | State before this change |
| --- | --- |
| `event_side_pool_team_election_guard` is bound to | `guard_side_pool_election_start_v4`, which has no role check |
| `guard_side_pool_team_election_v3` | exists, contains the role check, attached to nothing |
| `set_event_side_pool_team_election_v1` | contains no role check |

### Cause

Migration 0177 guarded `app.event_side_pool_team_election_versions` with
`app.guard_side_pool_team_election_v3()`, which requires the acting profile to
hold `director` or `co_director`.

Migration 0187 dropped that trigger and created a trigger of the **same name**
bound to `app.guard_side_pool_election_start_v4()`, which checks only play state
and the reconciliation lock. The same migration redefined
`guard_side_pool_team_election_v3()` with its role check intact, but nothing has
re-attached it since. It has been dead code from 0187 onward.

The RPC never carried its own role check either, unlike the singles equivalent
`public.set_event_side_pool_election_v1` at 0170, which rejects a non-director
with `not_director` in its own body.

The route does not compensate. The POST handler establishes the caller's
identity with `requireVerifiedSubject` and passes that verified id straight
through as `p_actor_id`. The actor cannot be spoofed, but nothing requires that
actor to hold any role on the tournament.

Team side-pool **payouts** were never affected. Their RPC check (0187) and their
trigger (0177) are both intact. The gap is confined to elections.

### Change, written but not applied

`database/migrations/0215_side_pool_team_election_authorization.sql` repairs both
layers:

1. the RPC rejects a non-director with the same `not_director` code the singles
   path already returns, which the route surfaces as a clean rejection rather
   than the 503 a raised exception would produce;
2. the trigger is re-bound to the role-checking guard, which also restores the
   election version-conflict check that 0187 dropped.

Both layers, rather than one, specifically because a single trigger rebind is
what removed the protection in the first place.

The new function body was generated from the 0176 definition programmatically
rather than retyped, so the only difference from the shipped function is the
inserted role check. Its plpgsql body was validated by creating it on a
throwaway database and then dropping it.

**This migration has not been applied to any database holding the target
tables.** Applying it to the pilot project is a production change and is left to
the owner.

### Regression test

`tests/trigger-authorization-not-silently-dropped.test.mjs` replays the
migrations and fails if any trigger that was ever bound to a role-checking
function ends up bound to one that is not. It is a check on the class of
mistake, not on this one incident.

Verified by removing 0215 from the migration directory: the test fails and
describes the 0177 to 0187 regression on its own, from the migrations alone.

## Finding 3: any Hawaiian name crashes three of the four PDF reports

### Observed

pdf-lib's standard fonts encode with WinAnsi. Measured directly against the
repository's own pdf-lib:

```
raw "Kaleoʻokalani" -> Error: WinAnsi cannot encode "ʻ" (0x02bb)
raw "Māhealani"     -> Error: WinAnsi cannot encode "ā" (0x0101)
```

The throw happens in `widthOfTextAtSize` as well as in `drawText`, so merely
measuring a name is enough to fail. Every PDF route runs inside
`withApiFailureBoundary`, which reports the throw as `503`. One name takes down
the entire report rather than degrading one line.

This tournament is run in Hawaii. These are expected names, not edge cases.

| Builder | Before |
| --- | --- |
| `finalized-event-report-pdf.ts` | Safe. Sanitized every drawn string. |
| `satellite-results-pdf.ts` | Unsafe. Raw text measured and drawn. |
| `side-pool-report-pdf.ts` | Unsafe. Raw `text.slice(0, 110)` drawn. |
| `team-results-pdf.ts` | Unsafe. Raw `text.slice(0, 105)` drawn. |

### Change

`src/lib/results/pdf-text.ts` holds the sanitizer, promoted out of the one safe
builder so all four share it. All four now route drawn text through it.

In `satellite-results-pdf.ts` the sanitizer sits on `wrap()`'s input rather than
at the `drawText` call, because `wrap()` measures first and would throw before
drawing is ever reached.

The okina now maps to a straight apostrophe instead of falling through to `?`.
`Kaleoʻokalani` prints as `Kaleo'okalani`.

**Accepted limitation, stated rather than hidden:** macrons decompose under NFKD
and their combining marks are stripped, so `Māhealani` prints as `Mahealani`.
Rendering true Hawaiian orthography requires embedding a Unicode font through
`@pdf-lib/fontkit`, which is not currently a dependency and would require
re-verifying every text measurement in all four builders. That is the correct
long-term fix and is deliberately not attempted the day before launch.

### Truncation now marks the cut

The two unwrapped builders used a bare `slice()`. A realistic team line built
from two registered display names reaches 119 characters, so the 110 cut
amputated `ng $67.89` from the end of a settlement line, and the 105 cut in the
team report clipped the tail off a second player's ACC number, turning
`(HI4820)` into `(HI48`. A shortened ACC number still looks legitimate on a
report whose own footer tells the director to verify awards before submission.

`clip()` sanitizes and appends an ellipsis, so a truncated value is visibly
truncated. This does change the appearance of two official reports.

### Regression test

`tests/pdf-hawaiian-name-encoding.test.mjs` first asserts that the raw names
genuinely do throw, so the rest of the file cannot pass vacuously, then asserts
the sanitized forms survive both measurement and drawing, then pins the call
site in each builder.

## Finding 4: the player who completes a match never sees Confirm

### Observed

`canConfirm` was initialized from server props with `useState`. `router.refresh()`
re-renders the component with fresh props but does not remount it, so the
initializer never ran again and `canConfirm` kept whatever the server said when
the page first loaded.

The player whose submission completes the match is the one this hurts. Their
entry flips the game to `confirmation_pending`, their Confirm button never
appears, and the game cannot reach `verified` until they happen to reload the
page by hand. The status line meanwhile reads "Refreshing the server scorecard
status", which implies the work is already in progress.

This fires on the ordinary path, on every game, with no network fault required.

### Change

The component now adjusts `canConfirm` during render when the server's value
changes. Adjusting during render rather than inside an effect is the pattern
React documents for reacting to a changed prop, and is what
`react-hooks/set-state-in-effect` requires here; the first attempt used an
effect and the repository's lint configuration correctly rejected it.

### Copy corrected in the same file

Two messages said things that were not true.

- "Sync will retry when service returns" promised an automatic retry that does
  not exist. Nothing drains the offline queue on a timer. The only triggers are
  the Sync button, a page reload, and the reconnect handler. The message now
  names the action that actually works.
- The rejected, quarantined and conflict messages said the entry awaited
  official review. For those outcomes the local record is deleted and the server
  retained only a digest and a signature, so no winner or margin survives
  anywhere for anyone to review. The messages now say the entry is gone from the
  device and must be re-entered from the paper card.

### Regression test

`tests/score-entry-confirm-state.test.mjs`. This component previously had no
test of any kind, which is how both defects survived.

## Finding 5: Side Pool operations GET returned 503 to an anonymous caller

The GET handler called `requireTournamentAccess(id)`, a page helper that resolves
an unauthenticated visitor with `redirect()` and an unauthorized one with
`notFound()`. Both signal by throwing. Inside a route handler that throw reached
`withApiFailureBoundary`, which treated it as an unhandled fault and returned
503, so an expired director session read as a backend outage.

The handler now establishes the verified subject first and returns 401, then
reads the role and returns 403 unless it is `director` or `co_director`, then
calls the workspace RPC. This is the ordering the three sibling export routes
already used. The official-only restriction is unchanged.

`src/lib/api/route-boundary.ts` additionally calls `unstable_rethrow(error)`
before the 503 fallback, so framework control flow keeps its meaning in all 105
route handlers.

### The test that guarded this was not actually guarding it

A reviewer demonstrated that the assertion in `tests/game-api-semantics.test.mjs`
passed with the re-throw commented out, because the substring survived inside
the comment, and passed with arbitrary code injected ahead of it, because the
regex allowed anything in between.

That assertion now strips comments and compares the entire catch body. Verified
against both attacks: commenting out the call fails the suite, and injecting a
statement ahead of it fails the suite.

## Finding 6: roster CSV import rejected legacy-shaped tournament ids

Commit `9fc24bd` replaced a strict RFC UUID pattern with one matching what
PostgreSQL's `uuid` type actually accepts, because a canonical 8-4-4-4-12 value
need not carry RFC version and variant bits. It updated `src/lib/api/validation.ts`
and its callers, but missed `src/lib/api/roster.ts`, which defines its own copy.

Both roster CSV routes imported that stale copy, while every sibling roster route
family already imported the fixed one.

`src/lib/api/roster.ts` now imports the shared validator instead of defining its
own, and both routes import `isUuid` from `src/lib/api/validation`.

### How much of this is real, measured rather than assumed

A census of the pilot database:

| Tournament | Id | Strict pattern |
| --- | --- | --- |
| Pilot Tournament | `10000000-0000-0000-0000-000000000001` | rejected |
| October 3 Pilot Tournament | `76e9ee59-...` | accepted |
| Genesis Rehearsal | `257e8c68-...` | accepted |

Twelve further non-RFC ids exist across `events`, `event_participants`,
`canonical_games` and `score_submissions`. Every one of them belongs to
"Pilot Tournament", the hand-seeded fixture. Rows belonging to Genesis Rehearsal
and to the October 3 tournament are RFC-shaped throughout, because they were
created through `gen_random_uuid()`.

So this defect is real and reachable against seeded data, and it does not affect
the October 3 event.

### Thirteen modules still carry the strict pattern

`correction.ts`, `expense.ts`, `payment.ts`, `roster-account-activation.ts`,
`roster-lifecycle.ts`, `seating-workspace.ts`, `seating.ts`,
`offline-account-switch.ts`, `registration-claim-review-workspace.ts`,
`registration-link-token.ts`, `preliminary-standings-contract.ts`,
`roster/workspace.ts`, `roster-account-activation-token.ts`.

These apply the pattern to ids returned by the server, not to the tournament id
from the URL, so they reject a persisted row rather than a request. Given the
census above, they are reachable only for the seeded fixture tournament. They are
deliberately left alone: changing thirteen validation modules the day before
launch is a worse risk than the one they carry. They should be consolidated onto
the shared validator afterwards, and any future tournament seeded by hand with
this id pattern will hit them.

## Finding 7: the repository gate could not run on a Windows checkout

`.gitattributes` declared only `*.pdf binary`. With Git's default
`core.autocrlf=true` on Windows, text files materialize with CRLF, so the
byte-exact migration checksums pinned in
`docs/operations/PILOT_MIGRATION_PACKET_0090_0105.md` cannot match, and a test
that searches for a literal newline cannot match either. Both tests pass on
Linux CI, so the gate was green in CI and red on an unmodified Windows clone.

`.gitattributes` now declares `* text=auto eol=lf` plus explicit binary types.
Stored blobs are already LF, so no file content changes.

**Caveat for anyone who already has a clone.** This fix does not repair an
existing working tree. After pulling it, a checkout that was materialized with
CRLF still holds CRLF, and `git status` reports it clean while the tests keep
failing, because Git does not consider the file modified and so never re-smudges
it. `git checkout -- <file>` is a no-op for the same reason. Force
re-materialization with `git rm -r --cached . && git checkout -- .`, or re-clone.
A fresh clone needs nothing.

## Finding 8: two interactive pages shipped scripts the browser refuses to run

### Observed

The proxy sends `script-src 'self' 'nonce-<fresh>' 'strict-dynamic'` on every
response (`src/proxy.ts:15`). Browsers that honour `strict-dynamic` ignore
`'self'` entirely, so a script tag without that request's nonce does not run.

Next.js can only stamp the nonce onto its bootstrap scripts while rendering per
request. Both of these routes were build-time prerendered, so their HTML was
written once at build and carried no nonce at all:

| Route | Script tags in the built HTML | Carrying a nonce |
| --- | --- | --- |
| `/auth/offline-data-blocked` | 10 | 0 |
| `/register` | 8 | 0 |

The pages still looked correct, because the server-rendered markup was intact.
Only the buttons were dead. On `/auth/offline-data-blocked` that is the entire
purpose of the page: it exists to host the shared-device sign-out control, which
is the documented recovery for a device changing players mid-tournament.

`/register` carried a second, compounding defect. It read its release flag
*before* `await connection()`:

```tsx
if (!publicRegistrationEnabled()) notFound();
await connection();
```

The flag was therefore resolved at build time, with the build's environment, and
the resulting 404 was baked into a prerendered route. Setting
`ACC_PUBLIC_REGISTRATION_V2` in production could never turn public registration
on, because the route no longer consulted anything at request time. The built
page body was the string `ACC Tournament Desk` and nothing else.

### Change

`/auth/offline-data-blocked` now awaits `connection()`, and `/register` awaits it
*before* reading the flag. Both became dynamic (`f`) and left the prerender
manifest, which now holds only `/_global-error`, `/_not-found` and `/icon.svg`,
none of which carries an interactive control.

### Proven against a running server, not the manifest

A production server was started and a real request issued:

| Route | Scripts | Carrying *that request's* nonce |
| --- | --- | --- |
| `/auth/offline-data-blocked` | 10 | 10 |

`/register` returns 503 in that environment because it has no Supabase
credentials, exactly as `/` and `/sign-in` do; `/demo`, which the proxy excludes
from session refresh, returns 200. The 503 is the missing environment variable,
not this change.

### Regression tests

`tests/interactive-pages-are-not-prerendered.test.mjs` pins the ordering in
`/register` and the dynamic render in `/auth/offline-data-blocked`, and fails
first if the CSP stops using `strict-dynamic`, so the reasoning is re-read rather
than the tests quietly relaxed. `tests/workspace.test.mjs` adds a post-build
check that the prerender manifest holds only the three allowed routes; it runs
there because `pnpm verify` orders that file after `pnpm build`.

The pre-existing suite already asserted that `/register` contained both
`await connection()` and the flag check. It passed throughout, because it only
checked that each string appeared. Order was the entire defect.

## Finding 9: an expired session was a dead end, not a sign-in prompt

### Observed

Three helpers disagreed about what a claims error means. A claims error is what a
browser gets when its refresh token is expired or revoked, or when Supabase
cannot be reached.

| Helper | On a claims error | Effect |
| --- | --- | --- |
| `getCurrentSubject` | returns `null` | treated as signed out, correct |
| `requireTournamentAccess` | `notFound()` | a permanent 404 |
| `requireVerifiedSubject` | throws | the API boundary reports 503 |

The 404 was the damaging one. A server render cannot clear the dead cookie, and a
404 page carries no control, so the only escape was knowing to clear site data by
hand. Every tournament page goes through `requireTournamentAccess`.

### Change

`src/lib/auth/require-tournament-access.ts` now redirects a claims error to
sign-in, the same destination as the already-correct missing-subject branch. A
genuine non-membership, meaning an authenticated caller with no role in that
tournament, is still `notFound()`; redirecting there instead would bounce that
visitor between sign-in and the page forever.

The redirect cannot loop: `getCurrentSubject` reports a claims error as signed
out, so `/sign-in` renders its form for a browser holding a broken cookie rather
than redirecting back.

### Regression test

`tests/dead-session-is-recoverable.test.mjs`. Re-introducing `notFound()` fails
two of its four tests by name.

### Not changed

`requireVerifiedSubject` still reports a dead session as 503 across the API
routes that use it. Changing it alters the response of roughly 98 handlers, which
is not a change to make the night before a launch. The page-level fix above is
what a stuck user actually meets first.

## Known and not fixed

These were verified and deliberately left alone. Each has an operator workaround
that works today.

**Offline capability expiry can lock a player out, and destroys their score.**
The capability lasts **18 hours** for singles
(`database/migrations/0122_offline_submission_replay_foundation.sql:108`) and
**20 hours** for team games (`0181:23`, `0189:11`). A device that first prepares
on the morning of a one-day tournament will not reach either limit that day. The
exposure is a device that prepared the evening before, or the second day of a
multi-day event.
An expired capability is re-issued with `status: 'issued'` carrying the old,
already-past expiry rather than a renewal, because the row is immutable and
uniquely keyed on actor, session, game and operation. The replay then rejects it,
the client deletes its only local copy, and retrying repeats the loop.
*Workaround: the player signs out and signs back in on that device.* A new sign-in
produces a new session binding, which inserts a fresh capability row. Fixing this
properly means altering a security-definer function that guards score replay, on
the night before launch, which is a worse risk than the workaround.

**A queued score created during the current session does not drain on reconnect.**
The reconnect handler reads a variable that is only populated for a record that
already existed when the component mounted. A score queued after a mid-round
connection drop therefore waits for a manual Sync tap or a page reload.
*Workaround: tap Sync Saved Entry.* The copy now says so.

**A failed capability provision while online shows a misleading message.** The
mount effect only reports a failure when the browser is offline, so a player who
is not checked in, or who hits a transient 503, is told to reconnect while
already connected. *Workaround: the director checks the player in and the player
reloads.*

**Public event check-in has no rate limit and its completion sessions are not
single-use.** One photographed QR code, valid for 60 seconds, can mint unlimited
completion sessions, each replayable for its full five-minute life, each
inserting an unconstrained `pending_desk` row. This is desk-queue spam, not a
money or data-integrity problem, and it needs someone physically present with a
photograph of a live code.

## Visual pass

A separate conservative pass over layout and control placement, at desktop, iPad
and phone widths. The brief was to make the interface make sense, not to restyle
it, so every change below is either a disabled state that was invisible, a text
input small enough to trigger iOS zoom, or a label that read as a control but was
not one.

### Applied

| Change | Reason |
| --- | --- |
| `.primary:disabled` now has its own background and `cursor: not-allowed` | a disabled primary button was visually identical to an enabled one |
| `.option-grid button:disabled` given the same treatment | same, on the option grids |
| `.live-matchup` given a full CSS block | it had **no CSS at all**, so the signed-in score screen ran its matchup text together on one line |
| `.matchup strong em` and `.live-matchup strong em` separated | the two names ran together |
| `font-size: 16px` on seating, search and setup-grid inputs | below 16px, iOS Safari zooms the page on focus and does not zoom back |
| `.shared-device-sign-out .error-text` spacing and colour | the error sat flush against the button |
| `.scorecard-frame .table-scroll` no longer clips or captures touch | the scorecard could not be scrolled past its own frame on a phone |
| Seating tile now reads `N of M seats assigned` | it previously read `N assigned - M seats available`, two numbers in different units |
| Cross Check tile action now says `Open Scorecard` and actually opens it | the button was labelled `Open Selected Card` and did nothing |
| Ten dead verbs removed from list rows | `Details`, `Configure`, `Open`, `Open cached rulebook` rendered as plain bold text in the third column with no handler; on a phone the row collapses to one column, putting a fake action at the bottom of every card |

The Judge Desk row at `tournament-dashboard.tsx:98` carries the same dead-verb
pattern and was deliberately left alone, because its tile is hard disabled and
the screen is unreachable. Changing it would have been a change with no observer.

### Caveat, and what to check after deploy

`.live-matchup` is net-new CSS on the live score screen. That screen requires an
authenticated session against a configured Supabase project, which this review
did not have, so the block was written against the markup rather than confirmed
against a screenshot of the rendered screen. It is additive, and removing it
returns the screen to the unstyled run-on text it had before, but it is the one
visual change here that has not been seen rendered.

**Check this first after deploying: open a live game's score screen on a phone
and confirm the matchup line reads as two separate names.**

## Verification

Environment: Windows 11, pnpm 11.19.0. The suite was run on both Node 22.14.0
(the corepack default on this machine) and Node 24.15.0, which is what `engines`
pins. 577 of 577 passed on each.

| Gate step | Result |
| --- | --- |
| `pnpm audit --prod --audit-level=high` | Passed, no known vulnerabilities |
| `pnpm lint` | Passed |
| `pnpm test` | Passed, 577 of 577, up from 554 |
| `pnpm build` | Compiled successfully |

Every regression test added here was verified fail-closed: the defect was
re-introduced, the test was confirmed to fail and to name the specific location,
and the fix was restored. A test that has never been seen to fail is not
evidence.

## Limitations

- Migration 0215 has not been applied to any database holding the target tables.
  Until it is, the pilot database still allows any signed-in user to write a team
  side-pool election.
- The authenticated browser sweep is incomplete. It ran against a local dev
  server without `SUPABASE_SECRET_KEY`, so every route using the server-only
  admin client threw a configuration error rather than rendering. Those results
  measure the missing environment variable, not the application. The dev server
  was also recompiling while source files changed during the sweep, so any
  mid-run error should be checked against edit timestamps before being believed.
- No authenticated page or API handler is covered by any automated browser gate.
  The existing `verify:live-demo` gate covers the sample-only `/demo` surface,
  which is one client-side page. This remains the largest verification gap before
  the pilot.
- Findings 2 and 6 were confirmed by reading the pilot database directly. The
  rest were confirmed against the repository and, where possible, by executing
  the failing behaviour.
