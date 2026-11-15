# Current activation and release-boundary review — 2026-09-10

## Scope

This review supersedes the historical cycle-2 report for the high-risk work
added after commit `d199abc`. It assesses the current source state at
`91d4406`, specifically migrations `0087`–`0095`, the release-gated account
activation routes/page, the isolated database evidence, and the protected
Preview smoke test. It does not claim to review or certify missing product
areas as complete.

## Evidence examined

- The application test suite, lint, production build, workspace integrity,
  private handoff check, and whitespace check pass locally: **147 tests** and
  no production dependency advisory at the configured severity.
- Account activation is closed by default. Its private schema and procedures
  are installed only in the disposable synthetic database; none of
  `0090`–`0095` is applied to the shared pilot and neither release flag was
  enabled.
- The isolated database proves procedure privilege denial for browser roles,
  authorization rejection without an activation row, the full sequential
  witnessed activation lifecycle, exact decision replay, redemption/cancel
  contention, decision/cancel contention, and atomic registration closure
  with link retirement.
- A protected Preview in the user’s logged-in Chrome session rendered the
  visible score-entry flow and rejected spread `122` before review. It made no
  persistent score submission or hosted configuration change.

## Findings

| Area | Result | Release meaning |
| --- | --- | --- |
| Activation procedure permissions and lock ordering | No new P0/P1 defect found in the reviewed implementation. | Still gated off; static and isolated evidence are not public-release authority. |
| Fragment credential boundary | The source is release-gated, same-origin, no-store/no-referrer constrained, and covered by regression tests. | Requires enabled-route browser tracing before any release. |
| Registration closure / signup retirement | The actual isolated procedure atomically closed both states and exact replay produced no duplicate lifecycle records. | Requires independent-session/concurrent claim-vs-close proof. |
| Preview score entry | The logged-in desktop smoke matched the visible winner/keypad/derived-result contract and rejected an impossible number. | Requires phone, real-session, persistence, confirmation, reconnect, and accessibility evidence. |
| Product-wide readiness | No. | Official ACC fixtures, rotations, hybrid/offline and paper capture, finance/results/export/finalization, retention, and release operations remain incomplete. |

## Current non-waivable gates

1. Do not enable public registration or account activation until their
   independent browser-session, contention, and enabled-route credential
   evidence is recorded against an isolated backend.
2. Obtain dated ACC authority and approved fixtures before implementing or
   enabling rotation, qualification, payout, dispute, or reporting decisions.
3. Build and verify the required hybrid/offline/paper, financial, results,
   export, retention, accessibility, backup/restore, monitoring, rollback,
   and supervised-tournament workflows.

## Conclusion

No new P0/P1 defect was found in the explicitly reviewed current activation,
registration-close, and visible score-entry slices. The app is **not
production-ready**. The remaining gates are required capabilities and real
operational evidence, not cosmetic follow-up.
