# Setup/Finance test-release review â€” local only

## Decision

NOT READY for an enabled setup/Finance test release. The verified local candidate is reviewable, but publishing its current bytes would leave the new capabilities disabled. Enabling them would be a separate code/SQL change requiring review and runtime/provider acceptance. Do not remove the historical declaration controls yet.

This review read local source and existing synthetic evidence only. No SQL, new database, hosted read/write, credential, invitation, publication or money action occurred. Existing draft and historical data were not accessed or changed.

## Exact review manifest

`2026-11-05-setup-finance-release-inventory.json` freezes repository commit, file hashes, ordered SQL, defined tables/functions, explicit/dynamic grants, source roots/import edges and dirty dependency status. Its 79 SQL hashes match the successful `two-active-balanced-final-awards-2026-11-05T13-31-35-600Z/trace.json`:

- 56 existing migrations 0237â€“0292 are verified local prerequisites, NOT instructions to apply them again or a claim about current hosted migration state.
- 23 proposal files below are unnumbered release candidates, NOT authorized hosted migrations. Static extraction finds 46 CREATE TABLE statements and 129 function definitions/replacements. Those counts are source statements, not a final effective catalog/object count.
- Source roots: setup page; disabled event Finance page; new settings, ledger, Finance/adoption/fund-review/final-award API routes; existing expense/payment/amount-owed clients and their authenticated handlers. The manifest includes transitive local TS/TSX/CSS dependencies.
- Clean dependencies are not patch files. Dirty shared files require exact hunk isolation; the worktree includes unrelated label, seating, mock, bracket and other changes. This import closure is an exact hashed review inventory, NOT a safe wholesale commit/deploy allowlist. An isolated clean checkout and reviewed diff against the intended deployment base are still required.
- Eleven proposals not installed by this Finance proof are explicitly excluded, including seating/mixed-simulation and superseded link candidates. Their presence in the worktree is not permission to release them.

Order and responsibility (matching the local executed trace):

| Order | Proposal file in `database/proposals/` | Responsibility |
|---|---|---|
| 1 | custom-graduated-amounts-v3.sql | Versioned amount engine; historical methods unchanged |
| 2 | custom-payout-intent-journal-v2.sql | Append-only numeric intent/batch storage |
| 3 | custom-payout-q-setup-save-v2.sql | Q-only transactional draft/save/reconcile and carry guard |
| 4 | event-settings-transaction-v3.sql | Whole-request settings snapshots, CAS and recovery |
| 5 | event-settings-workspace-v3.sql | Settings read model |
| 6 | event-regular-finance-draft-v1.sql | Versioned draft Finance history |
| 7 | event-settings-activation-source-v4.sql | Pinned activation source |
| 8 | event-rule-context-v1.sql | Durable event-specific rule context |
| 9 | event-rule-assessment-v1.sql | ACC mandatory/approval assessment |
| 10 | event-settings-activation-guard-v1.sql | Reviewed activation checks |
| 11 | event-settings-finance-backstop-v1.sql | Prevent old Finance paths bypassing configured settings |
| 12 | event-settings-operational-activation-v1.sql | Atomic operational binding, attempts/outcomes; disabled |
| 13 | event-settings-playoff-gate-v1.sql | Pre-playoff source/format gate |
| 14 | native-event-ledger-source-reader-v1.sql | Native receipt/expense evidence and identity source |
| 15 | native-event-ledger-allocation-v1.sql | Source-bound, conserved event allocation |
| 16 | operational-event-finance-proposals-v1.sql | Operational proposal history, income and fund review |
| 17 | playoff-series-matches-v1.sql | Match identity, format and source bindings |
| 18 | playoff-series-games-v1.sql | Independent game entries/confirmations and progression |
| 19 | native-playoff-finance-recipient-source-v1.sql | Trusted completed outcome-to-recipient source |
| 20 | native-playoff-final-awards-v1.sql | Immutable unpaid award set/reconciliation/readback |
| 21 | operational-provider-transport-v1.sql | Guarded authenticated public RPC wrappers; disabled |
| 22 | operational-finance-source-adoption-v1.sql | Explicit changed-cost/source adoption and recovery; disabled |
| 23 | native-recorded-fund-review-source-v1.sql | Recorded-cost completeness/fund review source; disabled |

