import { isSetupWorkspace, type SetupWorkspace } from "./setup";

export type RegistrationContactReadiness = "ready" | "missing" | "unavailable";

/**
 * Registration uses only the player-facing information deliberately saved in
 * Setup. Phone and email are optional, but any supplied value must be valid.
 */
export function registrationContactReadiness(workspace: unknown): RegistrationContactReadiness {
  if (!isSetupWorkspace(workspace)) return "unavailable";
  const current = (workspace as SetupWorkspace).current;
  if (!current) return "missing";
  const phone = current.tournamentContactPhone.trim();
  const digits = phone.replace(/\D/g, "").length;
  const email = current.tournamentContactEmail.trim();
  return (!phone || digits >= 7) && (!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ? "ready" : "missing";
}
