import test from 'node:test';
import assert from 'node:assert/strict';
import {planLocalRandomSeating,buildFacingGeometry} from '../src/lib/seating/local-random-plan.ts';
import {defaultDrawConfig,planningInput} from '../src/lib/api/roster-random-draw.ts';
import {prepareReviewedDrawPublication,isReviewedDrawPublicationRequest} from '../src/lib/seating/reviewed-draw-publication.ts';
import {readReviewedDrawRecovery,reviewedDrawRecoveryKey,clearExactReviewedDrawRecovery} from '../src/lib/seating/reviewed-draw-recovery.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,actor=id(100),tid=id(200),hash='a'.repeat(64);
// Pure in-memory calculation inputs. No database, operational fixture or HTTP request.
function input(tableId="A"){
 const config=defaultDrawConfig();config.tables=[{tableId,seatCount:18}];config.anchor.seatId=`${tableId}-1`;config.activePairIds=buildFacingGeometry(config.tables).pairs.map(p=>p.pairId);config.anchor.directorApproved=true;
 const source={status:'open',registrationStatus:'closed',roster:Array.from({length:18},(_,i)=>({rosterEntryId:id(i+1),displayName:`Anonymous ${i+1}`,scorecardType:i<6?'digital':'paper',checkInEventId:id(400+i),checkInVersion:1,state:'checked_in'}))};
 const plan={kind:'random-seating-plan-receipt-v1',actorId:actor,tournamentId:tid,operationId:id(300),status:'accepted',planId:id(500),revision:1,sourceHash:hash,config:structuredClone(config),sourceSnapshot:structuredClone(source),idsWritten:false};
 const result=planLocalRandomSeating(planningInput(config,source,hash),()=>0);assert.equal(result.status,'candidate');
 const {algorithmVersion,attempts,anchor,assignments,matches,physicalReviewRequired,publishable}=result;
 const receipt={kind:'random-seating-draw-receipt-v1',actorId:actor,tournamentId:tid,operationId:id(301),status:'accepted',planId:plan.planId,sourceHash:hash,candidate:{algorithmVersion,attempts,anchor,assignments,matches,physicalReviewRequired,publishable},idsWritten:false};
 return{actorId:actor,tournamentId:tid,operationId:id(700),review:{physicalLayoutConfirmed:true,stationaryDecisionsConfirmed:true,constraintsConfirmed:true,reason:'Pure calculation example; not an actual physical review.'},workspace:{kind:'random-seating-workspace-v1',actorId:actor,tournamentId:tid,sourceHash:hash,sourceSnapshot:source,eligible:true,reason:null,latestPlan:{planId:plan.planId,revision:1,sourceHash:hash,config:structuredClone(config)},latestDraw:{receipt,plan}},nativeWorkspace:{registrationClosed:true,publication:null,checkIn:source.roster.map(p=>({rosterEntryId:p.rosterEntryId,displayName:p.displayName,scorecardType:p.scorecardType,state:'checked_in'}))}};
}
test('pure reviewed draw preserves exact roster and fixed IDs with no writes, renumbering or authorization claim',()=>{
 const a=input(),before=structuredClone(a),r=prepareReviewedDrawPublication(a);assert.equal(r.status,'prepared-not-authorized');assert.deepEqual(a,before);assert.equal(r.idsWritten,false);assert.equal(r.schedulePublished,false);assert.equal(r.distributionSent,false);assert(isReviewedDrawPublicationRequest(r.request));
 assert.equal(r.nativePreview.tableCount,1);assert.equal(r.nativePreview.seatsPerTable,18);assert.equal(r.nativePreview.idempotencyKey,a.operationId);
 for(const x of r.nativePreview.assignments)assert.equal(x.tableSeat,a.workspace.latestDraw.receipt.candidate.assignments.find(p=>p.participantId===x.rosterEntryId).tournamentId);
 r.request.review.reason='caller mutation';assert.equal(a.review.reason,before.review.reason);
});
test('stale roster, source, plan revision and closed-registration mismatch reject',()=>{
 for(const mutate of [a=>a.workspace.sourceHash='b'.repeat(64),a=>a.workspace.sourceSnapshot.roster[0].checkInVersion++,a=>a.workspace.latestPlan.revision++,a=>a.workspace.latestPlan.config.maxAttempts--,a=>a.nativeWorkspace.checkIn[0].state='absent',a=>a.nativeWorkspace.checkIn[0].scorecardType='paper',a=>a.nativeWorkspace.registrationClosed=false,a=>a.workspace.eligible=false]){const a=input();mutate(a);assert.equal(prepareReviewedDrawPublication(a).status,'blocked');}
});
test('existing native publication always preserves IDs; foreign actor and tampered candidate fail closed',()=>{
 const a=input();a.nativeWorkspace.publication={publicationId:id(800),tableCount:1,seatsPerTable:18,publishedAt:'2026-11-04T00:00:00Z',assignments:[]};assert.equal(prepareReviewedDrawPublication(a).code,'fixed_ids_readonly');
 const b=input();b.actorId=id(999);assert.equal(prepareReviewedDrawPublication(b).status,'blocked');
 const c=input();c.workspace.latestDraw.receipt.candidate.matches[1]=c.workspace.latestDraw.receipt.candidate.matches[0];assert.equal(prepareReviewedDrawPublication(c).status,'blocked');
});
test('explicit complete reasoned review required; candidate publishable flag never rewritten',()=>{
 for(const review of [null,{}, {...input().review,physicalLayoutConfirmed:false},{...input().review,reason:'   '},{...input().review,reason:'a\nb'}]){const a=input();a.review=review;assert.equal(prepareReviewedDrawPublication(a).status,'blocked');}
 const r=prepareReviewedDrawPublication(input());assert.equal(r.request.reviewedCandidate.publishable,false);assert.equal(r.request.reviewedCandidate.physicalReviewRequired,true);
 for(const change of [r=>r.reviewedCandidate.publishable=true,r=>r.extra=true,r=>r.idempotencyKey='INVALID']){const x=structuredClone(r.request);change(x);assert.equal(isReviewedDrawPublicationRequest(x),false);}
});
test('recovery preserves unknown/malformed/wrong-owner and newer exact requests without storage writes',()=>{
 const a=input(),request=prepareReviewedDrawPublication(a).request,key=reviewedDrawRecoveryKey(actor,tid),raw=JSON.stringify({protocol:'reviewed-native-seating-v1',actorId:actor,tournamentId:tid,request}),m=new Map([[key,raw]]),storage={getItem:k=>m.get(k)??null,removeItem:k=>m.delete(k)};
 assert.equal(readReviewedDrawRecovery(storage,actor,tid).kind,'pending');assert.equal(readReviewedDrawRecovery(storage,id(999),tid).kind,'empty');
 m.set(key,raw+' ');assert.equal(clearExactReviewedDrawRecovery(storage,actor,tid,raw),false);assert.equal(m.get(key),raw+' ');
 m.set(key,'{broken');assert.equal(readReviewedDrawRecovery(storage,actor,tid).kind,'blocked');assert.equal(m.get(key),'{broken');
 m.set(key,JSON.stringify({...JSON.parse(raw),actorId:id(999)}));assert.equal(readReviewedDrawRecovery(storage,actor,tid).kind,'blocked');
 m.set(key,raw);assert.equal(clearExactReviewedDrawRecovery(storage,actor,tid,raw),true);assert.equal(m.size,0);
});

