import {isSettlementDraftRequest} from './settlement-draft.ts';
import {isManualSettlementFinalizationRequest} from './settlement-finalization.ts';

/** Original envelopes were flat request objects plus kind, never {request:...}. */
export function parseLegacySettlementRecovery(raw:string,kind:'settlement-draft'|'manual-settlement-finalization') {
  try {
    const value:unknown=JSON.parse(raw);
    if (!value || typeof value!=='object' || Array.isArray(value)) return null;
    const {kind:storedKind,...request}=value as Record<string,unknown>;
    if (storedKind!==kind) return null;
    if (kind==='settlement-draft' ? isSettlementDraftRequest(request) : isManualSettlementFinalizationRequest(request)) {
      return {idempotencyKey:request.idempotencyKey as string};
    }
    return null;
  } catch {return null;}
}
