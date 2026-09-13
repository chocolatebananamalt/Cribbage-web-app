# Project Status

## 2026-09-12 executable optional-provider preflight

- Added a typed, default-off readiness contract and `pnpm providers:check` for
  future Stripe payments, SMS seating notices, and paper-card OCR.
- The check identifies incomplete configuration, invalid gates, missing OCR
  prerequisites, and accidental browser-exposed provider secrets. Even a
  complete configuration is reported only as requiring a live provider probe;
  it is never called activated based on environment values alone.
- Preserved the repository's public-only `.env.example` rule: it contains
  default-off flags and non-secret references, while the operations plan names
  server-only credential variables separately.
- All three optional integrations remain disabled and do not block the October
  manual workflows. No charge, message, image upload, or OCR request occurred.

## 2026-09-12 isolated schema restore and index-parity repair

- Brought the owner-approved disposable Supabase validation project from its
  older baseline through migrations `0111`–`0151` without copying pilot or
  private player data.
- The restore rehearsal exposed 24 relationship indexes that could be omitted
  when the older validation chain already existed. Added idempotent migration
  `0152_restore_parity_foreign_key_indexes.sql` and applied it to both the
  disposable project and pilot; it was a no-op where an index already existed.
- Both databases now report the same catalog counts: 105 `app` tables, 1,091
  columns, 959 constraints, 599 indexes, and 212 `app`/`public` functions.
  Both Supabase performance advisors report zero unindexed foreign keys.
- This closes schema reconstruction/parity. A dated backup of actual pilot
  records and its isolated content/checksum restore remain a supervised
  release rehearsal because private records must not be copied casually.

## 2026-09-12 local paper-card photo production release

- Merged the fully verified release branch into `main` through GitHub pull
  request 1. Vercel built merge commit `e92c863` as Production deployment
  `dpl_GuqEyjRt16VPpMvrj7W9imK2i6bi`, reported `READY`, and attached the
  stable production aliases with no alias error.
- Production root, sign-in, registration, and the public cross-check demo
  returned HTTP 200. The live cross-check demo contains the local paper-card
  photo control and explicitly states that the image is not uploaded.
- The first post-release Vercel grouped runtime-error scan reported no errors.
- The photo remains a transient on-device comparison aid; retained upload and
  OCR remain default-off and are not October pilot launch dependencies.

## 2026-09-12 pilot-safe paper-card camera aid

- Added an optional camera/file image preview directly beside paper/paper and
  digital/paper cross-check transcription. Mobile browsers may open the rear
  camera; desktop browsers may choose an existing image.
- The aid accepts only JPEG, PNG, or WebP through 10 MB and uses a revocable
  browser object URL. It has no upload, Supabase, OCR, score, or verification
  authority and therefore does not require an invented retention policy.
- Added the same working control to the synthetic public demo at
  `/demo?screen=corrections`, with server-resolved safe navigation for direct
  review.
- Focused tests, lint, production build, and desktop/390px Chrome rendering
  pass. Retained-image OCR remains separately gated after the October pilot.

## 2026-09-12 optional-provider launch boundary

- Reconciled the owner’s latest priority: the October Standard Singles release
  must operate through audited manual payment evidence, printable seating, and
  human paper-card transcription without waiting for payment, SMS, or OCR
  vendors. Their absent accounts and credentials are not launch blockers.
- Recorded one provider activation plan with exact external needs, enablement
  gates, failure tests, and authority boundaries. Stripe is the future online
  payment choice; the current Vercel Marketplace has no native SMS transport;
  and OCR remains default-off until restricted storage, processor/privacy
  approval, editable review, comparison, and real-card false-read proof exist.
- The approved hosted Supabase pilot currently has no Storage bucket. The
  existing paper-card capture foundation creates restricted metadata and an
  opaque upload intent only; it does not upload an image or claim OCR is ready.
- This pass changes documentation and release classification only. It does not
  enable a provider, send a message, charge money, upload a card, or change
  scoring authority.

## 2026-09-12 hosted October workflow release candidate

- Applied migrations `0144` through `0151` to the approved Supabase pilot.
  Hosted rollback proofs pass for paper-versus-paper authority, explicit
  scorecard preference/results discovery, current-game progression and offline
  rejection replay, hybrid digital-versus-paper authority, and manual
  settlement finalization. Fictional proof data was rolled back.
- Live PostgreSQL execution found and repaired two defects before web release:
  the immutable roster trigger initially blocked the audited scorecard-choice
  projection (`0149`), and the canonical-game invariant checker initially did
  not recognize the independently approved hybrid path (`0150`). Migration
  `0151` adds every advisor-requested foreign-key index for the new tables.
- Supabase's performance advisor now reports no unindexed foreign keys and no
  warning/error finding. Its remaining findings are unused-index information.
  Security still reports the previously accepted free-plan leaked-password
  notice plus signed-in security-definer RPC notices; private `app` tables are
  forced-RLS with direct grants revoked, so their no-policy notices are an
  intentional fail-closed design.
- The post-repair local gate passes all 407 application tests, dependency audit,
  lint, the Next.js production build, workspace checks, all 6 handoff checks,
  and `git diff --check`.
- Commit `6845888` was promoted from its READY preview to Vercel Production as
  deployment `dpl_CafWiJMAzHKKM5tCX6TP27PRLaqY`. The stable production URL is
  `https://cribbage-web-app.vercel.app`. Root, demo, sign-in, registration,
  authenticated setup, finance, seating, participants, and results routes
  rendered successfully. A live $1 synthetic expense was recorded and then
  voided, returning the active total to $0 while preserving its audit history.
- Fresh production responsive checks pass at 320px, 375px, 640px reflow, and
  1280px with no horizontal overflow or framework error overlay. Vercel reports
  no runtime errors in the post-release observation window.
- The application rollback drill passed: the stable production aliases were
  moved to the previous known-good commit `83cfd7d`, its demo returned HTTP 200,
  and the aliases were then restored to commit `6845888` as READY deployment
  `dpl_8edunFUXR1etP6P4FxaJ4mHqtDVv`. The restored demo and protected finance
  and results routes returned HTTP 200, with no runtime-error cluster.
- Independent player and official sessions, disconnect/reconnect,
  backup/restore, and the director walkthrough remain acceptance rehearsals
  rather than solvable code gaps.
- `docs/operations/OCTOBER_PILOT_REHEARSAL.md` now turns those remaining gates
  into one ordered, observable rehearsal with required people/devices,
  rejection paths, evidence capture, release-flag discipline, and a strict
  September 18 go/no-go rule.

## 2026-09-12 hybrid digital-and-paper completion

- Added migration `0148` for one immutable digital player submission plus one
  independently transcribed paper-card claim. The first identity-bound cross
  checker creates only a pending case; a second distinct independent official
  must re-enter and confirm both sources before reciprocal scorelines count.
- Added explicit preference/version revalidation, current-game enforcement,
  mutual exclusion from ordinary confirmation, paper-paper completion, and
  device recovery, append-only audit history, exact retry receipts, and
  actor-scoped lost-response reconciliation.
- Added protected API routes, a staff workspace and UI, a tournament link, and
  corrected mixed-card starter guidance.
- Normalized official identity, paper-completion, hybrid-completion, roster-
  link, and event-enrollment concurrency around the compatible actor/operation
  -> tournament -> official-identity hierarchy; static coverage now includes
  every writer that reaches the nonparticipant-identity guard.
- Local focused hybrid tests pass 11/11; the combined focused
  auth/paper/hybrid run passes 57/57. Full `pnpm verify` passes 404/404 application
  tests and the production build; `pnpm verify:handoff` passes 6/6.
  Fresh independent Sol review reports no P0/P1/P2 on the final 0144/0148 bytes.
  The rollback fixture is executable and passed against the hosted pilot;
  two-session browser proof remains.

## 2026-09-12 explicit scorecard preference, results discovery, and progression hardening

- Added tournament-scoped, versioned `digital`/`paper` scorecard preference
  across public registration, director manual/CSV intake, pre-close correction,
  roster/check-in/seating/enrollment readers, and append-only audit history.
  The application never infers this choice from account linkage.
- Added server-only tournament event discovery so signed-in viewers, players,
  cross-checkers, directors, and co-directors can reach results; all settlement
  mutations remain restricted to directors and co-directors.
- Hardened online confirmation and offline issuance/replay to enforce the exact
  current scheduled game, fail closed on missing or ambiguous progression,
  retain capability-bound rejection receipts, and use a consistent lock order.
- Rejection receipts now attach an offline capability only after exact
  actor/session/device/tournament/event/game validation. A foreign or unavailable
  identifier is recorded without consuming it, preserving the rightful owner's
  subsequent replay.
- Full `pnpm verify` and `pnpm verify:handoff` pass. Migrations `0146` and `0147`
  are applied and their hosted rollback proofs pass; independent-session
  browser proof remains before final pilot acceptance.

## 2026-09-12 October reliability gap pass

- Repaired durable offline replay so exact authoritative 409 receipts close
  the local queue, while transient, malformed, contradictory, or unauthorized
  responses retain it. Actor/game writes now serialize in one IndexedDB
  transaction and competing values fail closed; explicitly prepared Next.js
  static assets, including CSS, are available from the offline cache.
- Tightened tournament setup, registration close, seating, qualification,
  playoff, and settlement clients so only exact allowlisted server outcomes
  clear their persisted idempotent retries. Unknown 409 responses remain
  locked for safe reconciliation.
- Applied recorded migration `0143` to the approved Supabase pilot. All 11
  advisor-reported foreign-key paths now have covering indexes; the hosted
  performance advisor reports no remaining unindexed-foreign-key finding.
- Full local verification passes 369/369 application tests, the Next.js
  production build, workspace checks, and all 6 private-handoff tests.
  Independent Sol review found no P0/P1 in this slice.
- Fresh isolated-browser checks pass at 320px, 375px, 640px reflow, and 1280px:
  meaningful content and all five navigation labels render, no framework error
  overlay appears, and document/body width equals the viewport at each size.
- Paper-only authoritative game completion and financial reconciliation remain
  active implementation work. Real independent-device/offline rehearsal,
  backup/restore, and director acceptance remain physical release evidence.

## 2026-09-12 scoped-secret RPC compatibility repair

- Production browser proof found that the newly deployed Event Dispute
  Register returned 404 even though its hosted function and data were present.
  The obsolete `request.jwt.claim.role` check rejected Supabase's current
  scoped secret API key, which authorizes through the `service_role` database
  role without populating that legacy GUC.
- Applied recorded migration `0142` to remove only that redundant check from
  the dispute/finalization and settlement-v3 RPCs. Their EXECUTE grants remain
  revoked from `public`, `anon`, and `authenticated` and granted only to
  `service_role`; actor, tournament, staff-role, scope, lock, and replay checks
  remain unchanged.
- The authenticated production dispute page now loads for the October Main
  Event and shows the correct empty states. Hosted privilege checks confirm
  service-role access is true and authenticated/anonymous access is false.
- Full local verification still passes 365/365 application tests, the Next.js
  production build, workspace checks, and all 6 handoff-integrity tests.

## 2026-09-12 post-event and correction database release proof

- Applied reviewed migrations `0138` through `0141` sequentially to the
  approved Supabase pilot: event disputes, supervised playoff placements,
  complete Rule 12 independent-card corrections, and Settlement Working Copy
  v3 with provisional MRP transcription.
- Hosted rollback proofs pass for dispute open/resolve and finalization guard,
  playoff versioning, both Rule 12 release/lifecycle fixtures, and the combined
  qualification/playoff/settlement-v3 chain. Every synthetic transaction
  rolled back; the failed proof attempts also rolled back without retained
  fixture records.
- Hosted execution found and closed three integration defects before release:
  Supabase fixture role simulation, PostgreSQL's truncated legacy constraint
  name, and the dispute wrapper's preserved internal qualification finalizer.
- Independent Sol review approves the final settlement export binding. The
  complete local gate now passes 365/365 application tests, audit, lint,
  production build, workspace checks, and the private-handoff suite.
- Supabase migration history now records `0137` through `0141`. The final
  hosted qualification/playoff/settlement-v3 chain passed again after removal
  of a redundant unique index; the remaining equivalent `0139` index continues
  to back both foreign keys. Supabase's performance advisor now reports no
  warning/error findings.
- The Rule 12 feature flag remains closed until separate-session browser proof;
  database capability being installed does not expose the staff correction UI.

## 2026-09-11 activated setup amendment hosted proof

- Applied migration `0137` to the approved Supabase pilot. The hosted
  rollback-only amendment fixture passes after correcting its Supabase role
  simulation to set both PostgreSQL and JWT roles; the failed first attempt
  rolled back and retained no synthetic records.
- The amendment can append later Consolation/Satellite events without changing
  the existing activated Main Event, and preserves exact replay, stale-write,
  duplicate-event, browser-role, audit, and grant boundaries.
- Full local verification passes 357/357 application tests plus audit, lint,
  production build, workspace, and private-handoff checks. Independent live
  two-official concurrency and phone/desktop browser proof remain.

## 2026-09-11 Standard Singles MRP source/reference audit

- Rechecked the official ACC public resources and encoded the published
  Standard Main/Consolation qualifying and playoff schedules as an executable,
  versioned reference fixture.
- The fixture is deliberately disconnected from settlement/results authority
  and always reports `currentEffectiveApproved: false`. A current 15-qualifier
  ACC result supplies the odd-count top-half fixture; unsupported formats/game
  counts, incomplete playoff input, and scores outside the published boundary
  still fail closed.
- Official saved MRP awards remain blocked by current-effective ACC approval,
  and verified playoff-round data. Q-pool and event prize calculations remain
  blocked by missing allocation/rounding and authoritative payout fixtures.

## 2026-09-11 consolidated production release

- Promoted verified commit `33b8300` to Vercel Production as deployment
  `dpl_GgPSHW6jar6MzmARoDLWgs4bzdhu`; the stable domain is
  `https://cribbage-web-app.vercel.app` and Vercel reports READY with no alias
  error.
- Authenticated external-Chrome checks passed for the active October
  registration-link workspace and the Players and Registration workspace.
  The pending public-claim queue remained empty, the two existing pilot roster
  identities remained unchanged, and browser error logs were empty.
- Production root and `/register` return HTTP 200, and the Production runtime
  error scan is empty. A transient registration-page 404 observed during the
  alias handoff cleared after READY.
- Roster-account activation remains intentionally closed by its independent
  release gate pending real independent-session proof; setup activation is a
  separate enabled capability.
- Evidence: `docs/quality/2026-09-11-consolidated-production-release.md`.

## 2026-09-11 deterministic client timestamps

- Generalized the live registration-review hydration repair across the
  October-critical registration-link and account-activation workspaces. All
  initial timestamps now use one deterministic UTC representation rather than
  the server/device locale.
- Regression coverage rejects environment-local formatting in those three
  server-rendered client screens. Authenticated browser proof for the two
  newly covered screens remains part of the consolidated release check.
- Independent Sol high-risk review found no P0/P1 issue in this fix or the
  private settlement working-copy release.

## 2026-09-11 October-critical hosted regression

- Re-ran ten rollback-only integration fixtures against the approved Supabase
  pilot after migrations through `0136`: CSV roster import, registration
  closure/roster freeze, schedule publication, preliminary standings,
  qualification finalization, settlement draft, expense ledger, failed-device
  recovery, Rule 12 corrections, and paper-card evidence capture.
- All ten passed and a targeted cleanup check found zero retained fictional
  fixture users. This closes a solvable shared-database regression gap without
  closing or polluting the real October tournament.
- Physical independent-phone/offline and backup/restore rehearsals remain
  separate release evidence; dated ACC MRP/Q-pool/payout fixtures remain an
  external rule-confirmation dependency.

## 2026-09-11 private settlement working-copy slice

- Added a director/co-director-only CSV download of the latest immutable
  Standard Singles settlement draft, bound to the exact locked qualification
  result. It separates playoff placement claims from qualifying-round ranks
  and places the High Non-Qualifier after the qualifier list.
- The artifact is explicitly provisional, unreconciled, and not an ACC
  submission. It carries server cash snapshots and blocker codes, neutralizes
  spreadsheet-formula text, and performs no MRP, Q-pool payout,
  reconciliation, publication, or official-export calculation.
- `pnpm verify` passes 331/331 application tests plus audit, lint, production
  build, workspace, and private-handoff checks; the separate
  `pnpm verify:handoff` passes 6/6. Authenticated desktop/phone download proof
  remains for the release owner after integration; no hosted migration or
  deployment is part of this slice.

## 2026-09-11 live QR registration and director review completion

- Promoted commit `235585a` to Vercel Production, enabled the separate public
  registration gate, and replaced the October pilot link with a 30-day
  credential expiring after the October 3 tournament. The stable production
  `/register` route accepted a fictional visitor claim and displayed the
  expected review acknowledgement.
- Closed the discovered operational gap between public intake and roster
  creation. The protected Players and Registration workspace now shows pending
  claims, supports audited approve/reject decisions with an optional reason,
  requires an explicit distinct-person confirmation for collision cases, and
  preserves an ambiguous decision for an exact idempotent retry.
- Approval remains deliberately non-authoritative: it creates no roster row,
  role, payment, check-in, event enrollment, or seat. A separate existing
  director action promotes an approved claim to a roster identity.
- Migration `0136` is applied to the approved Supabase pilot. Its hosted
  authority/replay fixture passed with zero retained synthetic users and zero
  performance-advisor unindexed-foreign-key findings.
- Independent Sol high-risk re-review is GO with no remaining P0/P1 findings.
- The first live production browser pass caught and locally repaired a
  server/client time-zone hydration mismatch in the registration timestamp;
  focused regression, lint, and production-build checks pass.
- `pnpm verify` passes 326/326 application checks plus audit, lint, production
  build, and workspace checks; `pnpm verify:handoff` passes 6/6.
- Corrected commit `8becc6a` is live in Vercel Production as deployment
  `dpl_7RDg8BsZNeHuoidVqmFLwf8W6BJv`. A fresh external-Chrome director session
  rejected the fictional public claim, saw it leave the queue, retained the
  two original roster identities, and showed no React console error. The page
  also passed a 375-pixel no-horizontal-overflow check.

## 2026-09-11 settlement draft, exact money, and private workspace completion

- Added an immutable director-only post-event settlement draft tied to the
  locked Standard Singles qualification result. Directors deliberately choose
  playoff winner, runner-up, and any additional paid placements; qualifying
  order is never prefilled as playoff order.
- Added optional Q-pool/other award claims and server snapshots of active
  payment receipts and expenses. Drafts are permanently marked unreconciled
  and cannot publish, assign MRPs, approve payouts, or export official results
  until approved ACC fixtures and allocation rules exist.
- Replaced floating-point fee conversion with exact USD-cent parsing and made
  setup money fields remount from authoritative values after a server reload.
- The signed-in production root now lists named, dated tournament workspaces
  for explicit roles and checked-in linked players without exposing roster data.
- Applied migrations 0133-0135 to the approved Supabase pilot. Both hosted
  rollback fixtures pass without retained synthetic data, and the performance
  advisor reports zero unindexed foreign keys.
- Independent Sol review is GO with no P0/P1. `pnpm verify` passes 319/319
  application tests plus audit, lint, build, and workspace checks;
  `pnpm verify:handoff` passes 6/6. Production deployment/browser proof remains.

## 2026-09-11 signed-in tournament chooser

- Replaced the production root’s generic signed-in acknowledgement with a
  private tournament chooser. Users receive named, date-friendly links only
  for non-archived tournaments where their current profile has an explicit
  tournament role or a checked-in participant identity; multiple assignments
  resolve to one deterministic role.
- The projection is server-only and contains no roster, contact, or other
  member data. Empty membership and temporary reader failures remain distinct,
  and the public demonstration stays available without granting access.
- Migration `0134` is applied to the approved pilot and its rollback-only
  hosted fixture passes. Remaining browser proof is recorded in
  `docs/quality/2026-09-11-signed-in-tournament-chooser.md`.

## 2026-09-11 graduated pool calculator

- Added a protected graduated pool calculator matching the live ACC MRP Program
  Side Pool Calculator examples and nearest-$5 estimate algorithm. The screen
  shows the exact prize fund, suggested places, suggested total, and any amount
  that must be manually adjusted before approval.
- The calculator is intentionally non-persistent and cannot claim that an
  estimate is an approved payout. Persistent participant awards, Q-pool/MRP
  attribution, playoff placements, and ledger reconciliation remain open.
- Corrected the public demo's 375px navigation so all five tabs fit with
  52-pixel touch targets instead of clipping the final tabs.
- Commit `83f03c5` is live in Vercel Production as deployment
  `dpl_ADW6mV8QjXouobbhSA4eexsbufmc`. Public endpoints, desktop and phone demo
  layout, the authenticated calculator, and the zero-runtime-error window were
  verified after promotion.
- Evidence: `docs/quality/2026-09-11-graduated-pool-calculator.md`.

## 2026-09-11 pilot operations completion slice

- Added protected director workspaces for roster-to-account activation, bounded
  CSV roster import, and an audited tournament expense ledger. Browser retry
  envelopes are actor/tournament scoped and are cleared when a shared device is
  cleared.
- Added failed-device scorecard recovery using immutable opponent-device or
  paper evidence, independent non-self review, correction-aware projections,
  and authoritative recovery receipts. Recovery now fails closed when either
  participant identity cannot be resolved and never represents a pending sync
  as verified.
- Added immutable Standard Singles qualification finalization. Finalization
  locks the complete event score set, rejects unresolved workflow states and
  every unresolved numeric ranking tie, freezes canonical score inserts and
  mutations, and safely reconciles an ambiguous browser retry with the same
  idempotency key.
- Applied migrations 0127-0132 to the shared pilot. Hosted rollback fixtures
  passed CSV intake, expenses, failed-device recovery, and qualification
  finalization without retaining synthetic data. All 29 foreign-key indexes
  required by the new pilot tables were added; the Supabase performance advisor
  now reports zero unindexed foreign keys.
- Independent Sol high-risk review found no remaining P0/P1 defect in recovery
  or qualification finalization. `pnpm verify` passes 298/298 application tests
  plus audit, lint, production build, and workspace checks;
  `pnpm verify:handoff` passes 6/6.
- Commit `02439a8` is live in Vercel Production as deployment
  `dpl_4BDA3NtjjDmFPqV4Ng2Lj9iczCUc`. Stable root, demo, and offline-worker
  requests return HTTP 200; external Chrome desktop and 375px phone rendering
  pass; and the post-smoke Vercel runtime-error scan is empty. Independent
  multi-session and physical rehearsal remain open. Evidence:
  `docs/quality/2026-09-11-pilot-operations-completion.md`.

## 2026-09-11 roster freeze, hybrid reconstruction, and preliminary qualification

- Applied migrations 0124-0126 to the shared pilot. Tournament activation now
  opens registration, registration closure freezes new roster identities while
  preserving exact retries, paper-only opponents remain visible on verified
  scorecards, and scorecards use the same latest applied corrections as standings.
- Preliminary standings now include paper-only participants and expose
  schedule/completion evidence plus a provisional qualification and High
  Non-Qualifier view. Winner, MRP, Q-pool, payout, and final-result authority
  remains deliberately withheld.
- Independent high-risk review found no remaining P0/P1 code defect. Hosted
  rollback fixtures passed activation, roster freeze/replay, hybrid identity,
  correction-aware scorecard, capture, and preliminary-results paths with no
  retained synthetic data. `pnpm verify` passes 266/266 application tests plus
  audit, lint, build, and workspace checks; `pnpm verify:handoff` passes 6/6.
- Commit `9e2917d` is live in Vercel Production as deployment
  `dpl_D6axn8Nzs6wTtiZYeNi9GHJ3Fdba`. Stable root/demo/offline-worker smoke
  checks pass, external Chrome renders the app, and the post-smoke Production
  error log is empty.
- Evidence: `docs/quality/2026-09-11-pilot-reliability-repairs.md`.

## 2026-09-11 offline readiness production correction

- Corrected a reconnect/reload edge case so a restored queued score no longer
  makes the interface claim **Offline Ready** without rechecking the actual
  actor/game-bound cached page. Reconnection now also retries offline-page
  preparation automatically when no score is queued.
- `pnpm verify` passes 254/254 application tests plus audit, lint, production
  build, and workspace checks; `pnpm verify:handoff` passes 6/6. Commit
  `58b5d05` is live in Vercel Production as deployment
  `dpl_8CqBBnpR3C2nMxhHxEkivdk44Cug`.
- The stable `/demo` and `/offline-score-sw.js` endpoints return HTTP 200. The
  worker has JavaScript MIME type, root scope, and `no-store`/`no-cache`
  headers. External Chrome rendered the stable live demonstration.
- Evidence: `docs/quality/2026-09-11-offline-score-page-reload.md`.

## 2026-09-11 offline score page reload foundation

- Added an expiring, actor/game-bound offline copy of an assigned score page.
  Network failures and transient 5xx responses can reopen only that prepared
  game; authentication failures, redirects, expired copies, API writes, and
  unrelated routes never use it.
- Cache preparation is bounded and does not block ordinary score entry.
  Shared-device clearing removes all offline score storage, while magic-link
  account replacement is blocked until the current device is synced or
  explicitly cleared.
- Focused executable service-worker/auth tests pass 63/63. Independent Sol
  review found no remaining P0/P1 issue. `pnpm verify` passes 254/254 tests,
  audit, lint, build, and workspace checks; `pnpm verify:handoff` passes 6/6.
  Local external-Chrome rendering and response-header checks pass.
  Independent real-session hard-reload/restart proof remains open before the
  full October offline gate can pass.
- Evidence: `docs/quality/2026-09-11-offline-score-page-reload.md`.

## 2026-09-11 offline score replay foundation

- Added a device-bound offline Standard Singles submission path. Connected
  score entry provisions a short-lived capability, browser IndexedDB retains
  one immutable signed entry, reconnect replays the exact payload through the
  existing score writer, and only an exact accepted receipt clears the queue.
- Migrations 0122-0123 are applied to the shared pilot. A hosted rollback
  fixture passed two-player same-version replay, exact retry, changed-replay
  quarantine, immutable evidence, and grants checks without retaining test
  data. Supabase's four new foreign-key index notices were repaired.
- `pnpm verify` passes 251/251 application tests plus audit, lint, build, and
  workspace checks; `pnpm verify:handoff` passes 6/6. Commit `fa48d9d` is live
  in Vercel Production as deployment `dpl_7YxVC8BkXdrQpmidAFV1GceCcwKf`;
  authenticated external-Chrome smoke testing and the post-release runtime
  error scan pass. Real two-session reconnect/reload proof, offline startup,
  and failed-device recovery remain open before the complete October offline
  gate can pass.
- Evidence: `docs/quality/2026-09-11-offline-score-replay-foundation.md`.

## 2026-09-11 player game navigation

- Added a protected **My Games** entry point so a signed-in linked participant
  can find assigned games without receiving an internal game URL. Unresolved
  games appear first with current Table/Seat and permanent Verification IDs;
  completed games and per-event scorecard links remain available below.
- Migrations 0118-0121 are applied to the shared pilot. The actor-scoped reader takes
  no caller-supplied actor ID, exposes only games containing `auth.uid()`, and
  exposes only immutable games tied to a director-reviewed schedule publication.
  The hosted rollback fixture passes assigned, role-only, cross-tournament,
  unpublished-game rejection, two-entry, and two-confirmation cases without
  retaining synthetic data.
- `pnpm verify` passes 247/247 application tests plus audit, lint, build, and
  workspace checks; `pnpm verify:handoff` passes 6/6. Production deployment
  and desktop/phone browser proof are still pending for this slice.
- Evidence: `docs/quality/2026-09-11-player-game-navigation.md`.

