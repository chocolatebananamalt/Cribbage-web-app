import "server-only";

import { notFound } from "next/navigation";
import { createServerOnlyAdminClient } from "../supabase/private-admin";
import { isUuid } from "../api/validation";
import { isRecoveryEvidence, type RecoveryEvidence } from "../api/device-failure-recovery";

export type RecoveryCandidate = {
  gameId: string;
  eventName: string;
  roundNumber: number;
  matchInstance: number;
  gameVersion: number;
  gameState: "pending" | "submitted" | "mismatch" | "confirmation_pending";
  sideA: { displayName: string };
  sideB: { displayName: string };
  survivingClaims: RecoveryEvidence[];
};

export type RecoveryReviewCase = {
  recoveryId: string;
  gameId: string;
  eventName: string;
  roundNumber: number;
  matchInstance: number;
  state: "pending_review" | "disputed";
  winnerSide: "a" | "b";
  margin: number;
  sideA: { displayName: string };
  sideB: { displayName: string };
  evidence: RecoveryEvidence[];
};

export type DeviceRecoveryWorkspace = {
  tournamentId: string;
  tournamentName: string;
  actorRole: "director" | "co_director" | "cross_checker";
  proposalCandidates: RecoveryCandidate[];
  reviewCases: RecoveryReviewCase[];
};

const positive = (value: unknown) => Number.isInteger(value) && (value as number) > 0;
const namedSide = (value: unknown): value is { displayName: string } => !!value && typeof value === "object" && typeof (value as Record<string, unknown>).displayName === "string";

export function isDeviceRecoveryWorkspace(value: unknown): value is DeviceRecoveryWorkspace {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (!isUuid(data.tournamentId) || typeof data.tournamentName !== "string"
    || !["director", "co_director", "cross_checker"].includes(data.actorRole as string)
    || !Array.isArray(data.proposalCandidates) || !Array.isArray(data.reviewCases)) return false;
  return data.proposalCandidates.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const item = entry as Record<string, unknown>;
    return isUuid(item.gameId) && typeof item.eventName === "string"
      && positive(item.roundNumber) && positive(item.matchInstance) && positive(item.gameVersion)
      && ["pending", "submitted", "mismatch", "confirmation_pending"].includes(item.gameState as string)
      && namedSide(item.sideA) && namedSide(item.sideB)
      && Array.isArray(item.survivingClaims) && item.survivingClaims.every(isRecoveryEvidence);
  }) && data.reviewCases.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const item = entry as Record<string, unknown>;
    return isUuid(item.recoveryId) && isUuid(item.gameId) && typeof item.eventName === "string"
      && positive(item.roundNumber) && positive(item.matchInstance)
      && ["pending_review", "disputed"].includes(item.state as string)
      && ["a", "b"].includes(item.winnerSide as string)
      && Number.isInteger(item.margin) && (item.margin as number) >= 1 && (item.margin as number) <= 121
      && namedSide(item.sideA) && namedSide(item.sideB)
      && Array.isArray(item.evidence) && item.evidence.every(isRecoveryEvidence);
  });
}

export async function getDeviceRecoveryWorkspace(actorId: string, tournamentId: string) {
  const { data, error } = await createServerOnlyAdminClient().rpc("get_device_failure_recovery_workspace_v1", {
    p_actor_id: actorId,
    p_tournament_id: tournamentId,
  });
  if (error || !isDeviceRecoveryWorkspace(data) || data.tournamentId !== tournamentId) notFound();
  return data;
}
