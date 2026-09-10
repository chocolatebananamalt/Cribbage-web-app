import "server-only";

import { isRegistrationLinkState, type RegistrationLinkState } from "./api/registration-link";
import { createServerOnlyAdminClient } from "./supabase/private-admin";

/** Reads non-bearer link metadata only; credentials are never recoverable. */
export async function getRegistrationLinkWorkspace(actorId: string, tournamentId: string): Promise<RegistrationLinkState> {
  const { data, error } = await createServerOnlyAdminClient().rpc("get_registration_link_state_v2", {
    p_actor_id: actorId,
    p_tournament_id: tournamentId,
  });
  if (error || !isRegistrationLinkState(data)) throw new Error("Registration link workspace is unavailable.");
  return data;
}
