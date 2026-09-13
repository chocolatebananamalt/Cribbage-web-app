# Source and dependency exposure audit — 2026-09-10

## Acceptance criterion

Verify that the tracked source does not contain a high-confidence credential,
that private handoff material cannot be committed by the current ignore rules,
and that the production dependency tree has no known high-severity advisory.

## Executed checks

| Check | Result |
| --- | --- |
| `.gitignore` inspection | Covers `.env`, `.env.*`, key/pem files, token JSON, private handoff imports, private documentation, prototype/archive artifacts, build output, test reports, and ZIPs. `.env.example` is deliberately retained. |
| Tracked executable-source secret scan | Pass — no high-confidence `sb_secret_`, populated `SUPABASE_SECRET_KEY`, GitHub personal token, AWS access key, or private-key material pattern in `src`, `public`, scripts, workflow, package, lock, config, or `.env.example` files. |
| Tracked private-artifact scan | Pass — no tracked private handoff/document/prototype artifact. The only tracked `imports/` file is the non-sensitive `imports/README.md`; the only tracked environment example is `.env.example`. |
| `pnpm audit --prod --audit-level=high` | Pass — no known vulnerabilities found. |

## Interpretation

This is a repository-level exposure check, not proof that a secret has never
appeared in an untracked local file, Git history, a hosted provider, or a
third-party build log. The project continues to prohibit committing personal
credentials, player data, ACC portal passwords, or Supabase/Vercel server
keys. A production release still needs provider-side secret review and a
recorded key-rotation/revocation procedure.

No files outside this evidence record were changed by the audit.
