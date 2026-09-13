# October payments, storage, OCR, and seating verification

**Date:** 2026-09-12 (Pacific/Honolulu)
**Scope:** Cash/check pilot, payment balances, private paper-card storage,
non-authoritative OCR adapter, and dynamic demonstration table plan.

## Acceptance evidence

- Per-tournament cash/check configuration requires at least one method.
- Public registration exposes and accepts only the current configured choices.
- Private finance derives owed, received, remaining, and status without
  coupling payment to check-in, seating, scoring, or results.
- A voided/full-refund receipt projects zero received. Exact accepted amount
  updates replay after tournament closure for a still-authorized director.
- Historical payment values remain readable; new `other` receipts are rejected.
- Private paper images use a normalized non-public 10 MiB JPEG/PNG/WebP bucket,
  opaque paths, current-role authorization, digest/size verification, and
  append-only receipts.
- A second signed upload is blocked after storage, while exact completion can
  reconcile a lost response. Receipt creation serializes per capture.
- Revoking the cross-checker role removes upload/completion authority.
- OCR input/output, text, time, and token bounds fail closed. OCR outputs remain
  non-authoritative drafts, and impossible/ambiguous cells are rejected.
- The demonstration table plan derives all tables from configured capacity;
  6 tables × 20 seats displays Tables A–F and 120 total seats.

## Commands and results

| Check | Environment | Result |
| --- | --- | --- |
| `pnpm verify` | Local Node 24 / production build | PASS — audit, lint, 446/446 application tests, provider preflight, build, workspace checks |
| `pnpm verify:handoff` | Local private handoff | PASS — 6/6 |
| Hosted migration 0159 | Disposable `donfxulkliuyteiannir` | PASS after correcting a reserved SQL alias; failed attempt was transactional |
| Hosted migration 0159 | Pilot `fnjkwymxpnsqvxtpronk` | PASS after correcting a reserved SQL alias; failed attempt was transactional |
| Hosted migration 0160 | Disposable and pilot | PASS |
| `tests/paper-card-capture.sql` | Disposable and pilot | PASS, rollback-only; no fixture rows retained |
| Supabase performance advisor | Pilot after 0160 | PASS for FK coverage — zero unindexed foreign keys; only informational unused-index notices |
| Supabase security advisor | Pilot | INFO only — private `app` tables intentionally use forced RLS, revoked grants, no browser policies, and server-only RPCs |
| Browser `/demo` | 1280×900 | PASS — score entry/review and dynamic table plan |
| Browser `/demo` | 320×800 | PASS — document width 320, no horizontal overflow |
| Axe WCAG A/AA | 320×800 `/demo` | PASS — 0 violations, 0 incomplete |
| Browser page errors | `/demo` | PASS — none |
| Focused Sol high-risk review | Current diff | GO — no residual P0/P1/P2 |

## Default-off and remaining evidence

- Online payments remain disabled. Cash/check operation does not depend on a
  processor.
- OCR remains disabled until a server-only provider credential, a real API
  probe, false-read review, access-event persistence, and approved user-facing
  provider-retention wording pass. `store: false` is not described as removing
  OpenAI abuse-monitoring or image-safety retention.
- Automated and rollback-only evidence does not replace the scheduled
  independent-session, real-device disconnect/reconnect, physical paper-card,
  failed-device reconstruction, and director rehearsal.