These are the executed dependency order, not a minimal independently proved migration subset. Before conversion, review dependencies against the actual staging catalog and choose real migration identifiers through the established migration process. Do not invent numbers or apply every file in `database/proposals`.

## Grants and activation boundaries

Private functions/tables revoke ordinary `PUBLIC`, `anon`, `authenticated` and `service_role` access in the candidate SQL; owner SECURITY DEFINER wrappers carry authorization responsibility. Source inventory retains the full exact signatures/grant statements. New authenticated EXECUTE surface is 20 public wrappers: 13 in operational-provider transport, six in adoption/allocation, one recorded-fund source getter. There is no new ordinary-role direct table grant and no new anon EXECUTE grant in these 23 proposals. Dynamic grant loops must be checked by effective catalog probes after installation; source text alone is not provider ACL acceptance.

The 13 transport wrappers are settings workspace/save/operation; Finance workspace/proposal save/reconcile; playoff recipient source; unrestricted income; recorded-fund review; final-award source/write/record; and Finance write reconciliation. The six adoption/allocation wrappers are workspace/save/operation for each. Existing role/self-check/source gates remain required even for an authenticated caller. No service key belongs in browser transport.

Seven SQL capabilities return literal false: operational activation, operational Finance proposals, native playoff recipient source, native final awards, provider transport, source adoption and recorded-fund source. The inventory separately lists all seven SQL gates and seven TS/UI default-off sites. TS provider route/transport and adoption route/transport gates also return false; Finance page passes `enabled={false}`. The normal setup page omits the V3 opt-in and the client defaults it false. V3 UI explicitly refuses configured activation. An environment variable cannot safely turn these into an accepted feature. There is no reviewed normal public activation/review journey yet; the positive local tests temporarily replace a helper inside the disposable database and restore its exact original definition. They do not authorize shipping that test override.

## Custom N: exact coverage and missing work

| Mode | Save/recovery | Calculation | Accounting/final awards | Release status |
|---|---|---|---|---|
| Q presets and existing Equal modes | Historical paths preserved; no change to selected Equal Q | Existing policy remains separate | Existing historical supported paths remain separate | Preserve; do not infer new capabilities |
| Q custom positive integer N | Private Q draft writer tested: exact replay, stale/source/coverage rejection, post-core rollback, three lock barriers and historical preservation | New amount V3 tested against SQL/TS cases; source-bound paid-card/backfill preview | Unpaid preview checks separate allocation buckets and conservation; no end-to-end custom disclosure/election/contribution/review/final accounting proof | NOT enabled; fresh normal UI save blocks nonpreset N |
| Side custom N | Intent codec exists, but transactional Q writer rejects `side_custom_unsupported`; setup selection remains 4/6/8/10 | Separate existing Side engine handles N=7; this does not integrate setup | Custom setup-to-policy/disclosure/election/accounting binding unfinished | NOT end-to-end; visibly blocked |
| Satellite custom N | Intent codec only; Q writer rejects nonpreset Satellite | Distribution/eligibility/tie/basis policy unresolved | No custom final accounting authority | Block save/calculation; never borrow Q/Side weights |
| Equal Side | Unsupported choices removed from current editor | Recipient semantics unresolved | Not supported | Keep absent; do not confuse with supported Equal Q |
| Main/Con custom paid places | Raw draft settings retain values; do not change qualifier count | Whole finishing-group expansion and factor models tested | Supported native award bridge is bounded; custom ratio/beyond-qualifier cases remain blocked | No general custom authority |

Numeric candidate domain 1â€“2,147,483,647 is a positive PostgreSQL integer/storage limit, NOT an ACC minimum/maximum. Current fresh-save UI supports Q graduated 4/6/8/10, Side 4/6/8/10 and Satellite 4/5/6 (plus its separate Top 4); typing a supported preset through Custom is not arbitrary-N persistence. Presets hide the input; Q/Side Custom wording includes Graduated, Satellite does not. No unsupported value is silently coerced. Equal Q is preserved.

Required Custom-N completion: versioned Side save/activation; Q/Side source/disclosure/paid membership/receipts and award/accounting dispatch; stale amendments/recovery across those versions; a chosen Satellite distribution policy; then a complete funded synthetic lifecycle for each supported mode. The regular Main $480 final-award proof does NOT supply those missing optional-pool tests.

