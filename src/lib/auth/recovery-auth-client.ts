"use client";
import { beginSafeRecoverySwitch, finishRecoveryAuthentication } from "../recovery-write-coordinator";
import { protectUnownedRecovery } from "./recovery-preflight";
import { safeAuthNext, type RecoveryAuthInput } from "./recovery-auth";
import { recoveryActionGate } from "../safe-device-switch";

/** Credentials and one-time codes stay in this call only: never persisted/replayed. */
export async function submitCoordinatedAuthentication(input: RecoveryAuthInput): Promise<{ status: "signed_in"; next: string } | { status: "blocked"; message: string }> {
  if (!recoveryActionGate.enter()) throw new Error("recovery_action_in_progress");
  try { return await perform(input); } finally { recoveryActionGate.leave(); }
}
async function perform(input: RecoveryAuthInput): Promise<{ status: "signed_in"; next: string } | { status: "blocked"; message: string }> {
  await beginSafeRecoverySwitch();
  await protectUnownedRecovery();
  await beginSafeRecoverySwitch();
  let response: Response;
  try {
    response = await fetch(input.mode === "password" ? "/auth/password" : "/auth/callback", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  } catch {
    return reconcile(input.attemptId, input.next);
  }
  if (response.status >= 500) return reconcile(input.attemptId, input.next);
  const result: unknown = await response.json().catch(() => null);
  if (response.ok && result && typeof result === "object" && "status" in result && result.status === "signed_in" && "next" in result && result.next === input.next) {
    try { await beginSafeRecoverySwitch(); finishRecoveryAuthentication(); return { status: "signed_in", next: safeAuthNext(input.next) }; }
    catch { return { status: "blocked", message: "Sign-in was accepted, but browser recovery coordination changed. Keep this tab and recovery data intact; the account switch is paused." }; }
  }
  if (response.ok) return reconcile(input.attemptId, input.next);
  return { status: "blocked", message: response.status === 409 ? "Saved recovery work belongs to another or unknown account. Keep it intact and use its original account; do not clear pending work." : response.status === 429 ? "Sign-in is temporarily limited. Wait before trying again." : "Sign-in was not accepted. Recovery data was preserved. Passwords and one-time links are not automatically retried." };
}
async function reconcile(attemptId: string, next: string): Promise<{ status: "signed_in"; next: string } | { status: "blocked"; message: string }> {
  try {
    const response = await fetch("/auth/session-state", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ attemptId }) });
    const result: unknown = response.ok ? await response.json() : null;
    if (result && typeof result === "object" && "status" in result && result.status === "signed_in") {
      await beginSafeRecoverySwitch();finishRecoveryAuthentication();return { status: "signed_in", next: safeAuthNext(next) };
    }
  } catch { /* No credential/code replay after an uncertain response. */ }
  return { status: "blocked", message: "The sign-in outcome could not be confirmed. Recovery data is preserved. Do not resend this one-time link; check the current session before a new attempt." };
}
