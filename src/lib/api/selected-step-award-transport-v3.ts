import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import'server-only';
import{requireVerifiedIdentity}from'./verified-subject.ts';
import{readModernPrizeAttemptV2,modernPrizeSameV2 as same,type ModernPrizeScopeV2,type ModernPrizeWorkspaceV2,type ModernPrizeReplyV2}from'../finance/modern-prize-journal-contract-v2.ts';
import{projectSelectedStepAwardWorkspaceV3,projectSelectedStepAwardHistoryV3}from'../finance/selected-step-award-view-v3.ts';
type Client={auth:{getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown}}|null;error:unknown}>;getUser:()=>Promise<{data:{user:{id:string}|null};error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type Service=(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
export const selectedStepAwardPageEnabledV3=()=>integratedTestFeatureEnabled();
export const selectedStepAwardRoutesEnabledV3=()=>integratedTestFeatureEnabled();
export const selectedStepAwardWritesVerifiedV3=()=>integratedTestFeatureEnabled();
export const selectedStepAwardResultsEnabledV3=()=>integratedTestFeatureEnabled();
export function createSelectedStepAwardTransportV3(normal:Client,service:Service,scope:ModernPrizeScopeV2,flags:{read:()=>boolean;write:()=>boolean}){
 const fixed=Object.freeze({...scope});let pinned:string|null=null;
 const auth=async()=>{if(!flags.read())throw Error('disabled');const identity=await requireVerifiedIdentity(normal),user=await normal.auth.getUser();if(!identity||identity.subject!==fixed.actorId||user.error||user.data.user?.id!==fixed.actorId||pinned!==null&&identity.sessionId!==pinned)throw Error('identity_changed');const role=await normal.rpc('get_tournament_role',{p_tournament_id:fixed.tournamentId});if(role.error||role.data!=='director')throw Error('permission_required');pinned=identity.sessionId;return identity;};
 const rpc=async(name:string,args:Record<string,unknown>)=>{const before=await auth();const r=await service(name,{actor:fixed.actorId,sid:before.sessionId,tid:fixed.tournamentId,eid:fixed.eventId,...args});await auth();if(r.error||!flags.read())throw Error('provider_unavailable');return r.data;};
 const read=async(expectedQualificationId?:string)=>{const raw=await rpc('get_selected_step_award_workspace_provider_v3',{}),view=projectSelectedStepAwardWorkspaceV3(raw,fixed,expectedQualificationId);if(!view)throw Error('invalid_current_source');return view;};
 return{read:async():Promise<ModernPrizeWorkspaceV2>=>(await read()).workspace,results:async(qid:string)=>(await read(qid)).results,
  async save(value:unknown):Promise<ModernPrizeReplyV2>{const attempt=readModernPrizeAttemptV2(value,fixed);if(!attempt)throw Error('invalid_attempt');if(!flags.write())return{status:'rejected',attempt,code:'database_verification_pending'};
   const recover=async():Promise<ModernPrizeReplyV2|null>=>{const raw=await rpc('get_selected_step_award_operation_provider_v3',{op:attempt.operationId,request:attempt.request});if(!raw||typeof raw!=='object')throw Error('outcome_unknown');const e=raw as Record<string,unknown>;
    if(e.status==='unknown'&&e.code==='operation_not_found')return null;
    if(e.status==='retry_exact'&&typeof e.code==='string'&&/^[a-z0-9_]{1,100}$/.test(e.code))return{status:'retry_exact',attempt,code:e.code};
    if(e.kind!=='selected-step-award-operation-v3'||e.actorId!==fixed.actorId||e.tournamentId!==fixed.tournamentId||e.eventId!==fixed.eventId||e.operationId!==attempt.operationId||!same(e.request,attempt.request)||e.historicalReceipt!==true||e.currentSourceVerified!==false)throw Error('unbound_operation');
    if(!e.result||typeof e.result!=='object')throw Error('outcome_unknown');const r=e.result as Record<string,unknown>;
    if(r.status!=='accepted'||r.kind!=='selected-step-award-receipt-v3'||r.actorId!==fixed.actorId||r.tournamentId!==fixed.tournamentId||r.eventId!==fixed.eventId||r.operationId!==attempt.operationId||!same(r.request,attempt.request)||r.sourceDigest!==attempt.review.sourceDigest||r.prizeRevisionId!==attempt.review.prizeRevisionId||r.fundReviewId!==attempt.review.fundReviewId||r.totalMinor!==attempt.review.totalMinor||r.moneyMoved!==false||r.payoutAuthorized!==false||r.recordedUnpaid!==true||r.historicalReceipt!==true||r.currentSourceVerified!==false)throw Error('unbound_receipt');
    const saved=projectSelectedStepAwardHistoryV3(e.record,fixed);if(!saved||saved.status!=='recorded'||saved.awardSetId!==r.awardSetId||!same(saved.review,attempt.review))throw Error('record_unverified');return{status:'accepted',attempt,awardSetId:saved.awardSetId,record:saved.review};};
   const prior=await recover();if(prior)return prior;
   const current=(await read()).workspace;if(current.status==='held'||!same(current.review,attempt.review))return{status:'rejected',attempt,code:'review_source_changed'};
   if(!flags.write())throw Error('write_gate_changed');const raw=await rpc('record_selected_step_awards_provider_v3',{op:attempt.operationId,request:attempt.request});if(!flags.write())throw Error('write_gate_changed');
   if(!raw||typeof raw!=='object')throw Error('outcome_unknown');const r=raw as Record<string,unknown>;
   if((r.status==='rejected'||r.status==='retry_exact')&&typeof r.code==='string'&&/^[a-z0-9_]{1,100}$/.test(r.code))return{status:r.status,attempt,code:r.code};
   if(r.status!=='accepted'||r.kind!=='selected-step-award-receipt-v3'||r.actorId!==fixed.actorId||r.tournamentId!==fixed.tournamentId||r.eventId!==fixed.eventId||r.operationId!==attempt.operationId||!same(r.request,attempt.request)||r.sourceDigest!==attempt.review.sourceDigest||r.prizeRevisionId!==attempt.review.prizeRevisionId||r.fundReviewId!==attempt.review.fundReviewId||r.totalMinor!==attempt.review.totalMinor||r.moneyMoved!==false||r.payoutAuthorized!==false||r.recordedUnpaid!==true||r.historicalReceipt!==true||r.currentSourceVerified!==false)throw Error('unbound_receipt');
   const saved=await recover();if(!saved||saved.status!=='accepted'||saved.awardSetId!==r.awardSetId)throw Error('record_unverified');return saved;
  }};
}
