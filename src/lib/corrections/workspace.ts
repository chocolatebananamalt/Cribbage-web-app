import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";

export type CorrectionItem = { gameId: string; correctionId?: string; eventName: string; roundNumber: number; matchInstance: number; gameVersion?: number; baseGameVersion?: number; winnerSide?: "a" | "b"; margin?: number; previousWinnerSide?: "a" | "b"; previousMargin?: number; correctedWinnerSide?: "a" | "b"; correctedMargin?: number; reason?: string | null; sideA: { displayName: string; tableSeat: string }; sideB: { displayName: string; tableSeat: string } };
export type CorrectionWorkspace = { proposalCandidates: CorrectionItem[]; pendingReviews: CorrectionItem[] };

function isItem(value: unknown): value is CorrectionItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const side = (x: unknown) => !!x && typeof x === "object" && typeof (x as Record<string, unknown>).displayName === "string" && typeof (x as Record<string, unknown>).tableSeat === "string";
  return typeof item.gameId === "string" && typeof item.eventName === "string" && Number.isInteger(item.roundNumber) && Number.isInteger(item.matchInstance) && side(item.sideA) && side(item.sideB);
}

export async function getCorrectionWorkspace(tournamentId: string): Promise<CorrectionWorkspace> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_correction_workspace", { p_tournament_id: tournamentId });
  if (error || !data || typeof data !== "object") notFound();
  const result = data as Record<string, unknown>;
  if (!Array.isArray(result.proposalCandidates) || !Array.isArray(result.pendingReviews) || !result.proposalCandidates.every(isItem) || !result.pendingReviews.every(isItem)) notFound();
  return { proposalCandidates: result.proposalCandidates, pendingReviews: result.pendingReviews };
}
