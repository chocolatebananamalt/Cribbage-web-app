import 'server-only';
import {assembleNativeOperationalFinanceV1} from './operational-finance-native-assembler-v1.ts';
type Access={actorId:string;roles:string[]};
export type OperationalFinanceNativeReadDependenciesV1={enabled?:()=>boolean;access:(tournamentId:string)=>Promise<Access|null>;readPrivateSource:(scope:{actorId:string;tournamentId:string;eventId:string})=>Promise<unknown>};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const permitted=(v:Access|null):v is Access=>!!v&&uuid(v.actorId)&&Array.isArray(v.roles)&&v.roles.every(r=>typeof r==='string')&&v.roles.some(r=>r==='director'||r==='co_director');
/** Default-off injected bridge. No client, route, grant or hosted call exists.
 * Before/after role checks limit disclosure; only the private database getter can
 * establish atomic native provenance. That provider integration remains unproved. */
export function createOperationalFinanceNativeReadV1(deps:OperationalFinanceNativeReadDependenciesV1){return async(scope:{tournamentId:string;eventId:string;audience:'existing-official'|'player'|'public'})=>{
 const fail=(code:string)=>({status:'unavailable' as const,code,writeAuthorized:false as const,payoutAuthorized:false as const});
 if(deps.enabled?.()!==true)return fail('disabled');
 if(!scope||!uuid(scope.tournamentId)||!uuid(scope.eventId))return fail('invalid_scope');
 if(scope.audience!=='existing-official')return fail('audience_not_authorized');
 const tournamentId=scope.tournamentId,eventId=scope.eventId;
 try{const before=await deps.access(tournamentId);if(!permitted(before))return fail('permission_required');const actorId=before.actorId;
  const raw=structuredClone(await deps.readPrivateSource({actorId,tournamentId,eventId}));
  const after=await deps.access(tournamentId);if(!permitted(after)||after.actorId!==actorId)return fail('permission_required');
  const source=assembleNativeOperationalFinanceV1(raw,{actorId,tournamentId,eventId});if(!source)return fail('source_unavailable');
  return{status:'native_finance_estimate' as const,...source,accessObservation:'pre-post-official-role-checks' as const,providerRuntimeVerified:false as const,noStoreRequired:true as const,writeAuthorized:false as const};
 }catch{return fail('source_unavailable');}
};}
