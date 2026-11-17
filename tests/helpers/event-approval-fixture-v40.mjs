// Synthetic DTO composition through unchanged real source decoders, not DB/Auth proof.
import {selectedStepAwardViewFixtureV3} from './selected-step-award-view-fixture-v3.mjs';
import {poolProposalFixtureV38} from './pool-proposal-fixture-v38.mjs';
export const approvalIdV40=n=>'ab130000-0000-4000-8000-'+String(n).padStart(12,'0');
export function eventApprovalFixtureV40(mode='review'){
 const a=selectedStepAwardViewFixtureV3(true),{scope}=a,regular=a.value.source,record=a.value.record,fund=regular.fundSource,ownership=fund.capture.ownershipLedger,qid=fund.capture.sportingSource.qualification.resultVersionId;
 const pool=poolProposalFixtureV38('saved',scope,qid),p=pool.s;
 p.ownershipRevisionId=ownership.ownershipRevisionId;
 ownership.funds.qReceiptsMinor=p.qMinor;ownership.funds.sideReceiptsMinor=p.sideMinor;
 const entry=ownership.ledger.sources[0];entry.amountMinor=10000+p.totalMinor;
 entry.allocations[1].amountMinor=p.qMinor;entry.allocations[1].poolId=p.pools[0].poolId;
 entry.allocations[2].amountMinor=p.sideMinor;entry.allocations[2].poolId=p.pools[1].poolId;
 ownership.ledger.pools= p.pools.map(x=>({poolId:x.poolId,eventId:scope.eventId,kind:x.kind}));
 regular.prizeWorkspace.nativeSource.capture.input.ledger.retained=structuredClone(ownership.ledger);
 fund.capture.optionalPools=p;record.sourceCapture=structuredClone(regular);
 const pins={qualificationId:qid,ownershipRevisionId:ownership.ownershipRevisionId,prizeRevisionId:record.prizeRevisionId,fundReviewId:fund.reviewId,regularAwardSetId:record.awardSetId,poolProposalRevisionId:approvalIdV40(70)};
 const financial={kind:'manual-pool-final-source-v1',status:'source_available',...scope,...pins,sourceDigest:'8'.repeat(64),regularSource:regular,regularRecord:record,poolSource:p,fund,ownership};
 const source={status:'source_available',...scope,...pins,sourceDigest:'7'.repeat(64),poolFinalId:approvalIdV40(71),capture:{financialSource:financial,poolResults:{currentSourceVerified:true,historicalOnly:false,sourceCapture:p}}};
 const event={kind:'modern-event-final-workspace-v1',...scope,status:mode==='review'?'review':'recorded',source,currentSourceVerified:true,moneyMoved:false,officialMrpAwarded:false,record:mode==='review'?null:{id:approvalIdV40(72),source_capture:structuredClone(source),source_digest:source.sourceDigest}};
 const closure={kind:'modern-event-closure-workspace-v1',...scope,status:mode==='closed'?'recorded':'review',snapshotId:approvalIdV40(72),source:structuredClone(source),currentSourceVerified:true,moneyMoved:false,officialMrpAwarded:false,readiness:{unresolvedGames:0,scheduledGames:12},closureId:mode==='closed'?approvalIdV40(73):null,closeState:mode==='closed'?'closed':null};
 return{scope,qid,pool,event,closure};
}
