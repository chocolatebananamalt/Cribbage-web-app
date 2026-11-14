# Multi-event staging rollout — 2026-11-03

The separately approved 165-file repair is published on test preview only at commit `1120773bcfcbb49247096dbaab7f7eb948c6e0ea`, existing draft PR122/branch `codex/director-setup-journey`. Production remains excluded.

## Executed safeguards and release

- Verified staging `nnhcnvksxgxnpvdqjgpg` healthy and baseline 273 migrations before writes. All 266 current non-system table fingerprints matched the verified logical recovery snapshot; all 45 recovery-package hashes matched.
- Applied exact reviewed migrations 0274–0289 in order. Hosted migration history now contains 289 entries; each new stored SQL statement matches the reviewed file after trailing-whitespace normalization. No retry of an uncertain migration was needed.
- The four historical unguarded activation helpers no longer permit service_role, anon or authenticated EXECUTE. The pinned finalizer permits service_role only. No credentials, accounts or human role grants were created.
- Committed exactly the 165 reviewed paths and non-force pushed the existing branch. Unrelated working changes remain excluded. Both exact-head Verify runs passed: push 41699219598 and PR 41699232459.
- Vercel deployment `dpl_4MDJALC1kyEwPf715wq9oM6NWVaT` is READY, target null/Preview, exact commit 1120773. Stable alias: https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app . No promotion or production deployment occurred.

## Preservation and read-only hosted checks

The 226 original app tables retain their existing values. 225 raw fingerprints match. The remaining table, `tournament_setup_side_pool_versions`, has a new nullable `payout_type` column; its two old rows match exactly when projected onto their original fields, and both new values are NULL. Migration history changes are expected. Of 16 new app tables, 15 are empty and only the installation-marker table contains its expected one row. No fixture enrollment, pool election, synthetic receipt, expense, award or final was created.

The actual deployed setup page loads saved version 2 of draft `c029953d-7402-40bd-ac8c-c45b94e26921`, with Main Standard 12/$50, graduated 1-in-4 Q/$10 and Equal Q/$20, no Side Pools and no Consolation yet. Its dates and Honolulu timezone remain saved. Add Consolation is available. Historical regular V8 and combined Q/Side V9 accounting pages render with their synthetic/unpaid notices intact. No browser form was saved or finalized during verification.

## Backup and limits

Private source snapshot Library version 61 already contains all 165 release files byte-for-byte; SHA256 `763a28e9f776542024ae57ecef32dba9d4bf6a5b42baefdeec8f80bf713214b6`. No duplicate source upload was needed. The separate owner-private database recovery package passed complete isolated restore and schema/security/data checks; it requires its documented role/database/managed-schema supplements and is not the source ZIP. Its Auth operational, external configuration/keys, Storage bytes and off-device durability exclusions remain.

Equal Side payout choices remain disabled pending policy. V2 later-event amendments and member-facing V2 simulation prize publication remain outside reviewed support. This release is not production or real-money acceptance. No new hosted multi-event synthetic financial run was authorized or performed. Continue the user's saved setup walkthrough; request separate bounded enrollment/financial-simulation approval before those writes.

Detailed immutable operation evidence is in workspace sibling `multi-event-rollout-preflight-20261103/`: migration receipts/checksums, before/after fingerprints, projection and ACL checks, exact CI/deployment/browser receipts and source-backup release binding. This post-release journal is local documentation and was not silently added to the approved 165-file publication.
