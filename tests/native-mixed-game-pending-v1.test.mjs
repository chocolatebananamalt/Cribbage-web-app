import test from 'node:test';import assert from 'node:assert/strict';
import {NativeMixedGamePendingControllerV1 as Controller,parseNativeMixedGamePendingV1 as parse,nativeMixedGamePendingKeyV1 as key} from '../src/lib/seating/native-mixed-game-pending-v1.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash='a'.repeat(64);
const target={actorId:id(1),sessionId:id(2),projectUrl:'https://example.supabase.co',projectRef:'example',tournamentId:id(3),eventId:id(4),startId:id(5),gameId:id(6),startSourceDigest:hash};
const flags=Object.fromEntries(['ordinaryScoreWritten','normalStartAuthorized','scoringAuthorized','officialResultVerified','humanPlayVerified','moneyMoved','payoutAuthorized'].map(k=>[k,false]));
const request=()=>({kind:'native-mixed-simulation-game-write-v1',operationId:id(7),startId:target.startId,gameId:target.gameId,expectedStartSourceDigest:hash,expectedRevision:0,expectedHistoryDigest:hash,action:'digital-submit',payload:{participantId:id(8),result:{winnerSide:'a',margin:40},statement:'simulation-own-result-v1'}});
const loaded=()=>({kind:'native-mixed-simulation-game-state-v1',playOrder:'current',actorId:target.actorId,tournamentId:target.tournamentId,eventId:target.eventId,startId:target.startId,gameId:target.gameId,startSourceDigest:hash,revision:0,historyDigest:hash,evidenceVisibility:'metadata-only',entries:[],currentSourceVerified:true,simulationOnly:true,...flags});
function receipt(r=request()) {return {kind:'native-mixed-simulation-game-write-receipt-v1',status:'accepted',code:'simulation_evidence_recorded',actorId:target.actorId,tournamentId:target.tournamentId,eventId:target.eventId,operationId:r.operationId,request:structuredClone(r),entry:{id:id(9),operationId:r.operationId,receiptId:id(10),payloadDigest:hash,sequence:1,actorId:target.actorId,tournamentId:target.tournamentId,eventId:target.eventId,startId:target.startId,gameId:target.gameId,startSourceDigest:hash,action:r.action,...structuredClone(r.payload)},revision:1,historyDigest:hash,simulationOnly:true,historicalReceipt:false,currentSourceVerified:true,...flags};}
function memory(){const rows=new Map(),history=new Map();return {rows,history,read:async k=>rows.get(k)??null,transition:async(k,expected,next,archive,signal)=>{
 if(signal?.aborted||(rows.get(k)??null)!==expected)return false;
 if(archive){if(history.has(archive.id)&&history.get(archive.id)!==archive.raw)throw Error('archive_conflict');history.set(archive.id,archive.raw);}
 if(next===null)rows.delete(k);else rows.set(k,next);return true;
}};}
function setup(overrides={}){
 const retained=overrides.retained??memory(),calls=[];let online=true,enabled=true;
 const transport={write:async(t,r)=>{calls.push(['write',structuredClone(t),structuredClone(r)]);return{data:receipt(r),error:null};},recover:async(t,r)=>{calls.push(['recover',structuredClone(t),structuredClone(r)]);return{data:{...receipt(r),historicalReceipt:true,currentSourceVerified:false},error:null};},state:async t=>{calls.push(['state',structuredClone(t)]);return{data:{...loaded(),evidenceVisibility:'evidence',revision:1,entries:[receipt().entry]},error:null};},...overrides.transport};
 const options={target,ownParticipantId:id(8),retained,transport,enabled:()=>enabled,online:()=>online,...overrides,transport};
 return{controller:new Controller(options),options,retained,calls,setOnline:v=>online=v,setEnabled:v=>enabled=v};
}
test('default-off constructor and initialization do not dispatch or read storage',async()=>{
 let reads=0;const c=new Controller({target,ownParticipantId:id(8),retained:{read:async()=>{reads++;return null;},transition:async()=>true},transport:{},online:()=>true});await c.initialize();assert.equal(reads,0);assert.equal(await c.save(request(),loaded()),false);
});
test('offline save survives full controller reload without provider calls; exact outcome check archives atomically',async()=>{
 const a=setup();a.setOnline(false);await a.controller.initialize();const r=request();assert.equal(await a.controller.save(r,loaded()),true);const raw=a.retained.rows.get(key(target));r.payload.result.margin=90;
 assert.equal(a.calls.length,0);await a.controller.sendExact();assert.equal(a.calls.length,0);a.controller.dispose();
 const b=setup({retained:a.retained});await b.controller.initialize();assert.equal(b.controller.getSnapshot().pending.request.payload.result.margin,40);assert.equal(b.calls.length,0);await b.controller.checkOutcome();assert.deepEqual(b.calls.map(c=>c[0]),['recover','state']);assert.equal(b.calls[0][2].payload.result.margin,40);assert.equal(b.retained.rows.size,0);assert.equal(b.retained.history.size,1);assert.equal(JSON.parse([...b.retained.history.values()][0]).pending,raw);assert.equal(b.controller.getSnapshot().pending,null);
});
test('unknown send outcome keeps exact bytes; never automatic resend after reload or reconnect',async()=>{
 const a=setup({transport:{write:async()=>{throw Error('offline');}}});await a.controller.initialize();await a.controller.save(request(),loaded());await a.controller.sendExact();const raw=a.retained.rows.get(key(target));assert.equal(parse(raw).phase,'attempted');assert.deepEqual(parse(raw).request,request());assert.ok(a.controller.getSnapshot().pending);a.setOnline(false);a.setOnline(true);assert.equal(a.calls.length,0);
 const b=setup({retained:a.retained,transport:{recover:async()=>({data:null,error:'operation_outcome_unknown'})}});await b.controller.initialize();assert.equal(b.calls.length,0);await b.controller.checkOutcome();assert.equal(b.retained.rows.get(key(target)),raw);assert.equal(b.retained.history.size,0);
});
test('malformed, other-account and other-origin pending bytes are preserved and block authoring',async()=>{
 for(const raw of ['{broken',JSON.stringify({kind:'legacy'}),JSON.stringify({kind:'native-mixed-game-pending-v1',target:{...target,actorId:id(99)},ownParticipantId:id(8),request:request()}),JSON.stringify({kind:'native-mixed-game-pending-v1',target:{...target,projectUrl:'https://other.example'},ownParticipantId:id(8),request:request()})]){
  const retained=memory();retained.rows.set(key(target),raw);const a=setup({retained});await a.controller.initialize();assert.equal(a.controller.getSnapshot().blocked,true);assert.equal(await a.controller.save(request(),loaded()),false);await a.controller.sendExact();assert.equal(retained.rows.get(key(target)),raw);assert.equal(a.calls.length,0);
 }
});
test('new session and changed current game find old pending; recovery retains original source and request',async()=>{
 const a=setup();await a.controller.initialize();await a.controller.save(request(),loaded());const raw=a.retained.rows.get(key(target));
 const next={...target,sessionId:id(22),gameId:id(66),startId:id(55),startSourceDigest:'b'.repeat(64)};assert.equal(key(next),key(target));const b=setup({retained:a.retained,target:next,transport:{recover:async(t,r)=>{b.calls.push(['recover',t,r]);return{data:null,error:'operation_outcome_unknown'};}}});await b.controller.initialize();assert.equal(b.controller.getSnapshot().blocked,false);await b.controller.checkOutcome();assert.equal(b.calls[0][1].sessionId,next.sessionId);assert.equal(b.calls[0][1].gameId,target.gameId);assert.equal(b.calls[0][1].startSourceDigest,hash);assert.deepEqual(b.calls[0][2],request());assert.equal(b.retained.rows.get(key(target)),raw);
});
test('CAS prevents a second tab from replacing pending; read failure does not become empty',async()=>{
 const retained=memory(),a=setup({retained}),b=setup({retained});await a.controller.initialize();await b.controller.initialize();assert.equal(await a.controller.save(request(),loaded()),true);const other={...request(),operationId:id(77)};assert.equal(await b.controller.save(other,loaded()),false);assert.deepEqual(parse(retained.rows.get(key(target))).request,request());
 const failed=setup({retained:{read:async()=>{throw Error('denied');},transition:async()=>{throw Error('must not write');}}});await failed.controller.initialize();assert.equal(failed.controller.getSnapshot().blocked,true);assert.equal(await failed.controller.save(request(),loaded()),false);
});
test('accepted receipt alone, unavailable/redacted/stale or mismatched state never clears pending',async()=>{
 for(const value of [null,loaded(),{...loaded(),revision:1,entries:[],evidenceVisibility:'metadata-only'},{...loaded(),evidenceVisibility:'evidence',revision:1,entries:[{...receipt().entry,id:id(99)}]}]){
  const a=setup({transport:{state:async()=>({data:value,error:null})}});await a.controller.initialize();await a.controller.save(request(),loaded());await a.controller.sendExact();const raw=a.retained.rows.get(key(target));assert.equal(parse(raw).phase,'attempted');assert.deepEqual(parse(raw).request,request());assert.equal(a.retained.history.size,0);assert.ok(a.controller.getSnapshot().receipt);
 }
});
test('newer cross-tab pending survives a delayed accepted reply; disposed account cannot consume it',async()=>{
 let finish;const reply=new Promise(resolve=>finish=resolve),a=setup({transport:{write:async()=>reply}});await a.controller.initialize();await a.controller.save(request(),loaded());const flight=a.controller.sendExact();await new Promise(resolve=>setImmediate(resolve));const newer='newer-unknown-data';a.retained.rows.set(key(target),newer);finish({data:receipt(),error:null});await flight;assert.equal(a.retained.rows.get(key(target)),newer);assert.equal(a.retained.history.size,0);
 let done;const wait=new Promise(resolve=>done=resolve),b=setup({transport:{write:async()=>wait}});await b.controller.initialize();await b.controller.save(request(),loaded());const raw=b.retained.rows.get(key(target)),pending=b.controller.sendExact();await new Promise(resolve=>setImmediate(resolve));b.controller.dispose();assert.equal(b.controller.getSnapshot().pending,null);assert.equal(b.controller.getSnapshot().receipt,null);assert.equal(b.controller.getSnapshot().message,'');done({data:receipt(),error:null});await pending;assert.deepEqual(parse(b.retained.rows.get(key(target))).request,parse(raw).request);assert.equal(parse(b.retained.rows.get(key(target))).phase,'attempted');assert.equal(b.calls.length,0);assert.equal(b.controller.getSnapshot().pending,null);
});
test('Digital-only exact payload and loaded source checks reject foreign subject or rebased request',async()=>{
 const a=setup();await a.controller.initialize();for(const r of [{...request(),expectedRevision:1},{...request(),expectedHistoryDigest:'b'.repeat(64)},{...request(),payload:{...request().payload,participantId:id(99)}}])assert.equal(await a.controller.save(r,loaded()),false);
 assert.equal(parse(JSON.stringify({kind:'native-mixed-game-pending-v1',target,ownParticipantId:id(8),request:{...request(),action:'paper-review',payload:{captureId:id(80),artifactId:id(81),artifactDigest:hash,decision:'accepted-simulation-only',statement:'fictional-paper-review-v1'}}})),null);assert.equal(a.retained.rows.size,0);
});
test('durable attempted CAS permits only one competing send and prohibits repeats across reload',async()=>{
 const retained=memory();let sends=0;const write=async()=>{sends++;return{data:null,error:'operation_outcome_unknown'};};
 const a=setup({retained,transport:{write}});await a.controller.initialize();await a.controller.save(request(),loaded());
 const b=setup({retained,transport:{write}});await b.controller.initialize();await Promise.all([a.controller.sendExact(),b.controller.sendExact()]);assert.equal(sends,1);assert.equal(parse(retained.rows.get(key(target))).phase,'attempted');
 await a.controller.sendExact();await b.controller.sendExact();const c=setup({retained,transport:{write}});await c.controller.initialize();await c.controller.sendExact();assert.equal(sends,1);assert.deepEqual(parse(retained.rows.get(key(target))).request,request());
});
test('uncertain attempted-marker commit blocks dispatch and preserves recoverable request',async()=>{
 const retained=memory(),base=retained.transition;retained.transition=async(...args)=>{const result=await base(...args);if(args[2]&&parse(args[2])?.phase==='attempted')throw Error('lost storage completion');return result;};
 const a=setup({retained});await a.controller.initialize();await a.controller.save(request(),loaded());await a.controller.sendExact();assert.equal(a.calls.length,0);assert.equal(parse(retained.rows.get(key(target))).phase,'attempted');
 const b=setup({retained});await b.controller.initialize();await b.controller.sendExact();assert.equal(b.calls.length,0);await b.controller.checkOutcome();assert.deepEqual(b.calls.map(c=>c[0]),['recover','state']);
});

