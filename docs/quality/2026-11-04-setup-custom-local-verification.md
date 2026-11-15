# Local setup clarity and payout selectors — 2026-11-04

Unpublished local checkpoint. No hosted records read/written, user session interaction, database fixture, migration, invitations or funds.

## Verification
- Full `pnpm verify`: PASS, 1,430 application tests, 8 workspace tests; lint, production build, provider readiness and dependency audit passed. Build also ran six handoff checks.
- Explicit `pnpm verify:handoff`: 6/6 PASS.
- Independent review: amendment Custom validity P2 was found and closed; no remaining P1/P2 findings. Five pure selector tests independently passed.
- Standalone Side editor browser: 320/390/768/1440 widths, normal/200% text PASS; exact Custom label, absent unsupported Equal options, presets, empty required input, multidigit canonical 10, unsupported7 rejection, typing focus, no clipping/API/storage.
- Full setup browser: final receipt must be consulted for amendment/recovery acceptance. These are local intercepted APIs, not provider/database acceptance.

## Limits
See `docs/decisions/2026-11-04-setup-custom-payout-checkpoint.md`. Arbitrary ratios are not yet supported across setup, recipient calculation and accounting. No newly approved minimum or maximum. Existing canonical preset codes/text only; Q Equal preserved. Satellite advertised payout is not an automatic award calculator. Existing prize declarations remain required; workbook-based replacement controls are unfinished.

The seating trial scope proposal is separate, unexecuted SQL and excluded from the setup UI checkpoint.
- Final full setup browser PASS: 320/390/1440 at100/200% text, both save controls, cross-button singleflight, retained exact retry/reload, accepted/rejected/error states and timestamps, QEqual preservation, Custom validity and row cleanup, and post-finalization amendment invalid7 rejection plus exact retained retry.
- Existing save/fee/pool persistence regression PASS: 36 local mocked cases (12 scenarios ×390/768/1440), including valid fee readback, legacy Side/recovery, mismatch/lost response/newer revision/corrupt sidecar, rejection, save/reload and declaration-before-activation. Test expectations were updated for the two intentionally repeated statuses and removed Side Equal options; no app changes were made to obtain that pass.
- All browser evidence is local mock transport, not hosted/provider/database acceptance.
- Final lint after browser-harness edits exited0: zero errors,97 warnings in existing/separate checkpoint files; no warning in the new setup selector components.
- Local setup browser cleanup verified: server PID19036 absent and local test ports clear (cleanup.json).
Latest exact-label follow-up changed only Q's visible selector heading to `Pool Type` (Side/Satellite `Payout`). Final focused selector tests5/5 passed; responsive/recovery harness and type check rerun after this text-only correction.
