# 18-player mock answer-key and paper packet — local verification

Completed 2026-11-04. No database fixture, hosted record, publication, invitation or financial write was performed. The previously denied fresh-fixture action was not retried.

## Deliverables
- scripts/mock-trial-oracle.mjs: standalone Node standard-library oracle, no app calculation imports. Accepts the eventual 18-person draw and actual digital/digital results; scripts only fictional paper/paper and paper/digital outcomes reproducibly.
- scripts/render-mock-paper-packet.py: integrity-checked printable packet. Final unbound template has 15 pages: instructions, 12 fictional cards, digital/digital capture log and reconciliation checklist.
- docs/operations/MOCK_TRIAL_ANSWER_KEY_WORKFLOW.md: inputs, generation, revision and integrity workflow.

## Proven checks
Complete pnpm verify passed: 1,337 application tests, 6 provider checks, 8 workspace checks, build, lint (0 errors, 96 existing warnings) and dependency audit (no known vulnerabilities). verify:handoff passed 6 tests. Oracle scoped lint passed. Independent review found no remaining P1/P2; reviewer independently passed 10 oracle and 7 renderer tests.

CLI checks verified output hashes and refusal to overwrite previous outputs. Missing digital/digital outcomes remain pending, and paper scripts remain stable as actual results, names, funding or exported totals change. Export comparison requires matching source fingerprints; funds check integer conservation, denomination and declared method separately from policy approval.

Rendered and visually inspected all-page template/sample contact sheets, representative full-size card and maximum accepted 160-character alias. Three final PDFs each have 15 pages; all 45 pages passed text-bound checks. Individual cards retain identity, all 12 games, totals, net spread, blank checker field and card hash on one page. Large data rows are 14pt. Final template SHA256: b1a86e2a5598fc6572dd5da5cf5dd88a18e7a9b2454f31a3909537ab928db373.

A pure calculation-only layout sample has 12 DD, 48 PD and 48 PP matches; 144 paper rows and 72 digital own-entry sides. All 12 DD results are pending. This is NOT an actual random draw or operational fixture; actual pair counts depend on the eventual draw. No app export was provided and funds were not configured, so neither app agreement nor completed accounting is claimed.

## Remaining boundaries
Actual random draw and actual DD results are not yet supplied. No actual event answer-key, final qualifiers or payout approval exists. Supplied DD values are not proof of physical play or independent confirmations. Numeric ties retain review requirements; IDs/names/card cuts never select qualifiers.

Supported movement validation is one contiguous opposed-seat 18-person table with one stationary anchor at seat 1. Actual furniture capacity, walking routes, voluntary-anchor fairness and general multi-anchor layouts remain unverified. The tool accepts a supplied draw; it does not generate or certify randomness.

Main/Consolation/Satellite payout parameters, Side Pool distribution discrepancy (95/55/20 versus 85/55/30), equal-share indivisibility, eligibility and retained-balance decisions remain unresolved. Simulated arithmetic never creates receipts or moves money. A controlled Q-Pool backfill outcome cannot be guaranteed when actual DD outcomes vary; do not preselect human winners.

Primary scoring source: https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf, Rules 12.1, 13.2 and Appendix A item 20. Physical movement source is separately reviewed GR Manual 8.1; no certification claimed.
