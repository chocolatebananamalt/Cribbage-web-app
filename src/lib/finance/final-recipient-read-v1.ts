import 'server-only';
import {projectFinalRecipientEstimateV1,type FinalRecipientEstimateInputV1} from './final-recipient-estimate-v1.ts';
import type {ExistingPlayoffMode} from '../results/player-playoff-read-model.ts';
type Capture=Pick<FinalRecipientEstimateInputV1,'nativeFinanceSource'|'proposal'|'expectedHead'|'playoffModels'>;
type Access={actorId:string;roles:string[]};
export type FinalRecipientReadDependenciesV1={enabled?:()=>boolean;access:(tournamentId:string)=>Promise<Access|null>;capture:(scope:{actorId:string;tournamentId:string;eventId:string;playoffMode:ExistingPlayoffMode})=>Promise<Capture>};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const permitted=(v:Access|null):v is Access=>!!v&&uuid(v.actorId)&&Array.isArray(v.roles)&&v.roles.every(r=>typeof r==='string')&&v.roles.some(r=>r==='director'||r==='co_director');
/** Disabled, injected private-read integration only. Matching double observations
 * do NOT establish atomic database reads or approve any financial award. */
export function createFinalRecipientEstimateReadV1(deps:FinalRecipientReadDependenciesV1){return async(scope:{tournamentId:string;eventId:string;playoffMode:ExistingPlayoffMode;audience:'existing-official'|'player'|'public'})=>{
 const fail=(code:string)=>({status:'blocked' as const,code,publicAccessGranted:false as const,writeAuthorized:false as const,payoutAuthorized:false as const,moneyMoved:false as const});
 if(deps.enabled?.()!==true)return fail('disabled');
 if(!scope||!uuid(scope.tournamentId)||!uuid(scope.eventId)||!['main-v3','main-v4','consolation-v1'].includes(scope.playoffMode))return fail('invalid_scope');
 if(scope.audience!=='existing-official')return fail('audience_not_authorized');
 const tournamentId=scope.tournamentId,eventId=scope.eventId,playoffMode=scope.playoffMode;
 try{const before=await deps.access(tournamentId);if(!permitted(before))return fail('permission_required');const actorId=before.actorId;
  const first=structuredClone(await deps.capture({actorId,tournamentId,eventId,playoffMode}));
  const middle=await deps.access(tournamentId);if(!permitted(middle)||middle.actorId!==actorId)return fail('permission_required');
  const a=projectFinalRecipientEstimateV1({nativeFinanceSource:first.nativeFinanceSource,proposal:first.proposal,expectedHead:first.expectedHead,playoffModels:first.playoffModels,playoffMode,scope:{actorId,tournamentId,eventId}});if(a.status!=='recipient_estimate')return fail(a.code);
  const second=structuredClone(await deps.capture({actorId,tournamentId,eventId,playoffMode}));
  const after=await deps.access(tournamentId);if(!permitted(after)||after.actorId!==actorId)return fail('permission_required');
  const b=projectFinalRecipientEstimateV1({nativeFinanceSource:second.nativeFinanceSource,proposal:second.proposal,expectedHead:second.expectedHead,playoffModels:second.playoffModels,playoffMode,scope:{actorId,tournamentId,eventId}});if(b.status!=='recipient_estimate')return fail(b.code);
  if(a.digest!==b.digest)return fail('observed_source_changed');
  return{...b,sourceObservation:'matching-double-read-not-atomic' as const,providerRuntimeVerified:false as const,noStoreRequired:true as const};
 }catch{return fail('source_unavailable');}
};}
