import { isUuid } from "./validation.ts";

export type ResultEventSummary = {
  eventId: string;
  name: string;
  eventType: "main" | "consolation" | "satellite" | "custom";
  format: "standard_singles" | "team" | "doubles" | "canadian_doubles" | "custom";
  scoringMethod: "digital" | "manual" | "imported";
  participantCount: number;
};

export type TournamentResultEventSummary = {
  tournamentId: string;
  tournamentName: string;
  events: ResultEventSummary[];
};

const exact = (value: object, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);

export function isTournamentResultEventSummary(value: unknown): value is TournamentResultEventSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exact(item, ["tournamentId", "tournamentName", "events"])
    && isUuid(item.tournamentId)
    && typeof item.tournamentName === "string" && item.tournamentName.length > 0
    && Array.isArray(item.events)
    && item.events.every((event) => {
      if (!event || typeof event !== "object" || Array.isArray(event)) return false;
      const candidate = event as Record<string, unknown>;
      return exact(candidate, ["eventId", "name", "eventType", "format", "scoringMethod", "participantCount"])
        && isUuid(candidate.eventId)
        && typeof candidate.name === "string" && candidate.name.length > 0
        && ["main", "consolation", "satellite", "custom"].includes(candidate.eventType as string)
        && ["standard_singles", "team", "doubles", "canadian_doubles", "custom"].includes(candidate.format as string)
        && ["digital", "manual", "imported"].includes(candidate.scoringMethod as string)
        && Number.isSafeInteger(candidate.participantCount) && (candidate.participantCount as number) >= 0;
    });
}
