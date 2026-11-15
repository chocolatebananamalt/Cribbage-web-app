import "server-only";

import { notFound } from "next/navigation";
import { isUuid } from "../api/validation";
import { createServerOnlyAdminClient } from "../supabase/private-admin";

export type PaperGameCandidate = {
  gameId: string;
  eventId: string;
  eventName: string;
  gameNumber: number;
  gameVersion: number;
  sideA: { displayName: string; verificationId: string; profileLinked: boolean };
  sideB: { displayName: string; verificationId: string; profileLinked: boolean };
};

export type PaperGameWorkspace = {
  tournamentId: string;
  tournamentName: string;
  actorRole: "director" | "co_director" | "cross_checker";
  actorIdentityConfirmed: boolean;
  unboundOfficials: { profileId: string; displayName: string; role: "director" | "co_director" | "cross_checker"; bindingVersion: number }[];
  rosterChoices: { rosterEntryId: string; displayName: string }[];
  candidates: PaperGameCandidate[];
  reviewCases: PaperGameReviewCase[];
};

export type PaperGameReviewCase = Omit<PaperGameCandidate, "eventId"> & { completionId: string };

const exactKeys = (value: object, keys: string[]) => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
};

function isSide(value: unknown): value is PaperGameCandidate["sideA"] {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !exactKeys(value, ["displayName", "verificationId", "profileLinked"])) return false;
  const side = value as Record<string, unknown>;
  return typeof side.displayName === "string" && side.displayName.trim().length > 0
    && typeof side.verificationId === "string" && /^[A-Z]-[1-9][0-9]*$/.test(side.verificationId)
    && typeof side.profileLinked === "boolean";
}

export function isPaperGameWorkspace(value: unknown): value is PaperGameWorkspace {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !exactKeys(value, ["tournamentId", "tournamentName", "actorRole", "actorIdentityConfirmed", "unboundOfficials", "rosterChoices", "candidates", "reviewCases"])) return false;
  const item = value as Record<string, unknown>;
  return isUuid(item.tournamentId) && typeof item.tournamentName === "string"
    && ["director", "co_director", "cross_checker"].includes(item.actorRole as string)
    && typeof item.actorIdentityConfirmed === "boolean"
    && Array.isArray(item.unboundOfficials) && item.unboundOfficials.every((entry) => !!entry && typeof entry === "object" && !Array.isArray(entry) && exactKeys(entry, ["profileId", "displayName", "role", "bindingVersion"]) && isUuid((entry as Record<string, unknown>).profileId) && typeof (entry as Record<string, unknown>).displayName === "string" && ["director", "co_director", "cross_checker"].includes((entry as Record<string, unknown>).role as string) && Number.isInteger((entry as Record<string, unknown>).bindingVersion) && Number((entry as Record<string, unknown>).bindingVersion)>=0)
    && Array.isArray(item.rosterChoices) && item.rosterChoices.every((entry) => !!entry && typeof entry === "object" && !Array.isArray(entry) && exactKeys(entry, ["rosterEntryId", "displayName"]) && isUuid((entry as Record<string, unknown>).rosterEntryId) && typeof (entry as Record<string, unknown>).displayName === "string")
    && Array.isArray(item.candidates) && Array.isArray(item.reviewCases)
    && item.candidates.every((candidate) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)
        || !exactKeys(candidate, ["gameId", "eventId", "eventName", "gameNumber", "gameVersion", "sideA", "sideB"])) return false;
      const game = candidate as Record<string, unknown>;
      return isUuid(game.gameId) && isUuid(game.eventId) && typeof game.eventName === "string"
        && Number.isInteger(game.gameNumber) && Number(game.gameNumber) > 0
        && Number.isInteger(game.gameVersion) && Number(game.gameVersion) > 0
        && isSide(game.sideA) && isSide(game.sideB);
    }) && item.reviewCases.every((candidate) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)
        || !exactKeys(candidate, ["completionId", "gameId", "eventName", "gameNumber", "gameVersion", "sideA", "sideB"])) return false;
      const game = candidate as Record<string, unknown>;
      return isUuid(game.completionId) && isUuid(game.gameId) && typeof game.eventName === "string"
        && Number.isInteger(game.gameNumber) && Number(game.gameNumber) > 0
        && Number.isInteger(game.gameVersion) && Number(game.gameVersion) > 0
        && isSide(game.sideA) && isSide(game.sideB);
    });
}

export async function getPaperGameWorkspace(actorId: string, tournamentId: string) {
  const { data, error } = await createServerOnlyAdminClient().rpc("get_paper_game_completion_workspace_v1", {
    p_actor_id: actorId,
    p_tournament_id: tournamentId,
  });
  if (error || !isPaperGameWorkspace(data) || data.tournamentId !== tournamentId) notFound();
  return data;
}
