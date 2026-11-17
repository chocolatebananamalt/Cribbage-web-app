import{calculateSelectedStepPoolAmountsV3 as calculate}from'../../src/lib/results/selected-step-pool-amounts-v3.ts';
import{source,id,scope}from'../fixtures/selected-step-pool-v3.mjs';
export{id,scope};
export function poolProposalFixtureV38(mode='unsaved',fixed=scope,qid=id(5)){
 const s=source();Object.assign(s,fixed,{qualificationResultVersionId:qid});
 const side=structuredClone(s.pools[0]);side.poolId=id(17);side.label='Side Pool with $10 Increment';side.kind='side';side.operatingPolicyId=id(18);side.recipientReviewId=id(19);side.policy={version:'selected-step-pool-policy-v3',kind:'side',method:'side-sheet',feeMinor:1000,ratio:6,roundingUnitMinor:1000};side.calculation=calculate({policy:{kind:'side',method:'side-sheet',feeMinor:1000,ratio:6,roundingUnitMinor:1000},paidCount:17,recipientCount:3});side.recipients.forEach((r,i)=>r.amountMinor=side.calculation.awardsMinor[i]);s.pools.push(side);s.sideMinor=17000;s.totalMinor=34000;
 const head=mode==='unsaved'?null:{id:id(40),version:1,tournament_id:fixed.tournamentId,event_id:fixed.eventId,source_digest:mode==='changed-source'?'e'.repeat(64):s.sourceDigest,source_capture:structuredClone(s)};
 const history={kind:'selected-step-pool-history-v3',...fixed,historicalReceipt:true,currentSourceVerified:false,moneyMoved:false,payoutAuthorized:false,head,final:null,recipients:[]};
 if(mode==='historical-record'){history.final={id:id(41),actor_id:fixed.actorId,tournament_id:fixed.tournamentId,event_id:fixed.eventId,proposal_revision_id:head.id,source_digest:s.sourceDigest,source_capture:structuredClone(s),q_minor:s.qMinor,side_minor:s.sideMinor,total_minor:s.totalMinor};history.recipients=s.pools.flatMap(p=>p.recipients.map(r=>({final_id:id(41),tournament_id:fixed.tournamentId,event_id:fixed.eventId,pool_id:p.poolId,pool_kind:p.kind,participant_id:r.participantId,display_name:r.name,tournament_player_id:r.tournamentPlayerId,amount_minor:r.amountMinor,rounding_unit_minor:p.policy.roundingUnitMinor})));}
 if(mode==='held')history.kind='unverified_fixture';
 if(mode==='foreign-qid')s.qualificationResultVersionId=id(99);
 return{s,history,scope:fixed,qid};
}
