import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
test('game API handlers validate, authenticate with claims, and call RPCs only', () => {
  const submission = read('src/app/api/v1/games/[id]/submissions/route.ts');
  const confirmation = read('src/app/api/v1/games/[id]/confirmations/route.ts');
  for (const source of [submission, confirmation]) {
    assert.match(source, /getClaims/); assert.match(source, /isUuid/); assert.match(source, /idempotencyKey/); assert.match(source, /\.rpc\(/);
    assert.doesNotMatch(source, /record_rejected_game_operation/);
    assert.doesNotMatch(source, /\.from\(|\.insert\(|\.update\(/);
    assert.match(source, /operation_unavailable/);
    assert.match(source, /status === "rejected"/);
    assert.doesNotMatch(source, /error\.message/);
  }
  assert.match(submission, /submit_game_score/); assert.match(confirmation, /confirm_game_score/);
});

test('correction API handlers validate request shapes and discriminate accepted rejection from operation failure', () => {
  const proposal = read('src/app/api/v1/games/[id]/corrections/route.ts');
  const review = read('src/app/api/v1/corrections/[id]/reviews/route.ts');
  const reconciliation = read('src/app/api/v1/corrections/[id]/reconciliation/route.ts');
  const contract = read('src/lib/api/correction.ts');
  for (const source of [proposal, review]) {
    assert.match(source, /getClaims/);
    assert.match(source, /isUuid/);
    assert.match(source, /idempotencyKey/);
    assert.match(source, /operation_unavailable/);
    assert.doesNotMatch(source, /\.from\(|\.insert\(|\.update\(|service_role/);
  }
  assert.match(proposal, /propose_game_correction/);
  assert.match(proposal, /expectedGameVersion/);
  assert.match(proposal, /winnerSide/);
  assert.match(proposal, /maxReasonLength = 500/);
  assert.match(review, /review_game_correction/);
  assert.match(review, /\["approve", "reject"\]/);
  assert.match(review, /isAcceptedCorrectionReview/);
  assert.match(reconciliation, /get_correction_operation_reconciliation/);
  assert.match(reconciliation, /getClaims/);
  assert.match(reconciliation, /idempotencyKey/);
  assert.doesNotMatch(reconciliation, /\.from\(|service_role/);
  assert.match(contract, /value\.status === "approved" && value\.decision === "approve"/);
  assert.match(contract, /value\.status === "rejected" && value\.decision === "reject"/);
  assert.match(contract, /typeof value\.code === "string"/);
});

test('correction response validators bind successful responses to the submitted operation', async () => {
  const contract = await import(pathToFileURL(path.join(root, 'src/lib/api/correction.ts')).href);
  const correctionId = '00000000-0000-4000-8000-000000000001';
  const otherCorrectionId = '00000000-0000-4000-8000-000000000002';
  const gameId = '00000000-0000-4000-8000-000000000003';
  const otherGameId = '00000000-0000-4000-8000-000000000004';
  assert.equal(contract.isAcceptedCorrectionProposal({ status: 'pending', correction_id: correctionId, game_id: gameId, version: 7 }, correctionId, gameId, 7), true);
  assert.equal(contract.isAcceptedCorrectionProposal({ status: 'pending', correction_id: otherCorrectionId, game_id: gameId, version: 7 }, correctionId, gameId, 7), false);
  assert.equal(contract.isAcceptedCorrectionProposal({ status: 'applied', correction_id: correctionId, game_id: otherGameId, version: 8 }, correctionId, gameId, 7), false);
  assert.equal(contract.isAcceptedCorrectionProposal({ status: 'pending', correction_id: correctionId, game_id: gameId, version: -1 }, correctionId, gameId, 7), false);
  assert.equal(contract.isAcceptedCorrectionReview({ status: 'rejected', decision: 'reject', correction_id: correctionId, game_id: gameId, version: 7 }, correctionId, 'reject'), true);
  assert.equal(contract.isAcceptedCorrectionReview({ status: 'rejected', decision: 'reject', correction_id: correctionId, game_id: gameId, version: 7 }, correctionId, 'approve'), false);
  assert.equal(contract.isAcceptedCorrectionReview({ status: 'approved', decision: 'approve', correction_id: correctionId, game_id: gameId, version: 8 }, correctionId, 'approve'), true);
  assert.equal(contract.isAcceptedCorrectionReview({ status: 'approved', decision: 'approve', correction_id: correctionId, game_id: gameId, version: 8 }, correctionId, 'reject'), false);
  assert.equal(contract.isAcceptedCorrectionReview({ status: 'rejected', decision: 'reject', correction_id: otherCorrectionId, game_id: gameId, version: 7 }, correctionId, 'reject'), false);
  assert.equal(contract.isRejectedCorrectionOperation({ status: 'rejected', code: 'not_pending_review' }), true);
  assert.equal(contract.isRejectedCorrectionOperation({ status: 'rejected', decision: 'reject', code: 'not_pending_review' }), false);
});
test('game RPC migration is private, atomic, authenticated, and derives verified scorelines', () => {
  const sql = (read('database/migrations/0001_vertical_slice_core.sql') + read('database/migrations/0003_game_submission_confirmation_rpc.sql')).toLowerCase();
  assert.match(sql, /security definer/); assert.match(sql, /set search_path = ''/); assert.match(sql, /auth\.uid\(\)/g);
  assert.match(sql, /idempotency conflict/); assert.match(sql, /grant execute on function public\.submit_game_score/); assert.match(sql, /grant execute on function public\.confirm_game_score/);
  assert.match(sql, /state = 'verified'/); assert.match(sql, /insert into app\.card_scorelines/); assert.match(sql, /v_count = 2/);
  assert.match(sql, /only the assigned player may confirm own submission/); assert.match(sql, /state = case when v_matching_count = 1 then 'confirmation_pending' else 'mismatch' end/);
  assert.match(sql, /extensions\.digest/); assert.doesNotMatch(sql, /public\.digest/); assert.doesNotMatch(sql, /p_request_hash/); assert.match(sql, /game_verified/); assert.match(sql, /operation_receipt_id/);
  assert.match(sql, /status = 'open'/); assert.match(sql, /status = 'checked_in'/); assert.match(sql, /submission_rejected/); assert.match(sql, /confirmation_rejected/); assert.match(sql, /get stacked diagnostics/);
  assert.match(sql, /create extension if not exists pgcrypto with schema extensions/);
  assert.match(sql, /create table if not exists app\.operation_conflicts/);
  assert.match(sql, /attempted_idempotency_key/);
  assert.match(sql, /attempted_request_hash/);
  assert.match(sql, /prior_receipt_id uuid references app\.operation_receipts\(id\)/);
  assert.match(sql, /operation_conflicts_immutable/);
  assert.match(sql, /exception when sqlstate 'p0001'/);
  assert.match(sql, /when others then\s+raise/);
  assert.equal((sql.match(/exception when sqlstate 'p0001'/g) ?? []).length, 2);
  assert.equal((sql.match(/\n\s*exception\b/g) ?? []).length, 2);
  assert.match(sql, /reason_code/);
  assert.match(sql, /required submission argument is null/);
  assert.match(sql, /required confirmation argument is null/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /hashtextextended/);
  assert.match(sql, /select \* into v_existing[\s\S]*?if not exists \(select 1 from app\.tournaments/);
  assert.doesNotMatch(sql, /grant (select|insert|update|delete|all) on table/i);
});

test('rejection audit boundary preserves stable codes and does not swallow audit failures', () => {
  const sql = read('database/migrations/0003_game_submission_confirmation_rpc.sql').toLowerCase();
  assert.match(sql, /jsonb_build_object\('status', 'rejected', 'code'/);
  assert.match(sql, /insert into app\.audit_events/);
  assert.match(sql, /when others then\s+raise/);
  assert.doesNotMatch(sql, /record_rejected_game_operation/);
});

test('assigned game context and live score entry stay server-authoritative', () => {
  const contextSql = read('database/migrations/0006_assigned_game_context.sql') + read('database/migrations/0007_assigned_game_context_hardening.sql');
  const confirmationHardening = read('database/migrations/0008_confirmation_eligibility_hardening.sql');
  const submissionStateHardening = read('database/migrations/0009_submission_state_hardening.sql');
  const submittedInvariant = read('database/migrations/0010_submitted_state_invariant.sql');
  const contextDal = read('src/lib/games/assigned-game-context.ts');
  const liveScore = read('src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx');
  const howTo = read('src/app/tournament/[tournamentId]/how-to/page.tsx');
  assert.match(contextSql, /create or replace function public\.get_assigned_game_context/);
  assert.match(contextSql, /security definer/);
  assert.match(contextSql, /player_participant\.profile_id = auth\.uid\(\)/);
  assert.match(contextSql, /player_participant\.status = 'checked_in'/);
  assert.match(contextSql, /t\.status = 'open'/);
  assert.match(contextSql, /rv\.approved_at is not null/);
  assert.match(contextSql, /e\.format = 'standard_singles'/);
  assert.match(contextSql, /cg\.state in \('pending', 'submitted', 'confirmation_pending', 'mismatch', 'verified'\)/);
  assert.match(contextSql, /'ownSubmission', case when own_submission\.id is null then null else jsonb_build_object\('id', own_submission\.id, 'winnerSide', own_submission\.winner_side, 'margin', own_submission\.margin\)/);
  assert.match(contextSql, /'ownConfirmed', own_confirmation\.id is not null/);
  assert.match(contextSql, /'canConfirm', cg\.state = 'confirmation_pending'/);
  assert.match(contextSql, /revoke all on function public\.get_assigned_game_context/);
  assert.match(contextDal, /data\.tournamentId !== tournamentId/);
  assert.match(contextDal, /player\.side === data\.opponent\.side/);
  assert.doesNotMatch(contextSql, /profileId|participantId/);
  assert.match(liveScore, /Submit My Independent Entry/);
  assert.match(liveScore, /Confirm My Entry/);
  assert.match(liveScore, /crypto\.randomUUID\(\)/);
  assert.match(liveScore, /window\.sessionStorage/);
  assert.match(liveScore, /operationId\("submission", `id:\$\{fingerprint\}`\)/);
  assert.match(liveScore, /response\.status < 500/);
  assert.match(liveScore, /server response was incomplete/);
  assert.match(liveScore, /context\.ownSubmission\.winnerSide/);
  assert.match(confirmationHardening, /before insert on app\.score_confirmations/);
  assert.match(confirmationHardening, /e\.scoring_method = 'digital'/);
  const confirmationSource = read('database/migrations/0003_game_submission_confirmation_rpc.sql').split('create or replace function public.confirm_game_score')[1];
  assert.match(confirmationSource, /event is not approved for digital scoring/);
  assert.match(read('database/migrations/0003_game_submission_confirmation_rpc.sql'), /v_submission_count = 1[\s\S]*?state = 'submitted'/);
  assert.match(submissionStateHardening, /after insert on app\.score_submissions/);
  assert.match(submissionStateHardening, /state = 'submitted'/);
  assert.match(submittedInvariant, /g\.state = 'submitted' and submission_count <> 1/);
  assert.match(submittedInvariant, /g\.state in \('mismatch', 'confirmation_pending', 'verified', 'corrected'\) and submission_count <> 2/);
  assert.match(liveScore, /canConfirm/);
  assert.match(liveScore, /Playing with one paper card and one digital card/);
  assert.match(liveScore, /Open Start Here \/ How To/);
  assert.match(howTo, /requireTournamentAccess/);
  assert.match(howTo, /One paper card and one digital card/);
  assert.match(howTo, /do not mark them verified by hand/);
  assert.match(liveScore, /\/api\/v1\/games\/\$\{context\.gameId\}\/submissions/);
  assert.match(liveScore, /\/api\/v1\/games\/\$\{context\.gameId\}\/confirmations/);
  assert.doesNotMatch(liveScore, /service_role/);
});

test('pilot trigger correction migration hardens existing deferred functions', () => {
  const sql = read('database/migrations/0004_trigger_security_hardening.sql').toLowerCase();
  assert.match(sql, /alter function app\.revalidate_game\(uuid\) security definer/);
  assert.match(sql, /alter function app\.revalidate_game_from_submission\(\) set search_path = ''/);
  assert.match(sql, /revoke all on function app\.revalidate_game\(uuid\) from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant execute/);
});

test('correction foundation is append-only and server-authorized', () => {
  const sql = read('database/migrations/0011_correction_foundation.sql');
  const fingerprintRepair = read('database/migrations/0019_correction_idempotency_fingerprint_repair.sql');
  const legacyCompatibility = read('database/migrations/0020_correction_legacy_replay_compatibility.sql');
  const policyAware = read('database/migrations/0023_policy_aware_correction_proposals.sql');
  const lockRepair = read('database/migrations/0026_correction_policy_tournament_lock_repair.sql');
  assert.match(sql, /create table app\.game_corrections/);
  assert.match(sql, /create table app\.correction_state_events/);
  assert.match(sql, /game_corrections_immutable/);
  assert.match(sql, /correction_state_events_immutable/);
  assert.match(sql, /correction_operation_conflicts/);
  assert.match(sql, /correction_operation_conflicts_immutable/);
  assert.match(sql, /security definer/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /role = 'cross_checker'/);
  assert.match(sql, /cannot correct own game/);
  assert.match(sql, /only verified games may be corrected/);
  assert.match(sql, /stale game version/);
  assert.match(sql, /correction must change result/);
  assert.match(sql, /p_winner_side is null/);
  assert.match(sql, /p_margin is null/);
  assert.match(sql, /corrections require an open tournament/);
  assert.match(sql, /event is not approved for digital Standard Singles correction/);
  assert.match(sql, /select \* into v_existing[\s\S]*?corrections require an open tournament/);
  assert.match(sql, /exception when sqlstate 'P0001'/);
  assert.match(sql, /'correction_rejected'/);
  assert.match(sql, /'correction_rejected',v_response/);
  assert.match(sql, /when others then raise/);
  assert.match(sql, /confirmations require two submissions and an eligible game state/);
  assert.match(sql, /confirmations require matching submission winner and margin/);
  assert.match(sql, /idempotency_conflict/);
  assert.match(sql, /jsonb_build_array\('propose_game_correction'/);
  assert.doesNotMatch(sql, /concat_ws\('\|','propose_game_correction'/);
  assert.match(fingerprintRepair, /jsonb_build_array\('propose_game_correction'/);
  assert.match(fingerprintRepair, /v_existing\.request_hash <> v_hash and v_existing\.request_hash <> v_legacy_hash/);
  assert.match(legacyCompatibility, /v_existing\.request_hash <> v_hash and v_existing\.request_hash <> v_legacy_hash/);
  assert.match(policyAware, /v_policy\.reason_required/);
  assert.match(policyAware, /'correction reason required'/);
  assert.match(policyAware, /'pending correction already exists'/);
  assert.match(policyAware, /'status','pending'/);
  assert.match(policyAware, /if v_policy\.required_approvals = 1 then/);
  assert.match(policyAware, /select status into v_tournament_status from app\.tournaments where id = v_game\.tournament_id for update/);
  assert.match(policyAware, /v_tournament_status is distinct from 'open'/);
  assert.match(lockRepair, /select status into v_tournament_status from app\.tournaments where id = v_game\.tournament_id for update/);
  assert.match(sql, /update app\.card_scorelines set/);
  assert.match(sql, /state='corrected'/);
  assert.match(sql, /revoke all on function public\.propose_game_correction/);
});

test('correction history foreign keys have local covering indexes', () => {
  const sql = read('database/migrations/0012_correction_history_indexes.sql');
  const policySql = read('database/migrations/0027_correction_policy_history_indexes.sql');
  assert.match(sql, /game_corrections_canonical_scope_idx/);
  assert.match(sql, /game_corrections_editor_profile_id_idx/);
  assert.match(sql, /correction_state_events_correction_scope_idx/);
  assert.match(sql, /correction_state_events_actor_profile_id_idx/);
  assert.match(sql, /correction_operation_conflicts_actor_profile_id_idx/);
  assert.match(sql, /correction_operation_conflicts_prior_receipt_id_idx/);
  assert.match(policySql, /correction_policy_versions_creator_profile_id_idx/);
  assert.match(policySql, /game_corrections_policy_version_scope_idx/);
  assert.match(policySql, /correction_policy_operation_conflicts_actor_profile_id_idx/);
  assert.match(policySql, /correction_policy_operation_conflicts_tournament_id_idx/);
  assert.match(policySql, /correction_policy_operation_conflicts_prior_receipt_id_idx/);
  assert.doesNotMatch(sql, /grant\s+/i);
  assert.doesNotMatch(policySql, /grant\s+/i);
});

test('correction policy versions are private, append-only, and seeded safely', () => {
  const sql = read('database/migrations/0021_correction_policy_versions.sql');
  const configure = read('database/migrations/0022_configure_correction_policy.sql');
  const repair = read('database/migrations/0024_correction_policy_configuration_repair.sql');
  assert.match(sql, /create table app\.correction_policy_versions/);
  assert.match(sql, /primary key \(tournament_id, version\)/);
  assert.match(sql, /required_approvals smallint not null default 0 check \(required_approvals between 0 and 1\)/);
  assert.match(sql, /correction_policy_versions_immutable/);
  assert.match(sql, /revoke all on table app\.correction_policy_versions from public, anon, authenticated/);
  assert.match(sql, /insert into app\.correction_policy_versions/);
  assert.match(sql, /provision_default_correction_policy/);
  assert.match(sql, /game_corrections_policy_version_fk/);
  assert.match(configure, /create or replace function public\.configure_correction_policy/);
  assert.match(configure, /security definer/);
  assert.match(configure, /auth\.uid\(\)/);
  assert.match(configure, /role in \('director', 'co_director'\)/);
  assert.match(configure, /jsonb_build_array\('configure_correction_policy'/);
  assert.match(configure, /revoke all on function public\.configure_correction_policy/);
  assert.match(configure, /grant execute on function public\.configure_correction_policy[\s\S]*authenticated/);
  assert.match(configure, /create table app\.correction_policy_operation_conflicts/);
  assert.match(configure, /correction_policy_operation_conflicts_immutable/);
  assert.match(repair, /create table if not exists app\.correction_policy_operation_conflicts/);
  assert.match(repair, /drop trigger if exists correction_policy_operation_conflicts_immutable/);
});

test('approval-required corrections have an independent, sequenced review boundary', () => {
  const sql = read('database/migrations/0028_correction_review_lifecycle.sql');
  const proposalRepair = read('database/migrations/0029_correction_proposal_publication_guard_repair.sql');
  const publicationIndexes = read('database/migrations/0030_event_publication_state_indexes.sql');
  assert.match(sql, /create table app\.event_publication_states/);
  assert.match(sql, /event_publication_states_immutable/);
  assert.match(sql, /provision_event_publication_state/);
  assert.match(sql, /transition_sequence smallint not null default 1/);
  assert.match(sql, /reviewer_role text check/);
  assert.match(sql, /correction_state_events_transition_sequence_unique/);
  assert.match(sql, /create or replace function app\.revalidate_correction_lifecycle/);
  assert.match(sql, /array\['pending', 'approved', 'applied'\]/);
  assert.match(sql, /array\['pending', 'rejected'\]/);
  assert.match(sql, /game has multiple unresolved corrections/);
  assert.match(sql, /create constraint trigger correction_lifecycle_from_correction/);
  assert.match(sql, /create constraint trigger correction_lifecycle_from_state_event/);
  assert.match(sql, /create or replace function public\.review_game_correction/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /jsonb_build_array\('review_game_correction'/);
  assert.match(sql, /p_decision is null/);
  assert.match(sql, /select \* into v_existing[\s\S]*?correction review requires an open tournament/);
  assert.match(sql, /reviewer must be independent/);
  assert.match(sql, /role in \('cross_checker', 'director', 'co_director'\)/);
  assert.match(sql, /correction policy snapshot invalid/);
  assert.match(sql, /correction source is stale/);
  assert.match(sql, /result publication guard blocks correction/);
  assert.match(sql, /from app\.event_publication_states[\s\S]*?for update/);
  assert.match(sql, /'approved',2,v_reviewer_role/);
  assert.match(sql, /'applied',3/);
  assert.match(sql, /'rejected',2,v_reviewer_role/);
  assert.match(sql, /update app\.card_scorelines set/);
  assert.match(sql, /update app\.canonical_games set state = 'corrected'/);
  assert.match(sql, /revoke all on function public\.review_game_correction/);
  assert.match(sql, /grant execute on function public\.review_game_correction[\s\S]*authenticated/);
  assert.match(proposalRepair, /from app\.event_publication_states[\s\S]*?for update/);
  assert.match(proposalRepair, /result publication guard blocks correction/);
  assert.match(publicationIndexes, /event_publication_states_event_scope_idx/);
  assert.doesNotMatch(publicationIndexes, /grant\s+/i);
});

test('correction workspace read model is server-scoped and suppresses non-actionable records', () => {
  const workspace = read('database/migrations/0031_correction_workspace_read_model.sql');
  assert.match(workspace, /create or replace function public\.get_correction_workspace/);
  assert.match(workspace, /security definer/);
  assert.match(workspace, /set search_path = ''/);
  assert.match(workspace, /auth\.uid\(\)/);
  assert.match(workspace, /t\.status = 'open'/);
  assert.match(workspace, /may_propose/);
  assert.match(workspace, /may_review/);
  assert.match(workspace, /role = 'cross_checker'/);
  assert.match(workspace, /role in \('cross_checker', 'director', 'co_director'\)/);
  assert.match(workspace, /s\.profile_id not in \(side_a\.profile_id, side_b\.profile_id\)/);
  assert.match(workspace, /s\.profile_id <> c\.editor_profile_id/);
  assert.match(workspace, /ps\.state = 'draft'/);
  assert.match(workspace, /c\.required_approvals = 1/);
  assert.match(workspace, /cse\.state = 'pending' and cse\.transition_sequence = 1/);
  assert.match(workspace, /revoke all on function public\.get_correction_workspace\(uuid\) from public, anon/);
  assert.match(workspace, /grant execute on function public\.get_correction_workspace\(uuid\) to authenticated/);
  assert.doesNotMatch(workspace, /grant\s+(select|insert|update|delete|all)\s+on\s+table/i);
});

test('correction operation reconciliation exposes only the caller receipt and no private table grants', () => {
  const sql = read('database/migrations/0033_correction_operation_reconciliation.sql');
  assert.match(sql, /create or replace function public\.get_correction_operation_reconciliation/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /v_actor uuid := auth\.uid\(\)/);
  assert.match(sql, /actor_profile_id = v_actor/);
  assert.match(sql, /client_operation_id = p_idempotency_key/);
  assert.match(sql, /operation_type = 'review_game_correction' and target_id = p_correction_id/);
  assert.match(sql, /operation_type = 'propose_game_correction' and response_payload->>'correction_id' = p_correction_id::text/);
  assert.match(sql, /revoke all on function public\.get_correction_operation_reconciliation\(uuid,uuid\) from public, anon/);
  assert.match(sql, /grant execute on function public\.get_correction_operation_reconciliation\(uuid,uuid\) to authenticated/);
  assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete|all)\s+on\s+table/i);
});

test('director correction policy workspace is scoped, append-only, and retry-safe', () => {
  const sql = read('database/migrations/0034_correction_policy_workspace.sql');
  const policyDal = read('src/lib/corrections/policy.ts');
  const policyRoute = read('src/app/api/v1/tournaments/[id]/correction-policy/route.ts');
  const reconciliationRoute = read('src/app/api/v1/tournaments/[id]/correction-policy/reconciliation/route.ts');
  const page = read('src/app/tournament/[tournamentId]/correction-policy/page.tsx');
  const client = read('src/app/tournament/[tournamentId]/correction-policy/policy-client.tsx');
  assert.match(sql, /create or replace function public\.get_correction_policy/);
  assert.match(sql, /create or replace function public\.get_correction_policy_operation_reconciliation/);
  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /role in \('director', 'co_director'\)/);
  assert.match(sql, /order by version desc/);
  assert.match(sql, /actor_profile_id = v_actor/);
  assert.match(sql, /operation_type = 'configure_correction_policy'/);
  assert.match(sql, /drop function public\.configure_correction_policy\(uuid, boolean, smallint, uuid\)/);
  assert.match(sql, /p_expected_policy_version integer/);
  assert.match(sql, /v_current_policy_version is distinct from p_expected_policy_version/);
  assert.match(sql, /'stale correction policy'/);
  assert.match(sql, /'stale_policy'/);
  assert.match(sql, /configure_correction_policy\(uuid, boolean, smallint, integer, uuid\)/);
  assert.match(sql, /revoke all on function public\.get_correction_policy/);
  assert.match(sql, /grant execute on function public\.get_correction_policy\(uuid\) to authenticated/);
  assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete|all)\s+on\s+table/i);
  assert.match(policyDal, /server-only/);
  assert.match(policyDal, /get_correction_policy/);
  assert.doesNotMatch(policyDal, /\.from\(/);
  assert.match(policyRoute, /getClaims/);
  assert.match(policyRoute, /configure_correction_policy/);
  assert.match(policyRoute, /idempotencyKey/);
  assert.match(policyRoute, /requiredApprovals/);
  assert.match(policyRoute, /expectedPolicyVersion/);
  assert.match(reconciliationRoute, /get_correction_policy_operation_reconciliation/);
  assert.match(reconciliationRoute, /getClaims/);
  assert.match(page, /requireTournamentAccess/);
  assert.match(page, /getCorrectionPolicy/);
  assert.match(page, /\['director', 'co_director'\]/);
  assert.match(client, /acc-correction:policy:/);
  assert.match(client, /sessionStorage/);
  assert.match(client, /reconciliation/);
  assert.match(client, /crypto\.randomUUID\(\)/);
  assert.match(client, /expectedPolicyVersion: policy\.policyVersion/);
  assert.match(client, /router\.refresh\(\)/);
});

test('registration claim review remains an immutable non-enrollment boundary', () => {
  const sql = read('database/migrations/0035_registration_claim_review_workspace.sql');
  assert.match(sql, /create table app\.registration_claim_decisions/);
  assert.match(sql, /unique \(claim_id\)/);
  assert.match(sql, /registration_claim_decisions_immutable/);
  assert.match(sql, /get_registration_claim_review_workspace/);
  assert.match(sql, /review_registration_claim/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /role in \('director','co_director'\)/);
  assert.match(sql, /p_decision is null/);
  assert.match(sql, /od\.decision is distinct from 'rejected'/);
  assert.match(sql, /p_duplicate_resolution is distinct from 'confirmed_distinct_person'/);
  assert.match(sql, /od\.decision='approved_for_roster'/);
  assert.match(sql, /'rosterCreated',false/);
  assert.match(sql, /'paymentRecorded',false/);
  assert.match(sql, /'checkedIn',false/);
  assert.match(sql, /revoke all on table app\.registration_claim_decisions from public, anon, authenticated/);
  assert.doesNotMatch(sql, /insert into app\.(profiles|tournament_roles|event_participants)/);
  assert.doesNotMatch(sql, /insert into auth\.users/);
});

test('approved registration claims promote only to an immutable private roster identity', () => {
  const sql = read('database/migrations/0036_registration_claim_roster_boundary.sql');
  const authorizationRepair = read('database/migrations/0038_roster_promotion_authorization_repair.sql');
  assert.match(sql, /unique \(id, tournament_id, claim_id, decision\)/);
  assert.match(sql, /create table app\.tournament_roster_entries/);
  assert.match(sql, /approval_decision text not null default 'approved_for_roster'/);
  assert.match(sql, /references app\.registration_claim_decisions\(id, tournament_id, claim_id, decision\)/);
  assert.match(sql, /unique \(source_claim_id\)/);
  assert.match(sql, /unique \(approval_decision_id\)/);
  assert.match(sql, /tournament_roster_entries_immutable/);
  assert.match(sql, /create_roster_entry_from_registration_claim/);
  assert.match(sql, /get_tournament_roster_workspace/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /role in \('director', 'co_director'\)/);
  assert.match(sql, /v_authorized boolean := false/);
  assert.match(sql, /v_authorized := true;[\s\S]*?select \* into v_existing/);
  assert.match(sql, /elsif v_authorized and v_tournament_exists then/);
  assert.match(authorizationRepair, /v_authorized := true;[\s\S]*?select \* into v_existing/);
  assert.match(authorizationRepair, /elsif v_authorized and v_tournament_exists then/);
  assert.match(sql, /v_status not in \('draft', 'open'\)/);
  assert.match(sql, /approved claim decision required/);
  assert.match(sql, /claim already promoted/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /idempotency conflict/);
  assert.match(sql, /roster_entry_operation_conflicts/);
  assert.match(sql, /'profileLinked', false/);
  assert.match(sql, /'roleGranted', false/);
  assert.match(sql, /'eventEnrolled', false/);
  assert.match(sql, /'paymentRecorded', false/);
  assert.match(sql, /'checkedIn', false/);
  assert.match(sql, /'seatAssigned', false/);
  assert.match(sql, /revoke all on table app\.tournament_roster_entries from public, anon, authenticated/);
  assert.match(sql, /revoke all on function public\.create_roster_entry_from_registration_claim/);
  assert.doesNotMatch(sql, /insert into (auth\.users|app\.(profiles|tournament_roles|event_participants))/);
  assert.doesNotMatch(sql, /\n\s*profile_id uuid/);
  assert.doesNotMatch(sql, /table_seat|verification_id|check_in|payment_status/i);
});

test('registration review and roster foreign keys have advisor-covering indexes', () => {
  const sql = read('database/migrations/0037_registration_review_roster_indexes.sql');
  for (const index of [
    'registration_claim_decisions_actor_profile_id_idx',
    'registration_claim_decisions_claim_scope_idx',
    'registration_claim_decisions_duplicate_claim_scope_idx',
    'registration_claim_decisions_operation_receipt_scope_idx',
    'registration_claim_operation_conflicts_actor_profile_id_idx',
    'registration_claim_operation_conflicts_tournament_id_idx',
    'registration_claim_operation_conflicts_prior_receipt_id_idx',
    'tournament_roster_entries_approval_decision_scope_idx',
    'tournament_roster_entries_source_claim_scope_idx',
    'tournament_roster_entries_operation_receipt_scope_idx',
  ]) assert.match(sql, new RegExp(`create index ${index}`));
  assert.doesNotMatch(sql, /grant\\s+|policy|alter table/i);
});

test('protected correction workspace reads only the scoped RPC and never direct tables', () => {
  const page = read('src/app/tournament/[tournamentId]/corrections/page.tsx');
  const dal = read('src/lib/corrections/workspace.ts');
  const client = read('src/app/tournament/[tournamentId]/corrections/corrections-client.tsx');
  assert.match(page, /requireTournamentAccess/);
  assert.match(page, /getCorrectionWorkspace/);
  assert.match(page, /pending correction does not change scorecards, standings, or exports/i);
  assert.match(dal, /server-only/);
  assert.match(dal, /get_correction_workspace/);
  assert.match(dal, /proposalCandidates/);
  assert.match(dal, /pendingReviews/);
  assert.doesNotMatch(dal, /\.from\(/);
  assert.match(client, /crypto\.randomUUID\(\)/);
  assert.match(client, /crypto\.subtle\.digest/);
  assert.match(client, /window\.sessionStorage/);
  assert.match(client, /clearOtherCorrectionActors/);
  assert.match(client, /Refresh before changing this result/);
  assert.match(client, /Refresh before changing its decision/);
  assert.match(client, /router\.refresh\(\)/);
  assert.match(client, /does not affect scorecards, standings, or exports yet/i);
  assert.match(client, /response\.status < 500/);
  assert.match(client, /server response was incomplete/i);
  assert.match(client, /Save correction/);
  assert.match(client, /Approve correction/);
  assert.match(client, /Reject correction/);
  assert.doesNotMatch(client, /proposal:\$\{fingerprint\}|review:\$\{item\.correctionId\}:\$\{decision\}/);
  assert.doesNotMatch(client, /service_role|supabase\.(?:from|rpc)/);
});

test('correction retry storage keys omit private fields and stale actor envelopes are cleared', async () => {
  const operations = await import(pathToFileURL(path.join(root, 'src/lib/corrections/operation-envelope.ts')).href);
  const actorA = '00000000-0000-4000-8000-000000000001';
  const actorB = '00000000-0000-4000-8000-000000000002';
  const gameId = '00000000-0000-4000-8000-000000000003';
  const reason = 'Private reason: Barb Stevens asked for a correction.';
  const key = operations.proposalOperationKey(actorA, gameId);
  assert.doesNotMatch(key, /Private|Barb|reason/i);
  const values = new Map([[key, JSON.stringify({ reason })], [operations.reviewOperationKey(actorB, gameId), JSON.stringify({ decision: 'approve' })], ['unrelated', 'keep']]);
  const storage = { get length() { return values.size; }, key(index) { return [...values.keys()][index] ?? null; }, getItem(key) { return values.get(key) ?? null; }, setItem(key, value) { values.set(key, value); }, removeItem(key) { values.delete(key); } };
  operations.clearOtherCorrectionActors(storage, actorB);
  assert.equal(values.has(key), false);
  assert.equal(values.has(operations.reviewOperationKey(actorB, gameId)), true);
  assert.equal(values.get('unrelated'), 'keep');
});

test('correction reason limit is enforced inside the private schema', () => {
  const reasonLimit = read('database/migrations/0032_correction_reason_limit.sql');
  assert.match(reasonLimit, /create or replace function app\.enforce_correction_reason_limit/);
  assert.match(reasonLimit, /security definer/);
  assert.match(reasonLimit, /set search_path = ''/);
  assert.match(reasonLimit, /char_length\(new\.reason\) > 500/);
  assert.match(reasonLimit, /octet_length\(new\.reason\) > 2000/);
  assert.match(reasonLimit, /before insert on app\.game_corrections/);
  assert.match(reasonLimit, /revoke all on function app\.enforce_correction_reason_limit/);
});
