# Score synchronization and offline startup Preview rollout

The approved 12-file patch was committed and normally pushed to codex/director-setup-journey / draft PR122 as acfbd9156619443aaa5d094bca343fde9e99bef1. Staged contents exactly matched the frozen reviewed manifest, permitting only normal Git CRLF-to-LF conversion. Credential-pattern scan found no matches; unrelated changes remained unstaged. No SQL migration, production release, score edit or scorecard redesign occurred.

Exact-commit push CI 41398988424 and PR CI 41398994129 both passed. Vercel Preview dpl_J6NQd4xmeuowj52Wn8WZufnAVADj is READY for that exact SHA. Unique deployment: https://cribbage-web-3svd6niby-cribbage-app.vercel.app . The stable branch alias https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app resolves to that same deployment/project prj_loMVGmwbqTNcxEOk3T0VBdg3kfEQ. This is test Preview, not production. No temporary access links were created.

## Read-only preservation

Before and after deployment, the replacement event 67dd292c-213c-4d0b-80ef-cc8eeec8e720 retained identical full-row fingerprints:

| Data | Rows | MD5 fingerprint |
| --- | ---: | --- |
| Games | 102 | c69881eafcd6d29d15fa7a0d1a48535e |
| Submissions | 4 | 1ffd30613fbbead77aa87c5f64e07a61 |
| Confirmations | 4 | 235d611f5b359836cd076ccaeed8796f |
| Score lines | 4 | d161f80327f2e2aedd9b83a9a9421b77 |

Thus both verified games remain unchanged: Director won game 1 by 20; B won game 2 by 15. Cumulative Director 2 points/+5 and B 2 points/-5. Game 3 remains unscored. These checks concern this event's scoring rows; no broad claim is made that every hosted table was re-fingerprinted. No hosted mutation was executed during this rollout.

## Safe user handoff and remaining acceptance

Stay online on the phone. Refresh the same Game 3 score-entry tab normally and wait for Offline Ready. That online reload obtains the new client code and refreshes the protected page/asset cache through the existing worker. Do not clear storage, sign out, change security settings or enter a score. If Offline Ready does not appear, stop and capture the visible non-secret status.

Only after the user confirms readiness, repeat the bounded phone disconnect/reload/reconnect test without scoring. The earlier physical test failed on the previous release and is not retroactively a pass. This deployment/CI verification is not actual-phone offline acceptance. Both user accounts and permanent links are retained; no new activation or account setup is needed.

The separate own-name Won/Lost controls, navigation improvements, contextual paper/digital help and latest scorecard-only prototype/screenshot comparison remain deferred until after the functional run. The two linked accounts have no further mutual games; this is a two-game technical scoring check, not completion of the 102-game tournament.

Local verification and review details are in 2026-11-02-score-confirmation-refresh.md and 2026-11-02-offline-recovery-startup.md; their unpublished statuses describe the pre-approval checkpoints and are superseded for this exact patch by this rollout record.

## Subsequent user-observed phone reload/reconnect acceptance

After publication and an online refresh to Offline Ready, Daron reported the phone in airplane mode with Wi-Fi off. Repeated offline reloads retained the Game 3 scoring form; he explicitly confirmed it had not reconnected. He then restored Wi-Fi/disabled airplane mode and repeated refreshes, seeing Preparing for offline then Offline ready. Record this as passed phone cached-page reload and reconnect only, based on user observations. It does not establish offline score save, durable queued-entry reload, replay, independent-human validation or full tournament completion. Read-only follow-up confirmed B Game3 3cef0d60-90b0-456b-8e7c-c351c80e3a5f remains pending/version1 with zero submissions and confirmations. No scores or hosted data were changed by this planning task. Source: parent-forwarded user observations, 2026-11-02.
