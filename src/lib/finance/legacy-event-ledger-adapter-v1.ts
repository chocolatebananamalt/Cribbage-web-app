import { isPaymentWorkspace } from '../api/payment.ts';
import { isExpenseWorkspace } from '../api/expense.ts';
import { isUuid } from '../api/validation.ts';
import { projectEventLedgerV1, type EventLedgerAllocationV1, type EventLedgerSnapshotV1, type EventLedgerSourceV1 } from './event-ledger-projection-v1.ts';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => object(v) && Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
export type LegacyEventLedgerReadV1 = {
  tournamentId: string; sourceDigest: string; sourceVersion: number; eventIds: string[]; pools: EventLedgerSnapshotV1['pools'];
  payments: unknown; expenses: unknown;
  allocationBindings: Array<{ sourceKind: 'roster_receipt' | 'expense'; sourceEventId: string; allocations: EventLedgerAllocationV1[] }>;
};
/** Uses existing receipt/expense history as evidence, never advertised fees.
 * Server must scope PaymentWorkspace to this tournament and validate allocation
 * ownership/membership under the same source lock. Those APIs alone do not
 * supply event allocation or a globally current source digest. No live RPC is
 * invoked here and no simulated ledger is combined with these real records. */
function normalize(v: unknown): EventLedgerSnapshotV1 | null {
  if (!exact(v, ['tournamentId', 'sourceDigest', 'sourceVersion', 'eventIds', 'pools', 'payments', 'expenses', 'allocationBindings'])
    || !uuid(v.tournamentId) || !isPaymentWorkspace(v.payments) || !isExpenseWorkspace(v.expenses, v.tournamentId) || !Array.isArray(v.allocationBindings) || v.allocationBindings.length > 10000) return null;
  const bindings = new Map<string, unknown>();
  for (const b of v.allocationBindings) {
    if (!exact(b, ['sourceKind', 'sourceEventId', 'allocations']) || (b.sourceKind !== 'roster_receipt' && b.sourceKind !== 'expense') || !uuid(b.sourceEventId) || !Array.isArray(b.allocations)) return null;
    const key = `${b.sourceKind}:${b.sourceEventId}`; if (bindings.has(key)) return null; bindings.set(key, b.allocations);
  }
  const sources: EventLedgerSourceV1[] = [], roster = new Set<string>(), evidence = new Set<string>(), historyEvidence = new Set<string>();
  for (const p of v.payments.rosterEntries) {
    if (!uuid(p.rosterEntryId) || roster.has(p.rosterEntryId)) return null; roster.add(p.rosterEntryId);
    for (const record of p.history) { if (!uuid(record.paymentEventId) || historyEvidence.has(record.paymentEventId)) return null; historyEvidence.add(record.paymentEventId); }
    if (p.paymentState !== 'received') continue;
    const receipt = p.history[0]; if (!receipt || !uuid(receipt.paymentEventId) || receipt.paymentEventId !== p.currentReceiptEventId || evidence.has(receipt.paymentEventId)) return null;
    evidence.add(receipt.paymentEventId); const key = `roster_receipt:${receipt.paymentEventId}`, allocation = bindings.get(key); if (!allocation) return null; bindings.delete(key);
    sources.push({ sourceId: receipt.paymentEventId, physicalEvidenceId: receipt.paymentEventId, kind: 'entry_receipt', amountMinor: receipt.amountMinor, state: 'active', allocations: allocation as EventLedgerAllocationV1[] });
  }
  const expenses = new Set<string>();
  for (const e of v.expenses.expenses) {
    if (!uuid(e.expenseId) || expenses.has(e.expenseId)) return null; expenses.add(e.expenseId);
    for (const record of e.history) { if (!uuid(record.expenseEventId) || historyEvidence.has(record.expenseEventId)) return null; historyEvidence.add(record.expenseEventId); }
    if (e.expenseState !== 'recorded') continue;
    if (!uuid(e.currentExpenseEventId) || evidence.has(e.currentExpenseEventId)) return null;
    evidence.add(e.currentExpenseEventId); const key = `expense:${e.currentExpenseEventId}`, allocation = bindings.get(key); if (!allocation) return null; bindings.delete(key);
    sources.push({ sourceId: e.currentExpenseEventId, physicalEvidenceId: e.currentExpenseEventId, kind: 'expense', amountMinor: e.amountMinor, state: 'active', allocations: allocation as EventLedgerAllocationV1[] });
  }
  // Bindings to voided/foreign/missing evidence are never silently discarded.
  if (bindings.size) return null;
  return { kind: 'event-ledger-snapshot-v1', tournamentId: v.tournamentId, sourceDigest: v.sourceDigest as string, sourceVersion: v.sourceVersion as number,
    complete: true, mode: 'documented_actual', eventIds: v.eventIds as string[], pools: v.pools as EventLedgerSnapshotV1['pools'], sources };
}
export function projectLegacyEventLedgerV1(input: unknown) {
  if (!exact(input, ['eventId', 'current', 'retained'])) return { status: 'blocked' as const, code: 'invalid_input' };
  const current = normalize(input.current), retained = normalize(input.retained);
  if (!current || !retained) return { status: 'blocked' as const, code: 'ledger_evidence_or_allocation_unavailable' };
  return projectEventLedgerV1({ eventId: input.eventId, current, retained });
}
