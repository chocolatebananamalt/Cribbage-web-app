# Event Finance browser verification and read-access contract

## Scope

Local-only continuation of the separate Finance UI. A headless Chrome harness renders the real component and real in-memory proposal controller with clearly fictional data. It does not create a database fixture, use accounts, read/write hosted records, send invitations or record payments. No SQL or publication occurred. The previous source-only archive/report remain preserved as historical checkpoints.

## Browser evidence

`node tests/event-finance-section-browser.mjs` passed at 320, 390, 768 and 1440 CSS pixels, each at normal and simulated 200% text. The latter explicitly doubles computed text sizes in the existing DOM; it is not OS/browser full-page zoom or a physical iPad test. Four viewport groups passed with no page errors, non-GET/HEAD requests or local/session storage changes.

Verified behavior:

- Keyboard Enter opens the row editor; new/corrected forms focus Description and group edits focus Amount. Opening focus becomes visible after native browser scroll settles. Apply/cancel returns focus to the corresponding Review/Add control.
- Applying/cancelling/correcting/voiding rows leaves the opened section available. Descriptions and amount/reason inputs remain controlled; blank/whitespace reasons cannot apply/void, cancellation preserves prior amounts, void appends history.
- A new row's unavailable source amount is distinct from a proposed $0.00. A group override of $0.00 is retained and distinct from no override; restoration requires a reason and restores the calculated whole-group amount.
- Top 6 expands to the full equal 5th-8th group; all four receive the same per-person amount. Included-place and positive-award counts remain separate. Balance/zero-award warnings are independent.
- Q-Pool and Side Pool amounts remain separate and read-only. Source changes retain rows and block editing, with an explicit review message.
- No document-wide horizontal overflow at any tested width/scale. Wide payout tables scroll in their own keyboard-focusable regions. Visible product buttons meet 56px target height; each rendered input/textarea/select has an associated label. Headers/captions/fieldset legends and status/alert text are present.

Images were visually inspected for the phone form, narrow normal/200% text, tablet enlarged text and desktop layout. Normal-size fields and focus outlines are readable, tablet/desktop figures remain aligned, and enlarged text wraps without clipping. See `test-results/event-finance-browser/result.json`, `*-viewport.png`, `*-line-form.png` and full-page `WIDTH-SCALE.png` files. These are local evidence, not a newly deployed user preview.

## Concrete repair

The initial dynamic test found the controlled `details.open` prop was removed after Apply, closing the section and hiding the newly added row (data remained intact). The component now preserves native disclosure state, explicitly opens a retained/new editor and handles opening/return focus. Opening focus uses normal scrolling so a new field is not left offscreen; return focus uses `preventScroll`.

The first restricted-network harness could not connect to its ready localhost server. The network-enabled browser run succeeded. Initial test selectors were corrected to target summaries and handle typographic dashes; those selector failures were not scoring/financial failures. Browser native scrolling required a bounded settle check rather than a same-tick coordinate assertion. The final complete run passed. The test server was independently confirmed stopped with connection refusal on localhost:3368.

## Safe source-level access work

`event-finance-read-v1.ts` is an UNWIRED, default-off permission/shape factory, not a live authenticated Finance producer or route. Only literal true enables it. It rejects player/public audiences before reads, requires Director/co-director roles before and after, pins the original actor/tournament/event across awaits, clones and validates the exact source envelope/workspace, and fails unknown/foreign/incomplete data without substituting zero. No default provider, new grant, actual headers or write path exists.

Seven mock tests passed, including disabled reads, broader-role denial, role revocation/actor switching, mutable caller/dependency objects and extra private fields. The result explicitly reports providerRuntimeVerified=false, sourceAtomicityVerified=false, writeAuthorized=false and paymentAuthorized=false. noStoreRequired is a requirement for a future transport, not proof of headers.

Independent reviews cleared the reader findings and narrow component changes with no remaining P1/P2. Focused TypeScript/ESLint, 23 model/controller/reader groups and static renders pass. Full `pnpm verify` exited 0 with 1,695 application tests, six provider checks, dependency audit (no known vulnerabilities), ESLint, production build and eight workspace checks. `pnpm verify:handoff` passed six checks. Logs: `event-finance-browser-final-verify.log`, `event-finance-browser-handoff.log`, `event-finance-browser-model.log`, `event-finance-browser-ssr.log`, and final `event-finance-browser-network.log`, all under test-results. No live provider/database acceptance is implied.

## Remaining gates

- Complete trusted Finance source assembler: current allocation/optional-pool coverage, entry counts, settings, qualification and accounting history in a coherent source snapshot. No fallback from count-times-fee or partial legacy sources was invented.
- Real authentication/provider/role/RLS and source atomicity acceptance, no-store transport, durable save/retry/rollback/recovery, archive delivery, real payment evidence and finalization. The new section remains disabled/unpublished; old declaration safeguards remain.
- Screen-reader testing, automated full accessibility audit, physical-device/browser zoom acceptance and integration with the real app shell. This local check is not accessibility certification or live finance readiness.
- Existing unresolved custom paid-ratio population/rounding and beyond-qualifier payout policies remain blocked; optional pool policy and historical awards are unchanged.
