# Event settings transaction and separate Finance — local candidate

## What changed

The V3 envelope nests the exact existing V2 setup request and adds an explicit
choice for every Main/Consolation. Configured settings retain raw, potentially
incomplete draft inputs. Preserve Historical carries an existing configured
snapshot; it never silently resets one to legacy. If no configured snapshot
exists, existing declaration checks remain required. Empty event saves remain
explicitly representable. No historical record is rewritten.

Recovery binds actor, operation, full source base, all unchanged setup fields and
every new raw setting. V3 has its own acknowledgement; a successful older save
cannot acknowledge new fields it never persisted. A saved acknowledgement is
historical evidence, not proof that the revision is still current.

`database/proposals/event-settings-transaction-v3.sql` is an UNEXECUTED private
candidate, not a migration. It reserves the full V3 envelope under the same
actor/operation and tournament locks as the existing private Q writer, delegates
the guarded core+Q transaction, then stores effective settings and outcome in
the same rollback scope. Errors after the nested core must undo all nested
receipts/revisions/journals. Old writers cannot silently drop configured settings.
No new EXECUTE grants, endpoint or capability switch is included.

## Activation and compatibility gate

Activation remains explicitly blocked in the pure assessment. It must reread
the current setup, effective settings, declaration/disclosure/review and Finance
sources under one guarded transaction. Source fingerprints must include both
effective settings and their provenance. Existing declaration acceptance must
not be reinterpreted as approval of a new factor or series.

Do not apply the SQL proposal as a standalone release: existing public activation
writers do not yet enforce this new contract. Older amendments/contact-copy
paths need verified carry behavior. The carry guard can reject those paths until
they are upgraded; that is a compatibility limitation, not a completed feature.
The user-facing section remains unwired until save/read/reconcile/activation and
historical fallback all work together.

Qualification stays separate: sanctioned fractional quarters round up; custom
regular payout choices determine only paid finishing places. Pending decisions:
ratio population/paid-count rounding, cuts inside equal knockout finishing bands,
awards beyond qualifiers and Satellite distribution. No new ACC min/max is
inferred. Separate semifinal series still inherit the regular format.

## Separate Finance model

The pure model accepts explicit gross-entry income rather than pretending
everyone paid the advertised fee. Fund = gross − player benefits − operating
expenses + unrestricted additional income. Each event/source snapshot and mode
(estimate, documented actual, simulation) remains separate. Append-only line
corrections/voids retain stable identity and require reasons.

Q and Side funds are excluded; their funding bucket cannot change through a
correction, void or reopening. Restricted/unclassified income blocks until an
explicit reviewed classification is supplied. Classification input itself is not
proof of an authorized review: a future server ledger reader must enforce that.
The model does not infer that two different lines represent different real-world
receipts; deduplication/evidence links belong to the future authoritative ledger.
The 10,000-record processing bound is technical, not a business category limit;
large complete histories need a verified paginated/compacted source contract.

This is not a Finance UI, ledger writer, payout approval or disbursement record.
Spreadsheet overrides remain proposals; total conservation and equal-place
checks do not prove payment. Optional pools never fund ordinary expenses here.

## Exact runtime acceptance needed (not executed)

One separately authorized disposable local database is needed for both private
V2 dependencies and this V3 proposal. No container/fixture/SQL was run now.
Acceptance must cover actual roles/ACL, cross-event/tournament FKs, retained
incomplete drafts, exact receipt/readback/reconcile, old-op collision, stale base,
concurrent actor/op/tournament/role locks, injected post-core and post-snapshot
failure, replay after lost response, carry and intentional empty clear, historical
declarations unchanged, and legacy writer rejection. Source inspection and pure
tests are not substitute evidence for PostgreSQL parsing or transaction behavior.

After those tests: implement reviewed activation and public transport/UI, then
separately authorize provider acceptance and a staging rollout with recovery.
No hosted changes, publication or actual funds are authorized here.

## Subsequent approved bounded runtime evidence

ONE disposable local database was separately authorized and completed private
Q/settings/Finance draft save/retry/rollback checks, then was removed. The earlier
UNEXECUTED wording records the proposal's initial state. Current exact coverage
and exclusions are in `../quality/2026-11-04-settings-finance-disposable-db.md`.
V3-specific ACL and direct old-writer carry-trigger runtime checks remain open;
normal carried snapshots, rollback and contention were tested. No public
activation/provider/actual-ledger readiness is implied. Whole-group payout cutoff
has now been approved: Top6 includes all5th–8th (8 paid), with requested/actual
count/reason warning separately from balance. Ratio population/rounding and
beyond-qualifier/Satellite policies remain unresolved.
