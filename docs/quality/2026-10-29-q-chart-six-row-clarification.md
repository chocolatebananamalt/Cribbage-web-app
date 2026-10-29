# Six Q chart clarifications — verified local correction

## Scope and provenance

The owner explicitly approved these six previously unavailable page-5 entries for the test Preview at 2026-10-29 07:44 UTC. Source remains the eight-page `cribbage pool info.pdf`, Library `libfile_3a1e3f4477e481919c5163b368dcd5c2`, PDF SHA256 `f7549bd181bdfd0c08695547293d32811b5406ef1aa3c171bba221420238924d`.

These six entries are **user-read clarifications**, with payout count and pot-total checks. They were not independently visually extracted. The initial row-56 reading was qualified as "probably" and the final $15 entry was supplied later. For rows 57–59 the fourth-place $55/$65 ambiguity was resolved by the total. User approval, rather than a claim that every digit was readable in the scan, supports this correction. Every cell retains that distinction in its source reference; the screen states it visibly.

All values below are whole USD dollars, top award first. The catalog converts them exactly once to integer cents.

| Paid count | Award amounts | Recipients | Total |
| ---: | --- | ---: | ---: |
| 39 | 80, 65, 50, 40, 35, 30, 25, 25, 20, 20 | 10 | $390 |
| 56 | 100, 80, 65, 55, 45, 40, 35, 30, 25, 20, 20, 15, 15, 15 | 14 | $560 |
| 57 | 95, 80, 65, 55, 45, 40, 35, 30, 25, 20, 20, 15, 15, 15, 15 | 15 | $570 |
| 58 | 100, 80, 65, 55, 45, 40, 35, 30, 25, 20, 20, 20, 15, 15, 15 | 15 | $580 |
| 59 | 105, 85, 65, 55, 45, 40, 35, 30, 25, 20, 20, 20, 15, 15, 15 | 15 | $590 |
| 60 | 105, 85, 70, 60, 50, 40, 35, 30, 25, 20, 20, 15, 15, 15, 15 | 15 | $600 |

The supplied six-chart coverage now contains **320 supported combinations**, with no unavailable row inside those ranges. Unsupported fee/ratio/count combinations outside those ranges still block without interpolation, scaling or inferred normalization. Other 314 award arrays are unchanged: restoring only the six cells to null reproduces canonical SHA256 `8dae1e07dcdc30d5def1d576d6949952b8b213b452ce97d34d4e1be5cf3288bf`.

## Verification

- Six focused catalog groups pass, checking all 320 rows, exact six golden arrays, recipient ceilings, cent conservation, ordering, provenance, outside-coverage rejection and the unchanged-314 hash.
- Full `pnpm verify` passes **991 application tests**, clean production dependency audit, zero lint errors/two pre-existing warnings, provider checks, production build/TypeScript, workspace 8/8 and local private handoff 6/6. Log: ignored `test-results/q-chart-six-row-verify.log`.
- Actual local component/recovery browser harness passes **13 grouped checks** at phone 390 and desktop 1440, including exact row-39/60 dollars, visible user-read clarification notice, no horizontal overflow, existing recovery/replay/rejection and setup-percentage regressions. APIs and accounts are fictional/local only; no hosted tournament was created. Log: `test-results/q-chart-clarification-browser.log`.
- Independent data/code reviewer independently passed all six groups, confirmed every supplied value, sums/counts and unchanged other rows, and found no P1/P2 issue. The reference index's only initially missing link was this report and is now supplied.
- Existing migration 0246 remains byte-identical: SHA256 `B6DCB823CF86D4093404063203F273119C13C4D9C6DCF54DEB04D06B37D31944`. No schema, API contract, policy, ranking/tie logic, permission or business-record change is part of this correction.

The laptop disconnected during the first attempt, before the test-update patch could execute. On reconnection the actual saved two-source-file edits were reconciled; the pending patch was applied once. No permission denial was bypassed. Preview publication and exact-commit CI/deployment checks follow the completed local gates; their result is recorded separately after verification.

## Reusable reference and test boundaries

[Reference index](../reference/INDEX.md) points to the existing cached Rulebook and reviewed excerpts, explicitly distinguishing official ACC sources from friend-supplied schedules. It does not claim complete Director Manual or PDF text extraction. The parent's comprehensive searchable reference is a separate deliverable.

Further hosted tournament tests remain outside this six-row publication. The separately authorized no-tie cases are planned independently and must not rewrite any existing fixture, policy or unpaid review. No actual payment/refund, production, merge or hosted migration is authorized by this correction.
