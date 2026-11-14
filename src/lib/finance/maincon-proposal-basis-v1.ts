import 'server-only';
import {createHash}from'node:crypto';
import{isUuid}from'../api/validation.ts';
import{isQualificationResult}from'../api/qualification-finalization.ts';
import{isEventSettingsSnapshotV3}from'../api/event-settings-snapshot-v3.ts';
import{resolveEventPlayoffParametersDraftV1}from'../playoffs/event-playoff-parameters-v1.ts';
import{projectEventLedgerV1}from'./event-ledger-projection-v1.ts';
import{calculateMainConFundComparisonV2}from'../results/maincon-fund-comparison-v2.ts';
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>obj(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>isUuid(v)&&v===v.toLowerCase();
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>obj(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
/** Server-only composition over authoritative readers still to be implemented.
 * Never accepts a posted fund/entrant count. The host must load the immutable
 * operational binding and current allocation/qualification pointers together.
 * This grants no receipt, approval, finalization or sporting authority.
 */
export function buildMainConProposalBasisV1(value:unknown){
 const fail=(code:string)=>({status:'blocked' as const,code,financialFinalizationAllowed:false as const});
 if(!exact(value,['binding','settingsSnapshot','ledger','qualification'])||!exact(value.binding,['tournamentId','eventId','eventClientRowId','setupRevisionId','settingsSnapshotId'])
  ||![value.binding.tournamentId,value.binding.eventId,value.binding.eventClientRowId,value.binding.setupRevisionId,value.binding.settingsSnapshotId].every(uuid)
  ||!exact(value.settingsSnapshot,['id','snapshot'])||!uuid(value.settingsSnapshot.id)||!isEventSettingsSnapshotV3(value.settingsSnapshot.snapshot)||!exact(value.ledger,['allocationRevisionId','currentAllocationRevisionId','current','retained'])
  ||!uuid(value.ledger.allocationRevisionId)||value.ledger.allocationRevisionId!==value.ledger.currentAllocationRevisionId
  ||!exact(value.qualification,['currentResultVersionId','result'])||!uuid(value.qualification.currentResultVersionId))return fail('invalid_or_stale_source');
 const binding=value.binding,tid=binding.tournamentId as string,eid=binding.eventId as string;
 const snapshot=value.settingsSnapshot.snapshot;
 if(value.settingsSnapshot.id!==binding.settingsSnapshotId||snapshot.tournamentId!==tid||snapshot.setupRevisionId!==binding.setupRevisionId)return fail('settings_binding_changed');
 const setting=snapshot.settings.find(s=>s.eventClientRowId===binding.eventClientRowId);
 if(!setting||setting.mode!=='configured')return fail('configured_settings_required');
 const resolved=resolveEventPlayoffParametersDraftV1(setting.draft);if(!resolved)return fail('settings_incomplete');
 const ledger=projectEventLedgerV1({eventId:eid,current:value.ledger.current,retained:value.ledger.retained});
 if(ledger.status!=='projected'||ledger.tournamentId!==tid||ledger.sourceVersion<1||ledger.reviewRequired)return fail('persisted_current_ledger_review_required');
 const result=value.qualification.result;
 if(!isQualificationResult(result,tid,eid)||result.resultVersionId!==value.qualification.currentResultVersionId)return fail('current_qualification_required');
 const input={fundMinor:ledger.regularFundMinor,qualifierCount:result.qualifierCount,settings:resolved.payout};
 const comparison=calculateMainConFundComparisonV2(input);if(comparison.status!=='calculated_comparison')return fail(comparison.code);
 const current={source:{tournamentId:tid,eventId:eid,settingsSnapshotId:binding.settingsSnapshotId as string,
  ledgerDigest:hash({allocationRevisionId:value.ledger.allocationRevisionId,snapshot:value.ledger.current}),resultsDigest:hash({stage:'qualification_only_estimate',qualification:result})},input};
 return{status:'proposal_basis' as const,current:structuredClone(current),comparison,ledgerMode:ledger.mode,
  resultsStage:'qualification_only_estimate' as const,recipientAssignmentAllowed:false as const,
  sourcePointersMustBeServerVerified:true as const,qualificationChanged:false as const,payoutsRecorded:false as const,financialFinalizationAllowed:false as const,moneyMoved:false as const};
}
