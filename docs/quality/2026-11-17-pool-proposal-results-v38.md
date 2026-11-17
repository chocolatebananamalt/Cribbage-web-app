# V38: pool proposals connected to Results

Local implementation, unpublished, new gate OFF.

## Delivered capability
The selected Main event's finalized-qualification Results page can now show a read-only Q-Pool and Side-Pool proposal panel. It distinguishes:
- Current calculated proposal, not saved.
- Current saved proposal, not final awards.
- Changed current source requiring a new proposal review; these are new proposed amounts, never the old saved amounts.
- Historical unpaid award record, status only: no amounts are copied from history into current/proposed Results.
- Held or unavailable evidence, with unknown amounts rather than zero.

The panel links to the existing event-scoped ownership and pool-review pages when their existing destination gates permit it. The pool-review page now links back to that event's Results. Its existing writer/controller is unchanged. An explicit read-only presentation option leaves the shared review component's old defaults unchanged; the Results panel has no record, finalize, payment or settlement controls.

Qualification stays separately locked. Regular prizes remain separate. Existing fixed-$5 and selected-increment award journals, current-final proofs and precedence remain unchanged. Nothing combines amounts across journals or chooses a new payout rule. Consolation/Satellite, nonstandard/manual events, synthetic practice, non-primary roles and final event reports do not mount this proposal slice. This does not complete the larger qualification/prize/Q/Side Results or settlement workflow.

## Source and authority
Reuses readSelectedStepPoolWorkspaceServerV3 and its existing history/current collectors. The new reader is factory-gated before clients, validates scope/current qualification, clones both observations immediately and compares the full private workspace. Proposal amounts cross only from a validated review branch whose qualification matches the displayed qualification. Historical recorded branch exposes only a fact that an unpaid record exists. Private ownership, source, qualification, proposal and participant pins are not copied into the panel model; fixed Tournament IDs remain visible for identity.

Normal getUser, verified subject/SID and primary-Director role are checked before and after source reads. Final verified SID is read after the last user/role await. The proposal read runs AFTER all other awaited finalized Results sources, immediately before render. A page-level regression reproduced the prior ordering flaw, then verified a later role change hides amounts and a session switch requires fresh admission after that switch. Repeated equality detects observed drift, not an atomic/ABA-proof database snapshot. This protects the new proposal slice; it is not a new certification of every legacy Results disclosure path.

No SQL, grants, calculator, ownership writer, award writer or backend flag changed. Existing proposal workspace, source collector, amount calculator, final-current pool readers and journal client are hash-proven unchanged in SOURCE_INVARIANTS.json. New poolProposalResultsEnabledV38 remains literal false; generic Preview configuration cannot open it.

## Executed checks
26 focused checks pass, covering new projection/reader/page timing plus existing pool and Main/Consolation prize paths. Final app suite: 3,875 pass, zero fail. Lint: zero errors, 252 existing warnings. Final build, type, provider and workspace outcomes are recorded in CHECKS.json; no pending stage is presumed passed. pnpm/dependency audit unavailable; private handoff absent.

26 browser cases at 390 and 1440 pass using actual Results control flow, the new reader, existing workspace/collectors/codecs, and actual new/shared SSR renderers. Both Q and Side proposals use their distinct existing saved increments. Cases cover unsaved/saved/source-changed/history/held/foreign-qualification, closed gate, co-Director, Consolation, Satellite, synthetic event, changed session, scoped review-route return and retained-byte preservation. No proposal/finalization or money write was exercised. The editor route wrapper and new return link are exercised with its controls explicitly replaced by a labeled fixture placeholder; its real controls are NOT newly accepted here.

Auth/RPC, unrelated legacy sources and selected page gates are synthetic ports. SSR uses the actual page module via the existing VM wiring fixture and ReactDOM rendering, not a real Next production server/RSC/cookie path, GoTrue/PostgREST, native database or physical devices. No real user browser, session, draft or tournament was inspected. Contexts and owned loopback listener closed.

The two-pool fixture initially supplied an invalid extra policy field to the existing strict calculator; real code correctly held that fixture, then the fixture was corrected without changing product math/validation. The page-fence failure is preserved in page-fence-reproduction.log. Initial framework advisory build stop is retained; no dependency upgrade or source workaround. Independent high-risk review: scoped PASS after disclosure ordering fix.

## Remaining runtime work
Keep the new gate off pending genuine authenticated source/role/ACL/currentness and real Next/phone/laptop acceptance. Existing dependencies are service reads get_selected_step_pool_record_provider_v3(actor,tid,eid), get_selected_step_pool_source_provider_v3(actor,tid,eid), plus normal get_tournament_role. Backend functions/gates and their exact schema/grants require independent verification, not assumed activation. Inherited source scope remains one official Main, 12 qualifying games, 1-2 Q and 1-6 Side pools; this adds no Consolation/Satellite or arbitrary-field support.

Production, practice tournament, user draft/session and V37 preserved. No hosted Auth/SQL/grant/flag/configuration, push, deployment, denied-publication retry or email action. Current official Supabase getUser/changelog and relevant Next server-component guidance were reviewed in this continuation; no SDK/package change.
