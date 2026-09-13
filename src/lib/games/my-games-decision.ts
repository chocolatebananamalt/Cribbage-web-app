const states = new Set(["pending", "submitted", "confirmation_pending", "mismatch", "verified", "corrected", "recovered"]);
const seat = (value: unknown) => typeof value === "string" && /^[A-Z]-[1-9][0-9]*$/.test(value);
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export type AssignedGameSummary = {
  gameId: string;
  eventId: string;
  eventName: string;
  gameNumber: number;
  matchInstance: number;
  state: "pending" | "submitted" | "confirmation_pending" | "mismatch" | "verified" | "corrected" | "recovered";
  playerSide: "a" | "b";
  playerTableSeat: string;
  playerVerificationId: string;
  opponentName: string;
  opponentTableSeat: string;
  opponentVerificationId: string;
  ownSubmitted: boolean;
  ownConfirmed: boolean;
  canConfirm: boolean;
  progressionStatus: "current" | "upcoming" | "completed";
  nextAction: "enter_result" | "wait_opponent_entry" | "review_confirm" | "wait_opponent_confirmation" | "mismatch_review" | "view_scorecard" | "upcoming_locked";
};

export type MyGamesWorkspace = {
  tournamentId: string;
  tournamentName: string;
  tournamentDate: string;
  games: AssignedGameSummary[];
};

function expectedNextAction(game: Record<string, unknown>) {
  if (game.progressionStatus === "upcoming" && game.canConfirm === false) return "upcoming_locked";
  if (game.progressionStatus === "completed" && game.canConfirm === false) return "view_scorecard";
  if (game.progressionStatus !== "current") return null;
  const state = game.state;
  const submitted = game.ownSubmitted;
  const confirmed = game.ownConfirmed;
  const canConfirm = game.canConfirm;
  if (state === "pending" && submitted === false && confirmed === false && canConfirm === false) return "enter_result";
  if (state === "submitted" && confirmed === false && canConfirm === false) return submitted ? "wait_opponent_entry" : "enter_result";
  if (state === "confirmation_pending" && submitted === true && canConfirm === !confirmed) return canConfirm ? "review_confirm" : "wait_opponent_confirmation";
  if (state === "mismatch" && submitted === true && confirmed === false && canConfirm === false) return "mismatch_review";
  if ((state === "verified" || state === "corrected") && submitted === true && confirmed === true && canConfirm === false) return "view_scorecard";
  if (state === "recovered" && canConfirm === false) return "view_scorecard";
  return null;
}

export function isMyGamesWorkspace(value: unknown, tournamentId: string): value is MyGamesWorkspace {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== 4 || item.tournamentId !== tournamentId || !text(item.tournamentName) || typeof item.tournamentDate !== "string" || (item.tournamentDate !== "" && !/^\d{2}-\d{2}-\d{4}$/.test(item.tournamentDate)) || !Array.isArray(item.games)) return false;
  return item.games.every((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const game = candidate as Record<string, unknown>;
    return Object.keys(game).length === 17
      && uuid(game.gameId) && uuid(game.eventId) && text(game.eventName)
      && Number.isInteger(game.gameNumber) && (game.gameNumber as number) > 0
      && Number.isInteger(game.matchInstance) && (game.matchInstance as number) > 0
      && states.has(game.state as string) && ["a", "b"].includes(game.playerSide as string)
      && seat(game.playerTableSeat) && seat(game.playerVerificationId)
      && text(game.opponentName) && seat(game.opponentTableSeat) && seat(game.opponentVerificationId)
      && typeof game.ownSubmitted === "boolean" && typeof game.ownConfirmed === "boolean" && typeof game.canConfirm === "boolean"
      && ["current", "upcoming", "completed"].includes(game.progressionStatus as string)
      && ["enter_result", "wait_opponent_entry", "review_confirm", "wait_opponent_confirmation", "mismatch_review", "view_scorecard", "upcoming_locked"].includes(game.nextAction as string)
      && game.nextAction === expectedNextAction(game);
  });
}
