# Results and finalization contract — 2026-09-09

## Decision

Results, qualifier lists, payout amounts, PDFs, and ACC export artifacts are
not authoritative because a page displays them. They require a server-managed
event result version with lifecycle:

`Draft → Reconciled → DirectorApproved → Published → Superseded|Withdrawn`.

Only a published version may be shown to permitted signed-in viewers. Each
version must identify its event, scoring method, approved ruleset/fixture
version, source game/result inputs, approving director, timestamp, and prior
version where applicable. A correction after publication must create a
superseding version, never overwrite history.

## Mandatory release gates

- Standard Singles publication verifies every included game, no unresolved
  disputes/correction approvals, approved standings fixture, reconciled finance
  inputs, and a current director approval in one server transaction.
- Qualifier/MRP/Q-pool/payout calculations and high non-qualifier output are
  blocked unless their dated ACC fixtures are approved. No default math may be
  inferred from the prototype.
- Export validates duplicate identity, score bounds, result version,
  reconciliation, and approved export mapping before producing an immutable
  `acc-results-v1` artifact. Automatic ACC submission remains prohibited.
- Manual/imported or non-singles events remain visibly labeled and cannot be
  represented as digitally verified until their dedicated rule fixtures exist.

## Current status

No writer, read model, PDF generation, export, or finalization transaction
implements this contract yet. Existing prototype screens and sample PDFs are
demonstration material only.
