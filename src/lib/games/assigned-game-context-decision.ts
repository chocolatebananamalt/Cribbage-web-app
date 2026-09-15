export type AssignedGameContext = {
  actorId: string;
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
  progressionStatus: "not_started" | "current" | "upcoming" | "completed";
  canEnter: boolean;
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
  return typeof item.actorId === "string" && item.actorId.length > 0 && typeof item.gameId === "string" && typeof item.tournamentId === "string" && typeof item.eventId === "string" && typeof item.roundNumber === "number" && typeof item.matchInstance === "number" && ["pending", "submitted", "confirmation_pending", "mismatch", "verified"].includes(item.state as string) && typeof item.eventName === "string" && validSubmission && typeof item.ownConfirmed === "boolean" && typeof item.canConfirm === "boolean" && ["not_started", "current", "upcoming", "completed"].includes(item.progressionStatus as string) && typeof item.canEnter === "boolean" && (!item.canEnter || (item.progressionStatus === "current" && ownSubmission === null && ["pending", "submitted"].includes(item.state as string))) && (item.progressionStatus === "current" || item.canConfirm === false) && person(item.player) && person(item.opponent);
}

export function decideAssignedGameContextRead({ data, error, tournamentId }: { data: unknown; error: unknown; tournamentId: string }) {
  if (data === null && !error) return "not_found" as const;
  if (error || !isContext(data)) return "unavailable" as const;
  if (data.tournamentId !== tournamentId || data.player.side === data.opponent.side) return "not_found" as const;
  return "available" as const;
}
