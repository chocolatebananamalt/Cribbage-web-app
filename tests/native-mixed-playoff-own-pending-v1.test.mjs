import test from'node:test';import assert from'node:assert/strict';
import{NativeMixedPlayoffOwnPendingV1 as Controller,nativeMixedPlayoffOwnPendingKeyV1 as key}from'../src/lib/playoffs/native-mixed-playoff-own-pending-v1.ts';
import{createNativeMixedPlayoffOwnTransportV1 as transport}from'../src/lib/api/native-mixed-playoff-own-transport-v1.ts';
import{buildNativeMixedPlayoffOwnCommandV1 as command}from'../src/lib/playoffs/native-mixed-playoff-own-view-v1.ts';
const id=n=>`aaaa0000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash='a'.repeat(64);
const target=()=>({actorId:id(1),sessionId:id(2),projectUrl:'https://test.supabase.co',projectRef:'test',ownScope:{tournamentId:id(3),eventId:id(4),participantId:id(5),tournamentIdNumber:'A-10'}});
function state(){const own={participantId:id(5),tournamentIdNumber:'A-10'};return{status:'simulated_playoff_own_available',contextId:id(6),sourceDigest:hash,own,matches:[{slot:3,matchDigest:hash,format:{winsRequired:2,maximumGames:3},own,opponent:{participantId:id(7),tournamentIdNumber:'A-4',mode:'digital',displayName:'Fictional Opponent'},complete:false,winnerParticipantId:null,nextGame:{gameNumber:1,expectedRevision:0,expectedHistoryDigest:hash},games:[],ownWins:0,opponentWins:0}],complete:false,eliminated:false,awaitingOpponent:false,ownFinishingGroup:null,tournamentId:id(3),eventId:id(4),simulationOnly:true,ordinaryQualificationRecorded:false,mrpAwarded:false,moneyMoved:false};}
const defer=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
function fixture(){
 const t=target(),s={enabled:true,online:true,session:t.sessionId,raw:new Map(),archives:new Map(),reads:0,transitions:[],writes:[],providerReads:0,source:state(),failRead:false,failTransition:false,failArchive:false,readError:false,lostAck:false,reject:null,receipt:null,beforeCAS:null,beforeWrite:null,beforeRead:null};
 const retained={read:async k=>{s.reads++;if(s.failRead)throw Error('read');return s.raw.get(k)??null;},transition:async(k,expected,next,archive,signal)=>{s.transitions.push({k,expected,next,archive});if(s.failTransition||archive&&s.failArchive)throw Error('transition');await s.beforeCAS?.({k,expected,next,archive,signal});if(signal?.aborted||(s.raw.get(k)??null)!==expected)return false;if(archive){if(s.archives.has(archive.id)&&s.archives.get(archive.id)!==archive.raw)throw Error('archive conflict');s.archives.set(archive.id,archive.raw);}if(next===null)s.raw.delete(k);else s.raw.set(k,next);return true;}};
 const client={auth:{getUser:async()=>({data:{user:{id:t.actorId}},error:null}),getClaims:async()=>({data:{claims:{sub:t.actorId,session_id:s.session,exp:4102444800}},error:null})},rpc:async(name,args)=>{
  if(name==='get_native_mixed_playoff_own_v1'){s.providerReads++;await s.beforeRead?.();return{data:structuredClone(s.source),error:s.readError?{}:null};}
  s.writes.push(structuredClone(args));await s.beforeWrite?.();if(s.reject)return{data:structuredClone(s.reject),error:null};
  const r=args.p_request,e=r.data.entry;
  if(!s.receipt){const entry={id:id(20),...structuredClone(e)};delete entry.statement;const m=s.source.matches[0],entries=m.games[0]?.entries??[];entries.push(entry);m.games=[{gameNumber:r.data.gameNumber,complete:false,winnerParticipantId:e.winnerParticipantId,revision:r.data.expectedRevision+1,historyDigest:'b'.repeat(64),counterEvidenceAvailable:true,entries}];m.nextGame.expectedRevision=r.data.expectedRevision+1;m.nextGame.expectedHistoryDigest='b'.repeat(64);
   s.receipt={status:'simulated_playoff_evidence_recorded',contextId:r.data.contextId,slot:r.data.slot,gameNumber:r.data.gameNumber,entryId:id(20),revision:r.data.expectedRevision+1,historyDigest:'b'.repeat(64),sourceDigest:r.expectedSourceDigest,matchDigest:r.data.expectedMatchDigest,gameComplete:false,matchComplete:false,winnerId:null,simulationOnly:true,ordinaryQualificationRecorded:false,mrpAwarded:false,moneyMoved:false};
  }else s.receipt={...s.receipt,historicalReceipt:true,currentSourceVerified:false};
  return{data:structuredClone(s.receipt),error:s.lostAck?{}:null};
 }};
 const tr=transport({authenticated:client,projectUrl:t.projectUrl,projectRef:t.projectRef,target:t,enabled:()=>s.enabled,now:()=>1}),options={target:t,retained,transport:tr,enabled:()=>s.enabled,online:()=>s.online},c=new Controller(options),loaded=state();
 const p=tr.prepare(id(10),command(loaded,t.ownScope,'own'));return{s,t,retained,tr,options,c,p,loaded};
}
test('default disabled controller opens no storage/provider; recovery key finds earlier session/context/participant work',async()=>{
 const x=fixture(),c=new Controller({...x.options,enabled:undefined});await c.initialize();assert.equal(x.s.reads,0);assert.equal(x.s.writes.length,0);
 assert.equal(key(x.t),key({...x.t,sessionId:id(99),ownScope:{...x.t.ownScope,participantId:id(99),tournamentIdNumber:'A-99'}}));assert.notEqual(key(x.t),key({...x.t,actorId:id(99)}));assert.notEqual(key(x.t),key({...x.t,projectUrl:'https://other.test'}));
});
test('stage CAS stores original exact raw before any send and rejects stale loaded source',async()=>{
 const x=fixture();await x.c.initialize();const bad=state();bad.sourceDigest='f'.repeat(64);assert.equal(await x.c.stage(x.p,bad),false);assert.equal(x.s.transitions.length,0);
 assert.equal(await x.c.stage(x.p,x.loaded),true);assert.equal(x.s.raw.get(key(x.t)),x.p.retainedRaw);assert.equal(x.s.writes.length,0);assert.equal(x.c.getSnapshot().phase,'staged');assert.equal(await x.c.stage(x.p,x.loaded),false);
});
test('lost ACK keeps bytes; explicit exact retry recovers receipt and atomically archives full proof before clearing',async()=>{
 const x=fixture();await x.c.initialize();await x.c.stage(x.p,x.loaded);x.s.lostAck=true;await x.c.sendExact();assert.equal(x.s.raw.get(key(x.t)),x.p.retainedRaw);assert.equal(x.s.archives.size,0);assert.equal(x.c.getSnapshot().phase,'attempted');
 await x.c.sendExact();assert.equal(x.s.writes.length,1);x.s.lostAck=false;await x.c.retryExact();assert.equal(x.s.writes.length,2);assert.deepEqual(x.s.writes[0],x.s.writes[1]);assert.equal(x.s.raw.has(key(x.t)),false);assert.equal(x.s.archives.size,1);
 const a=JSON.parse([...x.s.archives.values()][0]);assert.equal(a.retainedRaw,x.p.retainedRaw);assert.equal(a.prepared.operationId,x.p.operationId);assert.equal(a.receipt.entryId,id(20));assert.equal(a.proof.matches[0].games[0].entries[0].id,id(20));assert.equal(x.c.getSnapshot().state.status,'simulated_playoff_own_available');
});
test('accepted ACK followed by read failure retains bytes and receipt; checkFresh never resends',async()=>{
 const x=fixture();await x.c.initialize();await x.c.stage(x.p,x.loaded);x.s.readError=true;await x.c.sendExact();assert.equal(x.c.getSnapshot().phase,'acknowledged');assert.equal(x.s.raw.get(key(x.t)),x.p.retainedRaw);assert.equal(x.s.archives.size,0);
 x.s.readError=false;await x.c.checkFresh();assert.equal(x.s.writes.length,1);assert.equal(x.s.raw.has(key(x.t)),false);assert.equal(x.s.archives.size,1);
});
test('same source/context/match/game plus exact ACK entry identity, placement and own payload are required',async()=>{
 for(const mutate of[s=>s.source.sourceDigest='f'.repeat(64),s=>s.source.contextId=id(99),s=>s.source.matches[0].matchDigest='f'.repeat(64),s=>s.source.matches[0].games[0].entries[0].winnerParticipantId=id(7),s=>s.source.matches[0].games[0].entries[0].id=id(99)]){
  const x=fixture();await x.c.initialize();await x.c.stage(x.p,x.loaded);x.s.beforeRead=()=>mutate(x.s);await x.c.sendExact();assert.equal(x.s.raw.get(key(x.t)),x.p.retainedRaw);assert.equal(x.s.archives.size,0);assert.equal(x.c.getSnapshot().phase,'acknowledged');
 }
});
test('stage storage failure/readback uncertainty cannot send; archived-write failure cannot clear',async()=>{
 const fail=fixture();await fail.c.initialize();fail.s.failTransition=true;assert.equal(await fail.c.stage(fail.p,fail.loaded),false);await fail.c.sendExact();assert.equal(fail.s.writes.length,0);
 const uncertain=fixture();await uncertain.c.initialize();uncertain.s.beforeCAS=()=>uncertain.s.failRead=true;assert.equal(await uncertain.c.stage(uncertain.p,uncertain.loaded),false);assert.equal(uncertain.s.raw.get(key(uncertain.t)),uncertain.p.retainedRaw);assert.equal(uncertain.s.writes.length,0);
 const archive=fixture();await archive.c.initialize();await archive.c.stage(archive.p,archive.loaded);archive.s.failArchive=true;await archive.c.sendExact();assert.equal(archive.s.raw.get(key(archive.t)),archive.p.retainedRaw);assert.equal(archive.s.archives.size,0);archive.s.failArchive=false;await archive.c.checkFresh();assert.equal(archive.s.writes.length,1);assert.equal(archive.s.archives.size,1);
});
test('a newer pending CAS wins stage/archive races and is never cleared or overwritten',async()=>{
 const stage=fixture();await stage.c.initialize();stage.s.beforeCAS=({k,next,archive})=>{if(next!==null&&!archive)stage.s.raw.set(k,'foreign/newer');};assert.equal(await stage.c.stage(stage.p,stage.loaded),false);assert.equal(stage.s.raw.get(key(stage.t)),'foreign/newer');assert.equal(stage.s.writes.length,0);
 const end=fixture();await end.c.initialize();await end.c.stage(end.p,end.loaded);end.s.beforeCAS=({k,archive})=>{if(archive)end.s.raw.set(k,'newer pending');};await end.c.sendExact();assert.equal(end.s.raw.get(key(end.t)),'newer pending');assert.equal(end.s.archives.size,0);assert.equal(end.c.getSnapshot().blocked,true);
});
test('unknown/foreign/old-session work is found, preserved and blocked without provider calls',async()=>{
 for(const raw of['unknown',JSON.stringify({...JSON.parse(fixture().p.retainedRaw),version:'future'}),(()=>{const x=fixture(),p=JSON.parse(x.p.retainedRaw);p.target.actorId=id(99);return JSON.stringify(p);})(),(()=>{const x=fixture(),p=JSON.parse(x.p.retainedRaw);p.target.sessionId=id(99);return JSON.stringify(p);})()]){
  const x=fixture();x.s.raw.set(key(x.t),raw);await x.c.initialize();assert.equal(x.c.getSnapshot().blocked,true);await x.c.retryExact();assert.equal(x.s.raw.get(key(x.t)),raw);assert.equal(x.s.writes.length,0);assert.equal(x.s.providerReads,0);
 }
});
test('reload cannot assume unsent; fresh read without receipt never clears, exact retry remains explicit',async()=>{
 const x=fixture();x.s.raw.set(key(x.t),x.p.retainedRaw);await x.c.initialize();assert.equal(x.c.getSnapshot().phase,'recovery');await x.c.sendExact();await x.c.checkFresh();assert.equal(x.s.writes.length,0);assert.equal(x.s.providerReads,0);assert.equal(x.s.raw.get(key(x.t)),x.p.retainedRaw);await x.c.retryExact();assert.equal(x.s.writes.length,1);assert.equal(x.s.archives.size,1);
});
test('dispose/gate/identity changes during async work preserve pending and prevent late archive mutation',async()=>{
 for(const mode of['dispose','gate','identity']){const x=fixture();await x.c.initialize();await x.c.stage(x.p,x.loaded);const d=defer();x.s.beforeWrite=()=>d.promise;const action=x.c.sendExact();await new Promise(r=>setTimeout(r,0));if(mode==='dispose')x.c.dispose();if(mode==='gate')x.s.enabled=false;if(mode==='identity')x.s.session=id(99);d.resolve();await action;assert.equal(x.s.raw.get(key(x.t)),x.p.retainedRaw);assert.equal(x.s.archives.size,0);}
});
test('one active controller flight prevents duplicate dispatch and keeps snapshots detached',async()=>{
 const x=fixture();await x.c.initialize();await x.c.stage(x.p,x.loaded);const d=defer();x.s.beforeWrite=()=>d.promise;const first=x.c.sendExact();await new Promise(r=>setTimeout(r,0));await x.c.retryExact();assert.equal(x.s.writes.length,1);const snapshot=x.c.getSnapshot();snapshot.pending.request.data.expectedRevision=5;assert.equal(x.c.getSnapshot().pending.request.data.expectedRevision,0);d.resolve();await first;assert.equal(x.s.archives.size,1);
});
test('decoded rejection hold retains original exact bytes and remains blocked after full controller reload',async()=>{
 const x=fixture();await x.c.initialize();await x.c.stage(x.p,x.loaded);x.s.reject={status:'rejected',code:'evidence_mismatch'};await x.c.sendExact();assert.equal(x.c.getSnapshot().blocked,true);assert.equal(x.c.getSnapshot().phase,'rejected');const held=JSON.parse(x.s.raw.get(key(x.t)));assert.equal(held.version,'native-mixed-playoff-rejection-hold-v1');assert.equal(held.retainedRaw,x.p.retainedRaw);assert.deepEqual(held.rejection,x.s.reject);assert.equal(x.s.archives.size,0);
 const reloaded=new Controller(x.options);await reloaded.initialize();assert.equal(reloaded.getSnapshot().blocked,true);assert.equal(reloaded.getSnapshot().phase,'rejected');await reloaded.retryExact();await reloaded.checkFresh();assert.equal(x.s.writes.length,1);assert.equal(JSON.parse(x.s.raw.get(key(x.t))).retainedRaw,x.p.retainedRaw);
});
test('failed rejection-hold CAS preserves original raw/current block and makes no durable-hold claim',async()=>{
 const x=fixture();await x.c.initialize();await x.c.stage(x.p,x.loaded);x.s.reject={status:'rejected',code:'source_changed'};x.s.beforeCAS=({next})=>{if(next&&JSON.parse(next).version==='native-mixed-playoff-rejection-hold-v1')throw Error('Storage failed');};await x.c.sendExact();assert.equal(x.s.raw.get(key(x.t)),x.p.retainedRaw);assert.equal(x.c.getSnapshot().blocked,true);assert.match(x.c.getSnapshot().message,/durable local hold could not be confirmed/);await x.c.retryExact();assert.equal(x.s.writes.length,1);assert.equal(x.s.archives.size,0);
});
test('retry_exact/source_busy preserves original bytes without a rejection hold or automatic resend',async()=>{
 const x=fixture();await x.c.initialize();await x.c.stage(x.p,x.loaded);x.s.reject={status:'retry_exact',code:'source_busy'};await x.c.sendExact();assert.equal(x.s.raw.get(key(x.t)),x.p.retainedRaw);assert.equal(x.c.getSnapshot().blocked,false);assert.equal(x.s.writes.length,1);await x.c.sendExact();assert.equal(x.s.writes.length,1);
});
test('confirmation ACK clears only for exact own submission/winner/confirmation references in refreshed evidence',async()=>{
 for(const wrong of[false,true]){const x=fixture(),m=x.loaded.matches[0],entries=[{id:id(30),type:'digital-submit',participantId:id(5),winnerParticipantId:id(5)},{id:id(31),type:'digital-submit',participantId:id(7),winnerParticipantId:id(5)}];m.games=[{gameNumber:1,complete:false,winnerParticipantId:id(5),revision:2,historyDigest:hash,counterEvidenceAvailable:true,entries}];m.nextGame.expectedRevision=2;x.s.source=structuredClone(x.loaded);const p=x.tr.prepare(id(11),command(x.loaded,x.t.ownScope,'confirm'));assert(p);await x.c.initialize();assert.equal(await x.c.stage(p,x.loaded),true);if(wrong)x.s.beforeRead=()=>x.s.source.matches[0].games[0].entries[2].evidenceIds.reverse();await x.c.sendExact();assert.equal(x.s.archives.size,wrong?0:1);assert.equal(x.s.raw.has(key(x.t)),wrong);}
});
test('aborting an in-progress archive transition cannot clear pending or commit a history record',async()=>{
 const x=fixture();await x.c.initialize();await x.c.stage(x.p,x.loaded);const entered=defer(),release=defer();x.s.beforeCAS=async({archive})=>{if(archive){entered.resolve();await release.promise;}};
 const send=x.c.sendExact();await entered.promise;x.c.dispose();release.resolve();await send;assert.equal(x.s.raw.get(key(x.t)),x.p.retainedRaw);assert.equal(x.s.archives.size,0);
});
