import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import { isSeatingWorkspace, type SeatingWorkspace } from "../api/seating-workspace";

export type { CheckInState, SeatingCheckIn, SeatingAssignment, SeatingPublication, SeatingWorkspace } from "../api/seating-workspace";

export async function getSeatingWorkspace(tournamentId: string): Promise<SeatingWorkspace> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_initial_seating_workspace", { p_tournament_id: tournamentId });
  if (error || !isSeatingWorkspace(data)) notFound();
  return data;
}
