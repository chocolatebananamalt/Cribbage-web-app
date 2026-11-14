import { integratedTestBackendOrigin } from '../integrated-test-target.ts';
import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import type{NativeMixedOwnClientV1}from'../api/native-mixed-game-evidence-transport-v1.ts';
import{readPaperDirectoryV1,type PaperDirectoryV1}from'./native-mixed-paper-directory-v1.ts';
export const nativeMixedPaperDirectoryEnabledV1=()=>integratedTestFeatureEnabled();
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export async function preparePaperDirectoryV1(o:{enabled?:boolean;params:{tournamentId:string;eventId:string;startId:string};projectUrl:string;createAuthenticated:()=>Promise<NativeMixedOwnClientV1>;now?:()=>number}):Promise<PaperDirectoryV1|null>{
 if(o.enabled!==true)return null;
 const p=structuredClone(o.params);
 if(Object.keys(p).sort().join()!=='eventId,startId,tournamentId'||!Object.values(p).every(uuid)||o.projectUrl!==integratedTestBackendOrigin())return null;
 try{const client=await o.createAuthenticated();
  async function subject(){const u=await client.auth.getUser(),c=await client.auth.getClaims(),v=c.data?.claims;return !u.error&&!c.error&&uuid(u.data.user?.id)&&v?.sub===u.data.user.id&&uuid(v?.session_id)&&typeof v.exp==='number'&&Number.isSafeInteger(v.exp)&&v.exp*1000>(o.now?.()??Date.now())?{actorId:u.data.user.id,sessionId:v.session_id}:null;}
  const before=await subject();if(!before)return null;
  const r=await client.rpc('get_native_mixed_paper_directory_v1',{p_tournament_id:p.tournamentId,p_event_id:p.eventId,p_start_id:p.startId});
  const after=await subject();return after&&JSON.stringify(before)===JSON.stringify(after)&&!r.error?readPaperDirectoryV1(r.data,{...before,...p}):null;
 }catch{return null;}
}
