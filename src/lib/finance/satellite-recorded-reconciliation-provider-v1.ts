import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import{reconcileSatelliteRecordedAwardsV1}from'./satellite-recorded-reconciliation-v1.ts';
export const satelliteRecordedReconciliationViewEnabledV1=()=>integratedTestFeatureEnabled();
type Scope={actorId:string;tournamentId:string;eventId:string};
type Client={auth:{getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown}}|null;error:unknown}>;getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(n:string,a:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
/** Only current cookie client; no admin impersonation or posted source. */
export async function loadSatelliteRecordedReconciliationV1(o:{scope:Scope;client:()=>Promise<Client>;enabled?:()=>boolean}){
 const on=()=>{try{return(o.enabled??satelliteRecordedReconciliationViewEnabledV1)()===true;}catch{return false;}};
 if(!on()||!Object.values(o.scope).every(uuid))return null;const scope=structuredClone(o.scope);
 try{const c=await o.client();async function identity(){const claims=await c.auth.getClaims(),user=await c.auth.getUser(),role=await c.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId});return!claims.error&&!user.error&&!role.error&&claims.data?.claims?.sub===scope.actorId&&user.data?.user?.id===scope.actorId&&['director','co_director'].includes(role.data as string)&&uuid(claims.data.claims.session_id)?claims.data.claims.session_id:null;}
 const sid=await identity();if(!sid||!on())return null;const result=await c.rpc('get_satellite_recorded_reconciliation_v1',{p_tournament_id:scope.tournamentId,p_event_id:scope.eventId});if(await identity()!==sid||!on()||result.error)return null;const projected=reconcileSatelliteRecordedAwardsV1(result.data,scope);return projected.status==='reconciled_entered_awards'?projected:null;
 }catch{return null;}
}
export type SatelliteRecordedReconciliationViewV1=NonNullable<Awaited<ReturnType<typeof loadSatelliteRecordedReconciliationV1>>>;
