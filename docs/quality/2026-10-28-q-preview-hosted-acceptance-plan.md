> **Policy re-review hold — 2026-10-29:** Recipient selection restricted to paid playoff qualifiers and the no-eligible refund assumption are disputed pending original ACC formula/example verification. This document records earlier implementation/test evidence, not proof of ACC policy correctness. Preserve all unpaid history; do not execute payouts/refunds or continue settlement integration. See `2026-10-29-q-recipient-policy-dispute-hold.md`.
# Proposed hosted Q policy acceptance — one bounded fictional fixture

Planning only, 2026-10-28. No hosted records created. Companion `2026-10-28-q-preview-hosted-fixture.json` contains reviewed synthetic pairings/outcomes with no copied database UUIDs. Published app/migration remain unchanged.

## One fixture and exact budget

NEW `TEST ONLY — PR122 Q Policy Preview Acceptance`: one Standard Singles Main, 16 paper entrants `TEST ONLY QPay01` through `QPay16`, 12 qualifying games each, four tables/four seats. No Side Pools or other event. Both Q definitions use **Equal (Pays All Equally)**.

| Ledger component | Explicit fictional records | Total |
| --- | --- | ---: |
| Base entries | 16 × $30.00 | $480.00 |
| Q1 | $5.00 each from QPay01,02,04,16 | $20.00 |
| Q2 | $10.00 from QPay15 only | $10.00 |
| Cumulative receipts | Four at $35.00; one at $40.00; eleven at $30.00 | **$510.00** |

Record two immutable test disclosure policies before **any** elected membership or receipt. Use explicit TEST ONLY simulated-disclosure references; no real flyer/email publication or claim of actual player consent. Sixteen membership snapshots contain five elected-pool acknowledgments bound to the exact policy UUIDs; the other eleven entrants explicitly decline both. Save sixteen obligations, sixteen cumulative receipt records and sixteen full allocations. Never infer enrollment from payment or double-count the cumulative receipt. No receipt void/replacement is needed here; that already passed in the preserved two-player fixture.

## Supported qualifying path and independent expectations

Use actual registration/check-in, permanent seats, enrollment, schedule publication and Start Event. The machine fixture supplies **96 reviewed matchups**, eight per round, with distinct Table/Seat positions and 12 games per player. It reuses the earlier reviewed 16-player pairing/outcome pattern but strips all old IDs. Every result and both card-source references are explicitly synthetic; no photos/OCR or claim of played matches.

Supported Paper workflow: each round eight first captures, then eight separate re-entry approvals. Verify persisted counts before advancing; never insert verified status directly. Expected final counts: 96 captures, 96 approved reviews, 192 card evidence records and 192 authoritative scorelines. This is the existing single-official paper consistency workflow, not two-human independent review.

Expected standings points/wins/net:

`02 24/12/+147; 01 24/12/+136; 04 22/11/+142; 03 22/11/+133; 05 18/9/+98; 06 16/8/+74; 07 12/6/+19; 08 10/5/-11; 12 8/4/-31; 11 8/4/-32; 10 8/4/-34; 09 8/4/-37; 13 6/3/-76; 14 4/2/-124; 15 2/1/-175; 16 0/0/-229`.

Totals **192 points, 96 wins, zero net spread**; no tied standing. Finalize qualification once through its supported workflow: **QPay02, QPay01, QPay04, QPay03**, high nonqualifier QPay05. Four qualifiers/no byes. Do not create playoff results, MRPs, cross-check closure, base-prize claims, expenses, payback reviews or final settlements.

An eight-player draft was rejected during planning: the actual qualification helper gives two qualifiers in the minimum four-slot bracket, introducing byes. Sixteen preserves the current supported no-bye slice. It is still a software-only rehearsal, below the Main sanctioning participant minimum; no ACC sanction certification is claimed. Any displayed assessment remains an assessment, not a funded expense. Base entry funds remain unsettled.

## Preview assertions — no payment/refund execution

- Before qualification: both previews blocked for missing finalized qualification.
- Q1: four fully paid contributors fund $20.00. Intersection with finalized qualifiers is 02/01/04; expected awards **$6.67/$6.67/$6.66** by qualifying order. QPay16 contributes but does not qualify; QPay03 qualifies but did not enter Q1, so receives no Q1 award. Regular playoff prizes are separate and not being recorded in this test.
- Q2: its only paid contributor QPay15 does not qualify; expected **$10.00 refund obligation** to that contributor. Not a refund transaction or receipt void. Base $30.00 is not refunded.
- Combined preview allocations conserve exactly **$30.00 of Q funds**, separate from $480.00 base. Receipt ledger remains $510.00; no awards/refunds/claims are written.
- Refresh and compare exact versions/source digests, counts and audit identity. Reconcile a genuinely retained uncertain request before retry; no manufactured response loss, extra duplicate mutation or alternate API route is authorized. Existing disabled payout/canonical settlement guards stay enabled.

## B role and minimum user handoffs

The director is currently signed in. Nominate only existing `pr122-player-b@test.invalid` / profile `986c7f24-1d42-4115-8532-053fc4bef59a` as this new tournament's **Cross-Checker**, using supported no-email copy-link flow. Reuse its known fictional identity fields only after checking collisions; no new account, co-director or other role. B remains outside the player roster.

B must personally accept. Then the director records exactly one audited B **Not a tournament participant** identity binding. No self-binding or director identity binding is needed for the previously proven B paper capture/re-entry path. Reconcile actual current permissions/workspace before writes; stop rather than bypass a different requirement.

With the current single Chrome session, expect four password handoffs: B acceptance → director binding/setup completion → B scoring → director qualification/preview. Check zero unsent/retry work and competing same-origin windows before each supported switch. The user enters passwords; no credential retrieval/storage, activation link or new security setting. Do not promise fewer handoffs without an already supported independent session.

## Preserved read-only regression

Existing two-player tournament `3cbae2fc-b621-4726-a582-4807744f3e42` / event `d5433d23-8acc-463d-846f-ff32589dc959` can be read before/after: cumulative receipts $75, QTest01 full $5/$10 eligibility and QTest02 declined, membership versions1/1, allocations2/1, started once. Its policy publication must stay blocked because collection/play already occurred; no retroactive certification or alteration. Compare its scoped fingerprint plus prior funded/negative fixture invariants. Do not use it to manufacture qualification or a new policy.

## Local preparation evidence and requested scope

`node --test tests/q-preview-hosted-fixture.test.mjs`: **4 passed**, actual CSV validation, independent score accumulation/qualification, explicit receipt conservation, and the actual Q preview calculator. Independent review independently recomputed the standings/budget/previews and found no P1/P2. Initial eight-player no-bye assertion failed and drove the corrected sixteen-player design, rather than weakening the assertion. No application behavior/schema changed; full expensive verification was not repeated for proposal-only data/tests.

Suggested bundled approval: **May I run this one staging-only 16-player fictional acceptance test: freeze both equal-share policies before collection, record the $510 synthetic ledger, publish seats/schedule and start, enter/re-enter 96 simulated qualifying results, finalize the four qualifiers and verify the Q1 odd-cent awards and Q2 refund obligation previews? This includes nominating existing B as this tournament's Cross-Checker for your personal acceptance, and the director confirming B is a nonplayer. No actual money, refunds, payouts, emails, playoff results, final settlement or production changes. You would enter the passwords at four planned account handoffs.**

