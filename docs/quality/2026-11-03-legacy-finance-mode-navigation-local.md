# Legacy finance navigation guard — local only

Acceptance: after existing tournament/role authorization, enrolled multi-event simulation tournaments must reach their simulation finance workspace before historical finance loaders execute. Only exact verified `not_enabled` may continue to legacy finance. RPC failure, unknown mode, or unavailable credentials must not fall back. Production and other backend deployments retain existing behavior. Existing member access must not narrow or widen.

Implementation: `src/lib/api/require-legacy-finance-mode.ts` is server-only and uses the existing synthetic deployment guard, verified page actor, admin finance-workspace RPC, and shared finance classifier. Simulation redirects to the same tournament's Payments page. Unknown mode fails closed with Next `notFound`; redirect/notFound control-flow signals are outside the RPC catch.

Bounded page integration (all under `src/app/tournament/[tournamentId]`):

- `q-pool-policy`, `q-pools`, `q-operating-schedules`, `q-obligation-reviews`, `q-obligation-reviews-v2`
- `side-pools`, `side-pools/recipients/[eventId]/[poolId]`
- `prize-schedules`
- `events/[eventId]/q-accounting-v6`, `no-q-accounting-v7`, `prize-accounting-v8`, `prize-accounting-v9`, `settlement`, `settlement-v5`

The first independent review found that prize schedules permit ordinary tournament-member reads whereas the classifier RPC requires Director/coDirector. Corrected by invoking the guard only for those existing official roles on the prize-summary page. All other 13 pages already reject non-official roles before the new guard. No role grants or changes to finance RPC authorization were introduced.

Executed checks:

- `node --conditions=react-server --experimental-strip-types --test tests/require-legacy-finance-mode.test.mjs tests/simulation-finance-dispatch.test.mjs`: 7/7 pass. Executes actual transpiled helper; verifies actor/tournament forwarding, production/wrong-backend bypass, exact non-enrollment, simulation redirect, errors/throws/unknown-mode blocking, source integration ordering across all 14 pages, and actual prize-summary rendering for player/viewer/cross-checker/judge/Director/coDirector.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: pass.
- `node node_modules/eslint/bin/eslint.js src tests next.config.ts eslint.config.mjs`: 0 errors; 63 existing warnings outside this patch.
- `git diff --check`: pass (line-ending notices only).

Limitations: local page-level routing verification, not hosted or real-backend acceptance. Root owns integration full verification and final independent review. Member-facing new-mode prize publication remains unimplemented; ordinary members retain the unchanged historical/current legacy summary route. Unknown mode renders the existing 404 behavior rather than a custom finance-unavailable screen. No API/export changes, new database probe, backend writes, publication, or production changes. Payments, root navigation, setup clients, and new preview implementations were untouched by this patch.
