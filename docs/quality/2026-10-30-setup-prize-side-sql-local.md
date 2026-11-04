# Local setup / Side prize declaration SQL repair

Scope: local migration 0268 and new disposable SQL acceptance only. No hosted
service, existing fixture, security setting, credential, commit, push or deployment
was changed by this worker. UI changes and aggregate verification belong to the
parent integration task. Independent high-risk review remains required.

Acceptance: the normal public setup writer plus its existing Side configuration
RPC persists base 3000, Q 1000 and Side 1000 before any activation. An explicit
reviewed V3 regular prize declaration saves and binds at first supported paid
activation. Fictional Q/base and Side receipts retain those separate amounts.
Missing, stale or legacy declarations fail new paid activation atomically; a
genuinely free fee-zero event still activates. Replays, existing history,
authorization, unsupported-scope rejection, precollection closure and actual
independent-session lock behavior are preserved.

Migration 0268 is 5,656 bytes; SHA256
`0337C8A6E6C0E837A0D95FA39FD458EFC8D9A2C66DE40F2B6FCC024EA6FC712C`.
It changes five existing functions only:

- `public.save_setup_prize_schedule_v1`: permit Side count 0–6 in the existing
  positive-fee single Standard Singles Main / twelve-game / Q count 0–2 scope;
  extend existing collection/election closure to Side declarations and histories.
- `app.setup_prize_schedule_workspace_v1`: matching Side eligibility and positive
  fee check for a new declaration.
- `app.bind_prize_schedule_on_activation_v1`: require a current valid V3 and
  current settings fingerprint for a tournament's first activation in that scope.
  Scope uses the activating revision's counts, so stale/missing latest settings
  cannot silently remove the requirement. Later historical replacement and free
  event paths retain existing semantics. No retroactive binding or update occurs.
- `public.set_event_side_pool_election_v1` and
  `public.set_event_side_pool_team_election_v1`: guarded insertion of the tournament
  row lock before the existing role lock. The graduated writer already uses that
  order. This prevents precollection races without adding a late trigger that
  would reverse the lock order.

No new tables, RPC signatures, human grants, policy changes or data rewrites.
Guarded patch anchors abort if the reviewed baseline definitions have drifted.

Commands: `node --check` for all three new `.mjs` files and
`node --experimental-strip-types tests/run-setup-prize-side-container.mjs`.
The runner verifies the empty post-0236 baseline hash, restores it, applies
0237–0267, creates a pre-0268 public legacy activation, records protected history
fingerprints and five function OID/ACL values, applies 0268, compares preservation,
then runs public RPC acceptance. Existing synthetic runners remain at 0267.

Environment: Node 24.19.0; Docker Desktop context `desktop-linux`; reviewed image
`sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706`;
exact task name `cribbage-setup-prize-local`; unprivileged postgres user;
network none, no ports or mounts, all capabilities dropped, no-new-privileges.
Each run drops its exact task database and removes/verifies absence of its exact
task-created container. The runner refuses an existing same-name resource.

Evidence is in `test-results/setup-prize-side-sql.log`,
`test-results/setup-prize-side-sql-result.json`, and the matching
`setup-prize-side-container-identity.json` / `setup-prize-side-container-cleanup.json`.
The original frozen expanded run exited zero and passed nine groups, including real
Q/base allocation, Side receipts, both observed locks, and the public historical
replacement RPC preserving a nonV3 declaration and the original binding history.
Final exact container
`fce4317b7861109672f2d8e3eac400bd7a43ece2ecad7174743d5b6f8876cc5f`
was removed and its absence verified. The database was dropped in the runner's
finally block before container cleanup. All three new runner/acceptance files
passed `node --check`.

Harness corrections during development: initial manual container startup as root
exited and was reconciled/removed; the reviewed unprivileged orchestrator replaced
it. Early acceptance attempts rejected malformed new test payloads (venue
projection, sidePools transport adapter), incorrect test status labels, a missing
session actor claim and a Q membership created before event participation. These
were fixture defects; no production validation was weakened to accept them.

Limits: synthetic local receipts represent no actual money. This bounded setup
proof does not certify hosted rollout, physical tournament operations, payout
finalization, or unrelated team financial behavior. Aggregate `pnpm verify`,
handoff verification, UI/browser acceptance and independent review are parent
integration gates, not claimed by this SQL-only worker.

## Exact intended 17-player finance scenarios

The acceptance now adds two separate fresh tournaments using the public setup
save/configure, V3 declaration, activation/materialization and money writers.
Their fictional roster and participant identities use the existing seventeen-Main
foundation's direct seed pattern; no setup, policy, election, allocation or
payment evidence is seeded directly. Both assert persisted fees and the current
V3 binding before any payment, election or scheduled game, plus exactly seventeen
roster entries and seventeen event participants.

- No Q / no Side: base fee 3000, seventeen public roster obligations and receipts
  of 3000 each, total 51000; zero Q/Side records and zero scheduled games.
- Q plus Side: base 3000, Q 1000 and Side 1000; selected Q policy
  `acc-weighted-largest-remainder-5usd-v1` with ratio 6 and matching schedule ID;
  selected Side amount policy `graduated-acc-weighted-largest-remainder-5usd-v2`
  with ratio 6, plus `paid-qualifying-cards-no-cutoff-v3` recipient policy, all
  saved before collection. Seventeen explicit public Q memberships, obligations
  and receipts of 4000 each total 68000. Seventeen public allocations separate
  base 51000 from Q 17000. Seventeen public graduated Side elections each receive
  exactly 1000, independently totaling 17000. Combined receipts total 85000,
  with zero scoring records and no actual money.

Migration 0268 remains unchanged at the recorded hash. The new frozen run's
result JSON includes exact per-scenario fees, counts, fund totals and event IDs.

The expanded frozen run exited zero and passed all eleven groups. The two exact
scenario result rows confirm 17/17 roster/participant counts, 17 receipts in each
case, No-Q total 51000, combined roster receipts 68000, 17 Q allocations with base
51000/Q17000, 17 Side election receipts totaling17000, combined total85000, and
zero scheduled games in both cases. Both new Side policies and the selected Q
policy were accepted before collection; no fallback to an Equal policy occurred.

Final acceptance file SHA256:
`4C27C4ADB0AD67A1CE77E8B14F8526007352DF7B94350B263318DC199393DB60`.
The exact task container
`32bca434fe4cdfba06e33818a7573a53ac971b548766389efda19fcb35ad56fb`
and its database were removed, with container absence verified by the
orchestrator. No hosted or actual financial action occurred.
