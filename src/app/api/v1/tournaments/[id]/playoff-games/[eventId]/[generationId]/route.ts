import {readBoundedJson} from '../../../../../../../../lib/api/bounded-json';
import type{NextRequest}from'next/server';
import{createClient}from'../../../../../../../../lib/supabase/server';
import{requireVerifiedIdentity}from'../../../../../../../../lib/api/verified-subject';
import{isSameOriginRequest}from'../../../../../../../../lib/api/same-origin';
import{isUuid}from'../../../../../../../../lib/api/validation';
import{selectedStepPlayerRoutesEnabledV3,selectedStepPlayerWritesVerifiedV3,readSelectedStepPlayerViewV3}from'../../../../../../../../lib/playoffs/selected-step-player-v3';
import{isSeriesGameWireRequestV1,readSeriesGameWireReceiptV1}from'../../../../../../../../lib/playoffs/series-game-client-transport-v1';
const headers={'cache-control':'private, no-store'};
export const dynamic='force-dynamic';
type Params={id:string;eventId:string;generationId:string};
async function run(request:NextRequest,p:Params,write:boolean){
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
 if(!selectedStepPlayerRoutesEnabledV3())return reply({error:'not_found'},404);
 if(write&&(!isSameOriginRequest(request)||!selectedStepPlayerWritesVerifiedV3()))return reply({error:'recording_unavailable'},403);
 if(![p.id,p.eventId,p.generationId].every(isUuid))return reply({error:'invalid_request'},400);
 try{
  const normal=await createClient(),before=await requireVerifiedIdentity(normal),user=await normal.auth.getUser();
  if(!before||user.error||user.data.user?.id!==before.subject)return reply({error:'unauthorized'},401);
  let qualificationId:unknown=request.nextUrl.searchParams.get('qualification'),slot:unknown=Number(request.nextUrl.searchParams.get('slot')),wire:unknown=null;
  if(write){const body:unknown=await readBoundedJson(request,20000);
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==3||!('qualificationId'in body)||!('slot'in body)||!('request'in body))return reply({error:'invalid_request'},400);
   qualificationId=body.qualificationId;slot=body.slot;wire=body.request;
   if(!isSeriesGameWireRequestV1(wire)||wire.generationId!==p.generationId)return reply({error:'invalid_request'},400);
  }
  if(!isUuid(qualificationId)||typeof slot!=='number'||!Number.isInteger(slot)||slot<1||slot>63)return reply({error:'invalid_request'},400);
  const scope={actorId:before.subject,tournamentId:p.id,eventId:p.eventId,qualificationId,slot,generationId:p.generationId},operation=request.nextUrl.searchParams.get('operation');
  if(operation!==null&&!isUuid(operation))return reply({error:'invalid_request'},400);
  const result=write?await normal.rpc('submit_selected_step_player_action_provider_v3',{tid:p.id,eid:p.eventId,qid:qualificationId,slot_no:slot,request:wire})
   :operation?await normal.rpc('get_selected_step_player_action_provider_v3',{tid:p.id,op:operation})
   :await normal.rpc('get_selected_step_player_view_provider_v3',{tid:p.id,eid:p.eventId,qid:qualificationId,slot_no:slot,gid:p.generationId});
  const after=await requireVerifiedIdentity(normal),again=await normal.auth.getUser();
  if(!after||after.subject!==before.subject||after.sessionId!==before.sessionId||again.error||again.data.user?.id!==before.subject)return reply({error:'unauthorized'},401);
  if(result.error)return reply({error:'temporarily_unavailable'},503);
  if(!write&&!operation){const view=readSelectedStepPlayerViewV3(result.data,scope);return view?reply(view):reply({error:'current_source_unavailable'},409);}
  const value:unknown=result.data;let expected=wire;
  if(!write){if(!value||typeof value!=='object'||!('authorized'in value)||value.authorized!==true||!('result'in value)||!value.result||typeof value.result!=='object'||!('request'in value.result))return reply({error:'outcome_unknown'},409);expected=value.result.request;}
  if(!isSeriesGameWireRequestV1(expected)||expected.generationId!==p.generationId||operation&&expected.operationId!==operation)return reply({error:'outcome_unknown'},409);
  const receipt=readSeriesGameWireReceiptV1(value,{actorProfileId:before.subject,tournamentId:p.id,eventId:p.eventId,qualificationId,slot,request:expected});
  return receipt.status==='unknown'?reply({error:'outcome_unknown'},409):reply(value);
 }catch{return reply({error:'temporarily_unavailable'},503);}
}
export async function GET(r:NextRequest,{params}:{params:Promise<Params>}){return run(r,await params,false);}
export async function POST(r:NextRequest,{params}:{params:Promise<Params>}){return run(r,await params,true);}
