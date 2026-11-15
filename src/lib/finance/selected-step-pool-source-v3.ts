import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import {calculateSelectedStepPoolAmountsV3 as calculate} from '../results/selected-step-pool-amounts-v3.ts';
import {isModernPrizeScopeV2,type ModernPrizeScopeV2} from './modern-prize-journal-contract-v2.ts';

export const selectedStepPoolSourceEnabledV3=()=>integratedTestFeatureEnabled();
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const money=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&!Object.is(v,-0);
/** Server-only summary. Private receipt captures, consent references and reviewer
 * identities are not copied into the Director display model. The SQL producer
 * must prove current source; recomputing amounts does not establish that proof. */
export function projectSelectedStepPoolSourceV3(v:unknown,s:ModernPrizeScopeV2){
 if(!isModernPrizeScopeV2(s)||!object(v)||v.kind!=='current-selected-step-pool-source-v3'||v.status!=='source_available'||!Object.entries(s).every(([k,x])=>v[k]===x)||!hash(v.sourceDigest)||![v.ownershipRevisionId,v.qualificationResultVersionId,v.prizeSnapshotId].every(uuid)||!hash(v.prizeDigest)||v.liabilityScope!=='optional_pools_only'||v.refundPolicy!=='no-pool-refunds-v1'||v.directorReviewRequired!==true||v.moneyMoved!==false||v.payoutAuthorized!==false||v.bankReceiptVerified!==false||![v.qMinor,v.sideMinor,v.totalMinor].every(money)||!object(v.prizePlan)||!object(v.prizePlan.rounding)||!Array.isArray(v.pools)||!v.pools.length||v.pools.length>10000)return null;
 const pools:Array<{poolId:string;label:string;kind:'q'|'side';method:'q-equal'|'q-graduated'|'side-sheet';ratio:number|null;fundMinor:number;roundingUnitMinor:100|500|1000;recipients:Array<{name:string;tournamentPlayerId:string;amountMinor:number}>}>=[];
 const seen=new Set<string>(),people=new Map<string,string>(),fixed=new Map<string,string>();let q=BigInt(0),side=BigInt(0);
 for(const p of v.pools){
  if(!object(p)||!uuid(p.poolId)||seen.has(p.poolId)||typeof p.label!=='string'||!p.label.trim()||p.label!==p.label.trim()||p.label.length>200||/[\u0000-\u001f\u007f]/.test(p.label)||!['q','side'].includes(p.kind as string)||!uuid(p.operatingPolicyId)||!uuid(p.recipientReviewId)||!hash(p.recipientSourceDigest)||!object(p.policy)||p.policy.version!=='selected-step-pool-policy-v3'||p.policy.kind!==p.kind||!Array.isArray(p.paidParticipantIds)||!p.paidParticipantIds.length||p.paidParticipantIds.length>10000||!p.paidParticipantIds.every(uuid)||new Set(p.paidParticipantIds).size!==p.paidParticipantIds.length||!Array.isArray(p.recipients)||!p.recipients.length||p.recipients.length>10000||!object(p.calculation))return null;
  const unit=Number(v.prizePlan.rounding[p.kind==='q'?'qPool':'sidePool'])*100;
  if(p.policy.roundingUnitMinor!==unit)return null;
  const policy={kind:p.policy.kind,method:p.policy.method,feeMinor:p.policy.feeMinor,ratio:p.policy.ratio,roundingUnitMinor:p.policy.roundingUnitMinor};
  const a=calculate({policy,paidCount:p.paidParticipantIds.length,recipientCount:p.recipients.length});
  if(a.status!=='calculated'||p.calculation.status!=='calculated'||p.calculation.fundMinor!==a.fundMinor||!Array.isArray(p.calculation.awardsMinor)||p.calculation.awardsMinor.length!==a.awardsMinor.length||JSON.stringify(p.calculation.awardsMinor)!==JSON.stringify(a.awardsMinor))return null;
  const recipients:Array<{name:string;tournamentPlayerId:string;amountMinor:number}>=[],ids=new Set<string>();
  for(let i=0;i<p.recipients.length;i++){const r=p.recipients[i];if(!object(r)||!uuid(r.participantId)||ids.has(r.participantId)||!p.paidParticipantIds.includes(r.participantId)||typeof r.name!=='string'||!r.name.trim()||r.name!==r.name.trim()||r.name.length>200||/[\u0000-\u001f\u007f]/.test(r.name)||typeof r.tournamentPlayerId!=='string'||!/^[A-Z]-[1-9][0-9]{0,3}$/.test(r.tournamentPlayerId)||r.amountMinor!==a.awardsMinor[i]||people.has(r.participantId)&&people.get(r.participantId)!==r.tournamentPlayerId||fixed.has(r.tournamentPlayerId)&&fixed.get(r.tournamentPlayerId)!==r.participantId)return null;ids.add(r.participantId);people.set(r.participantId,r.tournamentPlayerId);fixed.set(r.tournamentPlayerId,r.participantId);recipients.push({name:r.name,tournamentPlayerId:r.tournamentPlayerId,amountMinor:a.awardsMinor[i]});}
  seen.add(p.poolId);if(p.kind==='q')q+=BigInt(a.fundMinor);else side+=BigInt(a.fundMinor);
  pools.push({poolId:p.poolId,label:p.label,kind:p.kind as 'q'|'side',method:a.policy.method,ratio:a.policy.ratio,fundMinor:a.fundMinor,roundingUnitMinor:a.roundingUnitMinor,recipients});
 }
 if(q!==BigInt(v.qMinor as number)||side!==BigInt(v.sideMinor as number)||q+side!==BigInt(v.totalMinor as number))return null;
 return{kind:'selected-step-pool-review-v3' as const,sourceDigest:v.sourceDigest as string,ownershipRevisionId:v.ownershipRevisionId as string,qualificationResultVersionId:v.qualificationResultVersionId as string,prizeSnapshotId:v.prizeSnapshotId as string,pools,qMinor:Number(q),sideMinor:Number(side),totalMinor:Number(q+side),directorReviewRequired:true as const,moneyMoved:false as const,payoutAuthorized:false as const};
}
type Client={auth:{getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type Service=(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
/** Injected trusted server port only; no credential or browser session forwarding. */
export async function collectSelectedStepPoolSourceV3(o:{authenticated:Client;serviceRpc:Service;scope:ModernPrizeScopeV2;enabled:()=>boolean}){
 if(!o.enabled()||!isModernPrizeScopeV2(o.scope))return null;const s=Object.freeze({...o.scope});
 async function authorized(){if(!o.enabled())return false;const before=await o.authenticated.auth.getUser();if(before.error||before.data?.user?.id!==s.actorId)return false;const role=await o.authenticated.rpc('get_tournament_role',{p_tournament_id:s.tournamentId});const after=await o.authenticated.auth.getUser();return !role.error&&role.data==='director'&&!after.error&&after.data?.user?.id===s.actorId&&o.enabled();}
 try{if(!await authorized())return null;const r=await o.serviceRpc('get_selected_step_pool_source_provider_v3',{actor:s.actorId,tid:s.tournamentId,eid:s.eventId});if(r.error||!await authorized())return null;return projectSelectedStepPoolSourceV3(r.data,s);}catch{return null;}
}
