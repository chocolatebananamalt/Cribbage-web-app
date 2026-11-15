import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { createEventCheckInCredential, digestEventCheckInCredential, type EventCheckInCredential } from "./event-check-in-token";

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
function bytea(value: Uint8Array) { return `\\x${Buffer.from(value).toString("hex")}`; }

export async function issueEventCheckInCredential(admin: RpcClient, input: {
  actorId: string; tournamentId: string; eventId: string; expiresAt: Date; operationId: string;
}): Promise<{ credential: EventCheckInCredential; expiresAt: string }> {
  const credential = createEventCheckInCredential(randomUUID());
  const salt = randomBytes(32);
  const digest = digestEventCheckInCredential(salt, credential.canonicalToken);
  const { data, error } = await admin.rpc("issue_event_check_in_qr_v1", {
    p_actor_id: input.actorId, p_tournament_id: input.tournamentId, p_event_id: input.eventId,
    p_credential_id: credential.credentialId, p_salt: bytea(salt), p_digest: bytea(digest),
    p_expires_at: input.expiresAt.toISOString(), p_idempotency_key: input.operationId,
  });
  if (error || !data || typeof data !== "object" || (data as Record<string, unknown>).status !== "event_check_in_qr_issued") {
    throw new Error("Event check-in QR issuance is unavailable.");
  }
  return { credential, expiresAt: input.expiresAt.toISOString() };
}

/** Converts a currently valid display-code scan into a five-minute form session. */
export async function issueEventCheckInCompletionSession(admin: RpcClient, input: {
  qrCredential: EventCheckInCredential; expiresAt: Date;
}): Promise<{ credential: EventCheckInCredential; expiresAt: string }> {
  const credential = createEventCheckInCredential(randomUUID());
  const salt = randomBytes(32);
  const digest = digestEventCheckInCredential(salt, credential.canonicalToken);
  const { data, error } = await admin.rpc("bootstrap_event_check_in_qr_v1", {
    p_qr_credential_id: input.qrCredential.credentialId, p_qr_secret: input.qrCredential.secret,
    p_completion_id: credential.credentialId, p_salt: bytea(salt), p_digest: bytea(digest), p_expires_at: input.expiresAt.toISOString(),
  });
  if (error || !data || typeof data !== "object" || (data as Record<string, unknown>).status !== "ready") throw new Error("Event check-in QR is unavailable.");
  return { credential, expiresAt: input.expiresAt.toISOString() };
}
