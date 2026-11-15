import 'server-only';
import {isNativeLedgerEnvelopeV1,type NativeLedgerEnvelopeV1} from './native-ledger-handlers-v1.ts';
import {projectEventLedgerV1,type EventLedgerSnapshotV1} from './event-ledger-projection-v1.ts';
import {isUuid} from '../api/validation.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[])=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const canonical=(v:unknown)=>JSON.stringify(v,(_key,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const uuid=(v:unknown):v is string=>isUuid(v)&&v===v.toLowerCase();
const rejectionCodes=new Set(['native_source_unavailable','source_changed','native_optional_pool_bridge_required','allocation_revision_changed','source_coverage_incomplete','invalid_allocation','foreign_or_void_source','invalid_native_amount','technical_resource_bound','invalid_allocation_part','foreign_event','duplicate_allocation','base_allocation_ineligible','expense_classification_required','nonconserving_allocation','negative_or_unsafe_event_fund']);
/** Shape/binding decoder for the private SQL receipt only. Its caller must obtain
 * this response from an authenticated trusted server transaction; accepting a
 * posted object here cannot prove persistence, currentness or receipt authority.
 * Historical receipts do not establish a currently available event fund.
 */
export function readNativeLedgerReceiptV1(value:unknown,envelope:unknown){
 const fail=()=>({status:'unverified' as const,ledgerWriteAllowed:false as const,moneyMoved:false as const});
 if(!isNativeLedgerEnvelopeV1(envelope)||!object(value)||value.actorId!==envelope.actorId||value.tournamentId!==envelope.tournamentId||value.operationId!==envelope.request.operationId||canonical(value.request)!==canonical(envelope.request)||value.moneyMoved!==false||value.payoutAuthorized!==false)return fail();
 const shared=['status','actorId','tournamentId','operationId','request','moneyMoved','payoutAuthorized'];
 const historical=Object.hasOwn(value,'fundAvailable');
 if(historical&&value.fundAvailable!==false)return fail();
 if(value.status==='rejected'){
  const replayKey=Object.hasOwn(value,'replayed');
  const keys=[...shared,'code',...(historical?['fundAvailable','historicalReceipt',...(replayKey?['replayed']:[])]:[])];
  if(!exact(value,keys)||typeof value.code!=='string'||!rejectionCodes.has(value.code)||(historical&&(value.historicalReceipt!==true||(replayKey&&value.replayed!==true))))return fail();
  return{status:'rejected_receipt' as const,code:value.code,envelope:structuredClone(envelope),historicalReceipt:historical,requiresTrustedServerTransport:true as const,ledgerWriteAllowed:false as const,moneyMoved:false as const};
 }
 const keys=[...shared,'replayed','historicalReceipt','revisionId','version','snapshot',...(historical?['fundAvailable']:[])];
 if(value.status!=='accepted'||!exact(value,keys)||!uuid(value.revisionId)||typeof value.version!=='number'||!Number.isSafeInteger(value.version)||value.version<1||typeof value.replayed!=='boolean'||typeof value.historicalReceipt!=='boolean'||(historical&&value.historicalReceipt!==true)||((value.replayed||value.historicalReceipt)&&!historical)||!object(value.snapshot))return fail();
 const snapshot=value.snapshot;
 if(snapshot.tournamentId!==envelope.tournamentId||snapshot.sourceDigest!==envelope.request.sourceDigest||snapshot.sourceVersion!==value.version||snapshot.mode!=='documented_actual'||!Array.isArray(snapshot.eventIds)||snapshot.eventIds.length<1||!Array.isArray(snapshot.sources)||snapshot.sources.length!==envelope.request.allocations.length)return fail();
 const requests=new Map<string,unknown>();
 for(const row of envelope.request.allocations){if(!exact(row,['sourceId','allocations'])||!object(row)||!uuid(row.sourceId)||requests.has(row.sourceId))return fail();requests.set(row.sourceId,row.allocations);}
 for(const source of snapshot.sources){
  if(!object(source)||!uuid(source.sourceId)||source.physicalEvidenceId!==source.sourceId||source.state!=='active'||(source.kind!=='entry_receipt'&&source.kind!=='expense')||!requests.has(source.sourceId)||canonical(source.allocations)!==canonical(requests.get(source.sourceId)))return fail();
  requests.delete(source.sourceId);
 }
 if(requests.size)return fail();
 const projections=snapshot.eventIds.map(eventId=>projectEventLedgerV1({eventId,current:snapshot,retained:snapshot}));
 if(projections.some(p=>p.status!=='projected'||p.reviewRequired||p.regularFundMinor<0||p.poolTotals.length!==0))return fail();
 // No approval or transfer follows from decoding an immutable storage receipt.
 return{status:'allocation_receipt' as const,revisionId:value.revisionId,version:value.version,snapshot:structuredClone(snapshot)as unknown as EventLedgerSnapshotV1,envelope:structuredClone(envelope)as NativeLedgerEnvelopeV1,historicalReceipt:value.historicalReceipt,requiresCurrentSourceRead:true as const,requiresTrustedServerTransport:true as const,ledgerWriteAllowed:false as const,payoutAuthorized:false as const,moneyMoved:false as const};
}
