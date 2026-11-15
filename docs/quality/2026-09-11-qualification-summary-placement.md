# Qualification summary placement correction

Date: 2026-09-11 (Pacific/Honolulu)

## Acceptance criteria

1. Event Results contains playoff placements such as Winner and Runner-up, but
   does not list the High Non-Qualifier as an event placement.
2. The qualifier list remains numbered and ranked from highest to lowest.
3. High Non-Qualifier appears immediately after the last qualifier as a
   separately labeled, unnumbered row that explicitly says it is not a
   qualifier.
4. The pre-playoff Qualification Preview does not show Winner or Runner-up,
   because those outcomes do not exist until the playoffs finish.
5. The public artifact remains clearly synthetic and non-official.
6. Winner and Runner-up are members of the qualifying field, while their
   playoff placements do not rewrite the original qualifying order.

## Evidence

- Focused dashboard and public-PDF contract tests: PASS, 46/46.
- `pnpm verify`: PASS, including dependency audit, lint, 222/222 application
  tests, production build, and workspace/recovery gates.
- PDF structure: PASS. The regenerated Letter-size, one-page PDF is unencrypted,
  contains no form or JavaScript, and its extracted text places High
  Non-Qualifier after qualifier 3 and outside Event Results.
- PDF visual inspection: PASS. The final row is readable, unnumbered, and
  visually distinct with a pale background and divider; no clipping, overlap,
  or broken glyphs were observed.
- Independent Sol review found and rejected an inconsistent first draft whose
  Winner and Runner-up were absent from the qualifier list. The corrected
  sample selects qualifier-ranked players at positions 2 and 3 while retaining
  the original 1-through-3 qualifying order; a regression test now enforces
  membership and exact row order.
- External Chrome desktop interaction: PASS. Results -> Main Event -> View
  Qualifiers displayed Qualification cutoff, Qualifiers, then High
  Non-Qualifier, and did not display Winner or Runner-up.

## Limitations

- This corrects the synthetic demonstration and sample PDF only. It does not
  claim that the unfinished official results, MRP, or Q-pool calculation
  pipeline is production-ready.
- The external-browser controller did not expose a narrow-phone viewport for
  this run. The change uses the existing responsive list layout, but a real
  phone visual pass remains part of the release accessibility gate.

## Result

The reported placement error is corrected in source, the on-screen preview,
and both generated PDF copies. The change is ready for source control; it is
not automatically a production deployment.
