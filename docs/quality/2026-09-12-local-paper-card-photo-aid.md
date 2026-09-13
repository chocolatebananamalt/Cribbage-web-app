# Local paper-card photo aid verification

**Date:** 2026-09-12  
**Scope:** Pilot-safe camera/file preview for human paper-card transcription.

## Acceptance

- An authorized cross checker's paper/paper and digital/paper forms offer a
  rear-camera-capable image picker for each paper card.
- Only JPEG, PNG, and WebP images from 1 byte through 10 MB are accepted.
- The chosen image is previewed only from a browser object URL and is not sent
  to an API, Supabase, or an OCR provider.
- Removing the photo or leaving the rendered component revokes the object URL.
- Human transcription, two-original-card comparison, and the distinct second
  official remain the only authority path.
- The public synthetic demo shows the same local-only control at
  `/demo?screen=corrections` without accepting or changing tournament data.

## Evidence

- Focused Node tests: 31 passed, 0 failed.
- ESLint: passed.
- Next.js production build: passed.
- Desktop headless Chrome, 1280 by 1000: the Cross Check screen and photo
  control rendered without clipping or an error overlay.
- Phone CSS viewport, 390 pixels wide: navigation, cross-check rows,
  explanatory text, image picker, and local-only notice remained readable
  without horizontal clipping.
- A Chrome DevTools Protocol check selected the repository's synthetic ACC
  logo JPEG through the real file input and proved that a `blob:` preview,
  filename, and local-only notice appeared with no Next.js error overlay.
- The Windows browser-control helper timed out twice before a window was
  selected, so no stale UI handle was used. Visual proof used installed Chrome
  in headless mode against the local development server instead.

## Deliberate limitation

This is not retained-image evidence and not OCR. Restricted upload, retention,
OCR extraction, confidence display, and reviewed draft comparison remain gated
by the provider and data-governance requirements in
`docs/operations/PROVIDER_ACTIVATION_PLAN.md`.

## Production release evidence

- The verified release branch was merged through GitHub pull request 1 as
  merge commit `e92c863135da818632a147a7d9c8f75f5ab8b3c1`.
- Vercel Production deployment `dpl_GuqEyjRt16VPpMvrj7W9imK2i6bi` reached
  `READY`; `https://cribbage-web-app.vercel.app` is attached with no alias
  error.
- Production `/`, `/sign-in`, `/register`, and
  `/demo?screen=corrections` returned HTTP 200.
- The production demo response contains `Paper-card photo aid` and the
  explicit statement that the selected photo is not uploaded.
- Vercel's grouped runtime-error scan for the first post-release hour returned
  no errors.