## 2026-09-11 director-reviewed schedule publication

- Added a protected one-time schedule workspace for activated digital Standard
  Singles events. Directors can import the exact reviewed CSV, validate every
  player and Table/Seat against the immutable table plan, approve it, publish
  canonical rounds/games atomically, and inspect matchups by game.
- The database freezes the published participant identity/set and schedule
  assignments, rejects capacity and cross-table errors, supports linked
  digital players facing paper-only opponents, and exposes schedule authority
  only through server-held service credentials.
- Migrations 0114-0117 are applied to the shared pilot. The permanent hosted
  rollback fixture passes rejection, replay, immutability, scope, and grants
  checks with no retained synthetic data. Local schedule checks pass 5/5.
  A Production smoke check found and repaired the normal no-table-plan state.
  Commit `b588885` is live as deployment
  `dpl_CbdzwpuakBHzKkGYCWZq64MTJA5o`; authenticated desktop and 375px-phone
  checks pass with no horizontal overflow, all observed requests were HTTP
  200, and Vercel reports no runtime errors in the smoke window.
- Evidence: `docs/quality/2026-09-11-director-reviewed-schedule-publication.md`.

## 2026-09-11 roster-based event participation

- Removed the account-only event-participation assumption. A checked-in roster
  identity can now be enrolled in an activated Standard Singles event even
  when the player uses only a paper scorecard and has no Auth profile.
- Added a protected **Event Participants** workspace for director/co-director
  bulk enrollment. Main, Consy, and each Standard Singles Satellite retain
  separate participant lists under the same tournament, so Consy enrollment
  can occur later without a second tournament login.
- Digital score submission remains account-bound through the existing
  participant/profile foreign key. Paper-only participation creates no login,
  role, score authority, result, charge, or game by itself.
- Migration 0113 is applied to the shared pilot. A hosted rollback transaction
  proved linked and paper-only enrollment together, exact idempotent replay,
  and no disposable residue. `pnpm verify` passes 239/239 application tests,
  the build, audit, lint, and workspace gates. Commit `7170f8d` is live in
  Vercel Production as deployment `dpl_FSgY8KjdS5fTG6dZEY6Lye79HsAP`.
  Authenticated external Chrome loaded the protected participant workspace;
  the unactivated real pilot correctly directed the director to activate its
  complete event setup first.
- Evidence: `docs/quality/2026-09-11-roster-based-event-enrollment.md`.

## 2026-09-11 atomic multi-event setup activation

- Replaced the one-event activation boundary with an additive, server-only
  transaction that activates the saved Main, Consy, and all Satellite events
  under one tournament. Exactly one Main event is required.
- Standard Singles events become digitally scoreable with the dated ACC 2025
  scoring-core source. Team, doubles, Canadian Doubles, and custom formats are
  created as manual/paper-scored events and cannot enter the digital scoring
  path for the October pilot.
- The protected setup page now exposes activation only for a saved, unchanged
  revision, retains one opaque retry operation, and locks the setup after
  activation. The resulting event list states which events are digital versus
  paper-scored.
- Migration 0112 is applied to the shared pilot. A hosted rolled-back database
  transaction proved one Main, one Consy, and one Canadian Doubles event,
  correct 2-digital/1-manual routing, atomic tournament opening, and an exact
  non-duplicating replay. No disposable records remained.
- `pnpm verify` passes 232/232 application tests plus audit, lint, build, and
  workspace gates; `pnpm verify:handoff` passes 6/6. Commit `6af8996` was
  promoted to Vercel Production as deployment
  `dpl_HZEENQbwGBfZcisbogXcPHoWarKt`; the activation switch and dedicated
  server-only Supabase Production key are configured. An authenticated
  external-Chrome check showed the saved setup and enabled activation control.
  The real pilot remains deliberately unactivated until its complete actual
  event list is entered because activation locks the revision.
- Evidence: `docs/quality/2026-09-11-multi-event-setup-activation.md`.

## 2026-09-11 director manual roster intake

- Added a protected **Players and Registration** fallback that lets a director
  or co-director add a player by name with optional email and ACC number. This
  prevents the October pilot from depending on unfinished public QR intake.
- The new server transaction is role-checked, audited, replay-safe, duplicate
  aware, and blocked after initial seating. It creates only a private roster
  identity—not account access, payment, check-in, seating, enrollment, or
  scoring authority. Browser retry storage contains no player contact data.
- Migration 0111 is applied to the shared pilot. A fictional hosted transaction
  proved one accepted row, an exact non-duplicating replay, a controlled
  duplicate rejection, and matching immutable receipts/audit events.
- `pnpm verify` passes 230/230 application tests plus audit, lint, build, and
  workspace gates; `pnpm verify:handoff` passes 6/6. Commit `b40d57b` is live
  in Vercel Production, and an authenticated external-Chrome submission added
  the fictional `Browser Pilot Player` exactly once through the live form.
- Evidence: `docs/quality/2026-09-11-director-manual-roster-intake.md`.

## 2026-09-11 live director tournament-setup workspace

- Added a protected, functional **Set Up Tournament** workspace backed by the
  existing private versioned setup RPC. Directors/co-directors can now enter
  tournament details, one Main, one Consolation, repeatable Satellites, the
  observed ACC style/game-count menus, fees, up to two Q Pools, and satellite
  payout selection.
- Exact unresolved saves are retained for safe retry after a connection loss;
  successful drafts remain configuration only and cannot silently create
  operational events, results, charges, or approved rules.
- Replaced the unusable non-RFC fixture identifier with a generated RFC-valid
  pilot tournament, then assigned audited director and co-director roles. No
  private identity data was copied into the repository.
- Commit `1dcbde0` is live in Vercel Production. The protected tournament and
  setup pages load in external Chrome, a browser-originated edit created setup
  version 2, and repeatable Satellite controls were exercised successfully.
- Evidence: `docs/quality/2026-09-11-live-tournament-setup-workspace.md`.

## 2026-09-11 solve-first and durable-correction protocol

- Added a repository-wide solve-first rule: future workers must inspect
  existing sources, code, tests, connected services, and safe alternatives,
  and make at least one concrete attempt before asking the owner for help.
  Genuine owner questions must state what was tried and the smallest remaining
  decision/action; unrelated work continues instead of stopping silently.
- Added `docs/operations/DURABLE_PROJECT_MEMORY.md` as the persistent ledger
  for owner corrections and verified source facts. Entry instructions now
  require reading it, and material corrections must reconcile requirements,
  decisions, the working outline, tests, quality evidence, and this status.
- Recorded that cached ACC Rulebook 2025 and reviewed ACC resources already
  supply the Standard Singles scoring, scorecard, Rule 12.2 cross-check, and
  qualification starting rules. Scoring/results/financial items are therefore
  classified as implementation/proof work unless a specific current-effective
  schedule or approval is demonstrably unavailable. Offline/recovery remains
  an owner-approved engineering requirement rather than an ACC rule.
- Added a workspace regression check so the solve-first and durable-memory
  entry requirements cannot disappear silently.

## 2026-09-11 September 18 October-pilot minimum

- Accepted a focused Standard Singles pilot boundary targeting director
  onboarding on September 18 and a supervised tournament on October 3. The
  must-work path is setup/events/Q-pools; registration/import, roster, manual
  payment status and check-in; closure, initial seating and approved schedule;
  two submissions/two confirmations, scorecards, offline replay, manual paper
  evidence, disputes/cross-check/corrections; results/qualifiers; and financial
  reconciliation.
- Deferred production Rulebook/quick-reference integration, rich Judge Desk,
  digital team scoring, flyer creation/import, online payments, SMS, OCR, and
  automatic ACC portal submission. The demonstration may retain its
  reference-only Rulebook preview; team events use paper scorecards. Main,
  Consolation, and
  Satellites remain separate events under one tournament.
- Added `Previous Screen` to Qualification Preview and aligned the Operations
  option/destination as `Tournament Events and Flyer`, with clear event and
  deferred-feature summaries. Judge Desk is visibly deferred and disabled in
  the demonstration.
- Independent high-risk review prevented unsafe scope cuts: the final boundary
  retains manual hybrid evidence and non-self dispute resolution, rejects
  automatic scheduling without an approved rotation fixture, defines a
  validated director-entered/imported schedule fallback, and keeps MRP/Q-pool,
  payout, and export outputs draft until approved inputs exist.
- Focused tests pass 78/78; `pnpm verify` passes 223/223 application tests plus
  audit, lint, production build and workspace gates; `pnpm verify:handoff`
  passes 6/6. External Chrome desktop navigation passed. Required real
  320/375-pixel proof remains open because the available controller cannot set
  a phone viewport.
- Evidence: `docs/quality/2026-09-11-september-pilot-scope-and-prototype.md`.

## 2026-09-11 qualification summary placement correction

- Corrected the synthetic Qualification Preview and sample PDF so Event
  Results contains only playoff outcomes, while High Non-Qualifier appears as
  a distinct, unnumbered row immediately after the ranked qualifier list.
- Removed Winner and Runner-up from the pre-playoff Qualification Preview;
  those outcomes remain unavailable until event finalization.
- An independent Sol review caught an impossible first-draft sample in which
  Winner and Runner-up were not listed qualifiers. The corrected PDF selects
  players from qualifying ranks 2 and 3 without reordering the qualifier list,
  and regression coverage now enforces playoff-player membership and exact
  qualifier/HNQ ordering.
- Regenerated both tracked PDF copies and visually inspected the final
  one-page Letter render. Focused checks passed 46/46, and `pnpm verify`
  passed 222/222 application tests plus dependency, lint, production-build,
  and workspace/recovery gates. A narrow-phone visual pass remains part of
  the release accessibility gate.
- Evidence: `docs/quality/2026-09-11-qualification-summary-placement.md`.

## 2026-09-11 protected check-in name search

- Added the previously requested player-name search to the real protected
  director/co-director check-in workspace and mirrored it in the public
  synthetic demonstration. Matching is case-insensitive, accepts partial
  names, reports the displayed/total count, and gives an explicit no-match
  result.
- Filtering is presentation-only. Attendance, registration closure, checked-in
  participant calculations, and initial seating still consume the complete
  server roster; no database, RPC, role, policy, hosted setting, or pilot data
  changed.
- Focused behavior, semantics, lint, and TypeScript checks pass. `pnpm verify`
  passed 221/221 application tests plus dependency, build, and workspace
  gates, and `pnpm verify:handoff` passed all 6 recovered private-handoff
  checks. External Chrome desktop proof
  filtered `paper` from four players to Paper Guest with the correct live
  count. Required narrow-phone visual proof remains pending because the
  available external-browser controller cannot set a phone viewport.
- Evidence: `docs/quality/2026-09-11-check-in-name-search.md`.

## 2026-09-10 ACC approval video package

- Added a roughly five-minute board/technical presentation script and an
  exact shot list mapped to the public synthetic demo. The wording distinguishes
  interactive demonstration behavior from proposed pilot behavior and does
  not claim that unfinished multi-user, offline, OCR, financial, or ACC
  integration work is already live.
- The approval request is deliberately narrow: approve a supervised digital
  operational-record pilot; identify technical and operational contacts;
  provide or approve read-only member verification through a scoped service
  identity; decide how contact changes should be handled; provide a supported
  sanctioning/results API or import boundary and sandbox; and confirm the
  authoritative rule, payout, role, and paper-retention inputs.
- The recommended first integration does not request direct database access or
  ACC member-record writes. Tournament-specific contact changes remain
  separate unless the ACC later authorizes a reviewed or narrowly scoped,
  audited update mechanism. Public ACC resources do not document an API, so
  the script asks the ACC to identify its supported interface rather than
  assuming one exists.
- The narration is approximately 623 words, or 4 minutes 48 seconds at 130
  words per minute. Video assembly remains pending the owner's approved script
  and recorded narration.

## 2026-09-10 public shareable demonstration

- The owner approved a direct, no-sign-up `/demo` URL for sharing the current
  interface with friends. The route now renders only the existing in-memory
  synthetic dashboard and persistently states that it is public sample data,
  nothing is saved, and no real tournament information is available or
  changed.
- The public route now bypasses Supabase session refresh, and the dashboard
  uses clearly fictional people, identifiers, tournament details, and score
  rows. Its linked local PDFs use the same public pass-through, and the sample
  qualification PDF has been regenerated with fictional fixtures. Real
  registration and tournament workspaces retain authentication and
  tournament-role boundaries.
- Focused tests (44/44), complete verification (217 application tests plus
  build and repository gates), handoff verification (6/6), anonymous and
  stale-cookie HTTP checks, and external Chrome interaction checks pass. The
  first Vercel Preview revealed that the statically generated demo could not
  hydrate under the per-request nonce policy; it now opts into request-time
  rendering so Next.js can nonce its scripts.
- Commit `38d1d6a` was promoted to Vercel Production as deployment
  `dpl_PWqPwoMtGVqW6vGt8Qg5iXTTsT4h`. The stable public URL is
  `https://cribbage-web-app.vercel.app/demo`. Anonymous production checks
  returned HTTP 200 for the demo and both linked PDFs, the live score-entry
  and review interaction passed, and the post-release scan found no runtime
  error clusters or production HTTP 5xx logs.

## 2026-09-10 October pilot offline requirement correction

- The owner made durable offline score capture and later synchronization a
  mandatory October 3 pilot capability, superseding the earlier
  connected-first/optional scope. The established authenticated,
  event-scoped, idempotent replay contract remains unchanged: local entries
  may show `Saved Offline — Waiting to Sync` but never `Verified` until the
  server accepts and compares the independent records after reconnection.
- Player and director screens now require a tournament name-and-local-date
  label such as `Topaz 01-27-2026`. A non-limiting reference such as
  `PILOT-2026-000001` is restricted to administrative testing/audit metadata;
  internal tournament identity remains a UUID, separate from any approved
  ACC/source identifier. The operational tournament model still needs a
  source-backed local start date before this display is implemented. Offline
  implementation and the real two-device reconnect matrix remain release
  blockers.
- The scorecard is now explicitly server-derived rather than phone-owned.
  Synchronized history must rebuild on a replacement device. An unsynced
  failed-device queue cannot be falsely recovered from the database; instead,
  an audited non-self cross-check recovery uses surviving opponent-device
  and/or paper-card evidence and requires a distinct cross checker/director
  confirmation before `RecoveredVerified`. Device replacement and destroyed
  unsynced-queue recovery are part of the October pilot acceptance matrix.

## 2026-09-10 demo control audit and corrected results model

- Confirmed that several visible demonstration controls are placeholders, not
  hidden completed production features: repeatable Satellite-event UI, flyer
  upload/extraction, and expense entry have no complete live workflow. The
  production setup draft model can store repeatable events, but operational
  activation remains deliberately narrow; manual payment evidence is not an
  expense ledger.
- The protected check-in workspace is real but has no name search. The user
  requested the same quick name/status lookup available in Seating; this is a
  production UI requirement, not proof that check-in is complete.
- Recorded the corrected result model: Event/Playoff Results are separate from
  Qualification Results; qualifier order remains highest-to-lowest from the
  qualifying round; playoff finish does not rewrite qualifying rank; and High
  Non-Qualifier appears immediately after the last qualifier as a separate
  row. The current demo preview and sample PDF are explicitly outdated pending
  regeneration.
- Requirements-only verification passed `pnpm verify` (216/216 application
  tests, production build, 5/5 workspace checks). The PDF was rendered and
  visually inspected to confirm the exact outdated relationship being
  superseded; no PDF or production code was changed in this audit.

## 2026-09-10 ACC integration-first strategy and readiness tracking

- Recorded the cross-task ACC portal findings and accepted
  **integration-first, replacement-ready** boundary. The app will own pilot
  live operations; ACC remains authoritative for sanctioning, official
  schedule, membership/MRPs, approvals, and history.
- Automatic portal submission and credential-based browser automation remain
  disabled. The first handoff is a versioned director-reviewed package and
  manual ACC entry; API automation requires an ACC-authorized contract,
  sandbox/service identity, idempotency/reconciliation specification, and
  approval.
- Added a trackable production-foundation matrix to the meta readiness audit,
  with status, concrete evidence, first-pilot versus future-replacement effect,
  owner, and next acceptance check. Documentation-only and unverified controls
  are not marked implemented.
- Source limitation: the ACC portal review was read-only and Director-role
  only. Commissioner, statistician, and administrator behavior remains
  unverified.
- Documentation reconciliation passed `pnpm verify` (216/216 application
  tests, production build, 5/5 workspace checks), `pnpm verify:handoff`
  (6/6), and diff validation.
- Published the matching owner-private Production Readiness Site as version 11
  at `https://acc-tournament-production-readiness.chocolatebananamalt.chatgpt.site/`.
  The site now exposes the full integration strategy and 20-row foundation
  checklist, separating first-pilot blockers from future ACC automation or
  replacement gates.

## 2026-09-10 authenticated demonstration access

- Added a signed-in-only `/demo` route so the owner can explore the current
  interface using clearly labeled sample data without receiving an operational
  tournament role or changing live tournament records.
- Anonymous visitors are returned through email sign-in with `/demo` preserved
  as the safe same-origin destination. The anonymous Production root still
  cannot serve the synthetic tournament dashboard.
- The signed-in landing page now offers `Explore the demonstration`; the demo
  carries a persistent sample-data/no-save notice and an account return link.
- Focused authentication checks pass 36/36; `pnpm verify` passes audit, lint,
  216/216 application tests, the Next.js production build, and 5/5 workspace
  checks; `pnpm verify:handoff` passes 6/6. Independent Sol review found no
  P0/P1 issue.
- Promoted commit `7a1a255` as Production deployment
  `dpl_5xHc1HTbXxoMf6N6hwm4zD2oM3cx`. The retained real session opened the
  demonstration and completed its synthetic score-entry interaction; an
  unauthenticated fetch returned to `/sign-in?next=%2Fdemo`, deployment logs
  show no API mutation, and the live error scan is clean. Desktop visual proof
  is complete; a retained-session 375-pixel browser pass remains unavailable.
- Evidence: `docs/quality/2026-09-10-authenticated-demonstration-access.md`.

## 2026-09-10 real magic-link sign-in and authenticated-entry repair

- The fresh real-address magic-link test succeeded: Supabase created the
  session and the repaired callback returned without a runtime error. The
  apparent failure was a separate interface defect—Production `/` and
  `/sign-in` ignored the authenticated state and continued to offer sign-in.
- Added a server-validated signed-in acknowledgement, redirected authenticated
  `/sign-in` requests to `/`, retained independent tournament-role checks, and
  translated email rate limiting into a clear wait message.
- `pnpm verify` passes audit, lint, 215/215 application tests, the production
  build, and workspace checks; `pnpm verify:handoff` passes 6/6. Independent Sol
  review found no P0/P1 issue.
- Promoted commit `faba056` as Production deployment
  `dpl_3TPeJetjEENeoDUimx4tKGjec46i`. The user's retained real session visibly
  renders “You’re signed in”; `/sign-in` redirects to that acknowledgement,
  Vercel reports no runtime error, and the account has zero tournament roles.
- Evidence: `docs/quality/2026-09-10-authenticated-entry-ux-repair.md` and
  `docs/decisions/2026-09-10-authenticated-entry-state.md`.

## 2026-09-10 repaired build promoted to Vercel Production

- With explicit owner approval, promoted reviewed commit `32cd581` from
  Preview to Vercel Production. Deployment
  `dpl_2TdYsMyRuhXygphi3vTEUfSGVkFy` reached `READY`, targets `production`,
  has no alias error, and now serves `https://cribbage-web-app.vercel.app/`.
- Live smoke checks returned `200 OK` for `/` and `/sign-in`. A callback with
  no code redirected to `sign-in?error=missing_code`, and an intentionally
  invalid code redirected to `sign-in?error=callback_failed`; neither request
  returned HTTP 500.
- Deployment-scoped Vercel logs show the expected 200/307 responses and the
  `/auth/callback` runtime-error report is empty for the post-promotion window.
  External Chrome visibly loaded the live Tournament access page.
- The production callback crash is closed. One fresh, real magic-link exchange
  remains the final human proof that Supabase can exchange a valid one-time
  code and establish the browser session on this repaired deployment.
- Evidence: `docs/quality/2026-09-10-production-magic-link-callback-repair.md`.

## 2026-09-10 production magic-link callback repair

- A real production email-link attempt reached `/auth/callback` but returned
  HTTP 500. Vercel runtime logs identified the exact application failure:
  `NextResponse.next()` was used inside an App Router route handler.
- Replaced that middleware-only response accumulator with a route-safe neutral
  response, preserved Supabase refresh cookies/cache headers on the final
  redirect, and prevented duplicate raw `Set-Cookie` propagation.
- Added regression coverage that prohibits `NextResponse.next()` on the route
  client path. `pnpm verify` passes the audit, lint, 214/214 application tests,
  production build, and workspace checks; `pnpm verify:handoff` passes 6/6.
- Evidence: `docs/quality/2026-09-10-production-magic-link-callback-repair.md`.
  Promotion and a fresh human magic-link exchange remain required for live
  closure; the failed one-time code was not retained or reused.

## 2026-09-10 Vercel Production connection and live smoke verification

- Added the two required public Supabase connection values to the Vercel
  Production environment: `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. No service-role key, database
  password, or other privileged credential was added.
- Promoted reviewed commit `a8078fa` from the protected Preview to a new
  Production build. Vercel deployment `dpl_4XzLuvmw4hPixU3vytbe7cF92KMF`
  reached `READY`, was assigned to `https://cribbage-web-app.vercel.app/`,
  and reports no alias error.
- Live checks returned `200 OK` for `/` and `/sign-in`; `/auth/callback`
  safely redirected a missing-code request back to sign-in. The production
  app loaded successfully in external Chrome, Vercel recorded only expected
  200/307 responses, and no runtime-error cluster was present. The former
  Vercel 404 and missing-Production-environment blockers are closed.
- External Chrome verification confirms Supabase Authentication now uses
  `https://cribbage-web-app.vercel.app` as its Site URL and permits the exact
  `https://cribbage-web-app.vercel.app/auth/callback` redirect. The hosted
  authentication URL-configuration blocker is closed.
- Real magic-link delivery/callback proof with a non-owner address and the
  required independent multi-user workflow proof remain release gates.

## 2026-09-10 latest Preview and blocker-dashboard verification

- Pushed reviewed commit `5276fe3` to
  `codex/production-readiness-baseline`. Vercel built deployment
  `dpl_F7Mds8YiBJZydvMJSgJYV7bruHnP` successfully; the deployment returned a
  200 request in runtime logs, no runtime-error cluster was present, and the
  ACC Tournament Desk loaded in external Chrome at
  `https://cribbage-web-mf7um8pxd-cribbage-app.vercel.app/`.
- That deployment remains the protected Preview evidence for the reviewed
  code. The same reviewed commit was subsequently promoted with Production
  Supabase values and the default Production address now returns the app
  instead of Vercel 404. Real magic-link delivery and independent multi-user
  smoke proof remain human release gates.
- Updated and privately published version 4 of the owner readiness dashboard
  with the applied 0090–0110 pilot state, independent review result, exact
  Preview URL, exact Production failure, and a distinction between required
  launch dependencies and optional OCR/API/payment/SMS work.

## 2026-09-10 shared-pilot 0106–0110 application

- After full local verification, isolated database fixtures, and independent
  high-risk review reported no remaining blocking finding, applied exact source
  migrations 0106 through 0110 to the shared Supabase pilot in order.
- Postflight checks confirm service-only writers/readers remain unavailable to
  browser roles, the intentionally member-scoped preliminary standings reader
  retains its own exact tournament-membership check, and the pilot still has
  zero independent corrections, setup activations, and paper-card captures.
  No hosted feature switch was enabled and no sample tournament/user data was
  added. Evidence:
  `docs/quality/2026-09-10-shared-pilot-0106-0110-application.md`.

## 2026-09-10 migrations 0106–0110 integrated validation

- Integrated the independent Rule 12.2(b) correction lifecycle, correction-aware
  preliminary standings, Standard Singles setup activation, independent
  cross-checker paper-card capture foundation, and blocked-only event
  finalization-readiness report. All feature surfaces remain exact-value,
  default-off controls and none grants event finalization authority.
- The disposable Supabase validation project now holds the reviewed schema and
  functions. Self-contained rollback fixtures passed for all five slices,
  including correction application, competition ties, primary-director
  replacement, cross-checker-only authority, immutable capture/audit evidence,
  cross-tournament/revoked-role denial, and deliberately unavailable lifecycle,
  schedule, seating/eligibility, finance, dispute, attachment, result-version,
  and approval evidence. Relevant foreign-key advisor findings are closed.
- `pnpm verify` passes 214/214 application checks plus audit, lint, production
  build, and workspace checks; `pnpm verify:handoff` passes 6/6. Independent
  review and shared-pilot application are complete. Hosted flags, live
  multi-session proof, and production promotion remain separate release steps.

## 2026-09-10 restricted paper-card capture foundation

- Added migration 0109 and a default-off server-only API for an independent
  current cross-checker to create an immutable
  game-side capture plus a restricted provider-pending upload reference. The
  database derives the assigned card identity and permanent verification ID,
  preserves declared original image metadata, blocks self-game and
  cross-tournament capture, and records receipt/audit/conflict evidence.
- This source slice creates no image object or URL, requests no OCR, starts no
  transcription, selects no retention duration, and changes no score or game
  verification state. Rollback-only synthetic integration covered cross-checker
  creation and replay plus director/co-director, changed retry, self-game, wrong
  verification ID, cross-tournament, and viewer rejection. `pnpm verify` passes 214/214
  application tests plus build/workspace checks; `pnpm verify:handoff` passes
  6/6. Migration 0109 is applied to the shared pilot but not deployed or enabled. Camera UI,
  restricted storage/provider policy, OCR/human review, retention governance,
  access/deletion/restore auditing, and real-paper multi-session testing remain
  release gates. Evidence:
  `docs/quality/2026-09-10-paper-card-capture-foundation.md`.

## 2026-09-10 Rule 12.2(b) independent-card correction lifecycle

- Added an unreleased, service-only writer/reviewer/reader lifecycle for the
  dated Rule 12.2(b) 17/16 discrepancy fixture. It preserves the two original
  card claims, derives 16/17 independent adjudicated projections, snapshots
  the configured immediate-or-one-review and optional-or-required-reason
  policy, blocks self editing/review, and retains immutable receipts,
  conflicts, actor/timestamp history, and audit evidence without rewriting the
  canonical reciprocal scorelines.
- Migration 0106 and its rollback-only synthetic lifecycle fixture passed on
  the disposable Supabase validation project. `pnpm verify` passes 214/214
  application tests plus audit/lint/build/workspace checks, and
  `pnpm verify:handoff` passes 6/6. It is applied to the shared pilot but not
  deployed, browser-exposed, or enabled. Preliminary standings now consume the
  latest applied correction projection. Other Rule 12 cases, correction-aware
  finalized results, qualification notification, and real multi-session proof
  remain release blockers. Evidence:
  `docs/quality/2026-09-10-rule12b-correction-lifecycle.md`.

## 2026-09-10 Standard Singles setup activation vertical slice

- Added the default-off, service-only activation transaction that lets a
  verified current director/co-director explicitly approve and atomically turn
  the latest one-event Standard Singles setup revision into one sourced
  scoring-core ruleset and one draft-publication operational event. Immutable
  provenance, receipt/audit, exact replay, and changed-key conflict evidence
  are included; unsupported formats, stale setup/officials, unauthorized roles,
  and already operational tournaments fail closed.
