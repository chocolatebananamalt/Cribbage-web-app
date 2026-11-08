import type{NativeMixedOwnClientV1}from'../api/native-mixed-game-evidence-transport-v1.ts';
import{isNativeMixedGameTargetV1}from'./native-mixed-game-evidence-v1.ts';
import{readNativeMixedOwnBindingsV1}from'./native-mixed-digital-entry-view-v1.ts';
import{nativeMixedPlayProjectV1,nativeMixedPlayUrlV1}from'./native-mixed-play-activation-v1.ts';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
/** Read-only own-account launch. No caller-supplied actor, game choice or admin. */
export async function prepareNativeMixedPlayerLaunchV1(o:{enabled:boolean;params:{tournamentId:string;eventId:string;startId:string};projectUrl:string;projectRef:string;createAuthenticated:()=>Promise<NativeMixedOwnClientV1>;now?:()=>number}):Promise<string|null>{
 const enabled=o.enabled,url=o.projectUrl,ref=o.projectRef,create=o.createAuthenticated,clock=o.now??Date.now;
 if(!enabled||url!==nativeMixedPlayUrlV1||ref!==nativeMixedPlayProjectV1)return null;
 const p=structuredClone(o.params);if(Object.keys(p).sort().join()!=='eventId,startId,tournamentId'||!Object.values(p).every(uuid))return null;
 try{const client=await create();async function own(){const u=await client.auth.getUser(),c=await client.auth.getClaims(),v=c.data?.claims;return !u.error&&!c.error&&uuid(u.data.user?.id)&&v?.sub===u.data.user.id&&uuid(v.session_id)&&typeof v.exp==='number'&&Number.isSafeInteger(v.exp)&&v.exp*1000>clock()?{actorId:u.data.user.id,sessionId:v.session_id}:null;}
 const before=await own();if(!before)return null;
 const response=await client.rpc('get_native_mixed_own_player_bindings_v1',{p_tournament_id:p.tournamentId,p_event_id:p.eventId,p_start_id:p.startId});
 const raw=structuredClone(response.data),after=await own();if(response.error||!after||JSON.stringify(before)!==JSON.stringify(after)||!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const v=raw as Record<string,unknown>,first=Array.isArray(v.bindings)?v.bindings[0]:null;if(!first||typeof first!=='object'||!uuid(first.gameId))return null;
 const target={...before,...p,gameId:first.gameId,startSourceDigest:v.startSourceDigest,projectUrl:url,projectRef:ref};
 if(!isNativeMixedGameTargetV1(target))return null;const bindings=readNativeMixedOwnBindingsV1(v,target);if(!bindings)return null;
 const game=bindings.toSorted((a,b)=>a.gameNumber-b.gameNumber)[0];return `/tournament/${p.tournamentId}/rehearsal/${p.eventId}/${p.startId}/${game.target.gameId}?page=card`;
 }catch{return null;}
}
