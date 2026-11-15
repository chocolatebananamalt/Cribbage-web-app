import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{readPlayoffReopenWorkspaceV1 as workspace,buildPlayoffReopenRequestV1 as request,readPlayoffReopenReceiptV1 as receipt}from'../src/lib/playoffs/native-mixed-playoff-reopen-v1.ts';
import{PlayoffReopenPendingV1 as Controller,playoffReopenPendingKeyV1 as key}from'../src/lib/playoffs/native-mixed-playoff-reopen-pending-v1.ts';
import{createPlayoffReopenTransportV1 as transport}from'../src/lib/api/native-mixed-playoff-reopen-transport-v1.ts';
const id=n=>`aaaa0000-0000-4000-8000-${String(n).padStart(12,'0')}`,h=n=>String(n).repeat(64),flags={simulationOnly:true,ordinaryQualificationRecorded:false,mrpAwarded:false,moneyMoved:false};
const target=()=>({actorId:id(1),sessionId:id(2),projectUrl:'https://test.supabase.co',projectRef:'test',tournamentId:id(3),eventId:id(4),contextId:id(5),slot:3,gameNumber:2});
function dto(t=target()){return{kind:'native-mixed-playoff-reopen-workspace-v1',actorId:t.actorId,sessionId:t.sessionId,tournamentId:t.tournamentId,eventId:t.eventId,contextId:t.contextId,slot:t.slot,gameNumber:t.gameNumber,sourceDigest:h(1),matchDigest:h(2),revision:2,historyDigest:h(3),sideA:{participantId:id(6),tournamentIdNumber:'A-1',displayName:'Fictional A',mode:'digital'},sideB:{participantId:id(7),tournamentIdNumber:'B-1',displayName:'Fictional B',mode:'digital'},entries:[{id:id(8),type:'digital-submit',participantId:id(6),winnerParticipantId:id(6)},{id:id(9),type:'digital-submit',participantId:id(7),winnerParticipantId:id(7)}],policy:{version:1,requiredApprovals:0,reasonRequired:true,digest:h(4)},canPropose:true,blockedCode:null,...flags};}
function accepted(t,op,r){return{kind:'native-mixed-playoff-reopen-receipt-v1',status:'accepted',actorId:t.actorId,sessionId:t.sessionId,tournamentId:t.tournamentId,eventId:t.eventId,operationId:op,request:r,reopenId:id(10),priorRevision:r.expectedRevision,priorHistoryDigest:r.expectedHistoryDigest,revision:0,historyDigest:h(5),code:'game_reopened',historicalReceipt:false,currentSourceVerified:false,...flags};}
test('dedicated workspace binds context, slot, game and saved policy; missing policy never defaults',()=>{
 const t=target(),w=dto();assert(workspace(w,t));const q=request(w,'  Correct conflicting simulation records  ');assert.equal(q.reason,'Correct conflicting simulation records');assert.equal(q.contextId,t.contextId);assert(!Object.hasOwn(q,'gameId'));assert(!Object.hasOwn(q,'startId'));
 for(const change of[w=>w.slot=2,w=>w.contextId=id(99),w=>w.entries[0].profileId=id(99),w=>w.entries[0].winnerParticipantId=id(99),w=>w.revision=3,w=>w.sideB.tournamentIdNumber=w.sideA.tournamentIdNumber,w=>w.policy=null,w=>w.policy.requiredApprovals=1,w=>w.policy.version=-1]){const w=dto();change(w);assert.equal(workspace(w,t),null);}
 const absent=dto();absent.policy=null;absent.canPropose=false;absent.blockedCode='policy_unavailable';assert(workspace(absent,t));assert.equal(request(absent,'reason'),null);
 // An actual stored version-zero row is valid legacy data; absence is different.
 const zero=dto();zero.policy.version=0;assert(workspace(zero,t));assert(request(zero,'Review actual stored policy'));
 for(const reason of['','  ','bad\nreason','\u0000','x'.repeat(501),null])assert.equal(request(dto(),reason),null);
 let touched=0;const bad=dto();Object.defineProperty(bad,'entries',{enumerable:true,get(){touched++;return[];}});assert.equal(workspace(bad,t),null);assert.equal(touched,0);
});
test('receipts exactly bind original request and cannot establish current state',()=>{
 const t=target(),q=request(dto(),'Mismatch'),op=id(11),r=accepted(t,op,q);assert(receipt(r,t,op,q));
 for(const mutate of[r=>r.request.reason='Other',r=>r.actorId=id(99),r=>r.historyDigest=q.expectedHistoryDigest,r=>r.currentSourceVerified=true,r=>r.moneyMoved=true,r=>r.extra=true,r=>r.revision=1]){const x=structuredClone(r);mutate(x);assert.equal(receipt(x,t,op,q),null);}
 const rejected={...r,status:'rejected',reopenId:null,revision:null,historyDigest:null,code:'policy_changed'};assert(receipt(rejected,t,op,q));assert.equal(receipt({...rejected,code:'arbitrary'},t,op,q),null);
});
function fixture(){const t=target(),s={on:true,online:true,raw:null,archives:[],writes:[],recoveries:0,reply:null,failArchive:false,before:null};const retained={read:async()=>s.raw,transition:async(_k,expected,next,archive,signal)=>{await s.before?.();if(signal?.aborted||s.raw!==expected||archive&&s.failArchive)return false;if(archive)s.archives.push(archive);s.raw=next;return true;}};
 const runtime={target:t,retained,enabled:()=>s.on,online:()=>s.online,read:async()=>dto(t),write:async(op,q)=>{s.writes.push({op,q});return s.reply??accepted(t,op,q);},recover:async(op,q)=>{s.recoveries++;return s.reply??{...accepted(t,op,q),historicalReceipt:true};}};return{t,s,runtime,c:new Controller(runtime)};}
