# Rule-context authoring and activation backstop source

Implemented local bounded source in `event-prize-rule-context-source-v1.sql`,
the `event-prize-rule-context-v1.ts` DTO/recovery codec, and the
`EventPrizeRuleReviewV1` component. The lead owns the actual routes, normal Setup
composition and app recovery-key inventory. No source or hosted flag is enabled.

The SQL reader returns only actual current Main/Con setup rows and their latest
review history under tournament, source and current reviewer-role locks. Absence
means no review history was found. A prior review remains present when stale or
its author loses the required role. Server eligibility is independently checked
against series-only rules by the client decoder. The original entry count stays
unknown until native sporting evidence exists. A supporting reference does not
prove external approval or waive a rule.

The panel requires an explicit sanctioning Yes/No and duration for each absent
review; it infers neither from names nor from TEST ONLY text. Each exact request
is stored before POST under `prize-context-review:actor:tournament:eventRow`,
using existing storage coordination and owner checks. Unknown, malformed and
late-account/source outcomes retain pending bytes. Cleanup requires a complete
actor/operation/request-bound journal and a fresh matching current workspace.
Superseded/rejected confirmed journals require explicit resolution plus another
fresh readback. Unknown outcomes have no discard action.

`onReadyChange(false)` runs on field edits, pending/unknown work, unavailable
storage, source changes and loading. True requires validated current saved
eligible reviews for all rows and no local edits or pending work. It is UX
gating only: the root still obtains and verifies activation source immediately
before constructing its outer request. No calculation or payment authority is
introduced by these reviews. Clean fields derive from the actual refreshed
review; dirty fields retain their original expected review identity and cannot
save over a newer review until explicitly rebased. Pending fields display the
exact retained request. Contradictory same-review immutable readback, or an
accepted review disappearing under the same source, remains unverified.

Two activation source findings were also corrected:

- Source-lock SQLSTATE 55P03 now propagates from the current-pin helper and is
  classified as `retry_exact/source_busy`, avoiding a permanent rejected journal.
- A new BEFORE guard on actual native activation rows inspects the current V2
  prize plan independently of series mode. A proposed V2 plan cannot enter via
  an old linked/pinned finalizer merely because series settings were preserved.
  Existing historical exact receipts insert no new native row and stay readable.

The lead's first local install attempt also exposed ambiguous operator parsing
in `v->'activation'-'kind'`. The inner constructor now explicitly extracts the
JSONB object before removing its kind key: `(v->'activation')-'kind'`. A source
regression pins that expression. The failed disposable fixture was removed by
the lead; this note does not claim a successful PostgreSQL run of this slice.

Executed checks before the final source-review refinements: TypeScript no-emit
exit 0; scoped ESLint exit 0; 90 relevant focused tests passed. The expanded
context/activation suite subsequently passed 20 cases after native-row/version,
contradictory history and SQL operator regressions were added. The tests include source contracts,
actual codecs, identity/source/operation rejection and recovery classification;
they do not claim browser interaction or PostgreSQL runtime.

The exported activation acceptance function now accepts an optional caller-owned
`withHeldLock(lockSql, work)` port. It asserts actual held-lock preparation and
finalization return retryable outcomes with no poisoned intent/outcome before a
same-operation retry. No container or database was started by this implementation
agent. The lead owns approved disposable runtime, actual public legacy bypass
rejection, responsive browser recovery, integrated verification and final memory
updates. Independent source review found no remaining definite P1/P2 after the
contention, native activation, clean/dirty form refresh and contradictory-history
fixes. Actual React refresh/recovery and PostgreSQL acceptance remain lead gates.
The previously denied audit was not retried.

Final scoped rerun after all source-review fixes: 92 relevant tests passed;
TypeScript no-emit and scoped ESLint exited 0. No browser or PostgreSQL execution
was performed by this implementation agent.
