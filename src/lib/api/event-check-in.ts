import { isUuid } from "./validation";
import { parseEventCheckInCredential } from "../event-check-in-token";

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);

export type EventCheckInRequest = { credential: string; firstName: string; lastName: string; email: string; accNumber: string };

export function isEventCheckInRequest(value: unknown): value is EventCheckInRequest {
  if (!isRecord(value) || Object.keys(value).length !== 5) return false;
  return typeof value.credential === "string" && !!parseEventCheckInCredential(value.credential)
    && typeof value.firstName === "string" && value.firstName.trim().length >= 1 && value.firstName.length <= 80
    && typeof value.lastName === "string" && value.lastName.trim().length >= 1 && value.lastName.length <= 80
    && typeof value.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim()) && value.email.length <= 320
    && typeof value.accNumber === "string" && (value.accNumber === "" || /^[A-Z]{2}\d+$/.test(value.accNumber));
}

export function isDirectorWindowAction(value: unknown): value is { action: "open" | "close"; eventId: string; idempotencyKey: string } {
  return isRecord(value) && Object.keys(value).length === 3 && (value.action === "open" || value.action === "close")
    && isUuid(value.eventId) && isUuid(value.idempotencyKey);
}

export function isDirectorQrIssue(value: unknown): value is { eventId: string; idempotencyKey: string } {
  return isRecord(value) && Object.keys(value).length === 2 && isUuid(value.eventId) && isUuid(value.idempotencyKey);
}

export function isDeskEventCheckIn(value: unknown): value is { action: "desk_check_in"; eventId: string; rosterEntryId: string; idempotencyKey: string } {
  return isRecord(value) && Object.keys(value).length === 4 && value.action === "desk_check_in"
    && isUuid(value.eventId) && isUuid(value.rosterEntryId) && isUuid(value.idempotencyKey);
}
