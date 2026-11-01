# Truthful single-operator player links — local only

## Scope and observable acceptance

Daron confirmed that he operates both laptop and phone. On November 1 he approved
building/testing a truthful simulation locally, not certifying himself as an
independent human witness. The existing rehearsal is tournament
`3c58ef91-010c-4769-af20-5cfa2ffe98a9`; the two existing test profiles are director
`de0f27a1-60d0-4449-af83-fdf360a9bc08` and B
`986c7f24-1d42-4115-8532-053fc4bef59a`. B's invitation is accepted and fixture-only
co-director access was verified read-only. The draft has no roster/account links
or operational event. Neither current signed-in session was changed.

Acceptance: explicit consent and visible simulation labels; only these two
distinct accounts in this one enrolled staging fixture; no production path or
self-account approval; original redemption, expiry, role, phrase, replay and
locking rules preserved; append-only provenance commits with each link; ordinary
and stale writers cannot create an unlabelled link; downstream authorized viewers
see that this is technical simulation, including checked-in players without an
official role. No claim of physical play or independent-human validation.

## Narrow implementation

Proposed additive `0270_simulated_player_links_v1.sql` creates two empty private
forced-RLS/no-client-policy tables: `simulated_player_link_scopes_v1` and
`simulated_player_link_provenance_v1`. Enrollment is explicit, immutable, restricted
to the staging project/fixture/operator, and prohibited after any existing links.
It references the existing explicit staging deployment enrollment. No role or
enrollment row is seeded by the migration.

Three service-role-only RPCs: `get_simulated_player_link_scope_v1` (decision
authority), `get_simulated_player_link_label_v1` (authorized-viewer label), and
`decide_simulated_player_link_v1`. The decision calls the unchanged canonical
decision, which still forbids approving the same profile. A transaction marker
binds the request; a before-link guard rejects ordinary writes for an enrolled
fixture; a deferred constraint requires matching immutable provenance before
commit. One shared advisory lock serializes enrollment against link creation.
No credentials, new role grants or weaker human-witness checks are introduced.

The API accepts an exact approval-only `simulatedSingleOperator:true` consent
field, derives its actor from the authenticated session, and has an exact staging
URL/fixture/profile gate. Scope is revalidated in SQL. The workspace requires an
unchecked-by-default consent checkbox and displays **Record simulated match**.
The normal flow retains **Approve witnessed match**. A tournament layout banner
marks downstream pages, including prepared scoring pages, as a single-operator
technical rehearsal. The redemption comparison text directs users to the
workspace and distinguishes normal physical witnessing from explicit simulation.

## Verification and limitations

- `pnpm verify`: passed with pinned pnpm11.19.0, 1,148 application tests, zero
  high/critical dependency findings, build/types/providers, six handoff checks and
  eight workspace checks. Lint: zero errors, 50 existing warnings.
- Focused contracts/adapters/routes: 15 passed. Existing normal activation deadline SQL
  runs unchanged in the isolated database.
- Real PostgreSQL: pinned reviewed image, no network/ports/mounts, unprivileged
  task-owned disposable container. Covers enrollment, unauthorized/self/wrong
  phrase, ordinary writer rejection, expiry, exact replay, changed operation IDs,
  atomic missing-provenance rollback, concurrent decisions, both enrollment/link
  race orders, ACL/RLS and checked-in-player label visibility. All eight SQL groups and both race orders passed; normal activation deadline
  compatibility also passed. All task-created databases/container were removed
  and absence verified.
- Real production UI components in fresh headless sessions at390/1440: passed
  truthful notices, consent/phrase, one in-flight request, own-account blocking,
  unchanged normal witness flow, lost response and reload without auto retry.
  The browser API is intercepted locally; actual persistence/authority/races are
  proved separately by real SQL, not claimed as hosted browser acceptance.
- Independent high-risk Sol review found and fixed the enrollment/link race and
  missing derived-player label. No unresolved P1/P2 in reviewed implementation.

The sandbox initially blocked Docker pipe and localhost readiness access; supported
per-command escalation admitted these local checks. No settings were changed.
An initial SQL test had a duplicate pending-profile seed and a later reader seed
lacked its required approved ruleset. Test seeds were corrected; product guards
were retained. A browser locator matched both correct notices and was narrowed.

No hosted migration, enrollment, link, scoring, outage, publication, production
change or money movement occurred. Existing completed fixtures/finals and signed-in
sessions were untouched. This does not satisfy independent-human, physical-game,
venue-outage, hosted disaster recovery or production release gates.

## Proposed next approval and ordering

Review the curated file manifest and exact migration bytes/hash. If separately
approved: validate staging baseline and quiet writers, apply0270 schema first,
verify private tables/RPC ACLs/owners/search paths/triggers, publish only reviewed
files to the existing draftPR122 branch and verify exact-commit CI/READY Preview.
Then, under explicit fixture-enrollment/use approval, enroll only the named draft
and operator, finish its normal setup/roster prerequisites, and use the labelled
two-account comparison. Keep all real witness rules intact elsewhere. User-operated
device disconnect/reconnect still needs an explicit execution-time agreement.

Rollback: app rollback is compatible for ordinary fixtures. An enrolled fixture
must stay blocked to old clients; do not disable its guards to make an old UI work.
Do not delete scope/provenance/link history. Revert feature use, not audit records.

## Frozen local checkpoint

Migration0270: **9,773 bytes**, SHA256
`733536D1A495373564C5F5A63A0992DAE77583B5AF94932681A3943B06BFEA19`.
CLI-generated scaffold contains identical reviewed bytes. Existing HEAD remains
`1c3cd8ceb150cdc16138267220707c8ddb7e4472`; no Git commit or push was performed.
Independent final review read the terminal SQL/browser receipts and found no
unresolved P1/P2. The publication manifest lists exact files/hashes and excludes
all generated logs, helper transfers, private configuration and screenshots.
Source backup receipt is kept outside the archive to avoid a circular hash.

## Acceptance sequence clarified by Daron — November 1

Stage 1 is the single-operator, two-device TECHNICAL rehearsal. Daron operates both
fictional accounts. After separately approved staging rollout/enrollment and normal
setup, success means the two devices complete matching entries and per-account
confirmations, offline save/reload/reconnect and reconciliation with no duplicates
or lost results, with truthful simulation provenance throughout. A separate human
is NOT a prerequisite or pass criterion for this stage. Local automation is
supporting evidence; the deployed two-device exercise still needs to be run.

Only AFTER Stage 1 works will Daron recruit another person for Stage 2: whether
that person can understand and use the app, plus genuine independent-human identity
and scoring verification. Stage 1 passing is a valid technical result, not a failed
independence test. It does not by itself complete Stage 2 or production readiness.
Publication, hosted migration/enrollment/use and user-operated outage approvals
remain separate; this clarification performs none of those actions.
