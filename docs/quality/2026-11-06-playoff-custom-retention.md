# Playoff Custom series text retention

## Narrow fix

src/components/playoff-series-settings-editor.tsx select handler now spreads existing raw round draft while replacing choice. It formerly reset winsText/gamesText to empty. No resolver change: selecting a preset ignores inactive raw Custom text, while returning to Custom validates the retained whole numbers and best-of relationship. Same/separate final behavior remains intact. Backend writers and historical records unchanged. Browser expectations updated from destructive reset to retention, with invalid2/5 roundtrip proving no stale-valid fallback.

## Local evidence

Existing isolated actual-component browser harness at localhost3359:320/390/768/1440 widths,100/200% text. Valid2/3 retained; invalid2/5 retained/blocked after preset roundtrip; preset valid; final257+ warning still shown. No database/API/storage/result mutations. New headless browser contexts never use user tabs. Owned server tree removed by exact process ID after test. Screenshots under test-results/playoff-series-editor-browser are internal QA only, not Library deliverables.

Full verification and handoff logs: test-results/playoff-custom-retention-verify.log and playoff-custom-retention-handoff.log. Receipt after completion: test-results/playoff-custom-retention-checkpoint.json. This proves local controlled presentation and validation only, not durable provider save/reload or real device acceptance. No fixture/SQL/hosted access/publication. Pending custom payout-ratio policy is separate and unchanged.

Review hardening: numericCustominputs now maxLength256, matchingexistingcompletedraftvalidator. Thislimitsnewinputonly; loadedrawvaluesarestillnotrewritten.
