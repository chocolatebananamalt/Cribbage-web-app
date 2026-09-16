import { isUuid } from "./validation";

export type EventChangeRequest = {
  eventId: string;
  action: "retire" | "replace";
  reason: string;
  idempotencyKey: string;
};

export function isEventChangeRequest(value: unknown): value is EventChangeRequest {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return Object.keys(input).length === 4
    && isUuid(input.eventId)
    && (input.action === "retire" || input.action === "replace")
    && typeof input.reason === "string"
    && input.reason.trim().length >= 1
    && input.reason.trim().length <= 500
    && isUuid(input.idempotencyKey);
}

export function isAcceptedEventChange(value: unknown, request: EventChangeRequest) {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (result.status === `event_${request.action}d`)
    && result.eventId === request.eventId
    && isUuid(result.operationId)
    && (request.action === "retire" ? result.replacementEventId === null : isUuid(result.replacementEventId));
}

export function isRejectedEventChange(value: unknown) {
  return !!value && typeof value === "object"
    && (value as Record<string, unknown>).status === "rejected"
    && typeof (value as Record<string, unknown>).code === "string";
}
