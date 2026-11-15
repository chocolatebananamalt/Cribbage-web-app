import 'server-only';
import{isUuid}from'../api/validation.ts';
import{resolveRoles}from'../auth/tournament-roles.ts';
import{projectRunningPoolReadModels}from'./pool-running-read-model.ts';
import{projectPlayerPoolTotalsV1,type PlayerPoolTotalsV1}from'./player-pool-totals-contract-v1.ts';
type Scope={actorId:string;tournamentId:string;eventId:string};
type Client={auth:{getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type Service=(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,k:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const canonical=(v:unknown):string=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:object(v)?`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')}}`:JSON.stringify(v)??'null';
const roles=new Set(['director','co_director','player','viewer','cross_checker']);
/** New aggregate-only authority, not permission to use the private source RPCs.
 * The database derives the actual enabling Director from its visibility record.
 * No browser-supplied publisher, identity substitution or claim change exists. */
export async function readPlayerPoolTotalsV1(o:{authenticated:Client;serviceRpc:Service;scope:Scope;enabled:()=>boolean;now:()=>string}):Promise<PlayerPoolTotalsV1|null>{
 if(!o.enabled()||!exact(o.scope,['actorId','tournamentId','eventId'])||!Object.values(o.scope).every(isUuid))return null;const s=Object.freeze({...o.scope});
 async function authorized(){if(!o.enabled())return false;const b=await o.authenticated.auth.getUser();if(b.error||b.data?.user?.id!==s.actorId)return false;const [role,multi]=await Promise.all([o.authenticated.rpc('get_tournament_role',{p_tournament_id:s.tournamentId}),o.authenticated.rpc('get_tournament_roles_v1',{p_tournament_id:s.tournamentId})]);const a=await o.authenticated.auth.getUser();return !role.error&&!multi.error&&typeof role.data==='string'&&resolveRoles(multi.data,role.data).some(r=>roles.has(r))&&!a.error&&a.data?.user?.id===s.actorId&&o.enabled();}
 async function models(){const [raw,activity]=await Promise.all([o.serviceRpc('get_player_pool_models_provider_v1',{viewer:s.actorId,tid:s.tournamentId,eid:s.eventId}),o.authenticated.rpc('get_preliminary_event_standings',{p_tournament_id:s.tournamentId,p_event_id:s.eventId})]);if(raw.error||activity.error||!exact(raw.data,['context','qOperating','side']))return null;const c=raw.data.context;
  if(!exact(c,['kind','projectionVersion','viewerActorId','tournamentId','eventId','visibilityRevisionId','visibilityVersion','publisherActorId'])||c.kind!=='player-pool-read-context-v1'||c.projectionVersion!=='player-pool-totals-v1'||c.viewerActorId!==s.actorId||c.tournamentId!==s.tournamentId||c.eventId!==s.eventId||!isUuid(c.visibilityRevisionId)||!isUuid(c.publisherActorId)||typeof c.visibilityVersion!=='number'||!Number.isInteger(c.visibilityVersion)||c.visibilityVersion<1||c.visibilityVersion>2147483647)return null;
  return{context:c,activity:activity.data,qOperating:raw.data.qOperating,side:raw.data.side};
 }
 try{if(!await authorized())return null;const before=await models();if(!before||!await authorized())return null;const after=await models();if(!after||canonical(before)!==canonical(after)||!await authorized())return null;
  const w=projectRunningPoolReadModels(s.tournamentId,s.eventId,after,o.now());if(!w)return null;
  return projectPlayerPoolTotalsV1({...w,sourceObservation:'matching-double-read-not-atomic'},after.context.visibilityVersion as number);
 }catch{return null;}
}
