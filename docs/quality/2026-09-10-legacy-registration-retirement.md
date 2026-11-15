# Legacy Public Registration Retirement — 2026-09-10

## Purpose

Retire the unsafe URL-path bearer-token registration implementation before it
can be released. This intentionally leaves public tournament signup disabled;
it does not create a v2 replacement.

## Acceptance criteria

1. The legacy dynamic page, API route, and public client helper are absent.
2. Migration `0070` rejects incoherent historical claim/link state, disables
   every legacy link, and revokes/drops both anonymous RPCs without deleting
   historical claims.
3. The migration succeeds against the disposable synthetic database before the
   separate pilot, with aggregate-only checks proving no active legacy surface.
4. Application checks pass and the hosted Preview no longer serves the old
   route.

## Database evidence

The migration was applied to `donfxulkliuyteiannir` first, then
`fnjkwymxpnsqvxtpronk`. Aggregate checks in each environment returned:

- `links: 0`
- `enabledLinks: 0`
- `orphanOrMismatchedClaims: 0`
- `functionsRemaining: []`

No raw token, player, claim, tournament, or payment detail was read. A fresh
security-advisor check also no longer reports the former anonymous executable
function finding.

## Local verification

Run locally on 2026-09-10:

```text
pnpm lint                 PASS
pnpm test                 PASS (84 tests)
pnpm build                PASS (Next.js 16.3.4)
pnpm verify               PASS
pnpm verify:handoff       PASS
git diff --check          PASS
```

## Hosted verification

Vercel Preview deployment `dpl_2iWed624oBafxNrjsR8Cp9eBPagg` for commit
`c4e33ce` reached `READY`. Fetching the former dynamic-path shape
`/register/not-a-valid-registration-token` returned the application 404 page,
not a registration page. The Vercel runtime-error summary for the project had
no error cluster in the preceding 30 minutes.

## Remaining boundary

The app has no public registration flow now. A production-capable v2 flow
still needs director-authorized issue/rotate/close/audit operations, an
opaque fragment-only browser bootstrap, server-only credential configuration,
safe public claim handling, and independent browser/network evidence.
