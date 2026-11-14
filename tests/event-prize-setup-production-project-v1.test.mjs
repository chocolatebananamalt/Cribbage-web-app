import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{NextRequest}from'next/server.js';
import{eventPrizeSetupProductionProjectEnabledV1 as production,eventPrizeSetupProductionProjectUrlV1 as prod}from'../src/lib/api/event-prize-setup-production-project-v1.ts';
import{eventPrizeSetupTestProjectEnabledV1 as testGate,eventPrizeSetupTestProjectUrlV1 as stage}from'../src/lib/api/event-prize-setup-test-project-v1.ts';
import{eventPrizeSetupEnabledV1 as admitted,eventPrizeSetupAdmittedProjectUrlV1 as project}from'../src/lib/api/event-prize-setup-admission-v1.ts';
import{createEventPrizeProviderV1}from'../src/lib/api/event-prize-provider-handlers-v1.ts';import{createEventPrizeActivationHandlersV1}from'../src/lib/api/event-prize-activation-handlers-v1.ts';
import{prizeSetupScenario,prizeSetupReceipt,prizeActivationFixture,prizeTestId as id}from'./fixtures/setup-prize-replacement-v1.mjs';import{buildPendingEventPrizeSetupV1}from'../src/lib/setup-event-prize-recovery-v1.ts';
const env=(url,p,t)=>({NEXT_PUBLIC_SUPABASE_URL:url,EVENT_PRIZE_SETUP_PRODUCTION_ENABLED_V1:p,EVENT_PRIZE_SETUP_TEST_PROJECT_ENABLED_V1:t});
test('production Setup requires the exact server flag and exact authorized URL',()=>{
 assert.equal(production({}),false);assert.equal(prod,'https://fnjkwymxpnsqvxtpronk.supabase.co');assert.equal(production(env(prod,'true')),true);
 for(const p of[undefined,'false','1','TRUE',' true','true '])assert.equal(production(env(prod,p)),false);
 for(const url of[undefined,'',stage,'https://other.supabase.co',prod+'/',prod+'?x=1',prod+'/path',prod+':443',prod.replace('https:','http:'),prod.replace('https://','https://user@'),prod.replace('.co','.co.attacker.invalid'),' '+prod])assert.equal(production(env(url,'true')),false,String(url));
 assert.equal(production(Object.defineProperty({},'EVENT_PRIZE_SETUP_PRODUCTION_ENABLED_V1',{get(){throw Error('unavailable')}})),false);
});
test('flag matrix preserves the independent exact test admission and cannot cross-enable projects',()=>{
 for(const url of[prod,stage,'https://other.supabase.co'])for(const p of[undefined,'false','true'])for(const t of[undefined,'false','true']){const e=env(url,p,t),expected=url===prod&&p==='true'||url===stage&&t==='true';assert.equal(admitted(e),expected);assert.equal(project(e),expected?url:null);assert.equal(testGate(e),url===stage&&t==='true');assert.equal(production(e),url===prod&&p==='true');}
});
async function model(e,options={}){
 const s=prizeSetupScenario(),pending=buildPendingEventPrizeSetupV1(s.actorId,s.workspace,s.request,s.links,s.settings,s.prizes,'all',id(7)),f=await prizeActivationFixture(pending,await prizeSetupReceipt(pending));
 const calls={client:0,auth:0,admin:0,rpc:[],privileged:[]};let finalized=false;const enabled=()=>admitted(e),client=async()=>{calls.client++;return{auth:{getUser:async()=>{calls.auth++;return{data:{user:options.noUser?null:{id:options.wrongActor?id(99):s.actorId}},error:null}}},rpc:async(name,args)=>{calls.rpc.push({name,args});if(name==='get_tournament_role')return{data:options.role??'director',error:null};if(name==='get_event_prize_workspace_provider_v1')return{data:s.workspace,error:null};if(name==='get_event_prize_activation_source_provider_v1')return{data:f.source,error:null};if(name==='get_event_prize_activation_operation_provider_v1')return{data:finalized?f.finalized:options.noPreparation?null:f.record,error:null};return{data:null,error:null};}};};
 const ports={enabled,readEnabled:enabled,writeEnabled:enabled,recoveryEnabled:enabled,client,sameOrigin:()=>options.origin!==false,readJson:async()=>f.envelope,json:(v,i)=>Response.json(v,i),boundary:f=>f()};
 const save=createEventPrizeProviderV1(ports),activation=createEventPrizeActivationHandlersV1({...ports,admin:()=>{assert(enabled());calls.admin++;return{rpc:async(name,args)=>{calls.privileged.push({name,args});finalized=true;return{data:f.finalized,error:null}}}}});
 return{calls,save,activation,s,f,context:{params:Promise.resolve({id:s.tournamentId})},request:(method='GET')=>new NextRequest('https://test.invalid/setup',{method,headers:{'x-expected-actor-id':s.actorId}})};
}
test('disabled/mismatched Setup gates do zero client, auth, RPC or privileged work on every endpoint',async()=>{
 for(const e of[{},env(prod,'false'),env(stage,'true'),env(prod,undefined,'true'),env('https://other.supabase.co','true','true')]){const m=await model(e);for(const[name,method]of[['GET','GET'],['POST','POST'],['reconcilePOST','POST']])assert.equal((await m.save[name](m.request(method),m.context)).status,404);for(const[name,method]of[['sourceGET','GET'],['contextGET','GET'],['preparePOST','POST'],['finalizePOST','POST'],['operationPOST','POST'],['contextPOST','POST'],['contextOperationPOST','POST']])assert.equal((await m.activation[name](m.request(method),m.context)).status,404);assert.deepEqual(m.calls,{client:0,auth:0,admin:0,rpc:[],privileged:[]});}
});
test('production admission preserves authentication, actor binding, origin and official-role checks',async()=>{
 for(const o of[{noUser:true},{wrongActor:true},{role:'player'},{role:'viewer'},{origin:false},{noPreparation:true}]){const m=await model(env(prod,'true'),o),r=await m.activation.finalizePOST(m.request('POST'),m.context);assert.notEqual(r.status,200);assert.equal(m.calls.admin,0);assert.equal(m.calls.privileged.length,0);if(o.origin===false)assert.equal(m.calls.client,0);}
 for(const o of[{noUser:true},{wrongActor:true}]){const m=await model(env(prod,'true'),o);assert.notEqual((await m.save.GET(m.request(),m.context)).status,200);assert.equal(m.calls.rpc.length,0);}
});
test('authorized production Setup uses cookie workspace and only exact owned activation gets lazy privileged access',async()=>{
 for(const role of['director','co_director']){const m=await model(env(prod,'true'),{role});assert.equal((await m.save.GET(m.request(),m.context)).status,200);assert.equal(m.calls.admin,0);assert.equal((await m.activation.sourceGET(m.request(),m.context)).status,200);assert.equal(m.calls.admin,0);const r=await m.activation.finalizePOST(m.request('POST'),m.context);assert.equal(r.status,200);assert.equal(m.calls.admin,1);assert.deepEqual(m.calls.privileged,[{name:'finalize_event_prize_activation_provider_v1',args:{actor:m.s.actorId,tid:m.s.tournamentId,request_text:m.f.raw}}]);const receipt=await r.json();assert.equal(receipt.playoffStartAllowed,false);assert.equal(receipt.accountingAllowed,false);assert.equal(receipt.registrationOnly,true);assert.equal((await m.activation.finalizePOST(m.request('POST'),m.context)).status,200);assert.equal(m.calls.admin,1);}
});
test('Setup admission stays server-only and grants no manual play, Finance or award capability',()=>{
 for(const path of['event-prize-setup-production-project-v1.ts','event-prize-setup-admission-v1.ts']){const source=fs.readFileSync('src/lib/api/'+path,'utf8');assert(source.startsWith("import 'server-only'"));assert.doesNotMatch(source,/NEXT_PUBLIC_EVENT|private-admin|\.rpc\(|finance\/|playoffs\//);}
 assert.equal(admitted(env(prod,'true')),true);
 const consumers=[];function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isDirectory())scan(path);else if(/\.tsx?$/.test(path)&&/from\s*['"][^'"]*event-prize-setup-admission-v1(?:\.ts)?['"]/.test(fs.readFileSync(path,'utf8')))consumers.push(path);}}scan('src');
 assert.deepEqual(consumers.sort(),['src/app/tournament/[tournamentId]/setup/page.tsx','src/lib/api/event-prize-activation-production-v1.ts','src/lib/api/event-prize-provider-v1.ts']);
});
