import {NextRequest} from 'next/server';
import {isSyntheticPaperDeployment} from '../../../../../../lib/api/synthetic-paper-evidence';
import {isAccountingAction,acceptedAccountingAction} from '../../../../../../lib/api/multi-event-accounting-action';
import {projectAccountingWorkspace} from '../../../../../../lib/api/multi-event-accounting-workspace';
import {apiJson,readMediumJson,requireVerifiedSubject,withApiFailureBoundary} from '../../../../../../lib/api/route-boundary';
import {isSameOriginRequest} from '../../../../../../lib/api/same-origin';
import {isUuid} from '../../../../../../lib/api/validation';
import {isTournamentResultEventSummary} from '../../../../../../lib/api/result-event-summary';
import {createServerOnlyAdminClient} from '../../../../../../lib/supabase/private-admin';
import {createClient} from '../../../../../../lib/supabase/server';

export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return withApiFailureBoundary(async()=>{
  if(!isSyntheticPaperDeployment(process.env))return apiJson({error:'not_found'},{status:404});
  const {id}=await params,eventId=request.nextUrl.searchParams.get('eventId');
  if(!isUuid(id)||!isUuid(eventId)||request.nextUrl.searchParams.size!==1)return apiJson({error:'invalid_request'},{status:400});
  const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:'unauthorized'},{status:401});
  const admin=createServerOnlyAdminClient();
  const [event,joint,final,summary]=await Promise.all([
   admin.rpc('get_multi_event_unpaid_event_workspace_v1',{actor,tid:id,eid:eventId}),
   admin.rpc('get_multi_event_joint_final_workspace_v1',{actor,tid:id}),
   admin.rpc('get_multi_event_joint_final_v1',{actor,tid:id}),
   admin.rpc('get_tournament_result_events_v1',{p_actor_id:actor,p_tournament_id:id}),
  ]);
  const names=!summary.error&&isTournamentResultEventSummary(summary.data)&&summary.data.tournamentId===id?Object.fromEntries(summary.data.events.map(e=>[e.eventId,e.name])):null;
  const result=event.error||joint.error||final.error||!names?null:projectAccountingWorkspace(event.data,joint.data,final.data,id,eventId,names);
  return result?apiJson(result):apiJson({error:'operation_unavailable'},{status:503});
 });
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return withApiFailureBoundary(async()=>{
  if(!isSyntheticPaperDeployment(process.env))return apiJson({error:'not_found'},{status:404});
  if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});
  const {id}=await params,body=await readMediumJson(request);
  if(!isUuid(id)||!isAccountingAction(body))return apiJson({error:'invalid_request'},{status:400});
  const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:'unauthorized'},{status:401});
  const args:Record<string,unknown>={actor,tid:id,req:body.request,op:body.operationId};
  if(body.action!=='finalize')args.eid=body.eventId;
  const name=body.action==='crosscheck'?'close_synthetic_event_crosscheck_v1':body.action==='draft'?'save_multi_event_unpaid_draft_v1':'finalize_multi_event_unpaid_v1';
  const {data,error}=await createServerOnlyAdminClient().rpc(name,args);
  if(error||!data||typeof data!=='object'||Array.isArray(data))return apiJson({error:'operation_unavailable'},{status:503});
  const value=data as Record<string,unknown>;
  if(value.status==='rejected'&&typeof value.code==='string'&&/^[a-z_]{1,80}$/.test(value.code))return apiJson({status:'rejected',code:value.code},{status:409});
  return acceptedAccountingAction(data,body,id)?apiJson(data):apiJson({error:'operation_unavailable'},{status:503});
 });
}
