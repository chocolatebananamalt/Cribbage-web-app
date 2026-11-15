import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const sql=readFileSync('database/proposals/playoff-series-games-v1.sql','utf8');
const writer=sql.split('create or replace function app.submit_playoff_series_game_action_v1(')[1].split('end$$;')[0];
// Source inventory regressions only. These checks neither execute PostgreSQL nor
// establish identity/provider acceptance, concurrency, rollback or SQL/TS parity.
test('game protocol remains private and cannot write qualifying scores or regular finance',()=>{
 assert.match(sql,/UNEXECUTED PRIVATE SOURCE CANDIDATE/);assert.doesNotMatch(sql,/create(?: or replace)? function public\./i);
 assert.doesNotMatch(sql,/\bgrant\s+(execute|all|select|insert|update|delete)\b/i);
 assert.doesNotMatch(sql,/(insert into|update|delete from)\s+app\.(canonical_games|card_scorelines|roster_payment_events|.*settlement.*)\b/i);
 const revoke=sql.slice(sql.lastIndexOf('do $$declare n text;begin'));
 for(const m of sql.matchAll(/create(?: or replace)? function app\.(\w+)\(/g))assert.ok(revoke.includes(`app.${m[1]}(`),m[1]);
 assert.doesNotMatch(sql,/jsonb_object_length\(/);
});
test('unavailable or foreign-player commands cannot reserve a new operation journal',()=>{
 const insert=writer.indexOf('insert into app.playoff_series_game_operations_v1');
 assert.ok(insert>0);assert.ok(writer.indexOf('event_settings_operational_activation_enabled_v1')<insert);
 assert.ok(writer.indexOf('playoff_series_game_actor_valid_v1')<insert);
 assert.match(sql,/qualification_id uuid/);assert.match(sql,/slot integer/);
 assert.match(sql,/playoff_series_game_request_hash_v1\(a,p_tournament_id,p_event_id,p_qualification_id,p_slot,p_request\)/);
 assert.match(sql,/historicalReceipt',true,'currentSourceVerified',false/);
});
test('latest-own pins, two confirmations and terminal game evidence remain explicit',()=>{
 assert.match(sql,/priorSubmissionId/);assert.match(sql,/latest_own_submission_required/);
 assert.ok(writer.indexOf('latest_own_submission_required')<writer.indexOf('insert into app.playoff_series_games_v1'));
 assert.match(writer,/game_already_verified/);assert.match(writer,/game_sequence_closed/);
 assert.match(sql,/create constraint trigger playoff_series_results_game_evidence_v1/);
 assert.match(sql,/generate_series\(1,n\)/);assert.match(sql,/greatest\(a_wins,b_wins\)<>g\.wins_required/);
 assert.match(sql,/playoff_series_games_digest_v1\(g\.id\)/);
 assert.match(writer,/>=10000/);
});
