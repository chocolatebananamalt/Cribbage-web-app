import type{NativeMixedOwnClientV1}from'../api/native-mixed-game-evidence-transport-v1.ts';
import type{NativeMixedPoolTargetV1}from'../api/native-mixed-pool-transport-v1.ts';

/** Code-disabled until a reviewed test release. This shell grants no cohort,
 * event, policy or write access; each normal RPC enforces those independently. */
export const nativeMixedPoolPlayerRouteEnabledV1=()=>false;
const ref='nnhcnvksxgxnpvdqjgpg',url=`https://${ref}.supabase.co`;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
function params(v:unknown):{tournamentId:string;eventId:string}|null{
 if(!v||typeof v!=='object'||Object.getPrototypeOf(v)!==Object.prototype||Reflect.ownKeys(v).length!==2)return null;
 const d=Object.getOwnPropertyDescriptors(v),a=d.tournamentId,b=d.eventId;
 return a&&b&&a.enumerable&&b.enumerable&&'value'in a&&'value'in b&&uuid(a.value)&&uuid(b.value)?{tournamentId:a.value,eventId:b.value}:null;
}
/** Normal cookie authentication only. A current pool workspace is deliberately
 * NOT an admission prerequisite: an owner may need to check an exact saved
 * operation after that workspace changes or becomes unavailable. The browser
 * receives no result/policy data, checks its own identity again, and obtains
 * remote data only from the currently authorized cohort RPCs. An unavailable
 * workspace remains unknown and cannot enable new choices.
 */
export async function prepareNativeMixedPoolPlayerRouteV1(o:{enabled?:boolean;params:unknown;projectUrl:string;projectRef:string;
 createAuthenticated:(expectedProjectUrl:string)=>Promise<NativeMixedOwnClientV1>;now?:()=>number}):Promise<NativeMixedPoolTargetV1|null>{
 if(o.enabled!==true)return null;
 try{
  const p=params(o.params),projectUrl=o.projectUrl,projectRef=o.projectRef,create=o.createAuthenticated,now=o.now??Date.now;
  if(!p||projectUrl!==url||projectRef!==ref||typeof create!=='function')return null;
  const client=await create(projectUrl);
  async function subject(){const u=await client.auth.getUser(),c=await client.auth.getClaims(),v=c.data?.claims;
   return !u.error&&!c.error&&uuid(u.data.user?.id)&&v?.sub===u.data.user.id&&uuid(v.session_id)&&typeof v.exp==='number'&&Number.isSafeInteger(v.exp)&&v.exp*1000>now()?{actorId:u.data.user.id,sessionId:v.session_id}:null;}
  const before=await subject();if(!before)return null;const after=await subject();
  if(!after||after.actorId!==before.actorId||after.sessionId!==before.sessionId)return null;
  return Object.freeze({...before,...p,projectUrl,projectRef});
 }catch{return null;}
}
