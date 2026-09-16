import { isSetupWorkspace, type SetupWorkspace } from "./setup";

export type RegistrationContactReadiness = "ready" | "missing" | "unavailable";

/**
 * Registration has a player-facing contact promise. Older saved revisions can
 * be viewed, but a QR credential must not be issued until the director has
 * saved a usable phone and email in the current setup revision.
 */
export function registrationContactReadiness(workspace: unknown): RegistrationContactReadiness {
  if (!isSetupWorkspace(workspace)) return "unavailable";
  const current = (workspace as SetupWorkspace).current;
  if (!current) return "missing";
  const digits = current.tournamentContactPhone.replace(/\D/g, "").length;
  const email = current.tournamentContactEmail.trim();
  return digits >= 7 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "ready" : "missing";
}