- Activation deliberately creates no rounds, participants, seating/rotation,
  finance, results, payouts, qualifiers, or ACC submission. Migration 0108 is
  applied to the shared pilot but remains undeployed and disabled. `pnpm verify`
  (214/214 application tests plus build/workspace checks) and
  `pnpm verify:handoff` (6/6) pass. Hosted enablement and real
  authorized/unauthorized session proof remain release gates. Evidence:
  `docs/quality/2026-09-10-standard-singles-setup-activation.md`.

## 2026-09-10 shared-pilot 0090–0105 application

- With explicit owner approval, applied the exact ordered source migrations
  0090 through 0105 to the shared Supabase pilot. Postflight history records
  all 16 migrations, the assigned-game response retains its caller `actorId`,
  and all seven suspended Rule 12 functions now have no `authenticated`,
  `anon`, or `public` execution grant. No feature switch, role, player, score,
  correction, payment, or tournament fixture was enabled or mutated.
- The database-access containment blocker is closed. Vercel Production values,
  live deployment, real-address magic-link delivery, and independent-session
  workflow proof remain separate release gates. Evidence:
  `docs/quality/2026-09-10-shared-pilot-0090-0105-application.md`.

## 2026-09-10 integration-access dashboard update

- Updated and privately redeployed the production-readiness site with an
  easy-to-read integration inventory. GitHub, Vercel Preview, and Supabase are
  connected; Vercel Production setup and sign-in email delivery are the only
  required connection checks. Paper-card OCR is conditional. ACC API
  automation, payments, SMS, paid database branching, a custom domain, and
  enterprise security tooling are explicitly not launch requirements.

## 2026-09-10 production blocker recon and connected-first scope

- A four-agent product, rules, security, and platform recon consolidated the
  work into nine necessary release blockers and excluded paid password
  protection, paid database branching, online payments, automatic ACC portal
  submission, a custom domain, and enterprise security tooling from the
  connected-first release gate.
- Published an owner-private, plain-language blocker dashboard at
  <https://acc-tournament-production-readiness.chocolatebananamalt.chatgpt.site>.
  Offline scoring is now explicitly optional for the initial connected release;
  it remains unavailable unless its complete security and replay contract is
  later implemented.

## 2026-09-10 production recon immediate repairs

- Corrected the consolidated 0090–0105 pilot packet's migration 0094 checksum
  and removed stale 0090–0103 range wording from active change control.
- Ensured both authentication-callback error redirects are explicitly private
  and non-cacheable, with regression coverage. No hosted setting, database,
  user, or release switch changed. Evidence:
  `docs/quality/2026-09-10-production-recon-immediate-repairs.md`.

## 2026-09-10 event-finalization gate foundation

- Added a pure fail-closed finalization checklist for all configured required
  evidence: verification, disputes, corrections, seating/eligibility, finance,
  attachments, result version, director approval, source version, and scoring
  method. Every missing item remains separately visible. This does not add a
  database transition or allow an event to be finalized. Evidence:
  `docs/quality/2026-09-10-event-finalization-gate.md`.

## 2026-09-10 consolidated shared-pilot containment packet

- Replaced the fragmented 0090–0103 packet plus two amendments with one exact
  0090–0105 checksum-verified maintenance packet. It makes the urgent Rule 12
  direct-RPC grant revocations harder to misapply while preserving the required
  synthetic-validation, compatibility, approval, and post-apply evidence
  gates. It is not authorization and did not modify the shared pilot.

## 2026-09-10 offline score-queue contract foundation

- Added a strict, unconnected contract for the future authenticated offline
  score queue. It rejects sensitive/extra fields, fake local verification,
  expired capabilities, and mismatched replay receipts. It deliberately does
  not add IndexedDB, background replay, or offline scoring authority; the
  existing short retry envelope remains distinct. Evidence:
  `docs/quality/2026-09-10-offline-score-queue-contract.md`.

## 2026-09-10 Rule 13.2 first-round bracket invariant

- The qualification preview now reports the exact number of first-round
  participants after top qualifiers receive the Rule 13.2 byes. Fixtures cover
  both 27-of-108 and 33-of-132 examples, preventing an interface from
  accidentally treating the whole qualifier field as first-round players. It
  remains a preview only and does not create a bracket or official result.

## 2026-09-10 Rule 13.1 playoff-absence fixture boundary

- Added a separate, source-bound playoff absence timing fixture. It keeps the
  five-minute grace, counts only the first and each 15-minute additional
  forfeit through a configured match length, and preserves the rule that an
  absent qualifier remains entitled to the round-loser prize/MRP. It does not
  generate a bracket result, financial award, or database action. Evidence:
  `docs/quality/2026-09-10-playoff-absence-fixture.md`.

## 2026-09-10 Rule 11.4 late-lunch fixture boundary

- Added a narrowly source-bound late-lunch decision fixture: it retains the
  full five-minute grace period, then models only the first documented
  2-game-point/+10 versus 0/-10 result and the next-opponent rotation return.
  A repeat award or second post-lunch game is deliberately referred to a
  director rather than being silently disqualified or reseated. It does not
  enable attendance, scheduling, score, or role changes. Evidence:
  `docs/quality/2026-09-10-late-lunch-absence-fixture.md`.

## 2026-09-10 qualification tie-resolution signal

- Qualification previews now expose each unresolved numeric tie and the
  ACC-required head-to-head/one-game-playoff next step, including whether it
  crosses the qualifying cutoff. They remain deliberately non-finalizable and
  do not invent a result, playoff, payout, or MRP. Evidence:
  `docs/quality/2026-09-10-qualification-tie-resolution-signal.md`.

## 2026-09-10 Rule 12 apparent-qualifier contract

- The isolated correction foundation now retains the card side(s) identified
  as apparent qualifiers for the Rule 12.2 dispositions that require that
  fact. Source-case shapes are database-constrained and the browser-grant
  audit remains empty for all seven suspended legacy correction functions.
  This was validated only in the synthetic database; no pilot data, setting,
  or correction release switch changed. Evidence:
  `docs/quality/2026-09-10-rule12-apparent-qualifier-contract-validation.md`.

## 2026-09-10 cross-check/judge protocol fixture foundation

- Added source-bound, pure fixtures for the ACC 2025 cross-checker capacity
  threshold (two through 24 players, three above), the qualifying-relationship
  third-checker safeguard, two-judge hearing start, third-judge disagreement
  escalation, duplicate-official rejection, and self-dispute rejection.
  The implementation deliberately creates no operational assignment, role, or
  UI authority; `R-RULE-01` remains incomplete until its server lifecycle and
  real-session evidence exist. Evidence:
  `docs/quality/2026-09-10-cross-check-and-judge-protocol-fixtures.md`.

## 2026-09-10 Rule 12 disposition/notice database contract

- Closed a source-model gap in the isolated validation database: Rule 12.2(g)
  total adjustment and (i) affected-player notice can no longer be stored as
  independent corrective dispositions. The private foundation now records a
  qualification-change fact, accepts only the actual (a)-(f)/(h) dispositions,
  and rejects a qualifying-change claim on the no-change (h) case. The seven
  suspended legacy correction functions remain ungranted to browser roles.
  The change was applied and catalog-verified only in the synthetic validation
  project; it did not touch the shared pilot or enable corrections. Evidence:
  `docs/quality/2026-09-10-rule12-disposition-contract-validation.md`.

## 2026-09-10 Rule 12 notification-model correction

- Re-read the exact cached Rule 12.2 source text and corrected the fixture
  oracle's model of paragraph (i): it is an affected-player notification duty
  attached to a qualifying-changing scorecard correction, not a standalone
  scoring disposition. The pure oracle now requires an underlying (a)-(f)
  outcome before it can signal the notice, and rejects incorrectly treating
  the no-change (h) example as a qualifying change. Focused lint and 24
  Rule-12/schema checks pass. This remains a non-authoritative safety fixture;
  no correction workflow, database, pilot setting, or user record changed.

## 2026-09-10 Rule 12 source-fixture oracle

- Validated the exact cached 2025 Rule 12.2 text and added a pure,
  human-case-selected fixture oracle for every (a)-(i) disposition. It keeps
  two original card claims independent, derives adjudicated per-card values and
  0/2/3 points, rejects malformed/non-applicable cases, and signals when totals
  or an affected-player notice are required. It has no database/UI authority
  and cannot enable or alter the still-suspended correction workflow. Focused
  lint, 23 Rule 12/schema checks, and the production build pass. Details:
  `docs/quality/2026-09-10-rule12-fixture-oracle.md`.

## 2026-09-10 sign-in prerender boundary repair

- Direct protected-preview observation found the essential sign-in page stuck
  on its static “Opening sign-in…” loading fallback. Replaced the client-only
  query-string rendering boundary with Next's request-time page parameters, so
  the passwordless form is server-rendered and the browser-only portion holds
  only the actual sign-in action. The fresh protected Preview
  `dpl_GRDf33N52vQJRkKYEJQQMsFEjaxT` now visibly renders the email form; GitHub
  Actions and the full local verification suites pass, and no current runtime
  error was reported. No address was entered, no email was sent, and no hosted
  setting changed. Details:
  `docs/quality/2026-09-10-sign-in-prerender-boundary-repair.md`.

## 2026-09-10 hosted Preview environment-scope review

- Read-only Vercel review confirms the newest protected Preview deployment is
  `READY`, has the required masked public Supabase URL/publishable-key settings
  and an uninspected server-only key, and has no grouped runtime error in the
  preceding two hours. All three settings are Preview-scoped; this is correct
  for the current review build but is deliberately not proof of a configured
  public Production environment. No hosting setting, deployment, domain, key,
  or pilot data changed. Details:
  `docs/quality/2026-09-10-hosted-preview-environment-scope-review.md`.

## 2026-09-10 cross-site mutation hardening

- A source-wide API review found nine signed-in mutation routes that had
  verified-session and private-RPC boundaries but lacked the shared same-origin
  rejection used by the other mutation routes. Added that rejection before any
  body read or database work, covering score submit/confirm, the currently
  hard-disabled correction routes, and roster-promotion operations. A
  repository-wide regression test now requires every API POST route to use
  that gate. No database behavior or hosted configuration was changed.
  Evidence: `docs/quality/2026-09-10-api-mutation-and-function-surface-review.md`.

## 2026-09-10 hosted pilot recheck

- A new read-only catalog and advisor recheck confirms that the shared pilot
  still ends at logical migration `0089_foreign_key_coverage` and still grants
  authenticated execution on all seven suspended Rule 12 correction
  functions. This remains a critical containment item; no shared-pilot change
  was made. The source safeguards, including the application hard stop and
  revocation migrations `0096`–`0098`, remain ready for the separately
  required approved maintenance packet.
- The separate synthetic validation database is current through source
  migration `0103` and has zero authenticated grants on those seven functions,
  confirming the reviewed revocation sequence works before any shared-pilot
  change is considered.
- Prepared the non-authorizing, checksum-pinned maintenance packet at
  `docs/operations/PILOT_MIGRATION_PACKET_0090_0103.md` so future approved
  maintenance can be reviewed and reproduced without reconstructing the range.

## 2026-09-10 director QR-registration workspace

- Added the director/co-director source workspace for the existing
  fragment-only QR registration lifecycle. It locally renders a one-time QR
  code, never persists the bearer credential in browser storage, re-reads only
  non-secret link state, and is guarded by a separate default-off director
  management gate from public claims. It does not enable public registration,
  change the shared pilot, or complete real-browser validation.
  An authorized director now also receives a clear, non-actionable temporary
  availability screen if the private link-state reader is unavailable; no link
  is created or changed in that case. Focused lint, 157 application checks,
  the full verification suite, private-handoff check, and a production build
  passed. Details:
  `docs/quality/2026-09-10-director-qr-registration-workspace.md`.

## 2026-09-10 explicit safe deployment defaults

- Added explicit default-off registration-link management, public
  registration, and account-activation switches to the environment template,
  with a regression test that rejects a server credential placeholder. The
  template remains guidance only: no feature was enabled and no shared hosted
  configuration changed. The release plan now records the evidence required
  before any of those switches may be changed.

## 2026-09-10 ACC public flyer-source review

- Recorded a dated, source-backed ACC flyer field inventory from the public
  Director Resources and Policy Manual. It distinguishes the known required
  and recommended fields from the still-unconfirmed current regional form,
  payout/Q-pool vocabulary, and any portal integration. No ACC portal or
  tournament data was accessed. The full local suite, private-handoff check,
  and clean GitHub Actions verification for `38beb51` passed. Details:
  `docs/quality/2026-09-10-acc-flyer-public-source-review.md`.

## 2026-09-10 exact Supabase CSP connection source

- Narrowed the site-wide browser connection policy from every Supabase tenant
  to the exact configured Supabase HTTPS/WebSocket origin. Malformed
  configuration now permits no external connection. Focused lint and 32
  Supabase/auth checks passed; hosted-header and browser evidence remains open
  until the Vercel deployment quota resets. Details:
  `docs/quality/2026-09-10-exact-supabase-csp-connect-source.md`.

## 2026-09-10 account-activation lifetime boundary

- Tightened the disabled account-activation issue route so impossible
  short/long credential lifetimes are rejected before any server-only database
  call. The private database rule remains authoritative. Focused lint and
  deterministic rejection tests passed; this does not enable the feature or
  apply its migrations. Details:
  `docs/quality/2026-09-10-account-activation-lifetime-boundary.md`.

## 2026-09-10 review-prototype new-tab isolation

- Closed a review-surface browser boundary: every prototype link that opens a
  separate tab now severs opener and referrer access. The protected production
  Rulebook already followed this pattern. A repository regression keeps all
  application `_blank` links aligned. Full local verification passed with 154
  application tests. Details:
  `docs/quality/2026-09-10-review-prototype-new-tab-isolation.md`.

## 2026-09-10 site-wide browser isolation hardening

- Extended the nonce-bound Content Security Policy from credential-fragment
  routes to every matched application response. The browser may now connect
  only to the app itself and Supabase authentication; framing and plugin
  content are independently denied. Full local verification passed (153
  application checks, build, audit, workspace, and private handoff), and
  GitHub Actions passed for commit `d62372f`. A local optimized-server check
  also proved that both a `403` unsafe-origin rejection and a `503`
  unavailable sign-in response retain the CSP. Vercel has reached the Hobby
  plan's daily code-deployment limit, so hosted CSP and visual evidence remains
  explicitly open rather than inferred from the previous preview. Details:
  `docs/quality/2026-09-10-sitewide-csp-hardening.md`.

## 2026-09-10 shared-pilot correction-grant containment gap

- A new read-only grant audit found the shared pilot still grants authenticated
  execution on seven incomplete Rule 12 correction RPCs because it ends before
  source migrations `0096`–`0098`. The app already hard-disables every matching
  page and route, but that does not prevent a direct Supabase RPC call. There
  are currently no tournament-role records in the pilot, reducing immediate
  practical reachability; the grants are nevertheless a critical pilot
  containment gap before any role fixture or live user is added. Added a
  source regression for all writer/policy/reader revocations. No pilot change
  was made without a separately authorized maintenance window. A second
  read-only recheck later the same day confirmed that the pilot still ends at
  `0089` and every named grant remains present. Details:
  `docs/quality/2026-09-10-shared-pilot-correction-grant-gap.md`.

## 2026-09-10 browser indexing hardening

- Added a site-wide `X-Robots-Tag: noindex, nofollow, noarchive` response
  policy. Current sign-in, protected tournament, and review-preview routes
  are operational surfaces, not approved public search content. A regression
  test keeps this policy alongside the existing browser-hardening headers. It
  is not an authorization substitute and does not create a public-results
  release. GitHub Actions passed for commit `4faa088`; Vercel Preview
  `dpl_DmcKzD2g5vDkgkxm5PAxkpe5UG48` is `READY` and its hosted sign-in response
  returned the exact no-index header. Details:
  `docs/quality/2026-09-10-browser-indexing-hardening.md`.

## 2026-09-10 evidence-history reconciliation

- Marked the older disposable-environment and meta-readiness records as
  historical where later evidence had made particular statements stale. The
  records now distinguish the former `0001`–`0068` test baseline from the
  current shared-pilot `0089` baseline, and no longer present completed
  registration-link work or an unavailable Supabase password toggle as current
  blockers. The actual remaining independent-session and browser evidence
  gates are retained. No application code, pilot setting, or pilot data was
  changed.

## 2026-09-10 shared-pilot migration change control

- Corrected the database guide to reflect the actual shared-pilot schema
  baseline (`0089_foreign_key_coverage`) rather than an obsolete earlier
  migration range. Added a required, non-authorizing shared-pilot change
  procedure covering ordered migration selection, synthetic validation,
  security/grant review, recovery planning, explicit authority, and
  post-apply evidence. This does not apply anything to the pilot or make the
  unavailable score workspace available. Details:
  `docs/operations/PILOT_MIGRATION_CHANGE_CONTROL.md`.

## 2026-09-10 live pilot security and parity review

- Rechecked the shared pilot read-only. Its signed-in `SECURITY DEFINER`
  advisor warnings are expected: no anonymous execution grant was present,
  and every signed-in callable function had an empty search path and explicit
  `auth.uid()` guard. The pilot remains behind source migrations `0090`–`0103`;
  the deployed game-context safeguard prevents that from enabling a partial
  scoring screen. No pilot change was made. Details:
  `docs/quality/2026-09-10-live-pilot-security-and-parity-review.md`.

## 2026-09-10 API mutation-boundary review

- Reviewed every current API route for direct data access and origin-gate
  coverage. All state-changing `/api/v1` routes are protected by the shared
  Proxy origin gateway before route execution and use RPC/server-only command
  boundaries rather than direct table queries. A new repository-wide
  regression preserves that invariant. Details:
  `docs/quality/2026-09-10-api-mutation-boundary-review.md`.

## 2026-09-10 assigned game-context contract gate

- Hardened the protected score-entry page against database/code version drift.
  An absent assigned game remains hidden; an RPC failure or incompatible
  response now renders a non-actionable availability notice rather than any
  score-entry control. This is currently relevant because the shared pilot
  database does not yet have migration `0103`, which supplies the authenticated
  actor identifier required by the current retry-isolation code. No pilot
  migration or setting was changed. Local `pnpm verify` (152 tests, build,
  audit, lint, workspace) and `pnpm verify:handoff` (6 tests) pass. Vercel
  Preview deployment `dpl_2NZbkTh4QwYgsC1CevinuDEXeH1U` from commit `02d9fce`
  is `READY`; its protected passwordless sign-in form rendered without sending
  email, and no runtime errors were reported in the preceding hour. Details:
  `docs/quality/2026-09-10-assigned-game-context-contract-gate.md`.

## 2026-09-10 protected preview authentication preflight

- Hosting review confirmed the current protected preview is `READY` but found
  an older Vercel middleware configuration failure caused by missing public
  Supabase settings. A logged-in Vercel browser session now proves the current
  preview's passwordless `/sign-in` form renders without that error; no email
  was sent. Magic-link callback and deployment-specific error review remain
  explicit release evidence, not assumed configuration. Details:
  `docs/quality/2026-09-10-protected-preview-auth-preflight.md`.

## 2026-09-10 Rule 12 hard release stop

- Strengthened the incomplete Rule 12 correction release boundary: no
  environment value can enable it. A future, separately reviewed release must
  replace the hard stop only after the complete independent-card workflow and
  all required evidence exist. Details:
  `docs/decisions/2026-09-10-rule12-independent-card-corrections.md`.
- Protected Vercel Preview deployment `dpl_GAFNdW6BSZ5KtZmRH2EbNjcv5h5S`
  from commit `a038732` reached `READY`; a protected fetch of its root returned
  HTTP 200 with the expected no-store and browser-hardening headers. No runtime
  error cluster was present in the preceding 24 hours. This confirms hosting
  availability only; it is not independent-user workflow or public-release
  certification.

## 2026-09-10 CI supersession guard

- Added a per-workflow/per-ref GitHub verification concurrency guard. A newer
  push now cancels an obsolete in-progress verification for that same branch,
  preserving a clearer source-to-check relationship and reducing wasted hosted
  capacity. This does not change Vercel's separate preview quota or constitute
  branch-protection evidence. Details:
  `docs/quality/2026-09-10-ci-supersession-guard.md`.

## 2026-09-10 hybrid guidance authentication boundary

- Corrected the protected player guide and Rulebook quick reference so a
  paper card is explicitly a shared reference, never a substitute for an
  opponent's authenticated independent entry. On a shared device, the first
  player must sign out before the other player signs in. A missing signed-in
  opponent entry remains pending for the authorized cross-check or judge
  process; a single digital entry cannot be described as verified. The score
  screen also refuses to save a retry envelope when the browser is plainly
  offline. This is a safety boundary, not the still-required hybrid/offline
  or paper-capture implementation. Details:
  `docs/quality/2026-09-10-hybrid-guidance-boundary.md`.

## 2026-09-10 actor-scoped score retry

- Corrected a shared-device retry-scope gap: saved score-submission and
  confirmation retry envelopes are now bound to the authenticated assigned
  player, and a mismatched envelope is removed rather than displayed or
  retried. The isolated synthetic database confirms the assigned-game context
  returns only the simulated caller's actor ID. This is online retry hardening,
  not an offline queue or verification shortcut. Details:
  `docs/quality/2026-09-10-actor-scoped-score-retry.md`.

## 2026-09-10 traceability-status reconciliation

- Reconciled the non-normative requirements summary with the current code and
  isolated database evidence. It now distinguishes actual partial server/API
  foundations from guidance/prototype-only work and explicitly describes Rule
  12 corrections as disabled safety work, not mock functionality. This closes
  a planning-accuracy conflict without relaxing any production gate. Details:
  `docs/quality/2026-09-10-traceability-status-reconciliation.md`.

## 2026-09-10 Rule 12.2 independent-card foundation hardening

- Hardened the inert private Rule 12 correction projection foundation only in
  the separate synthetic validation project. The new enforcement serializes
  correction sequence/version checks, links each card claim to the correct
  canonical card identity, validates original and adjudicated card arithmetic,
  and requires exactly two distinct card projections. A live rolled-back
  fixture proves Rule 12.2(b)'s distinct 17-point-win/16-point-loss original
  claims can become the required 16-point-win/17-point-loss adjudications;
  an internally inconsistent original claim and an incomplete one-card
  correction are rejected. The correction feature has no user-facing writer
  or reader and remains disabled. Details:
  `docs/quality/2026-09-10-rule12-independent-card-foundation-live-check.md`.
  The source-case ledger now records the remaining executable fixtures and
  rejection conditions for Rule 12.2(a)–(i), without claiming they exist:
  `docs/quality/2026-09-10-rule12-fixture-ledger.md`.

## 2026-09-10 isolated real-identity score flow

- Ran the installed score RPCs against two separately simulated signed-in
  identities in the synthetic validation database, inside a fully rolled-back
  transaction. The assigned players completed the independent submit/confirm
  flow to an actual verified game with exactly two scorelines and 3/0 points;
  an attempted wrong-side submission was rejected as `not_assigned`, and an
  outsider could not read game context. A post-rollback check found zero
  synthetic accounts, profiles, or tournament rows. This materially strengthens
  the database evidence but does not replace required independent browser
  sessions or the wider release gates. Details:
  `docs/quality/2026-09-10-isolated-real-identity-score-flow.md`.

## 2026-09-10 active RPC authorization audit

- Audited the remaining authenticated `SECURITY DEFINER` public database
  surface in the separate synthetic validation project after the Rule 12
  correction suspension. All 22 active entry points have an empty search path
  and an explicit signed-in actor check; director/finance/roster/setup/seating
  functions independently require the director or co-director role, while
  score readers and writers independently scope access to the assigned player.
  No anonymous execute grant was found. This is a catalog/static boundary pass,
  not a substitute for required independent-session and cross-tournament tests.
  Details: `docs/quality/2026-09-10-active-rpc-authorization-audit.md`.

## 2026-09-10 isolated database validation environment

- Checked the available Supabase paths for the required real concurrency
  tests without touching the shared pilot. Free-plan preview branches are not
  available, so the existing separate, synthetic-fixture test project is the
  controlled validation target. The reviewed activation chain `0090`–`0095`
  now applies there successfully. No pilot migration, data, auth setting, or
  release flag changed. Temporary connector probes were removed immediately;
  the controlled-test acceptance criteria are recorded in
  `docs/quality/2026-09-10-isolated-database-validation-environment.md`.
  A new synthetic fixture now proves the complete sequential witnessed
  activation lifecycle and its exact approval replay in that isolated project;
  real concurrent and browser-session evidence still remains before release.
  An isolated two-request redemption/cancellation race now completes with no
  deadlock and the expected cancelled/no-link final state; reverse-order and
  decision/cancellation races remain required before release. A concurrent
  decision/cancellation race now also completes with no deadlock and the same
  safe cancelled/no-link state. A logged-in Chrome smoke test of the protected
  Preview also verified the visible score-entry winner/keypad/derived-card
  flow and its `122` rejection path; it made no hosted mutation. Mobile and
  persisted multi-user browser evidence remain required before release. See
  `docs/quality/2026-09-10-protected-preview-score-entry-browser-smoke.md`.
  A fourth isolated fixture now proves atomic registration closure retires the
  active signup link and replays without duplicate receipt/event/audit rows.
  The older cycle-2 readiness report is explicitly historical and cannot be
  used as current release evidence. Browser exploration also found and
  repaired a scorecard fixture-state contradiction: an unsubmitted local
  result can no longer appear as verified or populate a card whose totals
  exclude it. A fresh deployed-browser check is complete. Two further
  disposable fixtures now prove registration-link rotation and registration
  closure serialize safely in both orders: a closing tournament rejects a
  contending stale rotation, and a later close retires a successfully rotated
  replacement link. No active signup link remains in either final state. A
  concurrent valid claim/closure fixture also serializes safely: a claim
  committed before closure is retained, while a fresh post-closure claim is
  unavailable and cannot create another record. Vercel has also completed a
  fresh branch Preview from the newest pushed commit and its protected hosted
  fetch returns the expected score-entry shell with the configured no-store,
  no-referrer, frame, and device-permission protections. A new interactive
  browser check of the scorecard repair is now complete: a valid but
  unsubmitted fixture result stays out of the card and totals and is honestly
  labelled `Entry Not Submitted`. Persisted multi-user browser evidence
  remains required. The complementary close-first fixture is also complete:
  it leaves zero claims when a valid claimant arrives after registration was
  closed. The current Vercel preview has a clean build, no recent runtime
  errors, and no observed browser-console errors. A direct anonymous-role
  database call to the registration-close procedure is rejected by its
  server-only guard before it can mutate anything. A two-request isolated
  check-in/registration-close race is also safe: closure wins, the check-in
  receives a durable `registration_closed` rejection, and no check-in event
  is written.

## 2026-09-10 rule-source traceability review

- Re-read the permitted cached 2025 ACC Rulebook and matched its checksum to
  the protected in-app metadata. Recorded the precise Rule 12.1, Rule 12.2,
  Rule 13.2, and cross-check implementation boundary in
  `docs/quality/2026-09-10-acc-public-rule-source-review.md`. The review
  confirms the current score and numeric qualification preview coverage, and
  makes the still-missing Rule 12.2 discrepancy fixtures plus head-to-head/
  playoff tie resolution explicit release gates. No official calculation,
  correction, payout, or export boundary was relaxed.

## 2026-09-10 Rule 12.2 correction safety suspension

