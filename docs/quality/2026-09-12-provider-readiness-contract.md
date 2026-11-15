# Optional-provider readiness contract evidence

Date: 2026-09-12

## Acceptance criteria

- Online payments, SMS seating notices, and paper-card OCR default disabled.
- The October release remains deployable without their accounts or credentials.
- Enabling a provider with incomplete or invalid configuration fails closed and
  identifies the missing inputs.
- Secret-like provider values are rejected when exposed through a
  `NEXT_PUBLIC_` variable.
- Complete configuration is not called live activation; a real provider probe,
  failure-matrix evidence, and deliberate release action remain required.

## Implementation

- `src/lib/providers/activation-readiness.ts` is the typed release contract.
- `scripts/check-provider-readiness.mjs` exposes it as `pnpm providers:check`
  and supports an exact `--require=` capability gate.
- The standard `pnpm verify` release command runs the provider preflight before
  the production build; existing GitHub verification therefore enforces it.
- `.env.example` lists default-off flags and non-secret inputs; the operations
  plan separately names server-only credentials so the public template remains
  credential-name-free.
- `tests/provider-activation-readiness.test.mjs` covers default closure,
  invalid flags, missing Stripe inputs, the OCR capture prerequisite, the
  hosted/on-device OCR distinction, configured-but-not-activated boundary,
  and accidental public credentials by name, known prefix, and equality.

## Executed checks

Environment: Windows PowerShell, repository Node/pnpm toolchain.

- `pnpm providers:check` — pass; all three providers disabled and all October
  manual fallbacks declared.
- `pnpm providers:check --require=paper_card_ocr` — expected rejection; exit 1
  because OCR is disabled and no provider contract is configured.
- Synthetic complete Stripe configuration with the release flag disabled plus
  `--require=online_payments` — pass; reports `CONFIGURED; FEATURE DISABLED`.
- The same synthetic configuration with the unreleased flag enabled — expected
  rejection; exit 1 and an explicit unreleased-activation error.
- `node --conditions=react-server --experimental-strip-types --test
  tests/provider-activation-readiness.test.mjs` — 13/13 pass.
- `pnpm verify` — pass: dependency audit, lint, 423/423 application tests,
  production build, and workspace checks.
- `pnpm verify:handoff` — 6/6 pass.

## Limitations

This preflight proves configuration behavior, not third-party delivery. No
Stripe charge, SMS, image upload, or OCR request was made. Those providers are
optional after the October pilot and remain correctly disabled. Existing
manual workflows have separate application and release evidence.
