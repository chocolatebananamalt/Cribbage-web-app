# Connected playoff bracket: local candidate, 2026-11-09

## Acceptance and scope

Names and stable Tournament IDs accompany each player. First-round byes are explicit and do not become played wins. The connected diagram and stacked round view lead to one championship. Switching views repeatedly preserves next-match focus. Phone and desktop layouts must remain readable at normal and doubled text. Work remains local, fictional, and default-off; no hosted source, scoring, result, account, access, payment, or publication changes are authorized here.

The working source was located from the active engineering chat at `C:/Users/choco/Documents/Codex/2026-10-22/task/cribbage-director`, HEAD ba2845a plus its existing uncommitted work. The isolated `cribbage-playoff-display-20261109` worktree copied that working source. Its node_modules is a junction to existing dependencies. The original working files were not edited. Do not cherry-pick the entire snapshot or assume all its uncommitted files belong to this task.

## ACC evidence and the larger-field boundary

Checked 2026-11-09: [ACC 2025 rulebook](https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf), Rule 13.2 and printed pages 56-57; [ACC bracket instructions](https://www.cribbage.org/NewSite/rules/playoffbracket.asp); [ACC director resources](https://www.cribbage.org/NewSite/sched/tournament_dir.asp).

The chart labeled 129-256 players describes original entrants, with seeds 1-64. The linked [128-person sample](https://www.cribbage.org/NewSite/sched/128bracket.pdf) contains 32 qualifiers, not 128. The existing verified literal 4/8/16/32/64 seed orders are unchanged. Highest qualifiers retain first-round byes. A larger ACC placement chart was not established, so the existing rejection of more than 64 qualifiers is preserved.

The new geometry helper only partitions an already-sized bracket. It can arrange 128 positions into two 64-position regions, or 256 into four, with the region survivors feeding a single final-round section. It never assigns seeds, evaluates scores, invents results, or makes those larger draws approved or usable. Actual larger-qualifier support remains incomplete pending a reviewed placement source and integration tests. Do not advertise 256-qualifier operation as delivered.

## Files owned by this task

- src/lib/results/playoff-bracket-layout.ts (new geometry only)
- src/components/playoff-bracket-diagram.tsx (new local synthetic diagram)
- src/components/playoff-bracket-diagram.module.css (new scoped diagram styles)
- src/components/local-playoff-preview.tsx (view toggle, repeat-focus effect, clarified blocked copy)
- tests/playoff-bracket-layout.test.mjs (new geometry regressions)
- tests/playoff-connected-bracket-browser.mjs (new isolated browser regressions)
- This quality report and dated additions to status, durable facts, requirements, and decision notes.

## Executed checks

- Node 24.19.0 focused projector/read-model/layout suite: 18/18 passed.
- TypeScript `tsc --noEmit --incremental false`: passed before review adjustments; final rerun recorded below.
- Browser harness final: passed 320/390/768/1440 pixels, 100/200 percent text. Covers exact ID and duplicate-name lookup, five/33/64-qualifier examples, explicit byes, all 63 diagram matches for64, one championship, switch/repeat focus, invalid125-qualifier blocking, no outer horizontal overflow, connector alignment, and zero API/external/storage actions. Receipt: test-results/playoff-connected-bracket-browser/result.json. Screenshots in the same directory.
- Initial browser attempt failed before page compile because Turbopack does not resolve a node_modules junction outside its root. The isolated harness root was corrected to the common task parent; no dependency install or original-source change was needed.
- Independent gpt-6.1-sol review (nearest available Sol): 9/9 projector/layout tests and 32 browser combinations passed. Three findings were fixed: color-only advancement, repeated focus after diagram unmount, and connector misalignment from unequal grid rows. Final independent measured connector mismatch was 0 pixels, with no page or card overflow. No remaining scoped blocker.
- First mandatory pnpm verify stopped before checks because pnpm attempted an automatic dependency reinstall and refused shared-module removal without a TTY. No purge was approved. A second attempt disables only automatic pre-run reinstall and uses the existing dependencies; final outcome follows.

## Not established

No public full-bracket reader, real signed-in/provider/production integration, real-device acceptance, larger-field ACC seed chart, live results, MRP authority, or deployment. This is a local display candidate, not release-ready completion of the broader task.

## Final verification, 2026-11-09

Final TypeScript and focused ESLint passed with zero errors. Full audit reported no known vulnerabilities; full ESLint passed with existing warnings outside these files. The aggregate attempt reached 2,713/2,714 application passes; its sole failure was an omitted local closed-install manifest and its pinned51 SQL source fixtures, not a product assertion. Copied only those missing sources into the isolated snapshot (no SQL execution), then the full application runner passed2,714/2,714.

Provider preflight passed, retaining disabled optional providers. The optimized production build passed with `node node_modules/next/dist/bin/next build --webpack`; this supported bundler avoids the isolated dependency junction/Turbopack-root problem without changing product config. Workspace checks after that build passed7/7 executed with one private-handoff skip. An earlier workspace run before build correctly rejected the absent build manifest; it was rerun after build. The original chained `pnpm verify` was attempted but did not finish successfully; its constituent audit/lint/application/provider/build/workspace stages subsequently passed as recorded, with the explicit webpack difference. No claim of default-Turbopack clean-clone verification or private-handoff verification.

Final browser rerun passed all four widths and both text sizes, including explicit advancing labels and repeated same-match focus. The five-qualifier screenshot was visually inspected at desktop size; it shows three correctly labeled byes and one simulated first-round result advancing into a single championship. Production/public access and actual >64-qualifier capability remain unchanged and unverified.
