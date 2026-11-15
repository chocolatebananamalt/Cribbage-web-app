import "server-only";

import { issueRosterAccountActivation } from "./roster-account-activation-issuer.ts";
import type {
  AppAccessStepResult,
  CheckInAndSendAppAccessResult,
  CheckInStepResult,
} from "./api/check-in-and-send-app-access.ts";

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

export type CheckInAndSendAppAccessInput = {
  actorId: string;
  tournamentId: string;
  eventId: string;
  rosterEntryId: string;
  expiresAt: Date;
  checkInOperationId: string;
  activationOperationId: string;
};

/**
 * "unavailable" means the check-in step itself could not be reported on. It is
 * the only outcome where the director learns nothing, and it is deliberately
 * not folded into the reported result: a caller must never be able to read a
 * transport failure as a recorded check-in.
 */
export type CheckInAndSendAppAccessOutcome =
  | { outcome: "unavailable" }
  | { outcome: "reported"; result: CheckInAndSendAppAccessResult };

function readCheckIn(data: unknown): CheckInStepResult | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  if (value.status === "checked_in") return { status: "checked_in" };
  if (value.status === "already_checked_in") return { status: "already_checked_in" };
  if (value.status === "rejected") {
    return { status: "rejected", code: typeof value.code === "string" && value.code.length > 0 ? value.code : "check_in_unavailable" };
  }
  return null;
}

/**
 * Check in a player at the desk and, in the same director action, issue the
 * private account activation link.
 *
 * The two steps are two separate database transactions and are reported
 * separately on purpose. The desk case that motivates this is a player who is
 * checked in and then told nothing happened: a single combined status would
 * send the director back to re-check a player who is already checked in, and
 * on a closed window that second attempt fails. So step one's result is
 * carried out whole, and step two's failure never overwrites it.
 *
 * Nothing here sends email. Delivery is fail-closed by owner decision
 * (docs/operations/DURABLE_PROJECT_MEMORY.md), so "send app access" means the
 * link is put on the director's screen to be handed over in person. The
 * witnessed approval protocol is untouched: the player still redeems the link,
 * and a different signed-in director still has to approve the request.
 */
export async function checkInAndSendAppAccess(
  admin: RpcClient,
  input: CheckInAndSendAppAccessInput,
): Promise<CheckInAndSendAppAccessOutcome> {
  const { data, error } = await admin.rpc("desk_check_in_event_v1", {
    p_actor_id: input.actorId,
    p_tournament_id: input.tournamentId,
    p_event_id: input.eventId,
    p_roster_entry_id: input.rosterEntryId,
    p_idempotency_key: input.checkInOperationId,
  });
  if (error) return { outcome: "unavailable" };
  const checkIn = readCheckIn(data);
  if (!checkIn) return { outcome: "unavailable" };
  if (checkIn.status === "rejected") {
    // Step one did not happen, so step two is not attempted rather than
    // attempted and failed. Those are different facts at the desk.
    return { outcome: "reported", result: { checkIn, appAccess: { status: "not_attempted" } } };
  }

  return { outcome: "reported", result: { checkIn, appAccess: await issueAppAccess(admin, input) } };
}

/**
 * issueRosterAccountActivation throws when the issue RPC itself fails. Letting
 * that reach withApiFailureBoundary would return a bare 503 and the director
 * would believe the whole action was lost, when the player is in fact checked
 * in. The throw is converted into a reportable step result here for that one
 * reason.
 */
async function issueAppAccess(admin: RpcClient, input: CheckInAndSendAppAccessInput): Promise<AppAccessStepResult> {
  try {
    const issued = await issueRosterAccountActivation(admin, {
      actorId: input.actorId,
      tournamentId: input.tournamentId,
      rosterEntryId: input.rosterEntryId,
      expiresAt: input.expiresAt,
      operationId: input.activationOperationId,
    });
    if (issued.status === "issued") {
      return { status: "issued", credential: issued.credential.canonicalToken, expiresAt: issued.expiresAt };
    }
    if (issued.status === "rejected") return { status: "rejected", code: issued.code };
    // A replayed operation id proves a link was already created. The secret is
    // never reconstructed, so there is nothing to show and saying "issued"
    // here would be a lie about what the director is holding.
    return { status: "credential_unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
