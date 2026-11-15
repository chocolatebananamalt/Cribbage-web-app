# Side Pool staging rollout — 2026-10-30

Explicit user approval covered the reviewed 49-file publication and staging migrations 0264–0265; the synthetic-scorecard feature remains local-only under separate scope. No production schema/application changes or financial disbursement occurred.

## Executed

- Manifest: all 48 content hashes matched; manifest itself was the 49th file. Remote and local baseline both b0005ad6c065640961b01efb3ef3497c5de075f7. Unrelated historical reports/generated files were excluded.
- Staging nnhcnvksxgxnpvdqjgpg: no other active client writers at preflight; migrations previously ended at0263. Required SQL clone anchor present.0264 applied once as20261030201523;0265 once as20261030201543.
- Stored migration SQL has exact approved bytes/SHA256:0264 21,317 / DF4F0A902FD0762DF45A2A1121C74E18158BF71AB4B3A80979A13F26EC837E8A;0265 50,399 / 4B08363E8AC7A5966E5AA91C0A1BF8C6EED549DB4DEAF1730D2165C7F129FC2B.
- All212 preexisting app/public tables retained identical count/sorted-row fingerprints. Five new tables are empty. All five force RLS, owner postgres, postgres-only table ACL. Ten public RPCs have only postgres/service_role EXECUTE; private helpers postgres-only with empty search paths.38 matching v9/Side guards enabled; none disabled.
- Read-only transaction confirmed director Side workspace returns an object and B Cross-Checker returns null. No policy/review/financial smoke writes performed.
- Exact commit562d6e80aa315077cd269437d74f2876a687a3db created and non-force pushed to codex/director-setup-journey, existing draft PR122. Remote hash matched. Harmless final blank line in an approved runner retained; diff check excluding only blank-at-EOF passed.
- Independent publication audit confirmed exactly49 paths and no substantive content drift. The manifest hashes describe working-tree bytes. Git normalized CRLF to LF on26 files; all differences are exactly line endings. In particular committed0265 is50,072bytes SHA2564F7B363A8D8822CF652E2BDEC2D9DDC9EEF21759A3B5FB1715B3E045C8D2C316; staging received the approved50,399byte CRLF representation (hash above).0264 blob is unchanged. These representations must not be confused when comparing restore/release hashes.
- Vercel deployment dpl_EaDBdAYRWKJkjR8V1ct5qz2Npvog READY, immutable URL https://cribbage-web-8yojdi46u-cribbage-app.vercel.app and stable alias https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app resolve to that exact commit. Target Preview, no alias error.

## Remaining / limitations

GitHub Verify run41121887284 / job124289667331 completed SUCCESS, including frozen-lockfile install and full pnpm verify. Vercel status also succeeded. Exact remote commit, required verification and READY stable Preview are confirmed.

Existing authorized Chrome test tab336434426 remained B. New director-only Side page returned404 for that role, as intended. Returned to the no-Q paper-game page and preserved the session; no form submit or account switch. The exact page is role-protected, so director UI success was not claimed. Existing local phone/desktop/SQL gates passed before publication as documented in the reviewed report. Hosted15/102 no-Q checkpoint remains unchanged.

The Vercel connector fetch could not access deployment content:401 deployment_authentication_required after its own share-link attempt. The documented fetch mechanism created a temporary deployment share link (automatic expiry23hours); its bearer value was not printed or reused. No project protection setting, human grant or saved credential changed; no unchanged fetch retry. Existing authenticated browser was used only for read-only role-boundary checks. Production/physical-paper acceptance is not established by these checks.

Truthful synthetic-scorecard implementation is separately authorized LOCAL ONLY. No hosted synthetic retry, enrollment, migration or feature publication is authorized yet. Preserve historical captures; generated records are not physical originals or human review.
