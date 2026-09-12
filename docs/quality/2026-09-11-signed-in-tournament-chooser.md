# Signed-in tournament chooser verification

## Acceptance criteria

- A signed-in user sees every non-archived tournament having an explicit role
  or a checked-in participant identity for their profile, once, as a named workspace link.
- Multiple roles resolve to one documented deterministic role.
- Another user’s tournament and archived tournaments are absent.
- No roster, contact, or other member data is returned.
- An empty authorized list has a clear empty state and the demonstration link.
- A reader failure is not misrepresented as an empty membership list.
- Anonymous and authenticated browser roles cannot execute the private reader.
- The production page remains usable at phone and desktop widths.

## Local evidence

Executed from the repository root on 2026-09-11:

- Focused ESLint for the page, adapter, validator, and regression test: pass.
- `pnpm exec tsc --noEmit`: pass.
- `node --conditions=react-server --experimental-strip-types --test tests/tournament-chooser.test.mjs`:
  pass, 3/3.
- `pnpm test`: pass, 319/319 application tests.
- `pnpm build`: pass under Next.js 16.3.4; `/` remains dynamically rendered.
- `git diff --check`: pass.

`pnpm verify` now passes the complete audit, lint, 319-test, production-build,
and workspace gate. `pnpm verify:handoff` also passes 6/6.

The regression covers exact response validation, malformed fields, unknown
status/role, duplicate tournament rejection, archived/cross-profile SQL scope,
service-only grants, subject binding, workspace links, empty state, and demo
access. It also covers PostgreSQL UUIDs that use the correct hexadecimal shape
without RFC version/variant bits, matching an existing pilot record. The
permanent hosted fixture is `tests/tournament-chooser.sql`; it is
transaction-wrapped and retains no fictional rows when run successfully.

## Remaining release proof

Migration `0134` is applied to the approved pilot and its rollback-only fixture
passes, including implicit checked-in player discovery. Signed-in production
desktop and 375-pixel phone browser evidence remains pending deployment.
