import {isUuid} from '../api/validation.ts';
import 'server-only';
import {integratedTestUiEnabled,integratedTestBackendOrigin} from '../integrated-test-target.ts';
import {directorUnresolvedGamesEnabledV31,readDirectorUnresolvedGamesV31} from './director-unresolved-games-v31.ts';
type Client={auth:{getUser:()=>Promise<{data:{user:{id:string}|null};error:unknown}>;getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown;iss?:unknown;exp?:unknown}}|null;error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
export async function readDirectorUnresolvedQueueV31(d:{client:Client;scope:{actorId:string;tournamentId:string;afterGameId:string|null};read:()=>PromiseLike<{data:unknown;error:unknown}>;enabled?:()=>boolean;now?:()=>number}){
 const on=()=>{try{return(d.enabled??directorUnresolvedGamesEnabledV31)()===true&&integratedTestUiEnabled();}catch{return false;}},now=d.now??Date.now;
 try{if(!on())return null;const scope=structuredClone(d.scope);if(!isUuid(scope.actorId)||!isUuid(scope.tournamentId)||scope.afterGameId!==null&&!isUuid(scope.afterGameId))return null;
  async function identity(){if(!on())return null;const u=await d.client.auth.getUser(),c=await d.client.auth.getClaims(),v=c.data?.claims;return !u.error&&!c.error&&u.data.user?.id===scope.actorId&&v?.sub===scope.actorId&&typeof v.session_id==='string'&&v.session_id.length>0&&v.iss===integratedTestBackendOrigin()+'/auth/v1'&&typeof v.exp==='number'&&Number.isSafeInteger(v.exp)&&v.exp*1000>now()&&on()?v.session_id:null;}
  const sid=await identity();if(!sid)return null;
  async function authorized(){if(await identity()!==sid)return false;const role=await d.client.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId});return!role.error&&['director','co_director'].includes(String(role.data))&&await identity()===sid&&on();}
  if(!await authorized())return null;const response=await d.read(),captured=structuredClone(response.data);if(response.error||!await authorized())return null;
  return readDirectorUnresolvedGamesV31(captured,scope,now());
 }catch{return null;}
}
