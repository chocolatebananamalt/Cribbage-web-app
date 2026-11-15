# Player-Visible Running Pool Totals — Local Implementation

Implements the requested signed-in player view instead of exposing the private
Director totals page. All gates remain false. SQL is unexecuted, new tables/RPCs
are revoked, and no hosted visibility or access has changed.

## Player Experience and Privacy

`/tournament/[tournamentId]/pool-entries` supports authorized event selection and
Refresh. It shows pool label, entry fee, active **pool entry** count, recorded
eligible pool total and an explicitly estimated total if those pool entrants pay.
The estimate denominator is pool entrants, not every participant in the event.
Unavailable/stale data stays unavailable, never zero. Counts exclude withdrawn
or duplicate entries through the reused authoritative aggregate adapter.

The player DTO omits member lists, names, account/ACC/participant IDs, receipts,
allocations, consent/review notes, policy IDs, paid/eligible/partial/unknown-payment
counts, held-money breakdowns and private source context. There is no award
calculation, bank confirmation or payment action. Fee plus eligible fund can
still imply a paid-entry count; this inherent aggregate inference is explicitly
disclosed in the Director opt-in rather than claimed to be concealed.

Audience is the existing signed-in ordinary Results audience: players, viewers,
cross-checkers, Directors and Co-directors. Existing multi-role players remain
eligible even when their primary role is Judge. Anonymous/pre-check-in access is
not silently added. The page never exposes the private workspace RPCs to players.

## Revocable Event Visibility

`/tournament/[tournamentId]/pool-visibility` and the private
`/api/v1/tournaments/[id]/player-pool-visibility/[eventId]` let the primary Director
enable or hide this aggregate for an event. Visibility versions, reason and audit
are append-only. There is no per-payment republish requirement: every player read
rebuilds current aggregates while the event-level visibility permission remains
valid. Hide withdraws future reads and never deletes pool records.

The controller retains the exact request before a separate Send. Loss, rejection,
unknown outcome, corrupt bytes and changed identity preserve pending work. Exact
accepted receipts alone permit compare-and-swap archive. A separate explicit
Resolve Superseded Request action can obtain an immutable no-write closure for
a request whose expected version is no longer current. Closure uses the same
nonce/tournament locks as writes and permanently fences delayed execution. It
preserves the old raw request in history, then allows a fresh Hide. Bare errors or
unknown responses never become cleanup authority.

## Authoritative Source Boundary

The SQL service-only model adapter derives its source publisher from the latest
enabled immutable visibility version. That actor must still be the actual primary
Director; the viewer must still have an effective existing Results role, and the
exact event must be active/activated. This is explicit aggregate-processing
delegation, not a caller-supplied publisher, forged session or JWT change.

Private Q/Side source models stay inside the trusted server. Q is excluded when
its membership event differs; Side models are limited to the selected event's
current active definitions, with unresolved definition versions held. The actual
viewer session supplies its already-authorized activity model. Two complete
captures must match, including event, viewer, visibility revision/version,
publisher, projection version and source facts. Withdrawal, role loss, drift or
uncertainty yields no player DTO. Normal-session identity/roles are checked before,
between and after reads. No-store/dynamic pages do not claim atomic or continuous
live balances; the observed timestamp and explicit refresh remain visible.

## Focused Evidence

- Nine Node checks passed across minimal DTO/privacy, pool-entry denominator,
  stale/unknown states, multi-role audience, scope/source/visibility drift,
  primary-Director authoring, exact recovery, durable stale closure and fresh Hide.
- TypeScript `--noEmit` and changed-file ESLint passed.
- Independent plan/source review approved the scoped delegation. Review found
  the stale pending Hide deadlock; the durable closure correction was reviewed
  with no remaining concrete P1/P2 in that delta.
- Offline actual React checks at 390 and 1440 pixels passed: minimal aggregate,
  unknown-not-zero, visibility lost-reply recovery, stale closure/history,
  fresh Hide, and identity concealment. Network requests: zero.
- Evidence: `test-results/player-pool-browser-20261110/result.json` and
  `player-390.png` / `player-1440.png`.

## Remaining Gates

SQL compilation, populated database/ACL/race/rollback tests, actual signed-in
viewer/Director/provider acceptance, real IndexedDB reload/concurrency, and the
separate release/grant approval remain pending. Browser tests use fictional
identity/provider and in-memory storage. They do not prove a real withdrawal or
database transaction. Existing pool-source format limits remain intact; unsupported
events or sources are held rather than inferred. Previously viewed snapshots
cannot be made unseen; withdrawal governs subsequent reads, not live push erasure.

No hosted read/write, fixture creation, new credential, executed grant, app
publication, payment, external image transmission or denied-operation retry.
No broad suite or full build was run.
