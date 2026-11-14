# Director Fund Ownership Review — Local Implementation

Closes the missing V3 ownership authoring step identified by the selected-step
pool Results checkpoint. All page/API/SQL gates remain false; SQL is unexecuted
and new RPCs have no execution grants.

## Implemented Flow

- Page: `/tournament/[tournamentId]/finance/[eventId]/pool-ownership`.
- Private API: `/api/v1/tournaments/[id]/selected-pool-ownership/[eventId]`.
- Primary Director only. Normal-session identity and role checks precede the
  existing server-only client and surround all privileged source/write/proof
  calls. POST is same-origin, bounded and scoped; disabled gates return before IO.
- The form displays actual recorded regular, Q-Pool and Side Pool partitions.
  Every existing cost needs explicit Player Benefit or Operating Expense
  classification. Costs cannot exceed regular funds or borrow optional funds.
  Classification creates no receipt, duplicate expense, payout or bank claim.
- Review requires a reason, classifications and explicit confirmation. Changing
  a classification, reason, source or admission invalidates confirmation.
- Retain stores the exact actor/event/operation/request/review through the existing
  compare-and-swap storage port. Send is separate. Lost replies require explicit
  exact-operation recovery; there is no automatic resend or rebasing.
- Unknown/corrupt/other-scope retained work blocks replacement. Rejected/retry/
  unknown responses never clear it. Cleanup requires immutable receipt, exact
  stored request and source proof, including actual prior revision/version.
- A matching current saved review is shown without another save. Gated links
  connect ownership and pool award review pages.

## Durable History

The existing private V3 ownership writer persists classifications in its immutable
operation request and full source capture in its versioned revision. It now emits
a V3 receipt and an audit event. New ownership writes are blocked after selected
pool awards finalize; exact historical replay occurs before that block.

New revoked adapters provide current preparation and original operation proof.
They do not replace V2 journals or weaken the legacy new-prize rejection. The
ownership source remains readable for current Results comparisons after its own
final; only new writes are frozen.

## Focused Verification

Six focused Node tests passed: fund/cost coverage and private-evidence stripping,
primary Director access, immutable proof, retained-before-send, exact lost-reply
recovery, no redundant current review, corrupt/rejected/stale/identity holds,
write-gate withdrawal before dispatch, and static SQL audit/replay boundaries.

TypeScript `--noEmit`, changed-file ESLint and independent source/UI/API review
passed. React review checked effect cleanup, stable retained state, label/select
association and immediate confirmation revocation.

Actual React offline checks passed at 390 and 1440 pixels: required classifications,
confirmation reset, separate funds, Retain/Send, lost reply/exact recovery,
accepted-proof archive, current-review no-resave and account-loss concealment.
Zero network requests. Evidence:
`test-results/selected-step-ownership-browser-20261110/result.json` and
`review-390.png` / `review-1440.png`.

## Limits

Browser tests use fictional identity/provider and in-memory transactional storage;
they do not establish actual IndexedDB reload/concurrency, signed-in provider,
database ACL, SQL compilation/transactions or real financial operation. Source
scope remains one official Main, 12 qualifying games, 1–2 Q and 1–6 Side pools.
Changed-distribution consent, eligibility and calculation holds remain intact.

The local authoring gap is closed; permitted runtime/provider/recovery acceptance
and a separately approved release are still required. No hosted action, new
fixture, grant, publication, credential, payment or denied-operation retry was
performed. No broad suite or full build was run.
