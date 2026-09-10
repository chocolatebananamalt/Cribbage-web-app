import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";

export type AssignedGameContext = {
  gameId: string;
  tournamentId: string;
  eventId: string;
  roundNumber: number;
  matchInstance: number;
  state: "pending" | "submitted" | "confirmation_pending" | "mismatch" | "verified";
  eventName: string;
  ownSubmission: { id: string; winnerSide: "a" | "b"; margin: number } | null;
  ownConfirmed: boolean;
  canConfirm: boolean;
  player: { displayName: string; side: "a" | "b"; tableSeat: string; verificationId: string };
  opponent: { displayName: string; side: "a" | "b"; tableSeat: string; verificationId: string };
};

function isContext(value: unknown): value is AssignedGameContext {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const person = (candidate: unknown) => {
    if (!candidate || typeof candidate !== "object") return false;
    const item = candidate as Record<string, unknown>;
    return typeof item.displayName === "string" && typeof item.tableSeat === "string" && typeof item.verificationId === "string" && /^[A-Z]-[1-9][0-9]*$/.test(item.verificationId) && ["a", "b"].includes(item.side as string);
  };
  const ownSubmission = item.ownSubmission;
  const validSubmission = ownSubmission === null || (typeof ownSubmission === "object" && ownSubmission !== null && typeof (ownSubmission as Record<string, unknown>).id === "string" && ["a", "b"].includes((ownSubmission as Record<string, unknown>).winnerSide as string) && typeof (ownSubmission as Record<string, unknown>).margin === "number");
  return typeof item.gameId === "string" && typeof item.tournamentId === "string" && typeof item.eventId === "string" && typeof item.roundNumber === "number" && typeof item.matchInstance === "number" && ["pending", "submitted", "confirmation_pending", "mismatch", "verified"].includes(item.state as string) && typeof item.eventName === "string" && validSubmission && typeof item.ownConfirmed === "boolean" && typeof item.canConfirm === "boolean" && person(item.player) && person(item.opponent);
}

export async function getAssignedGameContext(gameId: string, tournamentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_assigned_game_context", { p_game_id: gameId });
  if (error || !isContext(data) || data.tournamentId !== tournamentId || data.player.side === data.opponent.side) notFound();
  return data;
}
