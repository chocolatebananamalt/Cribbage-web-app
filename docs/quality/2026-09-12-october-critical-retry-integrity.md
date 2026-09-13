# October-critical retry integrity audit

Date: 2026-09-12  
Scope: setup, roster/check-in, seating, results, and financial mutation clients

## Confirmed defect and repair

Several browser workflows treated any HTTP 409 response as a definitive business rejection. A malformed proxy response, unrelated application response, or incompatible server version could therefore clear the saved idempotent retry even though the authoritative outcome was unknown.

The repaired workflows clear their saved retry only after validating an exact, known server rejection envelope:

- tournament setup draft save;
- registration closure from the seating workflow;
- qualification finalization;
- supervised playoff placement recording; and
- provisional settlement working-copy saves.

Setup success responses are also exact-shape validated so an authority-expanding mixed response cannot be accepted. Registration closure now returns the database's validated rejection envelope through the API instead of replacing it with a generic error body. Definite playoff and settlement rejections restore server-derived editor values; malformed or unknown 409 responses remain locked for reconciliation.

Roster promotion/import/manual-entry, check-in, initial seating, payment, and expense clients already required exact controlled rejection envelopes and were not changed.

## Acceptance criteria

- A recognized exact 409 business rejection clears the retry and refreshes authoritative state.
- An unknown code, extra-field response, generic error, or malformed 409 keeps the exact request locked.
- Accepted setup responses reject extra authority-bearing fields.
- No payout, Q-pool, MRP, or ACC-reporting rule is added or inferred.

## Verification

- `node --conditions=react-server --test --experimental-strip-types tests/october-critical-retry-integrity.test.mjs tests/setup-workspace-ui.test.mjs tests/qualification-finalization.test.mjs tests/standard-singles-playoff-placements.test.mjs tests/settlement-draft.test.mjs tests/supabase-auth-semantics.test.mjs` — PASS (58/58).
- `pnpm exec tsc --noEmit` — PASS.
- `pnpm verify` — PASS: dependency audit, lint, 369/369 application tests, production build, workspace and private-handoff integrity checks.

## Limits

This is local contract and regression proof. No hosted data was mutated. Real independent-session, offline/reconnect, phone/desktop, and full tournament rehearsal evidence remains separate.
