# Player-facing playoff mini-tournament roadmap

Current checkpoint (2026-11-04): a pure chart-based local display and default-off synthetic preview are now implemented and verified; the LIVE public bracket, source adapter, authentication/access policy and scoring integration are still not implemented or published. See docs/quality/2026-11-04-player-playoff-display-local.md. The original roadmap below preserves earlier requirements. Parent reports Daron wants qualified-player playoffs presented as a mini-tournament bracket, initially without table/seat assignments. Parent's independent review of published b007b0d found a Director-only round-by-round four/five-qualifier Main list, no player-facing round-by-round bracket, and synthetic-only four-qualifier Consolation playoff recording.

## Dependencies and safe scope

- Use the approved current qualification/seeds and bracket version as source, with stable participant and event/phase IDs. Do not use names as lookup keys or treat old qualifying table/seat as a playoff assignment.
- Preserve actual supported four/five-qualifier bracket shapes and derived byes. Do not invent arbitrary bracket policy or advance players from absent/unreviewed results.
- New local reviewed Main-series evidence can supply incremental progress, but it is Director-reviewed evidence, not independently confirmed canonical game scoring. Preserve this distinction; project only appropriate public player/result fields, not private source notes or financial data.
- User now explicitly wants a publicly viewable bracket. A new aggregate/display-only public projection and authorization boundary are needed; do not open the Director workspace or source notes. Public visibility is a design requirement, not permission to deploy or alter access now.
- Initial bracket has no table/seat assignment, as requested. Later scheduling/assignments need their own event/phase-scoped, auditable operation and play-readiness checks. Keep Tournament ID separate from current table/seat.
- Real player playoff scoring, game discovery, independent confirmation and eligible progression require a verified bridge to canonical game authority. Current synthetic Consolation recording is not that bridge. Member/MRP review remains separate from game outcomes.
- Stage work after the local Main/Consolation association flow: review an accurate read-only bracket, verify player/official role views and correction/stale-source behavior, then approve any game/scheduling integration separately. No bracket implementation, hosted change or publication in the event-link patch.

## Expanded owner requirements

- Public bracket displays names plus the same fixed Tournament ID used in Main. Never substitute ACC membership number, qualification seed/rank or bracket position for Tournament ID. Preserve ID through every playoff round.
- Prefer full first/last name when it fits; constrained views may use first name plus last initial. Keep Tournament ID visible to distinguish duplicate/abbreviated names; offer full name on accessible expansion/detail.
- Design for 400–500 entrants and roughly 100+ qualifiers, including uneven fields and byes. Current four/five-qualifier adapters are not a general bracket engine. Verify approved seeding, bye distribution, progression, corrections and elimination policy before implementing arbitrary sizes; do not infer it from a familiar-looking bracket.
- Make “my next opponent” easy to find without reading or panning the whole large bracket. Provide search/focus by name or Tournament ID, readable current-match/next-opponent view and round navigation, while the public overview remains available. Do not shrink labels to fit hundreds of players on a phone.
- No table/seat assignments initially. Identity, seed, bracket position and later physical assignment remain separate. Add actual assignments only through a separately verified scheduling step.
- Do not expose ACC number, contact/payment data, official-only source notes or unresolved private disputes in the public projection. This is a scoped display design, not a claim that the synthetic four-player Consolation screen already provides human player playoffs.

## Bye-policy research gate

Owner explicitly requires ACC-rule-based allocation of byes for odd/non-power-of-two playoff fields, including which players receive them. Parent is researching exact manual sources. Do not generalize the existing four/five-player adapter or invent generic seeding/bye distribution. After source and applicability are verified, test small odd fields, uneven non-power-of-two fields, powers of two and adjacent sizes, and roughly 100+ qualifiers from 400–500 entrants; assert recipient identity, round progression, no phantom wins/opponents, source versioning and correction behavior. No new bye algorithm is implemented here.

### Parent-verified Rulebook scope

Parent reports ACC 2025 Rulebook Rule 13.2(a–d), printed pp. 50–52, Appendix A pp. 55–57: qualification, byes assigned to highest qualifiers and specific placement charts. Source: https://cribbage.org/NewSite/rules/rulebook_2025.pdf . Parent observed exact seed slot orders: eight qualifiers `[1,8,4,5,3,6,2,7]`; sixteen `[1,16,8,9,5,12,4,13,3,14,6,11,7,10,2,15]`. These are seed/rank positions, not Tournament IDs. Located charts currently cover up to 256 entrants/64 qualifiers; do not infer exact larger placement for 400–500 entrants/100+ qualifiers. Research continues. No bracket implementation authorized or performed in this roadmap phase; future implementation/tests must stay within verified rules and applicability.

### Completed parent research and unresolved design boundaries

2025 Rule 13.2 (printed 50–52) and Appendix A/charts (55–57) support qualifiers, highest-seed byes and placement through 64 qualifiers / 256 original entrants. Arithmetic bye count may extend to larger fields, but no verified 128+ qualifier placement algorithm was found; never label extrapolation ACC-approved. Source: https://cribbage.org/NewSite/rules/rulebook_2025.pdf .

Consy Lite has its own random-draw grouping and bye process: Policy Manual Ch. 6 I.C.2.b and https://www.cribbage.org/NewSite/about/consy_lite.asp . It must not inherit Main/regular-Consolation seeding by assumption. Main and regular Consolation match lengths vary by size/duration (Policy Ch. 6 I.B–I.C); exact applicable parameters need source-backed configuration. There is a possible conflict between Appendix A ranking language and the project's previously agreed tie-break workflow. Reconcile it with the owner and sources before changing any existing ranking, tie resolution, qualification or historical result. No such change is made in the event-link patch.

## Large-bracket section display idea

Owner suggests multiple readable sections, similar to March Madness regions, feeding one championship. Treat this as a layout over the single approved full bracket. Sections must preserve every verified seed, bye, opponent and advancement path; never independently reseed sections or create a different competition. Labels such as East/West would be display labels, not invented ACC geographic qualifying rules. Sections of up to 64 are a display preference to explore, not proof of an ACC-approved larger-field placement method. Exact >64-qualifier placement remains unresolved. Keep “my next opponent” and full-name/Tournament-ID focus available independently of overview/section navigation.

Owner explicitly confirmed qualifying ties after earlier scorecard tie-breakers: head-to-head where applicable, then a deciding game if required; low-card cut selects first dealer only, never the qualifier. Preserve the current verified workflow; unusual multiway/split-series cases go to head judge. This decision is recorded only and is excluded from the frozen 0290–0292 staging rollout; no tie logic or hosted records changed.


## Local existing-reader adapter checkpoint
Server-only private-read integration now verified locally, with strict redaction, fixedIDs, nativeaggregate sourceordinals and conservativeprovenance. It is NOT wired to a route/public/playerexposure and does not establish atomic freshness or runtimebackendacceptance. Main5 andcurrentConso4 completeaggregates adapted; legacyMain4 completedlinkage andpartialprogress blocked. PublicDTO v2 distinguishes aggregate references from priorlocalv1. Details: docs/quality/2026-11-04-player-playoff-read-model-local.md.
