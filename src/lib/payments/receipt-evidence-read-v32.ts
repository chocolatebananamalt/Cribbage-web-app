import {isUuid} from '../api/validation.ts';
import {buildReceiptEvidenceCsvV32} from './receipt-evidence-v32.ts';
type Client={auth:{getUser:()=>Promise<{data:{user:{id:string}|null};error:unknown}>;getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown;exp?:unknown}}|null;error:unknown}>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
/** Normal authenticated existing RPC only. No admin client, cache, recovery
 * storage, receipt authoring or retry; caller invalidates on Auth/owner change. */
export async function readReceiptEvidenceCsvV32(d:{client:Client;actorId:string;tournamentId:string;enabled:()=>boolean;now?:()=>number}){
 const on=()=>{try{return d.enabled()===true;}catch{return false;}},now=d.now??Date.now,actor=d.actorId,tid=d.tournamentId;
 try{if(!on()||!isUuid(actor)||!isUuid(tid))return null;
  async function identity(){if(!on())return null;const u=await d.client.auth.getUser(),c=await d.client.auth.getClaims(),v=c.data?.claims;return!u.error&&!c.error&&u.data.user?.id===actor&&v?.sub===actor&&typeof v.session_id==='string'&&v.session_id.length>0&&typeof v.exp==='number'&&Number.isSafeInteger(v.exp)&&v.exp*1000>now()&&on()?v.session_id:null;}
  const sid=await identity();if(!sid)return null;
  async function authorized(){if(await identity()!==sid)return false;const r=await d.client.rpc('get_tournament_role',{p_tournament_id:tid});return!r.error&&['director','co_director'].includes(String(r.data))&&await identity()===sid&&on();}
  if(!await authorized())return null;const response=await d.client.rpc('get_roster_payment_workspace',{p_tournament_id:tid}),captured=structuredClone(response.data);if(response.error||!on())return null;
  const csv=buildReceiptEvidenceCsvV32(captured,new Date(now()).toISOString());return csv&&await authorized()?{csv,filename:'private-receipt-evidence.csv'}:null;
 }catch{return null;}
}
