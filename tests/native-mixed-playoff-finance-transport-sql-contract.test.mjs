import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const sql=fs.readFileSync('database/proposals/native-mixed-playoff-finance-transport-v1.sql','utf8');

test('closed RPC bridge installs seven fixed names atomically without granting access',()=>{
 const names=[...sql.matchAll(/\('(get_native_mixed_[a-z_]+_v1|execute_native_mixed_[a-z_]+_v1)',(?:true|false)\)/g)].map(m=>m[1]);
 assert.equal(names.length,7);assert.equal(new Set(names).size,7);
 assert.match(sql,/begin;[\s\S]*revoke all on function %s from public,anon,authenticated,service_role[\s\S]*commit;/);
 assert.doesNotMatch(sql,/\bgrant\b|create table|alter table|set role|set_config|request\.jwt\.claim/);
});
test('normal user subject is preserved; service and anonymous roles cannot dispatch',()=>{
 assert.match(sql,/auth\.role\(\)is distinct from'authenticated'then return null/);
 assert.match(sql,/return app\.%I\(%s\)/);
 assert.doesNotMatch(sql,/p_actor_id|p_session_id|service_key|impersonat/);
 assert.match(sql,/p_tournament_id uuid,p_event_id uuid/);
 assert.match(sql,/,p_operation_id uuid,p_request jsonb/);
});
test('per-action technical body bound does not create a batch or business limit',()=>{
 assert.match(sql,/octet_length\(convert_to\(p_request::text,'UTF8'\)\)>32768/);
 assert.doesNotMatch(sql,/pg_column_size/);
 assert.match(sql,/'request_too_large'/);
 assert.doesNotMatch(sql,/insert into|delete from|update app\.|select true/);
});
