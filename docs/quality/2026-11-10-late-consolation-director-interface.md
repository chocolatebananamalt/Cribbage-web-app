# Late Consolation Director payment interface — local candidate

2026-11-10. Private source only; no hosted installation or publication.

## Implemented

- Participants page mounts the additional-entry-payment panel only behind `consyAddonDirectorRoutesEnabledV1()`, currently literal false. The SQL provider gate is independently false. Existing Main payment controls and records are unchanged.
- Normal cookie session: exact project, actor, session and Director/Co-director role checked; authorization loss conceals the private panel. API repeats identity/role checks after RPC. A server identity rejection revokes the browser lease without treating the write as rejected.
- Explicit reviewed enable command for the event payment mode. Loading/selecting does not activate it.
- Full published Consolation fee only. Main/base, prepaid Consolation, additional receipt and all-recorded totals are distinct. Existing payment/prepayment suppresses a new receipt. Cash/check availability comes from the captured source. No collection gateway, bank reconciliation, fund approval or payout is implied.
- Exact request staged before dispatch under per-record exclusive Web Lock and existing account/document recovery lease. Same pending key survives reload in session storage. Unknown, changed, foreign and unavailable recovery data block new authoring and remain untouched.
- Only exact canonical stored terminal proof permits exact-record cleanup. Unknown results, retries, missing operations and mismatched replies remain held. Source drift retains historical Check access. Retry remains restricted to current authoring admission; no fresh nonce or substituted request is made.
- Partial, discounted/waived fees, voids and corrections are explicitly unsupported here. Existing private database safeguards retain the original Main history and reject duplicate event receipts.

## Verified in this increment

- TypeScript no-emit and focused ESLint passed.
- Twelve contract/storage/transport tests: exact scope/session metadata, receipt proof, changed amounts, exclusive competing staging, stale and unavailable storage/locks, exact cleanup, old-session recovery, persisted-byte checks before every retry, same-origin cookies, late responses and immediate server-denied identity revocation.
- Actual React offline about:blank browser test at 390/768/1440px, enlarged text: default off, read does not activate, unknown write held, malformed acknowledgement cannot clear, exact accepted recovery clears, no overflow and zero network. Includes held Enable callback invoked immediately after uncheck, before React commit.
- Screenshots/result under `test-results/consy-addon-director-20261110/`.

## Not yet verified / enablement gates

- New SQL wrapper runtime is now proven in one isolated fictional restored database; real cookie/provider sessions are still not proven.
- Real signed-in provider, app recovery-coordinator ownership, native Web Lock/storage behavior, complete receipt-entry UI flow, full reload and actual device acceptance remain unproven by the offline component test.
- Existing legacy base-only payment totals/control affordances need review before broad enablement; the new panel does not claim the old totals include add-ons, and database guards prevent voiding an anchored Main receipt.
- No hosted grants, migrations, activation, payments or public upload performed. Existing paused publication remains untouched.


## Completed wrapper runtime and re-review — 2026-11-10

Independent source re-review: GO, no remaining high-confidence defect in the bounded pass. Corrections include synchronous stale-consent invalidation, persisted exact-byte retry under exclusive owner lease, immediate pre-body 403 conceal, and post-RPC identity/role failures returning 403 while keeping the outcome unknown. The last correction has three handler tests covering all three routes, both pre/post-dispatch and session/role loss.

One disposable database restored the hash-verified Main-only fictional checkpoint (zero real emails or auth sessions). Both private payment and new provider proposals were applied locally. Tests exercised the authenticated SQL role with fictional JWT claims, **not a browser cookie session**. Evidence field authenticatedCookies names the cookie-facing SQL wrapper role exercise; it does not establish a real provider session (realProviderSession is false).

Verified: default false provider gate; four wrappers authenticated-only and anon/service-role denied; outsider cannot write; reads create no scope; explicit scope creation; strict TypeScript DTO readers accept actual SQL desk/source/receipts; exact command and recovery replay; changed-body nonce held; unknown injected post-nonce failure rolls back receipt and operation; known future-time rejection is durably recoverable; competing writes genuinely overlap, second retries then rejects duplicate; Co-director can read; recovery survives disabled new-write gate; original Main payment events byte-equivalent.

Evidence: test-results/consy-addon-provider-2026-11-10T07-47-40-465Z/provider-proof.json and cleanup.json. Runner exit 0; database and exact owned container verified absent by ID/name. No gameplay replay was needed.

Checks: 12 client contract/storage/transport tests plus 3 authenticated-handler tests, TypeScript and focused ESLint passed. Existing three-width offline React checks remain valid; no claim of real signed-in provider, native storage ownership or full reload acceptance. All hosted systems and public upload remain untouched.
