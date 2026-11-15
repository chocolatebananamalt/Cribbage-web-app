import "server-only";

import { notFound } from "next/navigation";
import { isEventRosterEnrollmentWorkspace, type EventRosterEnrollmentWorkspace } from "../api/event-roster-enrollment";
import { createServerOnlyAdminClient } from "../supabase/private-admin";

export async function getEventRosterEnrollmentWorkspace(
  actorId: string,
  tournamentId: string,
): Promise<EventRosterEnrollmentWorkspace> {
  const { data, error } = await createServerOnlyAdminClient().rpc(
    "get_event_roster_enrollment_workspace_v3",
    { p_actor_id: actorId, p_tournament_id: tournamentId },
  );
  if (error || !isEventRosterEnrollmentWorkspace(data)) notFound();
  return data;
}
