import 'server-only';
import {evaluateCommonEntryFeeEvidenceV1,type EntryFeeEvidenceV1} from './common-entry-fee-evidence-v1.ts';
import {readCurrentNativeFundOnlyV2} from './native-final-award-reconciliation-v1.ts';
type Scope={actorId:string;tournamentId:string;eventId:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&'value'in d&&d.enumerable;});
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const version=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
const array=(v:unknown):v is unknown[]=>Array.isArray(v)&&v.length<=10000&&Object.keys(v).length===v.length;
const canonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
/** Validates a private authenticated collector response. No object supplied to
 * this pure decoder can establish live DB freshness or grant award authority. */
export function readCurrentCommonEntryFeeSourceV1(value:unknown,scope:Scope){
 const hold=(code:string)=>({status:'review_required' as const,code,entryFeeMinor:null,awardAuthorized:false as const,currentSourceVerified:false as const});
 try{
  if(!exact(value,['kind','status','actorId','tournamentId','eventId','fundSource','allocationRevisionId','allocationVersion','allocationSourceDigest','qualificationParticipantIds','evidence','heads','snapshotConsistency','bankReceiptVerified','awardAuthorized','moneyMoved','sourceDigest'])||value.kind!=='current-common-entry-fee-source-v1'||value.status!=='source_available'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||value.snapshotConsistency!=='locked_source_snapshot'||value.bankReceiptVerified!==false||value.awardAuthorized!==false||value.moneyMoved!==false||!hash(value.sourceDigest)||!hash(value.allocationSourceDigest)||!id(value.allocationRevisionId)||!version(value.allocationVersion))return hold('invalid_fee_source');
  const fund=readCurrentNativeFundOnlyV2(value.fundSource,scope);if(fund.status!=='reviewed_native_fund')return hold('current_reviewed_fund_required');
  const f=value.fundSource as {capture:{recipientSource:{proposal:{qualificationResultVersionId:string};nativeFinanceSource:{raw:{binding:{setupEventVersionId:string};qualification:{resultVersionId:string;participantCount:number};allocation:{revisionId:string;version:number;sourceDigest:string;eventSources:Array<{sourceId:string;physicalEvidenceId:string;kind:string;state:string;amountMinor:number;allocations:EntryFeeEvidenceV1['allocations'][number]['allocations']}>}}};playoff:{players:Array<{participantId:string}>}}}};
  const n=f.capture.recipientSource,raw=n.nativeFinanceSource.raw,e=value.evidence;
  if(!exact(e,['eventId','qualificationResultVersionId','setupEventVersionId','advertisedFeeMinor','entrants','receipts','obligations','allocations'])||!array(e.entrants)||!array(e.receipts)||!array(e.obligations)||!array(e.allocations)||!array(value.qualificationParticipantIds)||!value.qualificationParticipantIds.every(id)||!array(value.heads))return hold('incomplete_fee_source');
  const count=raw.qualification.participantCount,ids=value.qualificationParticipantIds as string[];
  if(ids.length!==count||new Set(ids).size!==count||[e.entrants,e.receipts,e.obligations,e.allocations,value.heads].some(a=>a.length!==count)||!n.playoff.players.every(p=>ids.includes(p.participantId))||n.proposal.qualificationResultVersionId!==raw.qualification.resultVersionId||value.allocationRevisionId!==raw.allocation.revisionId||value.allocationVersion!==raw.allocation.version||value.allocationSourceDigest!==raw.allocation.sourceDigest)return hold('fee_source_binding_changed');
  for(const p of e.entrants)if(!exact(p,['participantId','rosterEntryId']))return hold('invalid_entrant');
  for(const r of e.receipts)if(!exact(r,['sourceId','physicalEvidenceId','rosterEntryId','amountMinor','currency','eligibleEventIds'])||!same(r.eligibleEventIds,[scope.eventId]))return hold('invalid_receipt');
  for(const o of e.obligations)if(!exact(o,['rosterEntryId','sourceId','amountOwedMinor']))return hold('invalid_obligation');
  for(const a of e.allocations){if(!exact(a,['sourceId','physicalEvidenceId','amountMinor','allocations'])||!array(a.allocations))return hold('invalid_allocation');for(const l of a.allocations)if(!exact(l,['eventId','bucket','poolId','amountMinor','classificationReviewed']))return hold('invalid_allocation');}
  const evidence=e as EntryFeeEvidenceV1,result=evaluateCommonEntryFeeEvidenceV1(evidence,{eventId:scope.eventId,qualificationResultVersionId:raw.qualification.resultVersionId,setupEventVersionId:raw.binding.setupEventVersionId,participantIds:ids});
  if(result.status!=='common_fee_evidence')return hold(result.code);
  const sourceRows=raw.allocation.eventSources.filter(s=>s.kind==='entry_receipt');
  if(sourceRows.length!==count)return hold('fee_fund_coverage_changed');
  for(const a of evidence.allocations){const found=sourceRows.filter(s=>s.sourceId===a.sourceId);if(found.length!==1||found[0].state!=='active'||!same(a,{sourceId:found[0].sourceId,physicalEvidenceId:found[0].physicalEvidenceId,amountMinor:found[0].amountMinor,allocations:found[0].allocations}))return hold('fee_allocation_changed');}
  const seen=new Set<string>();for(const h of value.heads){if(!exact(h,['participantId','receiptId','receiptVersion','obligationId','obligationVersion'])||!id(h.participantId)||seen.has(h.participantId)||!version(h.receiptVersion)||!version(h.obligationVersion))return hold('invalid_fee_heads');const b=result.bindings.find(b=>b.participantId===h.participantId);if(!b||h.receiptId!==b.receiptId||h.obligationId!==b.obligationId)return hold('fee_heads_changed');seen.add(h.participantId);}
  return{...result,sourceDigest:value.sourceDigest,fundSourceDigest:fund.sourceDigest,fundReviewId:fund.fundReviewId,allocationRevisionId:value.allocationRevisionId,heads:structuredClone(value.heads),currentSourceVerified:false as const,bankReceiptVerified:false as const,moneyMoved:false as const};
 }catch{return hold('fee_source_unavailable');}
}
