# Synthetic OCR candidate review — local, default off

2026-11-10. This is a review-interface prototype with synthetic data, not recognition. No image left the browser, provider was activated, SQL was executed, hosted service was changed or publication retried.

## Behavior

The existing local photo/manual-draft flow now has an optional candidate-review panel. On desktop it sits beside the photo; on small screens it follows the photo. The native paper host supplies the current card/game/official/source scope but the feature gate returns false.

When explicitly enabled in a fictional test, Show Synthetic Candidate produces a fixed uncertain example (2 game points, plus 29, synthetic confidence 55%). It receives no image bytes, URL or filename. It states that no recognition ran and that confidence is not calibrated. Candidate identity fields remain unknown; expected card/opponent/game identifiers are supplied separately by the current assignment and must be checked by the human.

Corrected fields begin blank. The official must independently type complete consistent values and explicitly acknowledge checking the photo's identifiers and correcting/re-entering its values. Shared OCR and manual-row validators reject contradictory or impossible cells. An unreadable candidate cannot be accepted. Acceptance only copies human-corrected text into the existing manual draft with its confirmation off. The manual photo comparison and normal independent-entry acknowledgment remain required before any existing score action. No candidate acceptance verifies a score.

Bindings include the full existing text scope (actor, official identity binding, card/opponent, game, event, Start, source revision/digest, review phase and capture) plus a positive in-memory photo-selection sequence. This sequence binds a selection occurrence; it is not a file-content hash or authenticity proof. Replacing/removing a photo, changing target/scope/official, disabling the review or revoking access clears the corresponding review state. Old handlers cannot copy after replacement. An independent reviewer gets a distinct scope and blank corrected fields, never the preparer's text or answers.

The candidate and acceptance are memory-only. Explicit text-draft saving still saves only human-entered cells under the existing owner/phase/source scope, never the photo, candidate confidence or acceptance. No automatic storage, recognition, upload, score submission or retry was added.

## Files

- `src/lib/paper-games/synthetic-ocr-review-v1.ts`: false gate, synthetic fixture, exact current binding and shared-validation acceptance.
- `src/components/synthetic-ocr-candidate-review-v1.tsx`: uncertainty, blank corrections, acknowledgment and explicit text-only acceptance.
- `src/components/local-paper-card-draft.tsx`: current-selection binding, scoped remount and manual-draft handoff.
- `src/components/native-mixed-paper-entry-v1.tsx`: default-off integration with its existing trusted text scope.
- `src/components/native-mixed-paper-entry-v1.css`: scoped responsive photo/panel layout.
- `tests/synthetic-ocr-review-v1.test.mjs`, `tests/synthetic-ocr-review-browser.mjs`.

## Verification and findings

30 focused tests pass: five new candidate/binding cases, three existing manual-row cases, seven paper-entry cases, six provider cases, and nine OCR safety tests. The OCR safety tests use mocked provider responses under `--conditions=react-server`; they transmit no image. The initial invocation omitted that Node condition and failed on the intentional server-only import, then passed with the correct runner condition. TypeScript `--noEmit` and targeted ESLint pass.

Browser evidence: `test-results/synthetic-ocr-review-browser-20261110/result.json` and four screenshots. Actual React/local-photo/manual-draft components ran in fresh offline `about:blank`, 390/1440px and 16/32px root text. A synthetic one-pixel PNG was used. Default-off, uncertainty labels, initially blank corrections, edit-cleared acknowledgment, explicit handoff without manual confirmation, stale handler after photo replacement, disable/re-enable reset, target change, independent-reviewer isolation, revocation, rejected-host/no-false-acceptance, no overflow, zero score applies and zero network requests pass. Desktop screenshot visually inspected; the blank pixel image is intentional and proves no recognition accuracy.

The first browser run found an actual lease defect: when confirmation was already false, candidate invalidation could leave the parent lease closed without scheduling a render. The panel could then say copied although the host declined it. The fix preserves typed cells in a fresh object to renew the lease and makes host acceptance return an explicit boolean; the panel reports copied only on true. Regression checks cover both the successful manual handoff and rejected-host path. React lint also prompted a keyed reset instead of state updates in an effect when disabled.

The existing `tests/paper-photo-text-recovery-browser.mjs` passed again on the modified wrapper: explicit text save/restore, fresh photo requirement, no restored confirmation, conflict preservation, archive removal/new cycle and independent reviewer isolation at phone/desktop and enlarged text. This uses an injected transactional CAS port and remounts, not actual IndexedDB/full reload.

Independent source re-review GO after the handoff fix. Final panel SHA-256 `2e43800323474cbaa52dfb5476e1cf3a342f2995c1e46d77d9b68bcb17acc567`; wrapper `dd691b355a7834f985c8b7421982726eaac0ddf57e0905be67ab37db497c5865`; CSS `70166ef27956e1e80e18686ceb9fbc895d95840b4e3da872226b533a4f6b2b9f`.

## Remaining gates

No actual OCR quality, handwriting reading, real-photo handling or provider acceptance is claimed. Live recognition would require a separately authorized image/provider workflow and real false-read evidence. Signed-in normal-origin access, actual IndexedDB/full reload and device acceptance remain unverified. No database update is needed for this memory-only interface; no unnecessary database replay was run. Full pnpm verify/handoff was not run (pnpm unavailable; denied audit/origin access not retried). Hosted rollout/publication remains paused under the existing restrictions.
