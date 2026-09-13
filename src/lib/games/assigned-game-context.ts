import "server-only";

import { notFound } from "next/navigation";
import { decideAssignedGameContextRead, type AssignedGameContext } from "./assigned-game-context-decision";
import { createClient } from "../supabase/server";

export type { AssignedGameContext } from "./assigned-game-context-decision";

export type AssignedGameContextRead =
  | { status: "available"; context: AssignedGameContext }
  | { status: "unavailable" };

export async function getAssignedGameContext(gameId: string, tournamentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_assigned_game_context", { p_game_id: gameId });
  // An absent result is the authorization-safe "not assigned" outcome. A
  // database failure or a response that does not meet this narrow contract is
  // operationally different: do not render any score action against it.
  const decision = decideAssignedGameContextRead({ data, error, tournamentId });
  if (decision === "not_found") notFound();
  if (decision === "unavailable") return { status: "unavailable" } satisfies AssignedGameContextRead;
  return { status: "available", context: data as AssignedGameContext } satisfies AssignedGameContextRead;
}
