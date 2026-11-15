# Tournament setup schema foundation — pilot evidence

Date: 2026-09-09
Environment: connected Supabase pilot `fnjkwymxpnsqvxtpronk`; local Node 24 / pnpm workspace.

## Scope

This increment creates the private immutable storage foundation and one
director/co-director-authorized, draft-only save RPC. It contains no reader,
route, UI, operational-event mapping, flyer, scoring, finance, results, export,
or ACC portal behavior.

## Acceptance criteria

1. Setup revisions, officials, configured events, Q-pool descriptors, and
   changed-retry conflict evidence are private and immutable.
2. They cannot directly create or reference operational scoring events.
3. Setup revision receipt provenance binds tournament and actor, event/Q-pool
   fees are required nonnegative cents, and a deferred official-set check rejects
   zero or invalid official lists at transaction end.
4. Q-pools are limited to slots 1–2 and only Main/Consolation setup rows.
5. A current director/co-director can atomically save an immutable version only
   before seating, rounds, gameplay, or non-draft publication state; exact
   retries replay, changed retries become immutable conflicts, and stale
   versions reject without creating operational data.

## Independent review and repairs

- Sol reviewed the initial schema and found two P1 issues: missing
  receipt-actor provenance and invalid immutable official/fee shapes. The
  migration now uses receipt actor/tournament composite foreign keys, required
  fee cents, and deferred official-set validation.
- Re-review found a final P1: a revision with no officials bypassed the child
  trigger. A deferred revision-level trigger now calls the same final-set helper.
- Final Sol re-review found no remaining P0/P1.
- Sol's writer review caught a missing distinct `qualification_note` field and
  required a locked, expected-version writer boundary. Migration `0052` adds
  that immutable field and the authenticated-only `save_tournament_setup_version`
  RPC. It validates an allowlisted typed JSON payload, current official roles,
  local timestamps/IANA timezones, bounded cents and notes, event/Q-pool shape,
  and draft lifecycle. It locks the tournament and operational event parents,
  has a canonical request hash and actor/key advisory lock, writes one receipt
  plus audit event atomically, and never inserts or updates operational tables.

## Executed checks

| Check | Result |
| --- | --- |
| `pnpm test` | Pass — 53 tests, 0 failures |
| `pnpm lint` | Pass |
| `git diff --check` | Pass; Git emitted only existing LF-to-CRLF working-copy warnings |
| Pilot migration `tournament_setup_draft_boundary` | Applied successfully |
| Pilot table catalog | All five new tables have RLS and forced RLS; neither `anon` nor `authenticated` has direct data access |
| Security advisor | New private no-policy notices are expected because direct grants are revoked; no new anonymous executable function was introduced |
| All-rollback database constraint probe | Pass — a valid director revision survived deferred validation and a zero-official revision raised `invalid setup official count`; no test data was retained |
| Pilot migration `tournament_setup_save_rpc` | Applied successfully after a first parse-only rejection identified and corrected an invalid PL/pgSQL exception layout; no partial migration was applied on that failed attempt |
| All-rollback authenticated-director save | Pass — one revision, official, configured event, Q-pool, receipt, and audit persisted inside the transaction; zero operational events, rounds, or games were created |
| All-rollback replay/conflict/stale probe | Pass — exact retry created no second revision/receipt, changed same-key retry created one immutable conflict, and stale expected version created one rejected receipt/audit; zero operational events were created |
| Writer grants/catalog | Pass — `SECURITY DEFINER`; executable by `authenticated` only; neither `public` nor `anon` can execute; all five setup tables remain forced-RLS with no direct anonymous/authenticated SELECT |

## Attempted transactional proof and limitation

The pilot reports one tournament but **zero** current director-role fixtures.
To avoid creating a real user or persisting a role, the probe temporarily added
the existing synthetic tournament director's role inside one transaction,
executed `SET CONSTRAINTS ALL IMMEDIATE`, verified a valid revision plus the
zero-official rejection, and rolled the entire transaction back.

This proves migration compilation/application, deferred official-set behavior,
and the writer's controlled director claim path in rollback-only database
fixtures. It does not prove a real independent co-director session, role
revocation race, DST-fold policy, concurrent writers under independent
connections, or a user-facing reader/UI. Those remain release evidence gates.
