# Tournament setup activation release — 2026-09-13

## Acceptance criteria

- Tournament setup activation and append-only event amendments do not depend
  on a Vercel environment toggle.
- Both routes still require a verified session, same-origin mutation, valid
  request/response contracts, and director/co-director authority through the
  server-only database boundary.
- The protected setup screen reads activation state for every authorized user
  and offers activation whenever a saved Main-event revision exists.
- Cash/check remains the October payment boundary. Optional online-payment,
  SMS, and paper-card OCR providers remain separately default-off.

## Implementation evidence

- Removed `ACC_TOURNAMENT_SETUP_ACTIVATION_ENABLED` from the runtime boundary
  and `.env.example`.
- Removed the configuration gate from the setup-activation and event-amendment
  route handlers without changing their authentication, role, origin,
  idempotency, audit, or database controls.
- Removed the presentation-layer feature flag so the setup client always reads
  the authoritative activation state and exposes the valid operation.
- Added regression coverage that rejects reintroduction of the deployment
  toggle while preserving the protected route contracts.

## Verification

| Check | Result |
| --- | --- |
| Focused setup activation and amendment tests | PASS — 15/15 |
| `pnpm verify` | PASS — 454/454 application checks plus audit, lint, provider preflight, production build, and workspace checks |
| `pnpm verify:handoff` | PASS — 6/6 private-handoff checks |
| Pull request | PASS — [#23](https://github.com/chocolatebananamalt/Cribbage-web-app/pull/23) |
| Merged release | PASS — `545dcc07d4fb0e3f77732bbe496573e529beb7cc` |
| Vercel production deployment | PASS — `dpl_28aRC6U79xEQxvshVE4UKkeftPig`, READY, stable aliases assigned, no alias error |
| Production runtime errors | PASS — none found in the post-release window |
| `pnpm verify:live-demo` | PASS — 21 visits across 20 screens at 320 px, 640 px, and 1280 px; no overflow, CSP, HTTP, console, or page errors |

## Remaining human evidence

The release removes a configuration-only availability risk; it does not weaken
any security boundary. A physical rehearsal with independent signed-in director,
official, and player sessions is still required to prove the protected workflow
under real devices, connectivity changes, and venue operating conditions.
