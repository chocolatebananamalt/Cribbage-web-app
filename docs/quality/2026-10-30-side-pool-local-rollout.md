# Side recipient and combined unpaid accounting rollout proposal - 2026-10-30

LOCAL VERIFIED ARTIFACT; no commit, push, hosted migration or application deployment has occurred in this phase. Production was separately resumed with express approval; the parent ran SELECT 1 and received 1. That is not permission to change its schema or application.

## Scope and policy
Each named Side Pool ranks every fully paid qualifying scorecard, including paid nonqualifiers, by the existing monetary order (game points, wins, gross positive winning spreads). Final playoff placement, net spread, UUID and Q cut records do not choose Side winners. Unresolved cash ties block. Configured fee/ratio comes from the version-bound pool definition and disclosed amount policy, not an assumed chart. The cached extracted specification v1.1 sections on optional Side/Q pools supplies the configurable structure; the owner's October30 clarification settles Side recipient eligibility. The shared exact ACC-weighted/app-largest-remainder $5 amount kernel is unchanged.

New recipient selection is separately disclosed before elections/payment/play. Old amount-only and fixed schedules are not silently upgraded. Side-only and Q+Side events use new immutable unpaid accounting; ordinary no-Q and Q-only v8 workflows remain operational. No person is marked paid; no actual payment or refund is executed. Regular expenses, eligible benefits, cash awards, Q funds, Side funds and restricted balance remain distinct.

## Exact proposed migrations
| File | Bytes | SHA256 |
| --- | ---: | --- |
| 0264_side_pool_unpaid_recipients_v3.sql | 21,317 | DF4F0A902FD0762DF45A2A1121C74E18158BF71AB4B3A80979A13F26EC837E8A |
| 0265_combined_q_side_accounting_v9.sql | 50,399 | 4B08363E8AC7A5966E5AA91C0A1BF8C6EED549DB4DEAF1730D2165C7F129FC2B |

0264 adds private append-only tables side_pool_recipient_policies_v3 and side_pool_recipient_reviews_v3. Its four public service-role-only RPCs are publish_side_pool_recipient_policy_v3, get_side_pool_recipient_workspace_v3, record_side_pool_recipient_review_v3 and get_side_pool_recipient_reconciliation_v3.

0265 adds private append-only tables prize_accounting_drafts_v9, prize_rounding_funding_events_v9 and prize_accounting_finals_v9. Its six public service-role-only RPCs are get_prize_accounting_workspace_v9, save_prize_accounting_draft_v9, record_prize_rounding_funding_v9, void_prize_rounding_funding_v9, finalize_prize_accounting_v9 and reconcile_prize_accounting_v9.

All five tables force RLS, have no direct human/service table grants, and retain immutable history. Helpers have empty search paths and no direct public/anon/authenticated/service execution. No new human permissions, credential or settings change. Existing Q context is narrowly extended for Side coexistence; old financial helpers retain their guards, with private combined/no-Q helper clones. New settlement-domain/final-source triggers protect existing source tables only for the new stream. The old v8 source exposes a controlled block for the new Side stream, preserving historical finals/replays. Existing member award-summary audience is retained; funding/classification/source evidence is not exposed.

Initial drafts were manually authored in repository sequence. The cached official Supabase CLI2.121.0 then generated local scaffolds; final numbered SQL was copied into these and byte hashes verified. No CLI linking or hosted application occurred. Migration generation/proof does not replace live drift preflight.

## Executed local evidence
- Required full application verification completed with exit0:1,113 application tests passed; audit, lint, provider checks, production build/TypeScript and workspace checks passed. Log: test-results/side-combined-final-verify.log.
- Accounting labels:21 isolated headless checks across390/1440 passed, including $510 receipts - $229.50 expenses = $280.50 raw budget, rounded $280; $160 eligible benefits is included in expenses; participant return $440 >= $433.50; $0.50 residual excluded.
- Recipient UI:12 isolated headless cases passed, including prepayment disclosure, nonqualifier inclusion, monetary tie blocking, exact retained retry, lost response and changed/malformed/storage-conflict recovery. Combined accounting UI:4 headless cases passed for Q+Side lost-response reconciliation, Side-only, upward unfunded cover and pending recipient review. Fixtures are portable and fictional; these are not real authenticated HTTP persistence.
- Actual isolated SQL: recipient policy/review authority, source binding, private ACL/RLS/owners/search paths, nonqualifier award, unresolved tie, replay, duplicate operations, revoked actors and cross-event denial passed.
- Actual combined and Side-only qualifying/playoff/unpaid-final lifecycles passed. Observed lock waits prove policy/election, start/election, competing finals and v8/v9 opposing attempts; one final, no omitted Side pot or duplicate stream. Stale expense blocks finalization; source inserts after final reject. Some probes are explicitly rollback-only administrator attempts, not supported correction workflows. A post-final legacy Q-cut writer case is not individually exercised because no applicable unresolved-cut policy fixture exists; trigger attachment was reviewed.
- Ordinary Q-only and genuinely no-Q v8 finals passed after0265. Exact legacy equal-pool $10.01 refund obligation remains exact; $5 denomination checks apply to awards.
- Independent final review found no remaining confirmed P1/P2, ran18 focused tests and independently accepted all four actual SQL workspace shapes with the final codec. Reviewer did not execute SQL/browser suites; those were separately run by builders/lead. Earlier routing, refund denomination, busy-state and unfunded/pending decoder issues were corrected and rechecked.
- Every SQL task database/container was removed and absence verified. Task browser servers3263/3270 were checked stopped. No personal Chrome profile was used by headless tests.

