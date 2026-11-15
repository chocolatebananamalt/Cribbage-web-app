import'server-only';
import{requireVerifiedIdentity}from'../api/verified-subject.ts';
import{readMainFourPlayoffBindingV1}from'./main-four-playoff-binding-v1.ts';
import{isUuid}from'../api/validation.ts';
type Client={auth:{getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown}}|null;error:unknown}>;getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type Scope={actorId:string;tournamentId:string;eventId:string;qualificationResultVersionId:string;qualificationVersion:number};
/** Normal-auth, private read only. This cannot substitute a matching workspace
 * for the required current SQL receipt/FK/audit proof. No service key or writer. */
export async function readMainFourPlayoffProviderV1(o:{client:Client;scope:Scope;workspace:unknown;enabled:()=>boolean}){const on=()=>{try{return o.enabled()===true;}catch{return false;}};if(!on()||![o.scope.actorId,o.scope.tournamentId,o.scope.eventId,o.scope.qualificationResultVersionId].every(isUuid)||!Number.isSafeInteger(o.scope.qualificationVersion)||o.scope.qualificationVersion<1)return null;const scope=Object.freeze({...o.scope}),workspace=structuredClone(o.workspace);let session:string|null=null;
 async function authorized(){if(!on())return false;const j=await requireVerifiedIdentity(o.client),u=await o.client.auth.getUser();if(!j||j.subject!==scope.actorId||!isUuid(j.sessionId)||u.error||u.data?.user?.id!==scope.actorId||session!==null&&j.sessionId!==session)return false;session??=j.sessionId;const r=await o.client.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId});return !r.error&&['director','co_director'].includes(String(r.data))&&on();}
 try{if(!await authorized())return null;const reply=await o.client.rpc('get_main_four_playoff_binding_provider_v1',{p_tournament_id:scope.tournamentId,p_event_id:scope.eventId}),value=structuredClone(reply.data);if(reply.error||!await authorized()||!readMainFourPlayoffBindingV1(value,scope,workspace))return null;return value;}catch{return null;}
}
