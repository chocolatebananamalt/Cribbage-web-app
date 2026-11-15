# Setup finalization and registration repair verification

Date: 2026-09-15
Scope: Full Rehearsal setup recovery, QR registration prerequisite, and shared-device sign-out semantics

## Acceptance checks

- A saved setup revision stays visible/editable if its separate finalization
  status request fails or returns an invalid shape.
- The UI distinguishes saving a private draft from finalizing current events
  for operational use, and states that finalization does not start play.
- A director/co-director cannot issue or rotate a registration credential when
  the latest setup has no valid public tournament phone/email; the browser
  receives a specific recovery instruction rather than a generic conflict.
- Ordinary sign-out preserves local offline/retry recovery data. The explicit
  clear control is unavailable unless both local queues are empty.

## Executed evidence

Environment: Windows, Node 24, pnpm 11.19.0, repository working branch
`codex/correct-satellite-results-copy`.

| Command | Result |
| --- | --- |
| `pnpm lint` | Pass |
| `pnpm test` | Pass — 513/513 application tests |
| `pnpm build` | Pass — production Next.js build |
| `git diff --check` | Pass |

New regression coverage checks the labels/status isolation, explicit contact
gate on issuance/rotation, and safe shared-device condition. The existing
public-registration function already returns no public material for a link
whose latest setup lacks the public contact fields; this change adds a
director-facing prevention/recovery boundary before another credential is
issued or rotated.

## Production deployment and remaining verification

Pull request #51 merged as production commit
`05dabd60dea3dbf44d3bce82f38beda1a3b80413`. Vercel reported the deployment
successful; unauthenticated HTTP smoke probes for `/`, `/sign-in`, and `/demo`
returned 200. The public demonstration’s scripted walkthrough also passed at
320px, 640px, and 1280px: 20 distinct screens, with no overflow, console,
page, HTTP, or CSP errors.

Still required before calling the rehearsal workflow fully verified:

- Deploy this tested revision and review its Production runtime logs.
- A director signs into **Full Rehearsal — 09-16-2026**, saves the existing
  four-event draft once with the selected public tournament phone/email, and
  confirms the form stays available and the registration credential opens the
  claim screen on a second device.
- The full six-device rehearsal remains the independent-session/offline
  acceptance gate; it is not replaced by these automated checks.
