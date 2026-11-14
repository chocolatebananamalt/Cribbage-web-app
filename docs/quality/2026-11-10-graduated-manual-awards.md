# Graduated Whole-Group Manual Award Integration

Local candidate only; every existing gate remains off.

Saved active Graduated overrides now replace formula suggestions in unpaid award review. The Director sees suggested and reviewed amounts plus the saved reason; current Results identify adjusted awards without exposing reasons. Entire finishing bands retain equal per-person amounts, including explicitly unpaid bands. Exact balance, positive included amounts, selected units, rank order and verified first-round fee comparisons remain mandatory. Voided overrides restore formula suggestions. Changed Equal and Winner Multiplier distributions remain held.

The SQL candidate validates stored history and selects the latest exact-band record; the capture/digest format is unchanged. It has not been executed. Existing immutable source/history and exact-retry protocols remain in place.

Verification: four new regression tests; 23 existing focused Graduated, fee-evidence, journal transport and Results tests; TypeScript; targeted ESLint. All pass. The tests exercise pure/protocol fictional fixtures, not database runtime, actual signed-in provider, browser rendering or disbursement. No full-suite/audit/build was run.

Independent source review: GO, no concrete P1/P2 finding; confirmed SQL/TS latest-history/void parity, preserved holds and Director-only reason disclosure.

Remaining gates: permitted SQL/runtime verification and browser/signed-in acceptance before any enablement. Hosted publication remains paused; no hosted operations were attempted.
