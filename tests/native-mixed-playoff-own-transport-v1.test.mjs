import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{createNativeMixedPlayoffOwnTransportV1 as create}from'../src/lib/api/native-mixed-playoff-own-transport-v1.ts';
const id=n=>`aaaa0000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash='a'.repeat(64),url='https://test-project.supabase.co',ref='test-project';
const target=()=>({actorId:id(1),sessionId:id(2),projectUrl:url,projectRef:ref,ownScope:{tournamentId:id(3),eventId:id(4),participantId:id(5),tournamentIdNumber:'A-10'}});
const command=()=>({version:'native-mixed-playoff-request-v1',action:'game-action',expectedSourceDigest:hash,data:{contextId:id(6),slot:3,gameNumber:1,expectedMatchDigest:hash,expectedRevision:0,expectedHistoryDigest:hash,entry:{type:'digital-submit',participantId:id(5),winnerParticipantId:id(5),statement:'simulation-own-playoff-result-v1'}}});
const ownDto=()=>({status:'awaiting_playoff_preparation',own:{participantId:id(5),tournamentIdNumber:'A-10'},tournamentId:id(3),eventId:id(4),simulationOnly:true,ordinaryQualificationRecorded:false,mrpAwarded:false,moneyMoved:false});
const receipt=(r)=>({status:'simulated_playoff_evidence_recorded',contextId:r.data.contextId,slot:r.data.slot,gameNumber:r.data.gameNumber,entryId:id(20),revision:r.data.expectedRevision+1,historyDigest:'b'.repeat(64),sourceDigest:r.expectedSourceDigest,matchDigest:r.data.expectedMatchDigest,gameComplete:false,matchComplete:false,winnerId:null,simulationOnly:true,ordinaryQualificationRecorded:false,mrpAwarded:false,moneyMoved:false});
function fixture(options={}){
 const t=target(),state={enabled:true,actor:t.actorId,session:t.sessionId,exp:4102444800,users:0,claims:0,calls:[],reply:ownDto(),error:null,throw:false,after:null,claimAfter:null};
 const client={auth:{getUser:async()=>{state.users++;return{data:{user:{id:state.actor}},error:null};},getClaims:async()=>{state.claims++;state.claimAfter?.();return{data:{claims:{sub:state.actor,session_id:state.session,exp:state.exp}},error:null};}},rpc:async(name,args)=>{state.calls.push({name,args:structuredClone(args)});state.after?.();if(state.throw)throw Error('SDK failed');return{data:state.reply,error:state.error};}};
 const o={authenticated:client,projectUrl:url,projectRef:ref,target:t,enabled:()=>state.enabled,now:()=>1,...options},transport=create(o);return{t,state,client,o,transport};
}
test('defaultoff transport performs no auth/RPC and generates no operation IDs',async()=>{
 const x=fixture({enabled:undefined});assert.equal(x.transport.prepare(id(10),command()),null);assert.equal((await x.transport.read()).error,'disabled');assert.equal((await x.transport.write(null)).error,'disabled');assert.equal(x.state.users,0);assert.equal(x.state.claims,0);assert.equal(x.state.calls.length,0);
});
test('project/URL/scope mismatch fails before auth; factory pins detached immutable host target',async()=>{
 for(const edit of[t=>t.projectUrl='http://test-project.supabase.co',t=>t.projectRef='other',t=>t.projectUrl='https://u:p@test-project.supabase.co',t=>t.ownScope.extra=true]){const t=target();edit(t);const x=fixture({target:t});assert.equal((await x.transport.read()).error,'invalid_target');assert.equal(x.state.users,0);assert.equal(x.state.calls.length,0);}
 const x=fixture();x.t.actorId=id(99);x.t.ownScope.participantId=id(99);assert.equal((await x.transport.read()).error,null);const p=x.transport.prepare(id(10),command());assert.equal(p.target.actorId,id(1));assert(Object.isFrozen(p));assert(Object.isFrozen(p.request.data));
});
test('normal user+claims without ref authenticates before and after strict own read, with no actor RPC parameter',async()=>{
 const x=fixture(),r=await x.transport.read();assert.equal(r.error,null);assert.equal(r.data.status,'awaiting_playoff_preparation');assert.equal(x.state.users,2);assert.equal(x.state.claims,2);assert.deepEqual(x.state.calls,[{name:'get_native_mixed_playoff_own_v1',args:{p_tournament_id:id(3),p_event_id:id(4)}}]);
});
test('pre-dispatch identity/expiry/gate changes send nothing; read identity drift after RPC suppresses DTO',async()=>{
 for(const edit of[s=>s.actor=id(99),s=>s.session=id(99),s=>s.exp=0]){const x=fixture();edit(x.state);assert.equal((await x.transport.read()).error,'identity_changed');assert.equal(x.state.calls.length,0);}
 const gate=fixture();gate.state.claimAfter=()=>gate.state.enabled=false;assert.equal((await gate.transport.read()).error,'disabled');assert.equal(gate.state.calls.length,0);
 const changed=fixture();changed.state.after=()=>changed.state.session=id(99);assert.equal((await changed.transport.read()).error,'identity_changed');assert.equal(changed.state.users,2);
 const failed=fixture();failed.state.error={message:'unavailable'};assert.equal((await failed.transport.read()).error,'provider_unavailable');assert.equal(failed.state.users,2);assert.equal(failed.state.claims,2);
});
test('read rejects private/foreign/malformed replies and detaches data before post-auth awaits',async()=>{
 for(const reply of[null,{...ownDto(),actorId:id(99)},{...ownDto(),eventId:id(99)},{...ownDto(),moneyMoved:true}]){const x=fixture();x.state.reply=reply;assert.equal((await x.transport.read()).error,'invalid_response');}
 const x=fixture();x.state.claimAfter=()=>{if(x.state.claims===2)x.state.reply.own.tournamentIdNumber='A-99';};const r=await x.transport.read();assert.equal(r.data.own.tournamentIdNumber,'A-10');
});
test('prepare validates own digital commands and caller operation ID; retains exact controlled request bytes',async()=>{
 const x=fixture(),c=command(),p=x.transport.prepare(id(10),c);assert(p);c.data.entry.winnerParticipantId=id(99);assert.equal(p.request.data.entry.winnerParticipantId,id(5));assert.equal(p.operationId,id(10));assert.equal(JSON.parse(p.retainedRaw).request.reason,p.request.reason);assert(!Object.hasOwn(p.request,'actorId'));
 assert.equal(x.transport.prepare('bad',command()),null);for(const edit of[c=>c.data.entry.participantId=id(99),c=>c.data.entry.actorId=id(1),c=>c.data.entry.type='paper-capture',c=>c.data.expectedRevision=6,c=>c.data.slot=5,c=>c.reason='caller supplied']){const c=command();edit(c);assert.equal(x.transport.prepare(id(11),c),null);}
 const tampered=JSON.parse(JSON.stringify(p));tampered.request.data.expectedRevision=1;assert.equal((await x.transport.write(tampered)).error,'invalid_request');assert.equal(x.state.calls.length,0);
});
test('valid write uses only public normal-auth RPC arguments, preserves prepared bytes and never verifies a game',async()=>{
 const x=fixture(),p=x.transport.prepare(id(10),command());x.state.reply=receipt(p.request);const r=await x.transport.write(p);assert.equal(r.error,null);assert.equal(r.dispatched,true);assert.equal(r.serverStateVerified,false);assert.equal(r.prepared.retainedRaw,p.retainedRaw);assert.equal(x.state.users,2);assert.deepEqual(x.state.calls,[{name:'execute_native_mixed_playoff_v1',args:{p_tournament_id:id(3),p_event_id:id(4),p_operation_id:id(10),p_request:p.request}}]);
 assert.equal(r.data.gameComplete,false);assert.equal(r.data.matchComplete,false);
});
test('every post-dispatch failure is unknown and retains exact prepared descriptor, including auth/gate drift',async()=>{
 for(const failure of['throw','error','null','malformed','identity','gate','expiry']){const x=fixture(),p=x.transport.prepare(id(10),command());x.state.reply=receipt(p.request);if(failure==='throw')x.state.throw=true;if(failure==='error')x.state.error={code:'error'};if(failure==='null')x.state.reply=null;if(failure==='malformed')x.state.reply.extra=true;if(failure==='identity')x.state.after=()=>x.state.session=id(99);if(failure==='gate')x.state.after=()=>x.state.enabled=false;if(failure==='expiry')x.state.after=()=>x.state.exp=0;const r=await x.transport.write(p);assert.equal(r.error,'operation_outcome_unknown',failure);assert.equal(r.dispatched,true);assert.equal(r.prepared.retainedRaw,p.retainedRaw);assert.equal(x.state.calls.length,1);}
});
test('receipt coordinates/revision/source/action invariants and historical flags are exact; accepted is not fresh state',async()=>{
 for(const edit of[v=>v.contextId=id(99),v=>v.slot=4,v=>v.gameNumber=2,v=>v.revision=0,v=>v.sourceDigest='c'.repeat(64),v=>v.matchDigest='c'.repeat(64),v=>v.entryId='bad',v=>v.gameComplete=true,v=>v.matchComplete=true,v=>v.winnerId=id(5),v=>v.actorId=id(1),v=>v.historicalReceipt=true]){const x=fixture(),p=x.transport.prepare(id(10),command());x.state.reply=receipt(p.request);edit(x.state.reply);assert.equal((await x.transport.write(p)).error,'operation_outcome_unknown');}
 const x=fixture(),p=x.transport.prepare(id(10),command());x.state.reply={...receipt(p.request),historicalReceipt:true,currentSourceVerified:false};const r=await x.transport.write(p);assert.equal(r.error,null);assert.equal(r.data.historicalReceipt,true);assert.equal(r.serverStateVerified,false);
});
test('matching confirmations carry own submission and sorted refs; valid negative status still preserves pending bytes',async()=>{
 const x=fixture(),c=command();c.data.expectedRevision=2;c.data.entry={type:'digital-confirm',participantId:id(5),submissionId:id(11),winnerParticipantId:id(5),evidenceIds:[id(11),id(12)],statement:'simulation-own-playoff-confirmation-v1'};const p=x.transport.prepare(id(10),c);assert(p);x.state.reply={...receipt(p.request),gameComplete:true,matchComplete:true,winnerId:id(5)};assert.equal((await x.transport.write(p)).error,null);
 const bad=structuredClone(c);bad.data.entry.evidenceIds.reverse();assert.equal(x.transport.prepare(id(11),bad),null);
 x.state.reply={status:'retry_exact',code:'source_busy'};const b=await x.transport.write(p);assert.equal(b.error,null);assert.equal(b.data.code,'source_busy');assert.equal(b.prepared.retainedRaw,p.retainedRaw);assert.equal(x.state.calls.length,2);
 x.state.reply={status:'rejected',code:'unrecognized'};assert.equal((await x.transport.write(p)).error,'operation_outcome_unknown');
});
test('accessors/deep/forged prepared data reject without getter calls, retry/storage/credentials remain absent',async()=>{
 const x=fixture();let called=false;const c=command();Object.defineProperty(c,'data',{enumerable:true,get(){called=true;throw Error('no');}});assert.equal(x.transport.prepare(id(10),c),null);assert.equal(called,false);
 const p=x.transport.prepare(id(10),command()),fake=JSON.parse(JSON.stringify(p));fake.target.ownScope.participantId=id(99);fake.retainedRaw=JSON.stringify({version:fake.version,target:fake.target,operationId:fake.operationId,request:fake.request});assert.equal((await x.transport.write(fake)).error,'invalid_request');
 const source=fs.readFileSync('src/lib/api/native-mixed-playoff-own-transport-v1.ts','utf8');assert.doesNotMatch(source,/createClient|service_role|randomUUID\(|localStorage|indexedDB|setTimeout\(/);assert.match(source,/host must construct the client/);assert.match(source,/not HTTP bytes/);
});
test('later factory-options mutation cannot invalidate or redirect an already prepared operation',async()=>{
 const x=fixture(),p=x.transport.prepare(id(10),command());x.o.projectUrl='https://other.supabase.co';x.o.projectRef='other';x.o.target=target();x.o.target.ownScope.eventId=id(99);x.state.reply=receipt(p.request);
 const r=await x.transport.write(p);assert.equal(r.error,null);assert.equal(r.prepared.retainedRaw,p.retainedRaw);assert.equal(x.state.calls[0].args.p_event_id,id(4));assert.equal(r.prepared.target.projectUrl,url);
});
