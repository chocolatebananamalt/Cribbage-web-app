import 'server-only';
import {createMrpEventEvidenceCollectorV1,type MrpEventScopeV1} from './mrp-event-finalization-source-v1.ts';
type Client={auth:{getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown}}|null;error:unknown}>;getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
export const mrpEventEvidenceProviderEnabledV1=()=>false;
/** Normal signed-in cookie client only. This unmounted verified-award port is an acceptance
 * prerequisite, not an installed provider. It must enforce the real primary
 * Director and return only independently verified event-specific determinations.
 * Missing RPC/proof fails closed. No service key, JWT edits or journal fallback. */
export function createProtectedMrpEventEvidenceProviderV1(o:{client:Client;enabled?:()=>boolean;readVerifiedEvidence?:(scope:MrpEventScopeV1)=>Promise<{data:unknown;error:unknown}>}){
 const on=o.enabled??mrpEventEvidenceProviderEnabledV1;
 const admitted=async(s:MrpEventScopeV1)=>{try{if(!on())return false;const c=await o.client.auth.getClaims(),u=await o.client.auth.getUser();return !c.error&&!u.error&&c.data?.claims?.sub===s.actorId&&c.data.claims.session_id===s.sessionId&&u.data?.user?.id===s.actorId&&on();}catch{return false;}};
 async function capture(s:MrpEventScopeV1){
  if(!await admitted(s))return null;
  // No verified-award RPC exists. An explicit future accepted port is required;
  // the ordinary proposed-MRP report uses the installed result-based readers.
  if(!o.readVerifiedEvidence)return null;
  const r=await o.readVerifiedEvidence(structuredClone(s));
  if(!await admitted(s)||r.error||!object(r.data)||Object.keys(r.data).sort().join()!=='actorId,eventId,evidence,primaryDirector,sessionId,status,tournamentId')return null;
  const d=r.data;if(d.status!=='verified_evidence_available'||d.actorId!==s.actorId||d.sessionId!==s.sessionId||d.tournamentId!==s.tournamentId||d.eventId!==s.eventId||d.primaryDirector!==true)return null;
  return structuredClone(d.evidence);
 }
 return createMrpEventEvidenceCollectorV1({enabled:on,
  access:async s=>await capture(s)===null?null:{actorId:s.actorId,sessionId:s.sessionId,primaryDirector:true},
  readVerifiedEvidence:capture});
}
