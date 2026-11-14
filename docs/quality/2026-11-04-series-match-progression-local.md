# Source-bound playoff match progression — local only

Acceptance: project individual verified game winners using the correct saved
regular/final format; never count a game from another event, opponent pairing,
format snapshot or match generation; stop at the required wins; preserve ACC
format warnings; synthetic evidence cannot become genuine play or advancement.

`series-match-progress-v2.ts` binds full current and retained source DTOs. Each
game must share event, match, immutable match generation, ordered participant
pair and settings snapshot. Round selection uses regular format for semifinals
and separate Final settings for the final. Unknown/stale/review-required source
blocks; posted approval flags are rejected rather than waiving ACC rules.

Independent review found old A-vs-B wins could be reused after rebinding a match
to A-vs-C. Adding per-game participant pairs and generation pins closes that
case, including rematches involving the same pair. Six new pure test groups pass,
including exhaustive winner sequences from 1-of-1 through 5-of-9 and rejection of
post-completion results. These informal Custom tests do not approve ACC formats.

The pure projection has no bracket advancement, result writing, verification or
official approval authority. A future consistent authorized reader must provide
real immutable generation/provenance; do not manufacture these fields for legacy
aggregate results or trust client assertions. Current public result writers and
bracket adapters are not changed. No UI changes in this checkpoint.

No new database fixture, SQL execution, hosted read/write, migration, publication,
invitation or financial action. The pending settings/Finance database approval
and paid-place policy question remain separate and unanswered here.

Final `pnpm verify` exited 0: 1,510 application tests, dependency audit,
ESLint (zero errors), provider readiness, production build and eight workspace
checks passed. Six local handoff checks passed. Logs:
`test-results/series-match-progress-final2-verify.log` and
`test-results/series-match-progress-handoff.log`.
Independent focused review passed 12 old/new series groups and confirmed the
pair/generation finding closed. This remains source-level local evidence, not a
database/provider or human acceptance result.
