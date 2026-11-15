import "server-only";
import { isSyntheticPaperDeployment } from "../api/synthetic-paper-evidence";
import { isSyntheticEventContext } from "../api/synthetic-event-evidence";
import { createServerOnlyAdminClient } from "../supabase/private-admin";
export async function getSyntheticEventContext(actorId: string, tournamentId: string) {
  if (!isSyntheticPaperDeployment(process.env)) return null;
  const {data,error} = await createServerOnlyAdminClient().rpc("get_synthetic_event_context_v1",{p_actor_id:actorId,p_tournament_id:tournamentId});
  if(error) throw new Error("Synthetic fixture status could not be verified; existing work is preserved.");
  if(data===null) return null;
  if(!isSyntheticEventContext(data,tournamentId)) throw new Error("Synthetic fixture context is unavailable.");
  return data;
}
