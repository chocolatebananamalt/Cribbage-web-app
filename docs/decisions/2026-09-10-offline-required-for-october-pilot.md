# Offline scoring required for the October pilot — 2026-09-10

## Decision

The October 3, 2026 pilot must allow an assigned player to capture a score
while internet service is unavailable and synchronize it later. This
supersedes the earlier connected-first scope decision. The safe protocol in
`2026-09-09-offline-score-sync-contract.md` remains authoritative; this
decision changes its delivery priority from future/optional to pilot-blocking.

The app's visible tournament label uses the configured tournament name and
local date, such as `Topaz 01-27-2026`. A non-limiting reference such as
`PILOT-2026-000001` is administrative testing/audit metadata only and is not
shown instead of the tournament name and date. Internal tournament IDs remain
UUIDs, and an ACC/source identifier remains separate with provenance.

## Required user-visible behavior

- Once the app has securely loaded the assigned game and its offline
  capability, score entry remains available without a current connection.
- Saving shows `Saved Offline — Waiting to Sync`; it never says `Verified`.
- The immutable queued entry survives refresh, app restart, and ordinary
  device sleep.
- Reconnection triggers a bounded, idempotent synchronization attempt. The
  server rechecks the actor, session, tournament, event, assignment, game
  version, and payload before invoking the existing authoritative score
  writer.
- Accepted replay advances through the ordinary independent-entry and
  confirmation workflow. Stale or mismatched state becomes a visible conflict
  for review and is never silently overwritten.
- Sign-out or shared-device clearing removes local queue data and device keys;
  unresolved entries require a deliberate warning before clearing.

## Device failure and scorecard reconstruction

The scorecard is a server-derived tournament record, not a phone-owned file.
Anything already synchronized is reconstructed on a replacement device after
the player is authenticated and authorized. The app does not copy another
player's private scorecard onto every phone merely as a backup.

If a phone fails before its offline queue synchronizes, those local-only bytes
cannot truthfully be recovered from the server. The app instead opens an
audited `DeviceFailureRecovery` case for every affected game. An eligible
cross checker who is not a player in that game may transcribe the reciprocal
opponent record and/or paper-card evidence. A different eligible cross checker
or director confirms the recovered values before the server records
`RecoveredVerified`. Conflicting or insufficient evidence is retained for
director/judge resolution; no value is guessed and no missing player's action
is fabricated.

This recovery path preserves the surviving claims, evidence references,
recovery actors, timestamps, approvals, and before/after card totals. It is a
distinct verified provenance state and does not erase the device failure or
ordinary score history.

## Acceptance gate

Before the October pilot, two independent real browser/device sessions must
prove offline entry, refresh/restart survival, reconnect replay, exact retry,
duplicate and changed replay, stale/conflicting game state, account switch,
cross-tournament rejection, service interruption, and shared-device clearing
against a real test backend. The test must also replace a device after synced
games and reconstruct its scorecard, then destroy an unsynced queue and prove
the opponent/paper evidence recovery, independent approval, conflict, no-self,
and audit paths. Stored server records and receipts—not local success text—are
the evidence of synchronization, reconstruction, and verification.
