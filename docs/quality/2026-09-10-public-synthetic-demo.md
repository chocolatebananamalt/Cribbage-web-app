# Public synthetic demonstration verification

Date: 2026-09-10 (Pacific/Honolulu)

## Acceptance criteria

1. A visitor can open `/demo` directly without creating an account or
   requesting an email link.
2. The page persistently identifies itself as public sample data and states
   that nothing is saved and no real tournament information is available or
   changed.
3. The demonstration has no database, Supabase, application API, or server
   mutation path.
4. Registration and tournament workspaces remain protected by their existing
   authentication and tournament-role checks.
5. Focused tests, full repository verification, a Vercel Preview build, an
   anonymous live request, and a post-deployment error/mutation scan pass
   before the URL is shared.

## Implementation

`src/app/demo/page.tsx` now renders the existing client-only synthetic
dashboard without resolving a Supabase subject. The banner and sign-in link
make the public demonstration boundary explicit. No operational route or data
adapter changed.

## Evidence

- Focused dashboard and authentication tests: PASS, 44/44.
- `pnpm verify`: PASS, including dependency audit, lint, 217 application
  tests, production build, workspace checks, and clean-clone safety checks.
- `pnpm verify:handoff`: PASS, 6/6 recovered-source integrity and
  characterization checks.
- Local anonymous request: `/demo` returned HTTP 200 with the public banner
  and fictional fixture.
- Local request carrying an expired sample cookie: `/demo` returned HTTP 200,
  demonstrating that the route bypasses session refresh.
- Local protected-route request: rejected with HTTP 503 because the isolated
  local server intentionally had no Supabase configuration; it did not expose
  tournament content.
- External Chrome desktop check: PASS. The public banner, fictional sample
  tournament, score-entry controls, 88-point double-skunk calculation, and
  Review Result navigation rendered without an error overlay.
- The linked qualification PDF was regenerated from fictional fixtures and
  rendered to PNG at 144 DPI. Visual inspection found no clipping, overlap,
  broken table, or unreadable text.
- The two local PDFs reachable from the demonstration now bypass session
  refresh alongside `/demo`; focused regression coverage requires this order.
- Production-mode local requests carrying an expired sample cookie returned
  HTTP 200 for `/demo`, `/sample/qualifiers-summary.pdf`, and
  `/rulebook/acc-rulebook-2025.pdf`. Both PDFs returned `application/pdf`.
- PDF text extraction with `pypdf` confirmed the expected fictional fixture
  and rejected every prior source-derived name, tournament, place, and date.
- Narrow-phone layout remains covered by the scorecard responsive-layout and
  touch-scrolling regression tests. The available external-browser control
  could not resize the Chrome viewport during this run.
- Final independent re-review, Vercel Preview, production promotion, anonymous production request, and
  production log scan: pending.

## Preview-only issue found after the initial checks

Vercel Preview rendered the interface but did not hydrate its controls. The
strict CSP used a request nonce while `/demo` was statically generated, so its
build-time scripts had no nonce. The route now uses Next.js `connection()` to
force per-request rendering, following the installed Next.js CSP guidance.
The corrected deployment must show `/demo` as dynamic and pass a real button
interaction before promotion.
