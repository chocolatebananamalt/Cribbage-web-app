import "server-only";
import { isApplicationResult, isDirectorAccessWorkspace, isDirectorAdminWorkspace, isMutationResult, isTournamentCreated } from "./api/director-administration";
import { createServerOnlyAdminClient } from "./supabase/private-admin";

export async function getDirectorAccessWorkspace(actorId: string) {
  const { data, error } = await createServerOnlyAdminClient().rpc("get_director_access_workspace_v1", { p_actor_id: actorId });
  return error || !isDirectorAccessWorkspace(data) ? null : data;
}

export async function submitDirectorApplication(actorId: string, operationId: string) {
  const { data, error } = await createServerOnlyAdminClient().rpc("submit_director_application_v1", { p_actor_id: actorId, p_operation_id: operationId });
  return error || !isApplicationResult(data) ? null : data;
}

export async function getDirectorAdminWorkspace(actorId: string) {
  const { data, error } = await createServerOnlyAdminClient().rpc("get_platform_director_admin_workspace_v1", { p_actor_id: actorId });
  return error || !isDirectorAdminWorkspace(data) ? null : data;
}

export async function createTournamentDraft(actorId: string, input: { name: string; plannedStartDate: string; idempotencyKey: string }) {
  const { data, error } = await createServerOnlyAdminClient().rpc("create_tournament_draft_v1", {
    p_actor_id: actorId, p_name: input.name, p_planned_start_date: input.plannedStartDate, p_operation_id: input.idempotencyKey,
  });
  return error || (!isTournamentCreated(data) && !isMutationResult(data)) ? null : data;
}

export async function reviewDirectorApplication(actorId: string, applicationId: string, input: { decision: "approve" | "reject"; accVerified: boolean; note: string | null; idempotencyKey: string }) {
  const { data, error } = await createServerOnlyAdminClient().rpc("review_director_application_v1", {
    p_actor_id: actorId, p_application_id: applicationId, p_decision: input.decision,
    p_acc_verified: input.accVerified, p_note: input.note, p_operation_id: input.idempotencyKey,
  });
  return error || !isMutationResult(data) ? null : data;
}

export async function setDirectorAuthorizationStatus(actorId: string, profileId: string, input: { status: "approved" | "suspended"; note: string; idempotencyKey: string }) {
  const { data, error } = await createServerOnlyAdminClient().rpc("set_director_authorization_status_v1", {
    p_actor_id: actorId, p_profile_id: profileId, p_status: input.status, p_note: input.note, p_operation_id: input.idempotencyKey,
  });
  return error || !isMutationResult(data) ? null : data;
}
