import test from 'node:test';
import assert from 'node:assert/strict';
import {combineSemifinalChartShares} from '../src/lib/results/prize-schedule.ts';
test('combines third/fourth selected chart percentages and divides equally, preserving total shares',()=>{
 const shares=[4000,3000,2000,1000],weights=combineSemifinalChartShares(shares);
 assert.deepEqual(weights,[8,6,3]);assert.equal(weights[2]/(weights[0]+weights[1]+2*weights[2]),.15);
 assert.deepEqual(shares,[4000,3000,2000,1000]);
 assert.deepEqual(combineSemifinalChartShares([4000,3000,1501,1499]),[8,6,3]);
 assert.deepEqual(combineSemifinalChartShares([4001,3000,1500,1499]),[8002,6000,2999]);
});
test('unknown/overprecise/nonconserving percentage inputs require review rather than normalization',()=>{
 for(const s of [null,[],[50,30,20],[5000,3000,2000,1000],[4000,3000,2000,999],[4000,3000,2000.5,999.5],[10000,0,0,0]])assert.equal(combineSemifinalChartShares(s),null);
});
