import { fictionalDrawBoundaryEnabled } from "../../../../../../lib/api/fictional-draw-enabled";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { notFound } from "next/navigation";
import { reviewedSeatingTrialRuntimeReady } from "../../../../../../lib/api/reviewed-seating-trial";
import { isUuid } from "../../../../../../lib/api/validation";
import { isLoopbackPlannerUrl } from "../../../../../../lib/api/local-seating-planner";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { createReviewedNativeProductionHandlers } from "../../../../../../lib/api/reviewed-native-seating-production";
import { getEventScheduleWorkspace } from "../../../../../../lib/events/schedule-workspace";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createReviewedDrawScheduleReader } from "../../../../../../lib/seating/reviewed-draw-schedule-reader";
import Preview from "../../../../../../components/reviewed-draw-schedule-preview";
export default async function Page({params,searchParams}:{params:Promise<{tournamentId:string}>;searchParams:Promise<{operationId?:string}>}){
 // Scope amendment/provider acceptance is NOT done. No flags can enable this.
 if(!fictionalDrawBoundaryEnabled()&&!reviewedSeatingTrialRuntimeReady())notFound();
 const host=(await headers()).get("host");if(!host||(!fictionalDrawBoundaryEnabled()&&!isLoopbackPlannerUrl(`http://${host}`)))notFound();
 const{tournamentId}=await params,{operationId}=await searchParams;
 if(!isUuid(tournamentId)||tournamentId!==tournamentId.toLowerCase()||!isUuid(operationId)||operationId!==operationId.toLowerCase())notFound();
 const pageAccess=await requireTournamentAccess(tournamentId);
 if(!pageAccess.roles.some(r=>r==="director"||r==="co_director"))notFound();
 const reader=createReviewedDrawScheduleReader({access:async tid=>{const a=await requireTournamentAccess(tid);return{actorId:a.user.id,roles:a.roles};},
 models:async(actorId,tid,op)=>{const handlers=createReviewedNativeProductionHandlers(),ctx={params:Promise.resolve({id:tid,operationId:op})},request=new NextRequest(`http://${host}/api/v1/tournaments/${tid}/reviewed-seating`,{headers:{host}});
  const[operation,workspace,eventWorkspace,statuses,lifecycle]=await Promise.all([handlers.operationGET(request,ctx),handlers.GET(request,ctx),getEventScheduleWorkspace(actorId,tid),createServerOnlyAdminClient().rpc("get_event_participant_status_workspace_v1",{p_actor_id:actorId,p_tournament_id:tid}),createServerOnlyAdminClient().rpc("get_event_change_workspace_v1",{p_actor_id:actorId,p_tournament_id:tid})]);
  if(!operation.ok||!workspace.ok||statuses.error||lifecycle.error||eventWorkspace.events.length!==1)throw new Error("preview_unavailable");const w:unknown=await workspace.json();
  if(!w||typeof w!=="object"||!("native"in w))throw new Error("preview_unavailable");return{operation:await operation.json()as unknown,nativeWorkspace:w.native,eventWorkspace,eventStatusWorkspace:statuses.data,eventLifecycleWorkspace:lifecycle.data,loadedScope:{actorId,tournamentId:tid,eventId:eventWorkspace.events[0].eventId}};}});
 const preview=await reader(tournamentId,operationId);
 return<main className="auth-shell"><section className="auth-card schedule-card"><Preview preview={preview} tournamentId={tournamentId} actorId={pageAccess.user.id} fictionalEnabled={fictionalDrawBoundaryEnabled()}/></section></main>;
}


