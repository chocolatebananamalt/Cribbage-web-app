# Tournament setup schema foundation — pilot evidence

Date: 2026-09-09
Environment: connected Supabase pilot `fnjkwymxpnsqvxtpronk`; local Node 24 / pnpm workspace.

## Scope

This increment creates only the private immutable storage foundation for future
director-authorized tournament setup drafts. It contains no reader/writer RPC,
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

## Independent review and repairs

- Sol reviewed the initial schema and found two P1 issues: missing
  receipt-actor provenance and invalid immutable official/fee shapes. The
  migration now uses receipt actor/tournament composite foreign keys, required
  fee cents, and deferred official-set validation.
- Re-review found a final P1: a revision with no officials bypassed the child
  trigger. A deferred revision-level trigger now calls the same final-set helper.
- Final Sol re-review found no remaining P0/P1.

## Executed checks

| Check | Result |
| --- | --- |
| `pnpm test` | Pass — 52 tests, 0 failures |
| `pnpm lint` | Pass |
| `git diff --check` | Pass; Git emitted only existing LF-to-CRLF working-copy warnings |
| Pilot migration `tournament_setup_draft_boundary` | Applied successfully |
| Pilot table catalog | All five new tables have RLS and forced RLS; neither `anon` nor `authenticated` has direct data access |
| Security advisor | New private no-policy notices are expected because direct grants are revoked; no new anonymous executable function was introduced |
| All-rollback database constraint probe | Pass — a valid director revision survived deferred validation and a zero-official revision raised `invalid setup official count`; no test data was retained |

## Attempted transactional proof and limitation

The pilot reports one tournament but **zero** current director-role fixtures.
To avoid creating a real user or persisting a role, the probe temporarily added
the existing synthetic tournament director's role inside one transaction,
executed `SET CONSTRAINTS ALL IMMEDIATE`, verified a valid revision plus the
zero-official rejection, and rolled the entire transaction back.

This proves migration compilation/application and the deferred official-set
accept/reject behavior. It does not prove the future authenticated writer,
composite-provenance rejection, idempotency/retry behavior, co-director access,
or real independent sessions. Those require a documented disposable-auth test
harness before release.
