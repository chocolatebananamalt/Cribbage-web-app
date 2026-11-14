# Phone input: local acceptance and review candidate

Date: 2026-11-06 UTC. Windows, Node 24.19.0, pnpm 11.19.0; headless Chrome.
No hosted data, real contact information, database fixture or money was used.

## Completed behavior

The actual Tournament Setup Director Phone field now inserts domestic hyphens
while editing and supports paste-like replacement, middle selection, caret
restoration, keyboard and no-keydown mobile deletion. Loaded historical text,
international/extension/Unicode values and disabled behavior are preserved.
The optional field remains `type=tel`, `inputMode=tel`, `autoComplete=tel`,
maximum length 40. Existing save validation and public-contact visibility are
unchanged. No changes to fees, admission policy, MRP, payouts or roles.

The browser proof renders the actual setup client with its unchanged recovery
boundary and worker, using fictional intercepted local API responses. It edits
the actual Phone field, then verifies the mock draft-save payload contains
`808-555-0100` while the existing Main and Equal Q-Pool choice remain intact.
This proves UI/request serialization, not real database persistence or identity.

## Evidence

- Full `pnpm verify`: **exit 0**, **2,116 application tests**, production audit
  clear, provider declarations/build passed, workspace **8/8**, private handoff
  **6/6**. Lint: **0 errors**, **119 existing warnings**.
- Focused phone/contact/adjacent setup checks: **16/16 pass**; TypeScript passed.
- Browser: **4/4 widths** (320, 390, 768, 1440), normal and 200% contact text.
  Typing, paste-like replacement, selection, repeated edits, collapsed mobile
  deletion, selected-only separator deletion, composition, loaded history,
  international/Unicode, disabled controls and mock save were exercised. No page
  overflow, browser errors or external requests. Native text-input horizontal
  scrolling is still needed for the full number at the narrowest enlarged size;
  the complete value is retained. No physical iPad or screen-reader certification.
- Independent review: **GO** after fixing the mobile separator trap and the
  selected-hyphen digit-loss regression. The actual browser reproducer caught
  the latter before release.
- React review: direct imports, no added network/data effect, transient caret
  refs instead of duplicated field state, input-scoped listener cleanup,
  expected-value/active-element checks before caret restoration, and unchanged
  label/telephone semantics. No additional issue required a code change.
- Initial harness recovery initialization needed the app's existing worker
  asset copied into the local test app. The recovery boundary was not bypassed.
  Final browser run passed; owned server port 3376 was confirmed closed.
- Visual inspection: 390px normal and 320px enlarged contact-section captures.
  Browser screenshots remain internal QA; none were uploaded or published.

Logs: `test-results/tournament-phone-*` and
`test-results/tournament-phone-input-browser/result.json`.

## Isolated candidate

`test-results/tournament-phone-isolated-head.patch` contains exactly three
production files (helper, component, one setup import/input replacement) and
three test files. It excludes unrelated setup/Finance/rehearsal work. Independent
review and read-only `git apply --check --cached` passed against local HEAD
`ba2845a92a484ec66e360817709c5c6ed43aa296`; the index was not modified. The
published target was not checked and no commit/push/deployment occurred.

Ready for user review: the small phone-entry behavior and isolated patch.
Publication to the test version still requires a separate go-ahead and target
preflight. It requires no database migration. The pending database approval
continues to block the larger mixed-rehearsal/runtime work, not this phone fix.

Current saved drafts and test records were not accessed or changed. The local
checkpoint receipt is `test-results/tournament-phone-checkpoint.json` after
creation/byte verification. It is source/QA evidence, not database recovery,
complete checkout or off-device durability.
