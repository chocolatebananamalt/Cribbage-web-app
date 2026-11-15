// Pure in-memory examples; never inserted into a database.
import assert from 'node:assert/strict';
import{planLocalRandomSeating,buildFacingGeometry}from'../../src/lib/seating/local-random-plan.ts';
import{defaultDrawConfig,planningInput}from'../../src/lib/api/roster-random-draw.ts';
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,actor=id(100),tid=id(200),hash='a'.repeat(64);
export function input(tableId="A"){
 const config=defaultDrawConfig();config.tables=[{tableId,seatCount:18}];config.anchor.seatId=`${tableId}-1`;config.activePairIds=buildFacingGeometry(config.tables).pairs.map(p=>p.pairId);config.anchor.directorApproved=true;
 const source={status:'open',registrationStatus:'closed',roster:Array.from({length:18},(_,i)=>({rosterEntryId:id(i+1),displayName:`Anonymous ${i+1}`,scorecardType:i<6?'digital':'paper',checkInEventId:id(400+i),checkInVersion:1,state:'checked_in'}))};
 const plan={kind:'random-seating-plan-receipt-v1',actorId:actor,tournamentId:tid,operationId:id(300),status:'accepted',planId:id(500),revision:1,sourceHash:hash,config:structuredClone(config),sourceSnapshot:structuredClone(source),idsWritten:false};
 const result=planLocalRandomSeating(planningInput(config,source,hash),()=>0);assert.equal(result.status,'candidate');
 const {algorithmVersion,attempts,anchor,assignments,matches,physicalReviewRequired,publishable}=result;
 const receipt={kind:'random-seating-draw-receipt-v1',actorId:actor,tournamentId:tid,operationId:id(301),status:'accepted',planId:plan.planId,sourceHash:hash,candidate:{algorithmVersion,attempts,anchor,assignments,matches,physicalReviewRequired,publishable},idsWritten:false};
 return{actorId:actor,tournamentId:tid,operationId:id(700),review:{physicalLayoutConfirmed:true,stationaryDecisionsConfirmed:true,constraintsConfirmed:true,reason:'Pure calculation example; not an actual physical review.'},workspace:{kind:'random-seating-workspace-v1',actorId:actor,tournamentId:tid,sourceHash:hash,sourceSnapshot:source,eligible:true,reason:null,latestPlan:{planId:plan.planId,revision:1,sourceHash:hash,config:structuredClone(config)},latestDraw:{receipt,plan}},nativeWorkspace:{registrationClosed:true,publication:null,checkIn:source.roster.map(p=>({rosterEntryId:p.rosterEntryId,displayName:p.displayName,scorecardType:p.scorecardType,state:'checked_in'}))}};
}
export function accepted(request){return{kind:'reviewed-initial-seating-receipt-v1',status:'initial_seating_published',actorId:actor,tournamentId:tid,operationId:request.idempotencyKey,publicationId:id(800),nativeReceiptId:id(801),planId:request.planId,planRevision:request.expectedPlanRevision,drawActorId:request.drawActorId,drawOperationId:request.drawOperationId,sourceHash:request.expectedSourceHash,assignmentCount:18,idsWritten:true,schedulePublished:false,distributionSent:false,request:structuredClone(request)}};
export function operation(request){return{kind:'reviewed-initial-seating-operation-v1',actorId:actor,tournamentId:tid,operationId:request.idempotencyKey,request:structuredClone(request),receipt:accepted(request)}};
