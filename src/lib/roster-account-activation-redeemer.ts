import "server-only";

import {
  digestRosterAccountActivationCredential,
  parseRosterAccountActivationCredential,
} from "./roster-account-activation-token.ts";

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

export type RosterAccountActivationRedemption = {
  profileId: string;
  credential: string;
  operationId: string;
};

export type RosterAccountActivationRedemptionResult =
  | { status: "pending"; activationId: string; requestId: string; confirmationPhrase: string }
  | { status: "rejected" };

const saltPattern = /^[A-Za-z0-9+/]{43}=$/;
const phrasePattern = /^[A-Z]{4}-[A-Z]{4}$/;

function bytea(value: Uint8Array) { return `\\x${Buffer.from(value).toString("hex")}`; }

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isReadySalt(value: unknown, activationId: string): value is { saltBase64: string } {
  return isRecord(value) && Object.keys(value).length === 3 && value.status === "ready"
    && value.activationId === activationId && typeof value.saltBase64 === "string"
    && saltPattern.test(value.saltBase64);
}

function isPending(value: unknown, activationId: string): value is Extract<RosterAccountActivationRedemptionResult, { status: "pending" }> {
  return isRecord(value) && Object.keys(value).length === 4 && value.status === "pending"
    && value.activationId === activationId && typeof value.requestId === "string"
    && typeof value.confirmationPhrase === "string" && phrasePattern.test(value.confirmationPhrase);
}

/**
 * Redeems an already fragment-cleared credential via server-only RPCs. The
 * raw credential remains in this local call frame; only its digest is sent to
 * the database, and an unavailable credential has one generic result shape.
 */
export async function redeemRosterAccountActivation(
  admin: RpcClient,
  input: RosterAccountActivationRedemption,
): Promise<RosterAccountActivationRedemptionResult> {
  const credential = parseRosterAccountActivationCredential(input.credential);
  if (!credential || credential.canonicalToken !== input.credential) return { status: "rejected" };

  const saltResult = await admin.rpc("get_roster_account_activation_salt_v1", {
    p_activation_id: credential.activationId,
  });
  if (saltResult.error || !isReadySalt(saltResult.data, credential.activationId)) return { status: "rejected" };
  const salt = Buffer.from(saltResult.data.saltBase64, "base64");
  if (salt.byteLength !== 32) return { status: "rejected" };
  const digest = digestRosterAccountActivationCredential(salt, credential.canonicalToken);
  const redemption = await admin.rpc("redeem_roster_account_activation_v1", {
    p_profile_id: input.profileId,
    p_activation_id: credential.activationId,
    p_digest: bytea(digest),
    p_operation_id: input.operationId,
  });
  if (redemption.error) throw new Error("Account activation redemption is unavailable.");
  if (isPending(redemption.data, credential.activationId)) return redemption.data;
  return { status: "rejected" };
}
