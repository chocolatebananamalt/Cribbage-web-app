# Setup-based official management, time zones, and fee controls

**Date:** 2026-09-17

## Decision

Tournament Setup is the primary director's one-stop configuration surface. It
requires a State/Territory and matching DST-aware IANA time zone, uses local
start/end inputs while retaining UTC storage, and condenses ordinary setup
details after finalization.

The Setup page owns compact Co-Director, Cross-Checker, and Judge summaries.
Each role has a focused Add/Remove page, a separate 0–12 pending/active cap,
and required First name, Last name, exact Email, and ACC #. A nomination is
pre-approval only. It grants no tournament role until the exact email address
successfully completes secure sign-in. Invitations expire at midnight after the
configured local tournament end date. The normal manager is the primary
director. A platform administrator has a server-only emergency path requiring
an immutable written reason.

The former separate Officials and Cross-checker Assignments workspace entries
are retired. Existing bookmarked links redirect into the equivalent Setup
management page.

The ACC sanctioning display is one panel: the read-only Main and Consolation
rates sit beside one calculated running total. A director deliberately opens a
single rate adjustment, supplies `Reason (*required)`, and saves that one rate.
The audit reference is system-recorded as `ACC Board approval — director
attested`; the app no longer asks the director to type a duplicate source field.
There is no periodic polling: Setup loads the count once and offers an explicit
refresh.

## Consequences

- Existing official role history is preserved. Older assignments without the
  newly required identity fields remain identifiable as historic records rather
  than being fabricated or deleted.
- Removing an official revokes the corresponding `tournament_roles` row
  immediately but retains nomination, receipt, and audit history.
- A person can acquire more than one role after accepting each assignment;
  capability-aware UI exposes the combined role set without weakening conflict
  guards used by scoring and review.
- Older legacy setup revisions with no safely inferred State/Territory remain
  readable. They must be corrected and saved before finalization.
- The migration deliberately does not infer or backfill a location from city,
  venue, or the former IANA zone. Existing setup revisions are immutable
  history; a director chooses State/Territory in a new revision.

## Non-goals

- No external ACC membership verification is claimed.
- Official nomination does not register anyone as a player or event entrant.
- No SMTP provider/domain configuration or live bulk-delivery claim is added.
- No public browser path can query the nomination table or receive authority
  without exact-email authentication.
