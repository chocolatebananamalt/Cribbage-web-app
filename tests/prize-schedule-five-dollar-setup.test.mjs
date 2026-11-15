import assert from 'node:assert/strict';
import test from 'node:test';
import {buildSetupPrizeScheduleV3,previewSetupPrizeScheduleV3}from'../src/lib/results/prize-schedule-setup.ts';
import {isDirectorPrizeScheduleV3}from'../src/lib/results/prize-schedule.ts';

test('new setup saves the versioned rule rather than estimated awards or funding',()=>{
 const s=buildSetupPrizeScheduleV3(5,['4','3','2','1'],'Director-selected test weights');
 assert.ok(isDirectorPrizeScheduleV3(s));
 assert.deepEqual(s.cohorts.map(c=>[c.bandStart,c.bandEnd,c.weight]),[[1,1,4],[2,2,3],[3,4,2],[5,5,1]]);
 assert.equal(buildSetupPrizeScheduleV3(5,['4','3','2'],'source'),null);
 assert.equal(buildSetupPrizeScheduleV3(4,['4','3','2.5'],'source'),null);
 assert.equal('funding' in s,false);assert.equal('awards' in s,false);
});
test('setup explains the 280.50 budget as 285 with an unfunded 4.50 requirement',()=>{
 const input={entryCount:'17',entryFeeMinor:3000,expenses:'229.50',benefitExpenses:'153.00',expectedQualifierCount:5,weights:['4','3','2','1']};
 const p=previewSetupPrizeScheduleV3(input);assert.equal(p.status,'calculated');
 assert.equal(p.originalBudgetMinor,28050);assert.equal(p.roundedBudgetMinor,28500);
 assert.equal(p.direction,'up');assert.equal(p.requiredFundingMinor,450);
 assert.deepEqual(p.awardsMinor,[9500,7500,4500,4500,2500]);
 const down=previewSetupPrizeScheduleV3({...input,benefitExpenses:'154.00'});
 assert.equal(down.roundedBudgetMinor,28000);assert.equal(down.restrictedBalanceMinor,50);
 assert.equal(down.requiredFundingMinor,0);assert.equal(down.direction,'down');
 assert.equal(previewSetupPrizeScheduleV3({...input,expenses:'229.501'}).status,'blocked');
 assert.equal(previewSetupPrizeScheduleV3({...input,benefitExpenses:''}),null);
 assert.equal(previewSetupPrizeScheduleV3({...input,benefitExpenses:'230.00'}).status,'blocked');
});
