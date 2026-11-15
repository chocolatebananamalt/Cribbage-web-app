# Read-only practice qualification/Finance review: browser acceptance

Command: `node --conditions=react-server --experimental-strip-types tests/native-mixed-review-offline-browser.mjs`.

The actual review component and envelope decoder run in installed production React/Chrome. Node preloads the existing static, fictional 18-player/108-game snapshot using `tests/helpers/native-mixed-review-example.mjs`; the browser receives only JSON. This is not a new SQL execution, current provider session or evidence that the static data is current.

Acceptance at widths 320/390/768/1440 and 100%/200% text covers:

- Disabled and enabled-but-not-clicked views make zero reads. Keyboard manual load shows 18 cards, 108 private game histories, five preview places and $540 simulated gross.
- Costs, net fund and awards say Not determined, rather than zero. No edit, payout, finalization or qualifier-selection controls are present.
- Reversed incoming cards display in rank order. A coherent all-18 tie example reports that no qualifiers are selected.
- Null, malformed, foreign-actor, authority-claiming and unavailable bodies hide all prior table/summary data.
- Old callbacks after reader/source replacement or going offline make no read. Late replies after account or same-account reader replacement are ignored. Synchronous duplicate clicks cause one read.
- The keyboard-focusable scorecard region scrolls horizontally on a narrow screen; the page itself does not overflow. An unrelated unsaved editor and existing fictional pending bytes remain unchanged throughout.

Evidence: `test-results/native-mixed-review-offline/result.json`, source SHA-256 pins and width/text screenshots. The source must remain unchanged during the complete proof. Every context is offline `about:blank`, with service workers blocked, request aborts and CSP forbidding network access. Requests, frame navigations and page errors are asserted empty. No server, database, browser persistence, hosted record, credential or real money is involved.

Actual own-session provider/SQL acceptance and complete device rehearsal remain separate gates. The snapshot UI does not establish official qualification, MRP eligibility, costs, final awards or payout authority.

After the protocol-local bounded JSON guard replaced the broad payout-module import, rerun 67556 exited 0 with all cases passed and stable source bytes. Current reader SHA-256: `44bb7a4272054df159766756d03b31ebdabc48396748f153621df0f483afee3b`; section SHA-256: `c42d18c9c7098695bf1c4bedbbecf0b8974efe57153940bcf6569c2c547106c6`. Current result SHA-256: `4d6df132cdc35020e3126f2f23b431472b91cc7d58c775bf0d7f3d3690767e42`.
