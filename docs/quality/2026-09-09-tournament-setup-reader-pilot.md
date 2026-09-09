# Tournament setup reader — pilot evidence

Date: 2026-09-09
Environment: connected Supabase pilot `fnjkwymxpnsqvxtpronk`; local Node 24 / pnpm workspace.

## Scope

Migration `0053` adds a private director/co-director configuration read model.
Migration `0054` narrows its history response after focused Sol review. It has
no UI, writer, operational-event mapping, flyer, scoring, payment, results,
export, or ACC portal effect.

## Evidence

- Sol review found no P0 and one P1: minimal history must not include a private
  revision identifier. `0054` removes it before use.
- A rollback-only pilot fixture saved one valid private setup revision, then
  read it through the RPC as the current director. The returned current DTO had
  the expected setup data and one history record. A non-member claim received
  `NULL`.
- The function is `SECURITY DEFINER` with an empty search path; `public` and
  `anon` execution are revoked and only `authenticated` has execute. It reads
  only the private setup aggregate and current tournament-role relation.

## DTO boundary

The response is a read DTO, not a save payload. It includes read-only fields
such as `revisionId`, `createdAt`, `sourceStatus`, and Q-pool `slot`; any later
form must explicitly map it to the strict `0052` writer payload and omit those
fields. It must not round-trip the response directly.

## Remaining limits

Real independent director/co-director/revoked-role/player/anonymous sessions,
an authenticated UI, and reader/writer concurrency remain release gates.
