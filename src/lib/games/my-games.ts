import "server-only";

import { createClient } from "../supabase/server";
import { isMyGamesWorkspace, type MyGamesWorkspace } from "./my-games-decision";

export type { AssignedGameSummary, MyGamesWorkspace } from "./my-games-decision";

export async function getMyGames(tournamentId: string): Promise<{ status: "available"; workspace: MyGamesWorkspace } | { status: "unavailable" }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_assigned_games_v1", { p_tournament_id: tournamentId });
  if (error || !isMyGamesWorkspace(data, tournamentId)) return { status: "unavailable" };
  return { status: "available", workspace: data };
}
