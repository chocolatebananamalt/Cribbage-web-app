import "server-only";
import { createClient } from "./supabase/server";
import { createServerOnlyAdminClient } from "./supabase/private-admin";
import { isSetupWorkspace } from "./api/setup";
import { isSetupActivationState } from "./api/setup-activation";
import { isSeatingWorkspace } from "./api/seating-workspace";
import { isEventRosterEnrollmentWorkspace } from "./api/event-roster-enrollment";
import { isPaymentObligationWorkspace } from "./api/payment-obligation";
import { isEventScheduleWorkspace } from "./api/event-schedule";
import { isTeamWorkspace } from "./api/team-operations";
import { rosterIntakeState, type DirectorChecklistSnapshot } from "./director-checklist";

// Called only after requireTournamentAccess and the director-role gate. Reuse
// the same actor-scoped readers as the protected operations pages; no writes.
export async function readDirectorChecklist(actorId: string, tournamentId: string): Promise<DirectorChecklistSnapshot> {
  const client = await createClient();
  const admin = createServerOnlyAdminClient();
  const scope = { p_actor_id: actorId, p_tournament_id: tournamentId };
  async function read(run: () => PromiseLike<{ data: unknown; error: unknown }>) {
    try { const result = await run(); return result.error ? null : result.data; } catch { return null; }
  }
  const [setup, activation, seating, enrollment, payments, schedule, checkIn] = await Promise.all([
    read(() => client.rpc("get_tournament_setup_workspace", { p_tournament_id: tournamentId })),
    read(() => admin.rpc("get_tournament_setup_activation_state_v3", scope)),
    read(() => client.rpc("get_initial_seating_workspace", { p_tournament_id: tournamentId })),
    read(() => admin.rpc("get_event_roster_enrollment_workspace_v3", scope)),
    read(() => client.rpc("get_roster_payment_obligation_workspace", { p_tournament_id: tournamentId })),
    read(() => admin.rpc("get_event_schedule_workspace_v1", scope)),
    read(() => admin.rpc("get_event_check_in_workspace_v1", scope)),
  ]);
  const attendance = checkIn && typeof checkIn === "object" && "events" in checkIn && Array.isArray(checkIn.events) && checkIn.events.every((event) => event && typeof event.eventId === "string" && ["standard_singles", "team", "doubles", "canadian_doubles", "custom"].includes(event.format) && typeof event.name === "string" && ["open", "closed"].includes(event.windowState) && [event.unresolvedCount, event.checkedInCount, event.noShowCount, event.pendingDeskCount].every((value) => Number.isSafeInteger(value) && value >= 0)) ? checkIn.events as NonNullable<DirectorChecklistSnapshot["attendance"]> : null;
  let teamStarts: Record<string, boolean> | null = null;
  let teamEnrollment: Record<string, { teamCount: number; memberRosterEntryIds: string[] }> | null = null;
  if (isEventScheduleWorkspace(schedule) && schedule.events.some((event) => ["doubles", "canadian_doubles"].includes(event.format))) {
    const teamData = await read(() => admin.rpc("get_event_team_workspace_v1", scope));
    const workspace = teamData && typeof teamData === "object" && !Array.isArray(teamData) ? { ...teamData, actorId } : null;
    if (isTeamWorkspace(workspace)) {
      teamStarts = Object.fromEntries(workspace.events.map((event) => [event.eventId, event.started]));
      teamEnrollment = Object.fromEntries(workspace.events.map((event) => [event.eventId, { teamCount: event.teams.length, memberRosterEntryIds: event.teams.flatMap((team) => team.members.map((member) => member.rosterEntryId)) }]));
    }
  }
  return { setup: isSetupWorkspace(setup) ? setup : null, activation: isSetupActivationState(activation) ? activation : null, seating: isSeatingWorkspace(seating) ? seating : null, enrollment: isEventRosterEnrollmentWorkspace(enrollment) ? enrollment : null, payments: isPaymentObligationWorkspace(payments) ? payments : null, schedule: isEventScheduleWorkspace(schedule) ? schedule : null, attendance, teamStarts, teamEnrollment };
}

export async function readRosterIntakeState(actorId: string, tournamentId: string) {
  try {
    const client = await createClient();
    const [activation, seating] = await Promise.all([
      createServerOnlyAdminClient().rpc("get_tournament_setup_activation_state_v3", { p_actor_id: actorId, p_tournament_id: tournamentId }),
      client.rpc("get_initial_seating_workspace", { p_tournament_id: tournamentId }),
    ]);
    return rosterIntakeState(!activation.error && isSetupActivationState(activation.data) ? activation.data : null, !seating.error && isSeatingWorkspace(seating.data) ? seating.data : null);
  } catch { return "unavailable" as const; }
}
