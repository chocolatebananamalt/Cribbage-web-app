# Production Rulebook reference — 2026-09-09

## Scope

Close the production-route gap between the Start Here guidance and the already
permitted ACC Rulebook asset. This increment is a navigation/reference feature
only. It does not encode, calculate, or adjudicate an ACC rule.

## Acceptance criteria

1. An authorized tournament user can open a protected Rulebook route from both
   the tournament workspace and Start Here guidance.
2. The route displays the selected cached ACC 2025 edition, capture date, and
   full recorded SHA-256 checksum; it offers distinct cached and online links.
3. The quick reference is searchable but explicitly a navigation aid, never an
   official rule interpretation.
4. External navigation prevents opener/referrer disclosure.
5. The cached PDF bytes continue to match the recorded approved asset.

## Executed evidence

- `Get-FileHash public/rulebook/acc-rulebook-2025.pdf -Algorithm SHA256`
  returned `DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD`,
  matching `PRD-001`.
- `pnpm lint` passed.
- `pnpm test` passed with 76 tests, including the protected route, dated
  source metadata, cache/online links, no-referrer external links, searchable
  reference wording, and Start Here/workspace navigation assertions.
- `pnpm build` passed and lists dynamic route
  `/tournament/[tournamentId]/rulebook`.

## Limits

This establishes source integrity and route behavior, not ACC rule-policy
fixtures. Phone/desktop visual inspection of the authenticated route remains
required before release because the current browser surface cannot establish an
authenticated test user for this private pilot. The public cached PDF is only
permitted because the recorded 2026-09-07 user authorization and checksum
metadata remain in force; a later edition or changed official asset requires a
new source/copyright review.
