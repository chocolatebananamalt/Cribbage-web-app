# Local payout settings and pool-summary preview

## Authorized boundary
Parent requested independent NON-FIXTURE local work while the owner sleeps. No new confirmation, fresh database fixture or retry of the denied fixture action. This slice uses pure monetary calculations and ephemeral browser arithmetic inputs only. No database/API/hosted calls, registrations, elections, receipts, invitations, role changes, policy adoption, publication or persistent settings. Existing seating checkpoints remain separate.

## Reviewable implementation
- `src/lib/results/payout-resource-preview.ts`: deep-frozen versioned reference outputs and attributed native Sheet provenance; existing V2 amount-calculator wrapper; separate balance, method, equal-cohort and $5-increment checks; aggregate-only projector over strictly scoped stable-entry/version and current net-allocation inputs.
- `src/components/local-payout-preview.tsx`: eight supplied workbook cases, exact source awards/fund differences, graduated what-if settings, explicit memory-only comparison snapshot, and fictional player-visible pool-summary card. Definitions explain entered versus paid versus allocation versus projected fund. No personal names/debts/receipt IDs displayed.
- `/local-payout-preview` page: default-off development/test loopback display gate. Global RootLayout authentication is unchanged. Do NOT use the actual application layout against a hosted backend to test this display. Browser acceptance uses its own isolated no-auth/no-backend layout.
- Source CSS is scoped to the new display component. Existing operating payout/settings/financial functions are unchanged.

## Verified source cases and policy discrepancy
The parent verified the native Google Sheet at https://docs.google.com/spreadsheets/d/1HlDFQxNEWjm_oG62ocq4XYCvwa6xgy0U0OsE515vXrc/edit . This executor did not recalculate it or obtain the full56-case bundle. The preview preserves supplied outputs, not a general workbook reimplementation.

1. Main40×$10 less$3sanction each: fund$280, ten tier awards total$285, $5over. Equal within supplied elimination cohorts and $5 increments can pass while funding fails.
2. Side17×$10,1-in-6: Sheet$95/$55/$20 versus existing appV2$85/$55/$30; both total$170. This is a distribution-policy conflict, NOT merely rounding. Neither replaces the other.
3. Qfund$200,six eligible qualifiers: Graduated$55/$45/$40/$30/$20/$10 and Stairstep$60/$50/$40/$20/$20/$10 balance. This recipient rule is not20paid at1-in-4; the V2ratio estimate would have five awards, not six.
4. QEqual6×$35 and top-double$60+5×$30 total$210, $10over; equality/double-share method compliance is independently true.
5. QEqual9×$20 leaves$20unallocated. No unequal adjustment, refund, new funding or retained-balance policy is invented.
6. Satellite supplied totals only: fund$1,003/awards$1,005, $2over. No Top4 split or tier amounts are inferred.

## Aggregate projection safeguards
Uses a unique current latest election per stable entry and exact event/pool/USD scope, not display names. Duplicate identical rows dedupe; conflicting equal versions, stale latest elections, currency/scope mix, reused allocation IDs or invalid/overflow amounts are unavailable. Currentness is checked BEFORE withdrawn/superseded filtering, preventing stale absence from looking like zero.

Known entered/waived/projected billable counts remain separate when allocation evidence is unknown. Fully-paid count and eligible fully-paid fund become null, not zero. Positive/unknown excluded allocations require review and never imply a refund or disappearance of cash. Waivers never create a positive-fee paid fund. Inputs must eventually come from a trusted current net-allocation/obligation adapter; this pure projector cannot establish payment authority. It deliberately does not label eligible fully-paid allocations as all money received.

## Verification
Eight focused pure tests, ESLint and TypeScript passed; independent model review clear, no remaining P1/P2. Review found and fixed stale withdrawn/superseded latest elections incorrectly appearing as zero.

Four component-only fresh-browser groups passed at320/390/768/1440, doubled computed text/no document overflow, all eight references, preserved source outputs while editing what-if values, memory snapshot isolation, invalid input rejection, entered/paid/fund separation, unknown/held/stale states and zero external/API/storage activity. This is not provider-authenticated or live-allocation acceptance. Final full `pnpm verify` exited0:1321application tests,6provider checks, production build, ESLint, audit (no known vulnerabilities) and8workspace checks passed. `pnpm verify:handoff` exited0,6checks. Final browser rerun passed all four widths after the stale-election fix and stale timestamp label.390px doubled-text viewport visually inspected: readable wrapped text and no clipping. No accessibility certification claimed. Logs `test-results/local-payout-preview-verify-final.log`, `local-payout-preview-handoff.log`, browser receipt `test-results/local-payout-preview-browser/result.json`.

Final pure-source SHA256 `1990bde5f2d4dfdde1b9d0aa2b1582121871dfda642ca592f096af088b7eb606`. Independent review found no remaining P1/P2 for this bounded preview. Local source/evidence ZIP CRC/allentrySHA verified in `test-results/local-payout-preview-backup.json`/source manifest. No off-device durability claim.

Run the standalone browser verification with `node tests/local-payout-preview-browser.mjs`; it creates only a temporary local display test app, launches fresh headlessChrome and stops its loopback server. No operational database or tournament fixture is involved. To inspect interactively later, the generated `test-results/local-payout-preview-browser` app uses the isolated layout; normal app RootLayout remains untouched.

## Decisions and unimplemented integration
- Choose the intended Side distribution baseline (95/55/20 versus85/55/30) before changing operating policy.
- Resolve equal/top-double indivisible funds while preserving equal place/cohort treatment and $5 rules; confirm no-eligible and tie handling. No automatic refunds/remainders.
- Main/Consolation/Satellite method selection, editable source-table parameters, event payout bands, Top4 split, funding/expenses and amendments remain pending the owner's friend/review. This preview does not replace live declarations or implement an official method registry.
- Build/review a trusted event/pool-scoped current obligation/net-allocation adapter, supported pre-enrollment joining/counting path and aggregate endpoint before claiming running live totals. Existing private finance workspaces must not be exposed. Public versus signed-in visibility needs explicit access review; no permission change here.
- Player card is presentation only. Estimates are neither approved awards nor payments; no real-money readiness follows.
