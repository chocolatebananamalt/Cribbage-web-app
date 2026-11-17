# Identity workflow V5 provider contract

This is a local handoff, not hosted installation approval. Parent should relay it to backend thread `6af6f4a8-fa78-8191-b139-c88e6f86202f`. No shared schema/fixture was edited and no denied cross-thread action was retried.

## Gate and authority

The page is `/tournament/[tournamentId]/identity-v5`; its Director workspace link is conditional. API actions live under `/api/v1/tournaments/[id]/identity-v5/[action]` and use the standard private/no-store failure boundary.

The default is off. Local enablement requires `CRIBBAGE_IDENTITY_V5=local-reviewed-v5` and a loopback `NEXT_PUBLIC_SUPABASE_URL`. The API also requires a reviewed 64-character `CRIBBAGE_IDENTITY_V5_PERMISSION_HASH`. Every operation checks the exact engine and permission capability. Missing/mismatched capability returns 503; no legacy or mock provider substitutes. Hosted URLs remain rejected.

Normal server authority comes from the cookie-backed client: verified claims/session ID, fresh `getUser` matching the subject, and primary `get_tournament_role === director`. Expected actor/session headers only detect a stale browser view; they never grant authority. Current access is checked around operations. A separate server-only admin client follows the existing app RPC boundary; no key was retrieved or exposed here.

## Exact RPC interface

Every RPC receives `p_actor_id`, `p_session_id` and `p_tournament_id` from verified server access. Existing v3 RPCs are never substitutes. Exact DTO definitions are in `src/lib/identity-v5/contracts.ts` and `report.ts`.

| RPC | Additional inputs | Required response |
|---|---|---|
| `get_identity_workflow_capability_v5` | none | Scoped V5 capability; available=true; exact engineHash and reviewed permissionHash |
| `get_identity_workflow_workspace_v5` | none | Scoped revision, current players and authorized `{tournamentId,eventId,name}` event choices |
| `prepare_identity_workflow_v5` | `p_entry`, `p_address` | `DuplicateSnapshotV3`, bound to actor/session/tournament/query fingerprint and source revision |
| `write_identity_workflow_v5` | `p_operation_id`, `p_request` | Exact `identity-workflow-reply-v5` envelope with scope, operation, canonical request and outcome |
| `reconcile_identity_workflow_v5` | same operation/request | Same envelope; NULL outcome means absent only after a current authorized lookup |
| `read_identity_workflow_player_v5` | `p_roster_entry_id` | Current `PlayerV5` for that exact requested roster ID |
| `read_identity_workflow_scorecard_v5` | `p_event_id`, `p_roster_entry_id` | Card bound to event, participant, roster, stable subject, current identity version/operation and result source |
| `read_identity_workflow_event_report_v5` | `p_event_id` | Scoped authoritative event members and their bound cards |

The event report must enumerate **event participants**, not the entire tournament roster. A missing/error/mismatched card for an actual participant blocks reporting. It must not silently skip failed reads. Use a coherent source snapshot; the native fixture uses a repeatable-read, read-only transaction.

Writes use the exact V4 request shape: create/correct/attach_issued, expected revision/version, roster target, entry/address/distinction, duplicate decision, reason and issued evidence. The backend must recompute duplicate/source conditions and allocate identity/Temporary IDs atomically. A browser review ID is a UI lease, not authorization.

A success is bound to operation, actor/session/tournament, target, version and canonical payload. Duplicate navigation must match the explicitly selected existing roster entry. Reconciliation errors or forbidden reads must never masquerade as absence. Current actor/session recovery may wrap an immutable old receipt; it must not mutate its original request or identity fact.

## SQL delta and permissions

| Input | SHA256 |
|---|---|
| Preserved V4 engine | `d8e2d09c84e7d9011a03c62e288fcebf2aa22622f62a05155080354f960ffdee` |
| V5 local engine | `f3147b94ee93e88dd66d4e51861e9be6d3b5896710b2b253ebd088aaa1d8533f` |

The sole guard change permits confirming an already-supplied, unconfirmed number with evidence on the same profile. Current assignments still reject redundant new operations; exact retries return their original receipt. Lifetime uniqueness, retirement, actor/session and version checks remain unchanged.

`SAME_ZZ_CONFIRMATION.LOCAL-DELTA.sql` changes only the private writer and grants nothing. Reconcile actual catalog, ownership, Auth-session read rights, RLS, ACLs and exact preimages before any installation. The fixture permission hash is **not a staging pin**.

The `identity_trial_v4` schema remains closed. Native tests use a nonsuperuser/BYPASSRLS `postgres` executor that owns synthetic prerequisites. Anonymous, authenticated and service roles do not automatically get engine execution. Reviewed app-facing wrappers and permissions are still required; do not grant tables/schema broadly to make the adapter work.

## Recovery and export

The owner-keyed component and request/navigation leases reject stale responses. Requests are validated before retention. Exact primary requests use existing recovery-owner/CAS coordination and `trackAppRecoveryWrite`; uncertain outcomes are retained for exact reconciliation/retry.

Confirmed saves require explicit Finish. Definitive rejections require explicit archival with exact evidence and CAS; idempotency conflicts cannot be archived. Only strictly valid V5 rejection archives stop counting as pending. Primary, malformed, foreign-shaped and conflicting records remain pending. Explicit safe cleanup still removes resolved archives.

Manual PDFs whitelist legal first/last name, city/state, actual supplied-and-confirmed ACC/ZZ or blank, bound results/prize, hypothetical unawarded MRPs, claimed joining and needs-ACC handling. Internal IDs, Temporary IDs, local distinguishing labels and private evidence are excluded. No automatic ACC submission, official format acceptance or membership/MRP award is implied.

## Remaining integration

Real GoTrue, PostgREST and Next SSR acceptance are unverified. The existing genuine local stack requires restricted Docker access, which was not retried. New RPC wrappers/grants are not installed.

The versioned registry still needs explicit mapping to real profile/enrollment/roster/participant/results readers. It does not silently replace existing paid registration, check-in, game or finance writers. Native result/participant rows are fictional fixtures, not normal scoring or payment submissions. This does not certify the mature staging catalog, payout rules or ACC issuance.
