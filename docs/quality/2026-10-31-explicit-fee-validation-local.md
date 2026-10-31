# Explicit fee intent and blank rejection

Local successor to the completed 0268 rollout. No 0269 hosted application or
publication is authorized yet. Replacement hosted fixtures remain on hold.

## Product rule and source distinction

Daron approved paid Main entry at least $3 and paid Consolation at least $1 as
application safeguards. Other paid event cards retain the prior $1 application
guard. A new free event requires an explicit Free choice and exact zero. This
does not establish a subsidy, waive sanctioning, or create funding. Existing
accounting reconciliation must still account for costs and available funds.

Enabled Q and Side Pool fees must be explicit positive multiples of $5. Blank,
whitespace, missing, null, invalid text, NaN, negative and zero are rejected.
Disabled pools have no fee requirement. Optional expenses are unaffected.

The official Policy Manual Chapter 6 I.E.10 (printed 6-2/PDF34) and IV.A.6.b
(printed 6-4/PDF36) establish $3 Main/$1 Consolation sanction obligations, not
general retail entry-price floors. Optional Side Pools are distinct from
Consolation events (Director Manual 8.A–B, pages12–13). No blanket subsidy
authorization was found. The numerical entry safeguards are product policy.

## Implementation boundaries

New event and pool inputs start blank. Immediate controlled input updates keep
invalid text invalid rather than converting it to zero. Free-to-Paid resets the
amount to blank. The full new-write validator is separate from historical
workspace and retained-operation parsers. Historical zeros remain unverified,
not retroactively Free. Readback verifies exact-version explicit-free intent.

API preflight rejects invalid full new requests before core setup or amendment
mutation. Only an authoritative accepted receipt permits historical requests
to reach their original hash-checking writer. This closes the partial-write
case where the base revision could save before an invalid Side fee failed.
The database independently enforces current fees at insertion boundaries and
preserves narrowly source-bound historical clones and accepted replay.

## Completed predecessor rollout

0268 applied once to staging as20261031000827:5656bytes,
SHA2560337C8A6E6C0E837A0D95FA39FD458EFC8D9A2C66DE40F2B6FCC024EA6FC712C.
All223 preexisting tables retained count/fingerprint baselines; function grants,
owners and existing records were unchanged. Commit
a97ced93a124ce41a24dbe62c841fe720eddfaaf on draftPR122 passed both CI runs
41148681234/41148675896. Deployment dpl_6tZ2HZmfCjy9GrcYNz9Hn3YqyGNq
is READY and bound to the stable test alias. No replacement fixture was created.

## Verification status

Final full `pnpm verify` passed1140 application tests, official registry audit
(no known vulnerabilities), lint(no errors), providers, production build/types
and8 workspace checks. `pnpm verify:handoff` passed6 checks. Evidence:
`test-results/explicit-fees-final-verify.log` and `explicit-fees-handoff.log`.
Phone/desktop mock-service rehearsal passed sixteen scenarios at390/1440px,
including explicit Free-to-Paid blank reset, invalid Side fees, lost responses,
reload/retry, newer revisions and malformed acknowledgements. Task-server cleanup
is confirmed in `test-results/setup-fee-persistence-browser/results.json`.
Independent review found and closed the Side partial-save P2; no remaining
confirmed P1/P2. The preflight helper test uses simulated mutation counters,
not an executed HTTP/SQL route transaction. SQL proof is separate.

0269 frozen proposal:13019bytes,
SHA256344C37B7421BC7F609541CFACBC7899F4B42A9C1493A86751F736BB82AC0C588.
See the SQL report for real backend evidence and cleanup. Source backup is refreshed
only after this frozen milestone, with exact Library version recorded separately.

These UI checks use mocked services; database acceptance uses a separate real,
outbound-disabled disposable PostgreSQL fixture. Neither proves hosted monetary
acceptance, physical paper review, or production readiness. No real money moved.


## Proposed next authorization

Apply0269 staging-only, publish the curated validation patch to the existing
PR122 test branch with exact-commit CI/READY checks, then resume the two already
approved replacement fixtures only after persisted preflight. No production or
real disbursement. Schema-first order is required: new Free fields and the
service-only amendment receipt probe depend on0269. Existing positive historical
payloads remain readable; old implicit-zero payloads cannot make new writes.

0269 adds one nullable column to a private immutable table (no backfill), private
validation/clone/insert-guard helpers and triggers, patches existing writers and
workspace, and adds one service-role-only accepted amendment receipt probe.
No new human grants, tables, credentials or payment writers. Existing function
OIDs/owners/ACLs and history fingerprints are verified unchanged. Backend service
access expands only by that narrowly role/actor/tournament/key-scoped boolean
probe. All old fixtures and money records remain unchanged.

Rollback: retain the additive column and immutable intent/history. Revert app
publication to a97 only if necessary; do not drop data or turn off database fee
guards to regain legacy implicit-zero writes. Historical old-client zero submissions
may be rejected, which is intended. A later forward migration requires review.
Post-rollout checks must compare schema, ACL/RLS/owners/triggers, migration history
and all existing table fingerprints before creating new test records.
