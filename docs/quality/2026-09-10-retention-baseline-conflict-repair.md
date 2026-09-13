# Paper Evidence Retention Baseline Repair — 2026-09-10

## Finding

The new paper-scorecard OCR decision said that retention was an entirely open
implementation decision. That conflicted with the existing normative
requirement `R-RET-01`: until an ACC retention duration is approved, restricted
evidence remains on hold with no automatic purge.

## Resolution

The paper-scorecard capture contract now inherits `R-RET-01`. It requires
restricted storage and access control, prohibits a guessed automatic-deletion
period, and requires any future deletion or restore implementation to use the
existing audited authorization/hold rules. The still-open issue is the future
ACC-approved duration and the technical implementation of storage, restore,
and deletion—not whether a default retention policy exists.

## Verification

Source review confirms the paper-capture decision and project status now use
the same restricted-hold/no-automatic-purge language as
`docs/product/production-requirements.md` section 10. This is a requirements
consistency repair only; no card image storage or OCR service has been enabled.
