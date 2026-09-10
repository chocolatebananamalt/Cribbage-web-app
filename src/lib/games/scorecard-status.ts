export type PendingScorecardState = "pending" | "submitted" | "confirmation_pending" | "mismatch";

export type ScorecardVerificationStatus = {
  tone: "current" | "pending" | "mismatch";
  message: string;
  totalMessage: string | null;
};

/** A future scheduled game is not a verification exception. */
export function getScorecardVerificationStatus(
  states: readonly PendingScorecardState[],
): ScorecardVerificationStatus {
  if (states.includes("mismatch")) return { tone: "mismatch", message: "Result Mismatch Needs Review", totalMessage: "Updated Total Calculations Pending Review" };
  if (states.includes("confirmation_pending")) return { tone: "pending", message: "Verification Pending Player Confirmation", totalMessage: "Updated Total Calculations Pending Player Confirmation" };
  if (states.includes("submitted")) return { tone: "pending", message: "Verification Pending Opponent Entry", totalMessage: "Updated Total Calculations Pending Opponent Entry" };
  return { tone: "current", message: "Current and Verified", totalMessage: null };
}