- The detailed Rule 12.2 review exposed a material model conflict: its
  apparent-qualifier and no-harm/no-foul examples can retain different
  adjudicated values on the two scorecards, while the preliminary correction
  writer forces both records into one reciprocal canonical result. That writer
  is not safe to present as ACC-complete. It is now default-off at the app
  boundary, and migration `0096` revokes direct authenticated mutation grants
  until an independent-card replacement and all nine source fixtures exist.
  Related correction-policy and reconciliation surfaces are also absent while
  the same gate is off, so no partial configuration workflow remains exposed.
  Migrations `0096`–`0098` revoke the correction writers and their direct
  authenticated readers. The revocation was applied and catalog-verified only
  in the separate
  synthetic test project; the shared pilot was not changed. See
  `docs/decisions/2026-09-10-rule12-independent-card-corrections.md`.
  Migration `0099` now provides only the private, immutable independent-card
  correction projection foundation required by the rule; it has no writer,
  reader, grant, or release flag and does not re-enable corrections.
  Git Preview `dpl_ErDVsh3DCYo3m7WquCBPg1HRZuA6` from commit `ba896b4` is
  READY and Vercel-protected; its unauthenticated request correctly redirects
  to Vercel sign-in rather than exposing a public pilot.

## 2026-09-10 account-activation lock-order repair

- Repaired a pre-release deadlock risk in the un-applied account-activation
  migrations: issuance already acquired the shared tournament/roster advisory
  lock first, while redemption, approval, and cancellation had locked a row
  first. All now discover the immutable lock scope, acquire the shared lock,
  then re-read mutable rows under it. A schema regression prevents that order
  from drifting. No local database runtime was available for a two-connection
  race; the private migrations remain unapplied and the feature stays off.
  See `docs/quality/2026-09-10-account-activation-lock-order-repair.md`.

## 2026-09-10 account-activation fragment-boundary repair

- Repaired the gated account-activation page so its credential is parsed and
  removed from the browser address before React hydration, with the same
  nonce-based same-origin-only Content-Security-Policy already used for public
  registration. The page now clears/aborts ephemeral credential use on
  pagehide and teardown, and regression coverage protects the no-storage,
  no-third-party boundary. Local lint, 146 tests, production build, and diff
  validation pass. The activation flag stays off; migrations `0090`–`0095` and
  real multi-session/browser evidence are still required. See
  `docs/quality/2026-09-10-account-activation-fragment-boundary.md`. Preview
  deployment `dpl_2yPe422kFp5wbpxc66AnVc3zWneJ` is READY; its disabled route
  correctly returns 404 with no-referrer protection.

## 2026-09-10 gated account-activation handoff page

- Added a release-gated `/activate` handoff page for the witnessed
  roster-account activation ceremony. It is intentionally absent unless the
  explicit activation switch is enabled after private migration and controlled
  pilot evidence. The page does not expose a directory, roster data, or a
  server credential; its fragment-only credential remains an activation
  request until a director separately confirms the generated phrase.

## 2026-09-10 verification inventory guard

- Added a regression guard ensuring every ordinary `tests/*.test.mjs` file is
  included in the normal application-test command. This closes a release
  process gap found while adding account-activation route coverage: a newly
  created test could otherwise pass when run manually yet be omitted by the
  standard verification command. The workspace check passes locally. The
  remaining hosted deployment gap is an invalid local Vercel CLI login token;
  it does not change the tested source state.

## 2026-09-10 account-activation server route boundary

- Added strict, same-origin, verified-session server routes for the
  release-gated account-activation issue, redemption, witnessed decision, and
  cancellation commands. Browser callers cannot receive the server-only
  Supabase credential; malformed input and malformed database success receipts
  fail closed. The local test suite now includes the command-adapter and route
  boundary cases (145 passing), and the Next.js production build passes. The
  activation feature remains unavailable because migrations `0090`–`0095`, a
  live multi-session pilot, and the user-facing QR ceremony remain unfinished.
  See `docs/quality/2026-09-10-account-activation-route-boundary.md`.

## 2026-09-10 witnessed account-activation foundation

- Began the server-only account-link activation implementation after the
  Preview-only `SUPABASE_SECRET_KEY` was confirmed in Vercel. The repository
  now has a strictly parsed 256-bit fragment-token primitive and an un-applied
  private digest-only migration for activation, pending-request, and immutable
  event records. The next local migration adds the service-only, receipt-bound
  issuance transaction: it serializes each roster identity, rechecks the
  director/co-director role, expires stale pending requests safely, and retains
  changed idempotency-key collisions as immutable private evidence. Its
  server-only issuer adapter sends only salted digest material and never
  recreates a credential after an ambiguous retry. A second local migration
  and server-only adapter now redeem only a digest after a private salt lookup;
  redemption creates a pending witnessed request and phrase, never an account
  link. Its pending request now retains a separate internal link-operation ID
  and a service-only equivalent of the existing link writer, ready for the
  atomic director-approval transaction. That transaction now requires the
  witnessed phrase and rolls back completely if its nested account link fails.
  Directors can also cancel a pending or unused activation, releasing it for a
  later safe ceremony. Strict server-route request contracts now reject malformed
  activation commands before they reach database code. The feature is release-gated
  off by default. The feature is still unavailable: no route, QR,
  director workspace, or pilot migration has been enabled. See
  `docs/quality/2026-09-10-account-activation-foundation.md`.

## 2026-09-10 hosted email-provider clarification

- Corrected an inaccurate release gate. Supabase's current hosted Email
  provider combines password and magic-link settings, so there is no supported
  password-only switch to use while preserving magic links and new-user
  creation. The app itself exposes only magic-link authentication, and an
  externally created provider account has no role or tournament authority.
  The paid leaked-password advisory remains documented but is not a blocker
  for this flow. No Supabase setting needs changing. See
  `docs/quality/2026-09-09-password-provider-probe.md`.

## 2026-09-10 magic-link callback cache hardening

- Every magic-link callback redirect is now private and non-cacheable, even
  for missing-code or failed-exchange paths that do not set a cookie. Full
  verification and private-handoff checks pass. See
  `docs/quality/2026-09-10-auth-callback-cache-hardening.md`.

## 2026-09-10 meta review cycle 3

- Completed the requested post-repair meta review against the normative
  production requirements, current code/tests, pilot advisors, migrations, and
  hosting metadata. This cycle repaired the shared API mutation guard,
  sign-out guard, and standard verification command. No new P0/P1 defect was
  found in the implemented slice, but the full product remains unready: real
  multi-user/browser proof, account activation configuration, official ACC
  fixtures, offline/paper capture, results/finance/finalization, retention,
  and release operations are non-waivable blockers. See
  `docs/quality/2026-09-10-meta-review-cycle-3.md`.

## 2026-09-10 standard verification command repair

- Closed a release-process gap: `pnpm verify` now actually runs the production
  dependency audit, lint, full application suite, production build, and
  workspace checks, instead of only the recovery suite. GitHub CI calls this
  same audited command after frozen installation, and a regression test
  prevents future drift. The full clean-clone and private-handoff suites pass.
  See `docs/quality/2026-09-10-standard-verification-command.md`.

## 2026-09-10 pilot live advisor and migration recheck

- Rechecked the connected pilot's current migration history and live
  security/performance advisors. Its 43 private RLS-without-policy notices
  and 29 authenticated role-checked `SECURITY DEFINER` RPC notices remain
  intentional under the private-table design; no anonymous/PUBLIC execution
  or unindexed foreign-key finding appeared. The remaining password advisory
  is only safe to waive if the hosted password provider is disabled. No
  database state was changed. See
  `docs/quality/2026-09-10-pilot-live-advisor-recheck.md`.

## 2026-09-10 sign-out Fetch-Metadata hardening

- Aligned the passwordless session-clearing endpoint with the shared
  same-origin and Fetch-Metadata decision, including a private non-cacheable
  rejection response. Existing local sign-out, cookie propagation, and
  shared-device cleanup behavior remain covered. Full local tests, lint,
  production build, recovery checks, and diff validation pass. See
  `docs/quality/2026-09-10-sign-out-fetch-metadata-hardening.md`.

## 2026-09-10 API mutation Fetch-Metadata gateway hardening

- Strengthened the shared `/api/v1` unsafe-request gateway. It already
  rejected any missing or foreign Origin and now also fails closed when a
  browser explicitly identifies a mutation as cross-site, while maintaining
  compatibility with older clients that omit the optional Fetch-Metadata
  header. Regression tests cover all accept/reject cases; full local tests,
  lint, production build, recovery checks, and diff validation pass. See
  `docs/quality/2026-09-10-api-mutation-fetch-metadata-gateway.md`.

## 2026-09-10 Fetch-Metadata mutation hardening

- Strengthened the shared same-origin write guard: existing mutations already
  required an exact Origin match, and now also reject an explicit cross-site
  Fetch-Metadata signal while retaining compatibility for clients that do not
  send the optional header. Regression coverage proves both accept and reject
  paths; full local tests, lint, production build, recovery checks, and diff
  validation pass. See
  `docs/quality/2026-09-10-fetch-metadata-mutation-hardening.md`.

## 2026-09-10 rotation exception source review

- Reviewed the public ACC Tournament Director's Manual for the user-described
  last-table/odd-player problem. It requires every player to complete at least
  the qualifying-game count, excludes any extra game from scoring, and retains
  it for cross-checking; it does not authorize a guessed automatic rotation
  plan. The app therefore remains director-reviewed for this exception until
  ACC-backed rotation fixtures are available. See
  `docs/quality/2026-09-10-rotation-exception-source-review.md`.

## 2026-09-10 public registration page release gate

- Closed a release-gate inconsistency: the public registration claim API was
  disabled by default, but `/register` still rendered a form shell. The page
  now uses the same explicit feature decision and returns a real not-found
  response before it can load its credential fragment bootstrap or form when
  registration is disabled. Automated tests, lint, and production build pass;
  public registration remains disabled. See
  `docs/quality/2026-09-10-public-registration-page-release-gate.md`.

## 2026-09-10 registration lifecycle review reconciliation

- Reconciled the earlier focused registration-link review against the current
  migrations `0077`–`0084`, server routes, regression tests, and recorded
  disposable/pilot evidence. The later compare-and-swap, stable-retry,
  expiration, atomic-close, and post-closure check-in repairs close every
  previously identified P0/P1 implementation risk in that boundary. Public
  registration remains disabled by default. Independent browser/race and
  authentication evidence remain explicit release gates. See
  `docs/quality/2026-09-10-registration-lifecycle-review-reconciliation.md`.

## 2026-09-10 source and dependency exposure audit

- Confirmed that current ignore rules protect environment, private-handoff,
  key, archive, and build/test artifact paths; no private handoff or populated
  environment artifact is tracked. A focused executable-source credential scan
  found no high-confidence secret pattern, and `pnpm audit --prod
  --audit-level=high` reports no known vulnerabilities. This is repository
  evidence only; provider-side secret review and rotation remain release
  operations. See
  `docs/quality/2026-09-10-source-and-dependency-exposure-audit.md`.

## 2026-09-10 GitHub merge-guardrail audit

- Confirmed that the committed GitHub Verify workflow runs frozen install,
  dependency audit, lint, full tests, build, and workspace verification.
  GitHub returned HTTP 403 when checking branch protection on the private
  repository: the current plan does not provide that enforcement without an
  upgrade or making the repository public. The repository must remain private;
  this is documented as a Step 6 release-operation gate, not silently treated
  as CI protection. See
  `docs/quality/2026-09-10-github-merge-guardrail-audit.md`.

## 2026-09-10 production entry-point repair

- Closed a launch usability gap: production root requests no longer become a
  404 merely because the synthetic review dashboard is correctly disabled
  there. They now offer a neutral passwordless sign-in entrance, while the
  dashboard remains preview/local-only. The stale sign-in message claiming
  configuration was not connected was also removed. Full automated tests,
  lint, and production build pass. Browser visual evidence remains a release
  gate because the local browser verifier is unavailable and Vercel is
  currently rate-limiting new builds. See
  `docs/quality/2026-09-10-production-entry-point-repair.md`.

## 2026-09-10 pilot database surface re-audit

- Re-ran the pilot Supabase security review and directly inspected table and
  function privileges. All 43 private `app` tables retain RLS with no direct
  anonymous or authenticated table grant. Its 30 `SECURITY DEFINER` functions
  have no anonymous or PUBLIC execute grant and explicit empty search paths;
  the advisor's 29 authenticated-only function notices are the intended,
  role-checked browser RPC surface rather than a direct anonymous exposure.
  Password-provider configuration and real signed-in authorization evidence
  remain release gates. No project state was changed. See
  `docs/quality/2026-09-10-pilot-database-surface-reaudit.md`.

## 2026-09-10 ACC MRP and payout source inventory

- Reviewed the public ACC Director Resources index and its Main,
  Consolation, Double-Elimination, and sample-payout references. The Main and
  Consolation MRP sheets explicitly say they were effective August 1, 2016,
  so they are preserved as source inventory rather than enabled as current
  official financial calculations. The documented gates still prevent MRP,
  Q-pool, payout, result finalization, and ACC export from being calculated or
  published without current ACC-authorized schedules and executable fixtures.
  A later fresh public-site check confirms that 2026 standings and player
  records actively display MRP values, but it does not supply the missing
  current calculation/payout fixtures. See
  `docs/quality/2026-09-10-acc-mrp-payout-source-inventory.md`.

## 2026-09-10 Vercel preview build-rate limit

- Vercel intermittently accepts branch previews, confirming the project can
  build and route Next.js. It marked deployment
  `dpl_BhZ7zZdvTqjKzN68KpqLrfBwynjg` for commit `87cc65b` Ready. However, the
  immediate newer commit `c46b5f5` was again rejected with the provider's
  `Deployment rate limited — retry in 24 hours` status. This is a hosting-plan
  quota limit, not an application build/runtime failure. No billing, plan,
  deployment target, custom domain, or environment change was made. The latest
  code still lacks hosted evidence; protected endpoint requests also remain
  behind Vercel SSO and do not replace signed-in browser testing. See
  `docs/quality/2026-09-10-vercel-build-rate-limit.md`.

## 2026-09-10 pilot foreign-key index coverage

- The pilot Supabase performance advisor identified 24 missing foreign-key
  index prefixes. Migration `0089` adds the exact non-destructive B-tree
  coverage indexes and was applied successfully to the pilot. A fresh advisor
  run no longer reports an unindexed foreign key; its remaining unused-index
  notices are expected on the low-traffic pilot and do not warrant destructive
  pruning. The live security review also confirms the inspected authenticated
  RPCs have no anonymous/PUBLIC execute grant and retain an empty
  `search_path`. Local tests pass: **124 tests** and lint. See
  `docs/quality/2026-09-10-pilot-foreign-key-index-coverage.md`.

## 2026-09-10 all live mutation request bounds

- Extended streaming JSON request limits across every implemented API POST
  route after a complete mutation-route audit found fourteen remaining uses of
  framework body buffering. Small operations are limited to 2 KiB; bounded
  seating publication and setup drafts use documented 64 KiB and 512 KiB
  ceilings appropriate to their validated data shapes. A regression scan now
  fails if any live POST route reintroduces `request.json()` or `request.text()`.
  Local checks pass: **123 tests**, lint, production build, workspace
  verification, private-handoff verification, and diff check. See
  `docs/quality/2026-09-10-all-live-mutation-bounds.md`.

## 2026-09-10 registration-link streaming-body repair

- Closed the same input-buffering gap in the live registration-link issue,
  rotate, close, and registration-close mutations. Those server-only director
  operations now reject non-JSON, malformed, declared-oversize, and actual
  bodies over 2 KiB through the shared streaming reader, which cancels before
  consuming later chunks. Existing exact-shape, same-origin, role,
  idempotency, credential, and database controls are unchanged. Local checks
  pass: **122 tests**, lint, production build, workspace verification,
  private-handoff verification, and diff check. See
  `docs/quality/2026-09-10-registration-link-streaming-boundary.md`.

## 2026-09-10 source-bound qualification preview

- Added a pure, source-bound ACC qualification preview: ranks by game points,
  games won, net spread points, then positive spread points; calculates one
  in four entrants rounded up and allocates byes from the next full bracket.
  It fails closed for an exact numeric tie and visibly marks a cutoff tie
  instead of inventing an official qualifier. It has no database, payout,
  export, or publication path. Local checks pass: **121 tests**, lint,
  production build, workspace verification, private-handoff verification,
  and diff check. See the decision and evidence records under
  `docs/decisions/2026-09-10-qualification-preview-boundary.md` and
  `docs/quality/2026-09-10-qualification-preview.md`.

## 2026-09-10 score mutation bounded-body hardening

- Closed an input-boundary gap in the live score-submission and confirmation
  routes. Both now reject non-JSON, malformed, declared-oversize, and actual
  bodies larger than 2 KiB before they can reach a scoring RPC; the streaming
  reader cancels as soon as it crosses that limit rather than buffering the
  full oversized body. Direct regression coverage proves every rejection
  path, a valid request, and early stream cancellation; existing exact-shape,
  session, role, idempotency, and database verification controls remain
  unchanged. Local checks pass: **118 tests**, lint, production build,
  workspace verification, private-handoff verification, and diff check. Real
  independent-session browser evidence remains a release gate. See
  `docs/quality/2026-09-10-score-mutation-bounded-json.md`.

## 2026-09-10 protected player scorecard reader

- Closed the production-screen gap where the verified scorecard existed only
  in the review prototype. Migration `0088` exposes an authenticated player's
  own approved Standard Singles card through a narrow, permanent-ID-bound
  reader. It returns verified/corrected lines and totals separately from
  pending games, so an opponent-pending entry cannot affect displayed totals.
  The protected server-rendered card has grouped Game and Spread Points
  headers, separate plus/minus columns, opponent name and ID, fixed totals,
  Games Won, Net Spread Points, and the approved pending-total warning.
  Disposable and pilot catalogs confirm the intended grants and binding. A
  complete disposable registration-to-seating fixture now proves an
  authenticated player receives only their verified card and an unlinked
  signed-in player receives none. Real independent browser sessions and
  phone/desktop rendering remain release gates.
  The Vercel Preview for code commit `5f97bf4` is Ready and returns `200 OK`
  for the public landing page; hosted signed-in scorecard interaction is still
  unverified.
  See `docs/quality/2026-09-10-player-scorecard-reader.md`.

## 2026-09-10 scorecard verification-status correction

- Corrected a future-game false alarm in the protected scorecard. A scheduled
  game with no entry now leaves the card `Current and Verified`; only a
  submitted result, pending confirmation, or mismatch shows an incomplete
  verification state and total warning. The approved opponent-entry wording
  remains exact for the one-submission state. The 117-test suite, lint,
  production build, recovery checks, and diff check pass. See
  `docs/quality/2026-09-10-scorecard-verification-status.md`.

## 2026-09-10 live game-number label correction

- Corrected the live entry and review screens to label the scorecard's
  sequential `roundNumber` as `Game N`, rather than displaying the internal
  match-instance number as the game number. This preserves the separate,
  dynamic Table/Seat and permanent verification-ID meanings while keeping the
  current game clear. The 117-test suite, lint, production build, and local
  verification checks pass. See
  `docs/quality/2026-09-10-live-game-number-label.md`.

## 2026-09-10 live score-entry skunk aid parity

- The protected player score-entry route now shows the approved visual aid for
  a valid skunk result: one, two, or three skunk icons with `Skunk`, `Double
  skunk`, or `Triple skunk`. It uses the already-tested score derivation and
  changes no stored record or official scoring terminology. It now also shows
  the requested two-player result preview before submission: both outcomes,
  Game Points, and signed Spread Points. Regression coverage asserts the live
  route retains all three labels, passes the derived skunk level directly to
  the rendering helper, and displays the two-record preview. The approved
  non-authoritative `Review Result` → `Review Current Game Result` → `Edit
  Result` path now exists before first submission; a persisted retry remains
  immutable. Phone/desktop browser visual evidence remains a release gate.

## 2026-09-10 live score-entry permanent verification ID

- Closed a production-screen gap between the approved score-entry layout and
  the protected live route. Migration `0087` returns the permanent ID already
  derived from immutable post-closure initial seating for only the two assigned
  players; it does not expose internal roster/profile identifiers or conflate
  the ID with the current Table/Seat snapshot. It was applied first to
  disposable synthetic project `donfxulkliuyteiannir`, then pilot
  `fnjkwymxpnsqvxtpronk`. Catalog evidence confirms `SECURITY DEFINER`, an
  empty search path, no anonymous grant, and both exact ID bindings. Local
  tests, lint, and production build pass. Preview deployment
  `dpl_3aDji61rr3RoRWwSvsxt2PB3REyF` is Ready from the change and has no recent
  Vercel runtime-error cluster. A seeded, independent-session live context and
  phone/desktop visual check remain required. See
  `docs/quality/2026-09-10-live-score-entry-verification-id.md`.

## 2026-09-10 doubles source-boundary review

- Reviewed the 2025 ACC Rulebook Appendix B directly. Traditional and Canadian
  Doubles are real distinct rule variants, not two singles cards: the source
  assigns seats to teams, permits multiple rotations, uses a four-player
  cut-for-deal, and adds Canadian hand-configuration rules. The app's
  existing Standard Singles boundary is therefore retained and the ACC
  confirmation checklist now records the doubles source review. A team data,
  scoring, verification, standings, qualification, and reporting fixture set
  is still required before digital team scoring can be enabled.

## 2026-09-10 scorecard leading-zero format correction

- The current 2025 ACC Rulebook source review identified a small paper-card
  display convention missing from the prototype: each populated single-digit
  per-game spread must render as `01` through `09`. The shared score helper
  now applies this convention only to individual paper-style card cells;
  stored values and totals remain integers. Regression coverage rejects invalid
  display inputs. Local checks pass: **115 tests**, lint, production build,
  workspace and private-handoff verification, dependency audit, and diff
  check. Browser visual verification is still an explicit release gate because
  the available browser bridge timed out. See
  `docs/quality/2026-09-10-scorecard-leading-zero-format.md`.

## 2026-09-10 ACC public rule-source review

- Verified current public ACC sources for the 2025 Rulebook, cross-checking,
  one-in-four qualification rounded up, playoff byes, 0/2/3 game points, and
  the qualifying tie-break order. The source record explicitly separates this
  evidence from the still-unconfirmed event, payout, reporting, and official
  digital-record decisions; no finalization logic is enabled from incomplete
  sources. The review also corrected the judge-escalation requirement: a third
  judge may be summoned when a player disagrees with the first two judges'
  decision, rather than only when those judges disagree. See
  `docs/quality/2026-09-10-acc-public-rule-source-review.md`. The same review
  added the narrow Rule 11.4 post-lunch and Rule 13.1 playoff absence/forfeit
  fixtures to the production requirements without inventing broader rotation
  or replacement policy.

## 2026-09-10 hosted registration lifecycle audit

- Rechecked the actual pilot function grants and migration history for
  registration-link issue/rotate/close/read and tournament registration
  closure. The functions are service-only, have no anonymous or authenticated
  execution grant, use an empty `search_path`, and the pilot includes all
  current local migrations through `0086`. The review found no new P0/P1
  defect in that boundary. The current 114-test suite, lint, production build,
  recovery/handoff checks, dependency audit, and diff check all pass;
  independent browser/race evidence remains a release gate. See
  `docs/quality/2026-09-10-registration-lifecycle-hosted-audit.md`.

## 2026-09-10 meta release-readiness review, cycle 2

- Completed a fresh requirement-by-requirement meta review after the focused
  score-confirmation and payment-surface repairs. It records the executable
  checks, disposable/pilot database evidence, hosted Preview limitations,
  advisor interpretation, two repaired future-risk paths, and every
  non-waivable production blocker. No P0/P1 defect remains in the implemented
  paths reviewed in this cycle; the application is still not production-ready
  because major required operations and real-world verification remain
  incomplete. See
  `docs/quality/2026-09-10-meta-release-readiness-cycle-2.md`.

## 2026-09-10 legacy payment-recovery execution retired

- A permissions review found a safe but unused older payment-reconciliation
  function still callable by signed-in directors. Migration
  `0086_retire_legacy_payment_reconciliation_execute.sql` removes that
  unnecessary browser-facing surface; the current identity-bound recovery
  reader remains the sole active route contract. No payment, roster, or
  eligibility data is changed. See
  `docs/quality/2026-09-10-retire-legacy-payment-recovery.md`.

## 2026-09-10 duplicate score-confirmation retry repair

- A disposable live database test found that the existing unique database
  guard prevented a duplicate player confirmation but exposed raw PostgreSQL
  `23505` rather than a controlled retry response. Migration
  `0085_duplicate_confirmation_conflict_repair.sql` now converts only the
  known same-game/same-player confirmation constraint into an immutable,
  audited `duplicate_confirmation` rejection; unrelated database errors still
  fail loudly. It was applied first to disposable synthetic project
  `donfxulkliuyteiannir`, where the exact rejection left one pending
  confirmation and no scorelines, then a distinct player's confirmation
  verified the game. The identical migration is applied to pilot
  `fnjkwymxpnsqvxtpronk`. A focused high-risk review also caught and the
  working tree fixes the matching API-validator omission, so the client
  receives the intended controlled `409` rather than a generic `503`. Local
  tests: **114 passed**. See
  `docs/quality/2026-09-10-score-confirmation-retry-repair.md`.

## 2026-09-10 working delivery outline

- Added `docs/operations/WORKING_OUTLINE.md` as the single living delivery
  tracker. It records completed dates, evidence-based status, explicit
  definitions of done, dependencies, and conservative pilot/production
  estimates. The user can request `Show Outline` at any time for this tracked
  view. It does not relabel a prototype or partial backend as a completed
  production milestone.

## 2026-09-10 ACC rule confirmation checklist

- Added `docs/operations/ACC_RULE_CONFIRMATION_CHECKLIST.md`, separating
  public authoritative-source verification (Codex work) from the limited
  policy, permission, portal, retention, and payment decisions that only ACC
  or a tournament authority can make. It gives the user a minimal five-item
  request list and keeps every app rule tied to a dated source and fixture.

## 2026-09-10 protected seating closure-state and director control

- Migration `0083_seating_workspace_registration_status.sql` adds only the
  authoritative `registrationClosed` boolean to the existing scoped seating
  workspace read. It was applied to disposable synthetic project
  `donfxulkliuyteiannir` before pilot `fnjkwymxpnsqvxtpronk`. Disposable
  execution proves the assigned synthetic director sees the closed state,
  while unauthenticated and unrelated authenticated callers receive no
  workspace. Pilot catalog confirms an empty search path, `SECURITY DEFINER`,
  no anonymous execute grant, and authenticated execution guarded by the
  function's director/co-director check.
- The protected director Seating screen now saves a recoverable, exact
  registration-close request and requires explicit attendance confirmation
  before it calls the already service-only close route. It disables check-in
  after closure and does not allow permanent initial-seating publication until
  closure succeeds. Local lint, 111 tests, and production build pass. Real
  signed-in phone/desktop and independent-session browser evidence remain
  required before release.

## 2026-09-10 check-in registration-closure server guard

- Independent high-risk review found that client-only attendance locking was
  insufficient: a stale or custom authenticated request could otherwise
  change check-in after registration closure. Migration
  `0084_check_in_registration_closure_guard.sql` fixes this in the actual
  check-in RPC. It shares the registration lifecycle lock, reconciles an exact
  prior receipt before evaluating current status, and records any new
  post-closure request as an auditable `registration_closed` rejection.
- It was applied and executed first in disposable project
  `donfxulkliuyteiannir`, where the rejection and exact replay left exactly one
  receipt and one audit record, then applied to pilot
  `fnjkwymxpnsqvxtpronk`. Pilot catalog confirms no anonymous execute grant,
  `SECURITY DEFINER`, and an empty search path. Real independent-connection
  race and signed-in-browser evidence remain release gates.

## 2026-09-10 atomic tournament-registration closure

