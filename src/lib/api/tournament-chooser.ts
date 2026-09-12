// PostgreSQL accepts the standard 8-4-4-4-12 hexadecimal UUID shape without
// requiring RFC version/variant bits. Existing imported tournament IDs may use
// that broader, still strongly typed representation.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const datePattern = /^(?:|\d{2}-\d{2}-\d{4})$/;

const statuses = new Set(["draft", "open", "pending_finalization", "finalized"]);
const roles = new Set(["director", "co_director", "cross_checker", "judge", "player", "viewer"]);
const keys = ["tournamentId", "tournamentName", "tournamentDate", "tournamentStatus", "effectiveRole"];
const sortedKeys = [...keys].sort();

export type AccessibleTournament = {
  tournamentId: string;
  tournamentName: string;
  tournamentDate: string;
  tournamentStatus: "draft" | "open" | "pending_finalization" | "finalized";
  effectiveRole: "director" | "co_director" | "cross_checker" | "judge" | "player" | "viewer";
};

function exactObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === sortedKeys.length && sortedKeys.every((key, index) => actual[index] === key);
}

export function isAccessibleTournament(value: unknown): value is AccessibleTournament {
  if (!exactObject(value)) return false;
  return typeof value.tournamentId === "string" && uuidPattern.test(value.tournamentId)
    && typeof value.tournamentName === "string"
    && value.tournamentName.trim() === value.tournamentName
    && value.tournamentName.length >= 1
    && value.tournamentName.length <= 200
    && typeof value.tournamentDate === "string"
    && datePattern.test(value.tournamentDate)
    && typeof value.tournamentStatus === "string"
    && statuses.has(value.tournamentStatus)
    && typeof value.effectiveRole === "string"
    && roles.has(value.effectiveRole);
}

export function isAccessibleTournamentList(value: unknown): value is AccessibleTournament[] {
  return Array.isArray(value)
    && value.length <= 500
    && value.every(isAccessibleTournament)
    && new Set(value.map((item) => item.tournamentId)).size === value.length;
}

export function isUuid(value: string) {
  return uuidPattern.test(value);
}
