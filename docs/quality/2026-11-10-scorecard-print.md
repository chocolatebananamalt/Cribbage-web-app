## 2026-11-10 Own scorecard printing — local implementation

Added Print Scorecard to the existing authenticated player scorecard. It prints the same actor-scoped data, preserves Tournament IDs/opponent names and verified-only totals, and prints an explicit copy/unverified-handwriting warning. Navigation and account controls are hidden on paper; no fetch, scoring mutation, verification or access expansion was added. This is an individual current-card copy, not a Director batch of blank paper cards.

Focused evidence: `node tests/scorecard-print-browser.mjs` passed phone/desktop CSS print checks with synthetic markup, no network; eight `scorecard-presentation.test.mjs` cases passed. This browser check does not render the full actual React tree and does not prove physical printer/provider acceptance. TypeScript and targeted lint were launched; results recorded in handoff. Full verification unavailable/not run; no hosted changes or denied-operation retry.

TypeScript: node node_modules/typescript/bin/tsc --noEmit exited 0.

Targeted ESLint exited0 (session1688 reconciled).
