import "server-only";

import { isAccessibleTournamentList, isUuid, type AccessibleTournament } from "../api/tournament-chooser";
import { createServerOnlyAdminClient } from "../supabase/private-admin";

export type AccessibleTournamentResult =
  | { status: "available"; tournaments: AccessibleTournament[] }
  | { status: "unavailable" };

export async function getAccessibleTournaments(profileId: string): Promise<AccessibleTournamentResult> {
  if (!isUuid(profileId)) return { status: "unavailable" };

  try {
    const { data, error } = await createServerOnlyAdminClient().rpc(
      "list_actor_tournament_workspaces_v1",
      { p_actor_id: profileId },
    );
    if (error || !isAccessibleTournamentList(data)) return { status: "unavailable" };
    return { status: "available", tournaments: data };
  } catch {
    return { status: "unavailable" };
  }
}
