import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";

export type CorrectionPolicy = {
  tournamentId: string;
  tournamentStatus: "draft" | "open" | "pending_finalization" | "finalized" | "archived";
  policyVersion: number;
  reasonRequired: boolean;
  requiredApprovals: 0 | 1;
  canConfigure: boolean;
};

function isPolicy(value: unknown): value is CorrectionPolicy {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.tournamentId === "string"
    && ["draft", "open", "pending_finalization", "finalized", "archived"].includes(item.tournamentStatus as string)
    && Number.isSafeInteger(item.policyVersion) && (item.policyVersion as number) >= 0
    && typeof item.reasonRequired === "boolean"
    && (item.requiredApprovals === 0 || item.requiredApprovals === 1)
    && typeof item.canConfigure === "boolean";
}

export async function getCorrectionPolicy(tournamentId: string): Promise<CorrectionPolicy> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_correction_policy", { p_tournament_id: tournamentId });
  if (error || !isPolicy(data) || data.tournamentId !== tournamentId) notFound();
  return data;
}
