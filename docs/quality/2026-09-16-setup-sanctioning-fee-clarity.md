# 2026-09-16 setup clarity and calculated sanctioning fee evidence

## Implemented scope

- Replaced the setup contract's editable tournament-wide sanctioning total
  with Main/Consolation rates, validation, a calculated workspace projection,
  immutable rate-override history, and immutable Start Play snapshots.
- Added the protected, same-origin, verified-subject rate-override route.
- Updated finalization, contact-field, mailing-address, and shared-device UI
  clarity in the protected setup flow.

## Automated evidence

- `pnpm lint` — pass.
- `pnpm build` — pass.
- `node --test tests/sanctioning-fee-clarity.test.mjs tests/structured-tournament-contact.test.mjs` — 7/7 pass.
- Hosted Supabase migration `calculated_sanctioning_fee_rates` — applied.
- Hosted schema query confirmed all six rate/evidence columns, the preserved
  legacy `sanctioning_fee_cents` column, the workspace/override/start RPCs,
  and service-role-only override execution.
- `pnpm verify` — pass, **520/520** tests.
- `pnpm verify:handoff` — pass.
- Production pull request #57 was merged as main commit
  `6847e1a3f343924e1f92d79a68e6478751e967a6`; Vercel deployment
  `dpl_J3id1ohwZJKmvwsvoUtrNBasCtaN` is READY.
- Public root and sign-in HTTP smoke probes both returned 200. Vercel build
  errors and runtime-error clusters were empty in the post-release scan.

## Deliberate limitations

The director's existing browser has unsaved rehearsal setup values and was not
reloaded during this implementation. Protected phone/desktop visual proof,
an authorized rate override, and an actual Main/Consolation Start Play snapshot
remain rehearsal checks after the deployment is live.
