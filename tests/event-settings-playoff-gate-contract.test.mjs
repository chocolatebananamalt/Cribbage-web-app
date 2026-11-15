import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const sql=readFileSync('database/proposals/event-settings-playoff-gate-v1.sql','utf8');
const activation=readFileSync('database/proposals/event-settings-activation-guard-v1.sql','utf8');
const body=name=>sql.split(`create function app.${name}(`)[1].split('end$$;')[0];
// Source contracts only; these tests never parse/execute SQL or prove runtime
// ACLs, lock upgrades, trigger ordering or accepted native activation.
test('private native playoff proposals cannot expose execution or replace older result guards',()=>{
 assert.match(sql,/UNEXECUTED PRIVATE PROPOSAL/);assert.doesNotMatch(sql,/\bgrant\s+(execute|all|select|insert|update|delete)\b/i);
 assert.doesNotMatch(sql,/drop\s+trigger|create\s+or\s+replace\s+function\s+public\./i);
 const revoke=sql.slice(sql.lastIndexOf('revoke all on function'));
 for(const m of sql.matchAll(/create function app\.(\w+)\(/g))assert.ok(revoke.includes(`app.${m[1]}(`),m[1]);
});
test('current native field and qualification evidence are bound rather than inferred from receipts or survivors',()=>{
 const source=body('event_settings_playoff_source_v1');
 assert.match(source,/p\.start_source<>'official'/);assert.match(source,/p\.participant_count<>s\.participant_count or q\.participant_count<>p\.participant_count/);
 assert.match(source,/q\.qualifier_count<>\(q\.participant_count\+3\)\/4/);assert.match(source,/qualification_resolution_snapshot_current_v1\(q\.id\)/);
 assert.match(source,/eventKind'='main'.*durationDays'.*integer=2 and p\.participant_count>=257/);
 assert.doesNotMatch(source,/entry_fee|amount_minor|paid_entry/);
});
test('native start and all four old result paths require current source-bound review/start evidence',()=>{
 for(const table of['standard_singles_playoff_result_versions','playoff_outcome_versions_v3','playoff_outcome_versions_v4','linked_main_series_v1'])assert.ok(sql.includes(`before insert on app.${table} for each row execute function app.require_event_settings_playoff_gate_v1()`));
 assert.match(sql,/before insert on app\.event_settings_playoff_starts_v1/);
 assert.match(body('require_event_settings_playoff_gate_v1'),/event_settings_playoff_start_required/);
 assert.match(body('require_event_settings_playoff_gate_v1'),/configured_series_game_evidence_required/);
 assert.match(sql,/create function app\.event_settings_game_result_recording_available_v1\(\)returns boolean\s+language sql immutable set search_path=''as \$\$select false\$\$/);
 assert.match(body('require_event_settings_playoff_start_v1'),/event_settings_playoff_review_required/);
 assert.match(activation,/to_regprocedure\('app\.event_settings_playoff_guard_available_v1\(\)'\)is null then return false/);
});
test('history replay precedes writable lifecycle checks; qualifying cross-check completion is not a playoff freeze',()=>{
 for(const name of['review_event_settings_playoffs_v1','start_event_settings_playoffs_v1']){const b=body(name);assert.ok(b.indexOf('return old.result')<b.indexOf('event_settings_playoff_lifecycle_open_v1'));}
 assert.doesNotMatch(sql,/cross_check_finalizations/);
 assert.match(sql,/from app\.q_accounting_finals_v6/);assert.match(sql,/from app\.tournaments where id=tid and status='open'/);
});
test('source reservations do not acquire SHARE on the review/start/operation output tables',()=>{
 const locks=body('lock_event_settings_playoff_sources_v1');
 for(const table of['event_settings_playoff_reviews_v1','event_settings_playoff_starts_v1','event_settings_playoff_operations_v1'])assert.ok(!locks.includes(`app.${table}`),`write-upgrade risk: ${table}`);
 assert.match(sql,/unique\(id,tournament_id,event_id\)/);
 assert.match(body('get_event_settings_playoff_operation_v1'),/actor_id=a and operation_id=op and tournament_id=tid and event_id=eid/);
});
