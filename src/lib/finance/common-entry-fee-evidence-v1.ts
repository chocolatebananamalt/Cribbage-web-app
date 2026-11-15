/** Pure comparison evidence check. Inputs must be collected by an authenticated,
 * locked current-source reader. This function does not establish freshness,
 * authorization, bank settlement, or permission to award money. Not mounted. */
export type EntryFeeEvidenceV1 = {
 eventId:string; qualificationResultVersionId:string; setupEventVersionId:string;
 advertisedFeeMinor:number;
 entrants:Array<{participantId:string;rosterEntryId:string}>;
 receipts:Array<{sourceId:string;physicalEvidenceId:string;rosterEntryId:string;
  amountMinor:number;currency:string;eligibleEventIds:string[]}>;
 obligations:Array<{rosterEntryId:string;sourceId:string;amountOwedMinor:number}>;
 allocations:Array<{sourceId:string;physicalEvidenceId:string;amountMinor:number;
  allocations:Array<{eventId:string;bucket:string;poolId:string|null;amountMinor:number;classificationReviewed:boolean}>}>;
};
const id=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const money=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
export function evaluateCommonEntryFeeEvidenceV1(e:EntryFeeEvidenceV1,expected:{eventId:string;qualificationResultVersionId:string;setupEventVersionId:string;participantIds:readonly string[]}){
 const hold=(code:string)=>({status:'review_required' as const,code,entryFeeMinor:null,awardAuthorized:false as const});
 try{
  if(![e.eventId,e.qualificationResultVersionId,e.setupEventVersionId].every(id)||!money(e.advertisedFeeMinor)||!Array.isArray(e.entrants)||!e.entrants.length||e.entrants.length>10000||!Array.isArray(e.receipts)||!Array.isArray(e.obligations)||!Array.isArray(e.allocations))return hold('incomplete_event_fee_evidence');
  if(e.eventId!==expected.eventId||e.qualificationResultVersionId!==expected.qualificationResultVersionId||e.setupEventVersionId!==expected.setupEventVersionId||!Array.isArray(expected.participantIds)||expected.participantIds.length!==e.entrants.length||new Set(expected.participantIds).size!==expected.participantIds.length||!expected.participantIds.every(id))return hold('qualification_or_setup_binding_changed');
  const participants=new Set<string>(),rosters=new Set<string>(),sources=new Set<string>(),physical=new Set<string>(),obligationIds=new Set<string>();
  const bindings:Array<{participantId:string;rosterEntryId:string;receiptId:string;physicalEvidenceId:string;obligationId:string}>=[];
  for(const p of e.entrants){
   if(!id(p.participantId)||!expected.participantIds.includes(p.participantId)||!id(p.rosterEntryId)||participants.has(p.participantId)||rosters.has(p.rosterEntryId))return hold('ambiguous_entrant_binding');
   participants.add(p.participantId);rosters.add(p.rosterEntryId);
   const receipts=e.receipts.filter(r=>r.rosterEntryId===p.rosterEntryId&&r.eligibleEventIds.includes(e.eventId)),owed=e.obligations.filter(o=>o.rosterEntryId===p.rosterEntryId);
   if(receipts.length!==1||owed.length!==1)return hold('missing_or_ambiguous_receipt_or_obligation');
   const r=receipts[0],o=owed[0],alloc=e.allocations.filter(a=>a.sourceId===r.sourceId);
   if(![r.sourceId,r.physicalEvidenceId,o.sourceId].every(id)||sources.has(r.sourceId)||physical.has(r.physicalEvidenceId)||obligationIds.has(o.sourceId))return hold('duplicate_or_invalid_receipt_evidence');
   if(r.currency!=='USD'||r.amountMinor!==e.advertisedFeeMinor||o.amountOwedMinor!==e.advertisedFeeMinor)return hold('nonstandard_or_incomplete_fee_requires_policy_review');
   if(alloc.length!==1)return hold('event_allocation_required');
   const a=alloc[0];
   if(a.physicalEvidenceId!==r.physicalEvidenceId||a.amountMinor!==r.amountMinor||a.allocations.length!==1)return hold('split_or_changed_receipt_allocation');
   const line=a.allocations[0];
   if(line.eventId!==e.eventId||line.bucket!=='regular_entry'||line.poolId!==null||line.amountMinor!==r.amountMinor||line.classificationReviewed!==true)return hold('full_reviewed_event_entry_allocation_required');
   sources.add(r.sourceId);physical.add(r.physicalEvidenceId);obligationIds.add(o.sourceId);
   bindings.push({participantId:p.participantId,rosterEntryId:p.rosterEntryId,receiptId:r.sourceId,physicalEvidenceId:r.physicalEvidenceId,obligationId:o.sourceId});
  }
  return{status:'common_fee_evidence' as const,eventId:e.eventId,qualificationResultVersionId:e.qualificationResultVersionId,setupEventVersionId:e.setupEventVersionId,entryFeeMinor:e.advertisedFeeMinor,entrantCount:bindings.length,bindings,awardAuthorized:false as const};
 }catch{return hold('invalid_event_fee_evidence');}
}
