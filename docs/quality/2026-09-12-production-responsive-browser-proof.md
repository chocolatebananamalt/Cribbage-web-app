# Production responsive browser proof

Date: 2026-09-12
Environment: Vercel Production, stable `cribbage-web-app.vercel.app` demo

## Acceptance criteria

- The public demonstration renders meaningful Score Entry content at 320px,
  375px, 640px, and 1280px CSS viewports.
- The document does not create unintended page-level horizontal scrolling.
- All five primary navigation labels remain in the accessibility tree.
- No Next.js error overlay is present.

## Executed evidence

A fresh isolated Chromium session used browser device emulation for each
viewport and captured both runtime measurements and screenshots.

| Viewport | Inner width | Document/body scroll width | Content | Error overlay | Primary navigation |
|---|---:|---:|---|---|---|
| 320 × 780 | 320 | 320 / 320 | Present | Absent | All five labels present |
| 375 × 812 | 375 | 375 / 375 | Present | Absent | All five labels present |
| 640 × 900 | 640 | 640 / 640 | Present | Absent | All five labels present |
| 1280 × 900 | 1280 | 1280 / 1280 | Present | Absent | All five labels present |

The 640px reflow is the layout-equivalent check for a 1280px display enlarged
to 200%. This proof covers rendering, reflow, and overflow; it does not replace
screen-reader or older-player usability testing.
