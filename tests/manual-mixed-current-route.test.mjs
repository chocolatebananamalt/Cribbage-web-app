import test from 'node:test';import assert from 'node:assert/strict';
import {loadActual,actual,actor,game,submission,operation,session,foreign,handoff} from './helpers/manual-paper-status-runtime-ports.mjs';
const dto=await actual('src/lib/games/manual-mixed-handoff-v1.ts'),identity=await actual('src/lib/api/verified-subject.ts'),bodyReader=await actual('src/lib/api/bounded-json.ts'),origin=await actual('src/lib/api/same-origin.ts'),validation=await actual('src/lib/api/validation.ts');
const requestBody=decision=>({submissionId:submission,gameVersion:2,operationId:operation,decision});
function harness({enabled=true,before={subject:actor,sessionId:session},after=before,userBefore=actor,userAfter=userBefore,claimsError=false,userError=false,rpcError=null,data=handoff('yes'),throws=false}={}){
 let claimReads=0,userReads=0;const calls=[];const normal={auth:{getClaims:async()=>{const i=claimReads++===0?before:after;return {data:{claims:i?{sub:i.subject,session_id:i.sessionId}:{}},error:claimsError?{}:null};},getUser:async()=>({data:{user:{id:userReads++===0?userBefore:userAfter}},error:userError?{}:null})},rpc:async(name,args)=>{calls.push({name,args});if(throws)throw Error('PRIVATE_PROVIDER_SENTINEL');return{data,error:rpcError};}};
 const deps={...dto,...identity,...bodyReader,...origin,...validation,manualMixedHandoffEnabledV1:()=>enabled,createClient:async()=>normal};
 const modules=['../../../../../../lib/api/bounded-json','../../../../../../lib/games/manual-mixed-handoff-v1','../../../../../../lib/supabase/server','../../../../../../lib/api/verified-subject','../../../../../../lib/api/same-origin','../../../../../../lib/api/validation'];
 const route=loadActual('src/app/api/v1/games/[id]/manual-mixed-handoff/route.ts',Object.fromEntries(modules.map(n=>[n,deps])));return{route,calls};
}
const req=(payload=requestBody('yes'),headers={})=>new Request('https://fixture.invalid/api/v1/games/'+game+'/manual-mixed-handoff',{method:'POST',headers:{origin:'https://fixture.invalid','sec-fetch-site':'same-origin','content-type':'application/json',...headers},body:typeof payload==='string'?payload:JSON.stringify(payload)});
const params=id=>({params:Promise.resolve({id})});
test('current POST Yes and No use normal authenticated RPC, remain tentative and need no photo',async()=>{
 for(const decision of ['yes','no']){const h=harness({data:handoff(decision)});const r=await h.route.POST(req(requestBody(decision)),params(game));assert.equal(r.status,200);const value=await r.json();assert.equal(value.tentative,true);assert.equal(value.verified,false);assert.equal(value.response.decision,decision);assert.equal(dto.tentativePaperResultV1(value).countsForFinalization,false);assert.deepEqual(JSON.parse(JSON.stringify(h.calls)),[{name:'record_manual_mixed_handoff_v1',args:{p_game_id:game,p_submission_id:submission,p_game_version:2,p_operation_id:operation,p_decision:decision}}]);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('set-cookie'),null);}
});
test('current GET uses actor-bound validated read RPC and never sends write arguments',async()=>{
 const h=harness({data:handoff('no')});const r=await h.route.GET(new Request('https://fixture.invalid/read'),params(game));assert.equal(r.status,200);assert.deepEqual(JSON.parse(JSON.stringify(h.calls)),[{name:'get_manual_mixed_handoff_v1',args:{p_game_id:game}}]);assert.equal((await r.json()).verified,false);
});
test('gate, UUID and same-origin failures reject before normal RPC',async()=>{
 for(const [options,id,headers,status] of [[{enabled:false},game,{},404],[{},'invalid',{},400],[{},game,{origin:'https://foreign.invalid'},400],[{},game,{'sec-fetch-site':'cross-site'},400]]){const h=harness(options);assert.equal((await h.route.POST(req(undefined,headers),params(id))).status,status);assert.equal(h.calls.length,0);}
});
test('missing session, foreign user, claims/user provider errors never reach RPC',async()=>{
 for(const [options,status] of [[{before:null},401],[{before:{subject:actor,sessionId:undefined}},401],[{userBefore:foreign},401],[{claimsError:true},503],[{userError:true},401]]){const h=harness(options);assert.equal((await h.route.POST(req(),params(game))).status,status);assert.equal(h.calls.length,0);}
});
test('DTO and bounded-body rejection do not accept fabricated identity, verification or photo fields',async()=>{
 const payloads=[{...requestBody('yes'),actorId:actor},{...requestBody('yes'),verified:true},{...requestBody('yes'),photo:'not-required'},{...requestBody('yes'),decision:'approve'},{...requestBody('yes'),gameVersion:0},'{',JSON.stringify({padding:'x'.repeat(2100)})];
 for(const payload of payloads){const h=harness();assert.equal((await h.route.POST(req(payload),params(game))).status,400);assert.equal(h.calls.length,0);}
 const h=harness();assert.equal((await h.route.POST(req(undefined,{'content-type':'text/plain'}),params(game))).status,400);assert.equal(h.calls.length,0);
});
test('post-RPC actor/session/user drift rejects without releasing any candidate DTO',async()=>{
 for(const options of [{after:null},{after:{subject:foreign,sessionId:session}},{after:{subject:actor,sessionId:foreign}},{userAfter:foreign}]){const h=harness(options);const r=await h.route.POST(req(),params(game));assert.equal(r.status,401);assert.equal(h.calls.length,1);assert.deepEqual(await r.json(),{error:'unauthorized'});}
});
test('foreign/malformed source and provider failures stay private, unverified and bounded',async()=>{
 for(const data of [{...handoff('yes'),actorId:foreign},{...handoff('yes'),gameId:foreign},{...handoff('yes'),verified:true},{...handoff('yes'),tentative:false},null]){const h=harness({data});const r=await h.route.POST(req(),params(game));assert.equal(r.status,409);assert.deepEqual(await r.json(),{error:'current_source_unavailable'});}
 for(const [options,status] of [[{rpcError:{message:'PRIVATE_PROVIDER_SENTINEL'}},409],[{throws:true},503]]){const h=harness(options);const r=await h.route.POST(req(),params(game));assert.equal(r.status,status);assert.doesNotMatch(await r.text(),/PRIVATE_PROVIDER_SENTINEL/);assert.equal(r.headers.get('cache-control'),'private, no-store');}
});
