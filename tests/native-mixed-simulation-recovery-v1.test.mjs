import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
const sql=await fs.readFile('database/proposals/native-mixed-simulation-operation-recovery-v1.sql','utf8');
const s=sql.replace(/\s+/g,' ').toLowerCase();
test('operation recovery is private, independently disabled and performs no mutation or entropy',()=>{
 assert.ok(s.includes("as $$select false$$"));assert.ok(s.includes('from public,anon,authenticated,service_role'));
 assert.ok(s.includes("set timezone='utc'"));assert.ok(s.includes("role='director'for key share nowait"));
 assert.doesNotMatch(s,/\b(insert into|update app\.|delete from|grant execute|create table|random_seating_candidate_v1\(|draw_native_mixed_simulation_v1\()\b/u);
 assert.doesNotMatch(s,/native_mixed_attendance_source_v1\(|native_mixed_simulation_lifecycle_v1\(/u,'historical recovery must not depend on current consent');
 assert.doesNotMatch(s,/native_mixed_simulation_publication_enabled_v1\(/u,'read recovery can be separately enabled with writes still off');
});
test('getter requires current access and exact owned action/request/hash/outcome before history is returned',()=>{
 for(const part of ["<>'service_role'",'where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid',
  'o.request_hash is distinct from app.native_mixed_simulation_hash_v1',"o.request_payload->>'operationid'is distinct from op::text",
  "r->>'action'is distinct from o.action","r->>'actorid'is distinct from actor::text","r->>'operationid'is distinct from op::text",
  "r->'request'is distinct from o.request_payload",'in share mode nowait','if bound is distinct from true'])assert.ok(s.includes(part),part);
 for(const action of ['plan','draw','review','publish'])assert.ok(s.includes(`app.native_mixed_simulation_${action}_request_valid_v1(o.request_payload)`));
});
test('each accepted action requires its independently bound typed row and actual effect identifiers',()=>{
 for(const name of ['plan','draw','review','publication'])assert.ok(s.includes(`app.native_mixed_simulation_${name}_bound_v1(`),name);
 for(const part of ["r->>'planid'=p.id::text","r->>'drawid'=d.id::text","r->'candidate'is not distinct from d.candidate",
  "r->>'reviewid'=v.id::text","r->>'contextid'=c.id::text","r->>'seatingpublicationid'=c.seating_publication_id::text",
  "r->>'schedulepublicationid'=c.schedule_publication_id::text"])assert.ok(s.includes(part),part);
});
test('terminal rejected draw remains recoverable but cannot authorize another draw',()=>{
 for(const part of ["r->>'status'='rejected'and o.action='draw'","in('bounded_search_exhausted','simulation_draw_failed')",
  "r->'entropyconsumed'='true'::jsonb","r->'retrywithnewoperationauthorized'='false'::jsonb",'jsonb_object_keys(r)',
  'not exists(select 1 from app.native_mixed_simulation_draws_v1 where tournament_id=tid and event_id=eid)'])assert.ok(s.includes(part),part);
});
test('accepted historical receipts have exact per-action key sets and false action authority',()=>{
 for(const part of ["if(select array_agg(k order by k)from jsonb_object_keys(r)k)is distinct from",
  "when'plan'then array[","when'draw'then array[","when'review'then array[","when'publish'then array[",
  "r->'normaldrawauthorized'='false'::jsonb","r->'normalstartauthorized'='false'::jsonb",
  "r->'publishauthorized'='false'::jsonb","r->'ordinaryattendanceused'='false'::jsonb"])assert.ok(s.includes(part),part);
});
test('derived nested and outer receipt views deny current authority without rewriting stored history',()=>{
 assert.ok(s.includes("r:=r||jsonb_build_object('historicalreceipt',true,'currentsourceverified',false)"));
 assert.ok(s.includes("'receipt',r,'historicalreceipt',true,'currentsourceverified',false"));
 assert.ok(s.includes("'kind','native-mixed-simulation-operation-v1'"));
});
