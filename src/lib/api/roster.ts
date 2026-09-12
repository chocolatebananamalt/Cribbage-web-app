export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const exactKeys = (item: Record<string, unknown>, keys: string[]) => Object.keys(item).length === keys.length && keys.every((key) => key in item);
export function isAcceptedRosterPromotion(value: unknown, decisionId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exactKeys(item, ["status", "rosterEntryId", "sourceClaimId", "approvalDecisionId", "profileLinked", "roleGranted", "eventEnrolled", "paymentRecorded", "checkedIn", "seatAssigned"])
    && item.status === "roster_entry_created" && isUuid(item.rosterEntryId) && isUuid(item.sourceClaimId) && item.approvalDecisionId === decisionId && item.profileLinked === false && item.roleGranted === false && item.eventEnrolled === false && item.paymentRecorded === false && item.checkedIn === false && item.seatAssigned === false;
}
export function isRejectedRosterPromotion(value: unknown, decisionId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exactKeys(item, ["status", "code", "approvalDecisionId"])
    && item.status === "rejected" && item.approvalDecisionId === decisionId && ["authentication_required", "not_director", "approved_decision_required", "claim_already_promoted", "idempotency_conflict", "roster_promotion_rejected"].includes(item.code as string);
}

export type ManualRosterEntryRequest = {
  displayName: string;
  email: string;
  accNumber: string;
  idempotencyKey: string;
};

export function isManualRosterEntryRequest(value: unknown): value is ManualRosterEntryRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!exactKeys(item, ["displayName", "email", "accNumber", "idempotencyKey"])) return false;
  if (!isUuid(item.idempotencyKey) || typeof item.displayName !== "string" || typeof item.email !== "string" || typeof item.accNumber !== "string") return false;
  const name = item.displayName.trim();
  const email = item.email.trim();
  const accNumber = item.accNumber.trim();
  return name.length >= 1 && name.length <= 160
    && email.length <= 320
    && (email.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    && accNumber.length <= 64;
}

export function isAcceptedManualRosterEntry(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exactKeys(item, ["status", "rosterEntryId", "source", "profileLinked", "roleGranted", "eventEnrolled", "paymentRecorded", "checkedIn", "seatAssigned"])
    && item.status === "manual_roster_entry_created"
    && isUuid(item.rosterEntryId)
    && item.source === "director_manual"
    && item.profileLinked === false
    && item.roleGranted === false
    && item.eventEnrolled === false
    && item.paymentRecorded === false
    && item.checkedIn === false
    && item.seatAssigned === false;
}

export function isRejectedManualRosterEntry(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exactKeys(item, ["status", "code"])
    && item.status === "rejected"
    && ["authentication_required", "not_director", "invalid_manual_entry", "duplicate_roster_entry", "initial_seating_already_published", "idempotency_conflict", "manual_roster_entry_rejected"].includes(item.code as string);
}

export type RosterCsvRow = { displayName: string; email: string; accNumber: string };
export type RosterCsvImportRequest = { rows: RosterCsvRow[]; idempotencyKey: string };

export function isRosterCsvImportRequest(value: unknown): value is RosterCsvImportRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!exactKeys(item, ["rows", "idempotencyKey"]) || !isUuid(item.idempotencyKey)
    || !Array.isArray(item.rows) || item.rows.length < 1 || item.rows.length > 500) return false;
  return item.rows.every((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;
    const entry = row as Record<string, unknown>;
    return exactKeys(entry, ["displayName", "email", "accNumber"])
      && typeof entry.displayName === "string" && entry.displayName.trim().length >= 1 && entry.displayName.trim().length <= 160
      && typeof entry.email === "string" && entry.email.trim().length <= 320
      && (entry.email.trim().length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email.trim()))
      && typeof entry.accNumber === "string" && entry.accNumber.trim().length <= 64;
  });
}

export function isAcceptedRosterCsvImport(value: unknown): value is { status: "roster_csv_imported"; importedCount: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exactKeys(item, ["status", "importedCount"])
    && item.status === "roster_csv_imported"
    && Number.isInteger(item.importedCount)
    && (item.importedCount as number) >= 1
    && (item.importedCount as number) <= 500;
}

export function isRejectedRosterCsvImport(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exactKeys(item, ["status", "code"])
    && item.status === "rejected"
    && ["authentication_required", "not_director", "invalid_roster_batch", "duplicate_in_batch", "duplicate_roster_entry", "registration_closed", "initial_seating_already_published", "idempotency_conflict", "roster_csv_import_rejected"].includes(item.code as string);
}
