# Public registration pilot — 2026-09-09

## Scope and acceptance criteria

This bounded pilot implements the public QR/link portion of `R-REG-01`. A valid link must permit a visitor to submit a private registration claim while registration is open, but it must never grant a role, create an event participant, assign a Table/Seat, confirm payment, or expose roster/claim data.

The positive path is one accepted, idempotent claim. Rejection paths are malformed requests, invalid/closed links, direct private-table access, duplicate identity claims, and mutation of an original submitted claim.

## Executed evidence

| Check | Result |
|---|---|
| `pnpm lint` | Pass |
| `pnpm test` | Pass — 29 tests, including static boundary/rejection coverage for registration |
| `pnpm build` | Pass — compiled the dynamic public registration page and API route |
| Anonymous pilot registration transaction | Pass — a valid synthetic token returned only the tournament name; the first synthetic claim returned `received`; a retry with the same operation ID returned `received` without a second record; an equivalent second claim was recorded as private `needs_review`; closing registration returned `unavailable`; transaction rolled back |
| Private-data boundary | Pass — `anon` has neither `SELECT` nor `INSERT` table privileges on `app.registration_claims`; only the narrow public RPC can create a claim |
| Claim immutability transaction | Pass — a direct update attempt returned `immutable history`; transaction rolled back |
| Replay and abuse-control transaction | Pass — changing data while reusing an operation ID returned `idempotency_conflict`; configured per-link capacity and hourly limits returned `registration_capacity_reached` and `registration_rate_limited`; only the first claim existed in the test transaction |
| Canonical fingerprint collision regression | Pass — two synthetically valid but distinct field sets that previously collided through `|` concatenation returned `received` then `idempotency_conflict` with the same operation ID; transaction rolled back |
| Migration-chain repair review | Pass — the chain now conditionally adds the fingerprint constraint, temporarily removes/reinstates claim immutability only for the controlled backfill, and uses canonical JSON fingerprints in both fresh and pilot-repair paths |
| Supabase performance advisor | Pass after remediation — added the missing `registration_claims.registration_link_id` index; no unindexed foreign-key finding remains for the registration tables |
| Supabase security advisor | Reviewed — RLS-without-policy notices are expected because direct access to the private `app` schema is revoked. The two anonymous SECURITY DEFINER warnings are intentional for the token-gated context/claim endpoints; their scope is covered by the direct grant, RLS, no-escalation, and database transaction checks above. |
| Hosted preview smoke test | Pass — Vercel Preview deployment `dpl_HiNqnX8is9tLTRfnf2Qv3P9rdsER` from commit `f883a3b` rendered the dashboard and its intended top-level controls. A synthetic closed-link registration URL rendered the generic unavailable state without revealing tournament, roster, or claim data. No runtime-error clusters were reported for the project after the check. |

## Limitations and next gates

- No public link is enabled permanently in the pilot and no real player data was inserted.
- Director/co-director claim review, roster promotion, account-linking,
  audited manual-payment receipt, check-in, shared-device clearing, and
  immutable initial seating now have protected pilot boundaries. They were
  added after this narrow registration report and remain incomplete without
  real independent-session and full-lifecycle evidence. A public claim is
  still non-authoritative until those later workflow gates are successfully
  completed.
- The public UI needs a hosted browser pass using a temporary synthetic link after the reviewed deployment is available. It must not be tested by submitting real player information.
- The database enforces configurable per-link total/hourly claim caps. Before a production flyer URL is opened, add operational edge/WAF rate limits and monitoring as a second layer; database caps protect integrity but cannot identify a network source by themselves.
