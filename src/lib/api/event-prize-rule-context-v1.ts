import {isEventPrizeResponseValueV1,isEventPrizeWireValueV1} from './event-prize-settings-v1.ts';
import {isEventPlayoffParametersDraftV1,resolveEventSeriesDraftV1,type EventPlayoffParametersDraftV1} from '../playoffs/event-playoff-parameters-v1.ts';
import {assessSeriesForSetupReviewV2} from '../playoffs/series-activation-review-v2.ts';
import type {SeriesRuleContextV1} from '../playoffs/series-settings-v1.ts';
import {readEventPrizeActivationSourceV1} from './event-prize-activation-v1.ts';
export type EventPrizeRuleContextPinsV1={setupRevisionId:string;setupVersion:number;settingsSnapshotId:string;settingsDigest:string};
export type EventPrizeRuleContextRequestV1={kind:'event-rule-context-v1';operationId:string;expectedReviewId:string|null;setupRevisionId:string;settingsSnapshotId:string;eventClientRowId:string;context:SeriesRuleContextV1;reason:string;approvalReference:string;confirmed:true};
export type EventPrizeRuleContextReviewV1={state:'absent';historyExists:false}|{state:'present';historyExists:true;reviewId:string;actorId:string;version:number;setupRevisionId:string;setupEventVersionId:string;settingsSnapshotId:string;draftDigest:string;draft:EventPlayoffParametersDraftV1;context:SeriesRuleContextV1;reason:string;approvalReference:string;reviewerAuthorized:boolean;current:boolean;eligible:boolean;deferredOriginalField:boolean};
export type EventPrizeRuleContextRowV1={eventClientRowId:string;eventKind:'main'|'consolation';setupEventVersionId:string;displayName:string;draft:EventPlayoffParametersDraftV1;review:EventPrizeRuleContextReviewV1};
export type EventPrizeRuleContextWorkspaceV1=EventPrizeRuleContextPinsV1&{kind:'event-prize-rule-context-workspace-v1';actorId:string;tournamentId:string;rows:EventPrizeRuleContextRowV1[];deferredGuardAvailable:boolean;allCurrentEligible:boolean;activationAllowed:false;moneyMoved:false};
export type EventPrizeRuleContextOperationV1={kind:'event-prize-rule-context-operation-v1';actorId:string;tournamentId:string;operationId:string;request:EventPrizeRuleContextRequestV1;result:Record<string,unknown>};
export type EventPrizeRuleContextPendingV1=EventPrizeRuleContextPinsV1&{kind:'event-prize-rule-context-pending-v1';actorId:string;tournamentId:string;eventClientRowId:string;request:EventPrizeRuleContextRequestV1};
export type EventPrizeRuleContextReadyReviewsV1=EventPrizeRuleContextPinsV1&{kind:'event-prize-rule-context-ready-reviews-v1';actorId:string;tournamentId:string;reviews:Array<{eventClientRowId:string;reviewId:string;draftDigest:string;reviewedDraft:EventPlayoffParametersDraftV1;current:true;context:SeriesRuleContextV1}>};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0&&Number(v)<=2147483647;
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const context=(v:unknown):v is SeriesRuleContextV1=>exact(v,['sanctioned','eventKind','durationDays','originalEntrants'])&&typeof v.sanctioned==='boolean'&&['main','consolation'].includes(v.eventKind as string)&&positive(v.durationDays)&&v.originalEntrants===null;
const reason=(v:unknown)=>typeof v==='string'&&v.length>=1&&v.length<=500&&v===v.trim()&&!/[\u0000-\u001f\u007f]/.test(v);
const reference=(v:unknown)=>typeof v==='string'&&v.length<=1000;
const pins=(v:Record<string,unknown>)=>uuid(v.setupRevisionId)&&positive(v.setupVersion)&&uuid(v.settingsSnapshotId)&&hash(v.settingsDigest);
export const eventPrizeRuleContextEnabledV1=()=>false;
export const eventPrizeRuleContextPendingKeyV1=(actorId:string,tournamentId:string,eventClientRowId:string)=>`prize-context-review:${actorId}:${tournamentId}:${eventClientRowId}`;
export function isEventPrizeRuleContextRequestV1(v:unknown):v is EventPrizeRuleContextRequestV1{
 try{return isEventPrizeWireValueV1(v)&&exact(v,['kind','operationId','expectedReviewId','setupRevisionId','settingsSnapshotId','eventClientRowId','context','reason','approvalReference','confirmed'])&&v.kind==='event-rule-context-v1'&&v.confirmed===true&&uuid(v.operationId)&&(v.expectedReviewId===null||uuid(v.expectedReviewId))&&uuid(v.setupRevisionId)&&uuid(v.settingsSnapshotId)&&uuid(v.eventClientRowId)&&context(v.context)&&reason(v.reason)&&reference(v.approvalReference);}catch{return false;}
}
export function readEventPrizeRuleContextWorkspaceV1(v:unknown,actorId:string,tournamentId:string,expected?:EventPrizeRuleContextPinsV1):EventPrizeRuleContextWorkspaceV1|null{
 try{
  if(!uuid(actorId)||!uuid(tournamentId)||!isEventPrizeResponseValueV1(v)||!exact(v,['kind','actorId','tournamentId','setupRevisionId','setupVersion','settingsSnapshotId','settingsDigest','rows','deferredGuardAvailable','allCurrentEligible','activationAllowed','moneyMoved'])||v.kind!=='event-prize-rule-context-workspace-v1'||v.actorId!==actorId||v.tournamentId!==tournamentId||!pins(v)||typeof v.deferredGuardAvailable!=='boolean'||typeof v.allCurrentEligible!=='boolean'||v.activationAllowed!==false||v.moneyMoved!==false||!Array.isArray(v.rows)||v.rows.length<1||v.rows.length>32)return null;
  if(expected&&(['setupRevisionId','setupVersion','settingsSnapshotId','settingsDigest']as const).some(k=>v[k]!==expected[k]))return null;
  const seen=new Set<string>();let all=true;
  for(const r of v.rows){
   if(!exact(r,['eventClientRowId','eventKind','setupEventVersionId','displayName','draft','review'])||!uuid(r.eventClientRowId)||seen.has(r.eventClientRowId)||!['main','consolation'].includes(r.eventKind as string)||!uuid(r.setupEventVersionId)||typeof r.displayName!=='string'||!r.displayName.trim()||r.displayName.length>200||!isEventPlayoffParametersDraftV1(r.draft))return null;seen.add(r.eventClientRowId);
   const q=r.review;if(exact(q,['state','historyExists'])&&q.state==='absent'&&q.historyExists===false){all=false;continue;}
   if(!exact(q,['state','historyExists','reviewId','actorId','version','setupRevisionId','setupEventVersionId','settingsSnapshotId','draftDigest','draft','context','reason','approvalReference','reviewerAuthorized','current','eligible','deferredOriginalField'])||q.state!=='present'||q.historyExists!==true||!uuid(q.reviewId)||!uuid(q.actorId)||!positive(q.version)||!uuid(q.setupRevisionId)||!uuid(q.setupEventVersionId)||!uuid(q.settingsSnapshotId)||!hash(q.draftDigest)||!isEventPlayoffParametersDraftV1(q.draft)||!context(q.context)||!reason(q.reason)||!reference(q.approvalReference)||typeof q.reviewerAuthorized!=='boolean'||typeof q.current!=='boolean'||typeof q.eligible!=='boolean'||typeof q.deferredOriginalField!=='boolean')return null;
   const current=q.reviewerAuthorized&&q.setupRevisionId===v.setupRevisionId&&q.setupEventVersionId===r.setupEventVersionId&&q.settingsSnapshotId===v.settingsSnapshotId&&q.context.eventKind===r.eventKind&&canonical(q.draft)===canonical(r.draft);
   const series=resolveEventSeriesDraftV1(q.draft),assessment=series?assessSeriesForSetupReviewV2(series,q.context):null,deferred=!!assessment?.deferredRequirements.length;
   const eligible=current&&assessment?.setupReviewEligible===true&&(!deferred||v.deferredGuardAvailable);
   if(q.current!==current||q.eligible!==eligible||q.deferredOriginalField!==deferred)return null;
   all=all&&eligible;
  }
  return v.allCurrentEligible===all?freeze(structuredClone(v) as EventPrizeRuleContextWorkspaceV1):null;
 }catch{return null;}
}
/** Evidence of exactly which saved contexts the operator's panel displayed.
 * It is compared with a fresh activation source before retaining confirmation;
 * a boolean readiness flag cannot authorize silently adopting a newer review. */
