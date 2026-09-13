# Product and Release Decisions - 2026-09-06

## Context

The recovered v1.3 prototype is a review artifact, not a production application. User feedback, current ACC rules, and a read-only review of the ACC sanctioning portal clarified several product choices that supersede earlier prototype labels.

## Decisions

1. **Production path:** Use a fresh, accessible branded prototype as the next approval gate. Do not modify or publish recovered prototype HTML as production code.
2. **Score entry and card:** Use a large 1-121 keypad, explicit win/loss selection, automatic 0/2/3 game points, and the paper-card-inspired separate Plus Points and Minus Points columns. Show opponent full name and Table/Seat; remove opponent initials.
3. **Official versus friendly language:** Treat 31+ as the official skunk threshold for game-point purposes. Single/double/triple skunk graphics are optional, informal player feedback only and must not affect records, standings, or ACC exports.
4. **Verification and corrections:** Preserve independent submissions and required confirmations for server-verified results. Cross-check correction authority is immediate by default, but reason and second-approval requirements are configurable by a director. Every correction is append-only/audited.
5. **Rules:** Provide a searchable quick reference, a cached full ACC Rulebook, and the official ACC source link. The user recorded permission on 2026-09-07 to copy/cache the full ACC Rulebook for everyone using the app, including the public review prototype. The cached 2025 PDF retains its source URL, edition, SHA-256 checksum, and capture date; it must be refreshed for a later edition or an officially revised same-edition source asset. Each implementation rule still needs an effective date, source, and tested fixture.
6. **Team events:** Canadian Doubles and future configured team events are first-class event types rather than manual-only imports. The production team-scorecard workflow must identify both teams and every player, enforce event/team membership and role rules, preserve independent verification and audit history, and use dated ACC team-event scoring/qualification fixtures before it can affect standings or results.
7. **Canonical tournament setup:** `Set Up Tournament` stores the tournament request once. It uses prototype options based on observed ACC sanctioning-request fields for tournament, director, venue, Main, Consolation, Q-pool, and Satellite configuration; its confirmed production data is reused by Events and Flyer, seating, results, and finance. A director may start from guided input or an existing flyer with assisted extraction, but must confirm all extracted fields. Produce a director-assisted draft worksheet aligned to observed fields, not an ACC-approved import or submission contract; do not automate portal entry without a documented ACC API or import contract.
8. **Events and results:** Keep **Events and Flyer** as an event-management/reference area with flyer creation within it, rather than making it a flyer-only feature. Support standard and custom satellite events, up to two Main/Consolation Q-pools, public post-event results, financial reconciliation, and an ACC-ready export.
9. **Branding:** User confirmed ACC logo permission. Use a highest-resolution official source asset; retain flyer and handoff images as private references.
10. **Release environments:** Keep Vercel and Supabase connections, but establish separate staging and production environments, secrets, backup/restore evidence, monitoring, rollback, and GitHub protected release checks before a real-event launch.

## Consequences

- Requirements and test fixtures must distinguish official ACC calculations from product conveniences.
- The first implementation vertical slice is score submission through audited verification, not the full flyer or financial suite.
- A `READY` Vercel deployment is not evidence of application or release readiness; the current placeholder returns 404.

## Sources

- User product decisions in this task, 2026-09-06.
- [ACC Official Tournament Rules 2025](https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf).
- [ACC Media and Marketing](https://www.cribbage.org/NewSite/about/media.asp).
- Read-only ACC Master Point Program portal review, 2026-09-06.
