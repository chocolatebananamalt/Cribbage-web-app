import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const sql=readFileSync('database/proposals/playoff-series-matches-v1.sql','utf8');
const body=name=>sql.split(`create function app.${name}(`)[1].split('end$$;')[0];
// Source inventory only: SQL installation, native seed outputs, authorization,
// concurrency and actual advancement remain isolated-runtime acceptance gates.
test('new series storage stays private, immutable and separate from qualifying game totals',()=>{
 assert.match(sql,/UNEXECUTED PRIVATE SOURCE CANDIDATE/);assert.doesNotMatch(sql,/\bgrant\s+(execute|all|select|insert|update|delete)\b/i);
 assert.doesNotMatch(sql,/(insert into|update|delete from)\s+app\.(canonical_games|card_scorelines)\b/i);
 assert.doesNotMatch(sql,/delete from|update app\./i);
 const revoke=sql.slice(sql.lastIndexOf('revoke all on function'));for(const m of sql.matchAll(/create function app\.(\w+)\(/g))assert.ok(revoke.includes(`app.${m[1]}(`),m[1]);
 assert.match(sql,/foreign key\(prior_generation_id,match_id,tournament_id,event_id\)/);
 assert.match(sql,/foreign key\(generation_id,match_id,tournament_id,event_id\)/);
});
test('bounded ACC seed paths require verified parent completions and never assign bye game wins',()=>{
 const source=body('playoff_series_match_source_v1');
 assert.match(source,/q\.qualifier_count not in\(4,5\)/);
 assert.match(source,/x:=ids\[1\];y:=ids\[4\]/);assert.match(source,/x:=ids\[2\];y:=ids\[3\]/);
 assert.match(source,/x:=ids\[4\];y:=ids\[5\]/);assert.match(source,/x:=ids\[3\];y:=ids\[2\]/);
 assert.match(source,/parent_series_incomplete/);
 assert.match(body('playoff_series_current_result_v1'),/playoff_series_completed_result_valid_v1\(uuid\)/);
 assert.match(body('playoff_series_current_result_v1'),/if valid is distinct from true then return null/);
});
test('native digital identity and immutable source pins cannot be supplied by a posted actor or display name',()=>{
 const source=body('playoff_series_match_source_v1');
 assert.match(source,/r\.scorecard_type='digital'/);assert.match(source,/l\.profile_id=p\.profile_id/);
 assert.match(source,/pa is null or pb is null or pa=pb/);
 assert.match(source,/'rosterLinks',jsonb_build_array\(la,lb\)/);assert.match(source,/'preferences',jsonb_build_array\(prefa,prefb\)/);
 assert.match(source,/'parentResultPins',parents/);assert.match(source,/series_game_resource_bound/);
});
test('source changes cannot silently replace pending/completed work or a prior qualification bracket',()=>{
 const writer=body('create_playoff_series_generation_v1');
 assert.match(writer,/bracket_recovery_review_required/);assert.match(writer,/generation_recovery_review_required/);
 assert.match(writer,/playoff_series_game_actions_v1/);assert.match(writer,/old_generation\.qualification_id<>/);
 assert.ok(writer.indexOf('return old.result')<writer.indexOf('src:=app.playoff_series_match_source_v1'));
 assert.match(body('get_playoff_series_generation_operation_v1'),/actor_id=a and operation_id=op and tournament_id=tid and event_id=eid/);
});
