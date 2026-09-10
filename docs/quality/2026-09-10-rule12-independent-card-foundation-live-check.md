# Rule 12.2 independent-card foundation live check — 2026-09-10

## Purpose

Rule 12.2(b) requires a result that a shared reciprocal match-score model
cannot express: two apparent qualifiers may retain original claims of a
17-point win and a 16-point loss, while the respective corrected card values
become a 16-point win and a 17-point loss. This check exercised the private,
inert replacement foundation in the separate synthetic validation database.
It did not touch the shared pilot, production deployment, or any real player
data.

## Acceptance criteria

1. A correction can retain two different original card claims while linking
   each claim to the correct canonical game/card identity.
2. The Rule 12.2(b) corrected card values can be independently represented
   without forcing them to be reciprocal.
3. A malformed original card claim is rejected by the database.
4. The deferred correction-pair invariant accepts exactly two distinct card
   sides, and no temporary fixture or callable authenticated surface remains.

## Executed evidence

The synthetic database already contained a verified, two-card Standard
Singles fixture. In one explicit transaction, the check inserted an inert
`12.2b` correction case and two private projections, forced all deferred
constraints, read the projections, and rolled the transaction back.

| Card side | Original claim | Adjudicated card value |
| --- | --- | --- |
| A | 17-point win, 2 game points | 16-point win, 2 game points |
| B | 16-point loss, 0 game points | 17-point loss, 0 game points |

The database accepted that non-reciprocal pair. A separate disposable attempt
to state a 17-point winning original claim with only 16 plus points failed at
the projection trigger with `correction original claim is internally
inconsistent`. A post-check catalog query found zero rows for either fixture
identifier and zero `authenticated` execute privileges on the three private
assertion functions.

## Foundation repairs included

Migrations `0100`–`0102` add and repair only private enforcement:

- serial next-sequence and base-game-version checks under the canonical-game
  row lock;
- scope/card-side checks against the canonical scoreline identity;
- internally consistent original and adjudicated per-card claims;
- a deferred, exactly-two-distinct-sides requirement; and
- a trigger-context repair for the two tables' different `NEW` record shapes.

Migration `0101` deliberately renames the identity-link field to
`canonical_scoreline_id`. It does **not** require the original card claim to
equal the pre-existing canonical scoreline; doing so would erase the very
Rule 12.2(b) and (h) evidence the model must preserve.

## Limits and release boundary

This is an integrity foundation, not correction functionality. There is still
no correction writer, reader, lifecycle transition, total/standing projection,
qualification notification, export revision, browser workflow, or release
flag. All Rule 12.2(a)–(i) executable fixtures and the broader exit criteria
in `docs/decisions/2026-09-10-rule12-independent-card-corrections.md` remain
required before the suspended correction feature can be reconsidered.
