# One approved settings/Finance disposable database — completed

## Scope and isolation

Owner explicitly approved ONE disposable local database for Playoff settings and
Finance saves/retries/rollback. One container was created:
`a24bc17e200d3f7dd4b860a735e8815700d86dc9bf53a47b9ecbbf11c73cde71`,
name `cribbage-event-settings-finance-local`, pinned image
`sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706`.
Local Windows Docker npipe, network none, no published ports, no mounts, no
privileged mode; socket-only PostgreSQL. Empty post-0236 baseline SHA
`e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc`
was verified before restore. Existing migrations 0237–0292 and private proposals
were applied only inside `fixture_event_settings_finance_v3`.

Source comments saying UNEXECUTED predate this bounded local test. They do not
imply the proposals were applied to staging or converted into migrations.

## Verified actual database behavior

- SQL parsing/application succeeded. Applied proposal hashes are in the runtime
  log. Event settings: `befa8608a1a08156409f2c906cffb6ae0b4b56df5fc876aff161ac1a7b0a04b4`.
  Finance: `f7be2650a20715d1c63d78103148642d53f10e5dfd9a557bc8a5e9247e00ca9c`.
- Q dependency: 35 SQL/TS amount comparisons, exact save/replay/reconciliation,
  source/stale/coverage rejection, post-core rollback, three two-connection lock
  barriers, private ACL denial, intentional clear and historical digest retained.
- V3 settings: saved raw incomplete drafts, exact replay/read recovery, changed
  full request conflict, unauthorized actor rejection, preserved effective settings
  through Preserve Historical, injected post-core snapshot failure rolls back
  revisions and settings; same request then succeeds once. Three actor/op,
  tournament and role lock barriers return retry_exact, then exact retry succeeds.
  Empty clear and restore were exercised within this same synthetic fixture.
- Finance draft storage: four immutable revisions, exact read/replay/reconcile,
  appended correction/void, edited-history rejection, Q-to-regular relabel rejection,
  mixed/source rejection, injected outcome failure removes reservation/revision
  and allows exact retry, real two-connection contention stays nonterminal.
  Original saved proposal remained unchanged. ACL metadata and actual denied
  table/function access were checked for anon/authenticated/service_role.
- Finance storage acknowledges only `validationOnlyDraft:true`,
  `modelCalculationApproved:false`, no payment/finalization. Independently running
  the pure calculator on stored data gave regular fund 26400 cents while excluding
  3000 cents Q funds. This is synthetic proposal evidence, not a received fund.

These are owner-role private calls with synthetic authenticated JWT subjects,
not real Supabase sign-in/PostgREST/public API acceptance. V3 ACL source is
revoked; separate public/role transport acceptance is still required.
The V3 harness verified configured carry-forward, but did not directly invoke
an older writer against that configured snapshot to exercise the V3 carry trigger.
V3-specific ACL metadata/direct denial was not separately exercised; Q and Finance
ACLs were. Those narrower runtime gaps remain despite source review.

## Review fixes and exact coverage limit

Review found Finance helper retry_exact could become a durable source rejection.
The SQL was corrected BEFORE application to the same fixture. Normal busy and
retry paths passed. A direct transaction-local helper-stub regression was added
to the helper after Node had loaded its module for this run; that additional
specific stub case is PREPARED, NOT EXECUTED. No second fixture was created to
claim that extra coverage. UTF-16 raw-setting bounds match JS code-unit counting.

## Cleanup and broader checks

Runner exited 0, dropped its database, removed the exact container, and verified
absence by full ID and exact name. A separate follow-up Docker query confirmed
both absent. No hosted records, production, invitations or real money touched.

Full local source gate passed 1,513 application tests, dependency audit,
ESLint/build, provider readiness and eight workspace checks; six handoff checks
passed. No live UI changed, so earlier controlled-section browser evidence remains
separate. SQL proposals/history files are not a release or a working Finance UI.

## Remaining release gates

Public currentness-bound read/save/recovery/activation and legacy amendment carry
integration are unfinished; old declarations stay intact. Finance is typed draft
storage, not an operational ledger: gross/mode are frozen for a given setup event
version, and changing them needs a reviewed new-source/rebinding design. Evidence
deduplication, actual accounting classification and authorized disbursement remain
unimplemented here. Ratio paid-count population/rounding, beyond-qualifier awards
and Satellite distribution are still unresolved. Whole-group cutoff expansion is
now approved and separately pure-tested, not yet a deployed calculation control.

Evidence: `test-results/event-settings-finance-runtime.log`, `-sql-result.json`,
`-container.json`, `-cleanup.json`; source gate
`test-results/settings-finance-runtime-source-verify.log` and `-handoff.log`.
