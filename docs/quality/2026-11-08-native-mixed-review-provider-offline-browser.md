# Read-only review provider: fake-client browser acceptance

Command: `node --conditions=react-server --experimental-strip-types tests/native-mixed-review-provider-offline-browser.mjs`.

Run 94090 exited 0 at widths 320/390/768/1440 and 100%/200% text. The actual provider, HTTP adapter, review section and bounded envelope decoder are rendered with production React. The sole module alias replaces `src/lib/supabase/client` with a fake in-memory client. The bundle assertion confirms the Supabase browser SDK is absent. Compile-time environment values identify the expected test target and contain an explicitly fake non-credential string. No real Supabase connection or account session is accessed.

Verified:

- Default-off performs zero client creation, user/claim/role calls or GETs. Enabled Director/co-Director identity and role checks expose manual Load; players and anonymous identities do not.
- Keyboard manual load uses the actual bounded HTTP reader against an in-memory native `Response`. Only GET is used and simulated gross displays as $540.
- A role-rejection 403 revokes access and hides prior data. A session mismatch without an auth event also revokes access before accepting data.
- Held account, session, event and auth-epoch replies are ignored; the next owner must load manually. Two synchronous callbacks produce one GET. Going offline invalidates a retained Load callback.
- No horizontal page overflow, network requests, frame navigation or page errors occur.

Evidence: `test-results/native-mixed-review-provider-offline/result.json`, pinned source hashes and eight screenshots. Provider source SHA-256: `29c484aaeb22f40d799888840ccfd2c4b6aa8df2cea53ac2c2ac556452e8190d`; result SHA-256: `5d1741961c6ece55efbf9513e41a83cc920e9e98d0dedb34f3ba79bae7b630f2`.

Every page remains offline `about:blank`, with service workers blocked, requests aborted and a CSP forbidding network access. Fetch is a memory function returning a static fictional snapshot. This does not prove JWT signatures, real cookie sessions, provider authorization, database policy, hosted endpoint availability, or page-route hydration. No database, hosted record, account grant, credential or payment changed. Actual signed-in device and backend acceptance remain separate gates; the new page's false gate was not enabled or navigated.
