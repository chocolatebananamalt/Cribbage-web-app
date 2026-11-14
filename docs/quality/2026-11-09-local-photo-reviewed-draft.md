# Local photo to reviewed paper-entry draft

## Delivered private flow

The existing native paper-entry screen now offers a manual transcription aid after a local photo is chosen. The official reads the current card's Game Points and Plus/Minus Spread, checks the displayed current Tournament IDs/game against the photo, reviews the proposed winner/margin, and explicitly selects **Use Reviewed Draft**. This atomically copies only that paper side into the existing paper-entry fields and clears the independent-entry acknowledgment. It does not save, send, record evidence, verify a game, approve identity or supply another reviewer's answer.

Images remain page-memory object URLs owned by the existing chooser. No image bytes, file or URL escape through the new callback; it reports selection presence only. Replacement/removal clears local transcription/confirmation and invalidates the form acknowledgment. Revocation/pagehide hides and clears the aid and revokes the image URL. Current actor/session/game/paper-side/phase/capture ownership remains the native host's scope; old React handlers cannot apply after replacement or revocation. Unsubmitted manually entered form values remain preserved when the photo is removed. The independent reviewer remounts with blank photo/draft and paper-entry fields.

The client-safe OCR draft contract was extracted from `openai-ocr.ts` into `ocr-draft.ts`, with the existing server export retained. The manual adapter reuses its cell validation and `deriveScore`; it does not manufacture an OCR result, confidence or identity. It requires complete explicit cells, exactly one nonempty spread column, GP0/minus, GP2/plus1–30 or GP3/plus31–121. Values are relative to the photographed card, then mapped to the host's trusted side. Names, totals and another card's result do not fill missing values. Both PP cards remain separate.

The existing server OCR extractor, runtime activation conditions and provider request path are unchanged. OCR is **not** activated or called by this flow. It is human transcription from a local photo, not automatic photo recognition. No external image transfer, hosted write, database fixture, migration, grant, publication retry or dependency change was performed.

## Verification

- 23 focused unit/SSR groups passed: manual row boundaries/invalid cells, existing paper scope/nonself/review/pending behavior, local-photo ownership and all nine mocked OCR safety groups. Provider requests in those OCR tests used the existing injected mock fetch, not a network endpoint.
- Actual offline React with the native paper host passed at390/1440 pixels and100/200% text, including expanded photo/draft forms. A synthetic one-pixel PNG was used, not a real card or personal photo. Tests cover atomic one-side copy, acknowledgment reset, no mirrored PP fill, Side-B-relative loss, replacement/removal, actual old React Apply handler after revocation/replacement, and blank independent reviewer. Zero network requests, storage writes or transport writes. The presentation-only `next/image` stub used a normal img element; authorization and native pending controller were real local code with fictional transport/retained ports.
- TypeScript and scoped ESLint passed. The initial browser harness had selected the Remove button for its held-handler case; that selector was corrected to the actual Apply handler and the browser proof rerun, with expanded-form checks retained.
- Independent source review found no P1/P2 issue; it checked the shared validator/provider separation, strict score mapping, current photo/native form ownership, atomic copy, fresh acknowledgment and independent-review boundary.
- New UI uses ordinary labeled inputs/fieldset legends, explicit buttons/confirmation and inherited large controls. No effects derive scores into saved data, no shared request state, no cache and no new client/provider factory.

Evidence: `test-results/manual-photo-draft-20261109/browser/result.json`, screenshots, `types-final.log`, `lint-final.log`, source manifest and focused unit test files. Full application/build/database suites were not repeated for this bounded source/UI step.

## Remaining limits

This is private source integration, not a deployed feature or real-device/provider acceptance. Actual camera operation, real card readability, automatic OCR-to-draft delivery, durable draft/image retention and approved image-source/provenance binding remain unverified or unimplemented. Existing images/manual unsubmitted aid are intentionally page-memory only; refresh loses them. Normal record/review/disagreement/recovery still requires the existing explicit independent acknowledgment and protected writer. Automatic recognition requires a separately reviewed/authorized provider workflow; this task does not request or enable one. No new user policy decision is needed for the completed manual slice. The interrupted public publication remains paused.
