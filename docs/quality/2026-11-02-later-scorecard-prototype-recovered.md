# Later scorecard prototype recovered: September review dashboard

Owner correction: the August8 flow image is the original, not the later baseline. The remembered updates include direct spread-digit entry instead of +/- incremental controls, plus/minus scorecard columns, removal of opponent initials and an opponent ID label. No baseline is selected and no redesign/code change is authorized by this investigation.

## Proven stronger match

The later functional review prototype survives in src/app/tournament-dashboard.tsx, not only the archived August HTML. Its current existing sample-only route https://cribbage-web-app.vercel.app/demo was directly opened and inspected November2. It rendered Public Demonstration - Sample Data Only, stating nothing is saved and no real tournament information is changed. Scorecard navigation works. No new deployment/public hosting was created and no live tournament or authentication state was changed.

Observed card:12rows; grouped Game/#/Points and Spread Points/(+)/(minus) headers; Opponent Name and Verification ID#; no initials column; per-line values under separate plus/minus columns; signed totals +22/-0 and +22 net spread. Permanent player ID is shown separately. Score Entry has a digit keypad0-9,Clear,Delete last digit; no +/- incremental controls. It is an output plus clickable keypad, not a desktop-keyboard-editable input. The exact header is Verification ID#, not literally Opponent ID#. Thus this is a materially closer recovered version, not proof it is the owner's exact final remembered variant.

## Dated history

-9978f677 September6 13:12:40 Hawaii / September6 23:12:40UTC: initial recovered scoring pilot review already has a digit keypad.
-0133929c September7 15:58:50 Hawaii / September8 01:58:50UTC: refine score entry and scorecard review.
-c00b50345a28245322f1cbca3767d4ddac60ff1e September7 18:46:30 Hawaii / September8 04:46:30UTC: refine scorecard/seating review. The requirement change explicitly removes opponent initials and specifies permanent Verification ID separate from changing game Table/Seat.
-9ba2c1f September7 18:58:44 Hawaii: refine keypad; commit adds a three-digit limit and aligns the label.
-Later September7 revisions expand operations/results without turning this review shell into live authority.
-19bfec71d69b38a0aaf5d8d0f3886e52ff03dd4f September17 23:53:42 Hawaii / September18 09:53:42UTC is the latest tracked change to tournament-dashboard.tsx in the available history. Current demo page route last changed948067bc September12 14:39:47 Hawaii. Later global styles may differ; do not equate a file's last commit with a frozen screenshot date.

The full verification chronology and original hosted deployment IDs are in docs/quality/2026-09-07-scorecard-format-review.md. The route's sample-only exposure is documented in docs/quality/2026-09-10-public-synthetic-demo.md; September13 repeatable live review covered phone/desktop navigation and sample-only nonmutation. Current screenshot was visually inspected in the browser; full-page capture timed out once, viewport capture succeeded. The exact tab336434458 was left at Scorecard as a review deliverable.

## August artifacts tested and ruled out as complete feature match

Pilotv1.3/August10 still uses spread-minus/spread-plus buttons and includes Opp.Init. in enhanced view. It has a signed combined spread column, but not the later separate Plus/Minus format and no-initials layout. Directorv1.2 has the same old result-entry pattern. Therefore the prior comparison's latest located standalone HTML qualification must not be presented as latest scorecard design overall.

Known existing Library originals remain: flowimage libfile_7c1006518eb8819192efa567c3a219b2/file_0000000006d881fbad98f80be90ec3cd; Pilotv1.3 libfile_5c2267bfadc0819192acdcf9cc9345a3/file_000000009e20823092acee31b1c54345; Directorv1.2 libfile_4b235db9031c8191b432421f2d7acb4f/file_00000000d11c81fdacf7dbb8d1da511b. No native Library file ID for the September dashboard was located. The existing demo URL makes it reviewable without an upload.

Targeted Library title searches found only two named scorecard-flow images and the August prototypes plus September handoff ZIPs; feature searches did not establish a later standalone artifact. Personal Context returned unavailable. These search misses do not disprove another lost or differently named variant. Original August development conversation remains unrecovered. No raw exports/session directories, unrelated private contents, credentials or personal browser inventory were read.

## Next user review

Ask the owner to open the existing /demo and select Scorecard, then Score Entry, and confirm whether this is the later layout remembered. Keep physical keyboard entry and exact Opponent ID# wording as unresolved identifying details, not silently implemented changes. Review and choose baseline before updating the combined comparison or changing navigation. This report is source recovery only, not permission for redesign or publication.

## Selection update — November 2, 2026

Daron has now confirmed the September dashboard at https://cribbage-web-app.vercel.app/demo: “This is it” (Sentinel_dff44d53fddc81918752560105d14615). Earlier pending-selection wording above is historical. The on-screen numeric keypad is the chosen baseline; a physical-keyboard-editable input is not an additional requirement. Focused comparison and proposed restoration scope: docs/product/2026-11-02-selected-scorecard-restoration-plan.md. Planning only; no implementation or deployment authorized by this selection.
