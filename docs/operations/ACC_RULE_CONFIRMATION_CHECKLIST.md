# ACC Rule and Operations Confirmation Checklist

**Last updated:** 2026-09-10
**Purpose:** Turn published ACC requirements into dated, testable application
rules without treating a prototype or a remembered practice as an official
rule.

## What Codex can confirm directly

| Item | Source to verify and preserve | App outcome | Status |
| --- | --- | --- | --- |
| Current governing rulebook | [ACC Rules page](https://www.cribbage.org/NewSite/rules/default.asp) identifies the 2025 Rulebook as the current public edition. | Record version/date and link it from the in-app reference; create dated scoring and cross-check fixtures. | Source reviewed; fixtures in progress |
| Game-points and scorecard arithmetic | 2025 Rulebook plus the older [ACC Policy Manual](https://www.cribbage.org/NewSite/about/Policy%20Manual%2008162017A.pdf) supporting the 2/3/0 baseline. | Enforce normal win/loss and skunk game points, reciprocal plus/minus spread, totals, and correction recalculation. | Source reviewed; fixtures in progress |
| Qualification order and playoff count/byes | [ACC Play-off Brackets and Byes](https://www.cribbage.org/NewSite/rules/playoffbracket.asp) plus the 2025 rulebook. | Fixture-test ranking, one-in-four qualification rounded up, and approved bye calculation. | Source reviewed; fixtures not started |
| Cross-check and judge process | 2025 Rulebook Appendix A / Judge Protocols and dated ACC judge material. | Fixture-test staffing, independent review, self-review exclusion, exception workflow, and audit trail. | In progress |
| Main, Consolation, double-elimination, doubles, and satellite event vocabulary | Current [Tournament Director Resources](https://www.cribbage.org/NewSite/sched/tournament_dir.asp), sanctioning forms, approved flyers, and 2025 Rulebook Appendix B where applicable. | Make the setup form list only confirmed options and label custom options as director-defined. | Doubles source reviewed; event-option/fixture work remains |
| MRP, qualifying, payout, and Q-pool inputs | Current MRP schedules and payout materials published under Tournament Director Resources. | Build exact, versioned fixtures and prevent result finalization/export if an applicable schedule is absent. | Not started |
| Flyer/sanctioning required fields | Current regional sanctioning request forms and Director Resources. | Map setup fields to a flyer and ACC-ready export; avoid duplicating director entry. | Not started |
| Director portal behavior | Publicly documented portal guidance and observed field options, without relying on stored personal credentials. | Confirm whether export is director-assisted only or whether an ACC-approved integration is possible. | Not started |

## Items that require ACC or director confirmation

These are not things I should invent from a website or decide unilaterally.

| Decision needed | Who can confirm it | Why it matters | Earliest needed |
| --- | --- | --- | --- |
| Written approval for the app to serve as an official operational record, not merely an aid | ACC Tournament Commissioner / authorized ACC official | Determines whether a digital scorecard, cross-check record, results export, or electronic signature can replace any paper process. | Before Step 3 is accepted for pilot |
| Official source and effective date for every MRP, Q-pool, payout, and event-format calculation | ACC authorized tournament/rating official | Prevents incorrect qualifications, prizes, or ACC reports. | Before Step 5 implementation |
| Paper-card image/OCR retention, access, and deletion policy | ACC plus the tournament organization | Paper images can contain participant records; the system cannot invent a retention period or use an unapproved OCR vendor. | Before Step 4 implementation |
| Permission and technical terms for writing into the ACC sanctioning/results portal | ACC portal owner | An API, export import, or director-assisted copy/paste workflow must be explicitly approved; browser automation of a private portal is not assumed. | Before Step 5 implementation |
| Final current role/permission list, including multiple co-directors | ACC / tournament director | Prevents the app from misrepresenting official authority or allowing an unapproved role. | Before Step 3 role acceptance |
| Payment policy and processor | Tournament director / financial authority | Needed only if the app accepts money rather than merely records cash/check status. | Before enabling payments |

## Minimal to-do list for you

1. Ask the appropriate ACC official whether the app may be used as the
   tournament's official digital operational record, including electronic
   scorecards, cross-check records, and results export.
2. Ask whether there is an approved API, import template, or preferred export
   method for the Sanctioning Request and Tournament Report portals. If not,
   confirm that a director-reviewed export/copy workflow is acceptable.
3. Ask for (or point me to) the current authoritative MRP, Q-pool, and payout
   schedules for every event type you expect to support.
4. Ask for the ACC-approved retention/access policy for photographed paper
   scorecards. Until then, the capture feature remains off.
5. Forward or save any written replies here. I will convert each one into a
   dated decision, requirement, and automated fixture.

## What you do not need to do

You do not need to retype the rulebook, manually check arithmetic, research
the public ACC pages, or create the technical test fixtures. I will do those
parts and flag only genuine policy/permission decisions.

## Evidence standard

For every rule used by the app, retain: source title/URL, edition or effective
date, precise rule/form field, the application behavior it governs, a positive
fixture, and at least one rejection or edge-case fixture. A later ACC update
creates a new version; it never silently rewrites a completed tournament.
