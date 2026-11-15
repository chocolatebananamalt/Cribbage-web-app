import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withRandomSeatingFixture} from './fixtures/fictional-draw-atomic-local.mjs';
const uuid=n=>`f3710000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const lit=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
await withRandomSeatingFixture(async({fixture:f,q,read})=>{
 for(const file of ['reviewed-draw-native-publication-v1.sql','reviewed-draw-authenticated-wrapper-v1.sql','reviewed-seating-trial-scope-v1.sql','fictional-reviewed-draw-schedule-v1.sql']) q(fs.readFileSync(`database/proposals/${file}`,'utf8'));
 for(const role of ['anon','authenticated','service_role']) assert.throws(()=>q(`set role ${role};select public.admit_fictional_draw_v1('${f.actor}','${f.tid}','${f.eid}','nnhcnvksxgxnpvdqjgpg','${uuid(1)}',true);`),/permission denied/);
 // A disposable operator verifies THIS isolated fixture, then explicitly grants
 // the server boundary. No marker or grant is present in the candidate itself.
 q(`insert into app.fictional_draw_deployment_v1(project_ref,authorization_reference)values('nnhcnvksxgxnpvdqjgpg','LOCAL isolated fixture');select app.authorize_reviewed_seating_trial_deployment_v1('nnhcnvksxgxnpvdqjgpg','LOCAL isolated fixture');grant execute on function public.admit_fictional_draw_v1(uuid,uuid,uuid,text,uuid,boolean),public.publish_fictional_draw_schedule_v1(uuid,uuid,uuid,uuid,uuid,uuid,boolean,text) to service_role;`);
 const admit=(actor,project,op,confirmed='true')=>read(`set role service_role;select public.admit_fictional_draw_v1('${actor}','${f.tid}','${f.eid}','${project}','${op}',${confirmed});`);
 assert.equal(admit(f.actor,'fnjkwymxpnsqvxtpronk',uuid(2)),null);assert.equal(admit(f.uid(1),'nnhcnvksxgxnpvdqjgpg',uuid(3),'false'),null);
 const scope=admit(f.actor,'nnhcnvksxgxnpvdqjgpg',uuid(4));assert.equal(scope.status,'trial_scope_recorded');assert.deepEqual(admit(f.actor,'nnhcnvksxgxnpvdqjgpg',uuid(4)),scope);
 const config={tables:[{tableId:'A',seatCount:18}],activePairIds:Array.from({length:9},(_,i)=>`A:${i*2+1}-${i*2+2}`),anchor:{participantId:null,seatId:'A-1',directorApproved:true},stationaryRequests:[],stationaryDecisions:[],constraints:[],maxAttempts:128};
 const wk=read(`set role service_role;select public.get_trial_random_seating_workspace_v1('${f.actor}','${f.tid}');`);
 const plan=read(`set role service_role;select public.save_trial_random_seating_plan_v1('${f.actor}','${f.tid}',${lit({expectedSourceHash:wk.sourceHash,expectedRevision:0,config})},'${uuid(5)}');`);assert.equal(plan.status,'accepted');
 const draw=read(`set role service_role;select public.draw_trial_random_seating_candidate_v1('${f.actor}','${f.tid}',${lit({planId:plan.planId,expectedSourceHash:plan.sourceHash,expectedPriorDraw:null,reason:'initial-draw'})},'${uuid(6)}');`);assert.equal(draw.status,'accepted');
 const request={planId:plan.planId,drawActorId:draw.actorId,drawOperationId:draw.operationId,expectedSourceHash:plan.sourceHash,expectedPlanRevision:plan.revision,reviewedCandidate:draw.candidate,review:{physicalLayoutConfirmed:true,stationaryDecisionsConfirmed:true,constraintsConfirmed:true,reason:'LOCAL simulated physical review'},idempotencyKey:uuid(7)};
 const native=read(`select public.publish_reviewed_initial_seating_v1('${f.tid}',${lit(request)});`,f.actor,'authenticated');assert.equal(native.status,'initial_seating_published');
 const enrollment=read(`set role service_role;select public.enroll_roster_entries_in_event_v3('${f.actor}','${f.tid}','${f.eid}',${lit(Array.from({length:18},(_,i)=>f.rid(i+1)))},'${uuid(8)}');`);assert.equal(enrollment.status,'event_participants_enrolled');
 // The actual schedule writer requires event attendance; use its real desk flow.
 q(f.financeSql);
 const attendance=f.seatingAttendanceSql.slice(f.seatingAttendanceSql.indexOf('do $fixture$'));
 q('begin;'+attendance);
 const call=(actor,op,reviewOp=uuid(7))=>read(`set role service_role;select public.publish_fictional_draw_schedule_v1('${actor}','${f.tid}','${f.eid}','${f.actor}','${reviewOp}','${op}',true,'nnhcnvksxgxnpvdqjgpg');`);
 assert.equal(call(f.uid(1),uuid(9)),null);
 assert.equal(call(f.actor,uuid(10),uuid(999)),null);
 q(`create function app.local_fictional_bridge_fail() returns trigger language plpgsql as $$begin raise exception 'forced bridge failure';end$$;create trigger local_fail before insert on app.fictional_draw_schedule_bindings_v1 for each row execute function app.local_fictional_bridge_fail();`);
 assert.throws(()=>call(f.actor,uuid(11)),/forced bridge failure/);
 assert.equal(read(`select count(*) from app.event_schedule_publications where tournament_id='${f.tid}';`),0);
 assert.equal(read(`select count(*) from app.canonical_games where tournament_id='${f.tid}';`),0);
 q(`drop trigger local_fail on app.fictional_draw_schedule_bindings_v1;drop function app.local_fictional_bridge_fail();`);
 const published=call(f.actor,uuid(11));assert.equal(published.status,'event_schedule_published');assert.equal(published.matchCount,108);
 assert.deepEqual(call(f.actor,uuid(11)),published);
 assert.equal(call(f.actor,uuid(11),uuid(999)),null);
 assert.equal(read(`select count(*) from app.fictional_draw_schedule_bindings_v1 where tournament_id='${f.tid}';`),1);
 assert.equal(read(`select count(*) from app.canonical_games where tournament_id='${f.tid}';`),108);
 const workspace=read(`set role service_role;select public.get_event_schedule_workspace_v1('${f.actor}','${f.tid}');`);
 const event=workspace.events.find(e=>e.eventId===f.eid);
 const started=read(`set role service_role;select public.start_event_play_v1('${f.actor}','${f.tid}','${f.eid}','${published.publicationId}','${event.participantSnapshotDigest}',18,12,true,'${uuid(12)}');`);
 assert.equal(started.status,'event_started');
 // An explicitly expired historical fixture must not look like a live admission
 // when the exact operation is replayed. Do not mutate the immutable prior row.
 q(`insert into app.reviewed_seating_trial_scope_versions_v1(tournament_id,event_id,version,official_ids,writes_enabled,expires_at,reviewed_by,authorization_reference,operation_id,request) select tournament_id,event_id,version+1,official_ids,writes_enabled,clock_timestamp()-interval '1 second',reviewed_by,authorization_reference,'${uuid(13)}',request from app.reviewed_seating_trial_scope_versions_v1 where tournament_id='${f.tid}' order by version desc limit 1;`);
 assert.equal(read(`set role service_role;select public.admit_fictional_draw_v1('${f.actor}','${f.tid}','${f.eid}','nnhcnvksxgxnpvdqjgpg','${uuid(13)}',true);`),null);
 q(`insert into app.reviewed_seating_trial_scope_versions_v1(tournament_id,event_id,version,official_ids,writes_enabled,expires_at,reviewed_by,authorization_reference,operation_id,request) select tournament_id,event_id,version+1,array[]::uuid[],false,clock_timestamp()+interval '1 hour',reviewed_by,authorization_reference,'${uuid(14)}',request from app.reviewed_seating_trial_scope_versions_v1 where tournament_id='${f.tid}' order by version desc limit 1;`);
 assert.equal(admit(f.actor,'nnhcnvksxgxnpvdqjgpg',uuid(4)),null,'historical admission cannot report current success after revocation');
 console.log('PASS admission, committed draw, native publication, atomic schedule, replay and Start');
});



