# Optional provider launch boundary — verification

Date: 2026-09-12

## Acceptance criteria

- The October release remains usable without Stripe, an SMS provider, or an
  OCR provider.
- The requirements, durable memory, working outline, and status agree that
  audited manual payments, printed seating, and human paper-card workflows are
  the required fallback paths.
- Optional provider work has explicit external dependencies, activation
  gates, rejection tests, and authority limits.
- No provider is enabled and no production scoring/database behavior changes.
- The clean-clone and private-handoff verification suites still pass, and the
  stable public application endpoints remain healthy.

## Evidence

- Repository inspection confirmed live protected routes and tests for manual
  payments/voids, seating/printing, paper-versus-paper completion, hybrid
  digital/paper completion, and failed-device recovery.
- Supabase query against project `fnjkwymxpnsqvxtpronk` returned no rows from
  `storage.buckets`; the OCR upload/storage path is therefore correctly listed
  as unavailable rather than partially enabled.
- Vercel Marketplace review on 2026-09-12 found Stripe as the sole native
  payments integration. Its Messaging category did not list a native SMS
  transport.
- `pnpm verify`: PASS — 407/407 application tests, dependency audit, lint,
  Next.js 16.3.4 production build, workspace/recovery checks.
- `pnpm verify:handoff`: PASS — 6/6 private-handoff checks.
- `git diff --check`: PASS (line-ending notices only).
- `GET https://cribbage-web-app.vercel.app/demo`: HTTP 200 and contains Score
  Entry.
- `GET https://cribbage-web-app.vercel.app/sign-in`: HTTP 200.
- Vercel Production runtime-error scan for the prior 24 hours: no runtime
  errors.
- Supabase advisors: performance has information-only unused-index findings;
  security retains the previously accepted password/free-plan and intentional
  signed-in SECURITY DEFINER/RLS notices. No schema change was made in this
  pass.

## Remaining limitations

- Provider-backed online payment, SMS, and OCR are not implemented or enabled;
  they are optional enhancements with the gates in
  `docs/operations/PROVIDER_ACTIVATION_PLAN.md`.
- Independent people/devices, disconnect/reconnect, backup/restore, and the
  director walkthrough remain physical acceptance work. Automated checks do
  not substitute for that rehearsal.
