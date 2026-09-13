# October identity and correction activation evidence

**Date:** 2026-09-12
**Scope:** October-required witnessed account activation and reviewed Rule 12
correction availability

## Acceptance criteria

1. A missing or stale Vercel feature variable cannot hide either required
   workflow.
2. Account linking retains same-origin, authenticated, witnessed,
   intended-player, non-self, lifecycle, idempotency, and service-only
   boundaries.
3. Rule 12 corrections retain role, non-self, policy, lifecycle,
   immutable-original, reconciliation, exact-replay, and service-only
   boundaries.
4. Optional online payments, SMS, and OCR remain default-off and cannot block
   cash/check or human paper-card operation.
5. The full local release gate passes before merge; production route and
   runtime evidence are appended after deployment.

## Local evidence

| Check | Result |
| --- | --- |
| `pnpm test` | Pass — 446/446 |
| `pnpm verify` | Pass — dependency audit, lint, 446 tests, provider preflight, production build, 6 workspace tests, and clean-clone safety checks |
| `pnpm verify:handoff` | Pass — 6/6 |
| Provider preflight | Pass — manual fallbacks declared; online payments, SMS, and OCR disabled |
| Production build | Pass — Next.js 16.3.4 compiled and generated all routes |
| `git diff --check` | Pass; line-ending conversion warnings only |

The Supabase changelog Markdown endpoint was queried as required but returned
an unsupported-content-type response. This release changes neither a Supabase
API call nor the already-applied database schema.

## Independent review

The initial high-risk review found no functional authorization or security
regression. It identified only obsolete test assertions that still expected
the retired Rule 12 environment token and two misleading test descriptions.
Those assertions and descriptions were repaired, after which all 446
application tests passed. The final focused review passed 101/101 tests and
returned GO with no P0, P1, or P2 finding.

## Production evidence

| Check | Result |
| --- | --- |
| GitHub release | Pull request 11 merged as verified `main` commit `5b40faf8b6bbdc1efbdf6b19898f6922f410c1ed` |
| Vercel deployment | `dpl_DN7qTUWvFGRHd5khWsxbrEQY1to3` — `READY`, Production, stable alias attached, no alias error |
| Root and public demo | HTTP 200 |
| Account-activation workspace | Anonymous GET returns 401, replacing the former feature-hidden 404 |
| Rule 12 policy and correction writers | Empty same-origin requests return strict 400 request-shape rejections, replacing the former feature-hidden 404 |
| Private paper capture writer | Empty same-origin request returns strict 400 request-shape rejection; route remains deployed and protected |
| Responsive Chrome | 320 px: client/scroll width 320/320; 1280 px: 1265/1265; no error overlay |
| Vercel runtime errors | No error clusters in the 30-minute release window |
| Release request codes | 13 HTTP 200, 3 expected HTTP 400, 2 expected HTTP 405, and 1 expected HTTP 401; no 5xx observed |

## Remaining acceptance evidence

- Complete the documented real director/player/cross-checker rehearsal. This
  last item cannot be fabricated with synthetic identities in the live pilot.
