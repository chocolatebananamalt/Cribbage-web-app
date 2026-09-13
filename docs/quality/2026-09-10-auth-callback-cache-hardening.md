# Magic-link callback cache hardening — 2026-09-10

The passwordless callback receives a one-time exchange code in the request
URL. It now marks every redirect response `private, no-store`, including
missing-code and failed-exchange redirects that do not set a session cookie.
The semantic regression test asserts this response boundary.

`pnpm verify` passed (audit clean, lint, 124 application tests, production
build, workspace checks); `pnpm verify:handoff` and `git diff --check` also
passed locally.