- Added one service-only, director/co-director-authorized operation that
  atomically closes tournament registration and disables the current issued
  QR registration link under the same lifecycle lock used by claims, rotation,
  and manual link closure. Exact retries return their immutable receipt; a
  changed operation-ID reuse is a durable conflict. The protected HTTP
  boundary is same-origin, session-checked, bounded, and never returns QR
  credential material. Migration `0082` was applied first to disposable
  synthetic project `donfxulkliuyteiannir` and then pilot
  `fnjkwymxpnsqvxtpronk`; catalogs confirm browser roles cannot execute it and
  service role can. Local lint, **111** tests, and production build pass. An
  independent high-risk review found no P0/P1 implementation defect. See
  `docs/quality/2026-09-10-atomic-registration-close.md`. Public registration
  remains disabled. Seeded disposable execution now proves active-link and
  no-link closure, exact replay, reused-operation rejection, and direct
  browser-role denial; independent connection races, protected-browser
  evidence, and a director UI remain release gates.

## 2026-09-10 registration-link rotation compare-and-swap

- Replaced the unsafe rotation function with a server-only, exact
  link-ID/version compare-and-swap transaction. It retires only the active
  link an official read, creates one replacement, preserves durable retry and
  rejection evidence, and returns a raw replacement credential only once.
  Migration `0080` was applied to disposable synthetic project
  `donfxulkliuyteiannir` before pilot `fnjkwymxpnsqvxtpronk`; the disposable
  catalog confirms browser roles cannot execute it. Follow-up migration
  `0081` ensures an exact retry hashes only stable director intent, not fresh
  private credential material; the adapter also requires the receipt version
  to advance exactly once before it releases the credential. An independent
  high-risk review found no remaining P0/P1 issue after those repairs. The
  protected rotation route is release-gated and same-origin/session checked.
  Local lint, **110** tests, a production build, workspace verification, and
  private-handoff verification pass. See
  `docs/quality/2026-09-10-registration-link-rotation-compare-and-swap.md`.
  Public registration remains disabled; real lifecycle-race and browser proof
  remain release gates.

## 2026-09-10 registration-link close head-presence repair

- A close-transaction review found that a malformed historical state with a
  link but no registration-link head could encounter nullable comparisons
  rather than an explicit rejection. Migration `0079` now records both locked
  lookup outcomes and fails closed unless the exact head and link are present.
  It was applied first to disposable synthetic project
  `donfxulkliuyteiannir` and then to pilot `fnjkwymxpnsqvxtpronk`; both
  catalogs confirm browser roles cannot execute the function and service role
  can. See
  `docs/quality/2026-09-10-registration-link-close-head-presence-repair.md`.
  The public-registration release switch remains disabled; real seeded
  concurrency and browser evidence remain release gates.

## 2026-09-10 registration-link close compare-and-swap

- Replaced the unsafe close operation with a service-only compare-and-swap
  transaction. It accepts the expected link ID and head version, reauthorizes
  the current official under the lifecycle lock, preserves an exact immutable
  retry receipt, records first safe rejections, and cannot close a replacement
  link from a stale screen. Migration `0078` was applied first to disposable
  synthetic project `donfxulkliuyteiannir`, whose catalog confirms no browser
  role can execute it, then to pilot `fnjkwymxpnsqvxtpronk`. Local lint,
  **103** tests, production build, workspace verification, private-handoff
  verification, and diff validation pass. The director route/UI, rotation
  transaction, real concurrency matrix, and atomically closing links when
  tournament registration closes remain active release gates.

## 2026-09-10 bounded registration-link request boundary

- Registration-link issue requests now require a bounded JSON body before
  parsing. The shared reader rejects non-JSON, malformed, declared-oversize,
  and actual-oversize bodies; it is the required boundary for the forthcoming
  rotate and close routes as well. Executed tests cover all rejection paths.
  Local lint, **101** tests, production build, workspace verification,
  private-handoff verification, and diff validation pass. The rotate/close
  database lifecycle itself remains an active release-blocking implementation
  item under its reviewed compare-and-swap contract.

## 2026-09-10 registration-link expired-state repair

- Follow-up independent review found that an expired link could still be
  described as expired after its tournament registration had closed. Migration
  `0077` now reports `expired` only while every other open/eligible lifecycle
  condition holds; every unavailable combination is `closed`. It was applied
  first to the disposable synthetic project and then to pilot, where catalog
  checks confirm browser roles cannot execute the reader and the service role
  can. Local lint, **99** tests, production build, workspace verification,
  private-handoff verification, and diff validation pass. A seeded
  disposable-backend outcome matrix and real concurrent service-role/browser
  evidence remain release gates. See
  `docs/quality/2026-09-10-registration-link-timestamp-and-state-repair.md`.

## 2026-09-10 registration-link timestamp and state repair

- An independent lifecycle review found two release-critical issues before
  activation: PostgreSQL timestamp serialization could make a valid newly
  issued one-time credential appear ambiguous, and the director state reader
  could call a disabled, retired, or registration-closed link open. The issuer
  now compares instants rather than timestamp text. Migration `0076` makes the
  reader fail closed unless the current issued, enabled link and tournament
  registration are all open; it was applied first to the disposable synthetic
  project and then to pilot. Local lint, **98** tests, production build,
  workspace verification, private-handoff verification, and diff validation
  pass. This repair was superseded by the tighter `0077` expired-state
  condition above; rotate/close controls and real concurrent
  service-role/browser evidence remain required. See
  `docs/quality/2026-09-10-registration-link-timestamp-and-state-repair.md`.

## 2026-09-10 registration-link state reader

- Added a narrow, release-gated director/co-director state read so an
  ambiguous QR-link issuance can be reconciled without exposing link secrets,
  salts, digests, claims, or player data. Migration `0075` was applied first
  to the disposable synthetic project and then to pilot. Local lint, **96**
  tests, production build, workspace verification, private-handoff
  verification, and diff validation pass. Rotate/close controls plus real
  service-role/browser lifecycle evidence remain required. See
  `docs/quality/2026-09-10-registration-link-state-reader.md`.

## 2026-09-10 registration-link conflict and retry repair

- The release gate now covers director link issuance as well as public
  redemption. Expected lifecycle conflicts are durable database outcomes
  rather than rolled-back exceptions, and a lost one-time credential cannot
  be recreated or returned by a retry. Migration `0074` was applied to the
  disposable synthetic project before the pilot. Local lint, **95** tests,
  production build, workspace verification, private-handoff verification, and
  diff validation pass. Real transaction/concurrency, director lifecycle UI,
  hosted-secret, and browser proof remain required. See
  `docs/quality/2026-09-10-registration-link-conflict-repair.md`.

## 2026-09-10 registration credential lifetime repair

- A lifecycle review found that the fragment credential was removed from the
  URL and browser global but could remain in client component state after a
  rejected request or navigation. A focused independent re-review then caught
  that this also risked BFCache retention. The form now holds only a boolean in
  React state, keeps the raw value exclusively in a short-lived private ref,
  and clears it on every response, abort, `pagehide`, and unmount; in-flight
  requests are aborted during navigation. It still uses no browser storage and
  public registration remains release-gated. Local lint, **92** tests,
  production build, and diff validation pass. Real-browser
  history/BFCache/network evidence remains a release gate. Hosted Preview
  deployment `dpl_5TzYi1Z1VGYcyuTezWmCVKtham3L` is Ready for commit `194e1db`;
  its protected `/register` response is `200` with the expected nonce and
  no-store protections, and Vercel reports no recent route runtime errors.
  See
  `docs/quality/2026-09-10-registration-credential-lifetime-repair.md`.

## 2026-09-10 registration fragment CSP repair

- A hosted response review caught that the prior static `/register` Content
  Security Policy would block Next.js's own inline bootstrap/hydration scripts.
  It has been replaced with a dynamic, per-request nonce policy forwarded by
  the proxy; the registration route is explicitly dynamic so Next.js can
  attach that nonce to its genuine scripts. The Supabase session proxy
  preserves the forwarded nonce headers when it refreshes cookies. Local lint,
  **92** tests, production build, and diff validation pass. Preview deployment
  `dpl_9yrytFUec294HqwXN3Xoep7yEFoR` is Ready and its live response confirms
  matching nonce-bearing scripts, restrictive production directives, no-store
  caching, and no `/register` runtime-error cluster. Real browser lifecycle
  and independent-session proof remains required before the registration gate
  can be enabled. See
  `docs/quality/2026-09-10-registration-fragment-csp-repair.md`.

## 2026-09-10 fragment-only registration browser handoff

- Added the release-gated `/register` page and a self-hosted pre-hydration
  bootstrap script. It validates and removes a `link-id.secret` fragment from
  the address bar before the app hydrates, holds it only briefly in memory,
  then deletes it before submission. It uses no local/session-storage. Its
  nonce-based restrictive content policy is recorded separately above.
- Lint, **92** tests, and the production build pass. Real browser network,
  history/BFCache, error-path, and independent-session proof still remain
  mandatory before enabling public registration.

## 2026-09-10 public registration redemption release gate

- Added the server-side claim boundary needed for fragment-only registration,
  but it is hard-disabled unless the separate exact environment setting
  `ACC_PUBLIC_REGISTRATION_V2=enabled` is deliberately supplied. It parses the
  credential only in the application server and sends the database only the
  derived fixed-length digest. Unknown, malformed, expired, and disabled
  paths return a generic unavailable result.
- Lint, **91** tests, and the production build pass. This does not add a
  public browser page or authorize activation; security headers, fragment
  handling, hosted secret configuration, and real browser lifecycle evidence
  are still mandatory.

## 2026-09-10 protected registration-link issue route

- Added a strict same-origin, claims-checked director issue route. It accepts
  only bounded issuance inputs, uses the server-only client, and returns a
  credential only after an exact private receipt. Without the required server
  secret it fails closed as unavailable; no public redemption route exists.
- Lint, **90** tests, and the production build pass. Hosted secret
  configuration and real transaction/browser evidence remain required.

## 2026-09-10 server-only registration issuer adapter

- Added a tested server-only issuer adapter that generates the supplied v2
  link ID, derives fixed-length salt/digest values, sends PostgreSQL bytea
  values to the private RPC, and returns a credential only after an exact
  matching issued receipt. The raw secret is never an RPC argument. This is a
  foundation for the future authenticated director route, not a public route.
- Lint, **89** tests, and the production build pass. A configured hosted
  server key and real service-role transaction remain required.

## 2026-09-10 registration issuer-supplied ID repair

- The review caught and corrected a critical v2 issuance mismatch: a QR
  credential’s ID must exist before its digest is calculated, so migration
  `0073_registration_link_issuer_supplied_id` replaces the old
  database-generated ID with a server-supplied opaque UUID. The ID is bound
  to the digest fingerprint, header insert, and receipt. The disposable
  database catalog confirmed only the corrected issue/rotate signatures,
  with browser roles denied; the correction then applied to the pilot.
- There were zero issued v2 links, so no link was disrupted. Server-only
  routes, a configured secret, and real lifecycle/browser evidence remain
  required. See
  `docs/quality/2026-09-10-registration-link-issuer-supplied-id-repair.md`.

## 2026-09-10 registration invalid-digest pre-lock repair

- Migration `0072_registration_claim_invalid_digest_prelock_rejection` now
  rejects an unknown or incorrect registration digest before it obtains the
  per-tournament advisory claim lock, while retaining the authoritative
  locked-state/digest recheck for close and rotate races. It was applied to
  the disposable synthetic database first and then the pilot; catalog proof
  confirms browser roles remain denied and only `service_role` can execute it.
- Local lint, **86** tests, production build, workspace verification,
  private-handoff verification, and diff validation pass. No v2 public route
  or server key is configured, so a service-role transaction test, browser
  canary, and independent-user evidence remain release gates. See
  `docs/quality/2026-09-10-registration-invalid-digest-prelock-repair.md`.

## 2026-09-10 meta release-readiness delta review

- Rechecked the current branch against the normative production requirements,
  not merely its Preview. The legacy registration surface and a paper-evidence
  retention-document conflict are closed, but secure v2 registration,
  independent user sessions, official operations/rules, offline/hybrid,
  OCR/storage, results/finance/export/finalization, and recovery/accessibility
  evidence remain non-waivable release blockers. See
  `docs/quality/2026-09-10-meta-release-readiness-delta.md`.

## 2026-09-10 secure registration-link v2 schema boundary

- Applied migration `0071_secure_registration_link_lifecycle_v2` to the
  disposable synthetic database first and then to the pilot after a zero-link,
  zero-claim aggregate preflight. It adds retired-v1 history linkage, v2
  salt/digest headers, immutable lifecycle/conflict evidence, a locked active
  head, and five service-role-only database functions. Catalog evidence in
  both environments proves the new functions deny browser roles and no v2 or
  enabled link exists.
- This is intentionally not a public-registration release. Routes, secret-key
  configuration, real service-role transaction evidence, fragment/network
  canaries, and independent browser sessions remain required before a v2 link
  can be opened. Preview deployment `dpl_68GdZV6r4QcgGfJBL5SZmB1Fxyeq` built
  commit `cb6866f` successfully with no subsequent runtime-error cluster. See
  `docs/quality/2026-09-10-registration-link-v2-schema-boundary.md`.

## 2026-09-10 legacy registration-token surface retired

- Migration `0070_retire_legacy_public_registration_surface` disables every
  legacy link, verifies legacy claim/link coherence, revokes and drops the two
  anonymous legacy registration RPCs, and never deletes historical claims.
  The obsolete path-token page, API route, and client helper have been removed
  from the application.
- It was applied and aggregate-checked first in the disposable synthetic
  project and then in the pilot: both have zero legacy links, zero enabled
  links, zero incoherent claims, and no remaining legacy RPC. The advisor no
  longer reports anonymous executable functions. Public registration is
  deliberately unavailable until the separately designed fragment-only v2
  lifecycle is fully implemented and independently tested.
- Vercel Preview deployment `dpl_2iWed624oBafxNrjsR8Cp9eBPagg` reached
  `READY`; its former `/register/[token]` path returns an application 404 and
  Vercel reported no runtime-error cluster in the following check.

## 2026-09-10 registration-link token boundary

- Added a server-only v2 registration-link credential primitive: it produces
  a 256-bit URL-safe secret only as `link-id.secret`, rejects URL/path/query
  and malformed shapes, derives only a 32-byte salted digest for database use,
  and uses constant-time equality for fixed-length digests. It is covered by
  three positive/rejection tests and does not itself open or change public
  registration. Migration `0070` separately retired the unsafe legacy
  path-token surface; this primitive is not yet a complete v2 lifecycle.

## 2026-09-10 Supabase advisor recheck

- Fresh pilot and disposable-database advisor scans found no new direct
  browser data exposure. After migration `0070`, neither reports an anonymous
  executable function; 31 reviewed authenticated RPCs remain. The secure
  fragment-only registration replacement is still required before public
  signup can be enabled.
- The current advisor emits 13 INFO-level unindexed-foreign-key notices; this
  corrects an earlier inaccurate zero-notice statement. Catalog inspection
  confirmed each has equivalent existing leading unique/index coverage, so no
  redundant index was added. Empty-database unused-index notices remain
  non-actionable until representative-load testing.

## 2026-09-10 dependency and repository-history security audit

- A fresh production dependency audit found no known high-severity production
  dependency vulnerability. A credential-safe scan of every reachable commit
  found no GitHub-token, Supabase-secret-key, AWS-key, or private-key-shaped
  value outside preserved private source material. This evidence does not
  replace secret scanning for future commits or hosted-service controls.

## 2026-09-10 review-prototype production boundary

- The review dashboard at the root route uses synthetic tournament, player,
  scoring, and financial data. It remains available for the ongoing protected
  Preview format review, but a Vercel Production deployment, the default
  production hostname, an unlisted custom hostname, or a production-like build
  now returns a not-found response before that dashboard renders. The guard
  reads the actual request host so a previously built Preview deployment also
  remains safe if it is later promoted without a rebuild. This prevents an
  accidental deployment from presenting review controls as live tournament
  operations.
- Local lint, 82 application tests, production build, workspace verification,
  and private-handoff verification pass. This is a deployment-safety control,
  not a release claim: authenticated multi-user evidence and the other listed
  release gates remain open.

## 2026-09-10 CI action-runtime compatibility repair

- GitHub Actions reported that the clean-clone `Verify` workflow still used
  Node-20 action wrappers, which GitHub was temporarily forcing onto Node 24.
  The workflow now uses `actions/checkout@v7`, `pnpm/action-setup@v6`, and
  `actions/setup-node@v6`, with an executable regression check to prevent a
  downgrade.
- GitHub run `34430545807` passed all frozen-install, production-audit, lint,
  test, build, and workspace-verification steps on commit `1bbc496`, without
  the preceding deprecated-runtime annotation.

## 2026-09-10 public registration release posture

- The unsafe legacy public-registration route and anonymous database surface
  have been retired without disrupting an active link. The app intentionally
  has no public signup surface at present. A secure fragment-only v2 lifecycle
  (issue, rotate, close, claim, audit, browser/network canary, and independent
  user tests) is still required before public registration can be enabled.
- The hosted Email/Password-provider setting is a separate dashboard-only
  release blocker; no unsupported browser change was attempted.

## 2026-09-10 controlled score-duplicate race repair

- An independent high-risk review found that a same-player concurrent score
  submission with a different operation ID could lose a unique-index race as a
  generic server error rather than a controlled, auditable conflict. Migration
  0069 handles only the known score-submission uniqueness constraints and
  records the losing attempt as `duplicate_submission`; unrelated database
  errors still fail visibly.
- Only the private submission API recognizes that exact rejection shape as a
  409 for the requested game, allowing only the affected submission-retry
  envelope to clear rather than being retried indefinitely. Confirmation,
  wrong-game, or expanded payloads still fail closed as unavailable.
- The repair was exercised first on the disposable synthetic test database and
  then applied once to the separate pilot database. Pilot catalog verification
  confirms the migration/function mapping, denies anonymous execution, and
  retains only the intended signed-in execution path. A true two-request race
  on the disposable database produced exactly one accepted score, one
  rejected receipt, one conflict record, and no false verification. The
  complete two-player score/confirmation path also verified reciprocal +31/-31
  scorelines and 3/0 game points. Real independent browser-session evidence
  remains a release gate.

## 2026-09-10 paper-scorecard scan/OCR requirement

- The product baseline now requires an authorized, restricted paper-card
  capture and OCR-assisted comparison workflow for cross-checking. It may
  accelerate paper/digital and paper/paper review, but cannot replace assigned
  player entries/confirmations or auto-verify a score. Its evidence follows
  the already-approved restricted-hold/no-automatic-purge baseline; provider,
  storage/RLS, browser-permission, and false-read controls remain explicit
  implementation gates.

## 2026-09-10 disposable database test environment

- The owner approved use of the otherwise empty existing Supabase project as
  a no-cost disposable test environment; it is separate from the ACC pilot
  and contains no copied pilot or player data. The then-current full
  `0001`–`0068` migration chain applied successfully there. Later reviewed
  work has subsequently been exercised there; the shared pilot's distinct
  current baseline is recorded at the top of this file and in
  `docs/operations/PILOT_MIGRATION_CHANGE_CONTROL.md`.
- Catalog verification found the intended boundary: 40 private `app` tables
  all have RLS, no private-table policy or private-function browser grant
  exists. After migration `0070`, only the reviewed 31 authenticated RPCs are
  executable; the anonymous legacy registration RPCs have been removed.
  Supabase advisor findings match the
  existing private-RLS/RPC-only model; unused-index notices are expected on an
  empty test database.
- The environment is now available for synthetic authorization, concurrency,
  and transaction evidence. It does not clear browser, identity-provider,
  results/finance, offline, recovery, or simulated-tournament release gates.

## 2026-09-09 API cache-boundary regression guard

- A manual API-route audit found no current no-store bypass. To prevent future
  drift, a route-discovery test now requires every API v1 route to use the
  private response boundary; the proxy remains the same-origin mutation gate.
- Lint, 79 application tests, production build, workspace/private-handoff
  verification, and diff validation pass. Hosted authenticated API evidence is
  still a separate release gate.

## 2026-09-09 dependency-audit CI safeguard

- GitHub's hosted Dependabot, Code Scanning, and Secret Scanning alerts are
  unavailable/disabled for the current private repository configuration. The
  repository was not exposed and no plan was changed. The clean-clone `Verify`
  workflow now runs a high-severity production dependency audit after frozen
  installation, before all existing checks.
- The audit found no known production dependency vulnerability. Lint, 78
  application tests, production build, workspace/private-handoff verification,
  and diff validation pass. Independent GitHub Actions run `34409826764` also
  passed the new audit step and all clean-clone checks.

## 2026-09-09 touch-target and keyboard-focus accessibility repair

- A style review found 38px seating-sort and 42px event-tab controls, below
  the agreed 44px primary-touch minimum, and no explicit keyboard focus ring.
  Both are corrected: the controls are 44px minimum and all interactive
  keyboard targets use a clear 3px offset focus indicator; score-entry
  winner/keypad controls remain 56px minimum.
- Lint, 78 application tests, production build, workspace/private-handoff
  verification, and diff validation pass. Authenticated phone/desktop/zoom
  and assistive-technology checks remain required release evidence.

## 2026-09-09 Vercel configuration recheck

- Vercel now explicitly reports Next.js and Node 24 for the project and the
  current branch deployment. Commit `fc616ee` built as Ready Preview with a
  healthy branch alias, `live: false`, and no grouped runtime errors in the
  preceding day. The earlier framework auto-detection uncertainty is no longer
  an active configuration concern.

## 2026-09-09 CI and branch-protection audit

- The clean-clone `Verify` workflow is healthy: its latest current-branch
  GitHub Actions run `34408978018` passed after the security-header evidence
  update. It pins the intended Node/pnpm versions and runs install, lint,
  application tests, production build, and clean-clone verification.
- GitHub's branch-protection API confirmed that enforceable protection is not
  available for this private repository on the current plan. This is a release
  governance gap, not a reason to expose the repository publicly. Until an
  owner changes that plan/policy, every production-candidate commit must carry
  an independently recorded successful workflow run and review.

## 2026-09-09 site-wide browser-security headers

- Closed a browser-level defense gap: every Next.js-served route now rejects
  framing and MIME sniffing, suppresses referrers and DNS prefetch, and denies
  unused camera, location, microphone, payment, and USB capabilities. The
  intentionally strict referrer policy also protects current and future
  bearer-style link flows without changing their server authorization rules.
- Lint, 77 application tests, the production build, workspace/private-handoff
  verification, and diff validation pass. Vercel deployment
  `dpl_E6vKfZYGrafvbiZUm7dwsAAkFCmP` is Ready and returned each exact expected
  header. This does not alter the larger non-waivable release blockers.

## 2026-09-09 local production-build exposure audit

- A release-exposure scan found no tracked credential, private handoff source,
  server-only Supabase module reference, server secret environment identifier,
  or secret-key-shaped value in the local production browser bundle. Public
  files are limited to the approved logo, permitted Rulebook copy, and an
  anonymized sample PDF; local `tmp/` remains untracked and untouched.
- This evidence is deliberately limited to the local build. Future hosted
  telemetry, registrations, and environment changes still require their own
  platform/browser checks; the fragment-only registration QR lifecycle remains
  an unimplemented, test-environment-gated feature.

## 2026-09-09 registration-link lifecycle design repair

- A production audit found that the public registration claim flow lacked the
  director workflow needed to safely issue, rotate, close, and audit its QR
  link. The approved replacement contract requires server-only privileged
  lifecycle operations, immutable historical headers/events plus one locked
  active head, composite claim/link provenance, exact replay safety, shared
  claim/close/rotate locking, and a one-time director QR display.
- Focused Sol review initially found eight P1 gaps, including hosted path-token
  leakage, lifecycle-state ambiguity, close/claim races, legacy migration,
  token custody, and issuer-side QR handling. The final contract closes them:
  v2 links use fragment-only `link-id.secret` values, random per-link salt plus
  SHA-256 rather than a shared secret, and no token-in-path route; the pilot
  migration must atomically close legacy links and remove/revoke old token-path
  surfaces before opening v2. The final re-review has no P0/P1 findings.
- This is not implemented or applied. A disposable database chain, staged
  rollout, two-connection race tests, catalog-grant proof, and real
  browser/platform raw-token scans are mandatory before the feature may touch
  the pilot.

## 2026-09-09 production Rulebook reference route

- Closed a production continuity gap: Start Here had instructed users to use a
  Rulebook area that existed only in the retired review prototype. Authorized
  tournament users now have a protected, searchable reference route linked
  from the workspace and Start Here, with separately labeled cached and online
  ACC Rulebook actions. The cached 2025 PDF hash was rechecked against the
  recorded approved source metadata.
- The quick reference is deliberately a navigation aid, not an ACC
  interpretation or rules engine. Local lint, 76 tests, and the Next.js
  production build pass. Authenticated phone/desktop visual evidence remains
  open, as do all authority fixtures and the broader release gates.

## 2026-09-09 full-build and live-pilot recheck

- A fresh full application test pass now has 75 passing checks and a successful
  Next.js 16 production build. The build enumerates the intended protected
  application routes and no new local compile, type, or test failure appeared.
- The connected Supabase pilot is `ACTIVE_HEALTHY` on PostgreSQL 17 and has
  applied migration `revoke_browser_roster_account_link`. Its current security
  advisor posture remains the intentionally private model: 40 forced-RLS/no-
  policy private tables, two narrowly public registration RPCs, and 31
  authenticated role-checked RPCs. The empty synthetic pilot's unused-index
  notices are not a reason to remove required integrity indexes before
  representative-load testing.
- No unexpected deployment or pilot drift was found. This does not clear the
  external hosted password-provider blocker or substitute for the missing
  multi-user, offline/hybrid, results/finance/finalization, ACC-fixture,
  recovery, accessibility, and simulated-event release gates.

## 2026-09-09 activation-link raw-value exposure hardening

- A forward-looking identity review found that a normal URL carrying a raw
  account-link activation could leak it through history, referrers, telemetry,
  request capture, or an authentication continuation. The strengthened
  activation contract now requires a fragment-only QR value, initial response
  no-referrer policy and restrictive route CSP, synchronous pre-hydration
  replacement with fail-closed behavior, no third-party or external activity
  for the raw value's entire in-memory lifetime, explicit same-origin no-store
  redemption, immediate variable clearing, and redacted diagnostics/audit
  fields. An unauthenticated player must sign in before reopening the link;
  the raw value can never cross the sign-in flow.
- This is a required implementation and real-browser/network-evidence gate for
  the future server-only activation workflow; no activation endpoint or raw
  value exists today. A focused Sol re-review found no remaining P0/P1 contract
  defect after the repairs. It specifically keeps implementation evidence open:
  real browser/network ordering, history/BFCache and failure behavior,
  unauthenticated reopen, service-worker absence, header/CSP inspection, and
  canary scans through platform and application diagnostics.

## 2026-09-09 raw profile-ID linking exposure closed

- Removed the unused browser route that accepted a director-supplied player
  profile ID for roster linking. This conflicted with the approved witnessed
  activation ceremony and could have linked the wrong account if an ID were
  known. Applied pilot migration `revoke_browser_roster_account_link` now
  denies `anon` and `authenticated` execution of both roster-link writers,
  while retaining server-role internal execution for the future server-only
  activation transaction.
- Independent Sol review found no P0/P1 implementation defect and required
  the live permission check before release. Catalog proof confirms the link
  v1/v2 functions deny browser roles; the separate enrollment v2 function
  still permits authenticated officials and denies anonymous callers. Fresh
  disposable-chain and real authenticated-browser evidence remain open.

## 2026-09-09 live advisor and report-consistency recheck

- A fresh read-only security-advisor pass found no new private-table exposure:
  the 40 private RLS/no-policy notices, two public registration RPCs, and 31
  authenticated role-checked RPCs match the intentional pilot boundary. It
  reconfirmed the hosted password-provider release blocker.
