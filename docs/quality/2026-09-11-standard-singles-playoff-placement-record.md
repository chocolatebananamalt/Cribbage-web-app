# Standard Singles playoff placement acceptance evidence

**Date:** 2026-09-11  
**Scope:** Migration 0139, server API, director UI, and provisional settlement binding

## Observable acceptance criteria

- Only a server-authenticated tournament director or co-director can read or
  record playoff placements.
- The input is bound to the latest locked Standard Singles qualification
  version and contains at least winner and runner-up, with unique qualifying
  participants and sequential places beginning at one.
- Every accepted change appends an immutable version. Exact retries return the
  original receipt; changed reuse and stale versions are rejected.
- Every accepted or ordinary authorized rejection writes an immutable audit
  event bound to its operation receipt. Changed-key reuse remains captured in
  the dedicated immutable idempotency-conflict history.
- The reader and UI visibly distinguish playoff finish from qualifying rank.
- New settlement drafts reference one exact playoff result and reject
  participant/place claims that do not match it.
- No MRP, Q-pool, prize, payout, bracket, publication, approval, or ACC export
  rule is inferred or activated.

## Non-goals

- Automatic playoff brackets or bye accounting
- MRP calculation or persistence
- Q-pool and prize calculation
- Public results publication or official ACC export

## Verification

- A subsequent independent high-risk review found and this slice repaired
  three release-significant boundaries: client retry envelopes no longer enter
  the exact request codecs or request bodies; current open-tournament and
  director/co-director authority is established before receipt lookup or
  conflict history; and rejected-operation handlers reacquire the
  actor/operation lock, reauthorize, then reconcile an existing receipt before
  inserting. Playoff and settlement writers also share an event-scoped
  post-event advisory lock.
- `pnpm exec node --conditions=react-server --experimental-strip-types --test
  tests/standard-singles-playoff-placements.test.mjs
  tests/standard-singles-settlement-draft.test.mjs
  tests/settlement-draft.test.mjs`: PASS, 14/14 after those repairs.
- Targeted ESLint for both settlement clients and the playoff regression test:
  PASS.
- `pnpm build`: PASS with Next.js 16.3.4, including TypeScript and the playoff,
  settlement, and reconciliation route inventory.
- Focused `git diff --check`: PASS (line-ending notices only).

- `node --test tests/standard-singles-playoff-placements.test.mjs
  tests/settlement-draft.test.mjs tests/settlement-working-copy.test.mjs`:
  PASS, 11/11.
- `pnpm exec tsc --noEmit`: PASS.
- After the audit-only SQL/test amendment, a repeat TypeScript check was
  unavailable because concurrent Rule 12 work left generated `.next` types
  pointing at two temporarily absent correction routes. The audit amendment
  itself changes no TypeScript; the focused Node suite remained green.
- `pnpm exec eslint src`: PASS.
- Full shared-tree verification was intentionally left to the lead because
  other agents have concurrent changes in the same worktree.
- Migration `0139` was applied to the approved Supabase pilot on 2026-09-12.
  Its playoff proof passed in one rollback-only synthetic transaction seeded
  with two exact qualifiers; exact retry, stale rejection, changed-key
  conflict, immutable version chain, audit binding, and private grants all
  passed with no retained fixture records.
- Browser verification and independent authenticated sessions remain required
  for the protected playoff editor.
