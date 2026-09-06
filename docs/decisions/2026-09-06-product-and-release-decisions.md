# Product and Release Decisions - 2026-09-06

## Context

The recovered v1.3 prototype is a review artifact, not a production application. User feedback, current ACC rules, and a read-only review of the ACC sanctioning portal clarified several product choices that supersede earlier prototype labels.

## Decisions

1. **Production path:** Use a fresh, accessible branded prototype as the next approval gate. Do not modify or publish recovered prototype HTML as production code.
2. **Score entry and card:** Use a large 1-121 keypad, explicit win/loss selection, automatic 0/2/3 game points, and the paper-card-inspired separate Plus Points and Minus Points columns. Show opponent full name and Table/Seat; remove opponent initials.
3. **Official versus friendly language:** Treat 31+ as the official skunk threshold for game-point purposes. Single/double/triple skunk graphics are optional, informal player feedback only and must not affect records, standings, or ACC exports.
4. **Verification and corrections:** Preserve independent submissions and required confirmations for server-verified results. Cross-check correction authority is immediate by default, but reason and second-approval requirements are configurable by a director. Every correction is append-only/audited.
5. **Rules:** Provide a searchable quick reference and official ACC rulebook link, preferably cached for offline use. Each implementation rule needs an effective date, source, and tested fixture.
6. **Events and results:** Support standard and custom satellite events, up to two Main/Consolation Q-pools, public post-event results, financial reconciliation, and an ACC-ready export. Do not automate ACC portal submission without a documented supported API or import contract.
7. **Branding:** User confirmed ACC logo permission. Use a highest-resolution official source asset; retain flyer and handoff images as private references.
8. **Release environments:** Keep Vercel and Supabase connections, but establish separate staging and production environments, secrets, backup/restore evidence, monitoring, rollback, and GitHub protected release checks before a real-event launch.

## Consequences

- Requirements and test fixtures must distinguish official ACC calculations from product conveniences.
- The first implementation vertical slice is score submission through audited verification, not the full flyer or financial suite.
- A `READY` Vercel deployment is not evidence of application or release readiness; the current placeholder returns 404.

## Sources

- User product decisions in this task, 2026-09-06.
- [ACC Official Tournament Rules 2025](https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf).
- [ACC Media and Marketing](https://www.cribbage.org/NewSite/about/media.asp).
- Read-only ACC Master Point Program portal review, 2026-09-06.
