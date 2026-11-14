import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildReopenSQL} from './helpers/build-native-mixed-game-reopen-v1.mjs';
const sql=fs.readFileSync('database/proposals/native-mixed-game-reopen-v1.sql','utf8').replaceAll('\r\n','\n');
const fn=name=>{const m=sql.match(new RegExp(`create (?:or replace )?function (?:app|public)\\.${name}\\([\\s\\S]*?end\\$\\$;`));assert(m,name);return m[0];};
test('generated replacements bind exact reviewed original source pins',()=>{
 assert.equal(sql,buildReopenSQL());assert.equal([...sql.matchAll(/create or replace function/g)].length,10);
 assert.match(sql,/^begin;$/m);assert.match(sql,/\ncommit;\n$/);assert.doesNotMatch(sql,/\bgrant\s|\bupdate\s+app\.|\bdelete\s+from\s+app\.|\bdrop\s/im);
});
test('new tables immutable RLS/FORCE, every function explicitly closed and gate false',()=>{
 for(const n of ['native_mixed_game_reopens_v1','native_mixed_game_attempt_evidence_v1','native_mixed_game_attempt_artifacts_v1'])assert(sql.includes('create table app.'+n+'('));
 assert.match(sql,/force row level security/);assert.match(sql,/reject_immutable_history/);
 for(const m of sql.matchAll(/create (?:or replace )?function ((?:app|public)\.[a-z0-9_]+)\(/g))assert(sql.includes(`revoke all on function ${m[1]}(`),m[1]);
 assert.match(sql,/native_mixed_game_reopen_enabled_v1\(\)returns boolean\nlanguage sql immutable set search_path=''set timezone='UTC'as \$\$select false\$\$/);
 for(const decl of sql.split('-- BEGIN DERIVED FUNCTIONS:')[0].matchAll(/create function[\s\S]*?as \$\$/g))assert(decl[0].includes("set timezone='UTC'"));
});
test('live subject, JWT expiry, scoped pilot and nonplaying eligible official required',()=>{
 const s=fn('native_mixed_game_reopen_subject_v1');
 for(const v of ['native_mixed_game_own_subject_v1',"claims->>'sub'is distinct from actor::text","claims->>'exp'",'native_mixed_pilot_permitted_v1',"role in('director','co_director','cross_checker')",'paper_official_identity_is_current_valid','paper_official_is_independent','native_mixed_simulation_start_bound_v1'])assert(s.includes(v),v);
 assert(fn('record_native_mixed_game_reopen_v1').includes("official_role is distinct from'director'"));
});
test('policy1 proposals and independent decisions preserve exact policy and mandatory reason',()=>{
 const w=fn('record_native_mixed_game_reopen_v1');for(const token of['native_mixed_game_reopen_proposals_v1','native_mixed_game_reopen_reviews_v1',"q.actor_id=actor","to_jsonb(policy)is distinct from q.policy_capture","prior is distinct from q.prior_attempt_id","action_value<>'reject'and code_value is null then code_value:=app.native_mixed_game_reopen_block_v1","proposal_closed"])assert(w.includes(token),token);assert.match(w,/to_jsonb\(policy\)/);
 assert.match(fn('native_mixed_game_reopen_request_valid_v1'),/v->>'reason'=btrim/);assert.match(fn('native_mixed_game_reopen_request_valid_v1'),/length\(v->>'reason'\)between 1 and 500/);assert.match(fn('native_mixed_game_reopen_request_valid_v1'),/ascii\(ch\)>65535 then 2 else 1/);
 assert(fn('native_mixed_game_reopen_request_valid_v1').includes(String.raw`!~ U&'[\0001-\001F\007F]'`));assert.doesNotMatch(fn('native_mixed_game_reopen_request_valid_v1'),/\[:cntrl:\]/);
});
test('only incomplete genuine mismatch before any later affected-player evidence and downstream closures',()=>{
 const b=fn('native_mixed_game_reopen_block_v1');
 for(const v of ['game_already_complete','game_not_mismatched','later_evidence_exists','downstream_closed','native_mixed_game_all_evidence_v1()','qualification_result_versions','native_mixed_playoff_contexts_v1','native_mixed_main_finance_records_v1','native_mixed_pool_records_v1'])assert(b.includes(v),v);
 assert.match(b,/jsonb_array_length\(results\)<>2/);assert.match(b,/count\(distinct x\)/);assert.match(b,/rn.round_number>round_value/);
 const later=b.slice(b.indexOf('if exists(select 1 from app.canonical_games later'),b.indexOf("then return'later_evidence_exists'"));assert.doesNotMatch(later,/digital-submit|paper-capture/);
});
test('original row schema and legacy digest retained; attempts and artifact identity separate',()=>{
 assert.match(sql,/then jsonb_build_array\('native-mixed-game-history-v1',sid,gid,digest,h\)/);assert.match(sql,/native-mixed-game-attempt-history-v1',sid,gid,digest,attempt,h/);
 const w=fn('append_native_mixed_simulation_game_evidence_v1');assert.match(w,/insert into app.native_mixed_game_evidence_v1 select\(e\).\*/);assert.match(w,/insert into app.native_mixed_game_attempt_evidence_v1 select app.native_mixed_game_active_attempt_v1/);
 assert.match(w,/native_mixed_game_all_artifacts_v1\(\)where id=/);assert(w.indexOf("'code','operation_conflict'",w.indexOf('native-mixed-artifact:'))<w.indexOf('insert into app.operation_receipts'));
});
test('completion, state blindness, writes and pending closure use active evidence',()=>{
 for(const n of ['native_mixed_game_complete_with_start_v1','get_native_mixed_simulation_game_state_v1','append_native_mixed_simulation_game_evidence_v1','resolve_native_mixed_game_operation_v1']){const s=fn(n);assert.match(s,/native_mixed_game_active_evidence_v1\(sid,gid\)/);assert.doesNotMatch(s,/from app.native_mixed_game_evidence_v1/);}
 const s=fn('get_native_mixed_simulation_game_state_v1');assert.match(s,/native_mixed_game_active_evidence_v1\(sid,gid\) where start_id=sid and game_id=gid and actor_id=actor and entry->>'action'='digital-submit'/);assert.match(s,/native_mixed_game_active_evidence_v1\(sid,gid\) where start_id=sid and game_id=gid and entry->>'action'='paper-capture'/);
});
test('historical receipts use same-attempt history; supersession proves older attempt and own current blinded state',()=>{
 const b=fn('native_mixed_game_entry_bound_with_start_v1');assert.match(b,/native_mixed_game_all_evidence_v1/);assert.match(b,/native_mixed_game_entry_attempt_v1\(x.id\)is not distinct from/);
 const r=fn('get_native_mixed_simulation_game_operation_v1');for(const v of ['native-mixed-game-superseded-v1','old_version<active_version','native_mixed_game_reopen_bound_v1','get_native_mixed_simulation_game_state_v1',"state_value->>'actorId'=actor::text",'historicalReceipt','currentSourceVerified'])assert(r.includes(v),v);
 assert.match(r,/not exists\(select 1 from jsonb_array_elements\(state_value->'entries'\)x where x->>'id'=e.id::text\)/);assert.doesNotMatch(fn('append_native_mixed_simulation_game_evidence_v1'),/native-mixed-game-superseded-v1/);
});
test('qualification and its actual playoff clone use active results and attempt-pinned heads',()=>{
 for(const n of ['native_mixed_qualification_review_v1','native_mixed_playoff_review_v1']){const s=fn(n);assert.match(s,/join lateral app.native_mixed_game_active_evidence_v1/);assert.match(s,/native-mixed-game-attempt-qualification-head-v1/);assert.doesNotMatch(s,/from app.native_mixed_game_evidence_v1|join app.native_mixed_game_evidence_v1/);}
 assert.match(fn('native_mixed_playoff_review_v1'),/role_row.profile_id=start_row.actor_id/);
});
test('global nonce locks, exact replay and durable rejection receipt/audit retain pending safety',()=>{
 const w=fn('record_native_mixed_game_reopen_v1');for(const v of ["actor::text||':'||op::text","'native-mixed-simulation:'","'native-mixed-game:'",'idempotency_conflict','insert into app.operation_receipts','insert into app.audit_events','native_mixed_game_reopen_receipt_bound_v1'])assert(w.includes(v),v);
 const b=fn('native_mixed_game_reopen_receipt_bound_v1');assert.match(b,/outcome='rejected'/);for(const k of ['proposalId','revision','historyDigest'])assert(b.includes(`v->'${k}'='null'`));
 for(const v of ['source_changed','history_changed','game_not_mismatched','game_already_complete','later_evidence_exists','downstream_closed'])assert(b.includes(v),v);
 assert.match(fn('get_native_mixed_game_reopen_operation_v1'),/historicalReceipt',true,'currentSourceVerified',false/);
});

test('pending and declined never insert active attempts; one immutable terminal review and exact proofs',()=>{for(const table of['native_mixed_game_reopen_proposals_v1','native_mixed_game_reopen_reviews_v1'])assert(sql.includes("'"+table+"'"));assert(sql.includes('proposal_id uuid not null unique'));assert(sql.includes("check((request_payload->>'action'='propose'"));const w=fn('record_native_mixed_game_reopen_v1');assert(w.includes("if code_value is null and(action_value='approve'or(action_value='propose'and policy.required_approvals=0))then"));assert(w.indexOf('native_mixed_game_reopen_block_v1')<w.indexOf('insert into app.native_mixed_game_reopens_v1'));for(const code of['pending','declined'])assert(fn('native_mixed_game_reopen_receipt_bound_v1').includes("v->>'status'='"+code+"'"));assert(fn('native_mixed_game_reopen_bound_v1').includes('native_mixed_game_reopen_review_bound_v1'));});
