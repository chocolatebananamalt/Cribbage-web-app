# Structured tournament contact information — verification record

**Date:** 2026-09-15
**Scope:** Category 2 prerequisite for Full Rehearsal setup

## Delivered behavior

- Tournament Setup now requires a selected tournament contact phone and email,
  shows the primary director name from the tournament role, and accepts an
  optional player-facing mailing address.
- The registration options contract returns only those selected contact fields.
  It does not read an account or profile address.
- Legacy free-text `contact_details` is retained as historical setup data only.
  New setup saves use structured contact fields and activation rejects a
  revision without required contact information.

## Database evidence

- Applied `0193_structured_tournament_contact_information` to approved pilot
  project `fnjkwymxpnsqvxtpronk`.
- A disposable-project fixture initially revealed that updating an immutable
  setup revision was invalid. The migration was corrected to write structured
  fields at immutable insert time through a transaction-local, guarded trigger;
  the standard setup fixture then passed.
- Production read-only checks confirmed migration presence, all three columns,
  authenticated access only to the setup reader/writer, and service-only access
  to setup activation and public-registration option retrieval.
- Supabase security/performance advisors were run after the DDL. Their reported
  project-wide baseline notices were not introduced by this column/function
  migration; no new publicly executable mutation function was granted.

## Automated checks

| Check | Result |
| --- | --- |
| Contact contract regressions | Pass — required phone/email, optional multiline address, legacy repair path, selected-only public contract |
| `pnpm verify` | Pass — 513/513 application tests plus audit, lint, provider check, production build, workspace/handoff checks |
| `pnpm lint` | Pass |
| `pnpm build` | Pass — Next.js 16.3.4 optimized production build |
| `git diff --check` | Pass |

## Deployment evidence

- Pull request `#49` was merged after its GitHub verification and Vercel
  preview checks passed.
- Production deployment `dpl_utx7S8SvpbHCndbtetTnTbLE6Bs9` for main commit
  `2bf9f1cba61bd6b0216a00fe62309b0a2c884e7c` is `READY` at
  `https://cribbage-web-app.vercel.app/`.
- The production root returned HTTP 200 with the expected no-store and browser
  hardening headers. An external-Chrome smoke check loaded the signed-in
  tournament chooser without an error overlay. Vercel recorded no runtime
  errors and no error/fatal logs for this deployment after the smoke request.

## Remaining release evidence

- Verify the protected Setup screen at phone and desktop widths with a real
  authorized director session, including required-field errors and multiline
  address display.
- Verify a registration/flyer-facing contact view with an issued rehearsal
  registration link. No private account address may appear.
