import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readEventPrizeWorkspaceV1,buildEventPrizeEnvelopeV1} from '../src/lib/api/event-prize-workspace-v1.ts';
import {createEventPrizeRpcV1} from '../src/lib/api/event-prize-rpc-v1.ts';
import {newPlayoffPrizePlanDraftV2} from '../src/lib/playoffs/playoff-prize-plan-v2.ts';
import {qSetupPrizeWorkspace} from './fixtures/q-setup-prize-workspace.mjs';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=id(1),tid=id(2),base={tournamentId:tid,setupRevisionId:id(3),setupVersion:6,sourceDigest:'a'.repeat(64)};
function legacy(){return{kind:'event-prize-workspace-v1',actorId:actor,tournamentId:tid,base:structuredClone(base),events:[],settings:{state:'absent',historyExists:false,snapshot:null,id:null,digest:null},prizes:{state:'absent',historyExists:false,snapshot:null},activationAllowed:false,accountingAllowed:false,moneyMoved:false};}
function current(){const w=legacy();w.settings={state:'present',historyExists:true,id:id(4),digest:'b'.repeat(64),snapshot:{kind:'event-settings-snapshot-v3',tournamentId:tid,setupRevisionId:base.setupRevisionId,setupVersion:6,settings:[]}};w.prizes={state:'present',historyExists:true,snapshot:{kind:'event-prize-settings-snapshot-v1',tournamentId:tid,setupRevisionId:base.setupRevisionId,setupVersion:6,settingsSnapshotId:id(4),settingsDigest:'b'.repeat(64),prizeSnapshotId:id(5),prizeDigest:'c'.repeat(64),plans:[],activationAllowed:false,accountingAllowed:false,moneyMoved:false}};return w;}
test('server-proved legacy absence is distinct from missing or contradictory history',()=>{
 const w=legacy(),before=JSON.stringify(w),v=readEventPrizeWorkspaceV1(w,actor,tid);assert(v);assert.equal(JSON.stringify(w),before);assert(Object.isFrozen(v.base));
 for(const change of[x=>x.settings.historyExists=true,x=>x.prizes.historyExists=true,x=>delete x.settings.historyExists,x=>x.settings.id=id(9),x=>x.base.setupVersion=0,x=>x.activationAllowed=true]){const bad=legacy();change(bad);assert.equal(readEventPrizeWorkspaceV1(bad,actor,tid),null);}
 assert.equal(readEventPrizeWorkspaceV1(w,id(8),tid),null);assert.equal(readEventPrizeWorkspaceV1(w,actor,id(8)),null);
});
test('current workspace pins prize history to exact settings and setup source',()=>{
 assert(readEventPrizeWorkspaceV1(current(),actor,tid));
 for(const change of[x=>x.prizes.snapshot.settingsDigest='d'.repeat(64),x=>x.prizes.snapshot.settingsSnapshotId=id(8),x=>x.prizes.snapshot.setupVersion=5,x=>x.settings.snapshot.setupRevisionId=id(8),x=>x.settings.state='absent',x=>x.prizes.historyExists=false,x=>x.base.setupVersion=-0]){const w=current();change(w);assert.equal(readEventPrizeWorkspaceV1(w,actor,tid),null);}
});
test('present history covers exactly every current Main and Consolation with the correct kind',()=>{
 const w=current(),row={eventClientRowId:id(30),eventKind:'main'};w.events=[row];w.settings.snapshot.settings=[{eventClientRowId:row.eventClientRowId,mode:'legacy_checks_required'}];w.prizes.snapshot.plans=[{...row,mode:'legacy_checks_required'}];assert(readEventPrizeWorkspaceV1(w,actor,tid));
 for(const change of[x=>x.prizes.snapshot.plans=[],x=>x.prizes.snapshot.plans[0].eventClientRowId=id(31),x=>x.prizes.snapshot.plans[0].eventKind='consolation',x=>x.settings.snapshot.settings=[],x=>x.events.push({...row}),x=>x.events[0].eventKind='satellite']){const bad=structuredClone(w);change(bad);assert.equal(readEventPrizeWorkspaceV1(bad,actor,tid),null);}
});
test('initial workspace has a null base; non-JSON and accessor input is rejected without access',()=>{
 const w=legacy();w.base={...base,setupRevisionId:null,setupVersion:0};assert(readEventPrizeWorkspaceV1(w,actor,tid));
 let calls=0;Object.defineProperty(w,'prizes',{get(){calls++;throw Error('must not invoke');},enumerable:true});assert.equal(readEventPrizeWorkspaceV1(w,actor,tid),null);assert.equal(calls,0);
});
test('complete authoring envelope takes exact server pins without changing old values',()=>{
 const w=legacy(),payload=structuredClone(qSetupPrizeWorkspace(actor).current);for(const k of['revisionId','version','createdAt'])delete payload[k];for(const e of payload.events){delete e.sourceStatus;e.qPools=[];e.sidePools=[];}
 const setup={kind:'event-settings-setup-v3',setup:{kind:'setup-custom-payouts-v2',base:structuredClone(base),request:{expectedVersion:6,idempotencyKey:id(7),payload},choices:payload.events.filter(e=>e.eventKind==='main').map(e=>({mainClientRowId:e.clientRowId,consolationClientRowIds:[]})),customPayouts:[]},eventSettings:payload.events.filter(e=>['main','consolation'].includes(e.eventKind)).map(e=>({eventClientRowId:e.clientRowId,mode:'preserve_historical'}))};
 const plans=setup.eventSettings.map(e=>({eventClientRowId:e.eventClientRowId,mode:'proposed_v2',draft:newPlayoffPrizePlanDraftV2()}));
 const before=JSON.stringify({w,setup,plans}),e=buildEventPrizeEnvelopeV1(w,setup,plans,id(8));assert(e);assert.deepEqual(e.prizeBase,{settingsSnapshotId:null,settingsDigest:null,prizeSnapshotId:null,prizeDigest:null});assert.equal(JSON.stringify({w,setup,plans}),before);
 assert.equal(buildEventPrizeEnvelopeV1(w,setup,[],id(8)),null);assert.equal(buildEventPrizeEnvelopeV1(w,setup,plans,id(7)),null);
 const stale=structuredClone(setup);stale.setup.base.sourceDigest='e'.repeat(64);assert.equal(buildEventPrizeEnvelopeV1(w,stale,plans,id(8)),null);
});
test('workspace transport is off by default and rechecks identity and capability after read',async()=>{
 for(const mode of['off','available','switch','disable','bad','error']){
  let enabled=true,authCalls=0,calls=0;
  const client={auth:{getUser:async()=>({data:{user:{id:mode==='switch'&&++authCalls>1?id(9):actor}},error:null})},rpc:async(name,args)=>{calls++;assert.equal(name,'get_event_prize_workspace_provider_v1');assert.deepEqual(args,{p_tid:tid});if(mode==='disable')enabled=false;return{data:mode==='bad'?{...legacy(),actorId:id(9)}:legacy(),error:mode==='error'?{}:null};}};
  const port=createEventPrizeRpcV1(client,{actorId:actor,tournamentId:tid},mode==='off'?{}:{read:()=>enabled});const reply=await port.workspace();assert.equal(reply.status,mode==='available'?'available':'unavailable');assert.equal(calls,mode==='off'?0:1);
 }
});
test('reader source requires current roles, coherent sources and proven absence and exposes no grants',()=>{
 const sql=fs.readFileSync('database/proposals/event-prize-workspace-source-v1.sql','utf8');assert.match(sql,/for share nowait/g);assert.match(sql,/historyExists',false/g);assert.match(sql,/exists\(select 1 from app\.event_prize_snapshots_v1/);assert.match(sql,/again is distinct from base/);assert.match(sql,/get_event_settings_workspace_v3/);assert.match(sql,/revoke all on function public\.get_event_prize_workspace_provider_v1/);assert.doesNotMatch(sql,/\bgrant\s+execute/i);
});
