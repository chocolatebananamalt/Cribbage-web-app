# Browser indexing hardening — 2026-09-10

## Acceptance criteria

- Every current application route sends an explicit instruction not to index,
  follow, or archive the page.
- The policy protects the sign-in, protected tournament, and review-preview
  surfaces without pretending to make them public search content.
- A future public-results feature cannot silently inherit a contradictory
  indexing posture; changing the policy requires an explicit privacy and ACC
  publication review.

## Change

Added the site-wide response header:

```text
X-Robots-Tag: noindex, nofollow, noarchive
```

The current app contains passwordless authentication, protected tournament
workspaces, and a review-only preview. It does not yet have an approved public
results publication workflow, so search indexing would be inappropriate.

## Evidence and limits

- `tests/supabase-auth-semantics.test.mjs` now asserts the header alongside
  existing anti-framing, no-referrer, MIME-sniffing, device-permission, and
  DNS-prefetch protections.
- `pnpm verify` and `pnpm verify:handoff` passed after the change.
- GitHub Actions verification run `34479538460` for commit `4faa088` passed.
- Vercel Preview deployment `dpl_DmcKzD2g5vDkgkxm5PAxkpe5UG48` from that
  commit reached `READY`. A hosted fetch of `/sign-in` returned HTTP 200 and
  the exact `x-robots-tag: noindex, nofollow, noarchive` header alongside the
  existing no-referrer, anti-framing, MIME-sniffing, device-permission, and
  DNS-prefetch headers. No sign-in email was requested or sent.

This header asks compliant crawlers not to index a response; it is not an
authorization mechanism and does not replace the server-side membership,
role, and no-store protections already required for sensitive data.
