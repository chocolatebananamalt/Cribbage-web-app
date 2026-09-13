# Paper scorecard capture and OCR contract — 2026-09-10

## Decision

Add an authorized paper-scorecard capture and OCR-assisted comparison workflow
to reduce cross-checking work. It is an evidence and review aid, not a scoring
authority or replacement for the independent-entry/confirmation state machine.

## Required behavior

- An eligible cross checker selects the assigned tournament game and card side
  before opening a dedicated camera/upload capture route.
- The system binds the capture to the game and permanent verification ID.
  OCR produces a confidence-labelled editable draft. The cross checker must
  review the image and explicitly accept or correct the draft before any
  comparison occurs. The accepted draft is a **reviewable digital
  transcription** of that specific paper card, linked to its image and audit
  record; it is not the player's canonical digital scorecard or an automatic
  score correction.
- A paper/digital game compares the reviewed paper draft with the separately
  submitted digital result. When that digital result is already
  server-verified, an exact reviewed paper match records a completed
  paper-evidence comparison and removes that card from the cross-check
  exception queue. It never turns a single unverified digital entry into a
  verified result.
- A paper/paper game captures and reviews **both** players' cards separately,
  then compares the two reviewed transcriptions. Exact matches may be marked
  `paper evidence complete` for the authorized cross-check workflow; they do
  not silently become an authoritative score, change standings, or bypass the
  tournament's required paper-verification/dispute policy. Missing,
  unreadable, unlinked, low-confidence, and mismatched results go to the
  existing cross-check queue.
- The cross-check dashboard MUST prioritize only exceptions after a scan batch:
  unreadable cards, uncertain OCR fields, mismatches, missing counterpart
  cards, unverified digital results, and any card selected for required
  audit sampling. It MUST NOT imply that paper/paper games are the only games
  that can need follow-up.
- A scan, OCR result, image, or staff transcription by itself never verifies a
  game, satisfies an assigned player’s entry or confirmation, changes a
  scorecard, changes standings, or creates an export result.
- The system blocks self-card capture/review/resolution and records the
  capture, OCR draft version, reviewer, correction, comparison, and access
  events immutably.

## Privacy and architecture boundary

Paper-card images and OCR text are restricted evidence. They require
tournament-scoped authorization, encrypted restricted storage, explicit
view/download controls, and the normative restricted-hold policy: **no
automatic purge** before an ACC retention period is approved. Any authorized
deletion or restore must follow the audited hold/deletion and isolated restore
rules in `R-RET-01`; the feature must not invent a 30-, 60-, or 90-day period.
Camera access must be enabled only for the dedicated capture route, never
globally. No unapproved third-party OCR or image service may receive a card
image or its text.

The actual OCR provider, supported paper-card layouts, image size/type limits,
future ACC-approved retention duration, restore implementation, and false-read
fixtures remain open implementation decisions. The feature stays disabled
until the storage/RLS policy, browser permission behavior, and real
capture/comparison tests are complete.
