import 'server-only';
import {integratedTestUiEnabled,integratedTestBackendRef,integratedTestBackendOrigin} from '../integrated-test-target.ts';
import {readNativeMixedDirectorSessionV1,type NativeMixedSimulationAuthenticatedClientV1} from '../api/native-mixed-simulation-provider-v1.ts';
import type {NativeMixedSimulationScopeV1} from '../seating/native-mixed-simulation-operation-v1.ts';
import {nativePairingCapturesMatchV29,projectNativePaperPairingV29} from './native-paper-pairing-v29.ts';

// Deliberately closed until native read-provider/ACL acceptance. No environment
// flag or existing broad rehearsal UI gate can silently open this new surface.
export const nativePaperPairingEnabledV29=()=>false;
type Rpc={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
/** Read-only existing native source action and normal-auth roster RPC. No
 * receipt authoring, write action, fallback, recovery storage or cached source. */
export async function readNativePaperPairingV29(d:{client:NativeMixedSimulationAuthenticatedClientV1;privileged:()=>Promise<Rpc>;scope:NativeMixedSimulationScopeV1;projectUrl:string;projectRef:string;player?:string;enabled?:()=>boolean;now?:()=>number}) {
 const on=()=>{try{return (d.enabled??nativePaperPairingEnabledV29)()===true&&integratedTestUiEnabled();}catch{return false;}},now=d.now??Date.now;
 try{
  const s=structuredClone(d.scope);
  if(!on()||!uuid(s.actorId)||!uuid(s.tournamentId)||!uuid(s.eventId)||d.player!==undefined&&!/^A-(?:[1-9]|1[0-8])$/.test(d.player)||d.projectUrl!==integratedTestBackendOrigin()||d.projectRef!==integratedTestBackendRef())return null;
  async function identity(){if(!on())return null;const u=await d.client.auth.getUser(),c=await d.client.auth.getClaims(),v=c.data?.claims as {sub?:unknown;session_id?:unknown;exp?:unknown;iss?:unknown}|undefined;
   return !u.error&&!c.error&&u.data.user?.id===s.actorId&&v?.sub===s.actorId&&uuid(v.session_id)&&v.iss===d.projectUrl+'/auth/v1'&&typeof v.exp==='number'&&Number.isSafeInteger(v.exp)&&v.exp*1000>now()&&on()?v.session_id:null;}
  const sid=await identity();if(!sid)return null;
  async function authorize(){
   if(await identity()!==sid)return false;
   const role=await d.client.rpc('get_tournament_role',{p_tournament_id:s.tournamentId});if(role.error||role.data!=='director')return false;
   const r=await d.client.rpc('get_native_mixed_pilot_director_session_v1',{p_tournament_id:s.tournamentId,p_event_id:s.eventId,p_action:'source'});
   const lease=structuredClone(r.data),validLease=()=>readNativeMixedDirectorSessionV1(lease,{subjectId:s.actorId,sessionId:sid!,tournamentId:s.tournamentId,eventId:s.eventId,projectUrl:d.projectUrl,projectRef:d.projectRef,action:'source',now:now()});
   if(r.error||!validLease())return false;
   return await identity()===sid&&!!validLease()&&on();
  }
  let admin:Rpc|null=null;
  async function capture(){
   if(!await authorize())return null;admin??=await d.privileged();if(!await authorize())return null;
   const source=await admin.rpc('execute_native_mixed_pilot_director_v1',{p_actor_id:s.actorId,p_session_id:sid,p_tournament_id:s.tournamentId,p_event_id:s.eventId,p_action:'source',p_request:{}});
   const sourceData=structuredClone(source.data);if(source.error||!await authorize())return null;
   const roster=await d.client.rpc('get_native_mixed_pool_preparation_v1',{p_tournament_id:s.tournamentId,p_event_id:s.eventId});
   const rosterData=structuredClone(roster.data);return roster.error||!await authorize()?null:{source:sourceData,roster:rosterData};
  }
  const a=await capture();if(!a)return null;const b=await capture();if(!b||!nativePairingCapturesMatchV29(a,b))return null;
  const packet=projectNativePaperPairingV29(b.source,b.roster,s,d.player);
  return packet&&await authorize()?packet:null;
 }catch{return null;}
}
