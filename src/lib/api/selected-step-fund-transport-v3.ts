import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import'server-only';
import{requireVerifiedIdentity}from'./verified-subject.ts';
import{modernPrizeSameV2 as same}from'../finance/modern-prize-journal-contract-v2.ts';
import{projectSelectedStepFundV3}from'../finance/selected-step-fund-view-v3.ts';
import{readFundAttemptV3,readFundReceiptV3,fundObjectV3 as obj,type FundScopeV3,type FundAttemptV3,type FundReplyV3}from'../finance/selected-step-fund-contract-v3.ts';
type Client=Parameters<typeof requireVerifiedIdentity>[0]&{auth:{getUser:()=>Promise<{data:{user:{id:string}|null};error:unknown}>};rpc:(n:string,a:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type Service=(n:string,a:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
export const selectedStepFundEnabledV3=()=>integratedTestFeatureEnabled();
export const selectedStepFundWritesVerifiedV3=()=>integratedTestFeatureEnabled();
export function createSelectedStepFundTransportV3(normal:Client,service:Service,scope:FundScopeV3,flags:{read:()=>boolean;write:()=>boolean}){
 const fixed=Object.freeze({...scope});let pinned:string|null=null;
 const auth=async()=>{if(!flags.read())throw Error('disabled');const i=await requireVerifiedIdentity(normal),u=await normal.auth.getUser();if(!i||i.subject!==fixed.actorId||u.error||u.data.user?.id!==fixed.actorId||pinned!==null&&i.sessionId!==pinned)throw Error('identity_changed');const role=await normal.rpc('get_tournament_role',{p_tournament_id:fixed.tournamentId});if(role.error||role.data!=='director')throw Error('permission_required');pinned=i.sessionId;return i;};
 const rpc=async(n:string,args:Record<string,unknown>)=>{const i=await auth(),r=await service(n,{actor:fixed.actorId,sid:i.sessionId,tid:fixed.tournamentId,eid:fixed.eventId,...args});await auth();if(r.error)throw Error('provider_unavailable');return r.data;};
 const history=async(a:FundAttemptV3):Promise<FundReplyV3|null>=>{const r=await rpc('get_selected_step_fund_operation_provider_v3',{op:a.operationId,request:a.request});if(!obj(r))throw Error('outcome_unknown');if(r.status==='unknown'&&r.code==='operation_not_found')return null;if(r.status==='retry_exact')return readFundReceiptV3(r,a)??(()=>{throw Error('outcome_unknown');})();if(r.kind!=='selected-step-fund-operation-v3'||!Object.entries(fixed).every(([k,x])=>r[k]===x)||r.operationId!==a.operationId||!same(r.request,a.request)||r.historicalReceipt!==true||r.currentSourceVerified!==false)throw Error('unbound_history');const reply=readFundReceiptV3(r.result,a);if(!reply||reply.status!=='accepted')throw Error('unbound_receipt');return reply;};
 return{read:async(expenseId:string|null)=>{const v=projectSelectedStepFundV3(await rpc('get_selected_step_fund_workspace_provider_v3',{expense_id:expenseId}),fixed,expenseId);if(!v)throw Error('invalid_current_source');return v;},
  check:async(value:unknown)=>{const a=readFundAttemptV3(value,fixed);if(!a)throw Error('invalid_attempt');return await history(a)??{status:'retry_exact' as const,attempt:a,code:'operation_not_found'};},
  save:async(value:unknown):Promise<FundReplyV3>=>{const a=readFundAttemptV3(value,fixed);if(!a)throw Error('invalid_attempt');if(!flags.write())throw Error('writes_disabled');const prior=await history(a);if(prior)return prior;
   const raw=await rpc('record_selected_step_fund_provider_v3',{op:a.operationId,request:a.request});if(!flags.write())throw Error('writes_disabled');const receipt=readFundReceiptV3(raw,a);if(!receipt)throw Error('outcome_unknown');if(receipt.status!=='accepted')return receipt;const verified=await history(a);if(!verified||verified.status!=='accepted'||verified.reviewId!==receipt.reviewId)throw Error('record_unverified');return verified;
  }};
}
