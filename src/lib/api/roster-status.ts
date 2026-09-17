import { isUuid } from "./validation";

export type RosterStatusRequest = {
  rosterEntryId: string;
  action: "withdraw" | "reinstate";
  reasonCode: "duplicate_entry" | "player_withdrew" | "unable_to_attend" | "administrative_correction" | "other";
  note: string;
  idempotencyKey: string;
};

const reasons = ["duplicate_entry", "player_withdrew", "unable_to_attend", "administrative_correction", "other"];
const exact = (value: object, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);

export function isRosterStatusRequest(value: unknown): value is RosterStatusRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exact(item, ["rosterEntryId", "action", "reasonCode", "note", "idempotencyKey"])
    && isUuid(item.rosterEntryId) && isUuid(item.idempotencyKey)
    && (item.action === "withdraw" || item.action === "reinstate")
    && typeof item.reasonCode === "string" && reasons.includes(item.reasonCode)
    && typeof item.note === "string" && item.note.length <= 500
    && (item.reasonCode !== "other" || item.note.trim().length >= 1);
}

export function isAcceptedRosterStatus(value: unknown, request: RosterStatusRequest) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exact(item, ["status", "rosterEntryId", "active", "version"])
    && item.rosterEntryId === request.rosterEntryId && Number.isSafeInteger(item.version)
    && ((request.action === "withdraw" && item.status === "roster_entry_withdrawn" && item.active === false)
      || (request.action === "reinstate" && item.status === "roster_entry_reinstated" && item.active === true));
}

export function isRejectedRosterStatus(value: unknown, rosterEntryId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exact(item, ["status", "code", "rosterEntryId"])
    && item.status === "rejected" && item.rosterEntryId === rosterEntryId
    && ["not_director", "roster_entry_unavailable", "invalid_state_transition", "downstream_activity_requires_event_workflow", "idempotency_conflict", "invalid_request"].includes(item.code as string);
}
