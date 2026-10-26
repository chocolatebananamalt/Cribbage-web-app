import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('./hybrid-digital-paper-minimum-officials.sql', import.meta.url), 'utf8');

test('minimum mixed fixture uses three authenticated identities and one dual-role official', () => {
  assert.equal((sql.match(/@test\.invalid/g) ?? []).length, 3);
  assert.doesNotMatch(sql, /minimum-codirector/i);
  assert.doesNotMatch(sql, /000000000003.*@test\.invalid/);
  assert.match(sql, /000000000002'[\s\S]*'cross_checker'/);
  assert.match(sql, /000000000002'[\s\S]*'co_director'/);
  assert.match(sql, /bind_paper_official_identity_v1\('a9490000-0000-4000-8000-000000000002'[\s\S]*'a9490000-0000-4000-8000-000000000001','nonparticipant'/);
  assert.match(sql, /Paper Player'[\s\S]*'paper'/);
  assert.match(sql, /000000000012'[\s\S]*null,'d9490000-0000-4000-8000-000000000002','A-2','checked_in'/);
});

test('binding requires the dual-role official to retain co-director authority', () => {
  const revoke = sql.indexOf("and role='co_director'");
  const denied = sql.indexOf("'binding_without_co_director'");
  const restore = sql.indexOf("000000000002','co_director');", denied);
  const bindDirector = sql.indexOf("000000000202');", restore);

  assert.ok(revoke >= 0 && revoke < denied);
  assert.ok(denied < restore && restore < bindDirector);
  assert.match(sql, /binding_without_co_director'[\s\S]*director_required/);
  assert.match(sql, /bind_paper_official_identity_v1\('a9490000-0000-4000-8000-000000000001'[\s\S]*'a9490000-0000-4000-8000-000000000002','nonparticipant'/);
  assert.match(sql, /bind_paper_official_identity_v1\('a9490000-0000-4000-8000-000000000002'[\s\S]*'a9490000-0000-4000-8000-000000000001','nonparticipant'/);
});

test('hybrid capture still requires the cross-checker role', () => {
  const revoke = sql.indexOf("and role='cross_checker'");
  const denied = sql.indexOf("'capture_without_cross_checker'");
  const restore = sql.indexOf("000000000002','cross_checker');", denied);
  const accepted = sql.indexOf("'created'", restore);

  assert.ok(revoke >= 0 && revoke < denied);
  assert.ok(denied < restore && restore < accepted);
  assert.match(sql, /capture_without_cross_checker'[\s\S]*not_cross_checker/);
});

test('accepted creation and independent review replay without duplicate durable rows', () => {
  assert.match(sql, /self_review'[\s\S]*not_eligible_reviewer/);
  assert.match(sql, /label='created'\)<>\(select result from hybrid_results where label='create_replay'/);
  assert.match(sql, /label='approved'\)<>\(select result from hybrid_results where label='approve_replay'/);
  assert.match(sql, /hybrid_game_cases where id='f949[\s\S]*\)<>1/);
  assert.match(sql, /hybrid_game_reviews where hybrid_case_id='f949[\s\S]*\)<>1/);
  assert.match(sql, /hybrid_game_state_events where hybrid_case_id='f949[\s\S]*\)<>2/);
  assert.match(sql, /client_operation_id='f9490000-0000-4000-8000-000000000301'\)<>1/);
  assert.match(sql, /client_operation_id='f9490000-0000-4000-8000-000000000312'\)<>1/);
});

test('approved mixed result writes the exact canonical scoreline totals', () => {
  assert.match(sql, /select state from app\.canonical_games[\s\S]*<>'verified'/);
  assert.match(sql, /select winner_side from app\.canonical_games[\s\S]*<>'a'/);
  assert.match(sql, /select margin from app\.canonical_games[\s\S]*<>31/);
  assert.match(sql, /sum\(game_points\)[\s\S]*<>3/);
  assert.match(sql, /sum\(plus_points\)[\s\S]*<>31/);
  assert.match(sql, /sum\(minus_points\)[\s\S]*<>31/);
  assert.match(sql, /is_winner and game_points=3 and plus_points=31 and minus_points=0/);
  assert.match(sql, /not is_winner and game_points=0 and plus_points=0 and minus_points=31/);
  assert.match(sql, /score_submissions where canonical_game_id='f949[\s\S]*\)<>1/);
  assert.match(sql, /score_confirmations where canonical_game_id='f949[\s\S]*\)<>0/);
});

test('fixture satisfies current play-start guards and always rolls back', () => {
  const start = sql.indexOf('insert into app.event_play_starts');
  const submission = sql.indexOf('insert into app.score_submissions');
  assert.ok(start >= 0 && start < submission);
  assert.match(sql, /app\.event_participant_snapshot_digest_v1/);
  assert.match(sql, /'legacy_scoring_backfill'/);
  assert.match(sql, /set constraints all immediate;\s*rollback;\s*$/);
});
