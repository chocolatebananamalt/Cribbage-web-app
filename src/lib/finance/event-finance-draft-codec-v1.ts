import { isEventFinanceWorkspaceV1, type EventFinanceEditorV1, type EventFinanceWorkspaceV1, type FinanceNamedRecordV1 } from './event-finance-workspace-v1.ts';
import { calculateEventRegularFinanceV1 } from '../results/event-regular-finance-v1.ts';
import { calculateMainConFundComparisonV2 } from '../results/maincon-fund-comparison-v2.ts';
import { calculateMainConFundProposalsV2 } from '../results/maincon-fund-proposals-v2.ts';
export type EventFinanceDraftScopeV1 = { actorId: string; tournamentId: string; eventId: string };
export type EventFinanceLocalDraftV1 = EventFinanceDraftScopeV1 & { kind: 'event-finance-local-draft-v1'; draftId: string; revision: number; deviceSavedAt: string; editor: EventFinanceEditorV1 };
/** Technical serialized processing limit, not a business limit on custom rows. */
export const eventFinanceDraftMaximumBytesV1 = 4 * 1024 * 1024;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => obj(v) && Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && !Object.is(v, -0);
const canonical = (v: unknown): string => JSON.stringify(v, (_k, x) => obj(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const prefix = (a: unknown[], b: unknown[]) => a.length <= b.length && a.every((v, i) => same(v, b[i]));
const editable = ['player_benefit', 'operating_expense', 'unrestricted_income'];
/** Reject non-JSON values, accessors, sparse arrays and cycles before serialization. */
function jsonSafe(v: unknown, ancestors = new Set<object>()): boolean {
 if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
 if (typeof v === 'number') return Number.isSafeInteger(v) && !Object.is(v, -0);
 if ((!Array.isArray(v) && !obj(v)) || ancestors.has(v)) return false;
 ancestors.add(v);
 const keys = Reflect.ownKeys(v);
 if (Array.isArray(v) && (keys.length !== v.length + 1 || !Array.from({ length: v.length }, (_, i) => Object.hasOwn(v, i)).every(Boolean))) return false;
 for (const key of keys) {
  if (Array.isArray(v) && key === 'length') continue;
  const descriptor = Object.getOwnPropertyDescriptor(v, key);
  if (typeof key !== 'string' || !descriptor || !('value' in descriptor) || !descriptor.enumerable || !jsonSafe(descriptor.value, ancestors)) return false;
 }
 ancestors.delete(v); return true;
}
function names(v: unknown): v is FinanceNamedRecordV1[] {
 return Array.isArray(v) && v.length <= 10000 && v.every(r => exact(r, ['label', 'line']) && typeof r.label === 'string' && !!r.label.trim() && r.label === r.label.trim() && r.label.length <= 200 && !/[\u0000-\u001f\u007f]/.test(r.label));
}
function financial(w: EventFinanceWorkspaceV1, history: FinanceNamedRecordV1[]) {
 return calculateEventRegularFinanceV1({ source: w.source, mode: w.mode, grossEntry: { source: w.source, mode: w.mode, amountMinor: w.grossEntryMinor }, history: history.map(r => r.line) });
}
function historyValid(w: EventFinanceWorkspaceV1, history: unknown): history is FinanceNamedRecordV1[] {
 if (!names(history) || !prefix(w.history, history)) return false;
 // The reviewed editor can append regular-event proposals only. Separate pool
 // and restricted source rows remain immutable, read-only basis evidence.
 if (history.slice(w.history.length).some(r => !obj(r.line) || !editable.includes(r.line.category) || typeof r.line.reason !== 'string' || !r.line.reason.trim() || r.line.reason !== r.line.reason.trim() || r.line.reason.length > 2000 || /[\u0000-\u001f\u007f]/.test(r.line.reason))) return false;
 const f = financial(w, history);
 return f.status === 'calculated' || f.code === 'negative_regular_fund' || f.code === 'income_requires_review';
}
/** Restore only the retained source. Current-server equality belongs to the host;
 * this validator neither rebases stale work nor grants ledger/payment authority. */
export function isRestorableEventFinanceEditorV1(value: unknown): value is EventFinanceEditorV1 {
 try {
  if (!jsonSafe(value) || new TextEncoder().encode(canonical(value)).byteLength > eventFinanceDraftMaximumBytesV1 || !exact(value, ['basis', 'history', 'overrideHistory', 'overrideInput', 'overridePlan', 'lineForm', 'bandForm', 'message']) || !isEventFinanceWorkspaceV1(value.basis) || !historyValid(value.basis, value.history) || !Array.isArray(value.overrideHistory) || value.overrideHistory.length > 10000 || !prefix(value.basis.overrideHistory, value.overrideHistory) || typeof value.message !== 'string') return false;
  const w = value.basis;
  // Committed local adjustments must be reachable through the reviewed reducer.
  // Historical source records are preserved verbatim; incomplete form text is not constrained here.
  if (value.overrideHistory.slice(w.overrideHistory.length).some(r => !obj(r) || typeof r.reason !== 'string' || !r.reason.trim() || r.reason !== r.reason.trim() || r.reason.length > 2000 || /[\u0000-\u001f\u007f]/.test(r.reason))) return false;
  if (value.overrideHistory.length === 0) {
   if (value.overrideInput !== null || value.overridePlan !== null) return false;
  } else {
   if (typeof value.overridePlan !== 'string') return false;
   const plan: unknown = JSON.parse(value.overridePlan);
   if (!exact(plan, ['basis', 'history']) || !same(plan.basis, w) || !historyValid(w, plan.history) || !prefix(plan.history, value.history)) return false;
   const fund = financial(w, plan.history);
   if (fund.status !== 'calculated' || w.qualifierCount === null || w.qualifierCount === 0) return false;
   const input = { fundMinor: fund.regularFundMinor, qualifierCount: w.qualifierCount, settings: w.settings };
   if (!same(value.overrideInput, input)) return false;
   const current = { source: w.payoutSource, input };
   if (calculateMainConFundProposalsV2({ ...current, overrideHistory: value.overrideHistory }, current).status !== 'proposal_review') return false;
  }
  if (value.lineForm !== null) {
   const f = value.lineForm;
   if (!exact(f, ['category', 'lineId', 'label', 'amount', 'reason']) || !editable.includes(f.category as string) || !(f.lineId === null || uuid(f.lineId)) || ![f.label, f.amount, f.reason].every(v => typeof v === 'string')) return false;
   if (f.lineId !== null) {
    const prior = [...value.history].reverse().find(r => r.line.lineId === f.lineId);
    if (!prior || prior.line.voided || prior.line.category !== f.category || !editable.includes(prior.line.category)) return false;
   }
  }
  if (value.bandForm !== null) {
   const f = value.bandForm;
   if (!exact(f, ['firstPlace', 'lastPlace', 'amount', 'reason']) || !whole(f.firstPlace) || !whole(f.lastPlace) || typeof f.amount !== 'string' || typeof f.reason !== 'string' || w.qualifierCount === null || w.qualifierCount === 0) return false;
   const calculation = calculateMainConFundComparisonV2({ fundMinor: 0, qualifierCount: w.qualifierCount, settings: w.settings });
   if (calculation.status !== 'calculated_comparison' || !calculation.bands.some(b => b.firstPlace === f.firstPlace && b.lastPlace === f.lastPlace)) return false;
  }
  return true;
 } catch { return false; }
}
function recordValid(v: unknown): v is EventFinanceLocalDraftV1 {
 if (!exact(v, ['kind', 'actorId', 'tournamentId', 'eventId', 'draftId', 'revision', 'deviceSavedAt', 'editor']) || v.kind !== 'event-finance-local-draft-v1' || ![v.actorId, v.tournamentId, v.eventId, v.draftId].every(uuid) || !whole(v.revision) || v.revision < 1 || typeof v.deviceSavedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.deviceSavedAt) || !Number.isFinite(Date.parse(v.deviceSavedAt)) || new Date(v.deviceSavedAt).toISOString() !== v.deviceSavedAt || !isRestorableEventFinanceEditorV1(v.editor)) return false;
 return v.editor.basis.source.tournamentId === v.tournamentId && v.editor.basis.source.eventId === v.eventId && v.editor.basis.payoutSource.tournamentId === v.tournamentId && v.editor.basis.payoutSource.eventId === v.eventId;
}
export function encodeEventFinanceDraftV1(record: unknown): string | null {
 try { if (!jsonSafe(record) || !recordValid(record)) return null; const raw = canonical(record); return new TextEncoder().encode(raw).byteLength <= eventFinanceDraftMaximumBytesV1 ? raw : null; } catch { return null; }
}
export function parseEventFinanceDraftV1(raw: string, scope: EventFinanceDraftScopeV1): EventFinanceLocalDraftV1 | null {
 try {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > eventFinanceDraftMaximumBytesV1 || !exact(scope, ['actorId', 'tournamentId', 'eventId']) || ![scope.actorId, scope.tournamentId, scope.eventId].every(uuid)) return null;
  const record: unknown = JSON.parse(raw);
  return recordValid(record) && record.actorId === scope.actorId && record.tournamentId === scope.tournamentId && record.eventId === scope.eventId ? record : null;
 } catch { return null; }
}
