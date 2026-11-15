# Modern payout fee-evidence integration (private, default off)

Connected the private current-common-fee collector to the modern Graduated / Winner Multiplier source when actual first-round losers are paid. The source pins the complete fee capture, including each original entrant's current receipt and obligation identities/versions. The writer rebuilds that source under locks before checking the retained expected source digest. A same-amount new obligation therefore changes the review, not just an amount change.

The independent TypeScript review requires the exact same complete fund capture, qualification result and original entrant count. It supplies the fee only to a cloned final evaluation; the saved prize plan, source input, overrides and history stay unchanged. No advertised-only, averaged, waived, discounted, split, bundled, simulated or late-Consolation add-on fee is inferred. Missing or changed evidence holds. Unset intentions, unsatisfied less/equal/more comparisons, incompatible rounding, imbalance and existing method-review holds remain in force. No automatic balancing or fee-floor solver was added.

The Director projection adds only the common fee, saved comparison and actual lowest finishing-group amount. Receipt, obligation, financial-source and profile IDs remain server-only. Metadata participates in the existing exact confirmation/pending/retry comparison. Historical record decoding preserves this captured comparison while explicitly retaining `currentSourceVerified:false` and no payout authority. Old captures without the optional fee-source field remain readable.

Focused evidence:

- Source/contract/accounting tests preserve existing methods and historical records. New integration cases independently check 32 full entries of $2.50, eight qualifiers and an $80 fund: Graduated factor 2 pays first-round losers $4 each (more); factor 4 pays $1 (less); Winner Multiplier 3 pays $8 (more).
- A balanced equality case uses 32 entries of $3, an $96 fund, factor 2.5 and $1 increments: awards $49, $19, $8 each for 3rd-4th, $3 each for 5th-8th. No rounding override or balancing policy is invented.
- Missing, discounted, waived, bundled, changed-scope, incomplete-roster and mismatched-head evidence rejects. Same-amount replacement-obligation evidence rejects the retained review before any write in the mocked normal-session transport.
- Offline actual React at 390/1440 pixels shows the fee comparison and preserves explicit two-step retention/send, lost-reply exact retry, confirmation invalidation and identity/pagehide conceal. Zero network requests; mocked identity/provider/storage, not real signed-in or full-reload acceptance.
- TypeScript, scoped lint and independent source review pass. Independent review reports no P1/P2 findings. SQL SHA-256: `b149c3dddd36544289d0d712eb2f69aa13f270cc35da0890e612f0ca4faed19f`.

All existing page/API/write gates and both SQL feature gates stay false; functions remain revoked. No schema, fixture, hosted operation, publication or denied-operation retry occurred. SQL syntax/runtime, ACL, lock/concurrency behavior and true provider acceptance remain unverified. The collector and modern SQL source must both be present before any future verified enablement; no current hosted behavior changed.
