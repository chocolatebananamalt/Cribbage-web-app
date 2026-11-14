import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../database/proposals/event-prize-transaction-source-v1.sql',import.meta.url),'utf8');
const foundation=readFileSync(new URL('../database/proposals/event-prize-guard-source-v1.sql',import.meta.url),'utf8');
function body(name){const start=source.indexOf(`create function ${name}(`);assert.ok(start>=0,name);const begin=source.indexOf('as $$',start)+5,end=source.indexOf('$$;',begin);assert.ok(begin>4&&end>begin,name);return source.slice(begin,end);}
// These are source-contract regressions only. They DO NOT parse or execute SQL,
// prove ACLs, transaction boundaries, response parity or concurrent behavior.
test('locally tested candidate remains default-off and without exposed grants',()=>{
 assert.match(source,/LOCAL-TESTED, DEFAULT-OFF SOURCE CANDIDATE/);
 assert.match(body('app.event_prize_write_enabled_source_v1'),/select false/);
 assert.match(body('app.event_prize_recovery_enabled_source_v1'),/select false/);
 for(const sql of[source,foundation])assert.doesNotMatch(sql,/^\s*grant\s/im);
 const functions=[...source.matchAll(/create function ((?:app|public)\.[a-z0-9_]+)\(([^)]*)\)/g)];
 assert.ok(functions.length>=10);
 for(const [,name]of functions)assert.ok(source.includes(`'${name}(`),`${name} must be in owner/revoke registry`);
 assert.match(source,/revoke all on function %s from public,anon,authenticated,service_role/);
});
test('atomic writer binds raw bytes, locks both namespaces before tournament and replays before source',()=>{
 const s=body('app.save_event_prize_settings_source_v1');
 assert.match(s,/digest\(convert_to\(p_request_text,'utf8'\),'sha256'\)/);
 assert.ok(s.indexOf('unnest(array[op,inner_op])')<s.indexOf('from app.tournaments'));
 assert.ok(s.indexOf('select*into r from app.event_prize_reservations_v1')<s.indexOf('current_base:='));
 assert.match(s,/r\.request_text is distinct from p_request_text/);
 assert.match(s,/nested_operation_id in\(op,inner_op\)/);
 for(const table of['operation_receipts','event_settings_save_reservations_v3','setup_custom_q_save_reservations_v2','setup_event_link_save_reservations_v1','setup_custom_payout_batches_v2'])assert.ok(s.includes(`from app.${table}`),table);
});
test('fresh nested writes use V4 and raise on JSON rejection before durable outcome',()=>{
 const s=body('app.save_event_prize_settings_source_v1');
 assert.match(s,/begin\s+nested:=app\.save_event_settings_custom_pool_draft_v4/);
 assert.match(s,/status'is distinct from'event_settings_custom_pool_draft_saved_v4'/);
 assert.match(s,/raise exception'event_prize_rejected:nested_write_rejected'/);
 assert.ok(s.indexOf('exception when raise_exception then')<s.indexOf('insert into app.event_prize_outcomes_v1'));
 assert.match(s,/where tournament_id=p_tid and snapshot_id=prior_head/);
 assert.match(s,/Exception handler rolls back ALL statements/);
});
test('owned recovery reads exact prior operation under current role without writing or reading current head',()=>{
 const s=body('app.get_event_prize_operation_source_v1');
 assert.match(s,/event_prize_recovery_enabled_source_v1/);
 assert.match(s,/a uuid:=auth\.uid\(\)/);
 assert.match(s,/role in\('director','co_director'\).*for share nowait/);
 assert.match(s,/where actor_id=a and operation_id=op/);
 assert.match(s,/r\.request_text is distinct from p_request_text/);
 assert.doesNotMatch(s,/\b(insert into|update app\.|delete from|save_event|event_prize_heads_v1|get_custom_q_setup_base_v2)\b/i);
 assert.match(s,/event-prize-no-record-v1/);
});
test('reciprocal journal guard serializes actor keys and refuses outer or later-transaction key reuse',()=>{
 const s=body('app.guard_event_prize_operation_source_v1');
 assert.ok(s.indexOf('pg_try_advisory_xact_lock')<s.indexOf('select*into r'));
 assert.match(s,/operation_id=op or nested_operation_id=op/);
 assert.match(s,/r\.nested_operation_id is distinct from op/);
 assert.match(s,/r\.reserved_xid is distinct from txid_current\(\)/);
 assert.match(s,/inner_payload is distinct from r\.request_payload->'setup'/);
 assert.match(s,/outcome'='accepted'and j->>'operation_type'='save_tournament_setup_version'/);
 assert.match(s,/outcome'='rejected'and j->>'operation_type'in\('save_tournament_setup_version','save_linked_tournament_setup_v1','save_custom_q_setup_draft_v2','save_event_settings_draft_v3'\)/);
 assert.doesNotMatch(source,/set_config\(|current_setting\('app\./);
});
test('immutable snapshot evidence checks actual source bindings and reconstructed plans',()=>{
 const s=body('app.guard_event_prize_snapshot_source_v1');
 for(const text of['app.valid_event_prize_snapshot_source_v1','app.event_prize_plan_source_v1','s.document=r.prior_snapshot',"new.document->'plans'is distinct from expected","new.document->>'prizeDigest'is distinct from r.request_hash","new.document->>'settingsSnapshotId'=s.id::text","new.document->>'settingsDigest'=sr.request_hash","new.document->'setupVersion'=to_jsonb(rev.version)",'s.operation_id=r.nested_operation_id'])assert.ok(s.includes(text),text);
 assert.match(body('app.event_prize_plan_source_v1'),/prior is not null and not app\.valid_event_prize_snapshot_source_v1/);
 assert.match(body('app.valid_event_prize_snapshot_source_v1'),/jsonb_typeof\(v->k\)is distinct from'string'/);
 assert.match(body('app.valid_event_prize_draft_source_v1'),/jsonb_typeof\(v#>'\{rounding,regular\}'\)='string'/);
});
test('nested reservation query does not shadow the PL/pgSQL reservation record',()=>{
 const s=body('app.save_event_prize_settings_source_v1');assert.match(s,/join app\.event_settings_save_reservations_v3 nested_reservation on nested_reservation\.actor_id=s\.actor_id/);assert.doesNotMatch(s,/join app\.event_settings_save_reservations_v3 r on/);
});
