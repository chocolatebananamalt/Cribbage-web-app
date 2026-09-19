import { isAccNumber } from "../acc-number.ts";
import { isUuid } from "./validation.ts";

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const minor = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 100_000_000;
const shortText = (value: unknown, max: number) => typeof value === "string" && value.trim().length <= max;

export type TournamentDayImportWorkspace = {
  tournamentName: string;
  events: Array<{
    eventId: string;
    name: string;
    eventType: string;
    format: string;
    scoringMethod: string;
    qPoolSlots: number[];
    sidePools: Array<{ poolId: string; displayName: string; entryFeeMinor: number }>;
  }>;
};

export type TournamentDayImportRow = {
  firstName: string;
  lastName: string;
  email: string;
  accNumber: string;
  scorecardType: "digital" | "paper";
  paymentStatus: "paid" | "unpaid";
  paymentMethod: "cash" | "check" | "other";
  paymentReference: string;
  eventEnrollments: Array<{ eventId: string; amountMinor: number }>;
  qPoolPayments: Array<{ eventId: string; qPoolSlot: 1 | 2; amountMinor: number }>;
  sidePoolElections: Array<{ eventId: string; poolId: string; amountMinor: number }>;
};

export type TournamentDayImportRequest = { rows: TournamentDayImportRow[]; idempotencyKey: string };

export function isTournamentDayImportWorkspace(value: unknown): value is TournamentDayImportWorkspace {
  return record(value)
    && exact(value, ["tournamentName", "events"])
    && typeof value.tournamentName === "string"
    && Array.isArray(value.events)
    && value.events.every((event) => record(event)
      && exact(event, ["eventId", "name", "eventType", "format", "scoringMethod", "qPoolSlots", "sidePools"])
      && isUuid(event.eventId)
      && typeof event.name === "string"
      && typeof event.eventType === "string"
      && typeof event.format === "string"
      && typeof event.scoringMethod === "string"
      && Array.isArray(event.qPoolSlots)
      && event.qPoolSlots.every((slot) => slot === 1 || slot === 2)
      && Array.isArray(event.sidePools)
      && event.sidePools.every((pool) => record(pool)
        && exact(pool, ["poolId", "displayName", "entryFeeMinor"])
        && isUuid(pool.poolId)
        && typeof pool.displayName === "string"
        && minor(pool.entryFeeMinor)));
}

export function isTournamentDayImportRequest(value: unknown): value is TournamentDayImportRequest {
  if (!record(value) || !exact(value, ["rows", "idempotencyKey"]) || !isUuid(value.idempotencyKey) || !Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > 500) return false;
  return value.rows.every((row) => {
    if (!record(row) || !exact(row, ["firstName", "lastName", "email", "accNumber", "scorecardType", "paymentStatus", "paymentMethod", "paymentReference", "eventEnrollments", "qPoolPayments", "sidePoolElections"])) return false;
    const firstName = typeof row.firstName === "string" ? row.firstName.trim() : "";
    const lastName = typeof row.lastName === "string" ? row.lastName.trim() : "";
    return firstName.length >= 1 && firstName.length <= 80
      && lastName.length >= 1 && lastName.length <= 80
      && `${firstName} ${lastName}`.length <= 160
      && typeof row.email === "string" && row.email.trim().length <= 320
      && (row.email.trim().length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim()))
      && typeof row.accNumber === "string" && isAccNumber(row.accNumber.trim())
      && (row.scorecardType === "digital" || row.scorecardType === "paper")
      && (row.paymentStatus === "paid" || row.paymentStatus === "unpaid")
      && ["cash", "check", "other"].includes(row.paymentMethod as string)
      && shortText(row.paymentReference, 100)
      && Array.isArray(row.eventEnrollments) && row.eventEnrollments.length <= 30
      && row.eventEnrollments.every((item) => record(item) && exact(item, ["eventId", "amountMinor"]) && isUuid(item.eventId) && minor(item.amountMinor))
      && Array.isArray(row.qPoolPayments) && row.qPoolPayments.length <= 60
      && row.qPoolPayments.every((item) => record(item) && exact(item, ["eventId", "qPoolSlot", "amountMinor"]) && isUuid(item.eventId) && (item.qPoolSlot === 1 || item.qPoolSlot === 2) && minor(item.amountMinor))
      && Array.isArray(row.sidePoolElections) && row.sidePoolElections.length <= 180
      && row.sidePoolElections.every((item) => record(item) && exact(item, ["eventId", "poolId", "amountMinor"]) && isUuid(item.eventId) && isUuid(item.poolId) && minor(item.amountMinor));
  });
}

export function isAcceptedTournamentDayImport(value: unknown): value is {
  status: "tournament_day_csv_imported";
  importedRows: number;
  rosterCreatedCount: number;
  rosterMatchedCount: number;
  eventEnrollmentCount: number;
  eventEnrollmentExistingCount: number;
  paymentReceiptCount: number;
  paymentExistingCount: number;
  sidePoolElectionCount: number;
  sidePoolElectionExistingCount: number;
  qPoolPaymentTotalMinor: number;
} {
  return record(value)
    && exact(value, ["status", "importedRows", "rosterCreatedCount", "rosterMatchedCount", "eventEnrollmentCount", "eventEnrollmentExistingCount", "paymentReceiptCount", "paymentExistingCount", "sidePoolElectionCount", "sidePoolElectionExistingCount", "qPoolPaymentTotalMinor"])
    && value.status === "tournament_day_csv_imported"
    && ["importedRows", "rosterCreatedCount", "rosterMatchedCount", "eventEnrollmentCount", "eventEnrollmentExistingCount", "paymentReceiptCount", "paymentExistingCount", "sidePoolElectionCount", "sidePoolElectionExistingCount", "qPoolPaymentTotalMinor"].every((key) => Number.isSafeInteger(value[key]) && (value[key] as number) >= 0);
}

export function isRejectedTournamentDayImport(value: unknown): value is { status: "rejected"; code: string } {
  return record(value) && value.status === "rejected" && typeof value.code === "string";
}
