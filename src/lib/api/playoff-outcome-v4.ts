import { isUuid } from './validation.ts';
import { deriveFiveQualifierPlayoff, type PlayedSeries } from '../results/five-qualifier-playoff.ts';

export type PlayoffV4Request = { qualificationResultVersionId: string; expectedVersion: number; sourceDigest: string; series: PlayedSeries[]; reason: string; reviewed: true };
export type PlayoffV4Outcome = NonNullable<ReturnType<typeof deriveFiveQualifierPlayoff>>[number];
export type PlayoffV4Qualifier = { participantId: string; displayName: string; qualificationRank: number; gamePoints: number; byeWins: number };
export type PlayoffV4Workspace = { tournamentId: string; eventId: string; qualificationResultVersionId: string | null; sourceDigest: string | null; bracketKind: 'five_qualifier_three_byes_v4'; currentVersion: number; canRecord: boolean; blocker: string | null; qualifiers: PlayoffV4Qualifier[]; result: null | { resultId: string; version: number; qualificationResultVersionId: string; sourceDigest: string; current: boolean; series: PlayedSeries[]; outcomes: PlayoffV4Outcome[]; request: PlayoffV4Request; bracketSourceVersion: 'acc-rulebook-2025-effective-2025-08-01'; mrpSourceVersion: 'acc-published-mrp-2016-08-01'; recordedAt: string }; automaticPayment: false };
export type PlayoffV4Result = { status: 'playoff_outcomes_recorded_v4'; tournamentId: string; eventId: string; resultId: string; version: number; sourceDigest: string; recordedAt: string } | { status: 'rejected'; eventId: string; code: string };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join() === [...keys].sort().join();
const whole = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length >= 1 && v.length <= max && v === v.trim() && !/[\u0000-\u001f\u007f]/.test(v);
const timestamp = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const sameId = (left: unknown, right: unknown) => isUuid(left) && isUuid(right) && left.toLowerCase() === right.toLowerCase();
const rejectionCodes = new Set(['invalid_request', 'not_director', 'source_blocked', 'tournament_unavailable', 'playoff_domain_conflict', 'settlement_finalized', 'qualification_unavailable', 'source_changed', 'stale_version', 'already_recorded', 'invalid_series', 'idempotency_conflict']);
function series(v: unknown): v is PlayedSeries[] { return Array.isArray(v) && v.length === 4 && v.every(s => object(s) && exact(s, ['winnerId', 'loserId', 'evidenceNote']) && isUuid(s.winnerId) && isUuid(s.loserId) && s.winnerId.toLowerCase() !== s.loserId.toLowerCase() && text(s.evidenceNote, 200)); }
export function isPlayoffV4Request(v: unknown): v is PlayoffV4Request { return object(v) && exact(v, ['qualificationResultVersionId', 'expectedVersion', 'sourceDigest', 'series', 'reason', 'reviewed']) && isUuid(v.qualificationResultVersionId) && whole(v.expectedVersion, 0, 255) && digest(v.sourceDigest) && series(v.series) && text(v.reason, 500) && v.reviewed === true; }
export function isPlayoffV4ReconciliationRequest(v: unknown): v is { operationId: string; request: PlayoffV4Request } { return object(v) && exact(v, ['operationId', 'request']) && isUuid(v.operationId) && isPlayoffV4Request(v.request); }
export function isPlayoffV4Result(v: unknown, tid: string, eid: string): v is PlayoffV4Result {
 if (!object(v) || !sameId(v.eventId, eid)) return false;
 if (v.status === 'rejected') return exact(v, ['status', 'eventId', 'code']) && typeof v.code === 'string' && rejectionCodes.has(v.code);
 return exact(v, ['status', 'tournamentId', 'eventId', 'resultId', 'version', 'sourceDigest', 'recordedAt']) && v.status === 'playoff_outcomes_recorded_v4' && sameId(v.tournamentId, tid) && isUuid(v.resultId) && whole(v.version, 1, 256) && digest(v.sourceDigest) && timestamp(v.recordedAt);
}
export function playoffV4ResultMatches(result: PlayoffV4Result, request: PlayoffV4Request) { return result.status === 'rejected' || result.version === request.expectedVersion + 1 && result.sourceDigest === request.sourceDigest; }
export function isPlayoffV4Reconciliation(v: unknown, tid: string, eid: string): v is { authorized: true; result: PlayoffV4Result | null } { return object(v) && exact(v, ['authorized', 'result']) && v.authorized === true && (v.result === null || isPlayoffV4Result(v.result, tid, eid)); }
export function isPlayoffV4Workspace(v: unknown, tid: string, eid: string): v is PlayoffV4Workspace {
 if (!object(v) || !exact(v, ['tournamentId', 'eventId', 'qualificationResultVersionId', 'sourceDigest', 'bracketKind', 'currentVersion', 'canRecord', 'blocker', 'qualifiers', 'result', 'automaticPayment']) || !sameId(v.tournamentId, tid) || !sameId(v.eventId, eid) || v.bracketKind !== 'five_qualifier_three_byes_v4' || v.automaticPayment !== false || !whole(v.currentVersion, 0, 256) || typeof v.canRecord !== 'boolean' || !(v.qualificationResultVersionId === null || isUuid(v.qualificationResultVersionId)) || !(v.sourceDigest === null || digest(v.sourceDigest)) || !(v.blocker === null || typeof v.blocker === 'string' && rejectionCodes.has(v.blocker)) || !Array.isArray(v.qualifiers)) return false;
 if (v.qualifiers.some(q => !object(q) || !exact(q, ['participantId', 'displayName', 'qualificationRank', 'gamePoints', 'byeWins']) || !isUuid(q.participantId) || !text(q.displayName, 200) || !whole(q.qualificationRank, 1, 256) || !whole(q.gamePoints, 0, 36) || !whole(q.byeWins, 0, 1))) return false;
 const qualifiers = v.qualifiers as PlayoffV4Qualifier[];
 const supported = qualifiers.length === 5 && new Set(qualifiers.map(q => q.participantId.toLowerCase())).size === 5 && qualifiers.every((q, i) => q.qualificationRank === i + 1 && q.byeWins === (i < 3 ? 1 : 0) && (i >= 3 || q.gamePoints >= 14));
 if (v.canRecord !== (v.blocker === null && supported && digest(v.sourceDigest) && isUuid(v.qualificationResultVersionId))) return false;
 if (!v.canRecord && v.blocker === null) return false;
 if (v.result === null) return v.currentVersion === 0;
 const r = v.result;
 if (!object(r) || !exact(r, ['resultId', 'version', 'qualificationResultVersionId', 'sourceDigest', 'current', 'series', 'outcomes', 'request', 'bracketSourceVersion', 'mrpSourceVersion', 'recordedAt']) || !isUuid(r.resultId) || r.version !== v.currentVersion || !isUuid(r.qualificationResultVersionId) || !digest(r.sourceDigest) || typeof r.current !== 'boolean' || !series(r.series) || !isPlayoffV4Request(r.request) || !sameId(r.request.qualificationResultVersionId, r.qualificationResultVersionId) || r.request.sourceDigest !== r.sourceDigest || r.request.expectedVersion + 1 !== r.version || r.request.series.some((s, i) => ["winnerId", "loserId", "evidenceNote"].some(k => s[k as keyof PlayedSeries] !== (r.series as PlayedSeries[])[i][k as keyof PlayedSeries])) || r.bracketSourceVersion !== 'acc-rulebook-2025-effective-2025-08-01' || r.mrpSourceVersion !== 'acc-published-mrp-2016-08-01' || !timestamp(r.recordedAt) || !Array.isArray(r.outcomes) || r.outcomes.length !== 5) return false;
 // Current snapshots are independently recalculated, including played wins,
 // distinct bye credits and cohort bands. Stale immutable evidence remains
 // readable, but cannot authorize a new result or accounting source.
 const rowKeys = ['participantId', 'playedMatchWins', 'byeWins', 'eliminatedInRound', 'champion', 'bandStart', 'bandEnd', 'qualifyingMrp', 'playoffMrp', 'totalMrp'];
 if (r.outcomes.some(row => !object(row) || !exact(row, rowKeys) || !isUuid(row.participantId) || !whole(row.playedMatchWins, 0, 3) || !whole(row.byeWins, 0, 1) || !(row.eliminatedInRound === null || whole(row.eliminatedInRound, 1, 3)) || typeof row.champion !== 'boolean' || !whole(row.bandStart, 1, 5) || !whole(row.bandEnd, row.bandStart as number, 5) || !whole(row.qualifyingMrp) || !whole(row.playoffMrp) || !whole(row.totalMrp) || row.totalMrp !== (row.qualifyingMrp as number) + (row.playoffMrp as number))) return false;
 if (r.current) {
  if (!supported || r.sourceDigest !== v.sourceDigest || !sameId(r.qualificationResultVersionId, v.qualificationResultVersionId)) return false;
  try { const derived = deriveFiveQualifierPlayoff(qualifiers.map(({ participantId, qualificationRank, gamePoints }) => ({ participantId, qualificationRank, gamePoints })), r.series); if (!derived || derived.some((row, i) => rowKeys.some(k => row[k as keyof PlayoffV4Outcome] !== (r.outcomes as Record<string, unknown>[])[i][k]))) return false; } catch { return false; }
 }
 return true;
}
