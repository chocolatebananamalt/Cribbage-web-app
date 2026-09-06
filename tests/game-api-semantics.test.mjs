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

test('pilot trigger correction migration hardens existing deferred functions', () => {
  const sql = read('database/migrations/0004_trigger_security_hardening.sql').toLowerCase();
  assert.match(sql, /alter function app\.revalidate_game\(uuid\) security definer/);
  assert.match(sql, /alter function app\.revalidate_game_from_submission\(\) set search_path = ''/);
  assert.match(sql, /revoke all on function app\.revalidate_game\(uuid\) from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant execute/);
});
