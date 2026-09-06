export type ScoreResult = {
  margin: number;
  winner: "player" | "opponent";
  playerPlus: number;
  playerMinus: number;
  opponentPlus: number;
  opponentMinus: number;
  playerGamePoints: 0 | 2 | 3;
  opponentGamePoints: 0 | 2 | 3;
  skunkLevel: 0 | 1 | 2 | 3;
};

export function classifySkunk(margin: number): 0 | 1 | 2 | 3 {
  if (margin >= 91) return 3;
  if (margin >= 61) return 2;
  if (margin >= 31) return 1;
  return 0;
}

export function formatSignedNet(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function isScoreEntryReady(margin: number, winner: unknown): boolean {
  return Number.isInteger(margin) && margin >= 1 && margin <= 121 && (winner === "player" || winner === "opponent");
}

export function deriveScore(margin: number, winner: unknown): ScoreResult {
  if (!Number.isInteger(margin) || margin < 1 || margin > 121) {
    throw new RangeError("Margin must be a whole number from 1 through 121.");
  }
  if (winner !== "player" && winner !== "opponent") {
    throw new TypeError("Winner must be either player or opponent.");
  }

  const skunkLevel = classifySkunk(margin);
  const gamePoints = skunkLevel > 0 ? 3 : 2;
  return winner === "player"
    ? {
        margin,
        winner,
        playerPlus: margin,
        playerMinus: 0,
        opponentPlus: 0,
        opponentMinus: margin,
        playerGamePoints: gamePoints,
        opponentGamePoints: 0,
        skunkLevel,
      }
    : {
        margin,
        winner,
        playerPlus: 0,
        playerMinus: margin,
        opponentPlus: margin,
        opponentMinus: 0,
        playerGamePoints: 0,
        opponentGamePoints: gamePoints,
        skunkLevel,
      };
}