- Corrected an older registration-pilot report that inaccurately described
  later lifecycle safeguards as unimplemented. Those guarded boundaries now
  exist but still require real independent-session and full-lifecycle proof.

## 2026-09-09 preview browser smoke evidence

- A browser smoke check exercised the public score-entry prototype through
  winner selection, a 99-point triple-skunk result, reciprocal game/spread
  output, and the pre-submission review screen. The current branch Preview
  correctly stops an anonymous visitor at Vercel sign-in; no access control
  was bypassed and no submission was sent.
- This is partial visual evidence only. Authenticated two-user, persisted
  backend, phone/zoom/accessibility, session-recovery, and offline tests stay
  open. See `docs/quality/2026-09-09-preview-browser-smoke.md`.

## 2026-09-09 score retry authentication-expiry repair

- A temporary expired browser session no longer clears the one exact pending
  score-entry envelope. The player must sign in again, then can retry only the
  original entry; request-validation, origin, and exact authoritative
  rejection paths still clear it. This prevents silent loss when the request
  may already have reached the server.
- Focused Sol review found no P0/P1 in the repair. Local lint, 74 tests,
  production build, workspace/private-handoff verification, and diff check
  pass. A browser/network test of an accepted request followed by a lost
  response, session expiry, and reauthentication remains a release-evidence
  gap.
- This remains foreground retry recovery, not offline scoring.

## 2026-09-09 offline score-sync design boundary

- Focused Sol review confirms that the current one-item session retry envelope
  is not an offline queue. It lacks durable actor/session binding,
  tamper-resistant capability protection, queued-confirmation safeguards, and
  replay reconciliation. It remains correctly limited to a foreground retry.
- The approved contract now requires a separate versioned IndexedDB queue,
  server-issued capability/device-key integrity, one audited atomic replay
  wrapper, and real two-session/reconnect evidence before offline scoring can
  be enabled. See `docs/decisions/2026-09-09-offline-score-sync-contract.md`
  and `docs/quality/2026-09-09-offline-score-sync-acceptance.md`.

## 2026-09-09 hosted password-provider release blocker

- A no-account probe using fake credentials found that the active Supabase
  pilot accepts a password grant and proceeds to credential validation. The
  app itself remains magic-link-only, but the provider-level password flow is
  enabled. This is a critical release blocker because it leaves an unreviewed
  authentication path outside the app UI. See
  `docs/quality/2026-09-09-password-provider-probe.md`.
- No account, player data, or secret credential was used. Disabling the hosted
  Email/Password provider requires an authorized dashboard or management API
  setting change, which this workspace has not performed.

## 2026-09-09 passwordless sign-in regression boundary

- Confirmed the application sign-in page uses only Supabase OTP/magic-link
  authentication, has no password input, and does not call password sign-in or
  sign-up APIs. Added a regression assertion that fails if any of those paths
  appears. The full local suite (74 tests), lint, production build, workspace,
  and private-handoff checks pass.
- The hosted Supabase password-provider setting could not be read because the
  browser-control connection timed out twice before it could inspect the
  already signed-in dashboard. It remains a non-waivable release verification
  item; this source-level guard does not claim to prove provider configuration.

## 2026-09-09 live pilot advisor recheck

- The active pilot is healthy and contains no result-draft migration. Its
  current advisor findings match the intentionally private-RLS/RPC-only access
  model; no new exposed-table defect was found. The recheck confirms that a
  future result writer must derive event ruleset/method, participant identity,
  and game facts from locked server records. It does not clear any release
  gate. See `docs/quality/2026-09-09-live-pilot-advisor-recheck.md`.

## 2026-09-09 result-draft integrity review repair

- A focused independent review found that the first local result-draft
  migration could mix an event with a different same-tournament ruleset,
  permitted an unsealed or partial manifest, and did not prove each snapshot
  scoreline belonged to its source game and exact participants. The private
  tables themselves were not browser-exposed, but the draft was removed before
  commit or database application because a numbered migration is not a safe
  place to defer those integrity controls.
- The approved result-draft contract and database acceptance gates now require
  an atomic, server-only writer that binds event/ruleset/method provenance,
  seals a canonical source manifest and blocker set, and rejects incoherent
  source facts. No pilot database, public result, export, qualifier, payout,
  or publication state changed in this repair.

## 2026-09-09 result-draft integrity foundation

- A focused Sol design review rejected a simplistic result/export record because
  event/ruleset references alone would silently change meaning after a score
  correction. The next results foundation is now constrained to a private,
  immutable source-manifest draft with explicit blocker evidence; it defers
  calculations, export artifacts, public publication, and finalization until
  their approved fixtures and reconciliation controls exist.
- The review also prohibits a parallel publication lifecycle: the existing
  immutable correction publication guard remains authoritative until a future
  append-only transition design can atomically replace every guard. See
  `docs/decisions/2026-09-09-event-result-draft-foundation.md`.

## 2026-09-09 server-only admin-client boundary

- Added a narrowly scoped, `server-only` Supabase admin-client helper for the
  future account-activation transaction. It rejects absent, blank, malformed,
  legacy, and public keys; accepts only the modern server-only key format; and
  disables session persistence, refresh, and URL session parsing. It is not
  imported by player/browser/session helpers or exposed through a route.
- A focused Sol design review found no P0/P1 in this unused boundary, provided
  all future callers independently verify the signed-in actor, role,
  tournament, and idempotency before a narrow private database operation. A
  synthetic-secret production build scan confirmed the secret canary and its
  environment-variable identifier are absent from `.next` output. Lint, 74
  tests, production build, workspace/private-handoff verification, and diff
  validation pass. The credential has not been provisioned and account
  activation remains intentionally unimplemented.

## 2026-09-09 current preview deployment check

- Pushed the verified `codex/production-readiness-baseline` branch through GitHub. Vercel created preview deployment `dpl_DQtqwboXBFEphehbYUoyC6PzcBax` for commit `1714b7c`; it is `READY` with the explicit Next.js framework, and its branch alias returned HTTP 200. The Vercel runtime-error scan found no errors in the selected one-hour window.
- This is only preview build/smoke evidence. It does not replace authenticated multi-user, mobile/browser, data-persistence, security, backup/restore, monitoring, or simulated-tournament release gates.

## 2026-09-09 server-only activation execution prerequisite

- Verified the current project configuration contains only public Supabase connection values; it has no server-only database execution identity. This is correct for current browser-session RPCs but insufficient for the reviewed activation feature, whose functions must not be callable by authenticated browsers.
- Recorded the required Vercel/server-only credential boundary in `docs/decisions/2026-09-09-server-only-database-execution.md`. No secret was requested, read, logged, or added. Activation implementation remains intentionally paused until its server-only boundary can be provisioned and proven.

## 2026-09-09 account-link activation implementation review

- A focused Sol review rejected the first local activation-migration draft before it reached any database. It found five P1 risks: a nested-link failure could commit a link without approval, the issuance retry fingerprint omitted its salt, authenticated browsers could directly execute the functions, concurrent officials could issue competing activations, and cancellation/rejection state was missing. The draft migration and its inadequate regex-only test were removed rather than applied.
- The activation contract and acceptance criteria now require a server-only execution identity, roster-scoped serialization, full cancellation/rejection lifecycle, and an exception-subtransaction rollback proof. A disposable database branch or equivalent executed database test is required before a replacement migration may touch the pilot.

## 2026-09-09 account-link activation review repair

- Focused independent review found two P1 design gaps in the planned account-link activation flow: bearer-token redemption alone cannot prove the intended person is present, and approval needed explicit inner-link idempotency/atomicity semantics. The contract now requires an in-person, one-time confirmation phrase and a single transaction that uses separate stable approval and link operation IDs, rolling back both on nested-link failure.
- The secure database/API implementation and its real multi-account tests remain open; no activation data path was exposed by this contract repair.

## 2026-09-09 seating print regression repair

- Repaired the protected seating workspace print stylesheet so the published seating assignments remain in the printed document. The earlier rule mistakenly hid the seating list along with interactive controls.
- Local lint, 73 tests, production build, workspace verification, private-handoff verification, and diff validation pass. Visual print-preview verification remains open because the available browser automation surface cannot access localhost.

## 2026-09-09 passwordless account bootstrap

- Repaired the account-creation gap required by the safe player activation flow. Magic-link sign-in now permits creation of a passwordless account, and migration `0067_passwordless_profile_bootstrap` creates/backfills only the required private profile row. It deliberately creates no tournament role, roster identity, event participation, seat, payment, or other authority. The migration is applied to the pilot: catalog evidence found zero auth users without a profile, zero orphan profiles, exactly one bootstrap trigger, and zero public/anonymous/authenticated execute grants for its internal function. Lint, 73 tests, production build, and diff validation pass locally; a real fresh-account browser test remains required before release.

## 2026-09-09 player-account-link activation gap

- The receipt-bound roster-account-link writer has no safe source for a director to obtain an authenticated player profile ID. A name/email/ACC-number lookup would violate the approved non-inference identity rule and could mislink a player. Recorded a director-issued, one-time activation-and-approval contract in `docs/decisions/2026-09-09-player-account-link-activation-contract.md`; no unsafe typed-ID interface was added.

## 2026-09-09 protected check-in and seating workspace

- Added the missing director/co-director operational screen for check-in and immutable initial seating. It reads only a narrow server-authorized workspace, records bounded status changes through the guarded API, prepares a complete starting Table/Seat plan, safeguards the one permanent publication with a confirmation, and provides a print view. One unresolved request is safely retained and retry-locked per actor/tournament; shared-device sign-out clears that recovery state.
- Local lint, 73 tests, production build, workspace verification, private-handoff verification, and diff validation pass. The real UI/browser and independent-session checks are not complete: localhost was blocked by the available browser surface and the browser automation binary is unavailable. The feature is not release-certified; round rotation, player delivery, offline/hybrid, results/finance/finalization/export, authoritative fixtures, and real-event proof remain open.

## 2026-09-09 hybrid guidance regression boundary

- Added regression coverage to ensure the protected Start Here guide keeps the required independent paper/digital entries, individual confirmations, and pending cross-check path explicit. Local lint and 72 tests pass.

## 2026-09-09 legacy lifecycle RPC exposure closure

- Removed a direct signed-in-browser bypass around the receipt-bound lifecycle API wrappers. Pilot migration `0066` revokes `authenticated` execution on the four superseded check-in, initial-seating, roster-account-link, and event-enrollment writers; their v2 `SECURITY DEFINER` wrappers remain the only callable application mutation boundary.
- Pilot catalog confirms legacy functions are unavailable to `authenticated`/`anon`, v2 wrappers remain authenticated-only, and unauthenticated v2 calls fail closed. Focused Sol review found no P0/P1. Lint, 71 tests, production build, workspace verification, and private-handoff verification pass. See `docs/quality/2026-09-09-legacy-lifecycle-rpc-exposure.md`.
- The refreshed meta audit records these closed lifecycle boundaries while keeping all full-product release blockers active; a Ready Preview or green CI is not treated as production certification.

## 2026-09-09 roster lifecycle API boundary

- Exposed the existing independent roster-account link and pre-seating Standard Singles enrollment transactions through strict same-origin, verified-claims, private/no-store application routes. Pilot migration `0065` provides current-official, exact-receipt wrappers so malformed, stale, cross-operation, missing-receipt, or role-revoked replies fail closed instead of becoming browser success or rejection messages.
- Local lint, 70 tests, production build, workspace verification, and private-handoff verification pass. Focused Sol review found no P0/P1 after receipt-binding regression coverage was strengthened. Pilot catalog and unauthenticated fail-closed checks pass. This closes an application boundary only; real account-link protocol/UI, independent sessions, and full tournament lifecycle evidence remain open. See `docs/quality/2026-09-09-roster-lifecycle-api-boundary.md`.

## 2026-09-09 check-in and initial seating API boundary

- Exposed director/co-director check-in and immutable initial-seating operations through strict same-origin, verified-claims, private/no-store application routes. Focused Sol review found that `0047` replies could not prove they belonged to the exact browser operation; four intermediate response-wrapper repairs were insufficient. Applied pilot migrations `0060`–`0064`; the final wrapper requires the caller's current official role, recomputes the 0047 request fingerprint, and returns only the caller/tournament/operation/target-scoped stored receipt before adding the submitted IDs. Its receipt lookup repeats the role predicate to avoid role-change replay races. It returns no actionable envelope if no receipt proves provenance or the role was revoked. The browser now rejects malformed IDs, states, reasons, capacity, Table/Seat assignments, duplicates, extra fields, and cross-operation backend reply shapes rather than passing them through.
- Local lint, 68 tests, and production build pass; pilot grants, wrapper security posture, empty historical receipt audit, and anonymous fail-closed behavior were checked. This is an API boundary, not an operational seating screen or proof of a real tournament lifecycle; the independent-session and end-to-end release evidence remains open. See `docs/quality/2026-09-09-check-in-initial-seating-api-boundary.md`.

## 2026-09-09 exact manual-payment response contract

- Manual payment record, void, and retry-recovery paths now accept only their exact migration-defined response shapes. Record and void rejection codes are distinct, so an opposite-operation response can no longer falsely clear a financial retry lock.
- Focused Sol review found one P1 in the initial response-shape repair and the operation-aware follow-up closed it; final review found no P0/P1. Lint, 65 tests, production build, and diff checks pass locally. See `docs/quality/2026-09-09-payment-response-contract.md`.

## 2026-09-09 exact correction response contract

- Correction proposal and review routes now accept only their exact, migration-defined response shapes and bind rejection replies to the requested game or correction. Extra/private fields, mixed shapes, unsupported codes, malformed versions, and cross-request replies fail closed instead of being returned to a browser.
- Pilot receipt-shape aggregation found no historical correction receipts needing compatibility handling. Focused Sol review found no P0/P1. Lint, 65 tests, production build, workspace/handoff verification, and diff checks pass locally. See `docs/quality/2026-09-09-correction-response-contract.md`.

## 2026-09-09 exact game accepted-response contract

- Standard Singles submission and confirmation handlers now return only the exact, documented accepted RPC fields. Extended, malformed, cross-game, cross-submission, or unsupported accepted responses fail closed rather than forwarding unexpected private data to the browser.
- Focused Sol review found no P0/P1. Lint, 65 tests, production build, workspace/handoff verification, and diff checks pass locally. This is API-boundary hardening only; authenticated two-user browser verification and the broader release gates remain open. See `docs/quality/2026-09-09-game-accepted-response-contract.md`.

## 2026-09-09 exact score retry recovery

- Repaired a focused review finding in the live Standard Singles client: an interrupted submission now preserves and locks one exact request rather than allowing a changed second request while the first may be unresolved. Stale local retry state never overrides an existing server submission, and unknown client/platform failures remain safely retry-locked.
- This is request recovery, not an offline queue or verification claim. Lint, 65 tests, production build, workspace/handoff verification, and diff checks pass locally. See `docs/quality/2026-09-09-score-retry-envelope.md`.

## 2026-09-09 private foreign-key index repair

- Live Supabase performance review found 14 advisor-recommended indexes for private append-only foreign keys. Applied pilot migration `0058_private_foreign_key_indexes`, then reran the advisor: `unindexed_foreign_keys` cleared. Focused independent review found 13 duplicate existing equality paths, so follow-up pilot migration `0059_prune_redundant_private_foreign_key_indexes` removes only those extra indexes and keeps the one unambiguously needed profile lookup index. The final advisor scan deliberately reports the 13 INFO notices again because it recognizes only exact covering definitions; neither migration changes data, access, rules, score, or finance behavior.
- Empty-pilot unused-index notices remain expected; representative-load/query-plan evidence is still required before capacity claims. See `docs/quality/2026-09-09-private-foreign-key-indexes.md`.

## 2026-09-09 GitHub release-control audit

- Confirmed that the repository Verify workflow runs the pinned install, lint, tests, production build, and workspace verification on pushes and pull requests; prior reviewed commits passed it.
- GitHub returns a plan limitation when querying branch protection for this private repository: enforceable required checks require GitHub Pro or a public repository. This is documented as an open production release-control gate, not auto-remediated by changing plan or visibility. See `docs/quality/2026-09-09-github-release-control-audit.md`.

## 2026-09-09 Vercel framework configuration

- Pinned the Vercel project to the explicit **Next.js** framework preset while preserving the blank root directory, default build commands, and tested Node `24.x` runtime. Vercel’s connected project record now reports `framework: nextjs` rather than auto-detected `null`.
- The project remains intentionally preview-only (`live: false`); this removes a deployment configuration drift risk but does not waive any production release gate. See `docs/quality/2026-09-09-vercel-framework-preset.md`.

## 2026-09-09 private API failure-boundary hardening

- Payment record, void, and retry-reconciliation routes, plus correction-policy and roster-promotion writers, now contain unexpected external failures, distinguish claims outages from absent sessions, and mark every outcome private and non-cacheable. Existing server RPC authorization and response validation remain authoritative.
- Focused Sol review found and this pass closed three P1 response-boundary gaps: correction-policy replies now bind to the requested next version, roster-promotion replies reject mixed/extra fields, and verified-claims success/absence/outage behavior executes in local tests.
- Local lint, 63 tests, production build, diff check, workspace verification, and private-handoff verification pass. Vercel Review deployment `dpl_3Bh5yNgqCaMyEMf8Ui9vkbpNoosW` for commit `d5b47e7` is Ready; build logs show no build/type/package error. Authenticated multi-user browser verification remains a release gate; see `docs/quality/2026-09-09-private-api-failure-boundary.md`.

## 2026-09-09 correction write failure boundary

- Correction proposal and review mutations now use verified-claims failure handling, contain external exceptions, and make every response private and non-cacheable. Their existing strict success/rejection validators remain the authority for accepted responses. Lint, 61 tests, production build, and diff checks pass.

## 2026-09-09 public registration response boundary

- Public registration now projects only a bounded tournament name from its anonymous RPC; unexpected, malformed, or extra backend fields fail closed. Every public registration outcome is non-cacheable and thrown dependency failures are contained. Local lint, 61 tests, production build, and diff checks pass.

## 2026-09-09 reconciliation authorization envelopes

- Applied pilot migration `0057_reconciliation_authorization_envelopes`: correction-policy and roster-promotion retry lookups now distinguish a currently authorized caller with no receipt from a revoked, unauthenticated, malformed, or unauthorized request. The corresponding routes fail closed on any non-authorized envelope and validate returned roster results.
- `pnpm test` (60) and the production build pass. Full release verification and focused review remain required before this broader API hardening pass is closed.

## 2026-09-09 game API response-boundary hardening

- The Standard Singles submission and confirmation routes now reject malformed or cross-bound backend responses instead of reporting a false success. Both routes distinguish an auth-service outage (`503`) from no authenticated subject (`401`), contain thrown external failures, and make every response `private, no-store`.
- The shared request proxy now contains an auth-refresh exception rather than bypassing API route failure handling. Local lint, 60 tests, production build, and diff checks pass. The remaining non-game API routes are under the same focused review and are not represented as closed; see `docs/quality/2026-09-09-game-api-response-boundary.md`.

## 2026-09-09 API mutation origin gateway

- Added one fail-closed, no-store same-origin gate for every non-read `/api/v1/` request before a handler or database RPC is reached. This protects existing and future private mutations consistently; individual routes and database RPCs still enforce their own identity, role, data, idempotency, and audit rules.
- Focused Sol review found two P1s before release: the general page/static matcher could omit a future image-suffixed API path, and the original test inspected text rather than behavior. The gateway now has a literal explicit API matcher plus executed same-origin/missing-origin/safe-method/API-suffix decision coverage. Lint, 59 tests, production build, workspace/handoff verification, and diff validation pass locally. A real authenticated browser cross-origin rejection test remains a release gate; see `docs/quality/2026-09-09-api-mutation-origin-gateway.md`.

## 2026-09-09 release-matrix follow-up

- Re-ran the requirement-level release audit after the setup and verified-claims repairs. No new P0 was found; the focused high-risk review's four P1 setup findings are closed and covered. The current Review deployment is Ready without a one-hour runtime-error cluster.
- The audit deliberately leaves every full-product release blocker active: real two-user verification, offline/hybrid operation, rules fixtures, results/finalization/finance/export, backup/restore/monitoring, accessibility, and a supervised simulated tournament are still unproven. See `docs/quality/2026-09-09-meta-release-readiness-audit.md`.

## 2026-09-09 protected page verified-claims repair

- Standardized the shared protected-page access guard on Supabase verified claims. A claims-service failure now fails closed, a missing verified subject redirects to sign-in, and tournament authorization still comes only from the server-side role RPC. Protected pages receive only the authenticated profile ID they need, rather than a broader user object.
- `pnpm lint`, 58 tests, production build, and diff check pass. Independent authenticated browser/session evidence remains a release gate; see `docs/quality/2026-09-09-protected-page-claims.md`.

## 2026-09-09 protected tournament setup read route

- Added a private read route for the existing setup workspace and official-choice bootstrap RPCs. It verifies cookie-backed claims, uses no direct table or service-role access, validates the exact narrow DTOs, fails closed, and marks every response `private, no-store`.
- The review caught and repaired an otherwise release-blocking validator mismatch: persisted source rows use the exact value `director_configured_unverified`; accepting invented labels would have rejected every valid setup response. A focused Sol review then found and closed four P1s: malformed private reads no longer masquerade as a new setup, response caching is complete for save/recovery, aggregate DTO integrity is enforced, and all external failures fail closed as generic non-cacheable responses. `pnpm lint`, 58 tests, production build, workspace/handoff verification, and diff check pass. The final hardening commit `ca3239e` deployed Ready to protected Vercel Preview with no one-hour runtime-error cluster. Real authorized/unauthorized sessions and the actual setup UI remain required; see `docs/quality/2026-09-09-tournament-setup-route-read.md`.

## 2026-09-09 launch-plan accuracy repair

- Reconciled `docs/operations/LAUNCH_PLAN.md` with the current pilot branch so it no longer states that the application has no backend, no database, or only a placeholder deployment. It now accurately describes the guarded pilot boundaries and the separate, still-unreleased production path.
- This is documentation accuracy only: it does not waive any release gate. The complete, evidence-backed list remains in `docs/quality/2026-09-09-meta-release-readiness-audit.md`.

## 2026-09-09 private check-in and initial seating boundary

- Applied pilot migration `0047_check_in_and_initial_seating`. Current directors/co-directors can record append-only check-in evidence and, only after registration is closed, publish one immutable initial Table/Seat list. That initial value becomes the permanent tournament verification ID; it is not a player's changing per-game seat.
- Focused Sol review repaired five P1 defects before application: a clean-chain duplicate constraint, replay after lifecycle changes, timestamp-based current-state ordering, incomplete conflict attribution, and post-publication roster/check-in drift. Final re-review found no P0/P1. Pilot catalog evidence confirms forced RLS, no direct anonymous/authenticated table access, authenticated-only empty-search-path RPCs, immutable history, same-tournament composite assignment provenance, and unique Table/Seat/verification IDs.
- This is deliberately narrower than an operational seating feature. The current roster has no player-account association, so player delivery, SMS/printing, round rotation, late-entry policy, table playthrough, and real multi-session lifecycle tests remain release gates. Details and exact remaining evidence are in `docs/quality/2026-09-09-check-in-initial-seating-pilot.md`.

## 2026-09-09 roster-to-account linking contract

- The scoring engine requires an authenticated assigned participant, while the approved roster intentionally has no account link. Recorded the next safe boundary in `docs/decisions/2026-09-09-roster-account-linking-contract.md`: a director/co-director explicitly links a pre-existing authenticated profile to one private roster entry, with immutable receipt/audit history and no name/email inference.
- This contract expressly does not create an account, role, payment, check-in, seat, event participant, or score action. Its implementation and real multi-account authorization evidence are still required before digital players can safely receive assignments or score.

## 2026-09-09 event enrollment contract

- Identified and documented the next required server transition in `docs/decisions/2026-09-09-event-enrollment-contract.md`: only a director/co-director may turn a linked, currently checked-in roster identity into one participant for an approved digital Standard Singles event. It rejects post-seating enrollment until an approved late-entry policy exists and makes no game, seat, score, payment, or role change.

## 2026-09-09 results and finalization contract

- Confirmed the results screens/PDF are prototype-only. Recorded the required immutable, versioned server publication lifecycle and rule/finance/export gates in `docs/decisions/2026-09-09-results-finalization-contract.md`; no authoritative results or export capability is claimed.

## 2026-09-09 canonical tournament setup contract

- Closed a critical design gap before implementation by defining `Set Up Tournament` as a private, immutable versioned configuration history—not an edit path for operational scoring events. It captures the director-confirmed tournament, venue, event, fee, Q-pool, payout-note, and Muggins configuration that future Flyer, Seating, Results, and Finance features will consume.
- The reviewed contract blocks setup changes after seating or gameplay begins, requires existing current official roles rather than granting them from a form, preserves changed retries as conflicts, and prohibits any unapproved ACC calculation, public flyer, operational-event creation, or portal submission. Exact portal option lists and official payout/qualification fixtures remain source gates; see `docs/decisions/2026-09-09-canonical-tournament-setup-contract.md`.

## 2026-09-09 protected tournament setup writer

- Applied pilot migration `0052_tournament_setup_save_rpc`: current directors/co-directors can now save a complete private, immutable, versioned tournament-setup draft through one authenticated, empty-search-path RPC. It validates only the approved typed configuration shape, preserves payout/qualification/eligibility notes separately, requires existing official roles, rejects stale/later-lifecycle writes, replays exact retries, and preserves changed retries as private conflict evidence.
- It is deliberately a configuration boundary only: it creates no operational event, ruleset, registration, roster, seat, score, finance record, result, export, flyer, or ACC submission. Pilot rollback fixtures proved accepted persistence and no operational side effects, plus replay/conflict/stale behavior. Catalog checks confirm forced RLS, no direct client table access, and authenticated-only execute. The remaining release evidence includes real independent director/co-director sessions, concurrency, a reader/UI, DST policy, authoritative ACC options/fixtures, and every downstream operational workflow; see `docs/quality/2026-09-09-tournament-setup-schema-pilot.md`.

## 2026-09-09 tournament setup retry reconciliation

- Fixed a P0 discovered during focused UI review: an opaque browser retry envelope could not determine whether an interrupted private setup save succeeded. Applied pilot migration `0055_tournament_setup_operation_reconciliation`, which lets only the same current director/co-director reconcile their own same-tournament setup-save receipt by idempotency key. It does not return any other operation or create data.
- Rollback pilot evidence proves the authorized response and non-member denial. A later UI must still provide a strict, same-origin, non-caching route and never store private setup content for recovery; see `docs/quality/2026-09-09-tournament-setup-reconciliation-pilot.md`.

## 2026-09-09 tournament setup official bootstrap

- Fixed a second P0 from focused UI review: a co-director could not safely initialize version 1 because the empty setup reader has no saved official snapshot. Applied pilot migration `0056_tournament_setup_official_choices`, returning only the canonical director and current co-director choices to a current official. The setup writer still independently validates those roles and grants none.
- Rollback pilot evidence confirms current-official access and non-member denial. The future protected form must treat these as transient choices and handle stale-role rejection; see `docs/quality/2026-09-09-tournament-setup-bootstrap-pilot.md`.

## 2026-09-09 private tournament setup reader

- Applied pilot migrations `0053` and `0054`: a current director/co-director can retrieve the latest private setup configuration and minimal version/timestamp/event-count history through one authenticated, empty-search-path read RPC; an unauthorized caller receives no data. Sol review found no P0 and one data-minimization P1, repaired before use by removing the historical revision ID.
- The response is intentionally a read DTO, not a form-save payload; it contains server/read-only fields that a future UI must map explicitly. No UI or operational side effect was added. Rollback pilot evidence, grant checks, and limitations are in `docs/quality/2026-09-09-tournament-setup-reader-pilot.md`.