export function eventPrizeRuleContextReadyReviewsV1(value:unknown,actorId:string,tournamentId:string):EventPrizeRuleContextReadyReviewsV1|null{
 const w=readEventPrizeRuleContextWorkspaceV1(value,actorId,tournamentId);if(!w?.allCurrentEligible)return null;
 const reviews=w.rows.map(row=>{const r=row.review;if(r.state!=='present'||!r.current||!r.eligible)throw Error('invalid_current_review');return{eventClientRowId:row.eventClientRowId,reviewId:r.reviewId,draftDigest:r.draftDigest,reviewedDraft:structuredClone(r.draft),current:true as const,context:structuredClone(r.context)};}).sort((a,b)=>a.eventClientRowId.localeCompare(b.eventClientRowId));
 return freeze({kind:'event-prize-rule-context-ready-reviews-v1',actorId,tournamentId,setupRevisionId:w.setupRevisionId,setupVersion:w.setupVersion,settingsSnapshotId:w.settingsSnapshotId,settingsDigest:w.settingsDigest,reviews});
}
export function eventPrizeRuleContextReviewsMatchV1(ready:unknown,source:unknown):boolean{
 try{
  if(!isEventPrizeResponseValueV1(ready)||!exact(ready,['kind','actorId','tournamentId','setupRevisionId','setupVersion','settingsSnapshotId','settingsDigest','reviews'])||ready.kind!=='event-prize-rule-context-ready-reviews-v1'||!uuid(ready.actorId)||!uuid(ready.tournamentId)||!pins(ready)||!Array.isArray(ready.reviews)||ready.reviews.length<1||ready.reviews.length>32)return false;
  const seen=new Set<string>();for(const r of ready.reviews){if(!exact(r,['eventClientRowId','reviewId','draftDigest','reviewedDraft','current','context'])||!uuid(r.eventClientRowId)||seen.has(r.eventClientRowId)||!uuid(r.reviewId)||!hash(r.draftDigest)||!isEventPlayoffParametersDraftV1(r.reviewedDraft)||r.current!==true||!context(r.context))return false;seen.add(r.eventClientRowId);}
  const s=readEventPrizeActivationSourceV1(source,ready.actorId,ready.tournamentId);if(!s||s.workspace.base.setupRevisionId!==ready.setupRevisionId||s.workspace.base.setupVersion!==ready.setupVersion||s.workspace.settings.state!=='present'||s.workspace.settings.id!==ready.settingsSnapshotId||s.workspace.settings.digest!==ready.settingsDigest)return false;
  const sort=(reviews:unknown[])=>[...reviews].sort((a,b)=>(a as{eventClientRowId:string}).eventClientRowId.localeCompare((b as{eventClientRowId:string}).eventClientRowId));
  return canonical(sort(ready.reviews))===canonical(sort(s.reviews));
 }catch{return false;}
}
export function readEventPrizeRuleContextOperationV1(v:unknown,actorId:string,tournamentId:string,request:EventPrizeRuleContextRequestV1):EventPrizeRuleContextOperationV1|null{
 try{
  if(!uuid(actorId)||!uuid(tournamentId)||!isEventPrizeRuleContextRequestV1(request)||!isEventPrizeResponseValueV1(v)||!exact(v,['kind','actorId','tournamentId','operationId','request','result'])||v.kind!=='event-prize-rule-context-operation-v1'||v.actorId!==actorId||v.tournamentId!==tournamentId||v.operationId!==request.operationId||canonical(v.request)!==canonical(request)||!object(v.result))return null;
  const r=v.result;if(r.actorId!==actorId||r.tournamentId!==tournamentId||r.operationId!==request.operationId||canonical(r.request)!==canonical(request)||r.officialApprovalClaimed!==false||r.activationAllowed!==false||r.moneyMoved!==false)return null;
  if(r.status==='context_recorded'){
   if(!uuid(r.reviewId)||!positive(r.version)||r.priorReviewId!==request.expectedReviewId||r.provenance!=='director_declared'||canonical(r.context)!==canonical(request.context)||!exact(r.source,['tournamentId','setupRevisionId','settingsSnapshotId','eventClientRowId','setupEventVersionId','draftDigest'])||r.source.tournamentId!==tournamentId||r.source.setupRevisionId!==request.setupRevisionId||r.source.settingsSnapshotId!==request.settingsSnapshotId||r.source.eventClientRowId!==request.eventClientRowId||!uuid(r.source.setupEventVersionId)||!hash(r.source.draftDigest))return null;
  }else if(r.status!=='rejected'||typeof r.code!=='string')return null;
  return freeze(structuredClone(v) as EventPrizeRuleContextOperationV1);
 }catch{return null;}
}
export function serializeEventPrizeRuleContextPendingV1(v:unknown):string|null{
 try{return isEventPrizeWireValueV1(v)&&exact(v,['kind','actorId','tournamentId','eventClientRowId','setupRevisionId','setupVersion','settingsSnapshotId','settingsDigest','request'])&&v.kind==='event-prize-rule-context-pending-v1'&&uuid(v.actorId)&&uuid(v.tournamentId)&&uuid(v.eventClientRowId)&&pins(v)&&isEventPrizeRuleContextRequestV1(v.request)&&v.request.eventClientRowId===v.eventClientRowId&&v.request.setupRevisionId===v.setupRevisionId&&v.request.settingsSnapshotId===v.settingsSnapshotId?canonical(v):null;}catch{return null;}
}
export function parseEventPrizeRuleContextPendingV1(raw:unknown,actorId:string,tournamentId:string,eventClientRowId:string):EventPrizeRuleContextPendingV1|null{
 try{if(typeof raw!=='string'||new TextEncoder().encode(raw).length>1_000_000)return null;const v=JSON.parse(raw);return serializeEventPrizeRuleContextPendingV1(v)===raw&&v.actorId===actorId&&v.tournamentId===tournamentId&&v.eventClientRowId===eventClientRowId?freeze(v):null;}catch{return null;}
}
/** A current accepted receipt must match the actual latest reviewed row. A
 * stale/rejected confirmed journal can be resolved explicitly after fresh
 * current source readback; unknown/unmatched responses never qualify. */
