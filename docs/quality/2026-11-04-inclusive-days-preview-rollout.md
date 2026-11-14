# Inclusive tournament days test-preview rollout

Approved exact8-file scope:7code/test files and local verification note, matched frozen publication manifest and verified pre-release source/evidence ZIP. Independent release review passed. Index verified exact paths/normalized bytes; unrelated working documents excluded.

Commit91dc570503f01df0c09935870a6e9b63491cbf11, normal non-force push on codex/director-setup-journey. PR122 remains draft, head independently matches. Push CI41776403381/job126397685724 and PR CI41776408338/job126397701454 bothSUCCESS, including complete pnpm verify. Vercel dpl_9Q4kiYEF6W1PiQ1sN6BbHb4i7pVr READY, exactSHA, targetnull(Preview), aliasErrornull; verified branch alias assigned.

Deployment https://cribbage-web-1wobb80m8-cribbage-app.vercel.app
Stable https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app

No database migration, hosted tournament record reads/data writes, credentials/roles/security changes or production release. Existing end times remain untouched by code until director changes start date or duration; source tests/browser proved this locally, no fresh hosted fingerprint claim.

Live UI limitation: safe unauthenticated sign-in request302redirect to vercel.com. No temporary share link created or protection changed. Actual user-specific date form was not inspected because hosted record reads are excluded. After saving unsaved work, user may refresh existingsetup once and inspect Start date/time, Number of days and Ends on date; no clearing data/signout. Full local verification1231tests/workspace8/handoff6 +8browsergroups passed. Exact release receipt and verified Git source archive in test-results/date-duration-publication-receipt.json; local source archive does not back up DB/Auth/Storage or prove off-device durability.
