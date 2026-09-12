import { isUuid } from "./validation.ts";

export type ResultEventSummary = {
  eventId: string;
  name: string;
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
      return exact(candidate, ["eventId", "name", "participantCount"])
        && isUuid(candidate.eventId)
        && typeof candidate.name === "string" && candidate.name.length > 0
        && Number.isSafeInteger(candidate.participantCount) && (candidate.participantCount as number) >= 0;
    });
}
