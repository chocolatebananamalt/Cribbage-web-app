# Functions-first registration and creation walkthrough

Owner priority: functions before further formatting (Sentinel_916897c0d798819196b2681433a6adbe). The one quick Desk mockup is a review artifact, not the next implementation task. Actual selected demo sections are Score Entry, Scorecard, Operations, Results, Rulebook. Record the global-header correction as **Game 3**, not Gear/Year 3 (Sentinel_76852bf890448191bd24f12d584d348e); omit a current-game indicator from Tournament Desk, while retaining the specific game on scoring pages. Main playoffs and consolation may coexist. No Desk redesign is implemented here.

## First safe screen now

Existing Director account: pr122-director@test.invalid. User enters passwords personally. In the existing test Preview open:

https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app/director/tournaments/new

The authenticated heading is **Create Tournament**. Fields: **Tournament name**, **Planned tournament date**. Saving control: **Create Draft and Continue Setup**. Opening/inspecting does not create a record. Stop before saving until a fresh named fictional fixture and its bounds are approved. If not signed in or director approval is absent, do not broaden permissions; resolve that exact identity/access dependency. Existing Director authorization is not a fresh-director-signup test.

## Director path to prepare once fixture actions are approved

Create exactly one clearly named fictional staging draft, then Set Up Tournament. Verify persisted event terms, explicit fee (paid Main minimum $3 as app safeguard, or explicitly approved free/subsidized choice), schedule/prize declaration and bindings before activation. Do not repeat the earlier zero-fee/missing-prize-policy mistake. Pools are unnecessary for this first registration walkthrough.

Use normal review of saved terms before **Finalize & Open Registration**. Do not confuse opening registration, roster check-in, event attendance and Start Play. New private registration/access links, invitations/roles, rotating check-in credentials and start controls need their applicable bounded approvals. Existing roles/links on other fixtures do not carry into a new fixture.

The already approved test Director can exercise creation now after the fixture approval. Testing a genuinely new director's **Request director access** path requires a separately approved suitable unapproved test identity and normal administrator review; do not create credentials or grant global access under this plan.

## Player path and exact boundary

The generic /register route alone is not a usable invitation. It requires an open tournament's valid fragment-only registration credential, and the public registration release flag must be enabled. Verify current staging release/readiness before issuance; do not turn settings on implicitly or expose a raw credential in chat/logs.

Normal form heading: **Register for Tournament**. Fields: **First name**, **Last name**, **Email**, **ACC Number (if known)**, **Scorecard Type** (Digital/Paper), **How will you pay?** (Cash/Check). Button: **Submit Registration**. The payment-method selection states an intention; it is not a charge or proof of receipt. Registration is an identity claim, not automatic official access, payment, enrollment, seating or scoring authority. Director review/promotion and duplicate/conflict resolution remain separate.

Use existing test B only if it matches the approved claimant scope; B email is pr122-player-b@test.invalid. Do not send email to that nonexistent inbox or reset credentials. Separate user-operated sessions can demonstrate acceptance/consent truthfully; simulated one-operator actions cannot be recorded as independent witnessing. A new player's normal witnessed binding is a genuine human/scope dependency unless the exact new fixture has separately approved truthful simulation support. The previous simulation allowlist is fixture-specific.

Director records only explicitly approved simulated fee/waiver/expense evidence; never invent a receipt or move real money. Complete roster review, check-in, seating, published schedule, event attendance and start in their actual order before opening the linked player's first game. Current standard Main/five-qualifier workflow has known larger-field requirements; do not promise four/six players can finish a sanctioned tournament or silently loosen validation. Additional fictional entrants/comping need the fixture's explicit scope, rather than adding them unnoticed.

## Ready versus pending

## Live user-created draft and end-time rule

Read-only lookup confirmed draft `c029953d-7402-40bd-ac8c-c45b94e26921`, **TEST ONLY - Director Walkthrough 11-02-26**, planned date 2026-11-02. The user is entering details personally; no agent write or saved-details confirmation is recorded.

User clarified the requirement (Sentinel_f4f1e464c794819193f2832a196f60f6), superseding the earlier hard-always interpretation: tournament end time **defaults to 11:59 p.m. on the selected end date in the tournament timezone and remains editable by the director**. This is a setup default, not a validation restriction. Preserve explicit overrides. Intended current values: start 2026-11-02 08:08, end 2026-11-06 23:59, Pacific/Honolulu. These are user-reported intentions, not verified persisted values. The earlier 6 p.m. suggestion is superseded.

