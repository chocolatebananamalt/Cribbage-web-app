import "server-only";
import { isOfficialInvitationContext } from "./api/official-invitation-context.ts";
type Client = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
export async function getOfficialInvitationContext(admin: Client, actorId: string, nominationId: string) {
  const { data, error } = await admin.rpc("get_setup_official_invitation_context_v1", { p_actor_id: actorId, p_nomination_id: nominationId });
  if (error) throw new Error("Official invitation is unavailable.");
  if (data === null) return null;
  if (!isOfficialInvitationContext(data) || data.nominationId !== nominationId) throw new Error("Official invitation is unavailable.");
  return data;
}
