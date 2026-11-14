import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readNativeMixedGameClosedV1 as closedReceipt,isNativeMixedGameWriteRequestV1 as valid,readNativeMixedGameWriteReceiptV1 as receipt,readNativeMixedGameStateV1 as state} from '../src/lib/seating/native-mixed-game-evidence-v1.ts';
import {createNativeMixedGameEvidenceTransportV1 as transport} from '../src/lib/api/native-mixed-game-evidence-transport-v1.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash='a'.repeat(64);
const target={actorId:id(1),sessionId:id(2),projectUrl:'https://example.supabase.co',projectRef:'example',tournamentId:id(3),eventId:id(4),startId:id(5),gameId:id(6),startSourceDigest:hash};
const flags=Object.fromEntries(['ordinaryScoreWritten','normalStartAuthorized','scoringAuthorized','officialResultVerified','humanPlayVerified','moneyMoved','payoutAuthorized'].map(k=>[k,false]));
const payloads={
 'digital-submit':{participantId:id(7),result:{winnerSide:'a',margin:40},statement:'simulation-own-result-v1'},
 'digital-confirm':{participantId:id(7),result:{winnerSide:'a',margin:40},references:[id(8),id(9)],statement:'simulation-own-confirmation-v1'},
 'paper-capture':{artifactId:id(10),claims:[{side:'a',result:{winnerSide:'b',margin:1}}],physicalOriginal:false,fictionalOpponentPlayed:false,independentHumanPlayClaimed:false,statement:'fictional-paper-capture-v1'},
 'paper-review':{captureId:id(8),artifactId:id(10),artifactDigest:hash,reenteredClaims:[{side:'a',result:{winnerSide:'b',margin:1}}],decision:'accepted-simulation-only',statement:'fictional-paper-review-v1'},
};
const request=(action='digital-submit')=>({kind:'native-mixed-simulation-game-write-v1',operationId:id(11),startId:target.startId,gameId:target.gameId,expectedStartSourceDigest:hash,expectedRevision:0,expectedHistoryDigest:hash,action,payload:structuredClone(payloads[action])});
function accepted(r=request()) {return {kind:'native-mixed-simulation-game-write-receipt-v1',status:'accepted',code:'simulation_evidence_recorded',actorId:target.actorId,tournamentId:target.tournamentId,eventId:target.eventId,operationId:r.operationId,request:structuredClone(r),entry:{id:id(12),operationId:r.operationId,receiptId:id(13),payloadDigest:hash,sequence:1,actorId:target.actorId,tournamentId:target.tournamentId,eventId:target.eventId,startId:target.startId,gameId:target.gameId,startSourceDigest:hash,action:r.action,...structuredClone(r.payload),...(r.action==='paper-capture'?{artifactDigest:hash}:{})},revision:1,historyDigest:hash,simulationOnly:true,historicalReceipt:false,currentSourceVerified:true,...flags};}
function client(rpc) {return {auth:{getUser:async()=>({data:{user:{id:target.actorId}},error:null}),getClaims:async()=>({data:{claims:{sub:target.actorId,session_id:target.sessionId,exp:9999999999}},error:null})},rpc};}
const options=c=>({authenticated:c,projectUrl:target.projectUrl,projectRef:target.projectRef,enabled:()=>true,recoveryEnabled:()=>true});
test('four strict action contracts reject unknown/missing keys and false attestation changes',()=>{
 for(const action of Object.keys(payloads)){const r=request(action);assert.equal(valid(r),true);for(const k of Object.keys(r.payload)){const bad=structuredClone(r);delete bad.payload[k];assert.equal(valid(bad),false);}assert.equal(valid({...r,actorId:target.actorId}),false);assert.equal(valid({...r,payload:{...r.payload,extra:true}}),false);}
 for(const margin of [0,122,1.5,null,'40']){const r=request();r.payload.result.margin=margin;assert.equal(valid(r),false);}
 const paper=request('paper-capture');paper.payload.physicalOriginal=true;assert.equal(valid(paper),false);
 const confirm=request('digital-confirm');confirm.payload.references=[id(8),id(8)];assert.equal(valid(confirm),false);
 for(const revision of [-1,4,null,'0'])assert.equal(valid({...request(),expectedRevision:revision}),false);
});
test('receipt binds scope, exact request, server artifact digest and non-authority flags',()=>{
 for(const action of Object.keys(payloads)){const r=request(action),v=accepted(r);assert.ok(receipt(v,target,r));assert.equal(receipt({...v,moneyMoved:true},target,r),null);assert.equal(receipt({...v,actorId:id(99)},target,r),null);assert.equal(receipt(v,target,{...r,expectedHistoryDigest:'b'.repeat(64)}),null);}
 const r=request(),v=accepted(r);assert.equal(receipt(v,target,r,true),null);assert.ok(receipt({...v,historicalReceipt:true,currentSourceVerified:false},target,r,true));
});
test('known empty state is distinct from unavailable; entries must be contiguous and unique',()=>{
 const v={kind:'native-mixed-simulation-game-state-v1',playOrder:'current',actorId:target.actorId,tournamentId:target.tournamentId,eventId:target.eventId,startId:target.startId,gameId:target.gameId,startSourceDigest:hash,revision:0,historyDigest:hash,evidenceVisibility:'evidence',entries:[],currentSourceVerified:true,simulationOnly:true,...flags};
 assert.ok(state(v,target));assert.equal(state(null,target),null);assert.equal(state({...v,revision:1},target),null);
 const e=accepted().entry;assert.ok(state({...v,entries:[e],revision:1},target));assert.equal(state({...v,entries:[e,{...e,sequence:2}],revision:2},target),null);
 assert.ok(state({...v,evidenceVisibility:'metadata-only',revision:2},target));assert.equal(state({...v,evidenceVisibility:'metadata-only',revision:1,entries:[e]},target),null);
});
test('default-off and identity/project mismatch never dispatch',async()=>{
 let calls=0;const c=client(async()=>{calls++;return{data:null,error:null};});assert.equal((await transport({...options(c),enabled:undefined}).write(target,request())).error,'disabled');
 assert.equal((await transport(options(c)).write({...target,sessionId:id(99)},request())).error,'identity_changed');
 assert.equal((await transport(options(c)).write({...target,projectRef:'other'},request())).error,'invalid_target');assert.equal(calls,0);
});
test('write uses own client and no actor argument, lost response only recovers exact owned bytes',async()=>{
 const calls=[],r=request(),v=accepted(r);const c=client(async(name,args)=>{calls.push({name,args:structuredClone(args)});if(name.startsWith('record_'))throw Error('lost response');return{data:{...v,historicalReceipt:true,currentSourceVerified:false},error:null};});
 const t=transport(options(c));assert.equal((await t.write(target,r)).error,'operation_outcome_unknown');const recovered=await t.recover(target,r);assert.equal(recovered.error,null);assert.equal(calls.length,2);assert.equal(calls[0].name,'record_native_mixed_simulation_game_evidence_v1');assert.deepEqual(Object.keys(calls[0].args).sort(),['p_event_id','p_request','p_tournament_id']);assert.deepEqual(calls[0].args.p_request,calls[1].args.p_request);
 assert.equal((await transport({...options(c),enabled:()=>false}).recover(target,r)).error,null);
});
test('request and response snapshots survive asynchronous caller mutation',async()=>{
 const r=request(),expected=structuredClone(r),v=accepted(expected);const c=client(async(_name,args)=>{assert.deepEqual(args.p_request,expected);r.payload.result.margin=90;return{data:v,error:null};});let reads=0;const base=c.auth.getUser;c.auth.getUser=async()=>{reads++;if(reads===1)r.payload.result.margin=80;else v.moneyMoved=true;return base();};
 const result=await transport(options(c)).write(target,r);assert.equal(result.error,null);assert.equal(result.data.entry.result.margin,40);assert.equal(result.data.moneyMoved,false);
});
test('post-dispatch identity switch and invalid state never claim a committed outcome',async()=>{
 const c=client(async()=>({data:accepted(),error:null}));let count=0;c.auth.getUser=async()=>({data:{user:{id:++count===1?target.actorId:id(99)}},error:null});assert.equal((await transport(options(c)).write(target,request())).error,'identity_changed');
 const absent=client(async()=>({data:null,error:null}));assert.equal((await transport(options(absent)).state(target)).error,'invalid_response');
});
test('SQL source keeps own-session boundary, immutable journal, exact CAS and all public access revoked',()=>{
 const sql=readFileSync(new URL('../database/proposals/native-mixed-simulation-game-evidence-v1.sql',import.meta.url),'utf8');
 assert.match(sql,/item_value jsonb/);assert.doesNotMatch(sql,/declare p jsonb;x jsonb/);assert.match(sql,/auth\.uid\(\)/);assert.match(sql,/auth\.sessions/);assert.match(sql,/session_id/);assert.match(sql,/expectedHistoryDigest/);assert.match(sql,/expectedRevision/);assert.match(sql,/mismatch_requires_review/);assert.match(sql,/exact_confirmation_required/);assert.match(sql,/paper_official_is_independent/);assert.match(sql,/native_mixed_admission_score_history_empty_v1/);assert.match(sql,/source_capture/);assert.match(sql,/FOR SHARE/i);assert.match(sql,/REVOKE ALL/i);
 assert.doesNotMatch(sql,/\bGRANT\s+EXECUTE/i);assert.doesNotMatch(sql,/set_config\s*\(\s*'request\.jwt/i);assert.doesNotMatch(sql,/UPDATE\s+(?:app\.)?(?:score_submissions|games|operation_receipts)\b/i);
 assert.match(sql,/native_mixed_attendance_operation_bound_v1\(seal\.actor_id,seal\.operation_id,'seal'\)is distinct from true/);
 assert.match(sql,/paper_official_identity_is_current_valid\(actor,tid\)and app\.paper_official_is_independent\(actor,tid,gid\)/);assert.match(sql,/evidenceVisibility/);assert.match(sql,/blind:=blind or/);assert.match(sql,/case when blind then '\[\]'::jsonb else h end/);
});

const closed=(r=request())=>({kind:'native-mixed-game-closed-v1',status:'closed',code:'terminal_operation_closed',actorId:target.actorId,tournamentId:target.tournamentId,eventId:target.eventId,operationId:r.operationId,request:r,closureId:id(90),reason:'history_changed',simulationOnly:true,noWriteCommitted:true,...flags});
test('terminal closure binds exact own request and immutable non-authority receipt shape',()=>{const r=request(),v=closed(r);assert.ok(closedReceipt(v,target,r));for(const bad of [{...v,actorId:id(98)},{...v,closureId:'bad'},{...v,reason:'unknown'},{...v,noWriteCommitted:false},{...v,officialResultVerified:true},{...v,extra:true}])assert.equal(closedReceipt(bad,target,r),null);assert.equal(closedReceipt(v,target,{...r,operationId:id(99)}),null);});
test('explicit resolver authenticates before/after, snapshots request, and recovers closure without write',async()=>{
 const calls=[],c=client(async(name,args)=>{calls.push({name,args:structuredClone(args)});return{data:closed(args.p_request),error:null};}),t=transport(options(c)),r=request();const v=await t.resolve(target,r);assert.equal(v.data.status,'closed');assert.equal(calls[0].name,'resolve_native_mixed_game_operation_v1');assert.equal('actorId'in calls[0].args,false);assert.deepEqual(calls[0].args.p_request,r);assert.equal((await t.recover(target,r)).data.status,'closed');
 assert.equal((await t.resolve({...target,sessionId:id(99)},r)).error,'identity_changed');assert.equal(calls.length,2);
 let users=0;const changing=client(async()=>({data:closed(),error:null}));changing.auth.getUser=async()=>({data:{user:{id:++users===1?target.actorId:id(99)}},error:null});assert.equal((await transport(options(changing)).resolve(target,r)).error,'identity_changed');
});

test('proof reuse remains private and is anchored to a verified exact stored Start',()=>{
 const sql=readFileSync('database/proposals/native-mixed-simulation-game-evidence-v1.sql','utf8');
 for(const name of ['entry_bound','complete','play_order']){const marker='create function app.native_mixed_game_'+name+'_v1(',start=sql.indexOf(marker),end=sql.indexOf('end$$;',start),body=sql.slice(start,end);assert(start>=0);assert.match(body,/native_mixed_simulation_start_bound_v1/);assert.match(body,new RegExp('native_mixed_game_'+name+'_with_start_v1'));}
 assert.match(sql,/stored\.id=s\.id and stored=s/);assert.match(sql,/st\.event_id=eid and st=s/);
 const writer=sql.slice(sql.indexOf('create function app.append_native_mixed_simulation_game_evidence_v1'),sql.indexOf('create function app.get_native_mixed_simulation_game_operation_v1'));
 assert(writer.indexOf('root:=app.native_mixed_game_root_current_v1')<writer.indexOf('select*into verified_start'));assert(writer.indexOf('select*into verified_start')<writer.indexOf('app.native_mixed_game_play_order_with_start_v1'));
 for(const signature of ['entry_bound_with_start_v1(uuid,app.native_mixed_simulation_starts_v1)','complete_with_start_v1(uuid,uuid,app.native_mixed_simulation_starts_v1,uuid)','play_order_with_start_v1(uuid,uuid,app.native_mixed_simulation_starts_v1,uuid,uuid)'])assert(sql.includes("'app.native_mixed_game_"+signature+"'::regprocedure"));
});
