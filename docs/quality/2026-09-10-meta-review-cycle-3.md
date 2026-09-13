# Meta review cycle 3 — 2026-09-10

## Scope and evidence standard

This is the requested follow-up meta review after the current security,
database, and verification-gate repairs. It reviews the normative requirements
in `docs/product/production-requirements.md` against executable tests, current
source, live pilot advisor/migration evidence, and hosting metadata. A green
build, prototype, or preview is not treated as proof of an unexercised
multi-user or operational workflow.

## New findings resolved in this cycle

| Finding | Resolution | Evidence |
| --- | --- | --- |
| Explicit browser cross-site signals were not enforced at the shared API mutation gateway. | Gateway now rejects explicit `Sec-Fetch-Site: cross-site` unsafe `/api/v1` requests while retaining absent-header compatibility. | `993fa7b`; gateway regression cases. |
| Session-clearing was outside the API gateway and used only exact Origin. | Sign-out now uses the same Origin/Fetch-Metadata guard and private no-store rejection. | `44ec691`; shared-helper and route semantics. |
| `pnpm verify` was weaker than the project’s documented mandatory check. | It now executes production dependency audit, lint, all application tests, production build, and workspace integrity; CI calls the same command. | `d503187`; script/CI regression test. |

## Requirement-by-requirement current state

| Requirement group | Current evidence | Honest status |
| --- | --- | --- |
| Registration, claims, private roster, manual receipt, check-in, initial seating (`R-REG-01`) | Guarded server/RPC boundaries, immutable receipts, closure checks, and limited director workspaces exist. | Partial — account activation, player delivery, dynamic rotation, and real concurrent sessions remain blockers. |
| Roles (`R-ROLE-01`) | Verified-claim routes and scoped role RPCs; private table grants revoked. | Partial — real independent role/session evidence and final ACC role confirmation remain blockers. |
| Scoring and two-party verification (`R-SCORE-01`, `R-VERIFY-01`) | 1–121/reciprocal/0-2-3 derivation; immutable server submissions, confirmations, retries, and correction contracts are tested. | Partial — two real accounts, persisted database assertions, lost-network recovery, and browser evidence remain blockers. |
| Operations/rules (`R-OPS-01`, `R-RULE-01`) | Source boundary prevents an invented automatic last-table rotation. | Incomplete — approved fixtures for rotation, disputes, Consolation, staffing, and full rule-to-code coverage are absent. |
| Offline/hybrid/capture (`R-OFFLINE-01`, `R-SCAN-01`) | Written requirements and limited shared-device/hybrid guidance exist. | Incomplete — authenticated queue/replay, paper/dead-phone flow, storage/OCR policy, capture/review, and camera evidence are absent. |
| Corrections (`R-CORR-01`) | Append-only policy, independent review, audit/retry contracts, and no-self path are implemented. | Partial — published-result supersession and real concurrency/browser proof remain blockers. |
| Events/flyers/results/finance/export/finalization (`R-BOUND-01`, `R-FLYER-01`, `R-FIN-01`, `R-EXP-01`, `R-FINAL-01`) | Setup drafts and manual payment evidence are bounded. Qualification preview deliberately fails closed without official ties/fixtures. | Incomplete — rule-backed calculations, reconciliation, versioned publication/export, finalization, and all-event workflow are not implemented. |
| Retention/attachments (`R-RET-01`, `R-ATTACH-01`) | No automatic purge; private sources are excluded from builds. | Incomplete — classified attachments, retention/hold/delete workflow, backup/restore, and recovery evidence are absent. |
| Accessibility/guidance (`R-UX-01`, `R-GUIDE-01`) | Static touch/focus checks and hybrid guidance exist. | Partial — phone/desktop/zoom/screen-reader and older-player usability testing are absent. |
| Hosting/release operations | Project is Next.js/Node 24 and the most recent available preview is Ready with no reported runtime errors. | Partial — latest commits have no hosted evidence during provider rate limiting; staging/production split, backups/restores, monitoring, rollback, domain, and enforced merge protection remain release gates. |

## Live service review

- Pilot migration history reaches the local foreign-key coverage repair.
- No new anonymous/PUBLIC table/function exposure or unindexed foreign-key
  finding was observed. Private RLS and authenticated role-checked RPC advisor
  notices remain intentional and documented.
- The hosted Email provider combines password and magic-link settings. The
  application exposes no password UI/API and raw provider accounts receive no
  tournament authority, so the paid leaked-password advisory is recorded but
  is not treated as a blocker for the supported magic-link app flow.
- The server-only `SUPABASE_SECRET_KEY` configuration cannot be inspected by
  the available hosting connector. Without it, the witnessed player-account
  activation flow must remain unavailable rather than degrade to unsafe
  browser identity matching.

## Conclusion

This cycle found and repaired three concrete future-risk gaps. No additional
P0/P1 defect was found in the implemented code or pilot schema during this
cycle. The application is nevertheless **not production-ready**: the missing
capabilities and external evidence listed above are release blockers, not
items a local build can verify away. The working outline remains active and
must not mark any incomplete group complete until its specific server,
browser, rule, and operational evidence exists.
