import 'server-only';
import {readJointExpenseIntentV3} from './joint-expense-intent-v3.ts';
import{isConsolationOwnershipCaptureV3}from'./selected-step-prize-source-v3.ts';
import{isModernPrizeScopeV2,modernPrizeSameV2,type ModernPrizeScopeV2}from'./modern-prize-journal-contract-v2.ts';
import{ownershipObject as object,readSelectedStepOwnershipReviewV3,readSelectedStepOwnershipAttemptV3,readSelectedStepOwnershipReceiptV3,type SelectedStepOwnershipAttemptV3,type SelectedStepOwnershipWorkspaceV3}from'./selected-step-ownership-contract-v3.ts';
type Client={auth:{getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type Service=(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
type Options={authenticated:Client;serviceRpc:Service;scope:ModernPrizeScopeV2;enabled:()=>boolean;writesVerified:()=>boolean};
/** Private evidence stays on the server; only actual separate receipt totals and
 * cost rows needed for classification are projected to this Director form. */
export function projectSelectedStepOwnershipReviewV3(v:unknown,s:ModernPrizeScopeV2,version:unknown,priorRevisionId:unknown,reviewIsCurrent:unknown){
 if(!isModernPrizeScopeV2(s)||!object(v)||v.status!=='ownership_source_available'||v.kind!=='selected-step-pool-ownership-source-v3'||!Object.entries(s).every(([k,x])=>v[k]===x)||v.moneyMoved!==false||v.bankReceiptVerified!==false||v.finalizationAuthorized!==false||!object(v.capture)||(v.capture.kind!==v.kind&&!isConsolationOwnershipCaptureV3(v.capture,s))||v.capture.tournamentId!==s.tournamentId||v.capture.eventId!==s.eventId||v.capture.refundPolicy!=='no-pool-refunds-v1'||!object(v.capture.basis))return null;
 const joint=v.capture.basis.jointExpenseIntent;
 if(joint!==undefined&&(!object(joint)||typeof joint.consolationEventId!=='string'||!readJointExpenseIntentV3(joint,{tournamentId:s.tournamentId,mainEventId:s.eventId,consolationEventId:joint.consolationEventId})))return null;
 return readSelectedStepOwnershipReviewV3({kind:'selected-step-ownership-review-v3',sourceDigest:v.sourceDigest,version,priorRevisionId,reviewIsCurrent,costs:(v.capture.kind==='selected-step-consolation-ownership-source-v3'||joint!==undefined)&&Array.isArray(v.capture.basis.expenses)?v.capture.basis.expenses.map(c=>object(c)?{expenseEventId:c.expenseEventId,description:c.description,amountMinor:c.amountMinor}:null):v.capture.basis.expenses,funds:v.funds,moneyMoved:false,finalizationAuthorized:false});
}
export function createSelectedStepOwnershipProviderV3(o:Options){
 if(!isModernPrizeScopeV2(o.scope))throw Error('invalid_scope');const s=Object.freeze({...o.scope});
 async function authorized(){try{if(!o.enabled())return false;const b=await o.authenticated.auth.getUser();if(b.error||b.data?.user?.id!==s.actorId)return false;const role=await o.authenticated.rpc('get_tournament_role',{p_tournament_id:s.tournamentId});const a=await o.authenticated.auth.getUser();return !role.error&&role.data==='director'&&!a.error&&a.data?.user?.id===s.actorId&&o.enabled();}catch{return false;}}
 async function call(name:string,args:Record<string,unknown>,write=false){if(!await authorized())throw Error('permission_required');if(!o.enabled()||write&&!o.writesVerified())throw Error('disabled');let r;try{r=await o.serviceRpc(name,args);}catch{throw Error('outcome_unknown');}if(r.error||!await authorized()||write&&!o.writesVerified())throw Error('outcome_unknown');return r.data;}
 return{
  async read():Promise<SelectedStepOwnershipWorkspaceV3>{const v=await call('get_selected_step_pool_ownership_workspace_provider_v3',{actor:s.actorId,tid:s.tournamentId,eid:s.eventId});if(object(v)&&v.kind==='selected-step-pool-ownership-workspace-v3'&&Object.entries(s).every(([k,x])=>v[k]===x)&&v.moneyMoved===false&&v.finalizationAuthorized===false){const review=projectSelectedStepOwnershipReviewV3(v.source,s,v.version,v.priorRevisionId,v.reviewIsCurrent);if(review)return{status:'review',review};}
   return{status:'held',code:object(v)&&typeof v.code==='string'&&/^[a-z0-9_]{1,100}$/.test(v.code)?v.code:'ownership_source_unverified'};
  },
  async send(value:SelectedStepOwnershipAttemptV3,recover:boolean){const a=readSelectedStepOwnershipAttemptV3(value,s);if(!a)throw Error('invalid_attempt');if(!o.enabled()||!o.writesVerified())throw Error('disabled');const args={actor:s.actorId,tid:s.tournamentId,eid:s.eventId,op:a.operationId,request:a.request};
   if(!recover){const r=await call('save_selected_step_pool_ownership_provider_v3',args,true);if(!readSelectedStepOwnershipReceiptV3(r,a)){if(object(r)&&['rejected','retry_exact'].includes(r.status as string)&&typeof r.code==='string'&&/^[a-z0-9_]{1,100}$/.test(r.code))return{status:r.status,attempt:a,code:r.code};throw Error('outcome_unknown');}}
   const p=await call('get_selected_step_pool_ownership_proof_provider_v3',args,true);
   if(object(p)&&p.status==='unknown')return{status:'unknown',attempt:a,code:'operation_unverified'};
   if(object(p)&&['rejected','retry_exact'].includes(p.status as string)&&typeof p.code==='string'&&/^[a-z0-9_]{1,100}$/.test(p.code))return{status:p.status,attempt:a,code:p.code};
   if(!object(p)||p.historicalReceipt!==true||p.currentSourceVerified!==false||p.moneyMoved!==false||!modernPrizeSameV2(p.request,a.request))throw Error('outcome_unknown');
   const receipt=readSelectedStepOwnershipReceiptV3(p.receipt,a),review=projectSelectedStepOwnershipReviewV3(p.sourceCapture,s,p.expectedVersion,p.priorRevisionId,false);
   if(!receipt||!review||!modernPrizeSameV2(review,a.review))throw Error('outcome_unknown');return{status:'accepted',attempt:a,receipt,reviewedSource:review};
  },
 };
}
