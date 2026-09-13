# Private paper-card upload UI — 2026-09-13

## Acceptance criteria

- An authorized paper-game official can select a JPEG, PNG, or WebP image no
  larger than 10 MB from both paper/paper and mixed digital/paper workflows.
- The browser hashes the exact file, creates one actor-scoped capture record,
  obtains a short-lived upload authorization, uploads directly to the fixed
  private bucket, and asks the server to verify the stored bytes before showing
  success.
- An uncertain request retains the same capture idempotency envelope while the
  file remains selected. A lost upload response is reconciled through the
  server-side digest/size completion check.
- Altered metadata, extra response fields, wrong capture IDs, empty upload
  tokens, unsupported media, oversized images, and integrity mismatches fail
  closed.
- A storage receipt explicitly reports that OCR was not requested, no score was
  changed, and no game was verified. Human transcription and the existing two-
  official process remain mandatory.
- The six-table by twenty-seat production boundary accepts exactly Tables A–F,
  seats 1–20, with 120 unique assignments and rejects the same assignment set
  when only five tables are declared.

## Implementation

- Added `PrivatePaperCardPhoto`, used by initial and independent-review forms
  for paper/paper and mixed digital/paper games.
- Reused the existing private Storage bucket and server-only capture,
  authorization, and integrity-completion endpoints. No service credential or
  broad Storage policy is exposed to the browser.
- Added an exact upload-authorization response validator. The public synthetic
  demonstration intentionally retains its local-only image preview and never
  writes tournament data.
- Machine OCR and all online payment providers remain default-off. Cash/check
  and human paper-card operation do not depend on either.

## Executed evidence

Environment: local Windows worktree, Node 24 / pnpm 11, production Next.js
build, approved pilot schema already at migration 0161.

- Focused paper capture/storage/OCR contract run: **18/18 passed**.
- Focused API/seating contract run after the A–F boundary fixture: **53/53
  passed**.
- `pnpm verify`: **456/456 application checks passed**, provider preflight
  passed with optional integrations disabled, production build passed, and
  workspace checks passed.
- `pnpm verify:handoff`: **6/6 passed**.
- `git diff --check`: passed.

## Remaining physical evidence

The protected production forms require a linked, identity-confirmed
cross-checker and a scheduled paper or mixed game. The shared pilot currently
has no such prepared official/game fixture, so a real phone capture, stored
object readback, and independent second-official review remain part of the
planned witnessed multi-user rehearsal. This is verification remaining, not an
implementation or provider-access gap. OCR stays off until separate live
false-read evidence passes.