Current setup uses a required datetime-local End date field and intentionally does not seed an end date/time from the creation form. It does not automatically apply the requested 23:59 default when selecting an end date. Record this as a focused future functional UX gap; do not change the live draft or implement a default during this walkthrough. A later change must retain timezone and date validation, allow explicit time overrides, avoid resetting them on reload or date changes, and preserve historical saved end times. No immediate publication or migration is requested.

### Deferred telephone formatting

### Deferred whole-dollar base entry increments

### Proposed Side Pool type selection and multi-event extension (approval pending)

User Sentinel_99c037269fb48191a271d18f422c03b4 requests Side Pool type choices like Q Pool instead of the current free-text `Side Pool type/name`. Proposed design separates an explicit policy type from an optional display name. Do not copy Q qualifier eligibility into Side Pools: rank paid entrants' event scorecards regardless of playoff qualification. Current reviewed Side amount/recipient policy is graduated only; equal variants need explicit recipient-count, top-recipient weighting, small-fund and $5 conservation semantics before implementation. Existing SetupPool conflates poolTypeCode with Side display name, so a dropdown-only cosmetic replacement cannot safely carry the new semantics. Preserve historical definitions and immutable disclosures. No local extension, database change or publication is approved by this note.

Multi-event regular-prize support is also pending: current declaration UI/writer and V8/V9 scope are single-Main. Adding Consolation changes fingerprint eventCount and can stale Main; later-event addition is not a verified financial workaround. Do not finalize, collect, or claim complete multi-event accounting until reviewed support exists.

Latest user clarification Sentinel_093872cbe8b48191bf5f1588064318ba supersedes the earlier mandatory-Consolation proposal: **do not require Consolation for every Main unless an applicable authoritative ACC rule is verified**. No blanket client/server gate belongs in the proposed extension. Main-only remains permissible under current app behavior; optional Main+Consolation must nevertheless have complete supported per-event declarations/accounting. Do not conflate sanctioned and informal formats or infer a universal ACC mandate. Current saved v2 has no prize declaration (count zero); scheduleBlocksActivation independently disables Finalize. Implementation approval for the extension remains pending.

The same user report confirms the user-operated save/reopen durability test passed: both Q Pools and tournament setup were retained. This supplements the server read-back of version 2; it does not imply finalization, synthetic enrollment, receipts or scoring occurred.

User observed Entry fee helper says minimum $3 in one-cent increments (Sentinel_9a728c7e992481918b86e9e6791392d0). This conflicts with the whole-dollar entry-fee requirement relayed during the walkthrough. Source: MoneyInput defaults step=1 minor unit (one cent); base Entry fee supplies the minimum but no step override. API validates integer cents and minimum but not divisibility by 100. A later focused fix must cover both UI and server/recovery boundaries for new base-entry terms, preserve history and explicit free choice, and retain the separate positive $5 Q/Side rule. Do not round user values silently or apply this to legitimately cent-denominated expense/accounting records. No implementation/publication during the active walkthrough.

User request Sentinel_1efd0a5d03c08191b0d0dbf4a6d7af4b: automatically insert hyphens while entering a US ten-digit telephone number, for example `8085550100` → `808-555-0100`. Current setup Phone input stores the raw input via onChange, with type=tel/inputMode=tel; it does not format automatically. Manual hyphens work now. Review this alongside the editable 23:59 end-time default after the walkthrough; no hosted change or deployment is authorized now. Preserve pasted/formatted valid contacts, partial editing, cursor position, selection, backspace and reload behavior; avoid truncating or corrupting existing valid international/extension values. Formatting must not silently change the contact identity or broaden validation requirements.

Ready: inspect the existing authenticated Create Tournament form; review registration labels/source and workflow; use existing test identities without changing credentials.

Pending before writes: named new staging fixture and event terms; registration link/release readiness; any simulated financial records; fixture-only role invitations and personal acceptance; player-binding evidence and exact simulation/independent-human choice; check-in/seating/start authorization. No new fixture, account, role, credential, fee or hosted setting was created by this plan. Preserve all completed and incomplete earlier fixtures.

Sources: src/components/director-access-actions.tsx; src/app/director/tournaments/new/page.tsx and new-tournament-client.tsx; src/app/register/page.tsx and registration-form.tsx; src/lib/api/public-registration-v2.ts; docs/product/production-requirements.md registration/payment/check-in/identity boundaries.
