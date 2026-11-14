# Current rehearsal opponent visible above the scorecard

Private UI-only change. The player scorecard now places the current practice game number, opponent name, fixed Tournament ID and existing incomplete/disputed status above the table. Its existing Open Current Practice Game link moves there from below all twelve rows. The link uses the same validated target scope and projected currentGameId as before.

The current summary requires allSourcesAvailable, an exact currentGameId match and a pending/mismatch row. Completed, unavailable and upcoming rows are never inferred to be the next game. The summary/action disappear for unavailable/disabled cards. No new fields, polling, database changes, transport capabilities, scoring, eligibility, result calculation or Finance rule were introduced. Existing component identity/epoch guards are unchanged.

Verification:

- Extended actual React SSR helper checks correct source-backed opponent/ID and exact link before the table; pending, disputed and a later upcoming row; finished/unavailable/disabled cards hide the action. Nearest scorecard/route tests: `test-results/native-mixed-current-game-20261109/tests.log`.
- Scoped TypeScript includes both changed components; lint passes. Independent read-only reviewer found no concrete issue.
- Actual React about:blank offline browser checks at 320/390/768/1440 widths and 100/200 percent text passed, including long opponent names, wrapping, above-table placement, exact current href, keyboard focus, excluded incomplete totals and unavailable clearing. Evidence: `test-results/native-mixed-current-game-20261109/browser-result.json` and screenshots. Next Link is replaced by an ordinary anchor in this isolated browser harness; no provider, database, external request or real-device navigation is claimed.

This narrowly changes presentation; the preceding full application/build/database proofs were not needlessly repeated. Required chained pnpm verification remains unavailable in this shell, and the previously denied audit was not retried. The 216-file frozen public candidate and the disabled correction SQL/source checkpoint remain separate. No hosted or publication action occurred.

The next correction extension would need an append-only independent disagreement record for paper re-entry that differs from an internally consistent capture; today no accepted mismatch is persisted in that case. It is an implementation/verification gap, not permission to overwrite evidence or to ask reviewers to enter the wrong value. Late/completed corrections, additional-approval workflow and a participating Director remain explicitly unsupported. No new owner policy decision was needed for this display change.
