# Private native prize estimate and manual proposal history

No hosted records, settings, grants, credentials or public source were changed.
Daron's saved draft and all real historical records remain untouched. This is
not a release, final-award writer, disbursement or completed mixed rehearsal.

## Native source wiring

`database/proposals/playoff-prize-native-source-v2.sql` adds one private,
default-disabled getter and flag. It verifies its own `auth.uid()` and current
Director/co-director role, locks existing native sources, and joins the actual
active event/catalog ruleset, activation, setup row, configured settings and
immutable V2 prize pin/current head. The settings save hash comes from its
reservation; it is not the different activation digest. Current native ledger
and qualification pointers must match their actual source proof.

The complete allocation snapshot is returned, including all physical receipt
partitions. The existing projector selects the event; filtering first would
break cross-event receipt conservation. The server-only decoder independently
requires documented-native mode and only supported regular receipts/costs.
Optional allocations, simulation and additional-income data are not silently
accepted as this native contract. Read composition checks the official's
identity and role before and after the private read. All grants remain revoked;
there is no public wrapper, page or enabled provider composition.

Coverage stays explicitly incomplete: sanctioning coverage and fund review are
unverified; additional-income and optional-pool integration remain unsupported.
The old operational Finance, playoff and finalization guards are unchanged.

## Actual local PostgreSQL proof

`tests/run-prize-native-local-v2.mjs` uses the pinned local image, verified empty
baseline, migrations through 0292, exact closed preparation package and private
prize candidates in a network-none disposable fixture. No host mount, published
port, real person, hosted account, actual payment or bank proof exists.

The successful run passed **37 recorded checks**. It includes the earlier
transaction/registration/rollback/retry/role/history suite, plus closed getter
grants, outsider rejection, real native allocation gates, lost-head rejection
and ordinary-writer contention. The producer seeds fictional registration
foundations, then uses supported obligations, manual receipts, account linking,
attendance, seating, schedule, normal Start, two own submissions and two own
confirmations for each of **108 games**, and actual qualification finalization.
It proves 18 participants, 432 score actions, five qualifiers and current
qualification evidence before calling the actual new getter and decoder.
Synthetic JWT claims/fixture-owner calls are not real provider sessions.

The actual capture calculates a regular fund of **$841**: $900 receipts, $5
operating expense and the separately recorded $54 sanctioning expense. The
saved Graduated/all/factor-1.5/$5 plan proposes **$835**, leaving **$6** visibly
unallocated. The source still marks coverage unverified; the fixture's known
costs are not a general native fund-review implementation. No final awards were
recorded. Consolation and Satellite exist but are not claimed as funded/played.

Machine evidence:
`test-results/prize-native-local-v2-20261108/result.json`, `passed:true`,
`cleaned:true`, container
`1c74643be6f1b3e19287def5f81b4f61963536edb899552dd7d12ec026fadc2c`.
The volume and container were verified absent. The nested `nativeRead` result
records the *pre-qualification* rejection stage; the later `qualified` result
and `native-qualified-v2-positive.json` prove the positive stage.

Earlier failed fixtures were removed. Two exclusive-lock probes timed out
before the scoring stage. A bounded cold-rowtype experiment produced a
statement timeout rather than the function-body NOWAIT response. PostgreSQL's
[PL/pgSQL compiler](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/pl/plpgsql/src/pl_comp.c#L2004-L2009)
loads composite metadata through the
[type cache](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/utils/cache/typcache.c#L808-L837),
which can request AccessShare before the body. The ordinary-writer test uses
ROW EXCLUSIVE, compatible with metadata reads but conflicting with the getter's
SHARE NOWAIT; it returned exact retry/source_busy. No application guard was
weakened to hide the separate DDL/cold-compilation limitation. A later fixture
failed because the test callback passed an actor ID as a database-name argument;
the wrapper was corrected before the successful run.

## Manual proposal history and review

The new V2 pure module retains exact source/input and reasoned, append-only
whole-band history, including explicit zero, latest-prior correction, void and
reopen. A source change rejects rather than rebases. Balance, selected-method
changes, unequal Equal-method treatment, rank order and adjusted first-round
intention checks are separate. Local records do not prove a server actor/time.

The controlled review component is explicitly **Not Saved**, has no storage or
write port, and preserves invalid/unfinished text. Held handlers compare both
latest local edits and retained props. Source changes that remove a group keep
its old editor locked for review; malformed/accessor props cannot execute
getters or discard the last valid text. Unknown callback acknowledgement waits
for the exact record; real server recovery remains an integration requirement.
Independent source review found no remaining definite P1/P2 after these fixes.

`tests/playoff-prize-native-history-artifact-v2.mjs` replays the successful
fictional capture into the actual history module. An explicit $5 winner
increase changes $835 to $840 and leaves $1. This is a post-run artifact replay,
not a fresh backend read or persisted proposal. The captured input's SHA-256 is
recorded in `test-results/prize-native-history-v2-artifact.json`.

## Other checks and exact limits

The application suite passed **2,457 tests**. Manual-history independent tests
cover 60 method/increment/field combinations. Actual offline production-React
review passed **15 cases at four widths**, including doubled text, keyboard,
held callbacks, zero/blank, corrections/void/reopen and source changes. No URL
navigation or requests occurred; fixture UUIDs are mocked because about:blank
has no secure-origin UUID API. Browser evidence is under
`test-results/playoff-prize-proposal-review-offline/` and its separate QA report.
TypeScript, build, provider readiness and 14 workspace/private-handoff checks
passed. Full/scoped lint logs use `test-results/prize-native-history-v2-*`.
The previously denied registry audit was not retried; no full clean audit claim.

Still incomplete: durable authenticated proposal/history storage, actual
provider/device acceptance, verified native fee/fund review, additional income,
funded optional-pool/Consolation integration, named final-recipient and final
award/disbursement integration. No final-award or payment enablement is implied.
See `docs/decisions/2026-11-08-prize-remainder-and-fee-open-questions.md` for
specific remaining policy examples; none blocks retaining proposals locally.
