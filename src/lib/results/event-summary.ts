import "server-only";

import { notFound } from "next/navigation";
import { isTournamentResultEventSummary, type TournamentResultEventSummary } from "../api/result-event-summary";
import { createServerOnlyAdminClient } from "../supabase/private-admin";

export async function getTournamentResultEventSummary(actorId: string, tournamentId: string): Promise<TournamentResultEventSummary> {
  const { data, error } = await createServerOnlyAdminClient().rpc("get_tournament_result_events_v1", {
    p_actor_id: actorId,
    p_tournament_id: tournamentId,
  });
  if (error || !isTournamentResultEventSummary(data)) notFound();
  return data;
}
