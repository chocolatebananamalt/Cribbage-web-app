const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const whole = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0;
const envelopeKeys = ["tournamentId", "eventId", "tournamentName", "eventName", "status", "rows"];
const rowKeys = ["participantId", "displayName", "participantStatus", "verifiedGames", "gamePoints", "gamesWon", "plusPoints", "minusPoints", "netSpreadPoints", "numericRank", "tied"];

function hasExactKeys(value: object, keys: string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
}

export type PreliminaryStanding = {
  participantId: string;
  displayName: string;
  participantStatus: "registered" | "checked_in" | "withdrawn" | "disqualified";
  verifiedGames: number;
  gamePoints: number;
  gamesWon: number;
  plusPoints: number;
  minusPoints: number;
  netSpreadPoints: number;
  numericRank: number;
  tied: boolean;
};

export type PreliminaryEventStandings = {
  tournamentId: string;
  eventId: string;
  tournamentName: string;
  eventName: string;
  status: "preliminary";
  rows: PreliminaryStanding[];
};

function isRow(value: unknown): value is PreliminaryStanding {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return hasExactKeys(value, rowKeys)
    && uuid(row.participantId) && typeof row.displayName === "string" && row.displayName.trim().length > 0
    && ["registered", "checked_in", "withdrawn", "disqualified"].includes(row.participantStatus as string)
    && whole(row.verifiedGames) && whole(row.gamePoints) && whole(row.gamesWon)
    && whole(row.plusPoints) && whole(row.minusPoints)
    && typeof row.netSpreadPoints === "number" && Number.isInteger(row.netSpreadPoints)
    && (row.netSpreadPoints as number) === (row.plusPoints as number) - (row.minusPoints as number)
    && (row.gamesWon as number) <= (row.verifiedGames as number)
    && (row.gamePoints as number) >= 2 * (row.gamesWon as number)
    && (row.gamePoints as number) <= 3 * (row.gamesWon as number)
    && whole(row.numericRank) && (row.numericRank as number) > 0 && typeof row.tied === "boolean";
}

function scoreKey(row: PreliminaryStanding) {
  return `${row.gamePoints}:${row.gamesWon}:${row.netSpreadPoints}:${row.plusPoints}`;
}

function currentOutranksPrevious(previous: PreliminaryStanding, current: PreliminaryStanding) {
  return current.gamePoints - previous.gamePoints
    || current.gamesWon - previous.gamesWon
    || current.netSpreadPoints - previous.netSpreadPoints
    || current.plusPoints - previous.plusPoints;
}

export function isPreliminaryEventStandings(value: unknown): value is PreliminaryEventStandings {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (!hasExactKeys(value, envelopeKeys) || !uuid(data.tournamentId) || !uuid(data.eventId)) return false;
  if (typeof data.tournamentName !== "string" || typeof data.eventName !== "string"
      || data.status !== "preliminary" || !Array.isArray(data.rows) || !data.rows.every(isRow)) return false;
  const rows = data.rows as PreliminaryStanding[];
  if (new Set(rows.map((row) => row.participantId)).size !== rows.length) return false;
  const groupSizes = new Map<string, number>();
  for (const row of rows) groupSizes.set(scoreKey(row), (groupSizes.get(scoreKey(row)) ?? 0) + 1);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const previous = rows[index - 1];
    if (previous && currentOutranksPrevious(previous, row) > 0) return false;
    const expectedRank = !previous || scoreKey(previous) !== scoreKey(row) ? index + 1 : previous.numericRank;
    if (row.numericRank !== expectedRank || row.tied !== ((groupSizes.get(scoreKey(row)) ?? 0) > 1)) return false;
  }
  return true;
}
