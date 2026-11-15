# Check-in readback and local seating-draft membership

Base:76aa9ff0fcb2dd640be0fde74efda0d6c9465de9. Separate workspace:registration-seating-refresh-20261115/candidate. Existing candidate, artifacts and live trial remain untouched;13033415 is not integrated.

## Reachable ordinary paid workflow inspected

The tournament dashboard links Registration and roster, Payments and expenses, Event Check-In, Check-in and seating publication, and gated Player app access. Roster, Payments and Seating pages require Director/Co-director tournament access. Roster intake additionally requires its existing Setup/open-registration state. The roster UI's accepted DTO does not assert account creation, payment, check-in, enrollment or seating.

Payments mounts the actual amount-owed and payment-receipt clients with normal cash/check methods and distinct obligation/history/recovery contracts. Normal receipt entry requires a positive amount; this task adds no free-entry requirement or fee defaults. A receipt alone is explicitly not paid-in-full, enrollment, check-in or seating. Event check-in's workspace and desk flow separately require current enrollment/payment readiness and an open event window. Tournament attendance at `/seating` is a distinct state from event enrollment/check-in. Do not infer payment or eligibility from this UI correction.

The actual tournament check-in POST uses normal authenticated RPC `record_roster_check_in_event_v2`; valid receipts are bound to tournament, roster identity, state and operation ID. Seating publishes via `publish_initial_seating_v2` with its own exact roster assignments and operation. Neither route records payment. Player-facing access remains the existing separately gated private activation flow: eligibility/workspace and activation issuance/redemption/approval are distinct operations, with separate check-in/activation operation IDs. No handoff credential, approval, account or live session was accessed or created. Hosted availability/ACL and genuine persisted paid readback were not exercised here.

## Reproduced defect

Actual SeatingClient initializes `assignments` only once, but `router.refresh()` can replace `checkIn` props while preserving client state. The displayed current attendance changes while the draft retains old membership. With a newly checked-in player, publication remains blocked and misreports duplicate seats. With equal-count replacement of Alpha by Beta, the previous length/unique-seat check passes and the actual UI submits Alpha's stale roster ID. The fictional provider refuses it; no genuine backend miswrite is claimed.

Before-fix reproduction:6cases at390x1000 and1440x1000, additions, equal-count replacement, and response lost after fictional check-in commit. Tests use exact preserved base component. In the replacement case, the actual submitted request contains old Alpha and produces0fixture seating writes.

## Minimal application change

Only product path:src/app/tournament/[tournamentId]/seating/seating-client.tsx.

- Draft completion now also requires membership to match the current checked-in roster IDs.
- Drift displays an explicit explanation and Update seating draft from current check-in action. It reuses the existing draft function and current table dimensions; no seating/rotation policy is introduced.
- The warning explains manual seat choices are replaced. Until the explicit action, existing choices remain intact. Pending recovery locks disable draft replacement and preserve the exact saved bytes.
- Explicit update and both existing Table Plan input rebuilds clear publication confirmation. The director must review and confirm the rebuilt assignments again. Independent review caught the two alternate input paths; both are covered.
- No SQL, grant, flag, request/reply contract, payment/fee rule, accounting entry, identity or retention transition changed.

## Verification and limits

Actual-component installed Chrome browser:10cases pass, added/replaced/lost-reply/table-update/capacity-update at390 and1440. It consumes accepted normal-shaped DTOs and rerenders server-prop readback on the same component. Checks current roster IDs in the final request, exactly1fixture seating write, renewed confirmation, manual-choice preservation before update, and foreign fictional recovery preservation. Response-loss case retains the exact check-in JSON, disables the update control while locked, retries the same operation and produces1fixture check-in write. Real browser sessionStorage; synthetic router, HTTP/RPC model and recovery setter; service workers blocked. This does not prove real database idempotency, Auth/RLS, payment persistence or multi-device acceptance.

Actual check-in route:3groups pass, exact accepted/replayed normal RPC arguments and bound receipts, foreign-origin/missing-actor/extra-authority rejection before RPC, server permission rejection preserved, foreign/unbound/missing/provider-failure replies withheld. Real route/body/origin/subject/DTO/boundary code; normal-client auth/RPC and NextResponse serialization are ports. Repeated receipt response is not a persisted database replay claim.

Independent Sol review:PASS after the two plan-input consent resets;10case execution evidence inspected. Required aggregate checks and final portable preimages/hashes are in the adjacent support REPORT.md/MANIFEST.json. No live Preview/database/production/user-draft/session writes, real tournament creation or publication occurred. No wider item9 or real paid end-to-end acceptance is claimed.