test('source_busy permits only explicit same-ID retry, survives reload, and clears only accepted exact evidence',async()=>{
 let sends=0;const write=async(t,r)=>{sends++;assert.deepEqual(r,request());return sends===1?{data:{status:'retry_exact',code:'source_busy'},error:null}:{data:receipt(r),error:null};};
 const a=setup({transport:{write}});await a.controller.initialize();await a.controller.save(request(),loaded());await a.controller.sendExact();
 assert.equal(sends,1);let p=parse(a.retained.rows.get(key(target)));assert.equal(p.phase,'retryable');assert.equal(p.attempt,1);assert.deepEqual(p.request,request());
 const b=setup({retained:a.retained,transport:{write}});await b.controller.initialize();assert.equal(sends,1);await b.controller.sendExact();assert.equal(sends,2);assert.equal(b.retained.rows.size,0);assert.equal(b.retained.history.size,1);
 const archived=JSON.parse([...b.retained.history.values()][0]);assert.equal(parse(archived.pending).attempt,2);
});
test('busy exact retry can recover a competing commit, while unknown retry cannot be sent again',async()=>{
 let sends=0;const a=setup({transport:{write:async()=>{sends++;return{data:{status:'retry_exact',code:'source_busy'},error:null};}}});await a.controller.initialize();await a.controller.save(request(),loaded());await a.controller.sendExact();
 await a.controller.checkOutcome();assert.equal(sends,1);assert.equal(a.retained.rows.size,0);
 const b=setup({transport:{write:async()=>({data:{status:'retry_exact',code:'source_busy'},error:null})}});await b.controller.initialize();await b.controller.save(request(),loaded());await b.controller.sendExact();
 const c=setup({retained:b.retained,transport:{write:async()=>{sends++;return{data:null,error:'operation_outcome_unknown'};},recover:async()=>({data:null,error:'operation_outcome_unknown'})}});await c.controller.initialize();await c.controller.sendExact();const raw=c.retained.rows.get(key(target));assert.equal(parse(raw).phase,'attempted');assert.equal(parse(raw).attempt,2);await c.controller.checkOutcome();await c.controller.sendExact();assert.equal(c.retained.rows.get(key(target)),raw);assert.equal(sends,2);
});
test('busy response cannot reset newer pending bytes or permit two concurrent retries',async()=>{
 let finish;const wait=new Promise(r=>finish=r),a=setup({transport:{write:async()=>wait}});await a.controller.initialize();await a.controller.save(request(),loaded());const flight=a.controller.sendExact();await new Promise(r=>setImmediate(r));
 const attempted=parse(a.retained.rows.get(key(target))),newer=JSON.stringify({...attempted,attempt:2});a.retained.rows.set(key(target),newer);finish({data:{status:'retry_exact',code:'source_busy'},error:null});await flight;assert.equal(a.retained.rows.get(key(target)),newer);assert.equal(a.controller.getSnapshot().blocked,true);
 let sends=0;const b=setup({transport:{write:async()=>({data:{status:'retry_exact',code:'source_busy'},error:null})}});await b.controller.initialize();await b.controller.save(request(),loaded());await b.controller.sendExact();
 const write=async()=>{sends++;return{data:null,error:'operation_outcome_unknown'};},c=setup({retained:b.retained,transport:{write}}),d=setup({retained:b.retained,transport:{write}});await c.controller.initialize();await d.controller.initialize();await Promise.all([c.controller.sendExact(),d.controller.sendExact()]);assert.equal(sends,1);assert.equal(parse(b.retained.rows.get(key(target))).attempt,2);
});
test('transport error or unrelated retry response never enables retry; malformed attempt remains preserved',async()=>{
 for(const reply of [{data:{status:'retry_exact',code:'source_busy'},error:'identity_changed'},{data:{status:'blocked',code:'source_busy'},error:null},{data:null,error:null}]){
  const a=setup({transport:{write:async()=>reply}});await a.controller.initialize();await a.controller.save(request(),loaded());await a.controller.sendExact();assert.equal(a.controller.getSnapshot().pending.phase,'attempted');
 }
 for(const attempt of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'1'])assert.equal(parse(JSON.stringify({kind:'native-mixed-game-pending-v1',phase:'retryable',attempt,target,ownParticipantId:id(8),request:request()})),null);
});

