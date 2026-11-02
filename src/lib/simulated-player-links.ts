import "server-only";
import { simulatedLinkScope } from "./api/simulated-player-links.ts";
import { SIMULATED_LINK_PROJECT, isSimulatedLinkTournament } from "./api/simulated-player-links.ts";

type Client = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
/** Read-only, fail closed. The URL gate never substitutes for DB enrollment/authority. */
export async function hasSimulatedPlayerLinks(admin: Client, tournamentId: string, actorId: string): Promise<boolean> {
  if (!simulatedLinkScope(tournamentId, actorId, process.env.NEXT_PUBLIC_SUPABASE_URL)) return false;
  const { data, error } = await admin.rpc("get_simulated_player_link_scope_v1", { p_actor_id: actorId, p_tournament_id: tournamentId });
  if (error) throw new Error("Simulation scope is unavailable.");
  return data === true;
}

export async function hasSimulatedPlayerLinkLabel(admin: Client, tournamentId: string, actorId: string): Promise<boolean> {
  if (!isSimulatedLinkTournament(tournamentId) || process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${SIMULATED_LINK_PROJECT}.supabase.co`) return false;
  const { data, error } = await admin.rpc("get_simulated_player_link_label_v1", { p_actor_id: actorId, p_tournament_id: tournamentId });
  if (error) throw new Error("Simulation label is unavailable.");
  return data === true;
}
