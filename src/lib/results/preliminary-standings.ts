import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import { isPreliminaryEventStandings } from "./preliminary-standings-contract";

export async function getPreliminaryEventStandings(tournamentId: string, eventId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_preliminary_event_standings", {
    p_tournament_id: tournamentId,
    p_event_id: eventId,
  });
  if (error || !isPreliminaryEventStandings(data) || data.tournamentId !== tournamentId || data.eventId !== eventId) notFound();
  return data;
}
