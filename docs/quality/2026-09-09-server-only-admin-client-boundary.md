# Server-only admin-client boundary — 2026-09-09

## Acceptance criteria

- A privileged Supabase client can be constructed only in a module marked
  `server-only`.
- It accepts only a non-empty modern `sb_secret_` API key and never uses a
  public environment-variable name.
- The browser client, cookie-backed server-session client, and committed
  environment example remain free of the secret-key identifier and values.
- Its auth settings do not persist, refresh, or parse a session URL.
- A production build made with a synthetic secret canary contains neither the
  canary nor the secret environment-variable identifier in `.next` output.

## Evidence

- Focused Sol design review: approved the unused helper with no P0/P1 in the
  helper itself. It requires every future caller to independently validate
  session claims, actor, role, tournament scope, and idempotency before using
  any narrowly scoped server-only database transaction.
- `pnpm lint`: pass.
- `pnpm test`: 74 pass, including absent, blank, whitespace, malformed, and
  valid secret-key configuration cases.
- Production `pnpm build` was run with synthetic, non-credential canaries for
  the private and public Supabase values. A recursive scan of `.next` found no
  private-key canary and no private environment-variable identifier.
- `pnpm verify`, `pnpm verify:handoff`, and `git diff --check`: pass.

## Limits

This is a configuration and import boundary only. It does not yet activate or
link any account, does not provision a Vercel secret, and does not waive the
real-session, direct-RPC-denial, server-route, concurrency, or rollback tests
required before the activation flow can be released.
