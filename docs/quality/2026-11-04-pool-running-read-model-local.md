# Running pool read model: local verification, 2026-11-04

## Delivered

- `src/lib/results/pool-running-summary.ts`: exact aggregate allowlist and safe integer/count/fund relations, null versus known zero, literal no-award/no-access/no-money flags.
- `src/lib/results/pool-running-read-model.ts`: server-only event-bound source projection and role-checked double-read coordinator, owned snapshots, source drift rejection and exact-cent arithmetic.
- `src/lib/results/pool-running-read-production.ts`: unwired composition of existing read RPCs, authenticated preliminary event activity plus existing private Q operating and Side graduated models. The admin client is constructed only after Director/co-director access checks. No grants, new endpoint or policy changes.
- `src/components/pool-running-summary.tsx` and CSS: readable aggregate counts/amounts, incomplete subtotal warning, held/excluded review, observation time and projected estimate separated from recorded money.
- Pure fictional source examples and focused counterexamples; no database rows created.

## Source and policy boundaries

Q sources 0243/0255 can zero amounts when allocationCurrent is false, so any allocation/receipt history makes pool amounts unknown rather than zero. Whole receipts can include base fees and other pools and are never divided into guessed shares. Native paidEntryEligible, selected-policy consent and pre-play election are retained. Eligibility here is contribution eligibility, not qualification or an award entitlement.

Side sources 0261/0275 can count withdrawn full payments. Current event participation filters entered/paid counts while recorded received amounts remain visible and held/excluded amounts remain separate. Missing native funding blockers cannot create false eligible funds: the adapter derives unresolved funding independently from current entries and status. Unsupported payout domain at zero/one contributors does not erase known contribution counts. No new payout ratios, equal Side methods, refund rules or distribution decisions were adopted.

The preliminary event model supplies participant identity/status; no name-based joins. Private source data, names, ACC numbers, participant/roster IDs, receipts and consent references never cross the public DTO. Pool identifiers and non-personal pool metadata remain. Existing source privilege intersection is Director/co-director; ordinary-player/public access is not enabled.

## Verification

- Independent review: prior Side funding P2 corrected; no remaining P1/P2; independent 10/10 focused tests passed.
- Full repository verify: 1,369 application tests, six provider checks, eight workspace checks, dependency audit, lint and production build passed. Existing unrelated unused-variable warnings remain.
- Private handoff: six checks passed.
- Final focused run: 10/10 passed; final lint: zero errors (96 pre-existing warnings).
- Fresh headless Chrome, loopback only: all five source states passed at 320/390/768/1440 px and 200% computed text enlargement, no document overflow, API/external requests or browser storage. Q known $10 and projected $30; stale Q unknown with clearly incomplete $0 known subtotal; Side recorded $25 includes held $10 and unknown eligible fund; genuine zero stays $0. Screenshots visually inspected for phone Side, desktop Q and enlarged stale Q. These are fictional UI examples, not backend acceptance.

## Remaining limits

No actual RPC invocation, live receipts, Auth/provider verification or database acceptance in this phase. No database fixture, hosted read/write, migration, publication or denied-operation retry. The private composition is not wired to a page or API. Double-read equality detects observed drift but cannot establish transaction-level freshness; observations are accurately labeled. Legacy Q source support can be unavailable with multiple events/Side Pool configurations; no zero or cross-event substitute is displayed. Multi-event financial source adaptation, separately reviewed player aggregate access, polling/push/cache behavior and actual user acceptance remain. These are not payout schedules or verified bank balances.
