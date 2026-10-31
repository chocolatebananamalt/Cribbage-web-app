import { isRetainedSetupSaveRequest, type SetupCurrent, type SetupSaveRequest } from './api/setup.ts';

/** Compare authoritative saved terms, not a success toast or aggregate dollar total. */
export function setupFinancialTermsMatch(request: SetupSaveRequest, receipt: {revisionId:string;version:number}, current: SetupCurrent | null): boolean {
 if (!isRetainedSetupSaveRequest(request) || !current || current.revisionId !== receipt.revisionId || current.version !== receipt.version || receipt.version !== request.expectedVersion + 1) return false;
 const terms = (events: SetupSaveRequest['payload']['events']) => [...events].sort((a,b)=>a.clientRowId.localeCompare(b.clientRowId)).map(e=>({
  row:e.clientRowId,name:e.displayName.trim(),kind:e.eventKind,style:e.styleCode,format:e.formatCode,games:e.gameCount,fee:e.entryFeeCents,free:e.freeEntry === true,
  q:e.qPools.map((p,index)=>({slot:'slot' in p?p.slot:index+1,name:p.poolTypeCode.trim(),fee:p.entryFeeCents})),
  side:e.sidePools.map((p,index)=>({slot:'slot' in p?p.slot:index+1,name:p.poolTypeCode.trim(),fee:p.entryFeeCents})),
 }));
 return JSON.stringify(terms(request.payload.events)) === JSON.stringify(terms(current.events));
}
