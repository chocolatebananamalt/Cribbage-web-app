# Recorded-cost Finance page integration - disabled local candidate

## Scope and acceptance

Use the verified recorded-cost controller, exact-operation outbox, IndexedDB adapter and authenticated provider contracts. Add a separate default-disabled event Finance route without replacing the existing setup/payments pages or editing any saved tournament. Before disclosing a retained review, obtain an ordinary Finance response bound to the fixed account/event. Reject stale/foreign independently loaded source pairs. Never rebase or remove earlier device work.

New adoption requires no unresolved ordinary Finance device draft or operation. Any bytes at either exact matching key block a new submission, including unknown/malformed bytes. Existing adoption recovery must still work when the server reports adoption is no longer required following an accepted operation. Preserve exact pending bytes, require explicit reconciliation and exact fresh-head archival, and keep the complete review draft. Default-off and unsupported roles must perform no provider or storage IO. Old account callbacks must not act after owner change.

No hosted reads/writes, database update, publication, invitation, role change, payment or disbursement is in this scope. No new disposable database was needed for this page/auth composition; the prior isolated SQL acceptance remains separate evidence. Browser mocks are not real provider-session proof.

## Implementation

- `src/lib/finance/recorded-cost-adoption-page-v1.ts` composes the current Finance head and adoption source; checks scope and source/head/version/editor pins; inspects only three matching recovery keys. Authenticated Finance is read before browser recovery storage. New submissions recheck ordinary recovery and current Finance pins before calling the adoption transport. Reconciliation remains possible from a valid retained review when current adoption sources are blocked. No old draft is erased, merged or silently adopted.
- `src/components/recorded-cost-adoption-page-v1.tsx` explicitly loads the review, fences owner/effect tokens and duplicate clicks, and mounts the tested recovery host. It retains the review after acceptance and explains the outstanding fresh recorded-fund/coverage step. It provides no final-award or payment controls.
- `/tournament/[tournamentId]/finance/[eventId]` is a separate dynamic route with a literal-false gate before auth IO, director/co-director access checks and verified `getUser()` equality. Its client is independently disabled. Existing pages do not link to or mount it.
- Older default-disabled Setup/Finance route handlers and transport now require a canonical `x-expected-actor-id`, compare it to current `auth.getUser()` before role RPC and business RPC, and recheck after the operation. It is never passed as SQL authority. Finance HTTP pins it to the fixed scope; the three Setup V3 fetches use the captured actor ID. Request bodies and retained wire formats are unchanged. A 403 keeps pending work; it does not enter a legacy writer.

## Concurrency and limits

Browser checks for ordinary recovery are time-of-check guards, not a cross-tab reservation. A new ordinary draft can appear after the last read. It remains untouched; the adoption server's revision/source CAS still protects shared records. Do not claim atomic exclusion across unrelated browser recovery keys. Provider account transitions during committed server work remain uncertain until exact-operation reconciliation.

The page does not mount the legacy expense screen that clears other actors' recovery keys. That issue remains a separate prerequisite before adding expense-entry navigation. The page cannot create expenses or allocations. Native cost corrections/removals/splits, changed entry/qualification/settings frames, mixed playoffs, funded optional-pool finalization and post-final changes remain blocked by existing contracts.

Sanctioning is still deducted only in the current recorded allocations. A selected expense event is retained device intent; only a fresh post-adoption recorded-fund review can approve coverage. No automatic fund review, award or disbursement occurs.

## Verification and remaining acceptance

Eight preparer/page tests pass, including disabled/no-IO, matching sources, ordinary retained work, late ordinary draft, stale head/account, corrupt review and accepted-recovery after source advancement. Older actor-boundary focused checks pass (62); independent review found no P1/P2 in page composition or actor guards and separately checked all three Setup headers. The generated prior browser fixture's implicit JavaScript import was found by whole-repository TypeScript and replaced with the same embedded synthetic JSON; production type checks were not weakened.

Final verification: `pnpm verify` passed 1,890 application tests, production dependency audit, lint (zero errors/117 existing worktree warnings), production build/TypeScript, eight workspace checks. `pnpm verify:handoff` passed six. Logs: `test-results/recorded-cost-page-verify-final.log` and `recorded-cost-page-handoff-final.log`.

The first full run identified the intentionally disabled route as unreachable under the existing live-route test. The corrected test permits only this exact single Finance page while its actual gate is false, asserts pre-auth `notFound()` and disabled client, and restores normal reachability requirements when the gate opens. Adding another Finance page fails that exception. Independent review confirmed this does not authorize a live orphan route. A focused rerun also passed after strengthening the exact-page assertion.

`tests/recorded-cost-adoption-page-v1-browser.mjs` passed four widths (320/390/768/1440) at 100%/200% text. It uses the actual page, HTTP factories, controllers, outbox and IndexedDB; provider responses alone are mocked. UI-filled review and coverage intent reload exactly. After a simulated accepted POST with lost response, ordinary Finance becomes current while adoption returns blocked/prepared-null. Explicit reconciliation and exact-head archival work with one POST, retaining the original review bytes. Ordinary Finance device work blocks new adoption unchanged; a foreign account hides old recovery. Both pre-submit review and post-submit recovery layouts were checked. Initial isolated overflow was missing real global CSS in the harness; after loading real styles, an enlarged-phone heading readability issue was corrected with narrowly scoped heading/card CSS. Final phone crops were visually inspected at 320/200 and 390/200. StrictMode is configured, not a targeted held-effect replay proof.

The existing Setup V3 browser run passed 32 mocked cases, now asserting the actor header on each V3 request, including save/lost-response/access-loss/late-account/late-mode/source-mismatch cases. Actual provider authentication is still not proven. Owned browser servers were stopped; ports 3386 and 3399 independently returned ECONNREFUSED. No new database or container was created in this phase.

Source/evidence backup receipt: `test-results/recorded-cost-page-checkpoint-archive.json`. This is a verified local source/synthetic-evidence archive, not a full checkout, hosted recovery point or off-device backup. The prior recorded-cost adoption archive remains unchanged.

Enablement still requires actual provider-cookie/PostgREST sessions, different authorized accounts for the same event, role revocation and account changes during reads/writes, installed RPC ownership/ACL/RLS checks, mounted Setup V3 recovery acceptance, fresh recorded-fund coverage review after adoption and approved staging recovery/rollout. Three earlier allocation tables are not FORCE RLS; installer-owner bypass remains explicit. Neither passing browser mocks nor the prior local owner/JWT-context test certifies actual provider authentication. Literal-false gates must remain false until these conditions pass.
