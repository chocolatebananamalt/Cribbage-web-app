# Settlement Working Copy v3 verification

Date: 2026-09-12  
Environment: local Windows worktree and approved Supabase pilot

## Acceptance evidence

- Immutable version-bound MRP claims accept whole nonnegative points and require a trimmed source/evidence note.
- Blank claims are omitted while an explicit zero is preserved.
- Every MRP claimant is a qualifier in the exact locked qualification result; placement and Q-pool constraints continue through the v2 settlement authority.
- The writer checks current director/co-director authority before receipt access, uses an event-scoped lock and expected version, persists accepted/rejected receipts and audits, and audits changed idempotency reuse.
- The reader and reconciliation calls remain service-only and tournament/event/actor scoped.
- The UI stores the complete request, including MRP rows, for exact retries and restores server-authoritative values after a definite rejection.
- The private CSV identifies schema/version/source IDs, separates qualifying ranks from playoff placements, includes provisional money and MRP claims, server cash snapshots, all blockers, formula neutralization, and a deterministic canonical-source digest.
- CSV generation fails closed unless the draft's exact qualification version matches the fetched qualification and the draft's non-null playoff result version exactly matches the playoff result supplied by the scoped workspace; latest-result/draft-bound-result mixes cannot be exported.

## Checks

- `node --test --experimental-strip-types tests/settlement-draft.test.mjs tests/settlement-working-copy.test.mjs tests/settlement-working-copy-v3.test.mjs tests/standard-singles-playoff-placements.test.mjs` — PASS (17/17).
- `pnpm exec tsc --noEmit` — PASS.
- `pnpm lint` — PASS.
- `pnpm build` — PASS.
- `pnpm test` — PASS (365/365 application tests).
- `pnpm verify` — PASS (audit, lint, 365 application tests, production build, workspace and handoff-safety checks).
- `pnpm verify:handoff` — PASS (6/6 private-handoff integrity checks).
- `git diff --check -- <v3 files>` — PASS; Git emitted line-ending conversion notices only.

## Hosted proof

Migration `0141` was applied to the approved Supabase pilot on 2026-09-12. Its
rollback-only proof passed as part of a complete synthetic chain seeded with
qualification and playoff results. It verified exact replay, rejection replay,
changed-key conflict audit, qualifier scope, explicit-zero versus missing MRP
claims, immutable history, scoped reconciliation, and private grants. The
transaction retained no synthetic data.

The post-DDL Supabase advisor identified one duplicate unique index because
`0139` already supplies the exact composite uniqueness required by `0141`.
The redundant `0141` declaration was removed from source and its hosted
constraint was dropped by the recorded
`remove_duplicate_settlement_qualification_index` migration. A repeat
performance-advisor scan reports no warning/error findings. The complete
qualification/playoff/settlement-v3 rollback chain then passed again against
the hosted pilot, confirming the retained `0139` key still backs both foreign
keys and that no synthetic records were retained.

## Remaining limits

- No MRP, Q-pool, payout, or prize amount is automatically calculated or treated as ACC-approved.
- No event-level cash reconciliation, approval, publication, or ACC submission is exposed.
- An authenticated phone/desktop browser pass remains required after the
  release candidate is deployed. The hosted database test is complete.
