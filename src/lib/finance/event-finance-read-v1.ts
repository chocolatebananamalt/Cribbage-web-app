import 'server-only';
import{isEventFinanceWorkspaceV1,type EventFinanceWorkspaceV1}from'./event-finance-workspace-v1.ts';
type Scope={tournamentId:string;eventId:string;audience:'existing-official'|'player'|'public'};
type Access={actorId:string;roles:string[]};
export type EventFinanceSourceEnvelopeV1={kind:'event-finance-source-envelope-v1';actorId:string;tournamentId:string;eventId:string;workspace:EventFinanceWorkspaceV1};
export type EventFinanceReadDependenciesV1={enabled?:()=>boolean;access:(tournamentId:string)=>Promise<Access|null>;readSource:(scope:{actorId:string;tournamentId:string;eventId:string})=>Promise<unknown>};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const permitted=(v:Access|null):v is Access=>!!v&&uuid(v.actorId)&&Array.isArray(v.roles)&&v.roles.every(r=>typeof r==='string')&&v.roles.some(r=>r==='director'||r==='co_director');
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
/** UNWIRED permission/shape contract only. A future producer must assemble all
 * source pointers and amounts consistently; callbacks do not prove atomicity.
 * Reuse requireTournamentAccess via access, then additionally restrict Director/co.
 * No live default client, provider call, route, grant, header or write is created.
 */
export function createEventFinanceReadV1(deps:EventFinanceReadDependenciesV1){return async(scope:Scope)=>{
 const fail=(code:'disabled'|'invalid_scope'|'audience_not_authorized'|'permission_required'|'source_unavailable')=>({status:'unavailable' as const,code,writeAuthorized:false as const,paymentAuthorized:false as const});
 if(deps.enabled?.()!==true)return fail('disabled');
 if(!scope||!uuid(scope.tournamentId)||!uuid(scope.eventId))return fail('invalid_scope');
 if(scope.audience!=='existing-official')return fail('audience_not_authorized');
 const tournamentId=scope.tournamentId,eventId=scope.eventId;
 try{
  const before=await deps.access(tournamentId);if(!permitted(before))return fail('permission_required');const actorId=before.actorId;
  const raw=structuredClone(await deps.readSource({actorId,tournamentId,eventId}));
  const after=await deps.access(tournamentId);if(!permitted(after)||actorId!==after.actorId)return fail('permission_required');
  if(!exact(raw,['kind','actorId','tournamentId','eventId','workspace'])||raw.kind!=='event-finance-source-envelope-v1'||raw.actorId!==actorId||raw.tournamentId!==tournamentId||raw.eventId!==eventId||!isEventFinanceWorkspaceV1(raw.workspace)||raw.workspace.source.tournamentId!==tournamentId||raw.workspace.source.eventId!==eventId||raw.workspace.payoutSource.tournamentId!==tournamentId||raw.workspace.payoutSource.eventId!==eventId)return fail('source_unavailable');
  return{status:'prepared_finance_source' as const,actorId,tournamentId,eventId,workspace:raw.workspace,accessObservation:'pre-post-official-role-checks' as const,providerRuntimeVerified:false as const,sourceAtomicityVerified:false as const,noStoreRequired:true as const,writeAuthorized:false as const,paymentAuthorized:false as const,moneyMoved:false as const};
 }catch{return fail('source_unavailable');}
};}
