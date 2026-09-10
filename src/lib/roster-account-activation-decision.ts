import "server-only";

import { isUuid } from "./api/validation.ts";

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

export type RosterAccountActivationDecision = {
  actorId: string;
  tournamentId: string;
  requestId: string;
  decision: "approve" | "reject";
  confirmationPhrase?: string;
  operationId: string;
};

export type RosterAccountActivationDecisionResult =
  | { status: "approved"; requestId: string; rosterEntryId: string; linkId: string }
  | { status: "rejected"; requestId?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isApproved(value: unknown, input: RosterAccountActivationDecision): value is Extract<RosterAccountActivationDecisionResult, { status: "approved" }> {
  if (!isRecord(value) || Object.keys(value).length !== 4 || value.status !== "approved") return false;
  return value.requestId === input.requestId && isUuid(value.rosterEntryId) && isUuid(value.linkId);
}

function isRejected(value: unknown, input: RosterAccountActivationDecision): value is Extract<RosterAccountActivationDecisionResult, { status: "rejected" }> {
  if (!isRecord(value) || value.status !== "rejected") return false;
  return (Object.keys(value).length === 1) || (Object.keys(value).length === 2 && value.requestId === input.requestId);
}

/** A server-only director witness decision. Database authorization remains authoritative. */
export async function decideRosterAccountActivation(admin: RpcClient, input: RosterAccountActivationDecision): Promise<RosterAccountActivationDecisionResult> {
  const { data, error } = await admin.rpc("decide_roster_account_activation_v1", {
    p_actor_id: input.actorId,
    p_tournament_id: input.tournamentId,
    p_request_id: input.requestId,
    p_decision: input.decision,
    p_confirmation_phrase: input.confirmationPhrase ?? null,
    p_operation_id: input.operationId,
  });
  if (error) throw new Error("Account activation decision is unavailable.");
  if (isApproved(data, input) || isRejected(data, input)) return data;
  throw new Error("Account activation decision is unavailable.");
}
