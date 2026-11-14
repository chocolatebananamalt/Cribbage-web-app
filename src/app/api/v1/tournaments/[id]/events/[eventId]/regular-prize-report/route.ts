import {modernPrizeExportEnabledV2,modernPrizeCsvV2} from '../../../../../../../../lib/results/modern-prize-export-v2';
import {createSelectedStepAwardTransportV3,selectedStepAwardResultsEnabledV3} from '../../../../../../../../lib/api/selected-step-award-transport-v3';
import {createClient} from '../../../../../../../../lib/supabase/server';
import {createServerOnlyAdminClient} from '../../../../../../../../lib/supabase/private-admin';
import {requireVerifiedIdentity} from '../../../../../../../../lib/api/verified-subject';
import {isUuid} from '../../../../../../../../lib/api/validation';
import {isQualificationResult} from '../../../../../../../../lib/api/qualification-finalization';
import {isTournamentResultEventSummary} from '../../../../../../../../lib/api/result-event-summary';
import {getSyntheticEventContext} from '../../../../../../../../lib/paper-games/synthetic-event-context';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string;eventId:string}>}){
 const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};const fail=(status:number)=>Response.json({error:'current_report_unavailable'},{status,headers});
 if(!modernPrizeExportEnabledV2()||!selectedStepAwardResultsEnabledV3())return fail(404);
 const{id,eventId}=await params;if(!isUuid(id)||!isUuid(eventId))return fail(400);
 try{const normal=await createClient();const access=async()=>{const identity=await requireVerifiedIdentity(normal),user=await normal.auth.getUser();if(!identity||user.error||user.data.user?.id!==identity.subject)return null;const role=await normal.rpc('get_tournament_role',{p_tournament_id:id});return role.error||role.data!=='director'?null:{...identity,role:role.data};};const before=await access();if(!before)return fail(403);
 const admin=createServerOnlyAdminClient(),args={p_actor_id:before.subject,p_tournament_id:id,p_event_id:eventId};
 const [q,summary,final,synthetic]=await Promise.all([admin.rpc('get_standard_singles_qualification_result_v1',args),admin.rpc('get_tournament_result_events_v1',{p_actor_id:before.subject,p_tournament_id:id}),admin.rpc('get_finalized_standard_singles_event_report_v1',args),getSyntheticEventContext(before.subject,id)]);
 if(q.error||summary.error||final.error||final.data!==null||synthetic||!isQualificationResult(q.data,id,eventId)||!isTournamentResultEventSummary(summary.data)||summary.data.tournamentId!==id)return fail(409);
 const matches=summary.data.events.filter(e=>e.eventId===eventId);if(matches.length!==1||matches[0].format!=='standard_singles'||!['main','consolation'].includes(matches[0].eventType))return fail(409);
 const port=createSelectedStepAwardTransportV3(normal,(name,args)=>admin.rpc(name,args),{actorId:before.subject,tournamentId:id,eventId},{read:selectedStepAwardResultsEnabledV3,write:()=>false});
 const view=await port.results(q.data.resultVersionId);
 const [after,qAfter]=await Promise.all([access(),admin.rpc('get_standard_singles_qualification_result_v1',args)]);
 if(!modernPrizeExportEnabledV2()||!selectedStepAwardResultsEnabledV3()||!view||view.eventKind!==matches[0].eventType||!after||after.subject!==before.subject||after.sessionId!==before.sessionId||after.role!==before.role||qAfter.error||!isQualificationResult(qAfter.data,id,eventId)||qAfter.data.resultVersionId!==q.data.resultVersionId)return fail(409);
 return new Response(modernPrizeCsvV2(view,{tournamentId:id,eventId,qualificationResultVersionId:q.data.resultVersionId}),{headers:{...headers,'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="unpaid-regular-prize-awards.csv"'}});
 }catch{return fail(503);}
}
