# Independent review of resumed multi-event local work

Review date: 2026-11-03 UTC. Reviewer: independent Sol review worker, nearest available project routing equivalent. Scope: authorized local implementation and testing only. This record does not authorize hosted migrations, publication, production changes, existing saved-draft changes, or real collection/disbursement.

## Outcome

No outstanding P1/P2 findings in the reviewed current implementation. The bounded local review and required verification gates are satisfied for the hashes below. The integration lead retains responsibility for final documentation, manifest and backup receipts. Hosted rollout and independent-human/device acceptance remain separate.

Reviewed final accounting actions, workspace projection and client recovery; API deployment/origin/verified-subject boundaries; exact acknowledgements; displayed-preview binding; named joint review and saved totals; legacy finance navigation guards; and migrations 0287-0289. Earlier conflict-envelope mutation and stale displayed-preview finalization findings are resolved by separate durable conflict markers and source-digest checks. Ordinary member prize-summary access remains preserved.

## Frozen reviewed production sources

| File | SHA-256 |
| --- | --- |
| `database/migrations/0287_multi_event_unpaid_final_candidate_v1.sql` | `452e829088d885d445f40bf513783133381e6044a0b541abe266fb0bf6af0fa3` |
| `database/migrations/0288_synthetic_joint_unpaid_public_v1.sql` | `64968a9fb60ceb79c4ef702c7ca58f13791d4b5b645270cd0e4b426d6608f6b7` |
| `database/migrations/0289_pinned_event_prize_activation_v2.sql` | `28c438d5e2ddc96e9eca9a99ab78a6102a25f4965bc289e0ef634fab90052dfb` |
| `src/lib/api/multi-event-accounting-action.ts` | `02212d2e7957ec38d07c40f1eefe7e90ad4643e9409c43588ff0cfefb0e828c5` |
| `src/lib/api/multi-event-accounting-workspace.ts` | `262d3aa6bc0aa7f1cfdffcfd3203999444a190136b450427be148711fd405ac5` |
| `src/app/api/v1/tournaments/[id]/simulation-accounting/route.ts` | `ba53b424a94746f483362708be42cb52aabd8bd1005566930f40d60f253fa8c9` |
| `src/app/tournament/[tournamentId]/events/[eventId]/simulated-accounting/accounting-client.tsx` | `d2fa3d2bbefcabf8a2738a5d2c652715c0e575ff00348478aec5c43190885161` |

## Executed and inspected evidence

- Reviewer executed action/workspace/legacy-mode tests: 9/9 passed; actual accounting route harness: 3/3 passed.
- Current `test-results/fullschema-0289-acl-20261103.log` passes helper EXECUTE denial, historical accepted/rejected replay, revoked-role rejection, V1-only compatibility, old single-event backstop and an observed declaration/activation race, with disposable cleanup verified.
- Current `test-results/structured-multievent-7e753d34b44a5013ef01083990da6fcd9f2ef16cff87c6f0a325d399ede5cc23.json` and `.log` pass the real public-wrapper lifecycle: 120 Main and 56 Consolation games, five/four qualifiers, six pools, both source-bound closures/drafts, one atomic unpaid joint final with two snapshots, stale/replay/role/concurrency/source-freeze checks, actual SQL-to-API codecs before and after finalization, and public source-set races. Exit code 0; network disabled, no ports/mounts, database/container cleanup verified. No money, physical play or independent-human review claimed.
- Fresh `test-results/multi-event-accounting-browser/result.json` passes 390/768/1440px mocked-API component checks, including stale-preview finalization rejection, retained conflict markers, uncertain/malformed acknowledgements, exact retry, no-op storage writes, concurrent recovery preservation and enlarged text. Reviewer visually inspected phone/desktop review screenshots. This is local component evidence, not a hosted browser/backend session.
- `test-results/multi-event-resumed-final-verify.log`: audit reports no known vulnerabilities; ESLint has 0 errors and 64 warnings; application tests 1,227/1,227; provider check, production build/TypeScript, and eight workspace checks passed.
- `test-results/multi-event-resumed-final-handoff.log`: 6/6 passed.

The first resumed suite failed two obsolete source assertions. Reviewer inspected the exact test-only delta and independently reran both test files: 17/17 passed. The payment test now proves exact 0286 clone construction and unchanged fallback arguments, then retains all prior void/zero-owed checks against the delegated body. The setup test now requires the additional `declarationChecking` disabled condition alongside busy/pending/activated. Neither change removes the behavior being protected. Production hashes remained unchanged after this delta.

Known fixture limitation: a one-of-two pending correction state cannot be created through the supported synthetic path; the lifecycle instead proves unproven correction rejection. This evidence does not claim independent-human or physical-device acceptance.
