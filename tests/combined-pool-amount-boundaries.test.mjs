import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateGraduatedPoolAmountsV2} from '../src/lib/results/graduated-pool-amounts-v2.ts';
import {calculateRegularPrizeRoundingV3} from '../src/lib/results/regular-prize-rounding-v3.ts';
const cohorts=[{bandStart:1,bandEnd:1,weight:4},{bandStart:2,bandEnd:2,weight:3},{bandStart:3,bandEnd:4,weight:2},{bandStart:5,bandEnd:5,weight:1}];
const regular=benefit=>calculateRegularPrizeRoundingV3({grossBaseIncomeMinor:51000,expenseTotalMinor:22950,benefitExpenseMinor:benefit,expectedQualifierCount:5,cohorts});
const sum=a=>a.reduce((s,n)=>s+n,0);
test('combined amount rehearsal conserves three separate pots and explicit top-up without certifying recipients',()=>{
 const q=calculateGraduatedPoolAmountsV2({paidCount:17,feeMinor:1000,ratio:6});
 const side=calculateGraduatedPoolAmountsV2({paidCount:17,feeMinor:1000,ratio:6});
 const base=regular(15300);
 for(const r of[q,side,base])assert.equal(r.status,'calculated');
 assert.deepEqual(q.awardsMinor,side.awardsMinor);
 assert.equal(q.fundMinor,17000);assert.equal(side.fundMinor,17000);
 assert.equal(base.requiredFundingMinor,450);
 assert.equal(51000+q.fundMinor+side.fundMinor+base.requiredFundingMinor,22950+sum(base.awardsMinor)+sum(q.awardsMinor)+sum(side.awardsMinor));
 assert.equal(base.minimumReturnMinor,43350);assert.equal(base.participantReturnMinor,43800);
 assert.equal(base.awardsMinor[2],base.awardsMinor[3]);
 for(const amount of [...q.awardsMinor,...side.awardsMinor,...base.awardsMinor])assert.equal(amount%500,0);
 assert.equal(q.moneyMoved,false);assert.equal(side.moneyMoved,false);
 assert.equal(Object.hasOwn(side,'recipients'),false,'amount calculation cannot silently assign Side beneficiaries');
});
test('no-Q hosted budget separates the restricted 50-cent balance from prize awards',()=>{
 const r=regular(16000);assert.equal(r.status,'calculated');
 assert.equal(r.roundedBudgetMinor,28000);assert.equal(r.restrictedBalanceMinor,50);assert.equal(r.requiredFundingMinor,0);
 assert.equal(51000,22950+sum(r.awardsMinor)+r.restrictedBalanceMinor);
 assert.equal(r.participantReturnMinor,44000);assert.equal(r.awardsMinor[2],r.awardsMinor[3]);
});
test('separate paid entrant counts are never substituted by tournament roster count',()=>{
 const q=calculateGraduatedPoolAmountsV2({paidCount:16,feeMinor:1000,ratio:6});
 const side=calculateGraduatedPoolAmountsV2({paidCount:13,feeMinor:1000,ratio:6});
 assert.equal(q.status,'calculated');assert.equal(side.status,'calculated');
 assert.equal(sum(q.awardsMinor),16000);assert.equal(sum(side.awardsMinor),13000);
 assert.notDeepEqual(q.awardsMinor,side.awardsMinor);
});
