# 2026-11-10 Native digital Main loss → linked Consolation checkpoint

## Scope and observable acceptance

The next populated Consolation test needs actual current Main per-game losses to admit the correct linked players before Consolation starts. Preserve legacy admissions, capture immutable typed provenance atomically at Start, reject stale/late/wrong-event evidence, and freeze all consumed result ancestors. Keep the candidate private and default-off. This is ordinary digital protocol evidence, not the separate mixed-paper rehearsal ledger or proof of physical play.

## Finding and implementation

0292 eligibility reads the legacy `linked_main_series_v1` ledger. Configured Main playoffs require newer game-level evidence and cannot safely fabricate a legacy aggregate result to pass that check. Added `database/proposals/native-linked-consolation-digital-loss-v1.sql` as a private proposal, preserving legacy delegates and bridging only pending Main-five early-round losers (slots 1–3). It requires current qualification, exact current generations, completed individual-game proof and recursive parent pins. Start inserts typed FK-bound companion records in the same transaction; later source readers require those companions. Consumed ancestor generations cannot be replaced. New access is revoked and the gate remains literal false. Synthetic/physical provenance remains unknown, never falsely attested.

Independent source review found timestamp serialization could vary by session timezone. Native captures/proofs now pin UTC; compatibility wrappers retain caller timezone and invoke separate UTC delegates only for native-specific sources. A malformed delegate dollar quote introduced during that correction was fixed before the final install check.

## Verification and limits

Two dedicated scripts reuse the established network-none local Docker fixture harness: `tests/launch-native-consy-bridge-local.mjs` and `tests/run-native-consy-bridge-isolated.mjs`. No mounts, ports, provider, hosted project or real money. First check installed earlier proposal hash 2eea3c21..., verified default-off and revoked direct access, then removed DB/container. Final source hash and result are recorded below after the corrected check.

This is an installation/permission checkpoint only. No populated admission, normal Start, 72 Consolation qualifying matches, four-qualifier playoffs or funded final-award reconciliation has passed for this proposal. No UI/provider/hosted acceptance. Full pnpm verify not run (pnpm unavailable; no dependency audit retry).

## Next bounded runtime

Use the existing Main18/12 actual digital fixture, then assert actual early losses and 13 nonqualifiers produce 16 linked Consolation entrants; normal Con9-game Start and 72 unique matches should yield four qualifiers. Preserve fixed Tournament IDs. A safe funding fixture can prepay explicit combined Main/Con receipts with reviewed separate allocations; do not append a second current receipt, void valid Main money or count the same money twice. Existing receipt semantics allow only one current receipt per roster. This prepaid construction is test data, not a new real-world registration or refund policy. The actual funding and final-award path remains implementation/verification work.

Satellite reconciliation remains blocked on undefined single-recipient/low-fund/tie policy; no substitute formula was invented. No hosted action or publication retry occurred.

## Final checkpoint

Corrected SHA256: 3c165ff9cbba04dacd36cb1df5260beee819a65ad71a27e24176674141a0dd65. Source review GO. Final local runner passed installation, gate false, forced-RLS table presence, anon/authenticated/service_role SELECT/EXECUTE rejection and native-only UTC vs legacy-wrapper timezone metadata assertions. Evidence: test-results/native-consy-bridge-2026-11-10T05-10-07-533Z (trace.json, cleanup.json, final-db-counts.txt). Database and exact container absent by ID/name; runner exit 0. This does not prove populated nonUTC digest parity or populated Con flow.
