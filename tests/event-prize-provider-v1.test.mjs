import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NextRequest} from 'next/server.js';
import {createEventPrizeProviderV1,eventPrizeProviderEnabledV1} from '../src/lib/api/event-prize-provider-handlers-v1.ts';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,actor=id(1),tid=id(2);
const request=(method='GET',overrides={})=>new NextRequest(`https://test.invalid/api/v1/tournaments/${tid}/event-prize-settings`,{method,headers:{'x-expected-actor-id':actor,origin:'https://test.invalid',...overrides}});
const context={params:Promise.resolve({id:tid})};
function model({enabled=true,user=actor,sameOrigin=true,body={},reply=null,write=true,read=true,recovery=true}={}){
 const calls={clients:0,auth:0,reads:0,rpc:[]};
 const handlers=createEventPrizeProviderV1({json:(body,init)=>Response.json(body,init),boundary:f=>f(),enabled:()=>enabled,writeEnabled:()=>write,readEnabled:()=>read,recoveryEnabled:()=>recovery,sameOrigin:()=>sameOrigin,readJson:async(_r,max)=>{calls.reads++;assert.equal(max,1000000);return body;},client:async()=>{calls.clients++;return{auth:{getUser:async()=>{calls.auth++;return{data:{user:user?{id:user}:null},error:null};}},rpc:async(name,args)=>{calls.rpc.push({name,args});return{data:reply,error:null};}};}});
 return{calls,handlers};
}
test('production capability is false and disabled routes perform no authentication or provider work',async()=>{
 assert.equal(eventPrizeProviderEnabledV1(),false);const m=model({enabled:false});assert.equal((await m.handlers.GET(request(),context)).status,404);assert.equal((await m.handlers.POST(request('POST'),context)).status,404);assert.deepEqual(m.calls,{clients:0,auth:0,reads:0,rpc:[]});
});
test('mutation origin, method, actor and session boundaries fail before reading or writing',async()=>{
 for(const scenario of[{sameOrigin:false,status:403},{user:null,status:401},{user:id(9),status:403}]){const m=model(scenario);const r=await m.handlers.POST(request('POST'),context);assert.equal(r.status,scenario.status);assert.equal(m.calls.reads,0);assert.equal(m.calls.rpc.length,0);}
 const m=model();assert.equal((await m.handlers.POST(request(),context)).status,405);assert.equal(m.calls.clients,0);
 const missing=model();assert.equal((await missing.handlers.GET(request('GET',{'x-expected-actor-id':'invalid'}),context)).status,400);assert.equal(missing.calls.clients,0);
});
test('GET returns only a current actor-bound workspace and does not infer missing state',async()=>{
 const workspace={kind:'event-prize-workspace-v1',actorId:actor,tournamentId:tid,base:{tournamentId:tid,setupRevisionId:null,setupVersion:0,sourceDigest:'a'.repeat(64)},events:[],settings:{state:'absent',historyExists:false,snapshot:null,id:null,digest:null},prizes:{state:'absent',historyExists:false,snapshot:null},activationAllowed:false,accountingAllowed:false,moneyMoved:false};
 const m=model({reply:workspace}),r=await m.handlers.GET(request(),context);assert.equal(r.status,200);assert.deepEqual(await r.json(),workspace);assert.deepEqual(m.calls.rpc,[{name:'get_event_prize_workspace_provider_v1',args:{p_tid:tid}}]);
 for(const reply of[null,{...workspace,actorId:id(9)},{...workspace,settings:{...workspace.settings,historyExists:true}}]){const bad=model({reply});assert.equal((await bad.handlers.GET(request(),context)).status,503);}
});
test('invalid or unparseable saves and recovery never reach a SQL writer',async()=>{
 for(const body of[null,{},'not a request']){const m=model({body}),response=await m.handlers.POST(request('POST'),context);assert.equal(response.status,body===null?400:409);assert.equal(m.calls.rpc.length,0);}
 const m=model({body:{}});assert.equal((await m.handlers.reconcilePOST(request('POST'),context)).status,409);assert.equal(m.calls.rpc.length,0);
});
test('disabling writes leaves separately enabled reads and recovery available',async()=>{
 const m=model({write:false});assert.equal((await m.handlers.POST(request('POST'),context)).status,404);assert.equal(m.calls.clients,0);
 assert.equal((await m.handlers.GET(request(),context)).status,503);assert.equal(m.calls.rpc[0].name,'get_event_prize_workspace_provider_v1');
 assert.equal((await m.handlers.reconcilePOST(request('POST'),context)).status,409);assert.equal(m.calls.reads,1);assert.equal(m.calls.rpc.length,1);
 const off=model({write:false,read:false,recovery:false});assert.equal((await off.handlers.GET(request(),context)).status,404);assert.equal((await off.handlers.reconcilePOST(request('POST'),context)).status,404);assert.equal(off.calls.clients,0);
});
test('real route composition binds tested bounded, origin, private response and failure ports',()=>{
 const production=fs.readFileSync('src/lib/api/event-prize-provider-v1.ts','utf8');
 for(const binding of['enabled:eventPrizeProviderEnabledV1','readEnabled:eventPrizeProviderEnabledV1','writeEnabled:eventPrizeProviderEnabledV1','recoveryEnabled:eventPrizeProviderEnabledV1','eventPrizeProviderEnabledV1=eventPrizeSetupTestProjectEnabledV1','sameOrigin:isSameOriginRequest','readJson:readBoundedJson','json:apiJson','boundary:withApiFailureBoundary'])assert(production.includes(binding),binding);
 for(const [path,method]of[['route.ts','POST'],['reconcile/route.ts','reconcilePOST']]){const source=fs.readFileSync('src/app/api/v1/tournaments/[id]/event-prize-settings/'+path,'utf8');assert(source.includes(`eventPrizeProviderV1.${method}(request,context)`));assert(source.includes('withApiFailureBoundary(async()=>'));assert(source.includes("response.headers.set('cache-control',privateNoStore['cache-control'])"));assert.doesNotMatch(source,/request\.(json|text)\(/);}
 assert.doesNotMatch(production,/private-admin|service_role|\.from\(/);
});
