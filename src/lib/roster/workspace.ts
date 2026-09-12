import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";

export type RosterEntry = { rosterEntryId: string; sourceClaimId: string | null; approvalDecisionId: string | null; source: "registration_claim" | "director_manual" | "director_csv"; displayName: string; email: string | null; accNumber: string | null; createdAt: string };
export type PromotionCandidate = { approvalDecisionId: string; sourceClaimId: string; displayName: string; email: string; accNumber: string | null; intendedPaymentMethod: "cash" | "check" | "other" | "unspecified"; submittedAt: string };
export type RosterWorkspace = { rosterEntries: RosterEntry[]; promotionCandidates: PromotionCandidate[] };

const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const text = (value: unknown) => typeof value === "string";
function entry(value: unknown): value is RosterEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return uuid(item.rosterEntryId) && (item.sourceClaimId === null || uuid(item.sourceClaimId)) && (item.approvalDecisionId === null || uuid(item.approvalDecisionId)) && ["registration_claim", "director_manual", "director_csv"].includes(item.source as string) && text(item.displayName) && (item.email === null || text(item.email)) && (item.accNumber === null || text(item.accNumber)) && text(item.createdAt);
}
function candidate(value: unknown): value is PromotionCandidate {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return uuid(item.approvalDecisionId) && uuid(item.sourceClaimId) && text(item.displayName) && text(item.email) && (item.accNumber === null || text(item.accNumber)) && ["cash", "check", "other", "unspecified"].includes(item.intendedPaymentMethod as string) && text(item.submittedAt);
}

export async function getRosterWorkspace(tournamentId: string): Promise<RosterWorkspace> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_tournament_roster_workspace", { p_tournament_id: tournamentId });
  if (error || !data || typeof data !== "object") notFound();
  const result = data as Record<string, unknown>;
  if (!Array.isArray(result.rosterEntries) || !Array.isArray(result.promotionCandidates) || !result.rosterEntries.every(entry) || !result.promotionCandidates.every(candidate)) notFound();
  return { rosterEntries: result.rosterEntries, promotionCandidates: result.promotionCandidates };
}
