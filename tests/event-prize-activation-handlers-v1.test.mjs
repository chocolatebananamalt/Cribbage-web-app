import test from 'node:test';import assert from 'node:assert/strict';import {NextRequest} from 'next/server.js';
import {createEventPrizeActivationHandlersV1,eventPrizeActivationRoutesEnabledV1} from '../src/lib/api/event-prize-activation-handlers-v1.ts';
import {prizeSetupScenario,prizeSetupReceipt,prizeActivationFixture,prizeTestId as id} from './fixtures/setup-prize-replacement-v1.mjs';
import {buildPendingEventPrizeSetupV1} from '../src/lib/setup-event-prize-recovery-v1.ts';
async function model(options={}){
 const s=prizeSetupScenario(),pending=buildPendingEventPrizeSetupV1(s.actorId,s.workspace,s.request,s.links,s.settings,s.prizes,'all',id(7)),receipt=await prizeSetupReceipt(pending),f=await prizeActivationFixture(pending,receipt),calls={clients:0,auth:0,user:[],adminCreated:0,admin:[]};
 const flags={enabled:true,read:true,write:true,recovery:true,...options};let final=false;
 const client={auth:{getUser:async()=>{calls.auth++;return{data:{user:{id:options.switchAfter&&calls.auth>1?id(99):s.actorId}},error:null};}},rpc:async(name,args)=>{calls.user.push({name,args});if(name==='get_tournament_role')return{data:options.role??'director',error:null};if(name==='get_event_prize_activation_source_provider_v1')return{data:f.source,error:null};if(name==='prepare_event_prize_activation_provider_v1')return{data:f.record,error:null};if(name==='get_event_prize_activation_operation_provider_v1')return{data:options.noPreparation?null:final?f.finalized:f.record,error:null};return{data:null,error:null};}};
 const handlers=createEventPrizeActivationHandlersV1({enabled:()=>flags.enabled,readEnabled:()=>flags.read,writeEnabled:()=>flags.write,recoveryEnabled:()=>flags.recovery,client:async()=>{calls.clients++;return client;},admin:()=>{calls.adminCreated++;return{rpc:async(name,args)=>{calls.admin.push({name,args});final=true;return{data:options.badAdmin?{...f.finalized,actorId:id(99)}:f.finalized,error:options.adminError?{}:null};}};},sameOrigin:()=>options.origin!==false,readJson:async(_r,max)=>{assert.equal(max,1_000_000);return options.badBody?{}:f.envelope;},json:(v,init)=>Response.json(v,init),boundary:f=>f()});
 const request=(method='POST')=>new NextRequest(`https://test.invalid/api/v1/tournaments/${s.tournamentId}/event-prize-settings/activation`,{method,headers:{'x-expected-actor-id':s.actorId,origin:'https://test.invalid'}}),context={params:Promise.resolve({id:s.tournamentId})};
 return{s,f,calls,flags,handlers,request,context};
}
test('activation production flag is false and disabled modes do no identity or admin work',async()=>{
 assert.equal(eventPrizeActivationRoutesEnabledV1(),false);const m=await model({enabled:false});assert.equal((await m.handlers.finalizePOST(m.request(),m.context)).status,404);assert.equal(m.calls.clients,0);assert.equal(m.calls.adminCreated,0);
});
test('source and owned preparation use only cookie user RPCs, with separate read/recovery from writes',async()=>{
 const m=await model({write:false});assert.equal((await m.handlers.sourceGET(m.request('GET'),m.context)).status,200);assert.equal((await m.handlers.operationPOST(m.request(),m.context)).status,200);assert.equal((await m.handlers.preparePOST(m.request(),m.context)).status,404);assert.equal(m.calls.adminCreated,0);
});
test('finalization requires verified official identity, exact owned preparation and server-only actor',async()=>{
 const m=await model(),r=await m.handlers.finalizePOST(m.request(),m.context);assert.equal(r.status,200);assert.deepEqual(await r.json(),m.f.finalized);assert.equal(m.calls.adminCreated,1);assert.deepEqual(m.calls.admin,[{name:'finalize_event_prize_activation_provider_v1',args:{actor:m.s.actorId,tid:m.s.tournamentId,request_text:m.f.raw}}]);
 const replay=await m.handlers.finalizePOST(m.request(),m.context);assert.equal(replay.status,200);assert.equal(m.calls.adminCreated,1,'confirmed exact replay should not invoke admin again');
});
test('outsider, wrong origin, malformed body and absent preparation never construct admin access',async()=>{
 for(const options of[{role:'player',status:403},{origin:false,status:403},{badBody:true,status:400},{noPreparation:true,status:409}]){const m=await model(options);assert.equal((await m.handlers.finalizePOST(m.request(),m.context)).status,options.status);assert.equal(m.calls.adminCreated,0);}
});
test('session switch, malformed privileged reply or unknown commit cannot return success',async()=>{
 for(const options of[{switchAfter:true},{badAdmin:true},{adminError:true}]){const m=await model(options),r=await m.handlers.finalizePOST(m.request(),m.context);assert.notEqual(r.status,200);assert((await r.json()).error);}
});
