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
  const boundary = read('src/lib/api/route-boundary.ts') + read('src/lib/api/verified-subject.ts');
  for (const source of [submission + boundary, confirmation + boundary]) {
    assert.match(source, /getClaims/); assert.match(source, /isUuid/); assert.match(source, /idempotencyKey/); assert.match(source, /\.rpc\(/);
    assert.doesNotMatch(source, /record_rejected_game_operation/);
    assert.doesNotMatch(source, /\.from\(|\.insert\(|\.update\(/);
    assert.match(source, /operation_unavailable/);
    assert.match(source, /isRejectedGameOperation/);
    assert.doesNotMatch(source, /error\.message/);
  }
  assert.match(submission, /submit_game_score/); assert.match(confirmation, /confirm_game_score/);
  assert.match(submission, /isAcceptedSubmission/); assert.match(confirmation, /isAcceptedConfirmation/);
  assert.match(submission + confirmation, /withApiFailureBoundary/);
  assert.match(submission + confirmation, /requireVerifiedSubject/);
});

test('game operation responses bind to the requested game and submission before returning success', async () => {
  const game = await import(pathToFileURL(path.join(root, 'src/lib/api/game-operation.ts')).href);
  const gameId = '00000000-0000-4000-8000-000000000001';
  const otherGameId = '00000000-0000-4000-8000-000000000002';
  const submissionId = '00000000-0000-4000-8000-000000000003';
  assert.equal(game.isAcceptedSubmission({ status: 'submitted', game_id: gameId, submission_id: submissionId }, gameId, submissionId), true);
  assert.equal(game.isAcceptedSubmission({ status: 'submitted', game_id: otherGameId, submission_id: submissionId }, gameId, submissionId), false);
  assert.equal(game.isAcceptedSubmission({ status: 'submitted', game_id: gameId, submission_id: otherGameId }, gameId, submissionId), false);
  assert.equal(game.isAcceptedSubmission(null, gameId, submissionId), false);
  assert.equal(game.isAcceptedConfirmation({ status: 'verified', game_id: gameId }, gameId), true);
  assert.equal(game.isAcceptedConfirmation({ status: 'verified', game_id: otherGameId }, gameId), false);
  assert.equal(game.isRejectedGameOperation({ status: 'rejected', code: 'not_assigned', game_id: gameId }, gameId), true);
  assert.equal(game.isRejectedGameOperation({ status: 'rejected', code: 'not_assigned', game_id: otherGameId }, gameId), false);
});

test('private API failure boundary distinguishes unavailable claims, missing sessions, and thrown operations', async () => {
  const boundary = await import(pathToFileURL(path.join(root, 'src/lib/api/verified-subject.ts')).href);
  const subject = await boundary.requireVerifiedSubject({ auth: { getClaims: async () => ({ data: { claims: { sub: '00000000-0000-4000-8000-000000000001' } }, error: null }) } });
  assert.equal(subject, '00000000-0000-4000-8000-000000000001');
  assert.equal(await boundary.requireVerifiedSubject({ auth: { getClaims: async () => ({ data: { claims: {} }, error: null }) } }), null);
  await assert.rejects(() => boundary.requireVerifiedSubject({ auth: { getClaims: async () => ({ data: null, error: { message: 'unavailable' } }) } }));
  const responseBoundary = read('src/lib/api/route-boundary.ts');
  assert.match(responseBoundary, /headers\.set\("cache-control", "private, no-store"\)/);
  assert.match(responseBoundary, /catch \{\s*return apiJson\(\{ error: "operation_unavailable" \}, \{ status: 503 \}\);/);
});

test('correction API handlers validate request shapes and discriminate accepted rejection from operation failure', () => {
  const proposal = read('src/app/api/v1/games/[id]/corrections/route.ts');
  const review = read('src/app/api/v1/corrections/[id]/reviews/route.ts');
  const reconciliation = read('src/app/api/v1/corrections/[id]/reconciliation/route.ts');
  const contract = read('src/lib/api/correction.ts');
  for (const source of [proposal + read('src/lib/api/route-boundary.ts') + read('src/lib/api/verified-subject.ts'), review + read('src/lib/api/route-boundary.ts') + read('src/lib/api/verified-subject.ts')]) {
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
  assert.match(reconciliation + read('src/lib/api/route-boundary.ts') + read('src/lib/api/verified-subject.ts'), /getClaims/);
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
  assert.match(liveScore, /writePendingScoreSubmission/);
  assert.match(liveScore, /Retry This Same Entry/);
  assert.match(liveScore, /isDefinitiveScoreMutationFailure/);
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
  assert.match(policyRoute + read('src/lib/api/route-boundary.ts') + read('src/lib/api/verified-subject.ts'), /getClaims/);
  assert.match(policyRoute, /configure_correction_policy/);
  assert.match(policyRoute, /idempotencyKey/);
  assert.match(policyRoute, /requiredApprovals/);
  assert.match(policyRoute, /expectedPolicyVersion/);
  assert.match(reconciliationRoute, /get_correction_policy_operation_reconciliation/);
  assert.match(reconciliationRoute, /isPolicyReconciliationResult/);
  assert.match(reconciliationRoute, /item\.tournament_id === tournamentId/);
  assert.match(reconciliationRoute + read('src/lib/api/route-boundary.ts') + read('src/lib/api/verified-subject.ts'), /getClaims/);
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

test('roster promotion outcomes reject mixed and extra backend response fields', async () => {
  const roster = await import(pathToFileURL(path.join(root, 'src/lib/api/roster.ts')).href);
  const decisionId = '00000000-0000-4000-8000-000000000001';
  const accepted = { status: 'roster_entry_created', rosterEntryId: '00000000-0000-4000-8000-000000000002', sourceClaimId: '00000000-0000-4000-8000-000000000003', approvalDecisionId: decisionId, profileLinked: false, roleGranted: false, eventEnrolled: false, paymentRecorded: false, checkedIn: false, seatAssigned: false };
  assert.equal(roster.isAcceptedRosterPromotion(accepted, decisionId), true);
  assert.equal(roster.isAcceptedRosterPromotion({ ...accepted, code: 'not_director' }, decisionId), false);
  assert.equal(roster.isRejectedRosterPromotion({ status: 'rejected', code: 'not_director', approvalDecisionId: decisionId }, decisionId), true);
  assert.equal(roster.isRejectedRosterPromotion({ status: 'rejected', code: 'not_director', approvalDecisionId: decisionId, rosterEntryId: accepted.rosterEntryId }, decisionId), false);
});

test('approved registration claims promote only to an immutable private roster identity', () => {
  const sql = read('database/migrations/0036_registration_claim_roster_boundary.sql');
  const authorizationRepair = read('database/migrations/0038_roster_promotion_authorization_repair.sql');
  const workspaceRepair = read('database/migrations/0039_roster_workspace_reconciliation.sql');
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
  assert.match(workspaceRepair, /'promotionCandidates'/);
  assert.match(workspaceRepair, /d\.decision = 'approved_for_roster'/);
  assert.match(workspaceRepair, /and e\.id is null/);
  assert.match(workspaceRepair, /get_roster_promotion_operation_reconciliation/);
  assert.match(workspaceRepair, /o\.actor_profile_id = auth\.uid\(\)/);
  assert.match(workspaceRepair, /o\.target_id = p_approval_decision_id/);
  assert.match(workspaceRepair, /revoke all on function public\.get_roster_promotion_operation_reconciliation/);
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

test('protected roster interface uses only scoped RPCs and opaque retry storage', () => {
  const page = read('src/app/tournament/[tournamentId]/roster/page.tsx');
  const dal = read('src/lib/roster/workspace.ts');
  const client = read('src/app/tournament/[tournamentId]/roster/roster-client.tsx');
  const writer = read('src/app/api/v1/tournaments/[id]/roster-promotions/route.ts');
  const reconciliation = read('src/app/api/v1/tournaments/[id]/roster-promotions/reconciliation/route.ts');
  assert.match(page, /requireTournamentAccess/); assert.match(page, /director.*co_director/); assert.match(page, /SharedDeviceSignOut/);
  assert.match(dal, /server-only/); assert.match(dal, /get_tournament_roster_workspace/); assert.doesNotMatch(dal, /\.from\(/);
  for (const route of [writer, reconciliation]) { assert.match(route + read('src/lib/api/route-boundary.ts') + read('src/lib/api/verified-subject.ts'), /getClaims/); assert.doesNotMatch(route, /\.from\(|service_role/); }
  assert.match(writer, /create_roster_entry_from_registration_claim/); assert.match(reconciliation, /get_roster_promotion_operation_reconciliation/);
  assert.match(client, /registration-operation:roster:/); assert.match(client, /crypto\.randomUUID\(\)/); assert.match(client, /Enable session storage before continuing/);
  assert.match(client, /isAcceptedRosterPromotion/); assert.match(client, /isRejectedRosterPromotion/);
  assert.match(client, /setLocked\(envelope\); void promote\(envelope\)/); assert.match(client, /catch \{ return "unresolved"; \}/);
  assert.match(client, /response\.status === 409/); assert.match(client, /if \(busy\) return/);
  assert.match(read('src/lib/api/roster.ts'), /\["authentication_required", "not_director"/);
  assert.doesNotMatch(client, /sessionStorage[^\n]*(displayName|email|accNumber|intendedPaymentMethod)/);
});

test('manual roster payments are immutable director-only evidence, never enrollment or paid-in-full authority', async () => {
  const sql = read('database/migrations/0040_manual_roster_payment_ledger.sql');
  const indexes = read('database/migrations/0041_roster_payment_history_indexes.sql');
  const workspace = read('database/migrations/0042_roster_payment_workspace.sql');
  const reconciliation = read('database/migrations/0043_payment_operation_reconciliation_hardening.sql');
  const retiredReconciliation = read('database/migrations/0044_remove_legacy_payment_operation_reconciliation.sql');
  const identityReconciliation = read('database/migrations/0045_payment_operation_identity_reconciliation.sql');
  const identityAuthorization = read('database/migrations/0046_payment_operation_identity_recovery_authorization.sql');
  const paymentDal = read('src/lib/payments/workspace.ts');
  const paymentPage = read('src/app/tournament/[tournamentId]/payments/page.tsx');
  const paymentRecordRoute = read('src/app/api/v1/tournaments/[id]/payments/record/route.ts');
  const paymentVoidRoute = read('src/app/api/v1/tournaments/[id]/payments/void/route.ts');
  const paymentRecoveryRoute = read('src/app/api/v1/tournaments/[id]/payments/reconciliation/route.ts');
  const paymentClient = read('src/app/tournament/[tournamentId]/payments/payment-client.tsx');
  assert.match(sql, /create table app\.roster_payment_events/);
  assert.match(sql, /event_type text not null check \(event_type in \('received', 'voided'\)\)/);
  assert.match(sql, /amount_minor integer not null check \(amount_minor > 0\)/);
  assert.match(sql, /currency_code text not null check \(currency_code = 'USD'\)/);
  assert.match(sql, /receipt_note text/);
  assert.match(sql, /v_note := nullif\(trim\(p_note\), ''\)/);
  assert.match(sql, /payment_received_at,receipt_note,actor_profile_id/);
  assert.match(sql, /attempted_roster_entry_id uuid/);
  assert.doesNotMatch(sql, /roster_entry_id uuid references app\.tournament_roster_entries/);
  assert.match(sql, /roster_payment_events_immutable/);
  assert.match(sql, /revalidate_roster_payment_history/);
  assert.match(sql, /payment event versions must be contiguous/);
  assert.match(sql, /payment event types must alternate received and voided/);
  assert.match(sql, /payment void must reference the immediately preceding matching receipt/);
  assert.match(sql, /create or replace function public\.record_manual_roster_payment/);
  assert.match(sql, /create or replace function public\.void_manual_roster_payment/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /role in \('director', 'co_director'\)/);
  assert.match(sql, /p_expected_payment_version/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /idempotency conflict/);
  assert.match(sql, /current receipt must be voided before recording another/);
  assert.match(sql, /current payment receipt required/);
  assert.match(sql, /get_roster_payment_operation_reconciliation/);
  assert.match(sql, /revoke all on table app\.roster_payment_events from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.record_manual_roster_payment[\s\S]*authenticated/);
  assert.doesNotMatch(sql, /insert into (auth\.users|app\.(profiles|tournament_roles|event_participants))/);
  assert.doesNotMatch(sql, /table_seat|verification_id|check_in/i);
  assert.match(sql, /'paidInFull', false/);
  assert.match(sql, /'reconciled', false/);
  assert.match(indexes, /create index roster_payment_events_roster_entry_scope_idx/);
  assert.match(indexes, /on app\.roster_payment_events\(roster_entry_id, tournament_id\)/);
  assert.match(workspace, /create or replace function public\.get_roster_payment_workspace/);
  assert.match(workspace, /security definer set search_path = ''/);
  assert.match(workspace, /role in \('director', 'co_director'\)/);
  assert.match(workspace, /'displayName', r\.claimed_display_name/);
  assert.match(workspace, /'paymentState', coalesce\(current_event\.event_type, 'unrecorded'\)/);
  assert.match(workspace, /'currentReceiptEventId', case when current_event\.event_type = 'received'/);
  assert.match(workspace, /'history', coalesce\(history\.events/);
  assert.match(workspace, /where r\.tournament_id = p_tournament_id[\s\S]*?\), '\[\]'::jsonb\)/);
  assert.match(workspace, /revoke all on function public\.get_roster_payment_workspace\(uuid\) from public, anon/);
  assert.doesNotMatch(workspace, /claimed_email|claimed_acc_number|'paidInFull'|'reconciled'|'balance'/i);
  assert.match(reconciliation, /p_operation_type in \('record_manual_roster_payment', 'void_manual_roster_payment'\)/);
  assert.match(reconciliation, /o\.operation_type=p_operation_type and o\.request_hash=p_request_hash/);
  assert.match(reconciliation, /actor_profile_id=auth\.uid\(\)/);
  assert.match(retiredReconciliation, /revoke all on function public\.get_roster_payment_operation_reconciliation\(uuid,uuid,uuid\)/);
  assert.match(retiredReconciliation, /drop function public\.get_roster_payment_operation_reconciliation\(uuid,uuid,uuid\)/);
  assert.match(identityReconciliation, /get_roster_payment_operation_identity_reconciliation/);
  assert.match(identityReconciliation, /p_operation_type in \('record_manual_roster_payment', 'void_manual_roster_payment'\)/);
  assert.match(identityReconciliation, /o\.operation_type=p_operation_type limit 1/);
  assert.doesNotMatch(identityReconciliation, /p_request_hash/);
  assert.match(identityReconciliation, /revoke all on function public\.get_roster_payment_operation_identity_reconciliation\(uuid,uuid,text,uuid\)[\s\S]*from public, anon/);
  assert.match(identityAuthorization, /jsonb_build_object\('authorized', true, 'result'/);
  assert.match(paymentDal, /server-only/);
  assert.match(paymentDal, /get_roster_payment_workspace/);
  assert.doesNotMatch(paymentDal, /\.from\(/);
  assert.match(paymentPage, /dynamic = "force-dynamic"/);
  assert.match(paymentPage, /requireTournamentAccess/);
  assert.match(paymentPage, /director.*co_director/);
  assert.match(paymentPage, /getPaymentWorkspace/);
  assert.match(paymentPage, /does not mean paid in full, reconciled, checked in, seated, enrolled, or eligible/i);
  assert.match(paymentPage, /SharedDeviceSignOut/);
  assert.doesNotMatch(paymentPage, /entry\.(email|accNumber|balance|paidInFull|reconciled)/i);
  assert.match(paymentPage, /PaymentClient/);
  assert.match(paymentClient, /payment-operation:\$\{actorId\}:\$\{tournamentId\}/);
  assert.match(paymentClient, /clearOtherActors/); assert.match(paymentClient, /crypto\.randomUUID\(\)/); assert.match(paymentClient, /Enable session storage before continuing/);
  assert.match(paymentClient, /const state = await reconcile/); assert.match(paymentClient, /credentials: "same-origin"/); assert.match(paymentClient, /isRecordedPayment/); assert.match(paymentClient, /isVoidedPayment/);
  assert.match(paymentClient, /const inFlight = useRef\(false\)/); assert.match(paymentClient, /inFlight\.current = true/);
  assert.match(paymentClient, /dollarsToMinor/); assert.match(paymentClient, /isPaymentRecordRequest/); assert.match(paymentClient, /isPaymentVoidRequest/);
  assert.match(paymentClient, /response\.ok &&/); assert.match(paymentClient, /server rejected that payment action/i);
  assert.doesNotMatch(paymentClient, /Math\.round\(Number\(amount\) \* 100\)/);
  assert.doesNotMatch(paymentClient, /sessionStorage[^\n]*(amountMinor|paymentMethod|paymentReceivedAt|voidReason|note)/);
  assert.match(read('src/lib/client-session-storage.ts'), /"payment-operation:"/);
  for (const route of [paymentRecordRoute, paymentVoidRoute, paymentRecoveryRoute]) { assert.match(route, /isSameOriginRequest/); assert.match(route + read('src/lib/api/route-boundary.ts') + read('src/lib/api/verified-subject.ts'), /getClaims/); assert.doesNotMatch(route, /\.from\(|service_role/); }
  assert.match(paymentRecordRoute, /record_manual_roster_payment/); assert.match(paymentRecordRoute, /isPaymentRecordRequest/); assert.match(paymentRecordRoute, /isRecordedPayment/);
  assert.match(paymentVoidRoute, /void_manual_roster_payment/); assert.match(paymentVoidRoute, /isPaymentVoidRequest/); assert.match(paymentVoidRoute, /isVoidedPayment/);
  assert.match(paymentRecoveryRoute, /get_roster_payment_operation_identity_reconciliation/); assert.match(paymentRecoveryRoute, /isPaymentRecoveryRequest/); assert.match(paymentRecoveryRoute, /isRecoveredPayment/); assert.match(paymentRecoveryRoute, /authorized !== true/); assert.doesNotMatch(paymentRecoveryRoute, /amountMinor|paymentMethod|paymentReceivedAt|voidReason|note/);
  const payment = await import(pathToFileURL(path.join(root, 'src/lib/api/payment.ts')).href);
  const event = { paymentEventId: '00000000-0000-4000-8000-000000000001', version: 1, eventType: 'received', amountMinor: 2500, currencyCode: 'USD', paymentMethod: 'cash', paymentReceivedAt: '2026-09-09T10:00:00.000Z', paymentVoidedAt: null, receiptNote: null, voidReason: null, recorderDisplayName: 'Director', recordedAt: '2026-09-09T10:01:00.000Z' };
  const validPaymentWorkspace = { rosterEntries: [{ rosterEntryId: '00000000-0000-4000-8000-000000000002', displayName: 'Sample Player', paymentVersion: 1, paymentState: 'received', currentReceiptEventId: event.paymentEventId, history: [event] }] };
  assert.equal(payment.isPaymentWorkspace(validPaymentWorkspace), true);
  assert.equal(payment.isPaymentWorkspace({ rosterEntries: [{ ...validPaymentWorkspace.rosterEntries[0], paymentState: 'unrecorded' }] }), false);
  assert.equal(payment.isPaymentWorkspace({ rosterEntries: [{ ...validPaymentWorkspace.rosterEntries[0], currentReceiptEventId: '00000000-0000-4000-8000-000000000003' }] }), false);
  assert.equal(payment.isPaymentWorkspace({ rosterEntries: [{ ...validPaymentWorkspace.rosterEntries[0], paymentVersion: 2 }] }), false);
  assert.equal(payment.isPaymentWorkspace({ rosterEntries: [{ ...validPaymentWorkspace.rosterEntries[0], history: [{ ...event, paymentVoidedAt: '2026-09-09T10:02:00.000Z', voidReason: 'wrong amount' }] }] }), false);
  assert.equal(payment.isPaymentWorkspace({ rosterEntries: [{ ...validPaymentWorkspace.rosterEntries[0], paymentVersion: 0, paymentState: 'unrecorded', currentReceiptEventId: null, history: [event] }] }), false);
  const paymentRecord = { rosterEntryId: validPaymentWorkspace.rosterEntries[0].rosterEntryId, expectedPaymentVersion: 0, amountMinor: 2500, paymentMethod: 'cash', paymentReceivedAt: '2026-09-09T10:00:00.000Z', note: '', idempotencyKey: '00000000-0000-4000-8000-000000000010' };
  assert.equal(payment.isPaymentRecordRequest(paymentRecord), true); assert.equal(payment.isPaymentRecordRequest({ ...paymentRecord, amountMinor: 0 }), false); assert.equal(payment.isPaymentRecordRequest({ ...paymentRecord, amountMinor: 2147483648 }), false); assert.equal(payment.isPaymentRecordRequest({ ...paymentRecord, paymentReceivedAt: '2026-09-09' }), false); assert.equal(payment.isPaymentRecordRequest({ ...paymentRecord, note: 'x'.repeat(501) }), false);
  const paymentVoid = { rosterEntryId: paymentRecord.rosterEntryId, expectedPaymentVersion: 1, paymentEventId: event.paymentEventId, voidReason: 'Incorrect amount', idempotencyKey: '00000000-0000-4000-8000-000000000011' };
  assert.equal(payment.isPaymentVoidRequest(paymentVoid), true); assert.equal(payment.isPaymentVoidRequest({ ...paymentVoid, voidReason: '   ' }), false);
  const recordRecovery = { rosterEntryId: paymentRecord.rosterEntryId, operationType: 'record_manual_roster_payment', expectedPaymentVersion: 0, paymentEventId: null, idempotencyKey: paymentRecord.idempotencyKey };
  const voidRecovery = { rosterEntryId: paymentRecord.rosterEntryId, operationType: 'void_manual_roster_payment', expectedPaymentVersion: 1, paymentEventId: event.paymentEventId, idempotencyKey: paymentVoid.idempotencyKey };
  assert.equal(payment.isPaymentRecoveryRequest(recordRecovery), true); assert.equal(payment.isPaymentRecoveryRequest(voidRecovery), true); assert.equal(payment.isPaymentRecoveryRequest({ ...recordRecovery, operationType: 'wrong' }), false);
  assert.equal(payment.isRecordedPayment({ status: 'payment_recorded', paymentEventId: event.paymentEventId, rosterEntryId: paymentRecord.rosterEntryId, paymentVersion: 1, paymentState: 'received', paymentRecorded: true, paidInFull: false, reconciled: false }, paymentRecord), true);
  assert.equal(payment.isRecordedPayment({ status: 'payment_recorded', paymentEventId: event.paymentEventId, rosterEntryId: paymentRecord.rosterEntryId, paymentVersion: 1, paymentState: 'received', paymentRecorded: true, paidInFull: true, reconciled: false }, paymentRecord), false);
  assert.equal(payment.isRecordedPayment({ status: 'payment_recorded', paymentEventId: event.paymentEventId, voidedPaymentEventId: event.paymentEventId, rosterEntryId: paymentRecord.rosterEntryId, paymentVersion: 1, paymentState: 'received', paymentRecorded: true, paidInFull: false, reconciled: false }, paymentRecord), false);
  assert.equal(payment.isRecordedPayment({ status: 'payment_recorded', code: 'stale_payment_history', paymentEventId: event.paymentEventId, rosterEntryId: paymentRecord.rosterEntryId, paymentVersion: 1, paymentState: 'received', paymentRecorded: true, paidInFull: false, reconciled: false }, paymentRecord), false);
  assert.equal(payment.isVoidedPayment({ status: 'payment_voided', paymentEventId: '00000000-0000-4000-8000-000000000012', voidedPaymentEventId: event.paymentEventId, rosterEntryId: paymentRecord.rosterEntryId, paymentVersion: 2, paymentState: 'voided', paymentRecorded: false, paidInFull: false, reconciled: false }, paymentVoid), true);
  assert.equal(payment.isRecoveredPayment({ status: 'payment_recorded', paymentEventId: event.paymentEventId, rosterEntryId: paymentRecord.rosterEntryId, paymentVersion: 1, paymentState: 'received', paymentRecorded: true, paidInFull: false, reconciled: false }, recordRecovery), true);
  assert.equal(payment.isRecoveredPayment({ status: 'payment_voided', paymentEventId: '00000000-0000-4000-8000-000000000012', voidedPaymentEventId: event.paymentEventId, rosterEntryId: paymentRecord.rosterEntryId, paymentVersion: 2, paymentState: 'voided', paymentRecorded: false, paidInFull: false, reconciled: false }, { ...voidRecovery, expectedPaymentVersion: 0 }), false);
  assert.equal(payment.isRejectedPayment({ status: 'rejected', code: 'stale_payment_history', rosterEntryId: paymentRecord.rosterEntryId, paymentVersion: 1 }, paymentRecord.rosterEntryId), false);
});

test('check-in and initial seating are private, immutable, closed-registration operations, not rotation', () => {
  const sql = read('database/migrations/0047_check_in_and_initial_seating.sql');
  assert.match(sql, /create table app\.roster_check_in_events/);
  assert.match(sql, /version integer not null check \(version > 0\)/);
  assert.match(sql, /unique \(roster_entry_id, version\)/);
  assert.match(sql, /check_in_state text not null check \(check_in_state in \('checked_in', 'withdrawn', 'late', 'absent'\)\)/);
  assert.match(sql, /roster_check_in_events_immutable/);
  assert.match(sql, /create table app\.initial_seating_publications/);
  assert.match(sql, /tournament_id uuid not null unique/);
  assert.match(sql, /create table app\.initial_seating_assignments/);
  assert.match(sql, /verification_id text generated always as \(initial_table_seat\) stored/);
  assert.match(sql, /unique \(tournament_id, initial_table_seat\)/);
  assert.match(sql, /unique \(tournament_id, verification_id\)/);
  assert.match(sql, /initial_seating_assignments_immutable/);
  assert.match(sql, /attempted_operation_type text not null check \(attempted_operation_type in \('record_roster_check_in_event', 'publish_initial_seating'\)\)/);
  assert.match(sql, /attempted_target_id uuid/);
  for (const table of ['roster_check_in_events', 'initial_seating_publications', 'initial_seating_assignments', 'check_in_operation_conflicts']) {
    assert.match(sql, new RegExp(`alter table app\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`alter table app\\.${table} force row level security`));
    assert.match(sql, new RegExp(`revoke all on table app\\.${table} from public, anon, authenticated`));
  }
  assert.match(sql, /create or replace function public\.record_roster_check_in_event/);
  assert.match(sql, /create or replace function public\.publish_initial_seating/);
  assert.match(sql, /create or replace function public\.get_initial_seating_workspace/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /role in \('director', 'co_director'\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /registration must be closed/);
  assert.match(sql, /checked in roster required/);
  assert.match(sql, /duplicate seating assignment/);
  assert.match(sql, /initial seating already published/);
  assert.match(sql, /prevent_roster_entry_after_initial_seating/);
  assert.match(sql, /tournament_roster_entries_block_after_initial_seating/);
  assert.match(sql, /unassigned_check_in_after_seating/);
  assert.match(sql, /p_check_in_state = 'checked_in' and exists \([\s\S]*initial_seating_publications/);
  assert.match(sql, /return v_existing\.response_payload;[\s\S]*?if v_status not in \('draft', 'open'\)/);
  assert.match(sql, /return v_existing\.response_payload;[\s\S]*?if v_tournament_status <> 'open'/);
  assert.match(sql, /order by c\.version desc limit 1/);
  assert.match(sql, /roundRotationGenerated', false/);
  assert.doesNotMatch(sql, /insert into (auth\.users|app\.(profiles|tournament_roles|event_participants|canonical_games))/);
  assert.match(sql, /grant execute on function public\.record_roster_check_in_event[\s\S]*authenticated/);
  assert.match(sql, /grant execute on function public\.publish_initial_seating[\s\S]*authenticated/);
  assert.match(sql, /grant execute on function public\.get_initial_seating_workspace[\s\S]*authenticated/);
});

test('roster-account links are director-authorized, immutable, and do not grant scoring authority', () => {
  const sql = read('database/migrations/0048_roster_account_link_boundary.sql');
  assert.match(sql, /create table app\.roster_account_links/);
  assert.match(sql, /unique \(tournament_id, roster_entry_id\)/);
  assert.match(sql, /unique \(tournament_id, profile_id\)/);
  assert.match(sql, /roster_account_links_immutable/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /revoke all on table app\.roster_account_links from public, anon, authenticated/);
  assert.match(sql, /create or replace function public\.link_roster_entry_to_account/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /role in \('director','co_director'\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /if p_profile_id=v_actor then raise exception using errcode='P0001', message='independent linker required'/);
  assert.match(sql, /'independent_linker_required'/);
  assert.match(sql, /roster entry already linked/);
  assert.match(sql, /profile already linked/);
  assert.match(sql, /idempotency conflict/);
  assert.match(sql, /grant execute on function public\.link_roster_entry_to_account[\s\S]*authenticated/);
  assert.doesNotMatch(sql, /insert into (auth\.users|app\.(profiles|tournament_roles|event_participants|score_submissions|score_confirmations))/);
  assert.match(sql, /'eventEnrolled',false/);
  assert.match(sql, /'roleGranted',false/);
});

test('event enrollment requires linked checked-in identity and approved digital singles before seating', () => {
  const sql = read('database/migrations/0050_event_enrollment_idempotency_and_lifecycle_repair.sql');
  assert.match(sql, /create table app\.event_enrollment_operation_conflicts/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /event_enrollment_operation_conflicts_immutable/);
  assert.match(sql, /revoke all on table app\.event_enrollment_operation_conflicts from public, anon, authenticated/);
  assert.match(sql, /enroll_linked_roster_entry_in_event/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /role in \('director','co_director'\)/);
  assert.match(sql, /select status into v_status from app\.tournaments where id=p_tournament_id for update/);
  assert.match(sql, /for update of e/);
  assert.match(sql, /if v_status <> 'open'/);
  assert.match(sql, /if v_error='idempotency conflict' then[\s\S]*insert into app\.event_enrollment_operation_conflicts/);
  assert.match(sql, /if v_error='idempotency conflict' then\s*insert into app\.event_enrollment_operation_conflicts[\s\S]*?;\s*else\s*insert into app\.operation_receipts/);
  assert.match(sql, /enrollment closed after seating/);
  assert.match(sql, /event not approved for digital enrollment/);
  assert.match(sql, /linked roster identity required/);
  assert.match(sql, /checked in roster required/);
  assert.match(sql, /participant already enrolled/);
  assert.match(sql, /event_participant_enrollment_rejected/);
  assert.match(sql, /'enrollment_closed_after_seating'/);
  assert.match(sql, /order by c\.version desc limit 1/);
  assert.match(sql, /insert into app\.event_participants/);
  assert.doesNotMatch(sql, /insert into app\.(canonical_games|score_submissions|score_confirmations|tournament_roles)/);
});

test('tournament setup drafts are private immutable configuration, not operational events', () => {
  const sql = read('database/migrations/0051_tournament_setup_draft_boundary.sql');
  for (const table of [
    'tournament_setup_revisions',
    'tournament_setup_official_versions',
    'tournament_setup_event_versions',
    'tournament_setup_q_pool_versions',
    'tournament_setup_operation_conflicts',
  ]) {
    assert.match(sql, new RegExp(`create table app\\.${table}`));
    assert.match(sql, new RegExp(`alter table app\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`alter table app\\.${table} force row level security`));
    assert.match(sql, new RegExp(`revoke all on table app\\.${table} from public, anon, authenticated`));
  }
  assert.match(sql, /unique \(tournament_id, version\)/);
  assert.match(sql, /tournament_setup_event_versions_one_main_idx/);
  assert.match(sql, /tournament_setup_event_versions_one_consolation_idx/);
  assert.match(sql, /slot smallint not null check \(slot in \(1, 2\)\)/);
  assert.match(sql, /entry_fee_cents integer not null check \(entry_fee_cents between 0 and 100000000\)/);
  assert.match(sql, /q pools require main or consolation setup event/);
  assert.match(sql, /invalid setup official count/);
  assert.match(sql, /tournament_setup_revision_official_set_guard/);
  assert.match(sql, /assert_tournament_setup_official_set_for_revision/);
  assert.match(sql, /setup director must match tournament director/);
  assert.match(sql, /setup official role unavailable/);
  assert.match(sql, /operation_receipts_id_tournament_actor_key/);
  assert.match(sql, /foreign key \(operation_receipt_id, tournament_id, actor_profile_id\)/);
  assert.match(sql, /foreign key \(prior_receipt_id, tournament_id, actor_profile_id\)/);
  assert.match(sql, /muggins_status text not null check \(muggins_status in \('unset', 'in_effect', 'not_in_effect'\)\)/);
  assert.match(sql, /source_status = 'director_configured_unverified'/);
  assert.doesNotMatch(sql, /insert into app\.(events|ruleset_versions|event_participants|canonical_games|score_submissions|score_confirmations|roster_payment_events)/);
});

test('tournament setup writer is an authenticated, versioned, draft-only transaction boundary', () => {
  const sql = read('database/migrations/0052_tournament_setup_save_rpc.sql');
  assert.match(sql, /create or replace function public\.save_tournament_setup_version/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /from app\.tournaments where id = p_tournament_id for update/);
  assert.match(sql, /role in \('director', 'co_director'\)/);
  assert.match(sql, /select \* into v_existing from app\.operation_receipts/);
  assert.match(sql, /return v_existing\.response_payload/);
  assert.match(sql, /p_expected_version <> v_current_version/);
  assert.match(sql, /stale setup version/);
  assert.match(sql, /initial_seating_publications/);
  assert.match(sql, /app\.rounds/);
  assert.match(sql, /app\.canonical_games/);
  assert.match(sql, /ps\.state <> 'draft'/);
  assert.match(sql, /assert_setup_object_keys/);
  assert.match(sql, /parse_setup_timestamp/);
  assert.match(sql, /pg_catalog\.pg_timezone_names/);
  assert.match(sql, /qualification_note/);
  assert.match(sql, /jsonb_array_length\(v_event->'qPools'\) > 2/);
  assert.match(sql, /v_event_kind not in \('main','consolation'\)/);
  assert.match(sql, /tournament_setup_operation_conflicts/);
  assert.match(sql, /case when v_existing\.tournament_id=p_tournament_id then v_existing\.id else null end/);
  assert.match(sql, /'operationalEventsCreated',false/);
  assert.match(sql, /'accSubmissionCreated',false/);
  assert.match(sql, /insert into app\.tournament_setup_revisions/);
  assert.match(sql, /insert into app\.tournament_setup_official_versions/);
  assert.match(sql, /insert into app\.tournament_setup_event_versions/);
  assert.match(sql, /insert into app\.tournament_setup_q_pool_versions/);
  assert.match(sql, /insert into app\.audit_events/);
  assert.match(sql, /revoke all on function public\.save_tournament_setup_version.*from public, anon/);
  assert.match(sql, /grant execute on function public\.save_tournament_setup_version.*to authenticated/);
  assert.doesNotMatch(sql, /(?:insert into|update|delete from) app\.(events|ruleset_versions|event_participants|canonical_games|score_submissions|score_confirmations|roster_payment_events|initial_seating_)/);
});

test('tournament setup workspace read is director-scoped and exposes no operational tables', () => {
  const sql = read('database/migrations/0054_tournament_setup_reader_shape_repair.sql');
  assert.match(sql, /create or replace function public\.get_tournament_setup_workspace/);
  assert.match(sql, /stable security definer set search_path = ''/);
  assert.match(sql, /auth\.uid\(\) is not null/);
  assert.match(sql, /role in \('director', 'co_director'\)/);
  assert.match(sql, /order by r\.version desc/);
  assert.doesNotMatch(sql, /'revisionId', r\.id, 'version', r\.version, 'createdAt'/);
  assert.match(sql, /qualificationNote/);
  assert.match(sql, /revoke all on function public\.get_tournament_setup_workspace\(uuid\) from public, anon/);
  assert.match(sql, /grant execute on function public\.get_tournament_setup_workspace\(uuid\) to authenticated/);
  assert.doesNotMatch(sql, /app\.(events|ruleset_versions|event_participants|canonical_games|score_submissions|score_confirmations|roster_payment_events|initial_seating_)/);
  assert.doesNotMatch(sql, /(?:insert into|update|delete from)/);
});

test('tournament setup retry reconciliation is actor, tournament, and operation scoped', () => {
  const sql = read('database/migrations/0055_tournament_setup_operation_reconciliation.sql');
  assert.match(sql, /create or replace function public\.get_tournament_setup_operation_reconciliation/);
  assert.match(sql, /stable security definer set search_path = ''/);
  assert.match(sql, /auth\.uid\(\) is not null/);
  assert.match(sql, /role in \('director','co_director'\)/);
  assert.match(sql, /o\.actor_profile_id=auth\.uid\(\)/);
  assert.match(sql, /o\.tournament_id=p_tournament_id/);
  assert.match(sql, /o\.target_id=p_tournament_id/);
  assert.match(sql, /o\.client_operation_id=p_idempotency_key/);
  assert.match(sql, /o\.operation_type='save_tournament_setup_version'/);
  assert.match(sql, /'authorized', true, 'result'/);
  assert.match(sql, /revoke all on function public\.get_tournament_setup_operation_reconciliation\(uuid, uuid\) from public, anon/);
  assert.match(sql, /grant execute on function public\.get_tournament_setup_operation_reconciliation\(uuid, uuid\) to authenticated/);
  assert.doesNotMatch(sql, /(?:insert into|update|delete from)/);
});

test('tournament setup bootstrap exposes only current official choices to current officials', () => {
  const sql = read('database/migrations/0056_tournament_setup_official_choices.sql');
  assert.match(sql, /create or replace function public\.get_tournament_setup_official_choices/);
  assert.match(sql, /stable security definer set search_path = ''/);
  assert.match(sql, /caller\.profile_id=auth\.uid\(\)/);
  assert.match(sql, /caller\.role in \('director','co_director'\)/);
  assert.match(sql, /'directorProfileId', t\.director_profile_id/);
  assert.match(sql, /'coDirectorProfileIds'/);
  assert.match(sql, /revoke all on function public\.get_tournament_setup_official_choices\(uuid\) from public, anon/);
  assert.match(sql, /grant execute on function public\.get_tournament_setup_official_choices\(uuid\) to authenticated/);
  assert.doesNotMatch(sql, /(?:insert into|update|delete from)/);
});

test('setup routes are same-origin mutations and private, claim-checked RPC boundaries with no direct table access', () => {
  const save = read('src/app/api/v1/tournaments/[id]/setup/route.ts');
  const recovery = read('src/app/api/v1/tournaments/[id]/setup/reconciliation/route.ts');
  const validators = read('src/lib/api/setup.ts');
  const readDecision = read('src/lib/api/setup-read-decision.ts');
  for (const source of [save, recovery]) {
    assert.match(source, /isSameOriginRequest/); assert.match(source, /getClaims/); assert.match(source, /operation_unavailable/);
    assert.doesNotMatch(source, /\.from\(|\.insert\(|\.update\(|service_role/);
    assert.match(source, /cache-control.*private, no-store/);
  }
  assert.match(save, /save_tournament_setup_version/); assert.match(save, /isSetupSaveRequest/); assert.match(save, /isSavedSetup/);
  assert.match(save, /get_tournament_setup_workspace/); assert.match(save, /get_tournament_setup_official_choices/);
  assert.match(save, /isSetupWorkspace/); assert.match(save, /isSetupOfficialChoices/); assert.match(save, /Promise\.all/); assert.match(save, /decideSetupRead/);
  assert.match(validators, /director_configured_unverified/);
  assert.match(readDecision, /setup_unavailable/); assert.match(save, /operation_unavailable/); assert.match(save, /invalid_json.*privateNoStore/); assert.match(save, /privateNoStore/); assert.match(save, /catch/);
  assert.match(recovery, /get_tournament_setup_operation_reconciliation/); assert.match(recovery, /isSetupRecoveryRequest/); assert.match(recovery, /invalid_json.*privateNoStore/); assert.match(recovery, /catch/);
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
