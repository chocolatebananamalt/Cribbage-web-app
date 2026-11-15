import type {NativeMixedSeatingConfigV1} from './native-mixed-seating-plan-v1.ts';

export type NativeMixedSimulationScopeV1={actorId:string;tournamentId:string;eventId:string};
export type NativeMixedSimulationActionV1='plan'|'draw'|'review'|'publish';
export type NativeMixedSimulationPlanRequestV1={kind:'native-mixed-simulation-plan-v1';operationId:string;expectedAttendanceSealId:string;expectedAttendanceSourceDigest:string;config:NativeMixedSeatingConfigV1;reason:string};
export type NativeMixedSimulationDrawRequestV1={kind:'native-mixed-simulation-draw-v1';operationId:string;planId:string;expectedPlanDigest:string;expectedAttendanceSourceDigest:string;reason:string};
export type NativeMixedSimulationReviewRequestV1={kind:'native-mixed-simulation-review-v1';operationId:string;drawId:string;expectedDrawDigest:string;expectedAttendanceSourceDigest:string;decision:'accepted-test-simulation-only';humanPresenceNotVerified:true;simulationLayoutReviewed:true;fictionalPaperAcknowledged:true;reason:string};
export type NativeMixedSimulationPublishRequestV1={kind:'native-mixed-simulation-publish-v1';operationId:string;reviewId:string;expectedReviewDigest:string;expectedAttendanceSourceDigest:string;seatingOperationId:string;scheduleOperationId:string;reason:string};
export type NativeMixedSimulationRequestV1=NativeMixedSimulationPlanRequestV1|NativeMixedSimulationDrawRequestV1|NativeMixedSimulationReviewRequestV1|NativeMixedSimulationPublishRequestV1;
export type NativeMixedSimulationOperationV1={action:NativeMixedSimulationActionV1;operationId:string;request:NativeMixedSimulationRequestV1};
export type NativeMixedSimulationRetryV1={status:'retry_exact';code:'source_busy'};
export type NativeMixedSimulationBlockedV1={status:'rejected';code:string};
export type NativeMixedSimulationReceiptV1={kind:'native-mixed-simulation-receipt-v1';action:NativeMixedSimulationActionV1;status:'accepted'|'rejected';code:string;actorId:string;tournamentId:string;eventId:string;operationId:string;request:NativeMixedSimulationRequestV1;[key:string]:unknown};
export type NativeMixedSimulationOutcomeV1=NativeMixedSimulationReceiptV1|NativeMixedSimulationRetryV1|NativeMixedSimulationBlockedV1;
export type NativeMixedSimulationProviderWriteV1={kind:'native-mixed-simulation-provider-write-v1';action:NativeMixedSimulationActionV1;actorId:string;tournamentId:string;eventId:string;operationId:string;operation:NativeMixedSimulationOperationV1;outcome:NativeMixedSimulationOutcomeV1};
export type NativeMixedSimulationOperationReadV1={kind:'native-mixed-simulation-operation-v1';actorId:string;tournamentId:string;eventId:string;operationId:string;action:NativeMixedSimulationActionV1;request:NativeMixedSimulationRequestV1;receipt:NativeMixedSimulationReceiptV1;historicalReceipt:true;currentSourceVerified:false};

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value:unknown,keys:readonly string[]):value is Record<string,unknown>=>object(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const reason=(value:unknown):value is string=>typeof value==='string'&&value===value.trim()&&value.length>=1&&value.length<=500&&!/[\u0000-\u001f\u007f]/u.test(value);
const integer=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
const same=(a:unknown,b:unknown)=>JSON.stringify(a,(_key,value)=>object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value)===JSON.stringify(b,(_key,value)=>object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
const pairs=Array.from({length:9},(_,index)=>`A:${index*2+1}-${index*2+2}`);
const requestKinds:Record<NativeMixedSimulationActionV1,string>={plan:'native-mixed-simulation-plan-v1',draw:'native-mixed-simulation-draw-v1',review:'native-mixed-simulation-review-v1',publish:'native-mixed-simulation-publish-v1'};
const acceptedCodes:Record<NativeMixedSimulationActionV1,string>={plan:'simulation_plan_saved',draw:'simulation_draw_recorded',review:'simulation_draw_reviewed',publish:'native_mixed_simulation_published'};
const rejectedCodes:Record<NativeMixedSimulationActionV1,Set<string>>={plan:new Set(['feature_unavailable','idempotency_conflict','simulation_already_planned_or_published','attendance_source_changed','unsupported_a18_geometry','operation_conflict']),draw:new Set(['feature_unavailable','idempotency_conflict','draw_already_attempted','source_or_plan_changed','operation_conflict']),review:new Set(['feature_unavailable','idempotency_conflict','draw_or_source_changed','draw_already_reviewed','operation_conflict']),publish:new Set(['feature_unavailable','idempotency_conflict','review_or_source_changed','operation_conflict'])};

export function isNativeMixedSimulationScopeV1(value:unknown):value is NativeMixedSimulationScopeV1{
 return exact(value,['actorId','tournamentId','eventId'])&&[value.actorId,value.tournamentId,value.eventId].every(uuid);
}

function validConfig(value:unknown):value is NativeMixedSeatingConfigV1{
 if(!exact(value,['tables','activePairIds','anchor','stationaryRequests','stationaryDecisions','constraints','maxAttempts']))return false;
 if(!same(value.tables,[{tableId:'A',seatCount:18}])||!same(value.activePairIds,pairs)||!integer(value.maxAttempts,1,256))return false;
 const anchor=value.anchor;if(!exact(anchor,['seatId','participantId','directorApproved'])||anchor.seatId!=='A-1'||anchor.directorApproved!==true||(anchor.participantId!==null&&!uuid(anchor.participantId)))return false;
 const requests=value.stationaryRequests;if(!Array.isArray(requests)||requests.length>18||new Set(requests).size!==requests.length||requests.some(item=>!uuid(item)))return false;
 const rawDecisions=value.stationaryDecisions;if(!Array.isArray(rawDecisions)||rawDecisions.length>18||new Set(rawDecisions.map(item=>object(item)?item.participantId:null)).size!==rawDecisions.length||rawDecisions.some(item=>!exact(item,['participantId','decision'])||!uuid(item.participantId)||!['selected-anchor','not-accommodated'].includes(item.decision as string)||(item.decision==='selected-anchor'&&item.participantId!==anchor.participantId)||(item.decision==='not-accommodated'&&item.participantId===anchor.participantId)))return false;
 const decisions=rawDecisions as Array<{participantId:string;decision:'selected-anchor'|'not-accommodated'}>;
 if(requests.some(item=>!decisions.some(decision=>decision.participantId===item)))return false;
 if(!Array.isArray(value.constraints)||value.constraints.length>36||value.constraints.some(item=>!exact(item,['kind','participantIds','round','verified','sourceReference'])||item.kind!=='avoid-pair-in-round'||item.verified!==true||!integer(item.round,1,12)||!Array.isArray(item.participantIds)||item.participantIds.length!==2||!item.participantIds.every(uuid)||item.participantIds[0]===item.participantIds[1]||typeof item.sourceReference!=='string'||!/^LOCAL-PLAN-[A-Z0-9_-]{1,40}$/.test(item.sourceReference)))return false;
 const pairsSeen=new Set<string>(),opponents=new Map<string,Set<string>>();
 for(const constraint of value.constraints){const [a,b]=constraint.participantIds,key=`${constraint.round}|${[a,b].sort().join('|')}`;if(pairsSeen.has(key))return false;pairsSeen.add(key);for(const [participant,opponent]of[[a,b],[b,a]]){const participantKey=`${constraint.round}|${participant}`,set=opponents.get(participantKey)??new Set<string>();set.add(opponent);if(set.size===17)return false;opponents.set(participantKey,set);}}
 return true;
}

export function isNativeMixedSimulationRequestV1(value:unknown,action?:NativeMixedSimulationActionV1):value is NativeMixedSimulationRequestV1{
 if(!object(value))return false;
 const resolved=action??(Object.entries(requestKinds).find(([,kind])=>kind===value.kind)?.[0] as NativeMixedSimulationActionV1|undefined);
 if(!resolved||value.kind!==requestKinds[resolved]||!uuid(value.operationId)||!reason(value.reason))return false;
 if(resolved==='plan')return exact(value,['kind','operationId','expectedAttendanceSealId','expectedAttendanceSourceDigest','config','reason'])&&uuid(value.expectedAttendanceSealId)&&digest(value.expectedAttendanceSourceDigest)&&validConfig(value.config);
 if(resolved==='draw')return exact(value,['kind','operationId','planId','expectedPlanDigest','expectedAttendanceSourceDigest','reason'])&&uuid(value.planId)&&digest(value.expectedPlanDigest)&&digest(value.expectedAttendanceSourceDigest);
 if(resolved==='review')return exact(value,['kind','operationId','drawId','expectedDrawDigest','expectedAttendanceSourceDigest','decision','humanPresenceNotVerified','simulationLayoutReviewed','fictionalPaperAcknowledged','reason'])&&uuid(value.drawId)&&digest(value.expectedDrawDigest)&&digest(value.expectedAttendanceSourceDigest)&&value.decision==='accepted-test-simulation-only'&&value.humanPresenceNotVerified===true&&value.simulationLayoutReviewed===true&&value.fictionalPaperAcknowledged===true;
 return exact(value,['kind','operationId','reviewId','expectedReviewDigest','expectedAttendanceSourceDigest','seatingOperationId','scheduleOperationId','reason'])&&uuid(value.reviewId)&&digest(value.expectedReviewDigest)&&digest(value.expectedAttendanceSourceDigest)&&uuid(value.seatingOperationId)&&uuid(value.scheduleOperationId)&&new Set([value.operationId,value.seatingOperationId,value.scheduleOperationId]).size===3;
}

export function isNativeMixedSimulationOperationV1(value:unknown):value is NativeMixedSimulationOperationV1{
 return exact(value,['action','operationId','request'])&&['plan','draw','review','publish'].includes(value.action as string)&&uuid(value.operationId)&&isNativeMixedSimulationRequestV1(value.request,value.action as NativeMixedSimulationActionV1)&&value.request.operationId===value.operationId;
}

function receiptKeys(action:NativeMixedSimulationActionV1,status:'accepted'|'rejected',historical:boolean){
 const shared=['kind','action','status','code','actorId','tournamentId','eventId','operationId','request'];
 const specific=status==='rejected'?['entropyConsumed','retryWithNewOperationAuthorized']:action==='plan'?['planId','version','sourceDigest','normalDrawAuthorized','normalStartAuthorized']:action==='draw'?['drawId','candidate','sourceDigest','publishAuthorized']:action==='review'?['reviewId','sourceDigest','publishAuthorized']:['contextId','seatingPublicationId','schedulePublicationId','assignmentCount','roundCount','matchCount','currentSourceVerified','ordinaryAttendanceUsed','normalStartAuthorized'];
 const history=historical?['historicalReceipt',...(specific.includes('currentSourceVerified')?[]:['currentSourceVerified'])]:[];
 return [...shared,...specific,...history];
}

export function readNativeMixedSimulationReceiptV1(value:unknown,expected:{scope:NativeMixedSimulationScopeV1;operation:NativeMixedSimulationOperationV1}):NativeMixedSimulationReceiptV1|null{
 try{
  const {scope,operation}=expected;if(!object(value)||value.kind!=='native-mixed-simulation-receipt-v1'||value.action!==operation.action||!['accepted','rejected'].includes(value.status as string)||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||value.operationId!==operation.operationId||!same(value.request,operation.request))return null;
  const historical=value.historicalReceipt===true;if(!exact(value,receiptKeys(operation.action,value.status as 'accepted'|'rejected',historical))||(historical&&value.currentSourceVerified!==false))return null;
  if(value.status==='rejected')return operation.action==='draw'&&['simulation_draw_failed','bounded_search_exhausted'].includes(value.code as string)&&value.entropyConsumed===true&&value.retryWithNewOperationAuthorized===false?structuredClone(value) as NativeMixedSimulationReceiptV1:null;
  if(value.code!==acceptedCodes[operation.action])return null;
  if(operation.action==='plan'&&(!uuid(value.planId)||value.version!==1||!digest(value.sourceDigest)||value.normalDrawAuthorized!==false||value.normalStartAuthorized!==false))return null;
  if(operation.action==='draw'&&(!uuid(value.drawId)||!object(value.candidate)||!digest(value.sourceDigest)||value.publishAuthorized!==false))return null;
  if(operation.action==='review'&&(!uuid(value.reviewId)||!digest(value.sourceDigest)||value.publishAuthorized!==false))return null;
  if(operation.action==='publish'&&(!uuid(value.contextId)||!uuid(value.seatingPublicationId)||!uuid(value.schedulePublicationId)||value.assignmentCount!==18||value.roundCount!==12||value.matchCount!==108||value.ordinaryAttendanceUsed!==false||value.normalStartAuthorized!==false||(historical?value.currentSourceVerified!==false:value.currentSourceVerified!==true)))return null;
  return structuredClone(value) as NativeMixedSimulationReceiptV1;
 }catch{return null;}
}

export function readNativeMixedSimulationOutcomeV1(value:unknown,expected:{scope:NativeMixedSimulationScopeV1;operation:NativeMixedSimulationOperationV1}):NativeMixedSimulationOutcomeV1|null{
 const receipt=readNativeMixedSimulationReceiptV1(value,expected);if(receipt)return receipt;
 if(exact(value,['status','code'])&&value.status==='retry_exact'&&value.code==='source_busy')return structuredClone(value) as NativeMixedSimulationRetryV1;
 return exact(value,['status','code'])&&value.status==='rejected'&&rejectedCodes[expected.operation.action].has(value.code as string)?structuredClone(value) as NativeMixedSimulationBlockedV1:null;
}

export function readNativeMixedSimulationProviderWriteV1(value:unknown,expected:{scope:NativeMixedSimulationScopeV1;operation:NativeMixedSimulationOperationV1}):NativeMixedSimulationProviderWriteV1|null{
 if(!exact(value,['kind','action','actorId','tournamentId','eventId','operationId','operation','outcome'])||value.kind!=='native-mixed-simulation-provider-write-v1'||value.action!==expected.operation.action||value.actorId!==expected.scope.actorId||value.tournamentId!==expected.scope.tournamentId||value.eventId!==expected.scope.eventId||value.operationId!==expected.operation.operationId||!same(value.operation,expected.operation)||!readNativeMixedSimulationOutcomeV1(value.outcome,expected))return null;
 return structuredClone(value) as NativeMixedSimulationProviderWriteV1;
}

export function readNativeMixedSimulationOperationV1(value:unknown,expected:{scope:NativeMixedSimulationScopeV1;operationId:string;operation?:NativeMixedSimulationOperationV1}):NativeMixedSimulationOperationReadV1|null{
 const keys=['kind','actorId','tournamentId','eventId','operationId','action','request','receipt','historicalReceipt','currentSourceVerified'];
 if(!exact(value,keys)||value.kind!=='native-mixed-simulation-operation-v1'||value.actorId!==expected.scope.actorId||value.tournamentId!==expected.scope.tournamentId||value.eventId!==expected.scope.eventId||value.operationId!==expected.operationId||value.historicalReceipt!==true||value.currentSourceVerified!==false)return null;
 const operation=expected.operation??{action:value.action,operationId:value.operationId,request:value.request};
 if(!isNativeMixedSimulationOperationV1(operation)||operation.operationId!==expected.operationId||value.action!==operation.action||!same(value.request,operation.request))return null;
 const receipt=readNativeMixedSimulationReceiptV1(value.receipt,{scope:expected.scope,operation});
 return receipt?structuredClone({...value,receipt}) as NativeMixedSimulationOperationReadV1:null;
}

type PublishedSource={status:'source_available';kind:'native-mixed-simulation-schedule-source-v1';actorId:string;tournamentId:string;eventId:string;sourceDigest:string;[key:string]:unknown};
export function readNativeMixedSimulationScheduleSourceV1(value:unknown,scope:NativeMixedSimulationScopeV1):PublishedSource|null{
 const flags=['ordinaryAttendanceUsed','ordinaryInitialSeatingWriterUsed','ordinaryScheduleWriterUsed','humanPresenceVerified','paymentVerified','moneyMoved','normalStartAuthorized','payoutAuthorized','finalizationAuthorized'];
 const keys=['status','kind','actorId','tournamentId','eventId','attendance','plan','draw','review','publication','fixedAssignments','canonicalGames','sourceDigest','simulationRosterProjected','nativeInitialSeatingPublished','nativeCanonicalSchedulePublished',...flags];
 if(!exact(value,keys)||value.status!=='source_available'||value.kind!=='native-mixed-simulation-schedule-source-v1'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||!digest(value.sourceDigest)||value.simulationRosterProjected!==true||value.nativeInitialSeatingPublished!==true||value.nativeCanonicalSchedulePublished!==true||flags.some(flag=>value[flag]!==false))return null;
 if(!exact(value.attendance,['sealId','sourceDigest'])||!uuid(value.attendance.sealId)||!digest(value.attendance.sourceDigest)||!exact(value.plan,['planId','sourceDigest','config'])||!uuid(value.plan.planId)||!digest(value.plan.sourceDigest)||!validConfig(value.plan.config)||!exact(value.draw,['drawId','sourceDigest','candidate'])||!uuid(value.draw.drawId)||!digest(value.draw.sourceDigest)||!object(value.draw.candidate)||!exact(value.review,['reviewId','sourceDigest','decision'])||!uuid(value.review.reviewId)||!digest(value.review.sourceDigest)||value.review.decision!=='accepted-test-simulation-only')return null;
 if(!exact(value.publication,['contextId','seatingReceiptId','seatingPublicationId','scheduleReceiptId','schedulePublicationId','sourceMethod','assignmentCount','roundCount','matchCount'])||![value.publication.contextId,value.publication.seatingReceiptId,value.publication.scheduleReceiptId,value.publication.schedulePublicationId,value.publication.seatingPublicationId].every(uuid)||value.publication.sourceMethod!=='native_mixed_simulation_v1'||value.publication.assignmentCount!==18||value.publication.roundCount!==12||value.publication.matchCount!==108)return null;
 if(!Array.isArray(value.fixedAssignments)||value.fixedAssignments.length!==18||value.fixedAssignments.some(item=>!exact(item,['assignmentId','rosterEntryId','participantId','fixedId'])||![item.assignmentId,item.rosterEntryId,item.participantId].every(uuid)||typeof item.fixedId!=='string')||!Array.isArray(value.canonicalGames)||value.canonicalGames.length!==108||value.canonicalGames.some(item=>!exact(item,['gameId','importRowNumber','round','sideAParticipantId','sideBParticipantId','sideATableSeat','sideBTableSeat'])||!uuid(item.gameId)||!integer(item.importRowNumber,1,108)||!integer(item.round,1,12)||!uuid(item.sideAParticipantId)||!uuid(item.sideBParticipantId)||typeof item.sideATableSeat!=='string'||typeof item.sideBTableSeat!=='string'))return null;
 return structuredClone(value) as PublishedSource;
}
