# Truthful native mixed rehearsal readiness: local source design

## Acceptance and authority boundary

The parent authorized local source-only implementation/review of truthful test
attendance for the native 18-player mixed rehearsal. Keep the core private
and every path default-disabled. A separate own-subject consent transport is
only an opt-in permission proposal for review, not an applied access grant.
No new database fixture, SQL execution, hosted access,
publication, invitation, credential, ordinary payment row or money movement is
authorized. Preserve all previous source checkpoints and historical records.

The bounded outcome is a verifiable **pre-draw rehearsal-readiness source**:
six linked Digital subjects make their own versioned participation decisions;
twelve unlinked fictional Paper identities are explicitly declared synthetic
and reviewed by a different currently authorized official. It is not evidence
that fictional people attended, a QR/desk check-in, a verified payment, player
game confirmation or an official tournament Start. No fake profile, account,
future seating ID or canonical game may be manufactured.

## Why readiness must precede seating

The native draw reads roster-level `checked_in` rows (0047 and the random draw
proposal). Schedule publication separately requires event participants to be
`checked_in` (0114). Ordinary QR/desk attendance requires ordinary obligation and
receipt rows (0207/0208/0217); event attendance closure and Start require those
attendance records (0236). The separate funding journal intentionally supplies
none of them. Requiring an already-published schedule to record test attendance
would therefore be circular.

Order: native admission intent, complete simulated funding journal, pre-draw
readiness scope and six self-consents/twelve fictional declarations and review,
then a separately reviewed simulation-aware draw/status/schedule/Start bridge.
The readiness source must not pin future draw, publication, fixed Tournament
IDs or game IDs. Actual IDs remain immutable when legitimately published later.

## Identity, roles and consent

- Digital consent is derived from the signed-in subject, matching that subject's
  current linked profile/participant/roster identity. A Director or service
  actor cannot grant consent for that player. Use a versioned test-only statement
  that does not attest physical play or genuine paper opponents. No user-editable
  metadata is authorization.
- Decisions are append-only, versioned `granted`/`revoked`, with exact prior ID
  and version checks. A readiness seal preserves history; it is not an
  irrevocable grant. A later revocation invalidates current readiness without
  rewriting the old seal. Do not automatically reactivate a sealed trial.
- Revocation remains recordable after a seal and after a future Start by the
  original subject. Preserve historical results/Start; all future generated
  test writers must stop on revoked consent. Those downstream consumers remain
  missing and cannot be treated as enforced by this journal alone.
- Paper declarations cover exactly the twelve already-known unlinked fictional
  identities. There is no Paper consent or human-presence claim. A current
  Director prepares them; a distinct current cross-checker reviews them, with
  nonself subject checks. The reviewer may be a Digital player: existing role
  rules permit that. Two profiles alone do not prove two independent humans.

## Durable source and recovery

The private SQL proposal should bind the latest admission/native settings and
complete current funding scope/source, roster modes/profiles/links, exact
operation/request/context/outcome/provenance and role/version pins. Use UTC for
timestamp-bearing hashes, conservative source locks and exact replay/recovery.
Quarantine remains in force from admission intent; no legacy financial scope or
ordinary payment record is adopted. Unknown or stale evidence is blocked,
never counted as zero or transformed into ordinary attendance.

A complete source may describe all eighteen identities as ready for this
**simulation**, while explicitly returning false for ordinary attendance,
payment, human/physical presence, actual money, refund, payout, normal draw and
normal Start authority. Completion is not itself an execution capability.

## Pure observation and its limits

`native-mixed-attendance-observation-v1.ts` checks exact source shape against
separately supplied scope, identities, latest consent heads and current official
roles. It rejects revoked/stale consent, wrong/duplicate identities, missing
Paper coverage, same preparing/reviewing profile, false real-world claims and
future publication IDs. Its Director-only injected reader checks access before
loading, rechecks actor/roles and owns/compares two complete reads. It has no
provider/API/page. It never verifies a JWT, database row/hash ownership or human
independence; all related authority flags remain false. Double reads detect
observed drift rather than establish atomicity or a source lease.

## Separate consent transport proposal

A private writer that derives `auth.uid()` cannot be called by real players if
all authenticated execution is revoked. Do not solve that by letting the
Director supply another person's actor ID. A separate opt-in public consent RPC
proposal may accept only tournament ID, event ID and request, derive the subject
from the authenticated JWT, reject anonymous/service callers, and delegate to
the private exact-scope writer. Its gate is also default-off. Only this narrow
wrapper would receive authenticated EXECUTE; no direct app-table or private
function grant is proposed for players.

This transport file is excluded from any current migration/release manifest.
Its explicit proposed permission needs separate hosted approval and genuine
provider/session acceptance before use. No permission is applied by saving or
testing its source. The player consent screen, own-current-decision recovery
and protected provider route are not delivered by the SQL proposal.

## Implementation and runtime gates

No ordinary QR/desk, `reinstate`, participant-status, check-in window, seating,
schedule or Start write belongs in this first proposal. Current Start and
admission seal still require `checked_in` and an `official` Start. A future
explicit rehearsal source/provenance and guarded bridge must address both
before a positive end-to-end rehearsal is possible. Do not relabel fictional
attendance or relax the real paid predicate to make a test pass.

After the source is frozen/reviewed, a separately approved disposable database
must test syntax, catalog/FK/forced-RLS/ACL, subject impersonation/service proxy
rejection, current roles and source pins, consent version/nonce conflicts,
post-seal revocation, stale seal invalidation, same/competing requests, complete
provenance coverage, exact retry/reconciliation, injected rollback and cross-
session time zones. Assert actual persisted rows and verify cleanup. Then actual
provider sessions and personally accepted roles must prove user identity and
independent review. None of this is established by pure or static tests.

Publication remains on hold. No new DB-fixture or publication approval follows
from this source-only task, and a local source archive is not database recovery.
