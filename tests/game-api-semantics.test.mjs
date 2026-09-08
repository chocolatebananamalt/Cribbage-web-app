import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
  const contextDal = read('src/lib/games/assigned-game-context.ts');
  const liveScore = read('src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx');
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
  assert.match(read('database/migrations/0003_game_submission_confirmation_rpc.sql'), /event is not approved for digital scoring/);
  assert.match(liveScore, /canConfirm/);
  assert.match(liveScore, /Playing with one paper card and one digital card/);
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
