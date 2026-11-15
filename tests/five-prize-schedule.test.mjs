import test from 'node:test';
import assert from 'node:assert/strict';
import {isDirectorPrizeScheduleV1,isDirectorPrizeScheduleV2,resolveDirectorPrizeScheduleV1,resolveDirectorPrizeScheduleV2} from '../src/lib/results/prize-schedule.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const schedule={kind:'director-selected-five-qualifier-prize-schedule-v2',amountBasis:'total_award',expectedQualifierCount:5,
 sourceReference:'Local fictional director-selected 4:3:2:2:1 test weights; not an ACC formula.',
 roundingRule:'floor_each_weighted_share_then_assign_remainder_to_champion',
 cohorts:[{bandStart:1,bandEnd:1,weight:4},{bandStart:2,bandEnd:2,weight:3},{bandStart:3,bandEnd:4,weight:2},{bandStart:5,bandEnd:5,weight:1}]};
const input=()=>({schedule:structuredClone(schedule),scope:{eventKind:'main',styleCode:'Standard',format:'standard_singles',gameCount:12,eventMode:'single_event',bracketMode:'five_qualifier_three_byes',poolMode:'none'},
 financialBasis:{status:'resolved',grossEntryIncomeMinor:51000,retainedBalanceMinor:0,expenseEvidence:{status:'complete',items:[{expenseId:id(20),amountMinor:22950,approvalStatus:'approved'}]}},
 canonicalRows:[{participantId:id(1),bandStart:1,bandEnd:1,byeWins:1},{participantId:id(2),bandStart:2,bandEnd:2,byeWins:1},{participantId:id(3),bandStart:3,bandEnd:4,byeWins:1},{participantId:id(4),bandStart:3,bandEnd:4,byeWins:0},{participantId:id(5),bandStart:5,bandEnd:5,byeWins:0}]});
test('new five-person schedule preserves equal round-loss awards and every cent',()=>{
 const x=input();const before=JSON.stringify(x);const r=resolveDirectorPrizeScheduleV2(x);assert.equal(r.status,'available');
 assert.deepEqual(r.awards.map(a=>a.totalAwardMinor),[9351,7012,4675,4675,2337]);
 assert.equal(r.awards.reduce((n,a)=>n+a.totalAwardMinor,0),28050);assert.equal(r.roundingRemainderMinor,1);
 assert.equal(JSON.stringify(x),before);assert.equal(isDirectorPrizeScheduleV1(schedule),false);assert.equal(isDirectorPrizeScheduleV2(schedule),true);
 assert.equal(resolveDirectorPrizeScheduleV1(x).status,'blocked');
});
test('fifth-place weight must be explicit; unknown/missing/extra cohorts and bye counts block',()=>{
 for(const change of [x=>x.schedule.cohorts.pop(),x=>x.schedule.cohorts[3].weight=0,x=>x.canonicalRows[0].byeWins=0,x=>x.canonicalRows[4].byeWins=2,x=>x.canonicalRows[4].bandStart=6,x=>x.scope.bracketMode='complete_no_bye']) {
  const x=input();change(x);assert.equal(resolveDirectorPrizeScheduleV2(x).status,'blocked');
 }
});
