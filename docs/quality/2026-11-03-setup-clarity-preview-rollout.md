# Setup clarity test Preview rollout

Owner approved publishing the exact tested seven-file setup clarity patch. Frozen v2 manifest hashes and base commit 1120773bcfcbb49247096dbaab7f7eb948c6e0ea matched; index was empty before staging. Only its seven code/test paths were staged/committed. Unrelated working changes and the later Q navigation/policy audit were excluded.

- Commit: `d89eedaf16d9494ecdd8b9ffe1fadda021573469`, normal non-force push to `codex/director-setup-journey`; remote SHA and draft PR122 head independently match.
- Push CI41732683614/job126253807754: success. PR CI41732692771/job126253838029: success. Both ran full pnpm verify on that exact SHA.
- Vercel `dpl_EYEWedttUwrxdwN9FzkfyuhNue1x`, project `prj_loMVGmwbqTNcxEOk3T0VBdg3kfEQ` / Cribbage App team, READY; target null (Preview), exact Git SHA/branch, no alias error.
- Deployment: `https://cribbage-web-r5nznsxet-cribbage-app.vercel.app`.
- Stable alias: `https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app` is assigned to that deployment.
- Local evidence: 1229 app tests, workspace8, handoff6, 36 responsive/recovery/rate browser combinations and six declaration groups; independent Sol review no P1/P2. Seven source/test files are clean after commit. Manifest/verified local backup v2 remain under the external event-declaration-layout evidence folder.

No migration, hosted tournament record read, data write, fixture enrollment, role/access change, finance action, production promotion or unsaved form refresh occurred. Preservation was not re-queried because the owner prohibited hosted record reads; do not claim a new database fingerprint comparison.

## Post-release browser limitation

A fresh signed-out Playwright context reached Vercel's Login page rather than the app sign-in page. Initial narrow interception also excluded the recovery worker; allowing the required public worker did not resolve the Vercel Authentication barrier. No bypass/share credential was created, and protection settings were unchanged. Existing native Vercel CLI executable was unavailable at the previously used task-local installation.

An existing authorized Chrome session was used only for static asset URLs and an invalid-ID setup route (source rejects that ID before tournament access); no real tournament route/data was inspected. The deployed asset prefix is `/static/immutable/chunks`, unlike the local output path; the focused direct stylesheet attempt did not succeed. The temporary agent tab was closed. These attempts do not constitute successful post-deployment interactive UI verification. The deployed-browser diagnostic result remains failed, explicitly separate from passing local component tests and exact-release CI/deployment verification.

Next safe user action: save any current edits, then refresh the existing setup tab once to load the release. Check full-width declarations, adjacent persisted last-save status, compact fee editor and required reason before Save. Do not clear data or sign out. A user walkthrough or separately authorized protected-browser verification remains the live UI acceptance gate. Q Pool link relocation/refund policy changes are NOT in this release.
