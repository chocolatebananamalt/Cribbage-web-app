import 'server-only';
import {projectNativeFinalRecipientEstimateV1} from './native-playoff-recipient-v1.ts';
type Access={actorId:string;roles:string[]};
type Scope={actorId:string;tournamentId:string;eventId:string};
export type NativeRecipientReadDependenciesV1={enabled?:()=>boolean;access:(tournamentId:string)=>Promise<Access|null>;capture:(scope:Scope)=>Promise<unknown>};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const permitted=(v:Access|null):v is Access=>!!v&&uuid(v.actorId)&&Array.isArray(v.roles)&&v.roles.every(r=>typeof r==='string')&&v.roles.some(r=>r==='director'||r==='co_director');
/** Private, default-off adapter. The injected capture must use the locked native
 * SQL source under the actual caller identity. This creates no route or grant. */
export function createNativeRecipientEstimateReadV1(deps:NativeRecipientReadDependenciesV1){return async(scope:{tournamentId:string;eventId:string;audience:'existing-official'|'player'|'public'})=>{
 const fail=(code:string)=>({status:'blocked' as const,code,publicAccessGranted:false as const,writeAuthorized:false as const,payoutAuthorized:false as const,finalizationAuthorized:false as const,moneyMoved:false as const});
 if(deps.enabled?.()!==true)return fail('disabled');
 if(!scope||!uuid(scope.tournamentId)||!uuid(scope.eventId))return fail('invalid_scope');
 if(scope.audience!=='existing-official')return fail('audience_not_authorized');
 const {tournamentId,eventId}=scope;
 try{const before=await deps.access(tournamentId);if(!permitted(before))return fail('permission_required');
  const actorId=before.actorId,source=structuredClone(await deps.capture({actorId,tournamentId,eventId}));
  const after=await deps.access(tournamentId);if(!permitted(after)||after.actorId!==actorId)return fail('permission_required');
  const result=projectNativeFinalRecipientEstimateV1(source,{actorId,tournamentId,eventId});if(result.status!=='recipient_estimate')return fail(result.code);
  return{...result,sourceObservation:'private-locked-source-contract-provider-unverified' as const,providerRuntimeVerified:false as const,noStoreRequired:true as const};
 }catch{return fail('source_unavailable');}
};}
