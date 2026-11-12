# Explicit setup fee intent: local SQL proof

Local-only authorized scope: migration0269, three new isolated SQL acceptance
files, and a narrow existing source-test selector repair. No hosted migration,
fixture, credential, financial action, commit, push or deployment was performed
by this worker. Migration0268 is unchanged.

## Contract and implementation

New event payloads may carry optional boolean `freeEntry`. Explicit `true`
requires numeric integer `entryFeeCents:0`. False/absent means paid, requiring a
numeric integer fee of at least300 minor for Main and100 for other event kinds,
including Consolation. These are owner-approved app input floors, not ACC entry
price or sanctioning rules. Enabled Q and Side fees must be positive multiples of
500 minor. Existing sanctioning obligations and funding evidence are unchanged;
the migration creates no subsidy, funding or financial receipt.

A nullable `free_entry` column is added to the already immutable private
`app.tournament_setup_event_versions` table. No rows are updated or backfilled.
Old zero fees remain NULL/unknown, and their workspace event omits `freeEntry`.
New writer versions store their marker and the workspace includes it. Existing
immutability, RLS and table permissions remain intact.

Guarded patches modify the bottom
`public.save_tournament_setup_version_legacy(uuid,integer,jsonb,uuid)` and
`public.append_tournament_setup_events_v1(uuid,uuid,uuid,integer,jsonb,uuid)`.
The flag stays inside the original request digest. Old accepted receipts return
before new fee validation. All existing setup aliases funnel through this bottom
writer. New invalid free/paid input rejects before creating a revision.

Private BEFORE INSERT guards cover new setup event, Q/Side definition, and
operational Side definition rows. The private historical-copy helper requires an
accepted replacement/amendment receipt pointing to the new revision, the exact
preceding revision, and an exact source event match excluding generated IDs and
the marker. It carries the source nullable marker forward. Ordinary draft saves
cannot use this exemption. Historical pool copies must match the source slot,
name/type, fee, note and source status. Retirement may carry an old operational
Side fee unchanged only through its accepted retirement receipt, bound to the
exact pool/event/version; it cannot enable a pool or change its amount.

The existing operational Side creation writer and setup Side configuration
writer receive fee validation after their existing recovery paths. No operational
Side fee-edit RPC exists; the insertion guard covers definition rows regardless
of writer. Historical accepted operational creation retries and safe retirement
remain available.

One new read-only service RPC is explicitly authorized:
`public.has_accepted_setup_amendment_operation_v1(p_actor_id uuid,
p_tournament_id uuid,p_operation_type text,p_operation_id uuid) returns boolean`.
It requires service-role execution, a current director/co-director, exact
actor/tournament/key scope, the sole allowed append operation kind, accepted
status and matching amendment target. An API may use it only to identify a
retained accepted operation before permitting historical structural replay; the
actual writer still verifies the full original request hash. PUBLIC, anon and
authenticated have no execute permission. The existing human setup-save
reconciliation contract is unchanged.

## Files and exact bytes

- `database/migrations/0269_explicit_setup_fee_intent_v1.sql`
- `tests/setup-fee-intent-sql-acceptance.mjs`
- `tests/run-setup-fee-intent-isolated.mjs`
- `tests/run-setup-fee-intent-container.mjs`
- `tests/operational-guard-scope.test.mjs`: identify the actual lifecycle function
  definition/catalog patch, rather than any receipt-operation-name mention. Its
  existing semantic assertion is unchanged.

Migration0269:13,019 bytes, SHA256
`344C37B7421BC7F609541CFACBC7899F4B42A9C1493A86751F736BB82AC0C588`.

## Executed evidence

All three new `.mjs` files pass `node --check`.
`node --test tests/operational-guard-scope.test.mjs` passes4/4.
`node --experimental-strip-types tests/run-setup-fee-intent-container.mjs` restores
the reviewed empty post0236 baseline, applies0237–0268, creates accepted historical
zero/small-pool requests, fingerprints protected history and every existing
app/public function OID/owner/ACL, applies0269 and runs public writer acceptance.
Historical fingerprint normalization omits only the new nullable column; separate
assertions prove all old markers remain NULL.

The final frozen-byte SQL run exited zero and passed all ten groups on the exact
hash above. Its database and exact task container
`b277cd030f812661e91f3e210de02efdb698b87297be5e43436437b1b6a4d1d8`
were removed and container absence verified. The matching log/result JSON and
container identity/cleanup receipts record the terminal result. Coverage:

- Old accepted zero-fee setup replay; historical NULL marker omitted from workspace.
- Missing, empty, whitespace, string, NULL, zero, negative and under-floor paid
  input rejection; explicit free-zero and valid paid persistence/readback;
  contradictory flags and changed same-key flags reject.
- All six existing setup writer/alias request shapes reach the hardened bottom
  writer and reject implicit zero.
- Configured Q/Side blank/missing/negative/sub500/nonmultiple fees reject;500 and
  1000 pass. Raw base/Q/Side table inserts cannot bypass the guards.
- Operational Side creation enforces500-unit fees; old accepted small-fee replay
  and unchanged historical retirement pass.
- Exact source-bound historical replacement retains unknown zero and small Q fee.
- Appended explicit-free Satellite and paid100 Consolation pass; under100 new
  Satellite rejects while old copied markers remain unknown.
- The service-only probe denies wrong actor/tournament/kind/key, missing/rejected
  receipts and human-role execution; a positive probe never bypasses hash conflict.
- Existing function identity/owner/ACL and normalized history preservation.

Environment: Node24.19.0, Docker Desktop context`desktop-linux`, reviewed image
`sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706`,
exact task container`cribbage-setup-fee-intent-local`, unprivileged postgres user,
network none, no ports/mounts, all capabilities dropped and no-new-privileges.
The runner refuses an existing same-name resource, removes only its exact
database/container and verifies absence. Logs/results/identity/cleanup receipts
are `test-results/setup-fee-intent-*`.

Development findings: the first alias fixture needed the historical structured
contact writer's nonblank placeholders; no product validation was weakened.
An operational guard initially used SQL alias`old`, which collided with the
trigger OLD record; the alias was corrected to`prior_definition` and the expanded
suite passed. All attempted task resources were cleaned.

Parent integration owns strict-versus-replay API preflight, UI, aggregate verify,
browser checks and independent high-risk review. This SQL proof does not certify
hosted rollout, physical operations or actual funding/disbursement.
