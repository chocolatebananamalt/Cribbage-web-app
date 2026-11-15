import test from'node:test';import assert from'node:assert/strict';
import{createOperationalProviderHandlersV1,operationalProviderExpectedActorHeaderV1}from'../src/lib/api/operational-provider-handlers-v1.ts';
const id=n=>`e7020000-0000-4000-8000-${String(n).padStart(12,'0')}`,actor=id(1),tid=id(2),eid=id(3),op=id(4);
const reply=(body,init={})=>({body,status:init.status??200,headers:new Headers(init.headers)});
const context={params:Promise.resolve({id:tid,eventId:eid,operationId:op})},tournamentContext={params:Promise.resolve({id:tid,operationId:op})};
const request=(method,expectedActor)=>new Request('http://localhost/api/v1/fixture',{method,headers:expectedActor?{[operationalProviderExpectedActorHeaderV1]:expectedActor}:undefined,...(method==='POST'?{body:'{}'}:{})});

test('every older operational provider route rejects a missing actor precondition before creating the port',async()=>{
 let ports=0;const handlers=createOperationalProviderHandlersV1({enabled:()=>true,port:async()=>{ports++;throw Error('must_not_open_port');},readJson:async()=>({}),sameOrigin:()=>true,json:reply,boundary:run=>run()});
 for(const[name,handler]of Object.entries(handlers)){const method=name.endsWith('POST')?'POST':'GET',out=await handler(request(method),name.startsWith('eventSettings')?tournamentContext:context);assert.equal(out.status,403,name);assert.deepEqual(out.body,{error:'identity_changed'},name);}
 assert.equal(ports,0);
});

test('a canonical fixed actor is passed separately to Finance and Setup provider ports',async()=>{
 const seen=[],port={
  eventSettingsWorkspace:async(tournamentId,expectedActorId)=>{seen.push(['setup',tournamentId,expectedActorId]);return{data:{kind:'fixture'},error:null};},
  financeWorkspace:async(scope,expectedActorId)=>{seen.push(['finance',scope,expectedActorId]);return{data:{kind:'fixture'},error:null};},
 };
 const handlers=createOperationalProviderHandlersV1({enabled:()=>true,port:async()=>port,readJson:async()=>({}),sameOrigin:()=>true,json:reply,boundary:run=>run()});
 assert.equal((await handlers.eventSettingsGET(request('GET',actor),tournamentContext)).status,200);
 assert.equal((await handlers.financeGET(request('GET',actor),context)).status,200);
 assert.deepEqual(seen,[['setup',tid,actor],['finance',{tournamentId:tid,eventId:eid},actor]]);
});

test('malformed and noncanonical actor headers fail as identity changes',async()=>{
 let ports=0;const handlers=createOperationalProviderHandlersV1({enabled:()=>true,port:async()=>{ports++;return{};},readJson:async()=>({}),sameOrigin:()=>true,json:reply,boundary:run=>run()});
 for(const value of['not-a-uuid',actor.toUpperCase()]){const out=await handlers.financeGET(request('GET',value),context);assert.equal(out.status,403);assert.deepEqual(out.body,{error:'identity_changed'});}
 assert.equal(ports,0);
});