function closure(r=request()){return{kind:'native-mixed-game-closed-v1',status:'closed',code:'terminal_operation_closed',actorId:target.actorId,tournamentId:target.tournamentId,eventId:target.eventId,operationId:r.operationId,request:structuredClone(r),closureId:id(91),reason:'history_changed',simulationOnly:true,noWriteCommitted:true,...flags};}
test('explicit terminal resolution archives exact server closure without implying score verification',async()=>{
 let resolutions=0;const a=setup({transport:{write:async()=>({data:{status:'rejected',code:'history_changed'},error:null}),resolve:async(t,r)=>{resolutions++;assert.deepEqual(r,request());return{data:closure(r),error:null};}}});await a.controller.initialize();await a.controller.save(request(),loaded());await a.controller.resolveExact();assert.equal(resolutions,0);await a.controller.sendExact();await a.controller.resolveExact();assert.equal(resolutions,1);assert.equal(a.retained.rows.size,0);assert.equal(a.retained.history.size,1);assert.equal(a.controller.getSnapshot().receipt,null);assert.equal(a.calls.length,0);assert.equal(JSON.parse([...a.retained.history.values()][0]).closure.noWriteCommitted,true);
});
test('lost resolution reply remains pending and reload recovers exact immutable closure',async()=>{
 const a=setup({transport:{write:async()=>({data:null,error:'operation_outcome_unknown'}),resolve:async()=>({data:null,error:'operation_outcome_unknown'})}});await a.controller.initialize();await a.controller.save(request(),loaded());await a.controller.sendExact();const raw=a.retained.rows.get(key(target));await a.controller.resolveExact();assert.equal(a.retained.rows.get(key(target)),raw);
 const b=setup({retained:a.retained,transport:{recover:async()=>({data:closure(),error:null})}});await b.controller.initialize();await b.controller.checkOutcome();assert.equal(b.retained.rows.size,0);assert.equal(b.calls.length,0);
});
test('foreign closure, missing proof, provider failure or changed pending cannot clear',async()=>{
 for(const value of [{...closure(),actorId:id(99)},{...closure(),noWriteCommitted:false},{...closure(),request:{...request(),operationId:id(99)}},{status:'blocked',code:'resolution_not_terminal'},null]){
  const a=setup({transport:{write:async()=>({data:null,error:'operation_outcome_unknown'}),resolve:async()=>({data:value,error:null})}});await a.controller.initialize();await a.controller.save(request(),loaded());await a.controller.sendExact();const raw=a.retained.rows.get(key(target));await a.controller.resolveExact();assert.equal(a.retained.rows.get(key(target)),raw);assert.equal(a.retained.history.size,0);
 }
 let finish;const wait=new Promise(r=>finish=r),a=setup({transport:{write:async()=>({data:null,error:'operation_outcome_unknown'}),resolve:async()=>wait}});await a.controller.initialize();await a.controller.save(request(),loaded());await a.controller.sendExact();const flight=a.controller.resolveExact();await new Promise(r=>setImmediate(r));a.retained.rows.set(key(target),'newer');finish({data:closure(),error:null});await flight;assert.equal(a.retained.rows.get(key(target)),'newer');assert.equal(a.retained.history.size,0);
});

test('upcoming Digital game cannot create local pending work, including offline',async()=>{const a=setup();await a.controller.initialize();a.setOnline(false);assert.equal(await a.controller.save(request(),{...loaded(),playOrder:'upcoming'}),false);assert.equal(a.retained.rows.size,0);assert.equal(a.calls.length,0);});
