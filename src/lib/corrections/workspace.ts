import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import type { CorrectionProposalCandidate, CorrectionWorkspace, PendingCorrectionReview } from "./types";

export type { CorrectionProposalCandidate, CorrectionWorkspace, PendingCorrectionReview } from "./types";

function hasBaseItem(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const side = (x: unknown) => !!x && typeof x === "object" && typeof (x as Record<string, unknown>).displayName === "string" && typeof (x as Record<string, unknown>).tableSeat === "string";
  return typeof item.gameId === "string" && typeof item.eventName === "string" && Number.isInteger(item.roundNumber) && Number.isInteger(item.matchInstance) && side(item.sideA) && side(item.sideB);
}

function isProposalCandidate(value: unknown): value is CorrectionProposalCandidate {
  if (!hasBaseItem(value)) return false;
  const item = value as Record<string, unknown>;
  return Number.isSafeInteger(item.gameVersion) && (item.gameVersion as number) > 0
    && (item.winnerSide === "a" || item.winnerSide === "b")
    && Number.isInteger(item.margin) && (item.margin as number) >= 1 && (item.margin as number) <= 121;
}

function isPendingReview(value: unknown): value is PendingCorrectionReview {
  if (!hasBaseItem(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.correctionId === "string"
    && Number.isSafeInteger(item.baseGameVersion) && (item.baseGameVersion as number) > 0
    && (item.previousWinnerSide === "a" || item.previousWinnerSide === "b")
    && Number.isInteger(item.previousMargin) && (item.previousMargin as number) >= 1 && (item.previousMargin as number) <= 121
    && (item.correctedWinnerSide === "a" || item.correctedWinnerSide === "b")
    && Number.isInteger(item.correctedMargin) && (item.correctedMargin as number) >= 1 && (item.correctedMargin as number) <= 121
    && (item.reason === null || typeof item.reason === "string");
}

export async function getCorrectionWorkspace(tournamentId: string): Promise<CorrectionWorkspace> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_correction_workspace", { p_tournament_id: tournamentId });
  if (error || !data || typeof data !== "object") notFound();
  const result = data as Record<string, unknown>;
  if (!Array.isArray(result.proposalCandidates) || !Array.isArray(result.pendingReviews) || !result.proposalCandidates.every(isProposalCandidate) || !result.pendingReviews.every(isPendingReview)) notFound();
  return { proposalCandidates: result.proposalCandidates, pendingReviews: result.pendingReviews };
}
