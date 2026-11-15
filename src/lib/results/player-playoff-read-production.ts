import "server-only";
import { requireTournamentAccess } from "../auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../supabase/private-admin";
import { getSyntheticEventContext } from "../paper-games/synthetic-event-context";
import { createExistingBracketReader, type ExistingPlayoffMode } from "./player-playoff-read-model";

/** Not wired to a page or route. Existing private RPC permissions remain intact. */
export async function readExistingPlayerBracket(tournamentId:string,eventId:string,mode:ExistingPlayoffMode) {
  return createExistingBracketReader({
    access:async id=>{
      const access=await requireTournamentAccess(id);
      return {actorId:access.user.id,roles:access.roles};
    },
    models:async(actor,id,event,kind)=>{
      // Construct privileged reader only after the coordinator checks current existing roles.
      const admin=createServerOnlyAdminClient();

      const [qualification,ties,schedule,playoff,syntheticContext]=await Promise.all([
        admin.rpc("get_standard_singles_qualification_result_v1",{p_actor_id:actor,p_tournament_id:id,p_event_id:event}),
        admin.rpc("get_qualification_tie_workspace_v1",{p_actor_id:actor,p_tournament_id:id,p_event_id:event}),
        admin.rpc("get_event_schedule_workspace_v1",{p_actor_id:actor,p_tournament_id:id}),
        kind==="main-v4"?admin.rpc("get_standard_singles_playoff_outcome_workspace_v4",{p_actor_id:actor,p_tournament_id:id,p_event_id:event}):kind==="main-v3"?admin.rpc("get_standard_singles_playoff_outcome_workspace_v3",{p_actor_id:actor,p_tournament_id:id,p_event_id:event}):admin.rpc("get_consolation_playoff_workspace_v1",{actor,tid:id,eid:event}),
        getSyntheticEventContext(actor,id),
      ]);
      if([qualification,ties,schedule,playoff].some(r=>r.error))throw new Error("playoff_read_unavailable");
      return {qualification:qualification.data,ties:ties.data,schedule:schedule.data,playoff:playoff.data,syntheticContext};
    },
  })(tournamentId,eventId,mode);
}
