# Local V2 whole-finishing-group proposal history

Scope: pure proposal calculation and append-only history validation. No SQL,
provider, storage, UI, hosted action, recipient assignment or payment change.
Independent financial review and integration are owned by the lead.

Acceptance: the complete retained source and raw input must equal the separately
supplied current basis. Unknown/changed sources block without mutation or rebase.
Each reasoned UUID record covers one exact actual paid finishing group, follows
that group's latest prior record, and uses the selected regular $1/$5/$10 step.
Explicit zero differs from absence. Corrections, void and reopen append; void
restores the calculated source amount. Extension requires an unchanged complete
history prefix. No automatic redistribution, refund or changed qualification.

`calculatePlayoffPrizeProposalsV2(retained, current)` and
`isPlayoffPrizeProposalExtensionV2(previous, next, current)` are exported from
`src/lib/results/playoff-prize-proposals-v2.ts`. The exact 13 source fields and
complete `input` are the existing `buildPlayoffPrizeProposalBasisV2` handoff.
The established MainCon whole-band record and lineage semantics are reused,
without importing the old fixed-$5 calculator or a hypothetical fee source.

Balance, paid/positive counts, rank ordering, zero awards and manual distribution
changes are separate outputs. `manualDistributionChanged` compares adjusted
amounts against calculated SOURCE ROUNDED amounts. Untouched natural rounding
does not trigger a manual method warning. Unequal adjusted Equal bands report
`equalTreatmentViolation`; changed graduated/Equal/Winner Multiplier amounts
require method review, and altered Winner Multiplier relations report a separate
review warning. Balance never grants consistency or authority.

First-round intention is checked against ADJUSTED amounts when the supplied
source already contains applicable reviewed loser-place and entry-fee evidence.
Pending evidence/fee, missing choice and incompatible increments remain pending.
The current real qualification-only basis supplies null fee and loser-place
evidence; this module does not manufacture either. All authority flags remain
false on success and rejection.

Executed 2026-11-08 on Windows, bundled Node 24, offline:

```text
node --conditions=react-server --experimental-strip-types --test tests/playoff-prize-proposals-v2.test.mjs tests/playoff-prize-comparison-v2.test.mjs tests/maincon-fund-proposals-v2.test.mjs tests/playoff-prize-proposal-basis-v2.test.mjs
exit 0: 32/32 tests, including 15 new proposal/history cases.

node node_modules/eslint/bin/eslint.js src/lib/results/playoff-prize-proposals-v2.ts tests/playoff-prize-proposals-v2.test.mjs
exit 0, no diagnostics (rerun after final integration fixture added).

node node_modules/typescript/bin/tsc --noEmit --incremental false
exit 1: concurrent lead-owned playoff-prize-native-read-v2.ts:14 unknown
value.capture; :17 missing inferred source.tournamentId/eventId. No diagnostics
in this module. Lead notified; integration typecheck remains pending.
```

The actual basis-builder fixture proves the saved V2 policy, isolated regular
ledger fund and finalized qualification feed directly into a balanced explicit
override, retain unknown fee/loser facts, and reject later ledger corrections.
Other coverage includes every source pin and complete raw input drift, all
increments, exact groups/paid cutoff, zero/void/reopen, global ID/per-band prior
errors, prefix edits/truncation/reordering, adjusted intention, balanced method
warnings, malformed/accessor/sparse/oversized values, exact near-safe-integer
cents, overflow and detached outputs.

Full repository `pnpm verify` is not rerun by this bounded worker: its network
audit was previously denied and is not retried. Integrated build, repository
checks and independent review remain the lead's gates. No new policy decision
is required to retain proposals; acceptance/approval of adjusted distributions
and any future authoritative fee/first-round source remain outside this slice.
