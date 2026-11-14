# Reusable Tournament Templates — Bounded Local Capability



2026-11-11 Reusable tournament templates built locally/default off. Existing new-tournament creation and chooser already support independent upcoming tournaments; no duplicate creation system added. New portable JSON download/load/review/apply controls in normal latest-prize Setup reuse existing save workflow. Exact schema carries editable details/series/modern regular-prize settings and complete Main→linkedConsolation→Satellite structure; omits official profile assignments and all operational rows/reviews/receipts. Apply only into an empty editable target, keeps target name/officials, reanchors local calendar dates and generates fresh event-row IDs/remapped links/settings. Source records unchanged, no autosave/network. Templates with Q/Side pools or Satellite ratio payouts explicitly held because their separate pinned policies cannot be established from SetupPayload; no silent fallback. Four focused domain tests, TS/lint and actual offlineReact390/1440 file download/load/explicit-apply/stale-uncheck zero-network checks pass; independent source GO after lease/case fixes. Gates false; no SQL/hosted/fixture/publication/deniedretry. Real signed-in normal-save/fullreload and complete pool-policy template bridge remain pending. See docs/quality/2026-11-11-tournament-templates-v1.md.

## Observable behavior

Director can download a named private JSON template from supported current setup and load it for explicit review in another empty event draft. Existing Create Tournament supplies separate tournament identity; existing chooser lists multiple tournaments. Imported settings are editable and unsaved until the ordinary Save All Events Draft path. No duplicate tournament creation or SQL writer added.

Copied: venue/contact details, event configuration, series and current regular-prize recipients/method/factor/multiplier/rounding. Target name and existing official assignments remain. Relative calendar dates shift to the new tournament start date; local times/timezone copied and require review. New event-row UUIDs and links generated. Operational event IDs, roster, membership, finance, scores, results, source/review/approval snapshots and operation IDs are not imported. Files intentionally include contact details; keep private.

Strict one Main first, zero/one immediately linked Consolation with complete Yes/No decision, then Satellites. Unknown fields, orphan/reordered/multiple Main, historical-only parameters, invalid dates or reused IDs reject without mutation. Q/Side pool-bearing templates and Satellite ratio templates are deliberately unavailable until their separately pinned policy source is ported safely; the UI explains this. No payout policy inferred.

## Focused proof

Four domain tests in tests/tournament-template-v1.test.mjs passed: newest regular/series values, no identities/history leakage or source mutation; target independence/date/row/link remap; malformed/historical structures; unsupported pools and mixed-case IDs. TypeScript noEmit and focused ESLint passed (zero errors/warnings for the new files). Offline actual React browser test at390/1440px and enlarged24px font passed download contents, file review, explicit apply, stale-uncheck prevention, no clipping and zero network. Evidence test-results/tournament-templates-20261111/result.json and templates-390.png/templates-1440.png. Browser uses injected fictional template/parent callback; not actual provider, normal Setup-save integration or native-storage/fullreload acceptance. Independent narrow source re-review GO, no P1/P2. No broad suite/build/audit run.

## Gate

Literal false tournamentTemplatesEnabledV1; no environment flag or hosted access changed. Existing frozen216-file release preserved; these later files need separate release review. No SQL, fixture, upload, invitation, participant activation, denied retry or hosted change.