## 2026-09-09 private tournament setup schema foundation

- Applied pilot migration `0051_tournament_setup_draft_boundary`: immutable private revision, official, configured-event, Q-pool, and changed-retry conflict records now exist independently of operational `app.events`. They cannot be directly accessed by anonymous or signed-in clients and contain no writer, reader, UI, event mapping, or official calculation.
- A focused Sol review repaired three P1s before application: actor/tournament receipt provenance, invalid immutable fee/official shapes, and a zero-official deferred-trigger bypass. Final review found no P0/P1. Static checks pass; direct catalog checks confirm forced RLS and revoked direct grants. An all-rollback pilot transaction now proves valid deferred official persistence and zero-official rejection without retaining a role or setup record. Future writer authorization/retry/co-director and independent-session evidence remains required; see `docs/quality/2026-09-09-tournament-setup-schema-pilot.md`.

## 2026-09-09 identity linking and guarded enrollment pilot

- Applied pilot migrations `0048` and `0049`: immutable independent roster-to-account linking and pre-seating director/co-director Standard Singles enrollment. The link rejects self-linking and creates no role/event/score authority; enrollment requires a linked, latest-state checked-in roster identity and an approved digital event, then creates no game or seat.
- Static regression coverage passed with 51 tests. Vercel built commit `36e1e14` Ready, returned a normal auth redirect, and had no grouped runtime errors in the one-hour scan. Real independent authenticated-session/database lifecycle evidence remains a release gate; see `docs/quality/2026-09-09-identity-enrollment-pilot.md`.

## 2026-09-09 event-enrollment replay and lifecycle repair

- Repaired the guarded enrollment RPC before further use: changed idempotency-key reuse now creates a private immutable conflict record rather than colliding with the one-receipt-per-actor/key constraint, authorized closed-lifecycle rejections are now receipted/audited, and the qualifying event row is locked with the tournament before a participant is created.
- Applied pilot migration `0050_event_enrollment_idempotency_and_lifecycle_repair`. A focused Sol review found and repaired the missing event lock; final re-review found no P0/P1. Local tests (51), lint, production build, workspace/handoff verification, and database catalog/grant checks pass. Real independent-session lifecycle and race evidence remain release gates; see `docs/quality/2026-09-09-event-enrollment-repair-pilot.md`.

## 2026-09-09 retry-safe manual-payment client

- Added the protected director/co-director manual-payment workspace controls for the existing private roster ledger. A receipt can be recorded only as a strict positive decimal USD amount, an allowlisted manual method, canonical UTC timestamp, optional bounded note, and a fresh idempotency key; a current receipt can be voided only with a bounded nonblank reason. Neither action asserts paid-in-full, reconciliation, check-in, seating, enrollment, eligibility, or any financial balance.
- The browser retains only an opaque, per-account/per-tournament retry envelope containing operation identity, expected version, source receipt identity where applicable, idempotency key, and a local change detector. It never stores money, method, time, note, or reason. Ambiguous actions are locked and reconciled through the current-role server boundary; an explicit accepted result refreshes, an explicit rejection states that no evidence changed, and all authorization/network/malformed uncertainty remains locked.
- The client applies a synchronous double-activation guard before asynchronous digest work, rejects invalid local request shapes before storage or network activity, and treats any non-OK or mismatched response as nonterminal except for the strict known conflict shape. `pnpm lint`, 48 tests, production build, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check` passed locally. Focused Sol re-review found no P0/P1; real independent director/co-director browser/database lifecycle evidence remains required before release.

## 2026-09-09 protected manual-payment mutation boundary

- Added strict same-origin, cookie-authenticated receipt, void, and recovery routes. They call only the existing narrowly authorized payment RPCs, validate canonical UTC receipt timestamps and integer USD cents, bind all accepted/rejected responses to the requested roster/version/receipt state, and send no direct-table or service-role request.
- Migration `0046_payment_operation_identity_recovery_authorization` changes recovery to return an explicit `{ authorized: true, result }` envelope for current director/co-director callers. The UI may treat only explicit `result: null` as an uncommitted operation; revoked-role or malformed recovery remains locked rather than silently discarded.
- Focused Sol review found and repaired four P1s (authorization/null ambiguity, loose recovery shape, ambiguous date/cents inputs, mixed rejected/success shapes) and a final response-discriminator P1. Final re-review found no P0/P1. The protected page remains evidence-only; its retry-safe mutation client and independent real-session lifecycle tests are still required before a director can record payment in the UI.

## 2026-09-09 meta release-readiness audit

- Completed a fresh requirement-by-requirement audit in `docs/quality/2026-09-09-meta-release-readiness-audit.md`. It confirms the current reviewed branch deploys as a protected Vercel Preview and has no seven-day runtime-error cluster, but it is not a production deployment and must not be represented as one.
- The audit resolved one newly discovered hardening gap by retiring the legacy three-argument payment-recovery RPC in migration `0044`; a Sol review and direct pilot catalog check confirm only the exact, role-scoped five-argument recovery function remains.
- The audit records the still-critical full-product release blockers: authoritative setup/check-in/seating, real dual-session scoring evidence, offline/hybrid operation, results/export/finalization/finance, approved ACC fixtures, backup/restore/rollback/monitoring, and accessibility/simulated-tournament evidence. These remain active work, not waived requirements.

## 2026-09-09 payment-operation identity recovery

- Applied pilot migration `0045_payment_operation_identity_reconciliation`. A future payment client can now safely reconcile an ambiguous receipt/void request using only the current actor, tournament, roster target, exact operation type, and idempotency key. It does not have to reproduce PostgreSQL's canonical financial-request hash in the browser.
- The client contract requires a pre-request opaque envelope with no money, method, time, note, or reason; its local digest is only a change detector, not authority. The original exact hash-bound reconciliation RPC remains available for server use, while the retired ambiguous three-argument signature remains absent.
- Focused Sol re-review found no P0/P1: the new function is current-role gated, exact-kind scoped, has an empty search path, denies `anon`, and is callable only by `authenticated` users. Lint, 48 tests, build, workspace/handoff verification, and diff check passed.

## 2026-09-09 payment-operation recovery hardening

- Applied pilot migrations `0043_payment_operation_reconciliation_hardening` and `0044_remove_legacy_payment_operation_reconciliation`. Payment recovery is now bound to current actor, tournament, roster identity, exact record/void operation type, idempotency key, and canonical request hash. The older three-argument recovery RPC was deliberately removed, leaving no weaker callable fallback. This prevents a retry from treating a void as a receipt or otherwise recovering a different financial action.
- Focused Sol review confirmed the older RPC was not a current disclosure but should be removed to eliminate an avoidable `SECURITY DEFINER` surface and future misuse path. Pilot inspection confirms only the exact five-argument RPC remains; it has an empty search path, denies `anon`, and is executable by `authenticated` callers only. Static regression coverage and `pnpm test` pass; payment actions themselves still require strict routes, opaque retry envelopes, and real-session lifecycle testing.

## 2026-09-09 protected manual-payment evidence workspace

- Applied pilot migration `0042_roster_payment_workspace`. A dynamic, director/co-director-only payment workspace now displays only private roster display names and immutable manual receipt/void history. It deliberately excludes email, ACC number, balance, paid-in-full/reconciliation claims, registration preference, seating, check-in, scoring, standings, and operational side effects.
- The server-only DAL calls only the narrowed RPC and fails closed unless the returned history is contiguous, correctly ordered and alternated, and internally consistent with its latest version/state/current receipt. The protected page has both server membership and database-role checks plus shared-device sign-out.
- Focused Sol review found and repaired two P1s before completion (empty authorized roster return shape and insufficient ledger relationship validation). Final review found no P0/P1. Lint, 48 tests including malformed-ledger rejections, production build, and diff check pass. Real independent director/co-director browser and database lifecycle tests remain release gates.

## 2026-09-09 immutable manual roster-payment evidence

- Applied pilot migrations `0040_manual_roster_payment_ledger` and `0041_roster_payment_history_indexes`. A director/co-director can now record a positive USD cash/check/other receipt for an existing private roster identity or void its current receipt with a reason. The ledger is immutable, versioned (`received → voided → received`), expected-version/idempotency guarded, privately audited, and never marks a player paid-in-full or reconciled.
- This deliberately does **not** process cards, treat a registrant's stated payment preference as proof, calculate fee balance, create a profile/role/participant/check-in/seat/verification ID, or affect scoring, standings, qualification, payout, export, or finalization. The optional receipt note is normalized and retained; void history preserves the original receipt.
- Focused Sol review found and repaired two P1 defects before application (discarded accepted note and cross-scope changed-retry conflict reference); final re-review found no P0/P1. Pilot inspection confirms forced RLS, no direct `anon`/`authenticated` access, authenticated-only narrowly authorized RPCs with empty search paths, and no remaining unindexed-foreign-key advisory. Lint, 48 tests, build, workspace/handoff verification, and diff check passed. Real multi-session receipt/void/replay/race/rollback testing and the broader finance reconciliation/payout implementation remain release gates.

## 2026-09-09 protected roster-promotion interface

- Added a director/co-director-only roster review page and server-only workspace DAL, plus protected roster-promotion and reconciliation routes. The client calls RPCs only, validates exact accepted/rejected results, and states explicitly that promotion does not create an account, payment, check-in, event enrollment, Table/Seat, or verification ID.
- Retry storage holds only an opaque decision ID and idempotency key under the existing shared-device-cleared `registration-operation:` prefix. Storage failure blocks submission; recovery reconciles before enabling actions; ambiguous network/5xx/malformed outcomes retain and lock the original request.
- Focused Sol review found and repaired three P1 retry defects (double-activation envelope replacement, unhandled reconciliation transport failure, and permissive terminal rejection handling). Final re-review found no P0/P1. Lint, 47 tests, and production build pass. Real independent-session/browser and persisted database assertions remain release gates.

## 2026-09-09 roster workspace recovery boundary

- Applied pilot migration `0039_roster_workspace_reconciliation`. The director/co-director-only roster read model now returns only approved, unpromoted same-tournament claims as promotion candidates, alongside existing private roster entries. It exposes a caller/tournament/decision/idempotency-scoped reconciliation RPC for interrupted roster-promotion requests.
- Focused Sol review found no P0/P1: candidates remain limited to approved/unpromoted decisions; PII is still private; reconciliation cannot cross actor, tournament, decision, or operation scope; and anonymous execution is revoked. A UI/API client still must validate exact responses, retain opaque retry envelopes only, and receive real independent-session testing before release.

## 2026-09-09 protected registration roster boundary

- Applied pilot migrations `0036_registration_claim_roster_boundary`, `0037_registration_review_roster_indexes`, and `0038_roster_promotion_authorization_repair`. An immutable director/co-director-approved claim can now create exactly one private roster identity snapshot, with composite same-tournament approval enforcement, replay/conflict handling, receipts, audit events, and no direct table access.
- The roster operation intentionally creates **no** Auth user/profile association, role, event participant, payment, check-in, Table/Seat, verification ID, or scorecard. Claim identity fields remain unverified intake data; account association and every operational state stay separate future controls.
- Focused Sol review found a P1 in the first writer (a revoked director could replay old identifiers and an unauthorized caller could write audit noise). `0038` now checks current director/co-director authorization before replay lookup and permits rejection/conflict audit writes only for an authorized actor. Final Sol re-review found no P0/P1. Pilot inspection confirms forced RLS, no direct `anon`/`authenticated` table access, authenticated-only RPC grants, empty function search paths, and no advisor `unindexed_foreign_keys` finding.
- `pnpm test` passed with 46 tests. Real independent-session authorization, concurrent replay, rollback injection, and persisted-data verification remain release gates; no UI was added in this integrity increment.

## 2026-09-09 protected registration-claim review boundary

- Applied pilot migration `0035_registration_claim_review_workspace`: director/co-director-only review decisions are immutable, collision-aware, idempotent, receipted, and audited. The decision response explicitly states that no roster, payment, or check-in record was created.
- Focused Sol review found four P1 integrity issues (collision approval branch, approved-claim collision visibility, unsuitable duplicate references, and null decision validation); all were repaired and the final re-review found no P0/P1. Pilot inspection confirms the writer exists, `anon` cannot execute it, and neither `anon` nor `authenticated` has direct table access.
- The review queue and future roster/payment/check-in/seating workflows remain distinct required increments. This is not a claim that a registration is enrolled or paid.

## 2026-09-09 registration claim-review contract

- A focused high-risk review established the next `R-REG-01` increment: a director/co-director-only, immutable registration-claim decision queue. It can only mark a claim `approved_for_roster` or `rejected`; it cannot create an Auth account/profile, roster role, event participant, payment record, check-in, seat, or verification ID.
- Recorded the required same-tournament collision resolution, locking, replay/conflict, receipt/audit, private-data, and rollback acceptance matrix in `docs/decisions/2026-09-09-registration-claim-review-contract.md`. This is an implementation contract, not a claim that the workflow is already built.

## 2026-09-09 director correction-policy workspace

- Added a protected director/co-director **Correction Policy** screen linked from Score Corrections. It exposes the approved defaults—immediate correction authority and optional reason—and lets an authorized official require a short correction reason and/or one independent approval for future corrections. The database remains authoritative; clients neither read private policy tables nor select a policy version.
- Applied pilot migration `0034_correction_policy_workspace`. It adds narrowly granted authenticated-only read/reconciliation RPCs and replaces the writer with an expected-policy-version guard. The legacy writer signature is removed, so two officials cannot silently overwrite each other: the first writer advances the version and a stale second request receives an immutable, reconcilable `stale_policy` rejection.
- Focused Sol review found and prompted repair of the stale-policy overwrite P1; the re-review found no P0/P1. Pilot inspection verified the guarded writer exists, the legacy signature is absent, `anon` cannot execute any new RPC, authenticated execution is limited to the narrowly authorized functions, and all three functions use `SECURITY DEFINER` with an empty search path. The Supabase advisory scan reports only the pre-existing private-table / intentionally authenticated-RPC notices and the previously accepted password-protection warning.
- `pnpm lint`, `pnpm test` (43 tests), `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check` passed. Preview deployment `dpl_12XA3jjFi9ZsczErUEAdgytXPQxL` for commit `3ac5f13` is Ready, returned the expected HTTPS app shell, and Vercel reported no runtime-error cluster in the one-hour scan. A real director/co-director browser concurrency exercise is still required before release.

## 2026-09-09 deployment runtime pin

- Replaced the open-ended Node engine range (`>=22`) with the tested `24.x` major to prevent Vercel from silently selecting a future Node major. The CI workflow and current local runtime already use Node 24. Added a regression check; lint, 42 tests, and the production build passed.

## 2026-09-09 shared-device sign-out and clear boundary

- Added a protected-screen **Sign out and clear this device** control to the tournament workspace, live score-entry, correction, and how-to views. It clears only this browser’s application retry/registration artifacts, calls a same-origin, origin-checked server route for **local-only** Supabase sign-out, propagates only Supabase cookie changes, and sends `Clear-Site-Data` for cache/storage before hard replacement to sign-in.
- Corrected four P1 findings in the first pass (the actual registration retry prefix, local rather than global sign-out scope, storage-failure continuation, and hard navigation) and two P1 findings in the re-review (no forwarding of Next internal request-override headers and a visible persistent local-cleanup warning). The final Sol re-review found no P0/P1 findings. `pnpm lint`, `pnpm test` (41 tests), `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check` passed.
- This closes an implementation gap in `R-REG-01`; a real HTTPS browser Back/Forward and cookie/storage-clear exercise with an authenticated disposable account remains a release-verification gate.

## 2026-09-09 release-audit evidence refresh

- Corrected the release audit after verifying the current implementation rather than relying on its older baseline: the signed-in, assignment-scoped live score-entry route and the protected correction workspace are implemented in the supported Standard Singles pilot slice. The Vercel Preview for commit `49d4e52` is Ready and returned the expected root app shell without a runtime-error cluster in the bounded scan.
- This is evidence correction, not a production claim. The critical next proof remains two independent authenticated browser sessions against disposable synthetic data, followed by the documented rejection, race, and recovery paths. Broader event, finance, offline, results, rules, deployment, and operational gates remain open.

## 2026-09-09 protected correction workspace mutations

- Added the signed-in correction proposal and independent review controls to the protected workspace. They use only the existing server-authoritative API boundaries, display pending corrections as non-authoritative, and refresh the server-scoped workspace after an accepted outcome.
- Hardened ambiguous retry handling after an independent Sol review found two P1 issues: storage keys now contain no player names or correction reason and are scoped to the authenticated account; an opaque envelope locks the exact result or review decision after network/5xx/malformed-response ambiguity, so a user can retry it safely but cannot create a changed or reverse operation before refresh. Switching accounts on the same browser clears stale envelopes. A future sign-out/shared-device-clear control must use the same cleanup routine.
- Added a caller-scoped immutable-receipt reconciliation endpoint for ambiguous correction responses. It distinguishes proposal receipts (which target the game but contain an immutable correction ID) from review receipts (which target the correction); no reason is returned.
- `pnpm lint`, `pnpm test` (38 tests), `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check` passed. The pilot migration is applied. The final Sol review found no P0/P1 after the privacy, ambiguity, and receipt-target repairs. Local browser rendering is intentionally fail-closed without local public Supabase variables; hosted real-role phone/desktop verification remains a required release gate.

## 2026-09-09 protected correction workspace route

- Added the signed-in tournament-scoped correction workspace at `/tournament/[tournamentId]/corrections`. Its server-only data layer accepts only the narrow `get_correction_workspace` RPC shape and never reads private tables directly. The page makes Pending’s no-standings/no-export effect explicit and renders no actionable data if the database returns empty role-scoped collections.
- `pnpm test` passed with 36 tests, `pnpm lint` passed, and `pnpm build` passed with the protected correction route compiled. Mutation controls, retry UI, real role sessions, and browser verification are deliberate remaining gates; this route alone is not an operational correction workflow.

## 2026-09-09 protected correction workspace foundation

- Added a private actor-scoped correction workspace read RPC and narrow proposal/review HTTP boundaries. The workspace derives roles server-side, exposes only Draft Standard Singles candidates/pending reviews, excludes a cross checker from their own game and a reviewer from their own edit or either player’s game, and reveals optional reasons only to independently eligible reviewers. Authenticated users retain no direct read access to correction/private-state tables.
- Corrected three P1 findings during independent Sol reviews: the workspace’s missing read boundary, a reason-length rule that could otherwise be bypassed by direct RPC calls, and overly permissive accepted-response handling. New corrections now enforce both a 500-character/2,000-byte reason limit inside the private schema; endpoint contracts bind returned correction/game/version/decision fields to the exact request and preserve retries after malformed/mismatched responses.
- Pilot evidence: no-scope callers receive empty collections; `anon` cannot execute the new workspace function; authenticated has no direct `SELECT` on correction, state-event, or publication tables; a temporary trigger test rejected 501 characters and accepted 500 before rollback. Repository verification passed: 35 tests, lint, build, workspace, private handoff, and whitespace checks.
- This is not a release claim. A protected correction browser workspace, independent authenticated role sessions, direct-RPC visibility/revocation tests, concurrency tests, and immutable result-version/supersession remain required.

## 2026-09-09 public registration claim pilot

- Added the public QR/link registration foundation required by `R-REG-01`: high-entropy token hashes, a separate open/closed registration state, private append-only registration claims, and a small public API/page. The public boundary accepts only a registration claim and an intended payment method; it cannot create an account, role, roster/event participant, payment receipt, Table/Seat, or permanent verification ID.
- The live synthetic-pilot transaction verified open-link claim creation, payload-equal idempotent replay, changed-payload conflict rejection, duplicate-claim review hold, configurable total/hourly intake limits, link closure, direct anonymous table denial, and claim immutability. It found and corrected an email-validation error before persistence; every test transaction was rolled back.
- A focused security review then found three migration/replay defects before any public link was enabled: a clean-chain duplicate constraint, immutable-row interference with legacy fingerprint backfill, and delimiter-collision fingerprints. Migrations `0017`/`0018` now repair those paths with a guarded constraint, controlled trigger restoration, and canonical JSON fingerprints. A live anonymous synthetic collision regression returned `received` then `idempotency_conflict`; it was rolled back.
- Independent Sol security re-review found no remaining P0/P1 issues. Vercel Preview deployment `dpl_HiNqnX8is9tLTRfnf2Qv3P9rdsER` from `f883a3b` rendered the dashboard and the generic closed/unavailable registration state without a runtime-error cluster.
- Director/co-director review, manual-payment ledger, check-in, shared-device clearing, and seating remain explicit implementation gates. No public registration link is enabled permanently in the pilot.

## 2026-09-09 correction fingerprint compatibility hardening

- Replaced the correction RPC's delimiter-based request fingerprint with canonical JSON for fresh installations, and applied pilot repairs `0019`/`0020`. Existing immutable correction receipts remain replay-compatible through an exact legacy-hash comparison while all new receipts use canonical fingerprints.
- A transactional pilot test confirmed an old-format receipt replays its saved response and a changed reason containing `|` returns `idempotency_conflict`; all fixture writes rolled back. Independent Sol review found no remaining P0/P1 issue after the compatibility repair.

## 2026-09-09 correction-policy gap review

- The review confirmed an unimplemented `R-CORR-01` capability: directors cannot yet require a correction reason or independent approval. The existing correction engine remains safe for its immediate/optional-reason default, but does not satisfy the configurable-policy requirement.
- Recorded the reviewed implementation contract for append-only policy versions, immutable correction snapshots, pending-no-effect behavior, independent non-self approval, stale/published guards, lifecycle invariants, and the required concurrency/replay/rollback test matrix. No scoring behavior was broadened or guessed.
- Applied the first safe foundation: private immutable versioned policy rows, default version-0 provisioning for existing and future tournaments, and a foreign-key link from correction snapshots to policy versions. Configuration and pending-review RPCs are not implemented yet, so this schema does not present unavailable controls as working capability.
- Added the authenticated, director/co-director-only append-only policy configuration RPC. A pilot transaction created policy version 1 requiring a reason and one approval, then exact-replayed without creating another version; all transaction data rolled back. Proposal/review enforcement remains explicitly incomplete.

## 2026-09-09 correction-policy proposal safety repair

- Corrected two findings from the high-risk review before any production claim: the configuration repair migration now tolerates the clean `0022` to `0024` migration chain, and the policy-aware proposal function locks/reads the tournament row before accepting a new correction. The already-migrated pilot received repair `0026`.
- Added all missing foreign-key indexes for policy versions and configuration-conflict history in `0027`; the pilot performance advisor now reports no unindexed-foreign-key finding. The remaining unused-index notices are expected for a synthetic pilot with no representative workload.
- A synthetic transactional pilot confirmed exact policy-configuration replay remains available after finalization while a fresh configuration is rejected and immutably audited. Full repository checks passed (30 tests, lint, build, verification, private-handoff verification, and whitespace check). A focused Sol review found no P0/P1 issue after remediation.
- This remains a safe partial foundation, not finished `R-CORR-01`: approval-required corrections are pending/no-effect, but independent approval/rejection, a deferred lifecycle invariant, two-connection serialization proof, and clean-disposable-chain proof remain release gates.

## 2026-09-09 independent correction review foundation

- Added a protected independent review boundary for approval-required corrections. It requires a different eligible cross checker/director/co-director at decision time, stores a reviewer-role snapshot, rejects null/invalid decisions, locks the correction/game/tournament/publication guard, exact-replays only payload-identical retries, and preserves immutable receipts/audit/conflict history.
- Added a deferred immutable lifecycle invariant with explicit transition sequence: immediate corrections are `applied@1`; approval corrections are only `pending@1`, `pending@1 → rejected@2`, or `pending@1 → approved@2 → applied@3`. Pending and rejected paths do not update score projections; approval atomically changes both reciprocal scorelines and canonical result only after all authorization, policy-snapshot, stale-source, ruleset, and Draft publication guards pass.
- Added a private immutable per-event Draft publication guard, seeded/provisioned for every event. Both new proposals and approvals fail closed when the guard is missing or not Draft. This is deliberately a pre-result-versioning guard; it cannot publish or supersede results, which remains a required later capability.
- Pilot synthetic transactions verified pending no-effect, null-review no-side-effect, and eligible independent approval from A/+31 to B/+30 with the expected three-event transition history; all test records rolled back. The advisor is clear of unindexed foreign keys. Independent Sol review found and the implementation fixed a null-decision and missing-publication-guard P1 before pilot application; final review found no P0/P1.
- Git Preview deployment `dpl_CgJvC7mWpFd9twiCBf8jGXFi91CT` is Ready from commit `836d3c0`; its root route returned HTTP 200 with the expected score-entry shell and Vercel reported no runtime-error clusters over the one-hour scan. Production remains intentionally on `main` and is not a release candidate.
- The production release gate remains open: protected correction UI, real authenticated independent browser sessions, clean-chain disposable migration proof, two-connection concurrency/publish-race proof, and immutable result-version/supersession support are still required.

## 2026-09-08 correction-foundation pilot verification

- Applied `0011_correction_foundation` to the isolated synthetic-data pilot. It provides append-only correction/state/conflict records and an authenticated, cross-checker-only correction RPC. It preserves original verification evidence, denies self-corrections, applies the default immediate-authority/optional-reason policy atomically, and safely rejects non-identical reuse of an idempotency key.
- Applied `0012_correction_history_indexes` after the hosted advisor identified missing foreign-key covering indexes in the new history tables. The re-scan cleared those findings; unused-index notices are expected while the pilot contains only synthetic transactions.
- Forced-deferred pilot transactions passed for the positive correction, self-correction rejection, and idempotency-conflict paths. Each test was rolled back, leaving no test correction records in the pilot. A focused Sol review found no P0/P1 findings after remediation.
- This is a database foundation, not a finished correction feature: protected official UI, role management, independent browser sessions, published-result versioning, and broader release gates remain outstanding.

## 2026-09-08 public registration and manual-payment requirement

- Added the agreed public tournament registration boundary to the normative requirements: a non-guessable flyer QR code/link permits self-registration only while server-side registration is open; it never grants a role or private data access. Duplicate identity claims require director review.
- Recorded the first-release financial boundary: payment remains manual (cash/check or other director-recorded method), and only an authorized director/co-director can mark it received in a private audited ledger. Online payments remain a future separately reconciled integration.

## 2026-09-08 live score-entry pilot hardening

- Added the protected, server-backed Standard Singles score-entry route. It loads only a signed-in, checked-in assigned player's active game context through a narrow authenticated RPC; it uses the existing server-authoritative submission/confirmation routes and does not expose direct private-table access.
- Applied pilot migrations `assigned_game_context`, `assigned_game_context_hardening`, `confirmation_eligibility_hardening`, and `assigned_game_context_confirmation_recovery`. The corrections align the read model with canonical `pending`/`verified` state, make the saved score and confirmation state refresh-safe, remove unnecessary internal IDs from the client payload, preserve IDs across ambiguous network retries, and enforce event/ruleset eligibility at the confirmation data boundary.
- Added concise score-entry help for a paper-card/digital-card game and recorded `R-GUIDE-01`, including the fuller director guide requirement. The instruction does not weaken the two entries/two confirmations verification rule.
- Added a protected tournament-scoped `Start Here / How To` route for players and directors, linked from live score entry. It covers the paper/digital flow, check-in, seating publication, permanent verification IDs, and the requirement to leave exceptions pending for authorized cross-check/judge handling.
- Corrected the deferred game-state invariant to allow exactly one accepted entry in `submitted`, while retaining the two-submission requirement for mismatch, confirmation-pending, verified, and corrected states. Pilot transactions forced deferred constraints and confirmed both the one-entry state and the two-player/two-confirmation verified state with reciprocal +31/−31 scorelines.
- `pnpm lint`, `pnpm test` (26 tests), `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check` passed. Pilot SQL verified an assigned caller receives its constrained context, an unassigned caller receives none, and a verified game refreshes to its authoritative state. Preview deployment `dpl_DVrpjbWYsXYHuwNk1Uokdq3EpUi3` is Ready from commit `414ccd5` with no current runtime error clusters. Independent browser sessions, a seeded real role, and phone/desktop live-route verification remain required before this vertical slice can be called complete.

## 2026-09-08 correction foundation decision

- Recorded the server-side correction boundary before implementation: corrections are immutable separate history, require non-self cross-check authorization, preserve original verification history, default to immediate authority with optional reason, and atomically recompute only the effective canonical/scoreline projections. Pending approval must remain non-authoritative, and published-result corrections fail closed until result versioning exists.

## 2026-09-07 canonical setup and Events/Flyer foundation

- Confirmed **Events and Flyer** is an event-management/reference area with flyer creation inside it, not a flyer-only operation. It now lists Main Event, Consolation Event, and configured Satellite Events without incorrectly treating Topaz (a location) as an event.
- Made **Set Up Tournament** the prototype’s planned canonical data-entry source. It contains prototype options based on observed sanctioning-request tournament/director/venue fields, Main/Consolation/Satellite configuration menus, two co-director entries, and a disabled flyer-import format preview. Future production reuse is explicitly specified for flyer, seating, results, finance, and a director-assisted draft worksheet; no automatic portal submission is claimed without a documented ACC API/import contract.
- Refined the review surfaces: larger permanent scorecard ID, inline tournament context on seating print, searchable/cached/online Rulebook labels, and category-first results. Regenerated the synthetic qualifier PDF so the winners lead the qualifier order.
- `pnpm lint`, `pnpm test` (25 tests), `pnpm build`, `pnpm verify`, and `pnpm verify:handoff` passed. Hosted desktop review deployment `dpl_68JMBS9YFzgGtP7aZmWyrx1USHUK` rendered the Score Entry panel without an error overlay. Phone and physical-print verification remain pending.

## 2026-09-07 score-entry and scorecard format review

- Updated the review shell to use the approved player-facing Score Entry/Game Result language and to preview both players’ game and reciprocal spread entries.
- Reworked the scorecard into the requested 12-game, paper-card-inspired grouped header format, with the player ACC number, Table/Seat, current game, opponent, Verification ID #, and Games Won. Removed prototype explanations, initials, loss count, and Checked by from the visible card.
- Recorded the future paper-player seating-list requirement and the consent/provider gate for optional SMS notifications. `pnpm test` (25 tests), `pnpm build`, and `pnpm verify` passed. Hosted Preview deployment `dpl_8Res9v9BjVDAz9P5G4ksqSEs7C7m` rendered the revised desktop review shell; a real phone browser pass remains required.

## 2026-09-07 scorecard totals, seating print, and rulebook cache review

- Moved the pending-opponent notice into the unused right side of the fixed scorecard total row and changed it to `Updated Total Calculations Pending Opponent Entry`; enlarged the stacked Opponent/Verification headers and made the Plus/Minus header symbols match.
- Changed the top context badge to `GAME 3`; production must advance this only after the current game is server verified.
- Renamed seating columns to `Assigned Table - Seat`; both printed columns now repeat Player, Scorecard, and Assigned Table - Seat headers, use compact `A-5` values, preserve left-column-first pagination, and use one-half-inch print margins.
- The user recorded permission to cache the full ACC Rulebook. Verified and cached the dated official 64-page 2025 PDF from the ACC rules URL; the Rulebook tab now opens that local copy. This is a prototype asset integration, not an assertion that every rule implementation is complete or current.

## 2026-09-07 continued prototype-format review

- The review flow now shows the pending-opponent notices only after a submitted entry; the fixed total-row notice uses the same 16px red status treatment as the scorecard header and is announced accessibly.
- Reduced printable seating capacity to 28 entries per column (56 per Letter page) to fit 12-point print with half-inch margins. The prototype keeps the requested left-column-first order and repeats the three compact headers in both columns.
- Made configured events data-driven in the review layout, including Main, Consy, Canadian Doubles, and a custom satellite sample. Canadian Doubles is now represented as a future team-scorecard workflow, not a manual-only result; actual standings use remains gated on team verification and dated ACC fixtures.
- Check-in now explicitly holds Table/Seat and permanent ID generation until registration closes. Added a viewable flyer sample and an interactive two-format Rulebook view: Quick Reference, cached 2025 full PDF, and the external official ACC source.

## 2026-09-07 scorecard ID and Seating review

- Distinguished a permanent player `ID #` (used for scorecard verification throughout the tournament) from each game’s changing Table/Seat assignment. The Score Entry and Review Result screens now display both concepts separately.
- Tightened the Scorecard columns, made the header and two total/summary rows fixed outside the touch-scrolling game rows, retained the requested grouped Game/Spread divider lines only, added signed spread totals, and surfaced red `Verification Pending Entry` beside the card heading.
- Renamed the Operations option to Seating and added prototype controls for table/seats-per-table capacity, name search, sorting by first/last/card type/current table-seat, and printing the seating list. `pnpm lint`, `pnpm test` (25 tests), `pnpm build`, and `pnpm verify` passed. Hosted preview `dpl_57LReyrNzTQS13uEWPx5ijZ7Jx75` rendered the revised Score Entry screen without an error overlay; local browser remains intentionally blocked without public Supabase variables.

