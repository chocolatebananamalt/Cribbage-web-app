# Authorized private paper-card review evidence

Date: 2026-09-13

## Acceptance criteria

- A later eligible official can open the stored paper-card image from both
  independent paper/paper and mixed digital/paper review screens.
- The capture uploader, either game participant, an outsider, an unbound
  official, a wrong tournament/game/side, and a missing stored image receive no
  image metadata or bytes.
- The image stays in the private fixed bucket, is rechecked against its saved
  byte count and SHA-256 digest, and is streamed with private/no-store headers.
- No public or signed read URL is returned. Each accepted human-review
  authorization is an immutable access event. Reading an image cannot change a
  score or verify a game.

## Evidence

| Check | Result |
| --- | --- |
| Focused application/storage tests | PASS |
| Full application test suite | PASS — 459/459 |
| ESLint | PASS |
| Next.js production build | PASS; protected `paper-card-review-image` route compiled |
| Disposable Supabase migration 0162 | PASS |
| Disposable rollback lifecycle | PASS; independent read accepted, uploader and outsider denied, access event recorded, zero fixture rows retained |
| Pilot Supabase migration 0162 | PASS |
| Pilot rollback lifecycle | PASS with the same authorization and cleanup assertions |
| Database grants on both projects | PASS — `anon=false`, `authenticated=false`, `service_role=true` |
| GitHub clean CI | PASS — both clean verification jobs and Vercel preview on PR #28 |
| Production release | PASS — merge `f6442851e3797658d168b657bee81e2e84d86804`; deployment `dpl_HCGNoHJwfdEVYwe75fgSLdxLRH8z` READY |
| Stable production smoke | PASS — root/demo 200; anonymous review-image request 401 |
| Responsive live demo | PASS — 20 distinct screens at 320/640/1280 with no overflow, CSP, HTTP, console, or page errors |
| Post-release runtime errors | PASS — none in the selected one-hour window |

The remaining evidence is physical rather than an implementation claim: use
one authorized phone to upload a real anonymized test card, then a different
eligible signed-in official/session to reopen it, compare it, and confirm that
the access ledger increments. Live OCR activation is a separate future gate.
