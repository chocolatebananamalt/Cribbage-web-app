# Proposed shared-pilot migration packet: 0090–0103

**Status:** prepared for future review; **not approved** and **not applied** to
the shared pilot.

This packet implements the procedure in
`PILOT_MIGRATION_CHANGE_CONTROL.md`. It makes no change by itself. A project
owner must explicitly approve this exact ordered range, its environment, and a
maintenance window before it may be used.

## Why this packet exists

The shared pilot currently ends at logical migration `0089_foreign_key_coverage`.
The source and separate synthetic validation database have migrations 0090–0103.
Most urgently, 0096–0098 remove direct authenticated access to incomplete Rule
12 correction functions. The range must be applied in order, not selectively,
because later correction-projection and assigned-game-context safeguards depend
on the earlier foundation.

## Exact ordered files and SHA-256

| Order | File | SHA-256 | Plain-language purpose |
| --- | --- | --- | --- |
| 0090 | `0090_roster_account_activation_private_schema.sql` | `b64c9b764eda97844b64f561dfc5c0d393834de94ac25159a46e28f0c4c6a8a9` | Adds private, witnessed account-activation storage. |
| 0091 | `0091_roster_account_activation_issue_rpc.sql` | `b351df38fed37a1c6b3f037a07a6eead9dae731e59c7ae84b208ca139c563f7e` | Adds service-only activation issuance. |
| 0092 | `0092_roster_account_activation_redeem_rpc.sql` | `fcbcb13f7405cf7682fcd9ab14450c2fd5e6164144affe781d8c8c9583ca7cb5` | Adds service-only activation redemption. |
| 0093 | `0093_roster_account_activation_private_link_writer.sql` | `402ea3d3cd886f64ec82433e3190cf5f52900e9292a2a7c4636dc9b71f99fef2` | Adds the private activation-to-roster-link writer. |
| 0094 | `0094_roster_account_activation_approval_rpc.sql` | `e663cc0e0e1f5286efe6c5e412da3f3fa4614ea8f338ae96339f8326a9fcfebc` | Adds witnessed approval. |
| 0095 | `0095_roster_account_activation_cancel_rpc.sql` | `e062996ba070fc41ca2bbd417425a83664db4fe0cb8d568e64314508b41ff09a` | Adds safe cancellation. |
| 0096 | `0096_suspend_incomplete_rule12_corrections.sql` | `e38ecb9c9158d95120ce713a344d0cc244226ccab4a5b8a49b1731db748dd4c7` | Revokes direct correction proposal/review execution. |
| 0097 | `0097_suspend_incomplete_rule12_correction_policy.sql` | `8b485a5c3fe2b6d22d576fe82894f358da426a511959617680a9b2dbe59dc7d0` | Revokes direct correction-policy execution. |
| 0098 | `0098_suspend_incomplete_rule12_correction_readers.sql` | `50d9ba5fe2076fb7c99d946ba1e945501f381598ecd273aa871ccb834715d815` | Revokes incomplete correction workspace/reconciliation readers. |
| 0099 | `0099_independent_card_correction_projection_foundation.sql` | `df9cbbcd87f7e99f16cc986efad494ab9a93014fb69e38a5facde62c573ed0e2` | Adds private independent-card correction projection foundations. |
| 0100 | `0100_independent_card_correction_projection_invariants.sql` | `2e4070fcb664327e3650e84e29009fae15f2c311635c524be6b0f8e6313cfdd6` | Adds invariant triggers for that projection. |
| 0101 | `0101_independent_card_correction_claim_preservation_repair.sql` | `2fabdaf635ce6726c868bffaa861a2c2eec34ea3813ac1e60e11ecf81490e2b1` | Preserves correction claims across projection changes. |
| 0102 | `0102_independent_card_correction_trigger_context_repair.sql` | `5a81cc5255dc65709214e08edc448c13f4f59d60ecc5455ac4a8d9882ccfcac5` | Repairs trigger context for projection writes. |
| 0103 | `0103_assigned_game_context_actor_scoped_retry.sql` | `50b760efc2bed5a0666d7d1b33cad53020e5888305eb63fffc1d46801aa9dc48` | Binds assigned-game context retries to the caller. |

## Current evidence and preflight

- Shared pilot, read-only checked 2026-09-10: latest logical migration is
  0089; seven incomplete correction functions retain authenticated `EXECUTE`.
- Separate synthetic validation database, read-only checked 2026-09-10:
  migrations through 0103 are applied and the same seven-function grant check
  returns zero.
- Source verification after the latest API hardening: `pnpm verify`,
  `pnpm verify:handoff`, and `git diff --check` passed; GitHub Actions is the
  independent clean-clone confirmation for each pushed commit.
- The application already fails closed where its current pilot schema cannot
  meet the newer contract. Enabling any staged feature is outside this packet.

Before approval, capture a fresh shared-pilot migration history, function-grant
inventory, security/performance advisor output, and synthetic-data scope.
Verify every file hash above against the reviewed branch immediately before
application.

## Required validation after a separate-environment apply

1. Confirm migrations 0090–0103 appear exactly once and in order.
2. Confirm all seven named correction functions have no `authenticated`
   `EXECUTE` grant, while the reviewed current functions retain only their
   intended grants.
3. Run the documented rejection and replay checks using synthetic data only.
4. Confirm no anonymous table access, no unexpected exposed function, and no
   new critical advisor finding.
5. Clean up all synthetic probes and record the resulting empty/safe scope.

## Required shared-pilot maintenance evidence

After explicit approval and the identical ordered apply, repeat the same five
checks on the shared pilot. Then deploy only the reviewed compatible build and
perform the named browser smoke checks without a score, payment, or public
registration mutation unless the approval specifically permits a synthetic
test. Record the deployment identifier, final migration list, all advisory
results, and remaining limitations in `docs/quality/`.

## Recovery posture

This range is additive plus permission revocation. If a compatibility issue is
found, hold the dependent application surfaces closed and use a reviewed
forward repair; do not roll back by deleting data or recreating deprecated
callable functions. A restore plan is required before any irreversible action
outside this packet.
