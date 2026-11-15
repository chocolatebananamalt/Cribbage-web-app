# Shared-pilot migration packet: 0090–0105

**Status:** explicitly owner-approved and applied to the shared pilot on
2026-09-10. Retained as the checksum-pinned application record. Post-apply
evidence is in
`../quality/2026-09-10-shared-pilot-0090-0105-application.md`.

This was the single consolidated replacement for
`PILOT_MIGRATION_PACKET_0090_0103.md` and its 0104/0105 amendments. It is a
historical application record, not standing permission for another database
change. Any later migration still requires its own reviewed scope and owner
authority.

## Why this packet exists

Before this application, the shared pilot ended at logical migration
`0089_foreign_key_coverage`.
The immediate containment objective is 0096–0098: those revoke authenticated
browser execution of seven incomplete Rule 12 correction functions. The
preceding activation foundations and following private correction/assigned-game
safety foundations are ordered dependencies. Do not cherry-pick the revocations
or apply the later files out of sequence.

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
| 0104 | `0104_rule12_disposition_and_qualification_notice_contract.sql` | `fd228da33c101f9669514df00f0833d4e105c2e8cb564e88260fa51bf2a408d6` | Keeps Rule 12.2(g)/(i) as effects, not standalone dispositions; limits qualifying-change claims. |
| 0105 | `0105_rule12_apparent_qualifier_contract.sql` | `cd0795d44ef4eebc82e06bebcd47b3e9522560b0909b6194ba7cadec442bc892` | Preserves source-required apparent-qualifier card sides with no new callable surface. |

## Required before approval

1. Recompute every listed checksum from the reviewed branch; reject any mismatch.
2. Capture the shared pilot's read-only migration history, grant inventory,
   advisor output, and non-personal scope baseline.
3. Re-run the whole range, not a subset, against the synthetic validation
   project. Confirm the seven named correction functions have zero
   `authenticated` execute grants and no new anonymous/browser table access.
4. Investigate rather than silently rewrite any pre-existing private correction
   row that uses former `12.2g`/`12.2i` values or cannot satisfy the new
   apparent-qualifier shapes.
5. Confirm the Vercel build either remains compatible or its dependent routes
   are deliberately held closed.
6. Obtain explicit owner approval for this named range and maintenance window.

## Required post-apply evidence

Repeat migration-history, grant, advisor, and narrowly scoped synthetic
contract checks immediately after the shared-pilot application. Record the
deployment identifier, final history, evidence, and limitations in
`docs/quality/` and `PROJECT_STATUS.md`. Keep all staged release switches off
unless a separate approved packet explicitly covers them.

## Recovery posture

This is additive plus permission revocation. If compatibility fails, keep
dependent application surfaces unavailable and use a reviewed forward repair.
Do not delete pilot data or restore deprecated callable correction functions.
