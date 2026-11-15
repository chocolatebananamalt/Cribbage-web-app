import { readBoundedJson } from "../api/bounded-json.ts";
import { ownerMarkersAllowActor, ownerMarkersAreKnown } from "./recovery-owner.ts";
import { expectedRequestOrigin } from "../api/same-origin.ts";

export type RecoveryAuthInput = { attemptId: string; next: string } & ({ mode: "password"; email: string; password: string } | { mode: "code"; code: string });
export const authAttemptCookie = "acc_auth_attempt_v1";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function safeAuthNext(value: unknown): string {
  return typeof value === "string" && value.length <= 2048 && value.startsWith("/") && !value.startsWith("//") && !/[\\\u0000-\u001f\u007f]/.test(value) && !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value) ? value : "/";
}
export function privateAuthJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "cache-control": "private, no-store", "referrer-policy": "no-referrer" } });
}
export function validRecoveryAuthInput(value: unknown): value is RecoveryAuthInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const keys = v.mode === "password" ? ["attemptId", "next", "mode", "email", "password"] : ["attemptId", "next", "mode", "code"];
  if (Object.keys(v).length !== keys.length || !keys.every(key => Object.hasOwn(v, key)) || typeof v.attemptId !== "string" || !uuid.test(v.attemptId) || typeof v.next !== "string" || safeAuthNext(v.next) !== v.next) return false;
  if (v.mode === "password") return typeof v.email === "string" && v.email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) && typeof v.password === "string" && v.password.length > 0 && v.password.length <= 1024;
  return v.mode === "code" && typeof v.code === "string" && /^[A-Za-z0-9_-]{8,2048}$/.test(v.code);
}
export type AuthOutcome = { actorId?: string; error?: "rejected" | "rate_limited" | "unavailable" };
/** Dependency injection permits real transport/cookie rejection tests with fictional auth. */
export async function performRecoveryAuthentication(request: Request, owners: string[], authenticate: (input: RecoveryAuthInput) => Promise<AuthOutcome>) {
  const origin = expectedRequestOrigin(request);
  const site = request.headers.get("sec-fetch-site");
  if (!origin || request.headers.get("origin") !== origin || (site !== null && site !== "same-origin")) return { response: privateAuthJson({ error: "invalid_origin" }, 403), accepted: null };
  let input: unknown;
  try { input = await readBoundedJson(request, 8192); } catch { return { response: privateAuthJson({ error: "invalid_request" }, 400), accepted: null }; }
  if (!validRecoveryAuthInput(input)) return { response: privateAuthJson({ error: "invalid_request" }, 400), accepted: null };
  if (!ownerMarkersAreKnown(owners)) return { response: privateAuthJson({ error: "recovery_owner_blocked" }, 409), accepted: null };
  try {
    const outcome = await authenticate(input);
    if (outcome.error) return { response: privateAuthJson({ error: outcome.error === "rate_limited" ? "rate_limited" : "sign_in_not_confirmed" }, outcome.error === "rate_limited" ? 429 : outcome.error === "unavailable" ? 503 : 401), accepted: null };
    if (!ownerMarkersAllowActor(owners, outcome.actorId)) return { response: privateAuthJson({ error: "recovery_owner_blocked" }, 409), accepted: null };
    return { response: privateAuthJson({ status: "signed_in", next: input.next }), accepted: { attemptId: input.attemptId, actorId: outcome.actorId! } };
  } catch { return { response: privateAuthJson({ error: "sign_in_not_confirmed" }, 503), accepted: null }; }
}
