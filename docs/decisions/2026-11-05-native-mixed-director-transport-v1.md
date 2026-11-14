# Private mixed-rehearsal Director transport and recovery

Status: source-only, default disabled; no route, real executor, grant or database installation.

## Scope and acceptance

The pending request for a fresh mixed-rehearsal database does not authorize one
yet. This checkpoint adds independent source-level transport and device recovery.
The observable checks are exact action/request/receipt binding; verified user and
session plus current Director role; project/event/actor/action/expiry restriction;
bounded same-origin writes; persistence before dispatch; read-only uncertain
outcome recovery; preservation across sign-out/account changes; and no redraw
after a terminal attempt is archived and reopened.

The provider and handlers are dependency-injected and disabled by default. They
construct neither a Supabase client nor a privileged executor. No HTTP route is
registered. A future host must provide an explicitly reviewed target lease and
authenticated executor; client-supplied actor or event text is not authorization.
Both sides of asynchronous executor access recheck identity/role/expiry. Config
validation follows the frozen SQL technical bounds, not invented ACC limits.

## Historical operation recovery

The additive private SQL proposal supplies the missing read-only exact operation
lookup. It verifies ownership, scope, canonical request hash, exact receipt shape
and typed effect lineage before returning history. It does not call a writer or
consume entropy. A persisted terminal failed draw is recoverable even if later
consent changed, provided current caller access remains valid. Both returned
receipt layers say historical and deny current source verification. Stored
history is never rewritten. The independent recovery flag is false and execute
is revoked from all application roles. The proposal has not been executed.

## Device protocol

The controller injects its retained-storage port and transport; import opens no
storage and dispatches nothing. Its key binds project, actor, tournament and
event. Session identity additionally binds in-memory callbacks. Exact bounded
pending content is atomically saved and read back before sending one mutation.
Unknown or malformed outcomes have only a read-only check action, never an
automatic write retry, replacement operation or fresh random draw. Logout,
expiry, role/account changes hide private memory without deleting pending work.
Other-account, malformed or unknown stored data is preserved.

Closing a proven operation requires a fresh bound historical read and an atomic
archive plus closed marker at the same key. The marker blocks a second dispatch
on reopen, including failed draws that consumed an attempt. It is deliberately
not automatically cleared to begin a new phase. This is a source controller,
not an activated multi-step screen.

## Remaining activation gates

1. A known rejection before the SQL journal is written can leave pending work
   without an operation for the getter. Keep it preserved. A reviewed, durable
   proof-of-no-write resolution is required before enabling the UI; generic
   rejection or empty lookup is insufficient.
2. A reviewed source-bound transition from a closed operation to the next phase
   is absent. Do not erase the marker, infer permission from a historical receipt,
   or offer a fresh draw. Backend draw-attempt enforcement remains mandatory.
3. Separately authorized disposable runtime proof must cover actual SQL, ACL,
   entropy/concurrency, revocation, rollback and exact historical reads. Current
   tests use source inspection and injected in-memory ports only.
4. Real provider/JWT/role sessions, permission/grant review and actual private UI
   phone/desktop/reload acceptance remain untested. No screen was wired here.
5. Normal Start, current consent at scoring, mixed playoff recipients and native
   Finance integration remain independent gaps. No real attendance, verified
   payment, payout, physical-layout approval or official ACC result is implied.

The existing mixed publication SQL and all previous source archives remain
unchanged. No saved tournament or historical fixture was accessed.
