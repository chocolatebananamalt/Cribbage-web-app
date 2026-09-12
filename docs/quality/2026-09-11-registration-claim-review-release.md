# Registration claim review release — 2026-09-11

## Acceptance criteria

- A director or co-director can see pending public registration claims inside
  the protected Players and Registration workspace.
- Approval and rejection are server-authorized, same-origin, immutable, and
  idempotently retryable after an ambiguous browser response.
- A possible duplicate cannot be approved until the director explicitly
  confirms that the claimant is a distinct person.
- The reason is optional and bounded. Rejection never requires a duplicate
  reference; duplicate-specific resolution remains available in the protected
  database contract when a suitable approved claim exists.
- Approval creates no roster row, role, payment, check-in, enrollment, seat,
  or verification ID. The existing separate roster-promotion action remains
  the only next step.

## Implementation evidence

- `src/lib/registration-claim-review-workspace.ts` strictly validates the
  existing director-scoped `get_registration_claim_review_workspace` result.
- `src/app/api/v1/tournaments/[id]/registration-claim-reviews/route.ts`
  requires same-origin and a verified subject, then calls only the existing
  authenticated `review_registration_claim` RPC. It accepts only an exact,
  authority-narrowing receipt.
- `registration-claim-review-client.tsx` displays the pending queue and stores
  only the exact opaque decision envelope in actor/tournament-scoped session
  storage until the server outcome is known. Shared-device sign-out clears the
  new prefix.
- Migration `0136` repairs the earlier review RPC so current director authority
  is checked before any receipt replay, rejection receipt, conflict record, or
  audit write. The accepted application receipt is also bound to the exact
  approve/reject decision requested by the browser.

## Verification

Executed from the repository root:

- `pnpm verify`: pass — dependency audit, lint, 325/325 application checks,
  production build, and workspace checks.
- `pnpm verify:handoff`: pass — 6/6 private handoff checks.
- `git diff --check`: pass.
- Supabase migration `0136_registration_claim_review_authority_repair` is
  applied to the approved pilot. Its rollback-only authority fixture passed,
  retained zero synthetic users, and the performance advisor reports zero
  unindexed foreign-key findings.
- Independent Sol high-risk re-review: GO with no remaining P0/P1 findings.
  The reviewer separately passed 96 focused claim/game/auth checks, focused
  lint, TypeScript, and diff validation. Its requested hosted rollout checks
  were completed against the pilot as recorded above.

Production deployment and browser evidence are recorded after independent
review and promotion. The live fictional claim is rejected through this screen
rather than promoted, so the October roster is not expanded by this test.
