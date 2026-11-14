import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import{isModernPrizeScopeV2,type ModernPrizeScopeV2}from'../finance/modern-prize-journal-contract-v2.ts';
import{projectSelectedStepPoolSourceV3}from'../finance/selected-step-pool-source-v3.ts';
import type{SelectedStepPoolReviewV3}from'../finance/selected-step-pool-contract-v3.ts';
export const selectedStepPoolResultsEnabledV3=()=>integratedTestFeatureEnabled();
export type SelectedStepPoolResultsV3={status:'available';recordedAt:string;review:Pick<SelectedStepPoolReviewV3,'pools'|'qMinor'|'sideMinor'|'totalMinor'>;sourceObservation:'locked_current_source';moneyMoved:false;payoutAuthorized:false};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
/** The SQL producer owns locked currentness proof. Only compact reviewed awards
 * cross into the display; receipt captures, participants and reviewer IDs do not. */
export function projectSelectedStepPoolResultsV3(v:unknown,s:ModernPrizeScopeV2,qualificationId:string):SelectedStepPoolResultsV3|null{try{
 if(!isModernPrizeScopeV2(s)||!uuid(qualificationId)||!exact(v,['kind','status','actorId','tournamentId','eventId','qualificationResultVersionId','finalId','recordedAt','sourceCapture','snapshotConsistency','currentSourceVerified','historicalOnly','moneyMoved','payoutAuthorized','writeAuthorized'])||v.kind!=='current-selected-step-pool-results-v3'||v.status!=='source_available'||!Object.entries(s).every(([k,x])=>v[k]===x)||v.qualificationResultVersionId!==qualificationId||!uuid(v.finalId)||v.snapshotConsistency!=='locked_source_snapshot'||v.currentSourceVerified!==true||v.historicalOnly!==false||v.moneyMoved!==false||v.payoutAuthorized!==false||v.writeAuthorized!==false||typeof v.recordedAt!=='string'||!/^\d{4}-\d\d-\d\dT/.test(v.recordedAt)||!Number.isFinite(Date.parse(v.recordedAt)))return null;
 const review=projectSelectedStepPoolSourceV3(v.sourceCapture,s);if(!review||review.qualificationResultVersionId!==qualificationId)return null;
 return{status:'available',recordedAt:v.recordedAt,review:{pools:review.pools,qMinor:review.qMinor,sideMinor:review.sideMinor,totalMinor:review.totalMinor},sourceObservation:'locked_current_source',moneyMoved:false,payoutAuthorized:false};
}catch{return null;}}
type Client={auth:{getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type Service=(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
export async function readSelectedStepPoolResultsV3(o:{authenticated:Client;serviceRpc:Service;scope:ModernPrizeScopeV2;qualificationId:string;enabled:()=>boolean}):Promise<SelectedStepPoolResultsV3|null>{
 if(!o.enabled()||!isModernPrizeScopeV2(o.scope)||!uuid(o.qualificationId))return null;const s=Object.freeze({...o.scope}),qid=o.qualificationId;
 async function authorized(){if(!o.enabled())return false;const b=await o.authenticated.auth.getUser();if(b.error||b.data?.user?.id!==s.actorId)return false;const r=await o.authenticated.rpc('get_tournament_role',{p_tournament_id:s.tournamentId});const a=await o.authenticated.auth.getUser();return !r.error&&r.data==='director'&&!a.error&&a.data?.user?.id===s.actorId&&o.enabled();}
 try{if(!await authorized())return null;const r=await o.serviceRpc('get_selected_step_pool_results_provider_v3',{actor:s.actorId,tid:s.tournamentId,eid:s.eventId});if(r.error||!await authorized())return null;return projectSelectedStepPoolResultsV3(r.data,s,qid);}catch{return null;}
}
