import type {NativeMixedOwnClientV1}from'../api/native-mixed-game-evidence-transport-v1.ts';
import{readNativeMixedPlayoffOwnAuthenticatedReplyV1}from'./native-mixed-playoff-own-view-v1.ts';

/** Closed code gate. A reviewed test-only release and participant authorization
 * must precede enabling the host. This is never a posted/environment switch. */
export const nativeMixedPlayoffOwnRouteEnabledV1=()=>false;
const projectRef='nnhcnvksxgxnpvdqjgpg',projectUrl=`https://${projectRef}.supabase.co`;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
function params(value:unknown):{tournamentId:string;eventId:string}|null{
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==2)return null;
 const d=Object.getOwnPropertyDescriptors(value),a=d.tournamentId,b=d.eventId;
 return a&&b&&'value'in a&&'value'in b&&a.enumerable&&b.enumerable&&uuid(a.value)&&uuid(b.value)?{tournamentId:a.value,eventId:b.value}:null;
}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;}

/** Normal authenticated cookie-client only; no ordinary paid-attendance check,
 * service role, caller-supplied actor or shared cache. The host must construct
 * the actual SDK client against the supplied pinned URL, e.g. createClient(url).
 * A route using this loader must be force-dynamic/private-no-store. Browser
 * hydration must recheck identity before displaying this private SSR snapshot. */
export async function prepareNativeMixedPlayoffOwnRouteV1(o:{enabled?:boolean;params:unknown;projectUrl:string;projectRef:string;
 createAuthenticated:(expectedProjectUrl:string)=>Promise<NativeMixedOwnClientV1>;now?:()=>number}){
 if(o.enabled!==true)return null;
 try{
  const p=params(o.params),url=o.projectUrl,ref=o.projectRef,create=o.createAuthenticated,now=o.now??Date.now;
  if(!p||url!==projectUrl||ref!==projectRef||typeof create!=='function')return null;
  const client=await create(url);
  async function subject(){const u=await client.auth.getUser(),c=await client.auth.getClaims(),v=c.data?.claims;
   return !u.error&&!c.error&&uuid(u.data.user?.id)&&v?.sub===u.data.user.id&&uuid(v.session_id)&&typeof v.exp==='number'&&Number.isSafeInteger(v.exp)&&v.exp*1000>now()?{actorId:u.data.user.id,sessionId:v.session_id}:null;}
  const before=await subject();if(!before)return null;
  const reply=await client.rpc('get_native_mixed_playoff_own_v1',{p_tournament_id:p.tournamentId,p_event_id:p.eventId});
  if(reply.error)return null;
  // Validate the entire raw body before deriving its own identity and detach
  // before the next auth await; a late SDK mutation cannot change this snapshot.
  const decoded=readNativeMixedPlayoffOwnAuthenticatedReplyV1(reply.data,p);if(!decoded)return null;
  const after=await subject();if(!after||after.actorId!==before.actorId||after.sessionId!==before.sessionId)return null;
  return freeze({target:{...before,projectUrl:url,projectRef:ref,ownScope:decoded.scope},initialState:decoded.state});
 }catch{return null;}
}
