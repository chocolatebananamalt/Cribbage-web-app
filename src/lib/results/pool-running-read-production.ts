import "server-only";
import {requireTournamentAccess}from"../auth/require-tournament-access";
import {createClient}from"../supabase/server";
import {createServerOnlyAdminClient}from"../supabase/private-admin";
import {createRunningPoolReader}from"./pool-running-read-model";
/** Unwired private read composition. No player/public route or new permission. */
export async function readExistingRunningPools(tournamentId:string,eventId:string){
  return createRunningPoolReader({
    access:async tid=>{const a=await requireTournamentAccess(tid);return{actorId:a.user.id,roles:a.roles};},
    models:async(actor,tid,eid)=>{
      const admin=createServerOnlyAdminClient(),client=await createClient();
      const [activity,qOperating,side]=await Promise.all([
        client.rpc("get_preliminary_event_standings",{p_tournament_id:tid,p_event_id:eid}),
        admin.rpc("get_q_operating_workspace_v2",{p_actor_id:actor,p_tournament_id:tid}),
        admin.rpc("get_side_pool_graduated_workspace_v2",{p_actor_id:actor,p_tournament_id:tid}),
      ]);
      if([activity,qOperating,side].some(r=>r.error))throw new Error("pool_read_unavailable");
      return{activity:activity.data,qOperating:qOperating.data,side:side.data};
    },
    now:()=>new Date().toISOString(),
  })(tournamentId,eventId);
}
