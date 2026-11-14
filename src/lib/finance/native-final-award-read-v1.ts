import 'server-only';
import {reconcileNativeFinalAwardSourceV1} from './native-final-award-reconciliation-v1.ts';
type Access={actorId:string;roles:string[]};
export type NativeFinalAwardReadDependenciesV1={enabled?:()=>boolean;access:(tournamentId:string)=>Promise<Access|null>;capture:(scope:{actorId:string;tournamentId:string;eventId:string})=>Promise<unknown>};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const permitted=(a:Access|null):a is Access=>!!a&&uuid(a.actorId)&&Array.isArray(a.roles)&&a.roles.every(r=>typeof r==='string')&&a.roles.some(r=>r==='director'||r==='co_director');
/** Injected private integration only. A separately reviewed provider must supply
 * the real caller and locked SQL source. No route, grant or write is enabled. */
export function createNativeFinalAwardSourceReadV1(deps:NativeFinalAwardReadDependenciesV1){return async(scope:{tournamentId:string;eventId:string;audience:'existing-official'|'player'|'public'})=>{
 const fail=(code:string)=>({status:'blocked' as const,code,writeAuthorized:false as const,publicAccessGranted:false as const,moneyMoved:false as const,payoutAuthorized:false as const,disbursementAuthorized:false as const,finalizationAuthorized:false as const});
 if(deps.enabled?.()!==true)return fail('disabled');
 if(!scope||!uuid(scope.tournamentId)||!uuid(scope.eventId))return fail('invalid_scope');
 if(scope.audience!=='existing-official')return fail('audience_not_authorized');
 const {tournamentId,eventId}=scope;
 try{const before=await deps.access(tournamentId);if(!permitted(before))return fail('permission_required');const actorId=before.actorId;
  const source=structuredClone(await deps.capture({actorId,tournamentId,eventId}));
  const after=await deps.access(tournamentId);if(!permitted(after)||after.actorId!==actorId)return fail('permission_required');
  const result=reconcileNativeFinalAwardSourceV1(source,{actorId,tournamentId,eventId});if(result.status!=='recordable_unpaid_awards')return fail(result.code);
  return{...result,noStoreRequired:true as const,providerRuntimeVerified:false as const};
 }catch{return fail('source_unavailable');}
};}
