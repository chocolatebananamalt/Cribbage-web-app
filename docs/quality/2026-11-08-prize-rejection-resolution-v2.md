# Confirmed-rejection resolution, private Finance candidate

The prior candidate could retain a definitive rejection but could not resolve it.
This patch is limited to that local recovery dead end; database functions,
public grants, payout policy and financial finalization are unchanged.

## Acceptance and safety boundaries

Only a full immutable rejected operation receipt can be resolved. A code-only,
attempt-only, absent, malformed, foreign, changed or unknown response cannot
clear pending. Require explicit confirmation and a nonblank bounded reason.
Before archiving, recheck exact retained bytes, recover the same full rejection
through the authenticated provider, and read a fresh scope-bound workspace.
Check owner generation after each asynchronous boundary.

Use the existing atomic retained-port transaction: compare original pending
bytes, write the immutable archive, then clear pending. Archive includes the
exact original retained string, complete prepared request and receipt, reason
and observed workspace. No server record changes, new operation, resend,
recipient assignment, financial adjustment or source adoption occurs.

A lost archive acknowledgement does not claim success in the active screen;
reload may find no pending because the atomic archive committed. The full
archive and server rejection remain. Unknown/replaced storage remains intact.
The archive is written through the retained port atomic storage contract;
actual real-origin IndexedDB acceptance remains separate. A general archive
browsing UI is outside this patch; the resolution metadata shown in the active view is not a server audit
timestamp and is not claimed to survive a full reload.

## UI

Recorded rejection shows a required Resolution Reason, explicit checkbox and
Archive Confirmed Rejection action. Held handlers compare the current reason,
confirmation, operation, editor, source and owner before acting. Unchecking or
changing a reason invalidates an older captured action.

After resolution, rejected local text/history stays visible and locked until
explicit review. Load Saved Proposal retains only actual accepted history;
a changed-source review begins empty only when source adoption is valid; with
no saved head it starts a new append review. Rejected adjustments are never
silently copied to the saved head or a fresh proposal. The pending outcome must
be proven, not inferred from a current head.

## Verification

Twenty-four focused controller/HTTP tests passed, including ten new rejection
cases: happy archive/new operation, missing consent/reason, attempt-only rejection,
forged fresh receipt, role/storage/archive failures, changed accepted head,
duplicate actions, late generation/recovery/archive acknowledgements, and lost
archive acknowledgement/reload and immutable archive collisions. Existing fourteen save/recovery cases remain.
See test-results/prize-rejection-v2-operation.log. Additional codec/handler and
actual React offline browser acceptance are recorded in their existing reports.

Features remain disabled. Real Supabase sessions, real-origin IndexedDB/full
reload and enabled-page acceptance remain unverified. No hosted data, live draft,
public upload or money was accessed or changed. Payout policy questions are
prepared in docs/decisions/2026-11-08-prize-remainder-and-fee-open-questions.md;
approved no-refund redistribution and established regular V3 rules stay intact.

## Final check results

Application 2,518/2,518; production build including TypeScript exit 0; provider
readiness exit 0 with existing disabled-provider fallbacks; workspace/handoff
14/14; full lint zero errors / 201 warnings. No new database fixture was needed
for this local/controller-only change; prior backend immutability and forced
overlap evidence is retained, not represented as a new provider-session test.

Actual React offline browser run58704 passed four widths at 100%/200% text,
including rejected overrides, confirmation/reason revocation, failed readback,
role/archive failure, accepted-history prefixes, lost archive acknowledgement
and same-scope provider/storage replacement. Zero network/navigation/page errors.
UI SHA 0eecafe88a79ad3bf32afd22afea960209b19cccfc394428830b135e51ed29a4;
controller SHA 788742d0e838c63ae4473ea28246b16d933817a91a3ec0201f71a28664c5620d;
offline result SHA
947fa2d2e495a993d3b252ea749df07a3cdf573f9fa6b7fd2e6a0b2dd8c29009.
Independent source/security review GO, no remaining definite P1/P2 for the
disabled candidate. Real provider/storage acceptance is still required.
Prior registry-audit denial was not retried; aggregate pnpm verify is not claimed.

Subsequent local archive browsing is implemented and tested in [archive browser acceptance](2026-11-08-prize-archive-browser-v2.md). It exposes readonly historical device copies, including rejection reasons, without applying them. Actual provider/IndexedDB acceptance remains separate.