test('native A-based capacity never pads or renames a Z-table candidate',()=>{const a=input('Z'),before=structuredClone(a.workspace.latestDraw.receipt.candidate);assert.equal(prepareReviewedDrawPublication(a).code,'native_geometry_unsupported');assert.deepEqual(a.workspace.latestDraw.receipt.candidate,before);});

test('nested malformed candidates remain blocked recovery bytes, never typed as a pending draw',()=>{const a=input(),valid=prepareReviewedDrawPublication(a).request,key=reviewedDrawRecoveryKey(actor,tid);for(const alter of [r=>r.reviewedCandidate.anchor=null,r=>r.reviewedCandidate.attempts='bad',r=>r.reviewedCandidate.assignments=Array(18).fill(null),r=>r.reviewedCandidate.matches=Array(108).fill(null),r=>r.reviewedCandidate.assignments[1].logicalSlot=r.reviewedCandidate.assignments[0].logicalSlot,r=>r.reviewedCandidate.matches[1]=r.reviewedCandidate.matches[0]]){const request=structuredClone(valid);alter(request);assert.equal(isReviewedDrawPublicationRequest(request),false);const raw=JSON.stringify({protocol:'reviewed-native-seating-v1',actorId:actor,tournamentId:tid,request}),m=new Map([[key,raw]]);assert.equal(readReviewedDrawRecovery({getItem:k=>m.get(k)??null},actor,tid).kind,'blocked');assert.equal(m.get(key),raw);}});
