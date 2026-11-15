# Registration-link state reader — 2026-09-10

## Acceptance criteria

- An eligible director/co-director can safely learn whether their tournament
  has no link or whether its current link is open, closed, or effectively
  expired after an ambiguous one-time issue response.
- The read is unavailable while registration is release-gated, and it returns
  no bearer credential, salt, digest, claim, or player information.
- The database independently rechecks the actor's current tournament role;
  browser database roles cannot execute the reader.

## Implementation and evidence

- Added service-only `get_registration_link_state_v2` and a release-gated,
  authenticated `GET /api/v1/tournaments/{id}/registration-links` boundary.
  Its strict response validator allows only the narrow state fields.
- Migration `0075_registration_link_state_reader` was applied to disposable
  synthetic project `donfxulkliuyteiannir` before pilot
  `fnjkwymxpnsqvxtpronk`.
- Disposable catalog proof: `anon` and `authenticated` execute privileges are
  false, `service_role` is true, and the function definition excludes salt,
  digest, and claim access.
- `pnpm lint`, `pnpm test` (**96** tests), `pnpm build`, `pnpm verify`,
  `pnpm verify:handoff`, and `git diff --check` all pass.

## Limitations

The state reader does not yet provide the director-facing rotate/close controls
or a real service-role/browser lifecycle test. The release switch remains off.
