# Paper-versus-paper authoritative completion

**Status:** Implemented locally; migration 0144 and real-session proof pending

For the October Standard Singles pilot, roster-backed paper players do not need
app accounts. An eligible tournament cross checker records both original paper
scorecards, but that first record remains pending and non-authoritative.
Each card receives its own immutable evidence row, permanent verification-ID
snapshot, claimed winner/spread, and server-derived 0/2/3 and plus/minus values.

The server accepts only matching reciprocal claims with a 1–121 spread. A
second distinct cross checker, co-director, or director must independently
re-enter the exact claims and references before approval creates scorelines.
It locks the event and game, checks the expected game version and current role,
requires a latest-effective director-confirmed identity binding for each official,
rejects either official bound to either player's roster entry, and rejects games
that already contain digital submissions, confirmations, scorelines, approved
recovery, or another active paper completion. Identity corrections supersede
prior immutable versions with exact expected-version and idempotency checks;
a director or co-director cannot confirm their own identity. A rejected paper
case remains immutable but no longer bricks the game, so a new sequenced case
can be opened. Paper cases and device-recovery cases are mutually exclusive
under one game-scoped lock, and only games in a published schedule are eligible.
Approved second-official reviews create
the ordinary two authoritative card scorelines and therefore enter scorecards,
standings, and qualification without a second calculation path. They do not
fabricate player submissions or confirmations.

Identity and replay hardening is part of the same boundary. A nonparticipant
official cannot be confirmed if that profile is already linked through any
tournament roster-account link or event participant. Matching triggers acquire
the same profile-scoped lock and prevent a later roster/enrollment write from
racing a current nonparticipant binding. Review approval locks both officials'
latest bindings in deterministic order and requires the first official's stored
binding to remain current and independent; a corrected first identity blocks
approval but still permits a second official to reject and close the stale case.

All three browser operations authorize the current actor and validate current
identity before replaying an exact receipt. The tournament-open lifecycle gate
applies only to a genuinely new operation, so a response lost during a successful
request can still be recovered after the tournament closes. A service-only,
actor/tournament/operation/target-scoped reconciliation reader lets the browser
clear saved completion, review, and identity envelopes even after the completed
item disappears from the live workspace; it returns no private evidence.

The UI intentionally requires two human-entered paper-card references. OCR,
image upload, payout, Q-pool, MRP, and mismatch adjudication are outside this
slice. Mismatched paper cards remain unresolved for the dispute/correction
workflow.
