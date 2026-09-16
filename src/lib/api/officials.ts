import { isUuid } from "./validation.ts";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: RecordValue, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);
const email = (value: unknown) => typeof value === "string" && value.trim().length <= 320 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

export type OfficialsWorkspace = { tournamentName: string; isPrimaryDirector: boolean; canEmergencyOverride: boolean; coDirectorCapacity: 4; activeCoDirectors: Array<{ profileId: string; displayName: string; invitationId: string | null }>; pendingInvitations: Array<{ invitationId: string; emailHint: string; expiresAt: string }> };
export function isOfficialsWorkspace(value: unknown): value is OfficialsWorkspace {
  if (!record(value) || !exact(value, ["tournamentName", "isPrimaryDirector", "canEmergencyOverride", "coDirectorCapacity", "activeCoDirectors", "pendingInvitations"]) || typeof value.tournamentName !== "string" || !value.tournamentName.trim() || typeof value.isPrimaryDirector !== "boolean" || typeof value.canEmergencyOverride !== "boolean" || value.coDirectorCapacity !== 4 || !Array.isArray(value.activeCoDirectors) || !Array.isArray(value.pendingInvitations)) return false;
  return value.activeCoDirectors.length <= 4 && value.pendingInvitations.length <= 4 && value.activeCoDirectors.every((entry) => record(entry) && exact(entry, ["profileId", "displayName", "invitationId"]) && isUuid(entry.profileId) && typeof entry.displayName === "string" && !!entry.displayName.trim() && (entry.invitationId === null || isUuid(entry.invitationId))) && value.pendingInvitations.every((entry) => record(entry) && exact(entry, ["invitationId", "emailHint", "expiresAt"]) && isUuid(entry.invitationId) && typeof entry.emailHint === "string" && typeof entry.expiresAt === "string");
}
export type InviteRequest = { email: string; operationId: string };
export function isInviteRequest(value: unknown): value is InviteRequest { return record(value) && exact(value, ["email", "operationId"]) && email(value.email) && isUuid(value.operationId); }
export type ManageRequest = { invitationId: string; action: "revoke" | "restore"; reason: string; emergency: boolean; operationId: string };
export function isManageRequest(value: unknown): value is ManageRequest { return record(value) && exact(value, ["invitationId", "action", "reason", "emergency", "operationId"]) && isUuid(value.invitationId) && (value.action === "revoke" || value.action === "restore") && typeof value.reason === "string" && value.reason.length <= 500 && typeof value.emergency === "boolean" && isUuid(value.operationId); }
export function isAccepted(value: unknown) { return record(value) && typeof value.status === "string" && ["co_director_invited", "co_director_accepted", "co_director_revoked", "co_director_restored"].includes(value.status); }
export function isOfficialRejection(value: unknown) { return record(value) && value.status === "rejected" && typeof value.code === "string"; }
