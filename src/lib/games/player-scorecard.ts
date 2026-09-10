import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";

type ScorecardLine = {
  roundNumber: number;
  matchInstance: number;
  gamePoints: number;
  plusPoints: number;
  minusPoints: number;
  opponentName: string;
  opponentVerificationId: string;
};

export type PlayerScorecard = {
  tournamentId: string;
  eventId: string;
  tournamentName: string;
  eventName: string;
  player: { displayName: string; verificationId: string };
  lines: ScorecardLine[];
  totals: { gamePoints: number; plusPoints: number; minusPoints: number; gamesWon: number; netSpreadPoints: number };
  pendingGames: { roundNumber: number; matchInstance: number; state: "pending" | "submitted" | "confirmation_pending" | "mismatch" }[];
};

const verificationId = (value: unknown) => typeof value === "string" && /^[A-Z]-[1-9][0-9]*$/.test(value);
const whole = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0;

function isScorecard(value: unknown): value is PlayerScorecard {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const player = data.player as Record<string, unknown> | null;
  const totals = data.totals as Record<string, unknown> | null;
  const validLine = (line: unknown) => {
    if (!line || typeof line !== "object") return false;
    const item = line as Record<string, unknown>;
    return whole(item.roundNumber) && (item.roundNumber as number) > 0 && whole(item.matchInstance) && (item.matchInstance as number) > 0 && [0, 2, 3].includes(item.gamePoints as number) && whole(item.plusPoints) && whole(item.minusPoints) && typeof item.opponentName === "string" && verificationId(item.opponentVerificationId);
  };
  const validPending = (line: unknown) => {
    if (!line || typeof line !== "object") return false;
    const item = line as Record<string, unknown>;
    return whole(item.roundNumber) && (item.roundNumber as number) > 0 && whole(item.matchInstance) && (item.matchInstance as number) > 0 && ["pending", "submitted", "confirmation_pending", "mismatch"].includes(item.state as string);
  };
  return typeof data.tournamentId === "string" && typeof data.eventId === "string" && typeof data.tournamentName === "string" && typeof data.eventName === "string" && !!player && typeof player.displayName === "string" && verificationId(player.verificationId) && Array.isArray(data.lines) && data.lines.every(validLine) && !!totals && whole(totals.gamePoints) && whole(totals.plusPoints) && whole(totals.minusPoints) && whole(totals.gamesWon) && typeof totals.netSpreadPoints === "number" && Number.isInteger(totals.netSpreadPoints) && Array.isArray(data.pendingGames) && data.pendingGames.every(validPending);
}

export async function getPlayerScorecard(tournamentId: string, eventId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_player_scorecard", { p_tournament_id: tournamentId, p_event_id: eventId });
  if (error || !isScorecard(data) || data.tournamentId !== tournamentId || data.eventId !== eventId) notFound();
  return data;
}
