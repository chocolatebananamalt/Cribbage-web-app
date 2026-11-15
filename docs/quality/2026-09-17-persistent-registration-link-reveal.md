# Persistent registration-link reveal and public-name release evidence

**Date:** 2026-09-17
**Release:** PR #79 (`52ee24829bc6ab868cca4d01d65ea60e0a102357`), wording
follow-up PR #80 (`a84e54c63e19a2fdbb21684837e65e2944060214`)
**Production deployment:** `dpl_EdnT3sNTvAxdgck2pkJdRp8VCwT7` — READY

## Delivered behavior

- `0203_persistent_registration_link_reveal_and_name_parts` adds private,
  forced-RLS, append-only encrypted credential envelopes. It grants no direct
  browser role access. Existing registration-link `v2` functions remain in
  place so applying the schema does not interrupt an older deployed client.
- `v3` issue/rotation creates the envelope atomically with the existing
  digest-only link material. `reveal_registration_link_v1` validates the
  director/co-director role, current link/version, enabled lifecycle state,
  expiry, and tournament registration state before returning ciphertext to the
  application server. The route decrypts there, not in the database or
  browser, and writes a receipt/audit event that omits the bearer credential.
- The existing `get_registration_link_state_v2` response was intentionally not
  widened. A separate protected availability reader permits a new client to
  distinguish new/recoverable links from historic legacy links while the
  schema-first migration remains compatible with the old client.
- The live Genesis Rehearsal credential has no envelope. Production correctly
  renders one active status and the legacy warning without replacing, closing,
  or otherwise changing the link.
- New public claims use normalized first/last name fields and derive the
  pre-existing display-name projection. The public contact projection includes
  only primary-director display name and saved tournament phone/email/optional
  mailing address; no profile or home address is read.

## Commands and results

| Check | Result |
| --- | --- |
| `pnpm lint` | Pass |
| `pnpm exec tsc --noEmit` | Pass |
| Focused Node tests: issuer/token/options/persistent reveal | Pass, 21/21 |
| `pnpm verify` | Pass, 534/534 application checks plus audit, provider-readiness, optimized build, workspace checks |
| `pnpm verify:handoff` | Pass, 6/6 |
| `git diff --check` / staged diff check | Pass before merge |
| GitHub Verify | Pass on both PR #79 and #80 |
| Vercel Preview | Pass on both PRs |
| Production HTTP smoke | `/register` returned HTTP 200 |
| Production external-Chrome check | Signed-in registration workspace showed exactly one status line and the legacy warning; no replace/close action was taken |
| Vercel runtime errors | No error clusters in the selected one-hour Production range |

## Hosted database and deployment evidence

- Applied migration name:
  `persistent_registration_link_reveal_and_name_parts` to project
  `fnjkwymxpnsqvxtpronk`.
- Security/performance advisor review completed immediately afterward. The
  table follows the project’s deliberate private-table pattern: RLS forced,
  no direct policies, and direct public/anonymous/authenticated grants
  revoked. The advisor’s existing informational RLS/no-policy and unused-index
  inventory is not an application-access grant; no new broad policy was
  introduced.
- Production-only Vercel secret `ACC_REGISTRATION_LINK_REVEAL_KEY` was created
  as a Secret value. Its value is not retained in source, logs, this report,
  browser history, receipts, or audits.

## Deliberate verification boundary

The repeatable **View Active QR Code** / **View Active Link** happy path needs
a link issued or replaced under this release. Exercising that path against the
currently active Genesis link would deliberately invalidate the QR users are
already using. The owner requested that link remain active, so it was not
rotated merely for a test. The migration and route tests cover cryptographic
binding, public denial, role scope, legacy behavior, and response shapes;
the live legacy path is confirmed. When the director later chooses **Replace
Active QR Code and Link**, the first replacement is the safe live ceremony to
confirm repeated display/copy and unchanged version/expiry on view.
