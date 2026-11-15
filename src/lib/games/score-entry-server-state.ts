import type { AssignedGameContext } from "./assigned-game-context-decision";

type SavedGameState = Pick<AssignedGameContext, "state" | "ownSubmission" | "ownConfirmed" | "canConfirm">;

// A transport receipt means saved, never verified. This projection uses the
// protected server context; the confirmation RPC also returns trusted state.
export function scoreEntryServerState(context: SavedGameState) {
  const canConfirm = context.state === "confirmation_pending" && !!context.ownSubmission
    && context.canConfirm && !context.ownConfirmed;
  const status = context.state === "verified"
    ? "Game verified. The authoritative scorecard is updated."
    : context.state === "mismatch"
      ? "The entries do not match. This game needs cross-checking."
      : canConfirm
        ? "Both entries match. Confirm your own entry to continue."
        : context.ownConfirmed
          ? "Your confirmation is saved. The game will verify after the other player confirms their own entry."
          : context.ownSubmission
            ? "Your entry is saved. Required verification is still pending."
            : "Enter your independent result. It is not verified until both players submit and confirm.";
  return {
    key: JSON.stringify([context.state, context.ownSubmission?.id ?? null, context.ownConfirmed, context.canConfirm]),
    canConfirm,
    status,
  };
}
