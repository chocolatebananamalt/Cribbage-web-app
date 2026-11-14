# Versioned prize-plan draft/save and Finance boundary

## Implemented locally

A separate event-prize-settings-setup-v1 envelope nests the full existing EventSettingsSetupV3 without projecting or retyping it. It adds a distinct outer operationId, prior V3 settings/prize snapshot IDs and opaque digests, and exact Main/Consolation coverage. Each event either proposes a raw PlayoffPrizePlanDraftV2 or explicitly preserves historical data. Satellite and optional-pool configuration remain in the exact nested setup; no policy is substituted.

Canonical serialization and recovery are account/operation-bound, immutable on parse and byte-limited. The complete new envelope has its own WebCrypto SHA-256; never reuse a nested V3 hash. The new acknowledgement requires both complete envelopes, matching planned carry, the new setup revision/version, fresh settings/prize snapshot identities and matching digests. This is a draft-only acknowledgement, never activation or an amount/payment approval. Raw typed text, including inactive or incomplete controls, is retained; estimates/award amounts cannot be added to the strict draft shape.

The pure snapshot planner has no IO. prior=null is only valid when a future authenticated same-lock reader has proved absence. A non-null expected prize snapshot cannot be erased by null/undefined input. Preserve carries the matching prior event and kind; a changed kind requires review. No previous V2 record yields legacy_checks_required, never default invented prize settings. Event deletion removes only its entry from the prospective new snapshot; immutable previous snapshots stay intact.

The Finance projection matches the canonical event/client-row/kind relation, setup revision/version, both IDs/digests, and the complete current finance source and payout-source pins. A proposal remains review-only, with no fund/award amounts in the output and no conversion to legacy MainConSourceSettings. It must not authorize legacy fallthrough. Source/pin comparison is not proof of provider identity, ledger validity or database absence. All new feature flags are literal false.

## Required transactional implementation before enabling

- Authenticate the existing authorized director role; lock current setup, V3 settings and prize head. Independently verify prior IDs/digests and absence under the same lock. A posted base/null is not proof.
- Validate the complete canonical new envelope and its own operation key/hash. Exact same-operation replay returns the exact stored result; changed bytes under the same key reject. Do not invoke a legacy endpoint first and append prize data later.
- In one transaction, save the nested draft and immutable prize snapshot, advance heads with expected-version checks, and write actor/time audit metadata from the server. Any failure rolls back both. The source codec alone proves none of this.
- Every older setup writer needs reviewed compatibility: carry V2 plans by stable event row/kind or reject rather than drop them. Activation/finalization must see a pending V2 plan and block legacy calculation until the new method is supported. A new Main/Consolation needs explicit coverage, not a silent old default. Preserve historical disclosures and closed-event protections.
- Canonical client hashing is compact sorted JSON UTF-8. Do not assume PostgreSQL jsonb::text produces identical bytes. Verify raw request/hash handling and digest lineage at runtime before release.
- Bind real event mappings and reviewed bracket/result generations in the authenticated assembler. Include the existing finance audit/basis and fee-coverage guards in operational calculation. Caller-supplied IDs/loser places are not evidence.
- Version optional-pool rounding separately. V2 rounding controls must not reinterpret historical $5 snapshots or overwrite current Q/Side rules.

## Remaining policy and acceptance

Rounding residue/shortfall and strict-versus-informational entry-fee comparisons remain unresolved. No formula or outcome has been invented. Recipient group equality stays the owner's current design; no third-place match is introduced. The layout remains unchanged.

No database/SQL/route or grants are created. Runtime transaction, concurrency/CAS, rollback, durable storage and signed-in provider acceptance are future implementation/verification gates, distinct from the still-pending mixed-rehearsal database approval. No mixed fixture is created by these source tests.
