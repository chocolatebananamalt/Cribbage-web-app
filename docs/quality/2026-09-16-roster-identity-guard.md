# Roster identity guard and safe correction — 2026-09-16

## Scope

This release closes the cross-source duplicate path that allowed the same
participant to be created once by manual intake and again by public
registration. It also replaces destructive roster deletion with an append-only
active-roster withdrawal and reinstatement operation.

## Production database evidence

- Migration `0205_roster_identity_guard_and_withdrawal.sql` was applied to the
  production Supabase project on 2026-09-16.
- The existing Genesis Rehearsal duplicate was resolved using the protected
  `set_roster_entry_active_status_v1` function. The Manual-source identity is
  inactive with reason `Duplicate entry`; the Registration-source identity is
  still the sole active identity for that participant.
- The correction was only permitted after confirming neither record had
  payment, check-in, event enrollment, seating, schedule, or scoring activity.
  The original roster and registration evidence were retained.

## Automated checks

| Check | Result |
| --- | --- |
| `node --test tests/roster-identity-guard.test.mjs tests/manual-roster-intake.test.mjs tests/game-api-semantics.test.mjs` | Pass |
| `pnpm exec tsc --noEmit` | Pass |
| `pnpm lint` | Pass |
| `pnpm verify` | Pass (539 application tests, dependency audit, lint, production build, workspace checks) |
| `pnpm verify:handoff` | Pass (6/6) |
| `git diff --check` | Pass |

## Behavioral coverage

- ACC-number collisions are hard rejections across public, manual, promotion,
  and CSV intake.
- With no ACC number, an exact normalized first-name, last-name, and email
  collision is a hard rejection. Name-only and email-only similarities require
  director review rather than silently rejecting a potentially distinct person.
- Transaction-scoped advisory locks serialize competing identity writes.
- New ACC input is uppercase-normalized and server-validated as
  `^[A-Z]{2}\\d+$`; historical records are not rewritten.
- Director/co-director withdrawal and reinstatement actions are role-protected,
  idempotent, reasoned, and append-only. Records with downstream operations,
  or any attempt after event play starts, are rejected instead of being
  silently rewritten.

## Release and remaining evidence

Pull request [#84](https://github.com/chocolatebananamalt/Cribbage-web-app/pull/84)
was merged to `main` as `7f97f602ca379f837473491fa5f62cd0b3aac1de`.

The remaining acceptance evidence is a signed-in browser rehearsal of the
released roster workspace at phone and desktop widths. It must demonstrate the
one active participant, the director-only resolved-record history, and a
fresh duplicate rejection without entering real player data.
