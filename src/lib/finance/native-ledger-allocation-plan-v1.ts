import {readConsyAddonBindingsV1,consyAddonSourceKindV1} from './consy-addon-source-contract-v1.ts';
import { isUuid } from '../api/validation.ts';
import { projectEventLedgerV1, type EventLedgerAllocationV1, type EventLedgerSnapshotV1, type EventLedgerSourceV1 } from './event-ledger-projection-v1.ts';
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => obj(v) && Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
const money = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && !Object.is(v, -0);
const array = (v: unknown): v is unknown[] => Array.isArray(v) && Reflect.ownKeys(v).length === v.length + 1;
/** Plan only; current must come from the private locked SQL source reader.
 * No posted amount, review flag or source digest establishes receipt authority.
 * Optional pool membership/allocation is deliberately blocked until its native
 * ownership bridge is implemented. No ledger record or transfer occurs. */
export function planNativeLedgerAllocationsV1(input: unknown) {
  const fail = (code: string) => ({ status: 'blocked' as const, code, ledgerWriteAllowed: false as const });
  if (!exact(input, ['current', 'request']) || !exact(input.current, ['status', 'kind', 'actorId', 'tournamentId', 'sourceDigest', 'facts', 'snapshotConsistency', 'allocationCapability', 'additionalIncomeSourceAvailable', 'bankReceiptVerified', 'moneyMoved'])
    || input.current.status !== 'sources_available' || !['native-event-ledger-sources-v1',consyAddonSourceKindV1].includes(input.current.kind as string) || !uuid(input.current.actorId) || !uuid(input.current.tournamentId)
    || typeof input.current.sourceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(input.current.sourceDigest)
    || !['statement_snapshot','locked_source_snapshot'].includes(input.current.snapshotConsistency as string) || input.current.allocationCapability !== false || input.current.additionalIncomeSourceAvailable !== false || input.current.bankReceiptVerified !== false || input.current.moneyMoved !== false) return fail('invalid_source');
  const {current, request} = input;
  if (!exact(request, ['sourceDigest', 'operationId', 'allocations', 'reason', 'reviewed']) || request.sourceDigest !== current.sourceDigest || !uuid(request.operationId)
    || request.reviewed !== true || typeof request.reason !== 'string' || request.reason !== request.reason.trim() || request.reason.length < 1 || request.reason.length > 500 || /[\u0000-\u001f\u007f]/.test(request.reason)
    || !array(request.allocations) || request.allocations.length > 10000) return fail('invalid_or_stale_request');
  const facts = current.facts;
  const addonBindings=readConsyAddonBindingsV1(current);if(!addonBindings)return fail('invalid_addon_source');
  const addons=new Map(addonBindings.map(b=>[b.sourceId,b]));
  if (!exact(facts, ['eventIds', 'pools', 'activationBindings', 'receiptEvents', 'expenseEvents', 'historyIds', 'existingOptionalAllocationEvidence',...(current.kind===consyAddonSourceKindV1?['addonBindings']:[])])
    || !array(facts.eventIds) || facts.eventIds.length < 1 || facts.eventIds.length > 32 || !facts.eventIds.every(uuid) || new Set(facts.eventIds).size !== facts.eventIds.length
    || !array(facts.pools) || !array(facts.activationBindings) || !array(facts.receiptEvents) || !array(facts.expenseEvents) || !array(facts.historyIds) || typeof facts.existingOptionalAllocationEvidence !== 'boolean') return fail('invalid_source');
  if (facts.existingOptionalAllocationEvidence) return fail('native_optional_pool_bridge_required');
  const eventIds = facts.eventIds as string[];
  if (facts.receiptEvents.length + facts.expenseEvents.length > 10000 || facts.historyIds.length > 20000) return fail('technical_resource_bound');
  const fees = new Map<string, number>();
  for (const b of facts.activationBindings) {
    if (!exact(b, ['eventId', 'activationId', 'setupRevisionId', 'setupEventVersionId', 'entryFeeMinor']) || !uuid(b.eventId) || ![b.activationId, b.setupRevisionId, b.setupEventVersionId].every(uuid)
      || !eventIds.includes(b.eventId) || fees.has(b.eventId) || !money(b.entryFeeMinor)) return fail('invalid_activation_binding');
    fees.set(b.eventId as string, b.entryFeeMinor);
  }
  if (fees.size !== facts.eventIds.length) return fail('invalid_activation_binding');
  const history = new Map<string, {kind: string; ownerId: string; version: number; state: string}>(), versions = new Set<string>();
  const heads = new Map<string, {sourceId:string; kind:string; ownerId:string; version:number; state:string}>();
  for (const h of facts.historyIds) {
    if (!exact(h, ['kind', 'sourceId', 'ownerId', 'version', 'state']) || !uuid(h.sourceId) || !uuid(h.ownerId) || history.has(h.sourceId)
      || typeof h.version !== 'number' || !Number.isSafeInteger(h.version) || h.version < 1
      || (h.kind !== 'roster_receipt' && h.kind !== 'expense' && !(current.kind===consyAddonSourceKindV1&&h.kind==='consolation_addon_receipt')) || !((h.kind === 'roster_receipt' ? ['received','voided'] : h.kind==='consolation_addon_receipt'?['received']:['recorded','voided']).includes(h.state as string))) return fail('invalid_history_identity');
    const key = `${h.kind}:${h.ownerId}`, versionKey = `${key}:${h.version}`;
    if (versions.has(versionKey)) return fail('invalid_history_identity'); versions.add(versionKey);
    history.set(h.sourceId, {kind: h.kind, ownerId: h.ownerId, version: h.version, state: h.state as string});
    if (!heads.has(key) || heads.get(key)!.version < h.version) heads.set(key, {sourceId:h.sourceId,kind:h.kind,ownerId:h.ownerId,version:h.version,state:h.state as string});
  }
  const allocation = new Map<string, unknown[]>();
  for (const row of request.allocations) {
    if (!exact(row, ['sourceId', 'allocations']) || !uuid(row.sourceId) || allocation.has(row.sourceId) || !array(row.allocations)) return fail('invalid_allocation');
    allocation.set(row.sourceId, row.allocations);
  }
  const sources: EventLedgerSourceV1[] = [];
  for (const [kind, rows] of [['entry_receipt', facts.receiptEvents], ['expense', facts.expenseEvents]] as const) for (const row of rows) {
    const receipt = kind === 'entry_receipt';
    if (!exact(row, receipt ? ['sourceId','physicalEvidenceId','rosterEntryId','amountMinor','currency','eligibleEventIds'] : ['sourceId','physicalEvidenceId','expenseId','amountMinor','currency'])
      || !uuid(row.sourceId) || row.physicalEvidenceId !== row.sourceId || !money(row.amountMinor) || row.amountMinor === 0 || row.currency !== 'USD'
      || !uuid(receipt ? row.rosterEntryId : row.expenseId)) return fail('invalid_native_evidence');
    const addon=addons.get(row.sourceId);
    const h = history.get(row.sourceId), owner = addon?addon.chargeId:receipt ? row.rosterEntryId : row.expenseId;
    if (!h || h.kind !== (addon?'consolation_addon_receipt':receipt ? 'roster_receipt' : 'expense') || h.ownerId !== owner || h.state !== (receipt ? 'received' : 'recorded')
      || heads.get(`${h.kind}:${owner}`)?.sourceId !== row.sourceId) return fail('stale_native_head');
    heads.delete(`${h.kind}:${owner}`);
    const parts = allocation.get(row.sourceId); if (!parts) return fail('source_allocation_missing'); allocation.delete(row.sourceId);
    if (receipt && (!array(row.eligibleEventIds) || !row.eligibleEventIds.every(id => uuid(id) && eventIds.includes(id)) || new Set(row.eligibleEventIds).size !== row.eligibleEventIds.length)) return fail('participant_identity_ambiguous');
    for (const part of parts) {
      if (!obj(part)) return fail('invalid_allocation');
      if (part.bucket === 'q' || part.bucket === 'side') return fail('native_optional_pool_bridge_required');
      if (receipt && (part.bucket !== 'regular_entry' || !(row.eligibleEventIds as string[]).includes(part.eventId as string) || !money(part.amountMinor) || part.amountMinor > (fees.get(part.eventId as string) ?? -1))) return fail('base_allocation_ineligible');
    }
    sources.push({sourceId: row.sourceId, physicalEvidenceId: row.sourceId, kind, amountMinor: row.amountMinor, state:'active', allocations: parts as EventLedgerAllocationV1[]});
  }
  if (allocation.size) return fail('foreign_or_void_source');
  if ([...heads.values()].some(h => h.state !== 'voided')) return fail('native_head_coverage_incomplete');
  // Version zero is only an unpersisted normalization aid, never a fabricated
  // durable ledger version. It is removed from projected output below.
  const snapshot: EventLedgerSnapshotV1 = {kind:'event-ledger-snapshot-v1',tournamentId:current.tournamentId as string,sourceDigest:current.sourceDigest as string,sourceVersion:0,complete:true,mode:'documented_actual',eventIds:facts.eventIds as string[],pools:facts.pools as EventLedgerSnapshotV1['pools'],sources};
  const projections = facts.eventIds.map(eventId => projectEventLedgerV1({eventId,current:snapshot,retained:snapshot}));
  if (projections.some(p => p.status === 'blocked')) return fail('nonconserving_or_invalid_allocation');
  const unpersisted = projections.map(p => { if (p.status !== 'projected') return p; const {sourceVersion,...rest}=p; void sourceVersion; return {...rest,persistedAllocationVersion:null}; });
  return {status:'planned' as const,sourceDigest:current.sourceDigest,operationId:request.operationId,projections:unpersisted,
    ledgerWriteAllowed:false as const,allocationWriterRequired:true as const,commitReservationRequired:true as const,bankReceiptVerified:false as const,moneyMoved:false as const};
}
