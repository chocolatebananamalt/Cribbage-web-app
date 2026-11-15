import test from 'node:test';import assert from 'node:assert/strict';
import {simulatedDollars,buildSimulatedExpense,buildSimulatedClassification} from '../src/lib/api/simulated-finance-expense.ts';
const id=n=>`10000000-0000-0000-0000-${String(n).padStart(12,'0')}`,why='TEST ONLY SYNTHETIC: fixture';
test('one event-split expense conserves exact integer amounts',()=>{
 assert.equal(simulatedDollars('12.50'),1250);assert.equal(simulatedDollars(''),null);assert.equal(simulatedDollars('1e3'),null);
 assert.equal(buildSimulatedExpense([{eventId:id(1),amountMinor:1000},{eventId:id(2),amountMinor:500}],why).amountMinor,1500);
 assert.equal(buildSimulatedExpense([{eventId:id(1),amountMinor:1000},{eventId:id(1),amountMinor:500}],why),null);
});
test('classification allocates every expense and matches the recorded sanction assessment',()=>{
 const row={sourceId:id(1),sourceMinor:1500,operating:500,player_benefit:0,sanctioning:1000};
 const draft=buildSimulatedClassification([row],1000,'a'.repeat(64),0,why);
 assert.deepEqual(draft.classifications.map(c=>c.amountMinor),[500,1000]);
 assert.equal(buildSimulatedClassification([row],900,'a'.repeat(64),0,why),null);
 assert.equal(buildSimulatedClassification([{...row,operating:499}],1000,'a'.repeat(64),0,why),null);
 assert.equal(buildSimulatedClassification([row,row],1000,'a'.repeat(64),0,why),null);
});
