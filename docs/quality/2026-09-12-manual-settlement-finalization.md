# Manual Settlement Finalization Evidence

Date: 2026-09-12
Environment: local shared worktree; migration not applied to hosted Supabase

## Acceptance criteria

- Only a current director or co-director can read or finalize the private event settlement.
- Finalization binds exact current qualification, playoff, settlement-draft, payment, and expense versions, including symmetric equality of the active payment/expense event-ID sets.
- An open dispute, incomplete MRP claims, stale or changed snapshots, payout mismatch, non-conservation, or over-allocation fails closed.
- The record is immutable, versioned, audited, and exact-retry safe.
- Exact accepted and rejected receipts replay for a still-authorized official after tournament closure; only new operations are lifecycle-gated.
- Equal-value payment and expense replacements are rejected when their immutable source-event identities differ from the reviewed draft.
- Revoked officials cannot replay an earlier accepted receipt; the rejection handler re-locks and revalidates tournament authority before receipt lookup or persistence.
- The protected browser flow preserves and reconciles an unresolved exact request.
- The interface and stored response explicitly deny automatic calculation and ACC submission.

## Verification

- `node --conditions=react-server --test --experimental-strip-types tests/settlement-finalization.test.mjs` — PASS (5/5).
- `pnpm exec tsc --noEmit` — PASS.
- focused ESLint over the adapter, two routes, settlement page/client, and regression test — PASS.
- `pnpm test` — PASS (381/381 application tests in the final full verification run).
- `pnpm build` — PASS; the production build includes both private settlement-finalization routes and the protected settlement screen.
- `pnpm verify` — PASS: dependency audit, lint, 381/381 application tests, production build, 6/6 workspace tests, and 6/6 handoff-integrity tests.

## Limits

The rollback fixture requires an isolated hosted test transaction with an existing finalized Standard Singles qualification and the preceding migrations through 0145. It transactionally proves that an already-revoked official cannot replay an accepted receipt. A true mid-error concurrent authority revocation is not simulated without an unsafe multi-session harness; static regression instead proves the exception handler's tournament-lock → role-lock → receipt-lookup ordering and its fail-closed exits. No hosted migration or real tournament data was changed in this task. Independent-session and browser evidence remain required after deployment to a test backend.
