# Local build exposure audit — 2026-09-09

## Scope

Inspect the tracked deployment-facing source, public asset directory, and the
current local production build for accidental inclusion of server-only
Supabase credentials or private handoff material.

## Acceptance criteria

1. No tracked environment file contains a deployed credential.
2. The browser build contains neither the server-only Supabase module nor a
   server secret environment identifier or secret-key-shaped literal.
3. Public assets are limited to intentionally published branding, Rulebook,
   and anonymized sample material.
4. Private source material and local scratch files remain untracked.

## Executed evidence

- A source scan found the server-only key boundary only in
  `src/lib/supabase/private-admin.ts`; the module is explicitly marked
  `server-only` and reads `SUPABASE_SECRET_KEY` only at server execution time.
- `.env.example` contains only empty public Supabase placeholders. No tracked
  local environment file was found.
- The local production browser bundle has no reference to `private-admin`, no
  `SUPABASE_SECRET_KEY` identifier, and no secret-key-shaped literal.
- The public directory contains only the intentionally published ACC logo,
  permitted cached Rulebook PDF, and anonymized qualifier sample PDF.
- The local `tmp/` directory remains untracked; it was not inspected,
  modified, or included in this audit.
- `git diff --check` passed.

## Limits and follow-up gates

This is a local build scan, not proof about future platform logs, browser
telemetry, uploaded artifacts, or environment settings. The fragment-only QR
registration implementation remains a separate gated change and must include
the platform/browser canary scans defined in its lifecycle contract before
pilot release.
