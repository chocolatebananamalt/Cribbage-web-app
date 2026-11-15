import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {withRandomSeatingFixture} from './fixtures/random-seating-local.mjs';
import {buildFacingGeometry} from '../src/lib/seating/local-random-plan.ts';
import {isDrawCandidate,isPlanReceipt} from '../src/lib/api/roster-random-draw.ts';
import {createRosterDrawHandlers} from '../src/lib/api/roster-random-draw-handlers.ts';
const uuid=n=>`a2991000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const lit=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const result=await withRandomSeatingFixture(async({fixture:f,q,read,startSession,containerId})=>{
 const call=(name,request,op,actor=f.actor)=>read(`set role service_role;select public.${name}('${actor}','${f.tid}',${lit(request)},'${op}');`,actor);
 const workspace=()=>read(`set role service_role;select public.get_random_seating_workspace_v1('${f.actor}','${f.tid}');`);
 const w=workspace();assert.equal(w.eligible,true);assert.equal(w.sourceSnapshot.roster.length,18);
 const tables=['A','B','C','D','E'].map(tableId=>({tableId,seatCount:5}));
 const config={tables,activePairIds:buildFacingGeometry(tables).pairs.slice(0,9).map(p=>p.pairId),anchor:{participantId:null,seatId:'B-2',directorApproved:true},stationaryRequests:[],stationaryDecisions:[],constraints:[],maxAttempts:128};
 const req={expectedSourceHash:w.sourceHash,expectedRevision:0,config};
 const plan=call('save_random_seating_plan_v1',req,uuid(1));assert.equal(plan.status,'accepted');assert(isPlanReceipt(plan,f.actor,f.tid));
 assert.deepEqual(call('save_random_seating_plan_v1',req,uuid(1)),plan);
 assert.equal(read(`select source_hash=app.random_seating_hash_v1(source_binding)and source_snapshot=source_binding->'projection'from app.random_seating_plans_v1 where id='${plan.planId}';`),true);
 assert.equal(call('save_random_seating_plan_v1',{...req,expectedRevision:1},uuid(1)).code,'idempotency_conflict');
 const drawReq={planId:plan.planId,expectedSourceHash:plan.sourceHash,expectedPriorDraw:null,reason:'initial-draw'};
 const missing=call('draw_random_seating_candidate_v1',{...drawReq,planId:uuid(999)},uuid(90));assert.equal(missing.code,'plan_unavailable');assert.equal(workspace().latestDraw,null);
 const draw=call('draw_random_seating_candidate_v1',drawReq,uuid(2));assert.equal(draw.status,'accepted');assert(isDrawCandidate(draw.candidate,config,plan.sourceSnapshot,plan.sourceHash));
 assert.equal(draw.candidate.anchor.selection,'blind-draw');assert.deepEqual(call('draw_random_seating_candidate_v1',drawReq,uuid(2)),draw);
 const operation=read(`set role service_role;select public.get_random_seating_operation_v1('${f.actor}','${f.tid}','${uuid(2)}');`);assert.deepEqual(operation.response,draw);assert.deepEqual(operation.request,drawReq);assert.equal(operation.phase,'draw');assert.equal(operation.actorId,f.actor);
 assert.equal(call('draw_random_seating_candidate_v1',drawReq,uuid(3)).code,'prior_draw_changed');
 const denied=call('draw_random_seating_candidate_v1',drawReq,uuid(3));assert.equal(denied.status,'rejected');const rejectedRecord=read(`set role service_role;select public.get_random_seating_operation_v1('${f.actor}','${f.tid}','${uuid(3)}');`);assert.deepEqual(rejectedRecord.request,drawReq);assert.deepEqual(rejectedRecord.response,denied);
 assert.equal(workspace().latestDraw.receipt.operationId,uuid(2));assert.equal(workspace().latestDraw.plan.planId,plan.planId);
 // New config revision preserves the tournament-wide prior-draw chain.
 config.anchor.participantId=f.rid(7);const p2=call('save_random_seating_plan_v1',{...req,config,expectedRevision:1},uuid(4));assert.equal(p2.status,'accepted');
 const redo={planId:p2.planId,expectedSourceHash:p2.sourceHash,expectedPriorDraw:uuid(2),reason:'changed-stationary-assumptions'};
 const pinned=call('draw_random_seating_candidate_v1',redo,uuid(5));assert.equal(pinned.status,'accepted');assert.equal(pinned.candidate.anchor.participantId,f.rid(7));assert(isDrawCandidate(pinned.candidate,config,p2.sourceSnapshot,p2.sourceHash));
 assert.equal(read(`select count(*)from app.initial_seating_publications where tournament_id='${f.tid}';`),0);
 assert.equal(read(`select count(*)from app.initial_seating_assignments where tournament_id='${f.tid}';`),0);
 assert.equal(read(`select count(*)from app.canonical_games where tournament_id='${f.tid}';`),0);
 // Actual service ACL; authenticated may neither call nor read private records.
 assert.throws(()=>q(`set role authenticated;select public.get_random_seating_workspace_v1('${f.actor}','${f.tid}');`),/permission denied/);
 assert.throws(()=>q('set role service_role;select * from app.random_seating_plans_v1;'),/permission denied/);
 assert.throws(()=>q('set role authenticated;select * from app.random_seating_draws_v1;'),/permission denied/);
 assert.throws(()=>q(`update app.random_seating_draws_v1 set reason='modified';`),/immutable/);
 assert.equal(read(`set role service_role;select public.get_random_seating_workspace_v1('${f.uid(1)}','${f.tid}');`,f.uid(1)),null);
 // Source drift is rejected, while the original exact receipt remains readable.
 q(`update app.tournaments set registration_status='open'where id='${f.tid}';`);
 const changed=read(`select public.record_roster_check_in_event_v2('${f.tid}','${f.rid(18)}','absent','LOCAL drift test','${uuid(6)}');`);assert.equal(changed.status,'check_in_recorded');q(`update app.tournaments set registration_status='closed'where id='${f.tid}';`);
 assert.equal(workspace().eligible,false);assert.notEqual(workspace().sourceHash,w.sourceHash);assert.equal(workspace().sourceSnapshot.roster.length,17);
 const stale={...redo,expectedPriorDraw:uuid(5),reason:'compare-another-draw'};assert.equal(call('draw_random_seating_candidate_v1',stale,uuid(7)).status,'rejected');assert.deepEqual(call('draw_random_seating_candidate_v1',redo,uuid(5)),pinned);
 // Actual two-session same-operation race: one committed draw, one exact replay.
 q(`update app.tournaments set registration_status='open'where id='${f.tid}';`);
 read(`select public.record_roster_check_in_event_v2('${f.tid}','${f.rid(18)}','checked_in','LOCAL restored test source','${uuid(8)}');`);
 q(`update app.tournaments set registration_status='closed'where id='${f.tid}';`);
 const w2=workspace();const p3=call('save_random_seating_plan_v1',{expectedSourceHash:w2.sourceHash,expectedRevision:2,config},uuid(9));assert.equal(p3.status,'accepted');
 const race={planId:p3.planId,expectedSourceHash:p3.sourceHash,expectedPriorDraw:uuid(5),reason:'changed-constraint-assumptions'},sql=`select public.draw_random_seating_candidate_v1('${f.actor}','${f.tid}',${lit(race)},'${uuid(10)}');`;
 const a=startSession('begin;'+sql+'select pg_sleep(0.5);commit;','random-draw-race-a'),b=startSession(sql,'random-draw-race-b');const outs=await Promise.all([a.done,b.done]);
 const parsed=outs.map(s=>JSON.parse(s.split('\n').find(l=>l.startsWith('{'))));assert.deepEqual(parsed[0],parsed[1]);assert.equal(parsed[0].status,'accepted');
 assert.equal(read(`select count(*)from app.random_seating_draws_v1 where operation_id='${uuid(10)}';`),1);
 // Privilege revocation while a request waits on the canonical tournament lock.
 const roleBlock=startSession(`begin;select 1 from app.tournaments where id='${f.tid}'for update;select 'role-lock-held';select pg_sleep(1);delete from app.tournament_roles where tournament_id='${f.tid}'and profile_id='${f.actor}'and role='director';commit;`,'random-role-block','postgres');
 for(let n=0;n<100&&!roleBlock.out().includes('role-lock-held');n++)await new Promise(r=>setTimeout(r,10));assert(roleBlock.out().includes('role-lock-held'));
 const waiting=startSession(`select public.draw_random_seating_candidate_v1('${f.actor}','${f.tid}',${lit({...race,expectedPriorDraw:uuid(10)})},'${uuid(11)}');`,'random-role-wait');await Promise.all([roleBlock.done,waiting.done]);
 assert.equal(read(`select count(*)from app.random_seating_operations_v1 where operation_id='${uuid(11)}';`),0);
 assert.equal(read(`set role service_role;select public.get_random_seating_operation_v1('${f.actor}','${f.tid}','${uuid(10)}');`),null);
 q(`insert into app.tournament_roles(tournament_id,profile_id,role)values('${f.tid}','${f.actor}','director');`);
 const names=new Set(['get_random_seating_workspace_v1','get_random_seating_operation_v1','get_random_seating_plan_v1','save_random_seating_plan_v1','draw_random_seating_candidate_v1']);
 const rpc=async(name,args)=>{try{assert(names.has(name));assert.equal(args.p_actor_id,f.actor);assert.equal(args.p_tournament_id,f.tid);const values=Object.entries(args).map(([k,v])=>{assert(/^p_[a-z_]+$/.test(k));if(k==='p_request')return `${k}=>${lit(v)}`;assert(/^[a-f0-9-]{36}$/.test(v));return `${k}=>'${v}'::uuid`;}).join(',');return{data:read(`set role service_role;select public.${name}(${values});`),error:null};}catch(error){return{data:null,error:{message:error.message}};}};
 const handlers=createRosterDrawHandlers({env:{NODE_ENV:'test',CRIBBAGE_LOCAL_ROSTER_DRAW:'1',CRIBBAGE_LOCAL_ROSTER_BACKEND_PORT:'54321',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321'},identity:async()=>f.actor,rpc,readJson:r=>r.json(),sameOrigin:()=>true,json:(body,init)=>({body,status:init?.status??200}),boundary:run=>run()});
 const ctx={params:Promise.resolve({id:f.tid})},url='http://127.0.0.1:3335/api/local',httpPost=body=>new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const viaWorkspace=await handlers.workspaceGET(new Request(url),ctx);assert.equal(viaWorkspace.status,200);
 const body={phase:'plan',operationId:uuid(20),request:{expectedSourceHash:viaWorkspace.body.sourceHash,expectedRevision:3,config}};
 const viaPlan=await handlers.POST(httpPost(body),ctx);assert.equal(viaPlan.status,200);
 const c={kind:'avoid-pair-in-round',participantIds:[f.rid(1),f.rid(2)],round:1,verified:true,sourceReference:'LOCAL-PLAN-VERIFIED'};
 const badConfigs=[{...config,constraints:[c,{...c,participantIds:[f.rid(2),f.rid(1)]}]},{...config,constraints:Array.from({length:17},(_,i)=>({...c,participantIds:[f.rid(1),f.rid(i+2)]}))}];
 for(const[index,badConfig]of badConfigs.entries()){
 const rejectedBody={phase:'plan',operationId:uuid(30+index),request:{expectedSourceHash:viaWorkspace.body.sourceHash,expectedRevision:4,config:badConfig}};
 const known=await handlers.POST(httpPost(rejectedBody),ctx);
 if(index===0){assert.equal(known.status,400);const native=call('save_random_seating_plan_v1',rejectedBody.request,rejectedBody.operationId);assert.equal(native.code,'duplicate_pair_round_constraint');}
 else{assert.equal(known.status,409);assert.equal(known.body.code,'no_permitted_opponent');const recovered=await handlers.operationGET(new Request(url),{params:Promise.resolve({id:f.tid,operationId:rejectedBody.operationId})});assert.equal(recovered.status,200);assert.deepEqual(recovered.body.request,rejectedBody);}
 assert.equal(read(`select count(*)from app.random_seating_plans_v1 where operation_id='${rejectedBody.operationId}';`),0);
 }
 const viaDrawBody={phase:'draw',operationId:uuid(21),request:{planId:viaPlan.body.planId,expectedSourceHash:viaPlan.body.sourceHash,expectedPriorDraw:uuid(10),reason:'changed-room-layout'}};
 const viaDraw=await handlers.POST(httpPost(viaDrawBody),ctx);assert.equal(viaDraw.status,200);
 const viaRead=await handlers.operationGET(new Request(url),{params:Promise.resolve({id:f.tid,operationId:uuid(21)})});assert.equal(viaRead.status,200);assert.deepEqual(viaRead.body.receipt,viaDraw.body);
 assert.equal((await handlers.workspaceGET(new Request(url),ctx)).status,200);
 // Explicit isolated fault injection: failed entropy work is a durable refusal,
 // and exact retry does not re-enter the generator (sequence is nontransactional).
 q(`create sequence app.local_draw_fault_counter;create or replace function app.random_seating_candidate_v1(p_config jsonb,p_snapshot jsonb)returns jsonb language plpgsql volatile set search_path=''as $$begin perform nextval('app.local_draw_fault_counter');raise exception 'LOCAL injected entropy failure';end$$;`);
 const failure={...viaDrawBody.request,expectedPriorDraw:uuid(21),reason:'compare-another-draw'};
 assert.equal(call('draw_random_seating_candidate_v1',failure,uuid(22)).code,'draw_failed');assert.equal(call('draw_random_seating_candidate_v1',failure,uuid(22)).code,'draw_failed');assert.equal(read('select last_value from app.local_draw_fault_counter;'),1);
 return {passed:true,checks:['closed checked-in UUID roster/config/source snapshot binding','DB cryptographic blind and approved-person draws;108 unique pairs/12 opponents verified independently','exact receipt/replay/readback;reasoned tournament-wide redraw chain','private ACL/immutable records/current Director enforcement','source drift rejection plus historical exact replay','actual two-session same-operation serialization;one committed candidate','actual role revocation while waiting rejects without reservation/private payload','same handler factory workspace/plan/draw/readback against actual isolated SQL','unknown-plan refusal does not consume invisible prior;injected generator failure persists/no retry entropy','zero initial IDs, published schedules, scores or financial writes'],containerId,proposalSha256:createHash('sha256').update(fs.readFileSync('database/proposals/random-seating-draw-v1.sql')).digest('hex'),scope:'LOCAL disposable database only; fixture identity boundary, not Supabase-provider authentication; candidate logical schedule, physical movement not certified'};
});
fs.writeFileSync('test-results/random-seating-local.json',JSON.stringify(result,null,2));console.log('PASS',JSON.stringify(result));
