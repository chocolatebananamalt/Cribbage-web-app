# Offline real-React rule-context acceptance

Executed `node tests/prize-rule-context-offline-browser.mjs` using the installed
Next webpack compiler and Playwright Chrome. No dependency install, server,
navigation, database, hosted action or provider session was used. Each fresh
browser context started and ended at `about:blank`, with offline mode,
service workers blocked, all request routes aborted and CSP `connect-src 'none'`.
The actual component and actual application global CSS were bundled inline.
Only the account/storage coordinator and fetch provider were replaced by
fictional in-memory ports. No native browser storage/cookies were used.

All eight scenario groups passed:

- 320, 390, 768 and 1440 widths, each with normal and doubled computed text.
- Clean co-director refresh updates displayed values and the expected review
  identity. Save without further edits retains and displays exactly those values.
- Lost reply after commit, React remount, exact journal recovery and fresh
  current readback clear only the original matching pending request.
- Dirty co-director refresh retains edits and their original baseline; saving
  stays disabled until explicit adoption of the latest saved review.
- An event named TEST ONLY has blank sanction/duration when server history is
  absent. Explicit choices are required. Lost pre-commit response and not-found
  recovery preserve pending bytes; explicit exact retry uses the same operation.
- Late replies after actor changes cannot clear the original account's pending
  request. Returning to that account can recover it normally.
- Late source changes preserve pending bytes; verified historical outcomes need
  explicit resolution and a new fresh readback. Readiness remains false.

The 390px flow also verified keyboard Tab order through sanction, duration,
reason and reference to Save; a visible focus outline; and Enter activation.
The harness asserts readiness evidence is null during pending/dirty work and
contains the actual refreshed review identity when ready. Unit tests separately
compare that evidence against validated activation-source reviews, rejecting a
new co-director review even when setup snapshot pins are unchanged. The root
owns the final confirmation handoff and its in-flight evidence recheck.

The first responsive run exposed component labels inheriting a horizontal flex
layout from global styles. Component-local single-column/minmax grid and control
width bounds corrected the 320px doubled-text overflow; global styles were not
changed. The harness's own enlarged heading also needed word wrapping, matching
the existing offline Finance harness. Strict no-overflow assertions remained.
Final screenshots were visually inspected for phone/doubled-text clipping.

The final combined run exited 0: offline browser acceptance, TypeScript
`--noEmit --incremental false`, and scoped ESLint. The context codec/source suite
also passed all 10 cases after readiness-evidence comparison was added.

Evidence: `test-results/prize-rule-context-offline/result.json`,
`observations.json`, and eight `review-WIDTH-SCALE.png` screenshots. Observed
network requests and page errors were empty in every context. The test uses
explicit fixture controls rather than navigating to any real URL; it does not
retry or bypass the earlier browser-navigation denial.

Limits: this proves the actual React component's bounded interaction/recovery
behavior over fictional ports. It does not prove real authentication, session
storage coordination, SQL durability/concurrency, the full Setup route, provider
sessions, financial calculations or production readiness. Those remain separate
lead-owned integration gates. No audit escalation was retried.
