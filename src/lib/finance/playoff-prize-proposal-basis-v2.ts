import 'server-only';
import {createHash} from 'node:crypto';
import {isUuid} from '../api/validation.ts';
import {isQualificationResult} from '../api/qualification-finalization.ts';
import {isEventPrizeSettingsSnapshotV1,isEventPrizeResponseValueV1} from '../api/event-prize-settings-v1.ts';
import {projectEventLedgerV1} from './event-ledger-projection-v1.ts';
import {calculatePlayoffPrizeComparisonV2} from '../results/playoff-prize-comparison-v2.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>isUuid(v)&&v===v.toLowerCase();
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
/** Read composition only. A future authenticated reader must load the binding,
 * current heads, complete allocation and qualification together. None of these
 * DTOs confer authority if supplied by a client. No legacy calculator fallback.
 */
export function buildPlayoffPrizeProposalBasisV2(value:unknown){
 const fail=(code:string)=>({status:'blocked' as const,code,financialFinalizationAllowed:false as const,moneyMoved:false as const});
 if(!isEventPrizeResponseValueV1(value)||!exact(value,['binding','prizeSource','ledger','qualification'])
 ||!exact(value.binding,['tournamentId','eventId','eventClientRowId','eventKind','setupRevisionId','settingsSnapshotId','settingsDigest','prizeSnapshotId','prizeDigest'])
 ||![value.binding.tournamentId,value.binding.eventId,value.binding.eventClientRowId,value.binding.setupRevisionId,value.binding.settingsSnapshotId,value.binding.prizeSnapshotId].every(uuid)
 ||!['main','consolation'].includes(value.binding.eventKind as string)||!digest(value.binding.settingsDigest)||!digest(value.binding.prizeDigest)
 ||!exact(value.prizeSource,['snapshot','currentPrizeSnapshotId','currentPrizeDigest'])||!isEventPrizeSettingsSnapshotV1(value.prizeSource.snapshot)
 ||!exact(value.ledger,['allocationRevisionId','currentAllocationRevisionId','current','retained'])||!uuid(value.ledger.allocationRevisionId)||value.ledger.allocationRevisionId!==value.ledger.currentAllocationRevisionId
 ||!exact(value.qualification,['currentResultVersionId','result'])||!uuid(value.qualification.currentResultVersionId))return fail('invalid_or_stale_source');
 const b=value.binding,s=value.prizeSource.snapshot;
 if(s.tournamentId!==b.tournamentId||s.setupRevisionId!==b.setupRevisionId||s.settingsSnapshotId!==b.settingsSnapshotId||s.settingsDigest!==b.settingsDigest||s.prizeSnapshotId!==b.prizeSnapshotId||s.prizeDigest!==b.prizeDigest||value.prizeSource.currentPrizeSnapshotId!==s.prizeSnapshotId||value.prizeSource.currentPrizeDigest!==s.prizeDigest)return fail('prize_binding_changed');
 const plan=s.plans.find(p=>p.eventClientRowId===b.eventClientRowId&&p.eventKind===b.eventKind);if(plan?.mode!=='proposed_v2')return fail('new_prize_policy_required');
 const ledger=projectEventLedgerV1({eventId:b.eventId,current:value.ledger.current,retained:value.ledger.retained});
 if(ledger.status!=='projected'||ledger.tournamentId!==b.tournamentId||ledger.sourceVersion<1||ledger.reviewRequired)return fail('persisted_current_ledger_review_required');
 const qualification=value.qualification.result;
 if(!isQualificationResult(qualification,b.tournamentId as string,b.eventId as string)||qualification.resultVersionId!==value.qualification.currentResultVersionId)return fail('current_qualification_required');
 const input={plan:structuredClone(plan.draft),field:{status:'known' as const,qualifierCount:qualification.qualifierCount,firstRoundLoserPlaces:null,entryFeeMinor:null},fundMinor:ledger.regularFundMinor};
 const comparison=calculatePlayoffPrizeComparisonV2(input);if(comparison.status!=='calculated_comparison')return fail(comparison.code);
 const source={tournamentId:b.tournamentId as string,eventId:b.eventId as string,eventClientRowId:b.eventClientRowId as string,eventKind:b.eventKind as 'main'|'consolation',setupRevisionId:b.setupRevisionId as string,settingsSnapshotId:b.settingsSnapshotId as string,settingsDigest:b.settingsDigest as string,prizeSnapshotId:b.prizeSnapshotId as string,prizeDigest:b.prizeDigest as string,allocationRevisionId:value.ledger.allocationRevisionId,qualificationResultVersionId:qualification.resultVersionId,ledgerDigest:hash({allocationRevisionId:value.ledger.allocationRevisionId,snapshot:value.ledger.current}),resultsDigest:hash({stage:'qualification_only_estimate',qualification})};
 return{status:'proposal_basis' as const,version:'playoff-prize-proposal-basis-v2' as const,source,input,comparison,ledgerMode:ledger.mode,resultsStage:'qualification_only_estimate' as const,sourcePointersMustBeServerVerified:true as const,firstRoundEvidenceAvailable:false as const,entryFeeComparisonSourceAvailable:false as const,recipientAssignmentAllowed:false as const,payoutsRecorded:false as const,financialFinalizationAllowed:false as const,moneyMoved:false as const};
}
