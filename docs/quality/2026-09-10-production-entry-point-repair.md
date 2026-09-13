# Production entry-point repair — 2026-09-10

## Gap found

The root route deliberately rendered the synthetic review dashboard only on
localhost or a Vercel Preview hostname. On a production hostname it called
`notFound()`. This protected the prototype, but left an ordinary director or
player with no safe starting address for passwordless sign-in.

## Acceptance criteria

1. A production root request must render a neutral sign-in entry page, not the
   synthetic tournament dashboard and not a 404.
2. The entry page must link only to passwordless `/sign-in` and must not leak a
   tournament, player, registration credential, or review data.
3. Registration must still direct people to the director-issued QR or
   registration link rather than expose a generic public registration flow.
4. Localhost and protected Vercel Preview hosts must retain the review
   dashboard for approved design review.
5. The sign-in screen must not falsely say authentication is unconfigured
   after the public environment values have been set.

## Repair

- `src/app/page.tsx` now branches from the established
  `allowsReviewPrototype` boundary to a small neutral entry page with a
  `/sign-in` link. It still returns the synthetic dashboard only inside the
  existing review boundary.
- The permanent metadata now describes tournament operations rather than a
  prototype.
- The sign-in note now accurately describes passwordless email sign-in.
- The entry link has the same large, visible minimum-height treatment as the
  existing essential auth action.

## Executed verification

| Check | Result |
| --- | --- |
| Full `pnpm test` | Pass — 124 tests |
| `pnpm lint` | Pass |
| `pnpm build` | Pass — production route manifest includes dynamic `/` |
| Auth semantics regression | Pass — production boundary returns a safe sign-in link, retains the preview dashboard, and removes the stale configuration message |
| `git diff --check` | Pending final documentation update |

## Browser evidence limitation

I started the local Next development server and attempted the mandated visual
check. The configured `agent-browser` executable is not installed on this
host. The connected-browser fallback rejected `http://localhost:3000` with
`ERR_BLOCKED_BY_CLIENT`. Therefore no browser screenshot, viewport, or
keyboard evidence is claimed for this change. The hosted current-build browser
check is also blocked while Vercel is rate-limiting new builds. This remains a
release gate; the successful build and static regression test do not replace
it.
