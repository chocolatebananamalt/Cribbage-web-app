import fs from'node:fs';import assert from'node:assert/strict';import test from'node:test';
import{nativeMixedPlayoffOwnRouteEnabledV1,prepareNativeMixedPlayoffOwnRouteV1}from'../src/lib/playoffs/native-mixed-playoff-own-route-v1.ts';
const id=n=>`a9890000-0000-4000-8000-${String(n).padStart(12,'0')}`,url='https://nnhcnvksxgxnpvdqjgpg.supabase.co';
function fixture(){
 const params={tournamentId:id(1),eventId:id(2)},raw={status:'awaiting_playoff_preparation',own:{participantId:id(3),tournamentIdNumber:'A-10'},...params,simulationOnly:true,ordinaryQualificationRecorded:false,mrpAwarded:false,moneyMoved:false};
 const f={creates:0,rpcs:[],users:0,claims:0,raw,params,beforeUser:null,beforeClaims:null,duringRpc:null};
 const client={auth:{async getUser(){f.users++;f.beforeUser?.(f);return{data:{user:{id:id(4)}},error:null};},async getClaims(){f.claims++;f.beforeClaims?.(f);return{data:{claims:{sub:id(4),session_id:f.session??id(5),exp:f.exp??2000}},error:null};}},async rpc(name,args){f.rpcs.push({name,args});f.duringRpc?.(f);return{data:f.raw,error:f.error??null};}};
 const o={enabled:true,params,projectUrl:url,projectRef:'nnhcnvksxgxnpvdqjgpg',now:()=>1000_000,async createAuthenticated(expected){f.creates++;assert.equal(expected,url);return client;}};
 return{f,o,client};
}
test('closed route, invalid params and wrong project return before client creation',async()=>{
 assert.equal(nativeMixedPlayoffOwnRouteEnabledV1(),false);const x=fixture();assert.equal(await prepareNativeMixedPlayoffOwnRouteV1({...x.o,enabled:false}),null);
 for(const p of[{...x.o.params,actorId:id(9)},{tournamentId:'bad',eventId:id(2)}])assert.equal(await prepareNativeMixedPlayoffOwnRouteV1({...x.o,params:p}),null);
 assert.equal(await prepareNativeMixedPlayoffOwnRouteV1({...x.o,projectUrl:'https://wrong.supabase.co'}),null);assert.equal(x.f.creates,0);
});
test('normal authenticated own RPC supplies ownership; no posted actor or ordinary payment query',async()=>{
 const x=fixture(),r=await prepareNativeMixedPlayoffOwnRouteV1(x.o);assert(r);assert.equal(r.target.actorId,id(4));assert.equal(r.target.sessionId,id(5));assert.equal(r.target.ownScope.participantId,id(3));assert.equal(r.initialState.status,'awaiting_playoff_preparation');
 assert.deepEqual(x.f.rpcs,[{name:'get_native_mixed_playoff_own_v1',args:{p_tournament_id:id(1),p_event_id:id(2)}}]);assert.equal(x.f.users,2);assert.equal(x.f.claims,2);assert(Object.isFrozen(r)&&Object.isFrozen(r.target)&&Object.isFrozen(r.target.ownScope)&&Object.isFrozen(r.initialState.own));
});
test('accessors never run while validating route params or the raw own body',async()=>{
 let hits=0;const x=fixture(),p={eventId:id(2)};Object.defineProperty(p,'tournamentId',{enumerable:true,get(){hits++;return id(1);}});assert.equal(await prepareNativeMixedPlayoffOwnRouteV1({...x.o,params:p}),null);assert.equal(hits,0);assert.equal(x.f.creates,0);
 const y=fixture();Object.defineProperty(y.f.raw,'own',{enumerable:true,get(){hits++;return{participantId:id(3),tournamentIdNumber:'A-10'};}});assert.equal(await prepareNativeMixedPlayoffOwnRouteV1(y.o),null);assert.equal(hits,0);
});
test('identity/session/expiry drift after RPC cannot return a private SSR snapshot',async()=>{
 const x=fixture();x.f.beforeClaims=f=>{if(f.claims===2)f.session=id(99);};assert.equal(await prepareNativeMixedPlayoffOwnRouteV1(x.o),null);
 const y=fixture();y.f.duringRpc=f=>{f.exp=1;};assert.equal(await prepareNativeMixedPlayoffOwnRouteV1(y.o),null);
 const z=fixture();z.f.exp=1;assert.equal(await prepareNativeMixedPlayoffOwnRouteV1(z.o),null);assert.equal(z.f.rpcs.length,0);
});
test('response is strictly decoded and detached before later auth awaits',async()=>{
 const x=fixture();x.f.beforeUser=f=>{if(f.users===2){f.raw.own.participantId=id(99);f.raw.moneyMoved=true;}};const r=await prepareNativeMixedPlayoffOwnRouteV1(x.o);assert(r);assert.equal(r.initialState.own.participantId,id(3));assert.equal(r.initialState.moneyMoved,false);
 const y=fixture();y.f.raw.profileId=id(9);assert.equal(await prepareNativeMixedPlayoffOwnRouteV1(y.o),null);
 const z=fixture();z.f.raw.eventId=id(99);assert.equal(await prepareNativeMixedPlayoffOwnRouteV1(z.o),null);
});
test('mutable host options cannot redirect the captured event or project after await',async()=>{
 const x=fixture(),create=x.o.createAuthenticated;x.o.createAuthenticated=async expected=>{const c=await create(expected);x.o.projectUrl='https://wrong.supabase.co';x.o.projectRef='wrong';x.o.params.eventId=id(99);return c;};const r=await prepareNativeMixedPlayoffOwnRouteV1(x.o);assert(r);assert.equal(r.target.projectUrl,url);assert.equal(r.target.ownScope.eventId,id(2));assert.equal(x.f.rpcs[0].args.p_event_id,id(2));
});
test('pinned existing cookie factory rejects URL mismatch before SDK client creation',()=>{
 const source=fs.readFileSync('src/lib/supabase/server.ts','utf8');assert.match(source,/createClient\(expectedProjectUrl\?: string\)/);const guard=source.indexOf('expectedProjectUrl !== undefined && url !== expectedProjectUrl'),sdk=source.indexOf('return createServerClient(url, publishableKey');assert(guard>0&&guard<sdk);assert.doesNotMatch(fs.readFileSync('src/lib/playoffs/native-mixed-playoff-own-route-v1.ts','utf8'),/service_role|unstable_cache|requireTournamentAccess|record.*payment/);
});
