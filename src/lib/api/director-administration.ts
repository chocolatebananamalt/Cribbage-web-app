import { isUuid } from "./validation.ts";

type Value = Record<string, unknown>;
const record = (value: unknown): value is Value => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Value, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);
const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const nullableTimestamp = (value: unknown) => value === null || timestamp(value);
const nullableText = (value: unknown) => value === null || typeof value === "string";

export type DirectorAccessWorkspace = {
  canCreateTournament: boolean;
  isPlatformAdmin: boolean;
  administratorType: "app_owner" | "acc_administrator" | null;
  directorStatus: "approved" | "suspended" | null;
  accVerified: boolean;
  pendingApplicationId: string | null;
};

export type DirectorApplication = {
  applicationId: string;
  applicantProfileId: string;
  displayName: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  accVerified: boolean;
};

export type DirectorAuthorization = {
  profileId: string;
  displayName: string;
  status: "approved" | "suspended";
  accVerified: boolean;
  version: number;
  updatedAt: string;
};

export type DirectorAdminWorkspace = {
  administratorType: "app_owner" | "acc_administrator";
  applications: DirectorApplication[];
  authorizations: DirectorAuthorization[];
};

export type CreateTournamentRequest = { name: string; plannedStartDate: string; idempotencyKey: string };
export type ReviewDirectorRequest = { decision: "approve" | "reject"; accVerified: boolean; note: string | null; idempotencyKey: string };
export type ChangeDirectorStatusRequest = { status: "approved" | "suspended"; note: string; idempotencyKey: string };

export function isDirectorAccessWorkspace(value: unknown): value is DirectorAccessWorkspace {
  if (!record(value) || !exact(value, ["canCreateTournament", "isPlatformAdmin", "administratorType", "directorStatus", "accVerified", "pendingApplicationId"])) return false;
  return typeof value.canCreateTournament === "boolean" && typeof value.isPlatformAdmin === "boolean"
    && (value.administratorType === null || value.administratorType === "app_owner" || value.administratorType === "acc_administrator")
    && (value.directorStatus === null || value.directorStatus === "approved" || value.directorStatus === "suspended")
    && typeof value.accVerified === "boolean" && (value.pendingApplicationId === null || isUuid(value.pendingApplicationId));
}

function isApplication(value: unknown): value is DirectorApplication {
  return record(value) && exact(value, ["applicationId", "applicantProfileId", "displayName", "status", "submittedAt", "decidedAt", "decisionNote", "accVerified"])
    && isUuid(value.applicationId) && isUuid(value.applicantProfileId) && typeof value.displayName === "string" && value.displayName.trim().length > 0
    && ["pending", "approved", "rejected"].includes(value.status as string) && timestamp(value.submittedAt)
    && nullableTimestamp(value.decidedAt) && nullableText(value.decisionNote) && typeof value.accVerified === "boolean";
}

function isAuthorization(value: unknown): value is DirectorAuthorization {
  return record(value) && exact(value, ["profileId", "displayName", "status", "accVerified", "version", "updatedAt"])
    && isUuid(value.profileId) && typeof value.displayName === "string" && value.displayName.trim().length > 0
    && ["approved", "suspended"].includes(value.status as string) && typeof value.accVerified === "boolean"
    && Number.isInteger(value.version) && Number(value.version) > 0 && timestamp(value.updatedAt);
}

export function isDirectorAdminWorkspace(value: unknown): value is DirectorAdminWorkspace {
  return record(value) && exact(value, ["administratorType", "applications", "authorizations"])
    && ["app_owner", "acc_administrator"].includes(value.administratorType as string)
    && Array.isArray(value.applications) && value.applications.every(isApplication)
    && Array.isArray(value.authorizations) && value.authorizations.every(isAuthorization);
}

export function isCreateTournamentRequest(value: unknown): value is CreateTournamentRequest {
  if (!record(value) || !exact(value, ["name", "plannedStartDate", "idempotencyKey"]) || !isUuid(value.idempotencyKey)) return false;
  if (typeof value.name !== "string" || value.name.trim().length < 1 || value.name.trim().length > 200) return false;
  return typeof value.plannedStartDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.plannedStartDate)
    && Number.isFinite(Date.parse(`${value.plannedStartDate}T00:00:00Z`));
}

export function isReviewDirectorRequest(value: unknown): value is ReviewDirectorRequest {
  return record(value) && exact(value, ["decision", "accVerified", "note", "idempotencyKey"])
    && ["approve", "reject"].includes(value.decision as string) && typeof value.accVerified === "boolean"
    && isUuid(value.idempotencyKey) && (value.note === null || (typeof value.note === "string" && value.note.trim().length >= 1 && value.note.trim().length <= 500));
}

export function isChangeDirectorStatusRequest(value: unknown): value is ChangeDirectorStatusRequest {
  return record(value) && exact(value, ["status", "note", "idempotencyKey"])
    && ["approved", "suspended"].includes(value.status as string) && isUuid(value.idempotencyKey)
    && typeof value.note === "string" && value.note.trim().length >= 1 && value.note.trim().length <= 500;
}

export function isApplicationResult(value: unknown) {
  return record(value) && ((exact(value, ["status", "applicationId"]) && value.status === "application_submitted" && isUuid(value.applicationId))
    || (exact(value, ["status", "code"]) && value.status === "rejected" && typeof value.code === "string"));
}

export function isTournamentCreated(value: unknown): value is { status: "tournament_created"; tournamentId: string; tournamentName: string; tournamentDate: string } {
  return record(value) && exact(value, ["status", "tournamentId", "tournamentName", "tournamentDate"])
    && value.status === "tournament_created" && isUuid(value.tournamentId) && typeof value.tournamentName === "string"
    && typeof value.tournamentDate === "string" && /^\d{2}-\d{2}-\d{4}$/.test(value.tournamentDate);
}

export function isMutationResult(value: unknown) {
  return record(value) && typeof value.status === "string"
    && (value.status !== "rejected" || typeof value.code === "string");
}
