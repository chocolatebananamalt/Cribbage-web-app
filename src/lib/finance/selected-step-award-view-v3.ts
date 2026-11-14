import'server-only';
import{isEventPrizeResponseValueV1}from'../api/event-prize-settings-v1.ts';
import{assembleSelectedStepPrizeSourceV3}from'./selected-step-prize-source-v3.ts';
import{readModernManualSportingFrameV1}from'../results/modern-manual-sporting-frame-v1.ts';
import{readNativePlayoffSportingFrameV1}from'../results/native-playoff-sporting-frame-v1.ts';
import{verifiedPlayoffSlotsV2}from'../playoffs/verified-playoff-slots-v2.ts';
import{calculatePlayoffPrizeProposalsV2}from'../results/playoff-prize-proposals-v2.ts';
import{modernPrizeSameV2 as same,readModernPrizeReviewV2,type ModernPrizeScopeV2,type ModernPrizeWorkspaceV2}from'./modern-prize-journal-contract-v2.ts';
import type{ModernPrizeResultsV2}from'../results/modern-prize-results-v2.ts';
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
/** Trusted private-RPC source only. Reconstruct amount and sporting evidence,
 * then return an allow-listed presentation DTO, never its private captures. */
function projectEvidence(value:unknown,scope:ModernPrizeScopeV2,expectedQualificationId:string|undefined,observation:'current'|'historical'):{workspace:ModernPrizeWorkspaceV2;results:ModernPrizeResultsV2|null}|null{try{
 if(!isEventPrizeResponseValueV1(value)||!obj(value))return null;
 if(observation==='current'&&value.status==='held'&&Object.keys(value).length===2&&typeof value.code==='string'&&/^[a-z0-9_]{1,100}$/.test(value.code))return{workspace:{status:'held',code:value.code},results:null};
 if(value.kind!==(observation==='current'?'selected-step-award-workspace-v3':'selected-step-award-history-v3')||!(observation==='current'?['review','recorded'].includes(String(value.status)):value.status==='recorded')||!Object.entries(scope).every(([k,v])=>value[k]===v)||value.currentSourceVerified!==(observation==='current')||value.moneyMoved!==false||value.payoutAuthorized!==false||!obj(value.source))return null;
 const s=value.source;
 const manual=s.kind==='selected-step-manual-award-source-v3';
 if((!manual&&s.kind!=='selected-step-award-source-v3')||s.status!=='source_available'||!hash(s.sourceDigest)||!Object.entries(scope).every(([k,v])=>s[k]===v)||s.moneyMoved!==false||s.payoutAuthorized!==false||s.directorReviewRequired!==true||s.entryFeeSource!==null||!obj(s.fundSource)||!obj(s.prizeWorkspace)||!obj(s.plan))return null;
 const f=s.fundSource,w=s.prizeWorkspace;
 if(f.kind!=='current-selected-step-fund-v3'||f.status!=='source_available'||f.recordedFundComplete!==true||!uuid(f.reviewId)||!obj(f.capture)||!obj(w.head)||w.stale!==false||!same(w,f.capture.prizeWorkspace)||!uuid(w.head.revisionId)||!same(w.head.sourceCapture,w.nativeSource)||!obj(f.capture.sportingSource)||!obj(f.capture.ownershipLedger)||!obj(f.capture.income)||f.capture.income.activeMinor!==0||!same(f.capture.income.records,[]))return null;
 const fundCapture=f.capture,head=w.head;
 const basis=assembleSelectedStepPrizeSourceV3(w.nativeSource,scope);if(!basis||!same(w.head.input,(w.nativeSource as {capture:{input:unknown}}).capture.input)||!same(s.plan,basis.basis.input.plan)||s.totalMinor!==basis.ledger.regularFundMinor)return null;
 const native=w.nativeSource as {capture:{ownershipLedger:unknown;prizeActivation:{settingsBinding:Record<string,unknown>;activation:Record<string,unknown>}}};
 if(!Object.entries(scope).every(([k,v])=>f[k]===v&&fundCapture[k]===v)||f.moneyMoved!==false||f.payoutAuthorized!==false||f.finalizationAuthorized!==false||f.bankReceiptVerified!==false
  ||!same(f.capture.ownershipLedger,native.capture.ownershipLedger)||!obj(f.capture.totals)||f.capture.totals.regularAllocationFundMinor!==s.totalMinor)return null;
 const n=f.capture.sportingSource;
 if(n.kind!==(manual?'modern-manual-sporting-source-v1':'selected-step-sporting-source-v3')||n.status!=='source_available'||!hash(n.sourceDigest)||!obj(n.qualification)||!obj(n.binding)||n.eventKind!==basis.basis.source.eventKind||expectedQualificationId&&n.qualification.resultVersionId!==expectedQualificationId)return null;
 if(!Object.entries(scope).every(([k,v])=>n[k]===v)||!same(n.qualification.resultVersionId,basis.basis.source.qualificationResultVersionId))return null;
 if(!same(n.binding,{bindingId:native.capture.prizeActivation.settingsBinding.id,settingsSnapshotId:basis.basis.source.settingsSnapshotId,reviewId:native.capture.prizeActivation.settingsBinding.review_id,activationId:native.capture.prizeActivation.activation.id}))return null;
 const sport=(manual?readModernManualSportingFrameV1:readNativePlayoffSportingFrameV1)({playoff:n.playoff,sourceDigest:n.sourceDigest},scope,n.qualification,n.binding,n.eventKind,n.draft);if(sport.status!=='available')return null;
 const nodes=verifiedPlayoffSlotsV2(sport.frame.qualifierCount);if(!nodes)return null;
 const rounds=nodes.at(-1)!.roundNumber,q=sport.frame.qualifierCount;
 const winner=sport.frame.matches.at(-1)!.result.winnerId;
 const placements=sport.frame.players.map(p=>{const loss=sport.frame.matches.find(m=>m.result.loserId===p.participantId);const round=loss?nodes[loss.slot-1].roundNumber:null;return{...p,firstPlace:p.participantId===winner?1:round===null?0:2**(rounds-round)+1,lastPlace:p.participantId===winner?1:round===null?0:Math.min(q,2**(rounds-round+1))};});
 const firstRoundLoserPlaces=sport.frame.matches.filter(m=>nodes[m.slot-1].roundNumber===1).flatMap(m=>{const p=placements.find(p=>p.participantId===m.result.loserId)!;return Array.from({length:p.lastPlace-p.firstPlace+1},(_,i)=>p.firstPlace+i);});
 const current={source:basis.basis.source,input:{...basis.basis.input,field:{status:'known' as const,qualifierCount:q,firstRoundLoserPlaces:[...new Set(firstRoundLoserPlaces)],entryFeeMinor:null}}};
 const calc=calculatePlayoffPrizeProposalsV2({...current,overrideHistory:w.head.overrideHistory},current);
 if(calc.status!=='proposal_review'||!calc.balanced||calc.zeroAwardBand||calc.rankOrderViolation||calc.equalTreatmentViolation||calc.winnerMultiplierRelationReviewRequired||!['not_applicable','satisfied'].includes(calc.comparison)||calc.manualDistributionChanged&&s.plan.method!=='graduated'||s.roundingUnitMinor!==calc.roundingStepMinor)return null;
 const groups=[...calc.proposedBands.map(g=>({firstPlace:g.firstPlace,lastPlace:g.lastPlace,people:g.people,included:true,perPersonMinor:g.perPersonMinor,groupTotalMinor:g.bandTotalMinor})),...calc.excludedBands.map(g=>({firstPlace:g.firstPlace,lastPlace:g.lastPlace,people:g.people,included:false,perPersonMinor:0,groupTotalMinor:0}))];
 if(!same(groups,s.groups)||!Array.isArray(s.recipients)||s.recipients.length!==q)return null;
 const expected=placements.map(p=>{const g=groups.find(g=>g.firstPlace===p.firstPlace&&g.lastPlace===p.lastPlace);if(!g)throw Error('placement');return{participantId:p.participantId,profileId:p.profileId,displayName:p.displayName,tournamentPlayerId:p.tournamentPlayerId,firstPlace:p.firstPlace,lastPlace:p.lastPlace,included:g.included,amountMinor:g.perPersonMinor};});
 const sorted=(v:unknown[])=>[...v].sort((a,b)=>String((a as {participantId:string}).participantId).localeCompare(String((b as {participantId:string}).participantId)));
 if(!same(sorted(expected),sorted(s.recipients)))return null;
 const manualAdjustments=calc.proposedBands.filter(g=>g.perPersonMinor!==g.sourcePerPersonMinor).map(g=>({firstPlace:g.firstPlace,lastPlace:g.lastPlace,suggestedPerPersonMinor:g.sourcePerPersonMinor,reviewedPerPersonMinor:g.perPersonMinor,reason:String((head.overrideHistory as Array<Record<string,unknown>>).findLast(r=>r.firstPlace===g.firstPlace&&r.lastPlace===g.lastPlace)?.reason??'')}));
 const review=readModernPrizeReviewV2({kind:'modern-prize-review-v2',...scope,sourceDigest:s.sourceDigest,prizeRevisionId:w.head.revisionId,fundReviewId:f.reviewId,method:s.plan.method,methodParameterText:s.plan.method==='graduated'?s.plan.incrementFactorText:s.plan.method==='winner-multiplier'?s.plan.winnerMultiplierText:null,roundingUnitMinor:s.roundingUnitMinor,totalMinor:s.totalMinor,...(manualAdjustments.length?{manualAdjustments}:{}),groups:groups.map(g=>({...g,members:expected.filter(p=>p.firstPlace===g.firstPlace&&p.lastPlace===g.lastPlace).map(p=>({participantId:p.participantId,displayName:p.displayName,tournamentPlayerId:p.tournamentPlayerId}))}))},scope);if(!review)return null;
 if(value.status==='review')return value.record===null?{workspace:{status:'review',review},results:null}:null;
 const r=value.record;if(!obj(r)||r.kind!=='selected-step-award-record-v3'||r.tournamentId!==scope.tournamentId||r.eventId!==scope.eventId||!uuid(r.awardSetId)||!same(r.sourceCapture,s)||r.sourceDigest!==s.sourceDigest||r.fundReviewId!==f.reviewId||r.prizeRevisionId!==w.head.revisionId||!same(r.groups,groups)||!Array.isArray(r.recipients)||!same(sorted(r.recipients),sorted(expected))||r.status!=='recorded_unpaid'||r.historicalReceipt!==true||r.currentSourceVerified!==false||r.moneyMoved!==false||r.payoutAuthorized!==false||typeof r.recordedAt!=='string'||!Number.isFinite(Date.parse(r.recordedAt)))return null;
 const results:ModernPrizeResultsV2={status:'available',eventKind:basis.basis.source.eventKind,method:review.method,directorAdjusted:calc.manualDistributionChanged,roundingUnitMinor:review.roundingUnitMinor,totalMinor:review.totalMinor,recordedAt:r.recordedAt,sourceObservation:'locked_database_capture',moneyMoved:false,payoutAuthorized:false,groups:review.groups.map(g=>({firstPlace:g.firstPlace,lastPlace:g.lastPlace,included:g.included,perPersonMinor:g.perPersonMinor,groupTotalMinor:g.groupTotalMinor,members:g.members.map(p=>({name:p.displayName,tournamentPlayerId:p.tournamentPlayerId}))}))};
 return{workspace:{status:'recorded',awardSetId:r.awardSetId as string,review},results:observation==='current'?results:null};
}catch{return null;}}
export function projectSelectedStepAwardWorkspaceV3(value:unknown,scope:ModernPrizeScopeV2,expectedQualificationId?:string){return projectEvidence(value,scope,expectedQualificationId,'current');}
/** Decode the actual immutable private record for exact outcome recovery only.
 * This never produces current Results or promotes historical evidence. */
export function projectSelectedStepAwardHistoryV3(record:unknown,scope:ModernPrizeScopeV2){if(!obj(record))return null;const v=projectEvidence({kind:'selected-step-award-history-v3',status:'recorded',...scope,source:record.sourceCapture,record,currentSourceVerified:false,moneyMoved:false,payoutAuthorized:false},scope,undefined,'historical');return v?.workspace.status==='recorded'?v.workspace:null;}
