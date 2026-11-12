# Late account-link assignment repair — local review

## Proven cause
Enrollment snapshots roster_account_links.profile_id only when creating the event participant (0113). The service activation linker (0093) writes the permanent roster link but does not reconcile participants already enrolled. Existing re-enrollment skips those rows; 0116 correctly freezes published participant identities. The rehearsal was enrolled and scheduled before links were completed, leaving both event-participant profiles null. This is a product integration defect, not failed user activation. The source snapshot digest excludes profile_id (0164), so an audited null-to-exact-existing-link attachment can preserve immutable starts.

## Acceptance and implementation
Local migration 0273 creates a private forced-RLS append-only binding audit, a service-only exact-link reconciliation RPC, and automatic safe reconciliation after future roster-link insertion. It only fills a null participant profile from that participant's immutable roster link. No player, roster, seat, schedule, start, score or money changes are permitted. Existing nonparticipant-official and qualification guards remain active.

The entire event must be pristine: pending/version-one games, no submissions, confirmations, scorelines, paper captures/completions, recoveries, corrections, offline capabilities, qualification results, forfeits or cross-checked excluded games. Tournament/operation/event/game locks serialize relevant writers; excluded-game evidence now shares the event lock. Scored or conflicting assignments remain unmodified and generate explicit blocked audit records and a director-visible Event access needs review list. No new account or human role is granted.

## Executed local evidence
- Actual isolated PostgreSQL reproduced the hosted ordering bug.
- Explicit existing-link repair and automatic late binding passed, with immutable game/seat/start fingerprints and unchanged start digest.
- Identical replay, different-operation no-op, operation conflict, unauthorized actor and direct identity rewrite rejection passed.
- Two concurrent reconciliations produced one binding; concurrent score-versus-binding waited on game lock then rejected the evidence-bearing event.
- Normal independent digital submissions plus both confirmations verified the repaired game.
- Forfeit and excluded-extra-game evidence rejection passed; scored late linking preserves the approved roster link while blocking event assignment.
- Phone390/desktop1440 production component checks passed: pending assignment message, truthful simulation label, explicit comparison consent, self-account denial, ordinary witness mode, lost-response reload without automatic retry. Task-owned server stopped.
- Final pnpm verify passed: 1,157 app tests, dependency audit clean, lint (existing warnings only), provider checks, production build and eight workspace checks. Six private handoff checks passed. Normal link-before-enrollment and all new FK leading-index coverage passed in actual isolated PostgreSQL. Expanded local fixture and task container absence verified after cleanup. No hosted mutation occurred.
- Independent Sol review: all identified P1/P2 source findings addressed; no remaining P1/P2 in final source review.

## Hosted approval boundary — nothing applied
First publish the compatible optional-field parser and UI on the existing test branch/PR122; verify exact CI/READY Preview. Then apply ONLY reviewed0273 to staging nnhcnvksxgxnpvdqjgpg, preserving pre-migration table fingerprints. Then separately execute the service-only reconciliation twice for replacement fd0589d0-31e7-4921-b793-1beec2431337, actor de0f27a1-60d0-4449-af83-fdf360a9bc08, existing Director link51b6c278-e534-4c2a-a38b-06a0e27fbafe and B linkea7d6751-2aeb-41ca-9360-90a2369909c4. Recheck pristine evidence, exact roles/links and current migration hash before action. Compare old fixtures/finals and game/schedule/start/seat fingerprints; only the two intended participant profiles and new operation/audit/binding records may change. Verify actual My Games and game context under both accounts without scoring. No repeated activation, no new fixture, no credentials, no production or real payments. Do not apply through direct table SQL.
