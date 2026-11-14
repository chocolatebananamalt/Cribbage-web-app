# Guided events staging rollout

Approved test-only release completed at commit `65b5fba190f67208d41caae83cfb9d5bf5877e9d` on `codex/director-setup-journey`, normal push, draft PR122. Exact frozen manifest: 48 paths, independent review confirms no unrelated mixed-mock, payout, bracket or membership changes. Git normalized CRLF to LF; raw working source hashes matched the frozen manifest. Reviewed whitespace warnings were cosmetic and no source bytes were changed to silence them.

## Recovery and database

Verified staging `nnhcnvksxgxnpvdqjgpg`, ACTIVE_HEALTHY, PostgreSQL17.11. Production `fnjkwymxpnsqvxtpronk` excluded. Native export exited0; private 8,122,674-byte archive SHA256 `efb7dec6d2b45879a06818b008f24025e04eefa99405d78f12d4a64bd95ced75` restored in a no-network isolated container. All10 metadata/data groups matched. Operational Auth changes, external configuration/keys, Storage object bytes and off-device durability are documented exclusions. No password captured.

An initial automatic approval rejection and subsequent expired connector confirmation were both verified unexecuted. After specific owner approval/readiness, 0290–0292 succeeded sequentially through apply_migration:

- 0290: version20261104095900, explicit setup links.
- 0291: version20261104095936, atomic linked activation.
- 0292: version20261104095946, reviewed linked Main series evidence.

Stored migration statements exactly equal approved SQL after line-ending normalization. All242 pre-existing app tables retain identical counts and row fingerprints; all10 added tables are empty. Therefore the saved draft and historical fixtures were not rewritten. Authenticated read-only linked setup reader works for the existing Director/draft. No fixture enrollment, invitations, scores, financial records or real payments generated.

## Deployment and verification

Push CI41811509609/job126511639996 and PR CI41811516984/job126511662152 passed full pnpm verify (1,259 app tests plus audit/lint/providers/build/workspace). Vercel `dpl_AkjfmXcrS9s8RKKUcMEZeRbTvvod` READY, targetnull/Preview, exact commit, aliasErrornull; branch alias assigned:

https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app

Unique deployment: https://cribbage-web-q7ym5zhit-cribbage-app.vercel.app

Fresh signed-out browser smoke reached Vercel Login rather than the app; therefore actual hosted authenticated form rendering was NOT verified by this smoke. No sharing link, protection bypass, sign-in or access change was created to force access. Existing user's open form/session was untouched. Local phone/desktop guided/recovery tests and isolated SQL lifecycle passed before release. Save any current edits before refreshing the setup page to load the new code.

Tracked-source ZIP `task/guided-events-published-65b5fba.zip`: 5,362,112 bytes, 2,323 entries, all ZIP CRCs verified; SHA256 `4cffeca363416071d22921ce704649b4ad461a632b2a6b48543165373da4ddf1`. This is a local source backup, not a database/Auth/Storage or off-device backup. Recovery/manifest/CI evidence is retained under task/guided-rollout-preflight-20261104.

## Remaining limits

No production release. Equal Side Pool rules, public large brackets, member status/MRP verification and workbook payout UX remain separate. Small-field four/six-player Main playoff readiness and the proposed 17-player mixed synthetic mock are NOT established by this rollout. Existing historical reverse-sit-out circle fixture repeats opponents in its six makeup games; it must not be recommended for the owner's no-repeat mock. Separate local correction/provenance work remains unpublished.