test('save before dispatch; lost/ambiguous outcomes retain exact bytes; read-only recovery archives full receipt atomically',async()=>{
 const x=fixture();await x.c.initialize();await x.c.refresh();assert(await x.c.stage(id(11),'Review mismatch'));const raw=x.s.raw;assert.equal(x.s.writes.length,0);x.s.reply={status:'retry_exact',code:'source_busy'};await x.c.submitExact();assert.equal(x.s.raw,raw);assert.equal(x.s.archives.length,0);x.s.reply=null;await x.c.checkOutcome();assert.equal(x.s.writes.length,1);assert.equal(x.s.recoveries,1);assert.equal(x.s.raw,null);const a=JSON.parse(x.s.archives[0].raw);assert.equal(a.retainedRaw,raw);assert.equal(a.receipt.currentSourceVerified,false);assert.equal(x.c.getSnapshot().workspace,null);
});
test('unknown/session-switched pending work blocks replacements; exact retry and archive races preserve newer work',async()=>{
 const x=fixture();await x.c.initialize();await x.c.refresh();await x.c.stage(id(11),'Review');const old=x.s.raw,reloaded=new Controller({...x.runtime,target:{...x.t,sessionId:id(90)}});await reloaded.initialize();assert.equal(reloaded.getSnapshot().blocked,true);await reloaded.submitExact();assert.equal(x.s.writes.length,0);assert.equal(x.s.raw,old);
 x.s.failArchive=true;await x.c.submitExact();assert.equal(x.s.raw,old);assert.equal(x.s.archives.length,0);x.s.failArchive=false;x.s.before=()=>{x.s.raw='newer';};await x.c.checkOutcome();assert.equal(x.s.raw,'newer');assert.equal(x.s.archives.length,0);
 assert.equal(key(x.t),key({...x.t,sessionId:id(99),contextId:id(99),slot:1,gameNumber:1}));
});
test('disabled/offline/disposed controller never dispatches and pending snapshots detach',async()=>{
 const x=fixture();x.s.on=false;await x.c.initialize();assert.equal(x.c.getSnapshot().initialized,false);x.s.on=true;await x.c.initialize();await x.c.refresh();await x.c.stage(id(11),'Reason');const raw=x.s.raw,snap=x.c.getSnapshot();snap.pending.request.reason='Mutated';x.s.online=false;await x.c.submitExact();assert.equal(x.s.writes.length,0);x.s.online=true;x.c.dispose();await x.c.submitExact();assert.equal(x.s.raw,raw);assert.equal(x.s.writes.length,0);
});
test('transport uses dedicated normal-auth RPCs, immutable request and identity before/after; no caller actor parameter',async()=>{
 const t=target(),calls=[],s={on:true,session:t.sessionId,reply:dto(),after:null};const client={auth:{getUser:async()=>({data:{user:{id:t.actorId}},error:null}),getClaims:async()=>({data:{claims:{sub:t.actorId,session_id:s.session,iss:t.projectUrl+'/auth/v1',exp:4102444800}},error:null})},rpc:async(name,args)=>{calls.push({name,args});s.after?.();return{data:s.reply,error:null};}};
 const tr=transport({client,target:t,enabled:()=>s.on,now:()=>1});assert(await tr.read());assert.deepEqual(calls[0],{name:'get_native_mixed_playoff_reopen_workspace_v1',args:{p_tournament_id:t.tournamentId,p_event_id:t.eventId,p_context_id:t.contextId,p_slot:t.slot,p_game_number:t.gameNumber}});assert(!Object.hasOwn(calls[0].args,'p_actor_id'));
 const q=request(dto(),'Review'),op=id(11);s.reply=accepted(t,op,q);assert(await tr.write(op,q));assert.deepEqual(calls[1],{name:'record_native_mixed_playoff_reopen_v1',args:{p_tournament_id:t.tournamentId,p_event_id:t.eventId,p_operation_id:op,p_request:q}});s.reply={...s.reply,historicalReceipt:true};assert(await tr.recover(op,q));assert.deepEqual(calls[2],{name:'reconcile_native_mixed_playoff_reopen_v1',args:{p_tournament_id:t.tournamentId,p_event_id:t.eventId,p_operation_id:op,p_request:q}});s.after=()=>s.session=id(99);assert.equal(await tr.write(op,q),null);s.on=false;const count=calls.length;assert.equal(await tr.read(),null);assert.equal(calls.length,count);
});

test('all dedicated PUBLIC RPC argument names match only the closed private proposal',()=>{
 const sql=fs.readFileSync('database/proposals/native-mixed-playoff-reopen-v1.sql','utf8');
 for(const[name,wanted]of Object.entries({get_native_mixed_playoff_reopen_workspace_v1:['p_tournament_id','p_event_id','p_context_id','p_slot','p_game_number'],record_native_mixed_playoff_reopen_v1:['p_tournament_id','p_event_id','p_operation_id','p_request'],reconcile_native_mixed_playoff_reopen_v1:['p_tournament_id','p_event_id','p_operation_id','p_request'],get_native_mixed_playoff_own_operation_v1:['p_tournament_id','p_event_id','p_operation_id','p_request'],close_native_mixed_playoff_own_operation_v1:['p_tournament_id','p_event_id','p_operation_id','p_request']})){
  const m=sql.match(new RegExp('create function public\\.'+name+'\\(([^)]*)\\)'));assert(m,name);assert.deepEqual(m[1].split(',').map(p=>p.trim().split(/\s+/)[0]),wanted);assert(sql.includes('revoke all on function public.'+name+'('));
 }
 assert(!/grant\s+execute/i.test(sql));
});




