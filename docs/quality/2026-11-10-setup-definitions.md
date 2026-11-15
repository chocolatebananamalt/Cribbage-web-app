# Production setup definitions

Implemented locally: /help/tournament-setup is a searchable reference for23 established app terms, grouped into events, players/seating, playoffs/prizes, optional pools, Finance, officials and saving. Normal Setup opens it in a separate tab with noopener/noreferrer, preserving unsaved form state. No tournament/account data is loaded by the new page; no writes, formulas, privileges, live eligibility decisions or payout policy were introduced. This is app terminology, with no claim to reproduce a workbook definitions tab.

Sources are the established project requirements and current setup/finance/seating/verification meanings in src and docs/product/requirements.md. Independent semantic/source review GO; definitions SHA256 de693d54f70e872b01d8c7630d5d91d4ec656c78e0be4677cd9289cb607eaae9.

Files: src/lib/setup-definitions.ts; src/components/setup-definitions.tsx and setup-definitions.module.css; src/app/help/tournament-setup/page.tsx; existing tournament setup/page.tsx link.

Focused checks only:2 source/search tests pass; TypeScript --noEmit and targeted ESLint pass. Offline actual React at390px/200%text and1440px/normaltext checks23terms, case-insensitive search, empty results, keyboard reset, valid heading bindings and no overflow. Zero network requests. Evidence/screenshots: test-results/setup-definitions-browser-20261110.

No database test, migration, mock tournament, hosted change or publication retry. Full pnpm verify/handoff not rerun; pnpm unavailable and denied audit remains untouched. Next route/provider acceptance and release remain unverified. The separate player-originated stationary-request persistence gap still requires implementation against registration/roster writers; this help page does not implement seating requests or promise a stationary assignment.
