import test from 'node:test';import assert from 'node:assert/strict';
import {createEventSettingsHandlersV3,isEventSettingsWorkspaceV3,readEventSettingsOperationRecordV3}from'../src/lib/api/event-settings-handlers-v3.ts';
import {newEventPlayoffParametersDraftV1}from'../src/lib/playoffs/event-playoff-parameters-v1.ts';
import {qSetupPrizeWorkspace}from'./fixtures/q-setup-prize-workspace.mjs';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,actor=id(1),tid=id(2),op=id(3);
const base={tournamentId:tid,setupRevisionId:id(4),setupVersion:1,sourceDigest:'a'.repeat(64)};
function envelope(){const payload=structuredClone(qSetupPrizeWorkspace(actor).current);for(const k of ['revisionId','version','createdAt'])delete payload[k];const event=payload.events[0];delete event.sourceStatus;event.qPools=[];event.sidePools=[];return{kind:'event-settings-setup-v3',setup:{kind:'setup-custom-payouts-v2',base:structuredClone(base),request:{expectedVersion:1,payload,idempotencyKey:op},choices:[{mainClientRowId:event.clientRowId,consolationClientRowIds:[]}],customPayouts:[]},eventSettings:[{eventClientRowId:event.clientRowId,mode:'configured',draft:newEventPlayoffParametersDraftV1('main')}]};}
function ack(e){const result={status:'setup_draft_saved',revisionId:id(5),version:2,eventCount:1};for(const k of ['operationalEventsCreated','rulesetApproved','seatingUpdated','financeUpdated','resultsUpdated','payoutsCalculated','qualifiersCalculated','accSubmissionCreated'])result[k]=false;return{status:'event_settings_draft_saved',fullRequestHash:'b'.repeat(64),envelope:structuredClone(e),settingsSnapshotId:id(6),linked:{status:'linked_setup_saved',result,links:{protocol:'setup-event-links-v1',setupRevisionId:id(5),setupVersion:2,choices:structuredClone(e.setup.choices),complete:true,associationHash:'c'.repeat(64)}},activationAllowed:false,moneyMoved:false};}
const request=(method='POST',query='',headers={})=>({method,url:'https://preview.test/settings'+query,headers:new Headers(headers)});
const context=(operationId)=>({params:Promise.resolve({id:tid,...(operationId?{operationId}:{})})});
function setup(overrides={}){
 const e=envelope(),calls=[],workspace={actorId:actor,tid,base:structuredClone(base),currentSnapshot:{kind:'event-settings-snapshot-v3',tournamentId:tid,setupRevisionId:base.setupRevisionId,setupVersion:1,settings:structuredClone(e.eventSettings)}};
 const d={enabled:()=>true,access:async()=>{calls.push('access');return{actorId:actor,roles:['director']};},workspace:async()=>{calls.push('workspace');return workspace;},save:async(_tid,body)=>{calls.push('save');return{data:ack(body),error:null};},operation:async()=>{calls.push('operation');return{data:{actorId:actor,tid,operationId:op,envelope:e,outcome:ack(e)},error:null};},readJson:async(_r,limits)=>{calls.push(['read',limits]);return e;},sameOrigin:()=>true,json:(body,init)=>({body,status:init?.status??200}),boundary:async f=>{try{return await f();}catch{return{status:503,body:{error:'operation_outcome_unknown'}};}},...overrides};return{e,d,calls,workspace,handlers:createEventSettingsHandlersV3(d)};
}
test('explicit gate defaults false and precedes access, body readers and backend construction',async()=>{
 for(const enabled of [undefined,()=>false]){const s=setup({enabled});assert.equal((await s.handlers.POST(request(),context())).status,404);assert.equal((await s.handlers.GET(request('GET'),context())).status,404);assert.equal((await s.handlers.operationGET(request('GET'),context(op))).status,404);assert.deepEqual(s.calls,[]);}
});
test('origin/method/identity/roles reject before data access; co-director permitted',async()=>{
 const origin=setup({sameOrigin:()=>false});assert.equal((await origin.handlers.POST(request(),context())).status,403);assert.deepEqual(origin.calls,[]);
 assert.equal((await setup().handlers.POST(request('GET'),context())).status,405);
 for(const access of [async()=>null,async()=>({actorId:actor,roles:['player']}),async()=>({actorId:actor.toUpperCase().replace('10000000','A0000000'),roles:['director']})]){const s=setup({access});assert.ok([401,403].includes((await s.handlers.POST(request(),context())).status));assert.ok(!s.calls.includes('save'));}
 assert.equal((await setup({access:async()=>({actorId:actor,roles:['co_director']})}).handlers.POST(request(),context())).status,200);
});
test('bounded body reader and exact V3 envelope reject malformed, oversized and cross-tournament input',async()=>{
 const large=setup();assert.equal((await large.handlers.POST(request('POST','',{'content-length':'1000001'}),context())).status,413);assert.ok(!large.calls.some(x=>Array.isArray(x)));
 const s=setup();assert.equal((await s.handlers.POST(request(),context())).status,200);assert.deepEqual(s.calls.find(x=>Array.isArray(x)),['read',{maxBytes:1000000}]);
 for(const body of [null,{kind:'setup-event-links-v1'},'x'.repeat(1000001),{...s.e,extra:true}]){const t=setup({readJson:async()=>body});assert.ok([400,413].includes((await t.handlers.POST(request(),context())).status));assert.ok(!t.calls.includes('save'));}
 const wrong=envelope();wrong.setup.base.tournamentId=id(99);assert.equal((await setup({readJson:async()=>wrong}).handlers.POST(request(),context())).status,400);
});
test('posted old base exact accepted replay is not freshness-prefiltered through workspace',async()=>{
 const s=setup({workspace:async()=>{throw Error('Must not read current source before replay');}});const out=await s.handlers.POST(request(),context());assert.equal(out.status,200);assert.deepEqual(out.body,ack(s.e));assert.ok(!s.calls.includes('workspace'));
});
test('role or actor changes before/after backend suppress any successful acknowledgement',async()=>{
 for(const changedAt of [2,3]){let n=0;const s=setup({access:async()=>++n<changedAt?{actorId:actor,roles:['director']}:{actorId:id(99),roles:['director']}});assert.equal((await s.handlers.POST(request(),context())).status,403);assert.equal(s.calls.includes('save'),changedAt===3);}
});
test('strict saved/rejected/retry outcomes; errors, extra fields and future codes remain unknown',async()=>{
 for(const data of [{status:'rejected',code:'stale_version'},{status:'retry_exact',code:'source_busy'}]){const s=setup({save:async()=>({data,error:null})});assert.equal((await s.handlers.POST(request(),context())).status,data.status==='rejected'?409:503);}
 for(const data of [null,{status:'rejected',code:'future_code'},{status:'retry_exact',code:'source_busy',paid:true},{status:'event_settings_draft_saved'}]){const s=setup({save:async()=>({data,error:null})});assert.deepEqual((await s.handlers.POST(request(),context())).body,{error:'operation_outcome_unknown'});}
 const e=envelope(),bad=ack(e);bad.envelope.eventSettings[0].draft.incrementFactorText='9';assert.equal((await setup({save:async()=>({data:bad,error:null})}).handlers.POST(request(),context())).status,503);
 assert.equal((await setup({save:async()=>({data:ack(e),error:Error('lost response')})}).handlers.POST(request(),context())).status,503);
});
test('workspace strict pins reject stale/cross-event snapshots and unknown fields',async()=>{
 const s=setup();assert.equal(isEventSettingsWorkspaceV3(s.workspace,actor,tid),true);assert.equal((await s.handlers.GET(request('GET'),context())).status,200);
 for(const change of [w=>w.actorId=id(99),w=>w.tid=id(99),w=>w.base.tournamentId=id(99),w=>w.currentSnapshot.setupVersion++,w=>w.currentSnapshot.setupRevisionId=id(99),w=>w.currentSnapshot=null,w=>w.extra=true]){const w=structuredClone(s.workspace);change(w);assert.equal((await setup({workspace:async()=>w}).handlers.GET(request('GET'),context())).status,503);}
 const initial={actorId:actor,tid,base:{...base,setupVersion:0,setupRevisionId:null},currentSnapshot:null};assert.equal(isEventSettingsWorkspaceV3(initial,actor,tid),true);
});
test('workspace role recheck blocks revoked session after read',async()=>{
 let n=0;const s=setup({access:async()=>({actorId:actor,roles:++n===1?['director']:['player']})});assert.equal((await s.handlers.GET(request('GET'),context())).status,403);
});
test('readonly operation GET uses server retained full request and pins actor/tournament/operation',async()=>{
 const s=setup();assert.equal((await s.handlers.operationGET(request('GET'),context(op))).status,200);assert.ok(s.calls.includes('operation'));assert.ok(!s.calls.includes('save'));assert.ok(!s.calls.some(x=>Array.isArray(x)));
 const query=setup();assert.equal((await query.handlers.operationGET(request('GET','?envelope=private'),context(op))).status,400);assert.ok(!query.calls.includes('operation'));
 for(const change of [row=>row.actorId=id(99),row=>row.tid=id(99),row=>row.operationId=id(99),row=>row.envelope.setup.request.idempotencyKey=id(99),row=>row.extra=true]){const row={actorId:actor,tid,operationId:op,envelope:envelope(),outcome:ack(envelope())};change(row);const t=setup({operation:async()=>({data:row,error:null})});assert.equal((await t.handlers.operationGET(request('GET'),context(op))).status,503);}
});
test('operation rejection and retry retain immutable full request; changed local bytes cannot authorize cleanup',async()=>{
 for(const outcome of [{status:'rejected',code:'stale_version'},{status:'retry_exact',code:'source_busy'}]){
  const e=envelope(),row={actorId:actor,tid,operationId:op,envelope:e,outcome},s=setup({operation:async()=>({data:row,error:null})}),reply=await s.handlers.operationGET(request('GET'),context(op));
  assert.deepEqual(reply.body,row);const decoded=readEventSettingsOperationRecordV3(reply.body,actor,tid,op,e);assert.ok(Object.isFrozen(decoded.envelope.eventSettings));
  const changed=structuredClone(e);changed.eventSettings[0].draft.incrementFactorText='9';assert.equal(readEventSettingsOperationRecordV3(reply.body,actor,tid,op,changed),null);
 }
});