export function inspectEventPrizeRuleContextReadbackV1(pending:EventPrizeRuleContextPendingV1,operation:unknown,fresh:unknown){
 const fail={status:'unverified' as const,canClear:false as const};
 if(!serializeEventPrizeRuleContextPendingV1(pending))return fail;
 const op=readEventPrizeRuleContextOperationV1(operation,pending.actorId,pending.tournamentId,pending.request),w=readEventPrizeRuleContextWorkspaceV1(fresh,pending.actorId,pending.tournamentId);if(!op||!w)return fail;
 const r=w.rows.find(x=>x.eventClientRowId===pending.eventClientRowId),q=r?.review;
 const sameSource=w.setupRevisionId===pending.setupRevisionId&&w.setupVersion===pending.setupVersion&&w.settingsSnapshotId===pending.settingsSnapshotId&&w.settingsDigest===pending.settingsDigest;
 if(sameSource&&(!r||(op.result.status==='context_recorded'&&(q?.state!=='present'||(op.result.source as Record<string,unknown>).setupEventVersionId!==r.setupEventVersionId))))return fail;
 const sameReview=op.result.status==='context_recorded'&&sameSource&&q?.state==='present'&&q.reviewId===op.result.reviewId;
 const immutableMatches=sameReview&&q.version===op.result.version&&q.actorId===pending.actorId&&q.draftDigest===(op.result.source as Record<string,unknown>).draftDigest&&canonical(q.context)===canonical(pending.request.context)&&q.reason===pending.request.reason&&q.approvalReference===pending.request.approvalReference;
 if(sameReview&&!immutableMatches)return fail;
 const matches=immutableMatches&&q?.state==='present'&&q.current;
 return matches?{status:'verified_current' as const,canClear:true as const,requiresExplicitResolution:false as const,workspace:w}:{status:'verified_historical' as const,canClear:true as const,requiresExplicitResolution:true as const,workspace:w};
}
