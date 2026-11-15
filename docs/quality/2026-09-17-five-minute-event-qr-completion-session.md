# Five-minute Event QR Completion Session — Verification Record

**Status:** Production deployed; full local and public fallback checks passed; physical rehearsal verification pending

## Acceptance criteria

- A current 60-second event QR can bootstrap exactly one opaque, event-scoped
  five-minute completion credential.
- The QR credential is removed from browser history after bootstrap.
- First name, Last name, Email, and uppercase ACC # are required; the server
  rejects malformed or expired submissions.
- The form shows a five-minute countdown with one-minute and thirty-second
  warnings, retains an unexpired session across reload, and requires a new scan
  after expiry.
- Existing check-in, payment, enrollment, duplicate, wrong-event, and
  closed-window enforcement remains server-authoritative.

## Evidence recorded before release

- Applied `database/migrations/0209_event_check_in_completion_sessions.sql` to
  the approved pilot Supabase project. Read-only inspection confirmed both
  protected RPCs exist.
- The new table has forced RLS and no `public`, `anon`, or `authenticated`
  grants. Supabase Advisor reports it as an intentionally policy-free,
  service-only RLS table; it exposes no browser access path.
- `node --conditions=react-server --experimental-strip-types --test tests/event-check-in.test.mjs`
  passed: **7/7**.
- `pnpm exec tsc --noEmit` passed before the final UI-only warning refinement.
- `pnpm verify` passed after the final change, including lint,  production
  dependency audit, application tests, provider checks, production build, and
  workspace tests.
- `pnpm verify:handoff` passed (**6/6**).
- Pull request #91 passed both GitHub `verify` jobs and its Vercel preview,
  then merged as `f8fb066a2cfbe4dfb3eb5541e43428148ed024b7`.
- Production deployment `dpl_92Pqd86oWNN7AMfbHYdGeCS93KXx` reached `READY`.
  A public `/event-check-in` smoke check showed the safe no-code state:
  “Scan the current QR code displayed at the event.” The route did not expose
  any tournament information.
- Vercel's runtime-error scan for `/event-check-in` and
  `/api/v1/event-check-in` found no errors after release; the deployment had no
  error/fatal runtime logs.

## Remaining verification

- Run production smoke checks for `/event-check-in` at phone and desktop sizes.
- Use a live event window in the supervised rehearsal to prove a scan at 59
  seconds, five-minute completion, expiry, reload, duplicate check-in,
  wrong-event rejection, and closed-window rejection across real devices.
- Review production runtime errors after deployment.