## 2026-09-07 score-entry keypad refinement

- Reordered the keypad status band to put the entered number on the left, `Spread Points` centered over the keypad, and any Skunk aid on the right. The keypad now ignores a fourth digit while existing 1–121 validation still rejects impossible three-digit entries. `pnpm lint`, `pnpm test` (25 tests), `pnpm build`, and `pnpm verify` passed.

## 2026-09-07 operations and results layout review

- Restored left-aligned `Spread Points:` to match `Game Winner:`, centered only the entered value above the keypad, and updated Review Result seating punctuation.
- Expanded the review prototype with Tournament Setup, Players & Check-In, Table Plan, Judge Desk, Flyer Editor, a print-specific two-column Seating Assignments layout, and a clickable Qualification Preview. The Table Plan visibly identifies an under-filled final table for director review; authoritative rotation/play-through instructions remain gated on an approved ACC fixture.
- Flyer & Events now presents event editing and flyer generation rather than treating `ACC Sanctioning Fee` or `Ready to Publish` as event states. The qualification preview presents configuration, qualifying-place, MRP, and Q Pool areas before results are final. `pnpm lint`, `pnpm test` (25 tests), `pnpm build`, and `pnpm verify` passed; hosted preview `dpl_2c7f3rE7zRtVzZkGh4ubkzrE1rLz` rendered the revised Score Entry without an error overlay.

## 2026-09-07 navigable format-review prototype

- Replaced the static anchor review shell with a navigable local review flow: Score Entry, Review Current Game Result, Scorecard, Operations, Seating & Paper Cards, Cross Check, Flyer & Events, Financials, and Results.
- Updated Current Game Results language, the invalid spread-point message, event game-count context, paper-card headers, vertically stacked Net Points/Games Won values, and touch-scrolling scorecard container. The Review Result step is visual/prototype state only and does not bypass server-side independent verification.
- `pnpm test` (25 tests), `pnpm lint`, and `pnpm build` passed. Hosted Preview deployment `dpl_6pYkkG1QrRAjcTH2AMSFWJCzsBR3` rendered the Current Game Results screen and top-level navigation without a development error; a real phone browser pass remains required.

## 2026-09-07 release-readiness audit

- Recorded a current-state, evidence-based release audit in `docs/quality/2026-09-07-release-readiness-audit.md`. The Preview and bounded pilot score API have evidence, but production deployment, real score-entry integration, role views, corrections/disputes, offline/hybrid operation, event/finance/results/export, rule fixtures, and operational exercises remain critical release blockers.

## 2026-09-07 skunk-language requirements reconciliation

- Reconciled the normative requirements with the approved prototype review: player-facing Skunk/Double Skunk/Triple Skunk labels and icons require no disclaimer, while remaining presentation-only and excluded from official calculations, standings, and exports.

## 2026-09-07 spread-points score-entry label

- Renamed the player-facing `Winning margin` field to `Spread Points`, removed the visible `1–121` range cue, and retained the existing internal 1–121 score validation. The keypad and invalid-entry feedback use the same plain-language wording.

## 2026-09-07 score-entry language cleanup

- Removed prototype workflow jargon from the score-entry panel: `FAST ENTRY`, `1 of 3`, and `Derived result`. The panel is now headed simply `Record game result`; after a valid entry it states the plain-language win result with the existing game-points, Plus/Minus, and skunk aid.
- Added a regression test that rejects those labels and requires the player-facing result wording. `pnpm verify:local` passed (23 application/security tests plus build and local handoff checks), and a signed-in hosted browser rendered the updated score-entry panel from preview deployment `dpl_HYexTAhfWuGrjGtAurEZkutRgJAP`.

## 2026-09-07 Vercel framework configuration fallback

- Added a repository-owned `vercel.json` declaring the `nextjs` framework. This is the durable equivalent of selecting the Next.js framework preset in the Vercel dashboard and will accompany every Git deployment.
- `pnpm verify:local` passed: lint, 22 application/security tests, production build, workspace verification, and 6/6 private-handoff checks.
- Vercel deployed commit `f1c57c1` as `dpl_GHHrC2nF2zMuwiKLsDewQhoETKLg` and now routes requests to the app instead of returning its edge-level 404. Preview environment values were then configured and commit `dedcc78` deployed as `dpl_E8EYFwyjaSBrujHKQfFznA3R7TFq`; a signed-in browser independently rendered the full ACC Tournament Desk prototype from that URL. Production remains intentionally separate: it still points at `main`, has no production environment values, and must not be promoted until release gates are complete.

## 2026-09-06 preview deployment diagnosis

- Pushed commit `9978f67` to `codex/production-readiness-baseline`. Vercel cloned it, installed the locked dependencies, ran `next build`, and marked preview deployment `dpl_mwbNt8UbRcQF7x6RLZUwadpiNjue` Ready.
- The generated preview URL and its branch alias both return Vercel `404 NOT_FOUND` before any application runtime logs are created, including with a temporary protected-deployment share URL. This is a hosted Vercel routing/deployment configuration issue, not a failed application build; it remains a release blocker.
- Pilot advisors now report only expected unused-index information plus intentional private-schema/RPC warnings, and one unresolved Supabase Auth warning: leaked-password protection is disabled. The UI is OTP-only, but service-side password behavior has not been verified; production must enable leaked-password protection or enforce passwordless Auth.

## 2026-09-06 pilot advisor remediation

- Applied `0005_pilot_index_and_advisor_baseline` to the isolated synthetic-data pilot only after focused review. It adds non-unique covering indexes for the advisory foreign keys and does not broaden table, policy, or RPC privileges.
- Corrected the fresh-schema index names in `0001` to match `0005`, preventing duplicate equivalent indexes on a clean migration replay.
- The Supabase password-protection advisory remains a release blocker: the current UI is magic-link only, but the hosted Auth password setting has not been independently verified or configured. Production must enforce passwordless Auth or enable leaked-password protection before launch.

## 2026-09-06 Supabase auth scaffolding

- Added pinned `@supabase/supabase-js@2.115.0` and `@supabase/ssr@0.12.6`, fail-closed public environment validation, browser/server cookie-aware client utilities, a minimal email-link sign-in page, and a same-origin-safe `/auth/callback` route.
- Added `.env.example` with blank public variables only. No secrets, service keys, policies, RPCs, direct public database access, or environment values were added. The existing prototype dashboard route remains available.

## 2026-09-06 Supabase auth review hardening

- Browser/server utilities now pass direct `process.env.NEXT_PUBLIC_*` references for Next bundling while retaining the testable validator. Added Next 16 `src/proxy.ts` claim refresh with cookie propagation and no swallowed errors.
- Sign-in is invite-only (`shouldCreateUser: false`). Added a server-side tournament DAL membership/role gate and protected dynamic tournament route; unknown or unassigned users receive no tournament data. `.env.example` is explicitly unignored and contains only blank public variables.

## 2026-09-06 Supabase auth blocker remediation

- Added response-aware route-handler cookie propagation for the callback and retained claim-refresh cookie propagation in the Next 16 proxy. Protected membership now uses a narrowly scoped, unapplied `app.get_tournament_role` security-definer function with empty search path, `auth.uid()` membership check, revoked defaults, and an explicit authenticated execute grant only.
- Safe `next` paths are preserved through sign-in and callback. `.env.example` remains tracked, blank, and credential-free (`a35a1da` latest template correction).

## 2026-09-06 final auth boundary correction

- SSR proxy and callback now preserve refreshed request headers and response cookies. The unapplied membership migration exposes only a public `get_tournament_role` security-definer wrapper with empty search path, fully qualified private-table access, revoked public/anonymous execution, and authenticated execute only; the DAL uses that RPC and never reads `app` tables directly.

## 2026-09-06 Standard Singles game API vertical slice

- Added an unapplied `0003` migration with authenticated SECURITY DEFINER `submit_game_score` and `confirm_game_score` RPCs. They enforce actor assignment/role scope, idempotency replay/conflict detection, matching submissions, two confirmations, and atomic canonical scoreline/game-point derivation without client table grants.
- Added validated POST handlers at `/api/v1/games/[id]/submissions` and `/api/v1/games/[id]/confirmations`, using `getClaims` and RPCs only. No environment, Supabase project, migration, or deployment was changed.

## 2026-09-06 game API review remediation

- Restricted confirmations to the assigned player confirming their own submission; staff confirmation is not enabled. The second submission now atomically persists `confirmation_pending` for an exact pair or `mismatch` otherwise, with digital/approved/open/checked-in gates.
- RPCs compute request digests internally, lock the game before idempotency lookup, record accepted receipts and linked audit events, and return structured rejection responses. Routes no longer accept caller-supplied hashes or source methods.

## 2026-09-06 final game API review correction

- Both RPCs now require an open tournament; submission requires an approved digital Standard Singles event and checked-in assigned player, while confirmation rechecks current checked-in assignment and own-submission ownership.
- Rejection logging is now internal to the authoritative RPC subtransaction: partial mutations roll back, then controlled rejected receipts/audit events are appended without any client-callable logging RPC or false acceptance. `pgcrypto` qualification is recorded from the pilot read-only verification below.
- Pilot read-only verification confirmed the extension schema is `extensions`; 0001 defaults and 0003 digest/generator calls now use `extensions.gen_random_uuid()` and `extensions.digest()`.

## 2026-09-06 rejection-integrity hardening

- Added an immutable, private `app.operation_conflicts` record for same- or cross-tournament idempotency conflicts and unscoped/unknown-game rejection attempts. It retains the attempted key/hash and any prior receipt ID without an invalid composite reference.
- Domain validation is now ordered after game lookup where possible; expected domain rejects return stable codes, while unexpected database/audit failures rethrow and are surfaced by routes as generic 503 responses without raw database messages.
- Added static coverage for conflict retention, immutable audit behavior, structured non-2xx route mapping, and the audit-write failure boundary. Migration 0003 remains unapplied.

## 2026-09-06 idempotency/null-boundary hardening

- Both RPCs now reject required null arguments explicitly, serialize the actor/idempotency-key pair with a transaction advisory lock, and resolve exact replays before mutable tournament/event/assignment eligibility checks after safe game lookup.
- Stable idempotency conflicts remain separate immutable conflict records; accepted replay responses never receive rejection audit events or mutate state.

## 2026-09-06 PL/pgSQL exception-structure correction

- Corrected the unapplied 0003 RPC draft after the pilot rejected it atomically on PostgreSQL syntax near `exception`: each function now uses one valid `EXCEPTION` clause with `P0001` and `OTHERS` branches. No pilot mutation occurred.
- Static tests now assert two exception blocks total and both fallback rethrows. No local `psql` parser/client is available, so database parse/apply validation remains pending a controlled integration environment.

## 2026-09-06 pilot trigger security correction

- The pilot's first real 0003 mutation test exposed authenticated execution failure in the deferred submission revalidation trigger (`permission denied for schema app`). Updated the 0001 base trigger/revalidation functions to use `SECURITY DEFINER`, empty `search_path`, fully qualified private-table references, and revoked client execution.
- Added unapplied `database/migrations/0004_trigger_security_hardening.sql` to correct the already-created pilot schema. No pilot changes were made during this pass.

## 2026-09-06 pilot advisor index baseline

- Added unapplied `database/migrations/0005_pilot_index_and_advisor_baseline.sql` with covering indexes for the advisor-listed private-schema foreign keys, including audit scope, participant/event scope, conflict receipt, confirmation actor, submission ownership, and tournament director references.
- Mirrored the index coverage in 0001 for fresh database creation. The pilot remains intentionally policy-free/private with revoked direct table DML; only authenticated, auth-checked security-definer RPCs are intended to execute. Authentication is magic-link/OTP only, so leaked-password lint is not applicable.

## 2026-09-06 local schema contract scaffolding

- Added an unapplied local first-draft migration for private Standard Singles core tables, UUID/FK/scope checks, 1–121 margins, 0/2/3 game points, normalized two-side game pairs, forced RLS, and revoked direct `anon`/`authenticated` DML.
- Added static schema rejection-boundary tests and wired them into `pnpm test`. No Supabase service, auth, routes, policies, RPCs, or production database was changed. Applying the migration remains gated on server authorization policies, integration fixtures, and recovery review.

## 2026-09-06 local schema security redesign

- Reworked the unapplied migration into private `app` schema with `profiles.id` linked to `auth.users`, restrictive non-cascading history/core FKs, composite tournament/event/ruleset/round/game scope, assigned two-sided games, exact two submission slots, immutable winner/margin submissions, submission-bound distinct confirmations, pending-state score guards, game versioning, and actor/operation/target/request-hash idempotency.
- Updated static schema tests to cover these security and rejection invariants. No Supabase migration, policies, RPCs, auth routes, or services were touched.

## 2026-09-06 second schema review correction

- Expanded the local state model to pending/submitted/mismatch/confirmation_pending/verified/corrected; confirmations now support exactly two distinct actors and allow a player to confirm their own submission. Verified/corrected games require two matching submissions, exactly two reciprocal scorelines, one winner, and two confirmations.
- Added immutable confirmation/audit protection, audit foreign-key linkage, assigned-side submission linkage, game/scoreline Table/Seat snapshots, approved matching ruleset enforcement for digital events, and corrected idempotency semantics so request-hash comparison remains future RPC logic.

## 2026-09-06 third schema remediation

- Added deferred revalidation after scoreline, submission, and confirmation mutations. Verified/corrected games now require matching submissions, exactly two reciprocal side-mapped scorelines with matching seats/margins and reciprocal Plus/Minus/game points, exactly two distinct submission-bound confirmations, and valid assigned slot/player linkage.
- Added immutable receipt/ruleset protections, stored replay response payloads, tournament-scoped audit receipt linkage, and retained the migration as local-only/static-test scaffolding.

## 2026-09-06 final score-entry readiness pass

- Added and tested `isScoreEntryReady`: no winner or invalid margin cannot start entry; a valid margin plus selected winner can. Dashboard initial controls remain unpressed and review-disabled.
- Improved decorative VS contrast/accessibility and corrected direct handoff evidence to 6/6 (outer workspace verification remains 6/6).

## 2026-09-06 final prototype accessibility/CI correction

- Added defensive runtime winner validation; the dashboard starts with no winner selected, keeps both controls unpressed, and disables score review until a winner and valid margin are entered.
- CI now uses `pnpm verify` only for clean-clone checks; `verify:handoff` remains a mandatory local-only command via `verify:local`. `verify:all` uses pnpm and excludes private handoff verification.
- Raised essential UI information to 16px minimum, retained 56px keypad targets, strengthened muted/status colors for normal-text contrast, and recorded browser checks at 320/375/1280px plus the unrun 200% zoom limitation.

## 2026-09-06 prototype accessibility and source-boundary pass

- Corrected the demo scorecard so live entry remains visibly `Pending preview · not certified` and is excluded from settled rows, totals, and net calculations. Removed static “saved” behavior.
- Added signed-net formatting tests, 16px essential labels/table/status targets, 56px keypad targets, `aria-pressed` winner controls, offline-safe system font stack, and the user-authorized `public/branding/acc-logo.jpg` via `next/image`.
- Added ESLint flat config and lint CI gate. Existing CI score/build/recovery gates remain intact; this pass added lint and did not replace them.

## 2026-09-06 prototype corrective pass

- Corrected score derivation so either selected winner receives 2 game points for a normal win or 3 for an informal skunk-band win; reciprocal Plus/Minus fields remain correct.
- Added opponent-winner normal/skunk regression coverage, pinned `pnpm@11.19.0`, meaningful `test`/`verify:all` scripts, and CI installation/build/score/recovery gates on Node 24.
- Recorded dependency/lockfile validation: the lead-added dependency set and `pnpm-lock.yaml` pass frozen install; initial ignored `unrs-resolver` build was narrowly approved via `pnpm-workspace.yaml`; `pnpm audit --audit-level=high` reports no known vulnerabilities.

## 2026-09-07 prototype operations and results review

- Refined the review prototype with a prominent `Verification Pending Opponent Entry` state and a matching total-row notice that verified totals exclude the pending game.
- Corrected seating print pagination to fill the left column before beginning the right column; the synthetic roster has four entries and is not an actual tournament count.
- Added a public Rulebook tab with an app-owned quick-reference placeholder and an official dated-link placeholder; it intentionally does not reproduce or cache the ACC rulebook without permission.
- Added event and repeatable co-director setup cues, a Table C exception-review screen, more precise cross-check language, event-selectable tournament results, and an explicitly synthetic, non-official Main qualifier-report PDF sample.
- A focused Sol review confirmed that rotation/play-through instructions, MRP/payout calculations, and portal-role parity remain production gates pending dated ACC fixtures and verified portal requirements.

## 2026-09-06 fresh prototype shell

- Added a bounded Next.js App Router TypeScript prototype under `src/app`: ACC-branded responsive tournament dashboard, large 1–121 score keypad, derived scoring/skunk aid, paper-style scorecard, and static operations/verification/correction/results cards.
- Added pure score derivation utility and rejection/boundary tests. This shell uses synthetic data only and intentionally has no Supabase, auth, persistence, or production claims.
- Verified production build, score tests, workspace/handoff checks, and browser behavior at desktop plus a 375px phone viewport. Fixed the phone page-level horizontal overflow found during browser review.

## 2026-09-06 final source-accuracy corrections

- Corrected cross-check staffing to apply per individual table, including the ACC related-couple/significant-other/relative third-checker safeguard only where a qualifying table is affected.
- Expanded `TR-06` with ACC 2025 Judge Protocols, Rule 10.1(b), Appendix A items 1–3, and existing rules 12.1–12.2, 13.2, and Cross-Checking Guidelines item 20.
- Removed Muggins disclosure from unresolved gates; retained only event configuration as data to record. Architecture now requires all affected scorelines to update atomically and defines normalized side-pair uniqueness plus explicit rematch/version and replay handling.

## 2026-09-06 second normative requirements hardening

- Tightened hybrid/paper verification to require each assigned player to independently enter and confirm their own paper result using context-only PIN; unavailable players leave the card `PendingCrossCheck`, with no staff substitution absent a future approved exception.
- Encoded the cited ACC 2025 judge/cross-check baseline, immediate correction semantics, paid-placement amounts, Muggins disclosure, high-non-qualifier fixture, finance gates, non-singles manual/imported boundary, and event-finalization gates.
- Replaced the architecture summary with a canonical `tournament → event → round → canonical_game → card_scoreline → ...` model, explicit offline security boundary, result versions, finance/attachments, and internal export artifact.
- Added direct requirement mappings for roles, offline queue security, finalization, flyers, attachments, and financial classification. No production code, imports, credentials, or external services were changed.

## 2026-09-06 normative requirements hardening

- Hardened `docs/product/production-requirements.md` after independent review: added stable requirement IDs and positive/rejection traceability, self-contained registration/check-in/shared-device/seating/dispute/Consolation/template/attachment workflows, exact digital and hybrid actor rules, canonical per-card/match linkage and Rule 12.2 fixture coverage, explicit Pending/Applied correction semantics, judge capacity/self-dispute safeguards, Standard Singles boundary, restricted-hold retention, deletion/backup/restore controls, internal director-assisted export wording, finance/reporting gates, signed-in results default, informal skunk bands, measurable accessibility targets, and rulebook-cache permission gate.
- Updated `docs/product/requirements.md` so the summary IDs, audience, correction state, canonical score linkage, and export boundary agree with the normative baseline.
- No production code, imports, credentials, or external services were changed. Remaining requirements are intentionally implementation gates where ACC policy, payout fixtures, retention, copyright, or export schema approval is still absent.

## 2026-09-06 normative production requirements baseline

- Added `docs/product/production-requirements.md` as the self-contained normative baseline for scoring, digital/digital and hybrid/paper state machines, post-verification corrections, authentication, staged full-product delivery, public results, private finance, ACC-ready export, retention uncertainty, and traceability/acceptance gates.
- Updated `docs/product/requirements.md` to point to the normative baseline while retaining the recovered summary and source map.
- No production code, imports, credentials, or external services were changed.

## 2026-09-06 requirements reconciliation and production-readiness audit

- Reconciled user-approved scorecard, correction, flyer, results, Q-pool, branding, and ACC-export decisions into `docs/product/requirements.md`; recorded current ACC 2025 scoring, tie-break, and qualification sources.
- Updated launch planning to reflect the connected GitHub/Vercel project and healthy Supabase project. The only Vercel deployment is a placeholder that returns 404; Supabase has no migrations or public tables.
- Production implementation has not begun. The next milestone is a fresh accessible branded prototype, followed by an authenticated two-player, dual-confirmed, server-audited vertical slice.

## 2026-09-06 handoff restoration

- Restored the 33-entry ACC handoff ZIP into `imports/acc-handoff-2026-09-05` without overwriting any source material.
- Ran `scripts/organize-handoff.ps1`; all 32 manifest artifacts and their organized copies match size and SHA-256, with three exact duplicate pairs mapped to shared copies.
- Verified with the bundled Node 24.19.0 runtime: `tests/workspace.test.mjs` (6/6 passing) and `tests/handoff.test.mjs` (3/3 passing).

## 2026-09-05 model routing

- Added project-specific builder/reviewer routing in `docs/operations/MODEL_ROUTING.md`; Astra is explicitly prohibited.
- Terra is the default lead, Sol performs focused plan/high-risk review, and bounded mechanical and routine work may use Luna or Mini.
- Routing never replaces the mandatory verification gates.

## Recovery update: 2026-09-05

ACC_Digital_Tournament_System_CODEX_MAXIMAL_HANDOFF_2026-09-05.zip found in C:/Users/choco/New folder/. All 32 listed artifacts match SHA-256 and size. There are 33 archive entries including the manifest and 29 unique listed artifact contents. Original files are preserved; inventory.json maps organized copies.

Specification v1.1 is the baseline; v1.3 is the latest review prototype. No production backend, database or multi-user engine was recovered. The missing original August transcript is helpful but no longer blocks implementation planning.

Read docs/recovery/REVIEW.md, docs/quality/VERIFICATION.md and docs/operations/LAUNCH_PLAN.md. Next milestone: validate rules and build one tested, authenticated two-player game with atomic verification and audit.

The earlier scaffold notes are historical and superseded. The handoff is
recovered, the production application is implemented and deployed, and the
remaining October-pilot work is the physical acceptance rehearsal and the
explicit external confirmations tracked in `docs/operations/WORKING_OUTLINE.md`.
