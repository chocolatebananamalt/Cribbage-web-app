import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "./supabase/server";

export type RegistrationClaimReviewItem = {
  claimId: string;
  displayName: string;
  email: string;
  accNumber: string | null;
  intendedPaymentMethod: "cash" | "check" | "other" | "unspecified";
  scorecardType: "digital" | "paper";
  submittedAt: string;
  decision: "approved_for_roster" | "rejected" | null;
  collisionClaimIds: string[];
};

const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const exact = (value: object, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);

function claim(value: unknown): value is RegistrationClaimReviewItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return exact(item, ["claimId", "displayName", "email", "accNumber", "intendedPaymentMethod", "scorecardType", "submittedAt", "decision", "collisionClaimIds"])
    && uuid(item.claimId)
    && typeof item.displayName === "string" && item.displayName.length > 0
    && typeof item.email === "string" && item.email.length > 0
    && (item.accNumber === null || typeof item.accNumber === "string")
    && ["cash", "check", "other", "unspecified"].includes(item.intendedPaymentMethod as string)
    && (item.scorecardType === "digital" || item.scorecardType === "paper")
    && typeof item.submittedAt === "string"
    && (item.decision === null || item.decision === "approved_for_roster" || item.decision === "rejected")
    && Array.isArray(item.collisionClaimIds) && item.collisionClaimIds.every(uuid);
}

export async function getRegistrationClaimReviewWorkspace(tournamentId: string): Promise<RegistrationClaimReviewItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_registration_claim_review_workspace", { p_tournament_id: tournamentId });
  if (error || !data || typeof data !== "object") notFound();
  const result = data as Record<string, unknown>;
  if (!exact(result, ["claims"]) || !Array.isArray(result.claims) || !result.claims.every(claim)) notFound();
  return result.claims;
}
