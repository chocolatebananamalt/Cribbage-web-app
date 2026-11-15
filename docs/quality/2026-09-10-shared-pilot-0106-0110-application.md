# Shared pilot migrations 0106–0110 application

Date: 2026-09-10
Target: shared Supabase pilot `fnjkwymxpnsqvxtpronk`
Authorization: owner-approved controlled pilot update
Release switches: unchanged and disabled

## Acceptance conditions

- Apply the exact reviewed source migrations 0106 through 0110 in order only
  after the full local suite, isolated database fixtures, and independent Sol
  review have no blocking finding.
- Do not create a user, tournament, score, correction, setup activation,
  paper-card capture, or finalization record.
- Keep browser execution revoked from every new service-only writer and
  readiness reader. Preliminary standings may remain intentionally available
  only to an authenticated current tournament member through its internal
  authorization predicate.
- Do not enable any hosted feature switch.

## Executed evidence

- `pnpm verify`: PASS; no known production vulnerability, lint passed, 214/214
  application checks passed, production build and workspace checks passed.
- `pnpm verify:handoff`: PASS; 6/6 private handoff checks passed.
- Isolated Supabase rollback fixtures: PASS for Rule 12.2(b) correction,
  correction-aware preliminary standings, setup activation, cross-checker-only
  paper capture, and blocked-only finalization readiness.
- Independent Sol review: no remaining P0/P1 and no proof gap blocking the
  controlled shared-pilot application with release switches disabled.
- Ordered migration application: all five calls returned success. The shared
  migration ledger now ends with 0106, 0107, 0108, 0109, and 0110 in order.
- Postflight privilege/data check: anonymous and authenticated execution is
  false for the Rule 12 writer, paper capture writer, setup activation writer,
  and finalization readiness reader; service-role execution is true for the
  readiness reader. Independent corrections, setup activations, and paper-card
  captures all remain at zero rows.
- Postflight advisors: no unindexed foreign-key finding for the new correction,
  setup-activation, or paper-card tables. RLS-without-policy notices are the
  intentional deny-all design for private `app` tables. The preliminary
  standings security-definer warning is expected: execution is restricted to
  authenticated callers and the function requires `auth.uid()` membership in
  the exact tournament before returning data.

## Result and limits

The shared pilot schema is current through 0110 without enabling an unfinished
workflow or adding sample data. This is not production certification. Hosted
feature flags remain disabled, live independent-session proof remains pending,
and finalization continues to report missing lifecycle, schedule, seating,
finance, dispute, attachment, result-version, and approval authorities.
