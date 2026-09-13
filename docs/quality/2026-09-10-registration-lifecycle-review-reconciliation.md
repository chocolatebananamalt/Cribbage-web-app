# Registration lifecycle review reconciliation — 2026-09-10

## Purpose

An earlier focused review reported potential registration-link lifecycle risks.
This record reconciles each finding against the current migration history,
route contracts, regression tests, and prior disposable/pilot evidence. It
does not treat an older review as a current defect when a later migration has
already repaired the risk.

## Acceptance criteria

For the disabled-by-default public-registration boundary:

1. a stale director cannot rotate or close a newer link;
2. an operation retry cannot recreate or disclose an earlier bearer
   credential;
3. closure is atomic with the active link and later check-in changes fail
   closed;
4. expired, retired, disabled, and closed links cannot appear usable; and
5. browser roles cannot invoke lifecycle database functions directly.

## Reconciled findings

| Earlier concern | Current evidence | Result |
| --- | --- | --- |
| Stale link/version could overwrite a newer link | Migrations `0078`–`0081` require and lock exact head ID/version for close and rotate. `tests/supabase-auth-semantics.test.mjs` asserts those predicates and grants. | Repaired |
| Close rejection was not durable or a missing head might pass incorrectly | `0079` records explicit head/link-found checks; close outcomes are immutable receipt-backed results. | Repaired |
| Rotation retry could use fresh credential material incorrectly | `0081` makes retry identity stable while excluding private credential material; `tests/registration-link-issuer.test.mjs` proves a replay withholds the credential. | Repaired |
| Registration could close without atomically disabling an active link | `0082` shares the lifecycle lock and closes tournament, head, and active link in one transaction. The recorded disposable execution proves initial closure and exact replay. | Repaired |
| A stale check-in could occur after registration closure | `0084` takes the same lifecycle lock and produces an auditable `registration_closed` rejection. Prior disposable execution recorded the rejection and exact replay. | Repaired |
| Expired/disabled/retired state could be represented as open | `0077` governs state classification; its explicit lifecycle predicates are covered by the semantic regression test. | Repaired |
| Lifecycle database functions might be browser-callable | Current migration contracts revoke `PUBLIC`, `anon`, and `authenticated` execution and grant only `service_role`. The pilot catalog audit recorded this for the five lifecycle functions. | Repaired/gated |
| Request bodies could be unbounded | The protected routes use the shared 2 KiB streaming JSON reader. Request tests prove malformed, declared oversize, actual oversize, and early-cancel rejection paths. | Repaired |

## Current finding

No P0/P1 defect is found in the reviewed current code path. Public
registration remains off by default, so the reviewed routes cannot be exposed
accidentally by a deployment lacking the explicit release setting.

## Evidence and limits

Source and static-regression evidence proves the intended contracts. Prior
disposable execution and the pilot catalog provide stronger database evidence
for function permissions and closure effects. They do **not** replace the
remaining release tests:

- independent authenticated browser sessions for claim-versus-close and
  rotate-versus-close races;
- phone and desktop browser verification of director operation and recovery;
- hosted passwordless-auth configuration and no-account probe; and
- a director-approved simulated tournament.

These are release gates, not newly discovered implementation defects.
