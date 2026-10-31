import { isUuid } from "./validation.ts";
import { isDirectorPrizeSchedule, type DirectorPrizeSchedule } from "../results/prize-schedule.ts";

export type PrizeScheduleRequest = { expectedVersion: number; schedule: DirectorPrizeSchedule; reviewed: true; reason: string };
export type PrizeScheduleVersion = { scheduleId: string; version: number; schedule: DirectorPrizeSchedule; reason: string; recordedAt: string };
export type PrizeScheduleWorkspace = { tournamentId: string; clientRowId: string; currentVersion: number; activated: boolean; eventId: string | null; settingsCurrent: boolean; versions: PrizeScheduleVersion[] };
export type PrizeAwardSummary = { status?: "unpaid"; finalized?: boolean; eventId: string; scheduleVersion: number; awards: Array<{ displayName: string; bandStart: number; bandEnd: number; amountMinor: number }> };
export type PrizeScheduleResolution = { status: "unstructured" } | { status: "blocked"; code: string } | { status: "available"; scheduleVersionId: string; grossEntryIncomeMinor: number; expenseTotalMinor: number; prizeBudgetMinor: number; roundingRemainderMinor: number; awards: Array<{ participantId: string; bandStart: number; bandEnd: number; weight: number; totalAwardMinor: number }> };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join(",") === [...keys].sort().join(",");
const version = (v: unknown, min = 0): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= 2147483647;
const reference = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 500 && v === v.trim() && !/[\u0000-\u001f\u007f]/.test(v);
export function isPrizeScheduleRequest(v: unknown): v is PrizeScheduleRequest {
  return record(v) && exact(v, ["expectedVersion", "schedule", "reviewed", "reason"]) && version(v.expectedVersion)
    && isDirectorPrizeSchedule(v.schedule) && v.reviewed === true && reference(v.reason);
}
export function isPrizeScheduleWorkspace(v: unknown, tid: string, rowId: string): v is PrizeScheduleWorkspace {
  if (!record(v) || !exact(v, ["tournamentId", "clientRowId", "currentVersion", "activated", "eventId", "settingsCurrent", "versions"])
    || !isUuid(tid) || !isUuid(rowId) || v.tournamentId !== tid || v.clientRowId !== rowId || !version(v.currentVersion)
    || typeof v.activated !== "boolean" || typeof v.settingsCurrent !== "boolean" || (v.eventId !== null && !isUuid(v.eventId))
    || v.activated !== (v.eventId !== null) || !Array.isArray(v.versions) || v.versions.length > 256) return false;
  if (!v.versions.every((r) => record(r) && exact(r, ["scheduleId", "version", "schedule", "reason", "recordedAt"])
    && isUuid(r.scheduleId) && version(r.version, 1) && isDirectorPrizeSchedule(r.schedule) && reference(r.reason)
    && typeof r.recordedAt === "string" && Number.isFinite(Date.parse(r.recordedAt)))) return false;
  const rows = v.versions as PrizeScheduleVersion[];
  return rows.length === v.currentVersion && rows.every((r, i) => r.version === (v.currentVersion as number) - i)
    && new Set(rows.map(r => r.scheduleId.toLowerCase())).size === rows.length;
}
export function isPrizeScheduleSaved(v: unknown, tid: string, rowId: string): v is { status: "prize_schedule_saved_v1"; tournamentId: string; clientRowId: string; scheduleId: string; version: number } {
  return record(v) && exact(v, ["status", "tournamentId", "clientRowId", "scheduleId", "version"])
    && v.status === "prize_schedule_saved_v1" && v.tournamentId === tid && v.clientRowId === rowId && isUuid(v.scheduleId) && version(v.version, 1);
}
const rejections = new Set(["invalid_request", "not_director", "unsupported_prize_schedule_scope", "stale_version", "idempotency_conflict", "schedule_revision_closed", "schedule_revision_required", "source_unavailable", "tournament_unavailable"]);
export function isRejectedPrizeSchedule(v: unknown, rowId: string): v is { status: "rejected"; clientRowId: string; code: string } {
  return record(v) && exact(v, ["status", "clientRowId", "code"]) && v.status === "rejected" && v.clientRowId === rowId && typeof v.code === "string" && rejections.has(v.code);
}
export function isPrizeScheduleReconciliation(v: unknown, tid: string, rowId: string): v is { authorized: true; result: unknown } {
  return record(v) && exact(v, ["authorized", "result"]) && v.authorized === true
    && (v.result === null || isPrizeScheduleSaved(v.result, tid, rowId) || isRejectedPrizeSchedule(v.result, rowId));
}
type Rpc = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
export async function getPrizeScheduleWorkspace(admin: Rpc, actorId: string, tournamentId: string, clientRowId: string) {
  const { data, error } = await admin.rpc("get_setup_prize_schedule_v1", { p_actor_id: actorId, p_tournament_id: tournamentId, p_client_row_id: clientRowId });
  return error || !isPrizeScheduleWorkspace(data, tournamentId, clientRowId) ? null : data;
}
export async function listPrizeSchedules(admin: Rpc, actorId: string, tournamentId: string) {
  const { data, error } = await admin.rpc("list_tournament_prize_schedules_v1", { p_actor_id: actorId, p_tournament_id: tournamentId });
  return error || !Array.isArray(data) || data.length > 32 || !data.every(v => record(v) && isPrizeScheduleWorkspace(v, tournamentId, v.clientRowId as string)) ? null : data as PrizeScheduleWorkspace[];
}
const money = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
export function isPrizeScheduleResolution(v: unknown): v is PrizeScheduleResolution {
  if (!record(v)) return false;
  if (v.status === "unstructured") return exact(v, ["status"]);
  if (v.status === "blocked") return exact(v, ["status", "code"]) && reference(v.code);
  if (v.status !== "available" || !exact(v, ["status", "scheduleVersionId", "grossEntryIncomeMinor", "expenseTotalMinor", "prizeBudgetMinor", "roundingRemainderMinor", "awards"])
    || !isUuid(v.scheduleVersionId) || !money(v.grossEntryIncomeMinor) || !money(v.expenseTotalMinor) || !money(v.prizeBudgetMinor) || !money(v.roundingRemainderMinor)
    || !Array.isArray(v.awards) || ![4,5].includes(v.awards.length) || !v.awards.every(a => record(a) && exact(a, ["participantId", "bandStart", "bandEnd", "weight", "totalAwardMinor"])
      && isUuid(a.participantId) && version(a.bandStart, 1) && version(a.bandEnd, 1) && money(a.weight) && a.weight > 0 && money(a.totalAwardMinor) && a.totalAwardMinor > 0)) return false;
  const awards = v.awards as Extract<PrizeScheduleResolution, { status: "available" }>["awards"];
  const bands = awards.map(a => `${a.bandStart}:${a.bandEnd}`).sort().join(",");
  const denominator = awards.reduce((sum, a) => sum + BigInt(a.weight), BigInt(0));
  if (denominator > BigInt(Number.MAX_SAFE_INTEGER)) return false;
  const budget = BigInt(v.prizeBudgetMinor);
  const remainder = budget - awards.reduce((sum, a) => sum + budget * BigInt(a.weight) / denominator, BigInt(0));
  return bands === (awards.length === 5 ? "1:1,2:2,3:4,3:4,5:5" : "1:1,2:2,3:4,3:4") && new Set(awards.map(a => a.participantId.toLowerCase())).size === awards.length
    && awards.filter(a => a.bandStart === 3).every(a => a.totalAwardMinor === awards.find(b => b.bandStart === 3)?.totalAwardMinor && a.weight === awards.find(b => b.bandStart === 3)?.weight)
    && BigInt(v.roundingRemainderMinor) === remainder
    && awards.every(a => BigInt(a.totalAwardMinor) === budget * BigInt(a.weight) / denominator + (a.bandStart === 1 ? remainder : BigInt(0)))
    && BigInt(v.grossEntryIncomeMinor) === BigInt(v.expenseTotalMinor) + BigInt(v.prizeBudgetMinor)
    && awards.reduce((sum, a) => sum + BigInt(a.totalAwardMinor), BigInt(0)) === BigInt(v.prizeBudgetMinor);
}
export async function listPrizeAwardSummaries(admin: Rpc, actorId: string, tournamentId: string) {
  const { data, error } = await admin.rpc("list_prize_award_summaries_v1", { p_actor_id: actorId, p_tournament_id: tournamentId });
  if (error || !Array.isArray(data) || data.length > 32 || !data.every(v => record(v) && exact(v, ["eventId", "scheduleVersion", "awards", ...(v.status === "unpaid" ? ["status", "finalized"] : [])]) && (v.status === undefined || (v.status === "unpaid" && typeof v.finalized === "boolean")) && isUuid(v.eventId) && version(v.scheduleVersion, 1)
    && Array.isArray(v.awards) && [4,5].includes(v.awards.length) && v.awards.every(a => record(a) && exact(a, ["displayName", "bandStart", "bandEnd", "amountMinor"]) && reference(a.displayName) && version(a.bandStart, 1) && version(a.bandEnd, 1) && money(a.amountMinor) && a.amountMinor > 0))) return null;
  return data as PrizeAwardSummary[];
}