## Exact local payout examples (not hosted completion)
| Case | Receipts / explicit cover | Expenses | Regular awards | Q obligations | Side awards | Restricted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Q+Side down | $850 / $0 | $229.50 | $280 | $170 | $170 | $0.50 |
| Side-only down | $680 / $0 | $229.50 | $280 | $0 | $170 | $0.50 |
| Q+Side up | $850 / $4.50 | $229.50 | $285 | $170 | $170 | $0 |

Regular down awards to entrants02/01/03/04/05: $95/$70/$45/$45/$25; up: $95/$75/$45/$45/$25. Same-round third/fourth equal. Side17 paid x$10,1-in6:02/01/03 get $85/$55/$30. The reusable combined fixture has TWO separate Q pools: graduated16 paid,$160 gives02/01/03 $80/$55/$25; equal pool has one paid nonqualifier17 and creates $10 UNPAID refund obligation. That refund is not graduated rank-down and was not executed. Separate compatibility case preserves $10.01 exactly.

Fresh benefits $51 sanctioning+$109 meals=$160, operating $44 hall+$25.50 cards=$69.50, so $280+$160=$440 return. Old/up benefits $51+$102=$153, so $280+$153=$433 fails minimum$433.50 and chooses$285 with explicit$4.50 cover. Restricted money never counts as return. Cached Policy Manual chapter6III printed6-3/6-4 supports benefit/operating distinction; classification still needs actual evidence/director review and is not ACC certification.

## Approval and deployment order (not executed)
1. Obtain explicit approval for staging nnhcnvksxgxnpvdqjgpg ONLY, exact0264/0265 plus curated branch publication. No production fnjkwymxpnsqvxtpronk changes. Recheck remote baseline against local b0005ad6c065640961b01efb3ef3497c5de075f7 and stop on drift.
2. Read-only approved preflight: migration history through0263, exact function/owner/ACL signatures and clone anchors, quiet relevant writers, preservation hashes/counts for existing data. Do not kill unrelated sessions. Stop on unexpected drift/activity.
3. Schema first: apply0264 then0265 once in transactional migrations. Check history/SQL hashes, five empty new tables, owners/RLS/ACL/search paths/triggers, existing-row fingerprints and ordinary v8 compatibility. No smoke business writes.
4. Commit only reviewed manifest files; non-force push existing codex/director-setup-journey / draftPR122. Verify exact remote commit, required CI, Vercel READY immutable Preview and stable alias; runtime staging routing/authentication before future test writes. No merge/main promotion.
5. Hosted acceptance remains a separate gate. The preserved no-Q fixture has15/102 verified games. The next synthetic paper submission was denied before execution because the original-paper attestation did not describe synthetic evidence. Do not retry/bypass it. A truthful staging-only synthetic evidence mode needs separate implementation/security review and publication approval before hosted simulation; ordinary production original-paper verification must remain intact. Existing personal invitation acceptance/sign-ins cannot be automated without their own permitted handoff.

Rollback: old app remains compatible with ordinary streams before new Side policy/review use. Once new-stream history exists, old clients correctly block that stream; use forward repair/new app rather than erase history or remove final-source guards. Never drop populated private tables, disable constraints, rewrite finals or recalculate historical awards. Reversing migration/data behavior requires separate reviewed plan. Source backup is not hosted Database/Auth/Storage recovery.

Remaining launch gates: exact-release hosted acceptance, truthful test evidence route, physical independent-user/device/offline rehearsal, approved hosted backup/isolated restore, supported formats/cash tie scope, operational monitoring/rollback and explicit production rollout approval. Production resumption/health check closes only the availability incident.
