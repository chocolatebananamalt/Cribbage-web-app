# Offline score synchronization acceptance — 2026-09-09

The existing session retry envelope is intentionally excluded from this
acceptance evidence. It protects a foreground request retry only.

Before an offline capability can be enabled, the implementation must prove:

1. Each persisted queue record is versioned, immutable, actor/session/event/
   game/assignment scoped, signed by a registered non-exportable key, and
   contains no access token, refresh token, identity text, opponent entry, or
   local verified state.
2. A server-issued, short-lived capability binds every queue replay to the
   authenticated session, device/session key, exact operation kind, and exact
   score scope. The server rejects forged, tampered, stale, copied, revoked,
   cross-account, cross-event, cross-tournament, and cross-game records.
3. The sole replay wrapper atomically reauthorizes and calls the established
   score core; it creates exact immutable receipt/audit/conflict evidence and
   rolls back all score effects when that evidence cannot be recorded.
4. A confirmation is queueable only after server-held matching submissions
   yield a challenge. Local submissions, a paper card, and one actor cannot
   produce or claim verification.
5. Terminal deletion requires an exact response binding the operation and
   digest. Ambiguous outcomes, 401, throttling, server failures, malformed
   responses, and mismatched responses remain locked/visible, never cleared or
   marked verified.
6. Executed two-account browser tests against disposable synthetic data cover
   digital and hybrid paper flows, restart/reconnect, simultaneous/reordered
   replay, mismatch/correction/closure races, quota/corruption, and sign-out/
   shared-device purge with persisted database assertions.
