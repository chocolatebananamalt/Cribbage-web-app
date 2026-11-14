# Modern Player and Unpaid-Award UI — 2026-11-12

Local, default-off implementation checkpoint. No SQL executed, hosted systems changed, records submitted, payments moved, or frozen release files changed.

## Connected capability

- Own-player playoff directory and game page now connect normal authenticated routes to the actual modern V3 scoring contract. Existing large-label entry controls retain an exact request before sending, recover lost replies, require separate own confirmation, conceal on identity loss, and never infer paper verification.
- Shared recovery coordinator enforces ownership/write barriers and archive-before-removal. Fresh actions require online status and a fresh matching authenticated view; unknown retained data is preserved.
- Primary-Director unpaid-award page and authenticated service adapter connect actual V3 current fund, reviewed prize proposal, verified sporting recipients and immutable award journal. Separate regular/Q/Side funds remain separate. No disbursement is implied.
- Ordinary Results can display redacted current-source V3 unpaid awards bound to the finalized qualification version. Stale receipts cannot become current Results.
- Exact owned operation recovery validates the immutable historical source, request and award record independently of later current-source drift. Historical recovery produces no current Results.

## Focused evidence

- 11 changed-path tests passed: six player/controller/auth/recovery checks and five award projection/auth/current-proof/history checks.
- Offline Chrome proof at 390 and 1440 pixels passed: retention before send, no auto-send, lost reply recovery, separate confirmation, no premature verification, identity concealment, enlarged-text layout. Zero network requests; fictional injected ports; not real provider acceptance. Evidence: test-results/selected-step-player-browser-v3/result.json.
- TypeScript no-emit and changed-path ESLint passed (one prefer-const finding corrected). Independent review approved player recovery, current award projection and exact historical recovery. Historical recovery still requires current Director/session access and cannot produce Results.

## Limits and next contracts

All page/route/write/results gates remain false; new SQL wrappers remain EXECUTE-revoked. SQL installation, ACL/transaction/provider and signed-in device acceptance are unverified.

The new player path is digital/digital. Existing qualifying manual handoff remains unchanged: Yes/No is tentative, paper transcription and independent cross-check remain required. Ordinary modern playoff games use generation-bound series records, whereas the existing mixed playoff adapter is a separate synthetic five-player rehearsal domain. A genuine ordinary mixed playoff evidence adapter is still required; canonical qualifying or synthetic evidence must not be relabeled as modern playoff verification.

The award review page requires an already-current modern proposal and V3 fund review. Human preparation UI for that V3 fund review is still missing. Recorded-income history and first-round-loser fee-reference cases remain explicit holds. No unsupported policy was chosen.


