import { isAccNumber, normalizeAccNumberInput } from "../acc-number.ts";
import { isUuid } from "./validation.ts";

export const setupOfficialRoles = ["co_director", "cross_checker", "judge"] as const;
export type SetupOfficialRole = (typeof setupOfficialRoles)[number];
type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: RecordValue, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);
const email = (value: unknown) => typeof value === "string" && value.trim().length <= 320 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
const name = (value: unknown) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 80;

export type SetupOfficialNominationRequest = { firstName: string; lastName: string; email: string; accNumber: string; operationId: string };
export type SetupOfficialManageRequest = { nominationId: string; action: "remove" | "restore"; operationId: string };
export type SetupOfficialEntry = { nominationId: string; displayName: string; firstName: string; lastName: string; email: string; accNumber: string; status: "registered_approved" | "invitation_email_sent" | "delivery_unavailable"; profileId: string | null };
export type SetupOfficialsWorkspace = { tournamentName: string; role: SetupOfficialRole; canManage: boolean; capacity: 12; entries: SetupOfficialEntry[] };

export function isSetupOfficialRole(value: string): value is SetupOfficialRole { return (setupOfficialRoles as readonly string[]).includes(value); }
export function isSetupOfficialNominationRequest(value: unknown): value is SetupOfficialNominationRequest {
  if (!object(value) || !exact(value, ["firstName", "lastName", "email", "accNumber", "operationId"])) return false;
  return name(value.firstName) && name(value.lastName) && email(value.email) && typeof value.accNumber === "string" && isAccNumber(normalizeAccNumberInput(value.accNumber)) && isUuid(value.operationId);
}
export function isSetupOfficialManageRequest(value: unknown): value is SetupOfficialManageRequest {
  return object(value) && exact(value, ["nominationId", "action", "operationId"]) && isUuid(value.nominationId) && (value.action === "remove" || value.action === "restore") && isUuid(value.operationId);
}
export function isSetupOfficialsWorkspace(value: unknown): value is SetupOfficialsWorkspace {
  if (!object(value) || !exact(value, ["tournamentName", "role", "canManage", "capacity", "entries"]) || typeof value.tournamentName !== "string" || !isSetupOfficialRole(String(value.role)) || typeof value.canManage !== "boolean" || value.capacity !== 12 || !Array.isArray(value.entries) || value.entries.length > 12) return false;
  return value.entries.every((entry) => object(entry) && exact(entry, ["nominationId", "displayName", "firstName", "lastName", "email", "accNumber", "status", "profileId"]) && isUuid(entry.nominationId) && name(entry.displayName) && typeof entry.firstName === "string" && typeof entry.lastName === "string" && typeof entry.email === "string" && typeof entry.accNumber === "string" && ["registered_approved", "invitation_email_sent", "delivery_unavailable"].includes(String(entry.status)) && (entry.profileId === null || isUuid(entry.profileId)));
}

// nominate_tournament_setup_official_v1 returns a specific rejection code for
// each refusal, and the client used to collapse all seven into "Review the
// details and try again". That is wrong in the most common case: the details are
// correct and the tournament setup simply has not been saved yet, so there is no
// setup revision to hang the invitation expiry on. A director reading the old
// message re-typed correct details over and over.
export function officialRejectionMessage(code: unknown, role: string) {
  const who = role === "co_director" ? "co-director" : role === "cross_checker" ? "cross-checker" : "judge";
  if (code === "saved_setup_end_required") return `Save the tournament setup first. Open Set Up Tournament, fill in the state or territory and the end date, and press Save All Events Draft. The ${who} invitation expires with the tournament, so it needs a saved end date before it can be sent.`;
  if (code === "not_primary_director") return `Only the tournament's primary director can add a ${who}.`;
  if (code === "official_capacity_reached") return `This tournament already has the maximum of 12 ${who} positions filled or pending.`;
  if (code === "duplicate_official") return `That email address is already assigned as a ${who} for this tournament.`;
  if (code === "self_assignment_forbidden") return `You cannot assign yourself as a ${who}.`;
  if (code === "idempotency_conflict") return "A different request is already using this submission id. Reload the page and try again.";
  if (code === "invalid_request") return "Check the first name, last name, email address, and ACC number, then try again.";
  return `The ${who} could not be saved. Reload the page and try again.`;
}
