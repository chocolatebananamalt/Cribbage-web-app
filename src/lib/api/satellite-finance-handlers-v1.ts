import 'server-only';
import type {NextRequest} from 'next/server';
import {readBoundedJson} from './bounded-json.ts';
import {isSameOriginRequest} from './same-origin.ts';
import {loadSatelliteFundReviewV1,projectSatelliteFinanceWorkspaceV1} from '../finance/satellite-fund-review-v1.ts';
import {isSatelliteFinanceScopeV1,readSatelliteFinanceAttemptV1,readSatelliteFinanceProofV1,satelliteFinanceUuidV1} from '../finance/satellite-finance-contract-v1.ts';
import {satelliteFinanceRoutesEnabledV1,satelliteFinanceWritesVerifiedV1} from '../finance/satellite-finance-gates-v1.ts';
type Client=Parameters<typeof loadSatelliteFundReviewV1>[0]['client'] extends()=>Promise<infer C>?C:never;
type Context={params:Promise<{id:string;eventId:string}>};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'cache-control':'private, no-store'}});
export function createSatelliteFinanceHandlersV1(o:{client:()=>Promise<Client>;enabled?:()=>boolean;writesVerified?:()=>boolean}){
 const on=()=>{try{return(o.enabled??satelliteFinanceRoutesEnabledV1)()===true;}catch{return false;}},writes=()=>{try{return on()&&(o.writesVerified??satelliteFinanceWritesVerifiedV1)()===true;}catch{return false;}};
 async function run(req:NextRequest,context:Context,write:boolean){
  if(!on())return json({error:'not_found'},404);if(req.method!==(write?'POST':'GET'))return json({error:'method_not_allowed'},405);
  if(write&&!isSameOriginRequest(req))return json({error:'invalid_origin'},403);
  try{const p=await context.params,s={actorId:req.headers.get('x-expected-actor-id'),tournamentId:p.id,eventId:p.eventId};if(!isSatelliteFinanceScopeV1(s))return json({error:'invalid_request'},400);
   const body=write?await readBoundedJson(req,16000):null;
   if(write&&(!object(body)||Object.keys(body).sort().join()!=='attempt,command'||!['record','retire','recover'].includes(body.command as string)))return json({error:'invalid_request'},400);
   const attempt=write?readSatelliteFinanceAttemptV1((body as Record<string,unknown>).attempt,s):null;if(write&&!attempt)return json({error:'invalid_request'},400);
   const recovery=write&&(body as Record<string,unknown>).command==='recover';if(write&&!recovery&&!writes())return json({error:'database_verification_pending'},503);
   const c=await o.client();async function admit(){
    if(!on())return null;const claims=await c.auth.getClaims(),u=await c.auth.getUser();const sid=claims.data?.claims?.session_id;
    if(claims.error||u.error||claims.data?.claims?.sub!==s.actorId||u.data?.user?.id!==s.actorId||!satelliteFinanceUuidV1(sid))return null;
    const r=await c.rpc('get_satellite_finance_access_v1',{p_tournament_id:s.tournamentId}),d=structuredClone(r.data),after=await c.auth.getClaims(),user=await c.auth.getUser();
    return!r.error&&object(d)&&Object.keys(d).sort().join()==='actorId,primaryDirector,sessionId,tournamentId'&&d.actorId===s.actorId&&d.sessionId===sid&&d.tournamentId===s.tournamentId&&d.primaryDirector===true&&!after.error&&!user.error&&after.data?.claims?.sub===s.actorId&&after.data.claims.session_id===sid&&user.data?.user?.id===s.actorId&&on()?sid:null;
   }
   const sid=await admit();if(!sid)return json({error:'not_authorized'},403);
   if(!write){const value=await loadSatelliteFundReviewV1({scope:s,client:async()=>c,enabled:on});if(await admit()!==sid||!on())return json({error:'not_authorized'},403);const workspace=value?projectSatelliteFinanceWorkspaceV1(value):null;return workspace?json({status:'ready',workspace}):json({status:'source_unavailable',scope:s});}
   if(!recovery&&!writes())return json({error:'database_verification_pending'},503);
   const reply=await c.rpc(recovery?'get_satellite_finance_operation_v1':(body as Record<string,unknown>).command==='retire'?'close_satellite_finance_v1':'record_satellite_finance_v1',{tid:s.tournamentId,eid:s.eventId,op:attempt!.operationId,request:attempt!.request}),captured=structuredClone(reply.data);
   if(reply.error||await admit()!==sid||!on()||!recovery&&!writes())return json({error:'outcome_unknown',pendingRetained:true},503);
   const proof=readSatelliteFinanceProofV1(captured,attempt!);if(proof)return json(proof);
   if(object(captured)&&Object.keys(captured).sort().join()==='code,status'&&captured.status==='blocked'&&typeof captured.code==='string'&&/^[a-z0-9_]{1,100}$/.test(captured.code))return json({status:'pending',code:captured.code},409);
   return json({error:'outcome_unknown',pendingRetained:true},503);
  }catch{return json({error:write?'outcome_unknown':'source_unavailable',pendingRetained:true},503);}
 }
 return{GET:(r:NextRequest,c:Context)=>run(r,c,false),POST:(r:NextRequest,c:Context)=>run(r,c,true)};
}
