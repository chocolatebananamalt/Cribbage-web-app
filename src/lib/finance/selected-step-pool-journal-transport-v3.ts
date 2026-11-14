import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import{isModernPrizeScopeV2,type ModernPrizeScopeV2}from'./modern-prize-journal-contract-v2.ts';
type Client={auth:{getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type Service=(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
import{isSelectedStepPoolRequestV3,readSelectedStepPoolReceiptV3,type SelectedStepPoolRequestV3}from'./selected-step-pool-contract-v3.ts';
export{isSelectedStepPoolRequestV3,readSelectedStepPoolReceiptV3}from'./selected-step-pool-contract-v3.ts';
export type{SelectedStepPoolRequestV3}from'./selected-step-pool-contract-v3.ts';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export const selectedStepPoolJournalTransportEnabledV3=()=>integratedTestFeatureEnabled();
/** No amounts/recipients are posted. Keep the exact operation/request after any
 * uncertain response; a historical receipt never establishes current funds. */
export function createSelectedStepPoolJournalTransportV3(o:{authenticated:Client;serviceRpc:Service;scope:ModernPrizeScopeV2;enabled:()=>boolean;writesVerified:()=>boolean}){
 if(!isModernPrizeScopeV2(o.scope))throw Error('invalid_scope');const s=Object.freeze({...o.scope});
 async function authorized(){try{if(!o.enabled())return false;const before=await o.authenticated.auth.getUser();if(before.error||before.data?.user?.id!==s.actorId)return false;const r=await o.authenticated.rpc('get_tournament_role',{p_tournament_id:s.tournamentId});const after=await o.authenticated.auth.getUser();return !r.error&&r.data==='director'&&!after.error&&after.data?.user?.id===s.actorId&&o.enabled();}catch{return false;}}
 async function perform(operationId:string,request:SelectedStepPoolRequestV3,recover:boolean){
  if(!o.enabled()||!o.writesVerified())throw Error('disabled');if(!uuid(operationId)||!isSelectedStepPoolRequestV3(request))throw Error('invalid_request');
  const retained=structuredClone(request);if(!await authorized())throw Error('permission_required');
  if(!o.enabled()||!o.writesVerified())throw Error('disabled');
  let result:unknown;try{const r=await o.serviceRpc(recover?'get_selected_step_pool_operation_provider_v3':'record_selected_step_pool_provider_v3',{actor:s.actorId,tid:s.tournamentId,eid:s.eventId,op:operationId,request:retained});if(r.error)throw Error('provider_error');result=r.data;}catch{throw Error('outcome_unknown');}
  if(!await authorized()||!o.writesVerified())throw Error('outcome_unknown');
  const receipt=readSelectedStepPoolReceiptV3(result,s,operationId,retained);if(receipt)return receipt;
  if(exact(result,['status','code'])&&['retry_exact','rejected'].includes(result.status as string)&&typeof result.code==='string'&&/^[a-z0-9_]{1,100}$/.test(result.code))return structuredClone(result);
  if(recover&&exact(result,['status','currentSourceVerified'])&&result.status==='unknown'&&result.currentSourceVerified===false)return{status:'unknown',currentSourceVerified:false};
  throw Error('outcome_unknown');
 }
 return{record:(operationId:string,request:SelectedStepPoolRequestV3)=>perform(operationId,request,false),recover:(operationId:string,request:SelectedStepPoolRequestV3)=>perform(operationId,request,true)};
}