## Evidence and limitations

Latest full suite remains current for unchanged product bytes: 1,925 application tests, audit/build/TypeScript/provider readiness/workspace eight passed, lint zero errors/117 existing warnings, handoff six. Additional focused review checks: `test-results/setup-finance-release-focused.log` â€” 46 passed. No database run was repeated for this inventory.

The saved local public-wrapper/JWT-role simulation proves a $480 Main fund, four award groups/five identity-bound unpaid recipients, exact replay, race/rollback/stale rejection, equal bands, $5 amounts, post-final income blocking and fee coverage once. It does not prove actual Supabase cookies/PostgREST sessions or bank receipts. Consolation B was normally configured and active but **zero enrollment, recorded-income journal rows, fund reviews and final awards**. Its unchanged proposal retains a $1 proposal-only unrestricted-income estimate; that is not recorded income or received funds. No funded/completed Consolation, mixed-playoff, funded optional-pool or post-final amendment acceptance is claimed. Production performance is unverified; a 12-second local harness bound is not a provider guarantee.

Finance UI/storage mock tests cover responsive/enlarged text and exact retained-operation recovery. Missing enablement work includes trusted real provider sessions and role changes, full normal setup/context/activation navigation, real browser-to-API-to-database save/recovery/source adoption, final recipient review and unpaid-award controls, and safe old-client refresh without deleting pending work. Keep existing declarations until their replacement completes the entire lifecycle. Estimates, recorded awards, bank receipts and actual disbursement must remain distinct.

## Minimal safe release sequence and approval gates

1. Finish the missing normal public activation/context and provider/UI journey; keep unsupported modes visibly blocked. Freeze an isolated patch rather than commit the dirty dependency closure. Independent money/identity/permission review and full checks must clear the final bytes.
2. Before any hosted step, obtain a separately scoped staging target/catalog/fixture read authorization and explicit migration/grant/deployment approval. Reverify a fresh usable recovery point by isolated restore, plus saved draft and historical fingerprints. Local source ZIP is not that recovery point.
3. Install only the reviewed numbered migrations on staging, inspect effective ownership/RLS/direct/default/inherited privileges and disabled-state compatibility. No automatic fixture enrollment or simulated receipts are included. Actual signed-in/provider acceptance needs separately scoped synthetic test records and consenting independent accounts/officials; it is not authorized by a code publication alone.
4. Enable only the accepted capability set through a separately reviewed patch; verify CI, deployment, stable alias, browser role boundaries, exact retry/lost reply/account switch and unchanged protected fixtures. Show Daron the working setup/Finance flow before broader release.
5. Production remains a separate decision after the full simulated tournament, supported payout-policy checks, monitoring and rollback drill. Real payments/disbursement remain outside this work.

Recovery: preserve append-only rows and exact pending bytes. App rollback does not undo new tables, triggers, grants or records. Activation/carry/Finance backstop triggers can intentionally reject old writers; test the chosen rollback app against the new schema before calling rollback safe. Prefer gate-off and a reviewed forward fix; restoring the database would discard later writes and needs an explicit stop-writes/recovery plan. Preserve Auth/Storage/external configuration separately if they fall outside the logical dump. Local archive has no off-device durability guarantee.

Current source/evidence archive is `../balanced-synthetic-final-awards-local-verified-20261105.zip`, SHA-256 `0ea4d660a7467f169fab1a49acbb9f0c07f7427a0aa5635f4d56595cac4b288e`; this new review/inventory is additive and not inside that frozen archive. A real $481 fund still needs an approved genuine remainder policy. Correcting a fictional input in the local proof is not permission to change real income or override conservation.

## Independent planning-artifact review

Independent source/evidence review returned bounded GO after two documentation corrections: all seven SQL disable gates are enumerated and the zero-enrollment Consolation caveat distinguishes its unchanged $1 proposal-only income estimate from zero recorded-income journal rows. No remaining P1/P2 for this planning artifact. This is not product release clearance or deployment authority. The reviewer verified each SQL gate against its exact source function/path/line and reconfirmed 20 authenticated wrappers and Custom-N limitations.
