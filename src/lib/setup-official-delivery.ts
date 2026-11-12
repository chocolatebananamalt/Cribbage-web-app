import "server-only";
import { isUuid } from "./api/validation.ts";
import type { SetupOfficialNominationRequest, SetupOfficialRole } from "./api/setup-officials.ts";
import { nominateSetupOfficial, markSetupOfficialInvitationDelivery } from "./setup-officials.ts";

type Client = Parameters<typeof nominateSetupOfficial>[0];

/** Nomination RPC owns authorization/audit. Delivery never activates a role. */
export async function saveSetupOfficialInvitation(admin: Client, input: SetupOfficialNominationRequest & { actorId: string; tournamentId: string; role: SetupOfficialRole }, sendEmail: (path: string) => Promise<boolean>) {
  if (input.delivery === "copy_link") {
    // App-first rollout: do not create a handoff until its context reader is
    // installed. The random operation ID is only an existence probe, not access.
    const { error } = await admin.rpc("get_setup_official_invitation_context_v1", { p_actor_id: input.actorId, p_nomination_id: input.operationId });
    if (error) throw new Error("Private invitation handoff is not available yet.");
  }
  const result = await nominateSetupOfficial(admin, { ...input, secret: crypto.randomUUID() + crypto.randomUUID() });
  if (result.status !== "official_pending_email") return result;
  const nominationId = result.nominationId;
  if (typeof nominationId !== "string" || !isUuid(nominationId)) throw new Error("Official invitation is unavailable.");
  const acceptancePath = `/official-invitations/${nominationId}`;
  if (input.delivery === "copy_link") {
    // Intentional non-delivery is not an email failure. Keep the audited
    // nomination pending; exact-email acceptance and expiry are unchanged.
    return { status: "invitation_link_ready", nominationId, acceptancePath };
  }
  const delivered = await sendEmail(acceptancePath);
  await markSetupOfficialInvitationDelivery(admin, { actorId: input.actorId, tournamentId: input.tournamentId, nominationId, operationId: crypto.randomUUID(), delivered });
  return { status: delivered ? "invitation_email_sent" : "delivery_unavailable", nominationId };
}
