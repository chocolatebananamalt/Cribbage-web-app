import test from 'node:test';
import assert from 'node:assert/strict';
import { qChartSchedules, qChartSourceSha256, lookupQChart } from '../src/lib/results/q-chart-catalog.ts';
import { previewQOperatingScheduleV2 } from '../src/lib/results/q-operating-schedule.ts';

const expected = [[2,10,6,11,60,50],[3,20,6,21,80,60],[4,50,6,11,70,60],[5,10,4,11,60,44],[6,20,4,21,70,50],[7,50,4,11,60,50]];
test('six independent schedules retain source identity and exact supported ranges', () => {
  assert.equal(qChartSourceSha256,'f7549bd181bdfd0c08695547293d32811b5406ef1aa3c171bba221420238924d');
  assert.equal(qChartSchedules.length,6);
  assert.equal(new Set(qChartSchedules.map(s=>s.id)).size,6);
  assert.equal(qChartSchedules.reduce((n,s)=>n+s.cells.length,0),314);
  for (const [page,fee,ratio,min,max,count] of expected) {
    const s=qChartSchedules.find(s=>s.page===page);
    assert.equal(s.feeMinor,fee*100);assert.equal(s.ratio,ratio);assert.equal(s.cells.length,count);
    for(let n=min;n<=max;n++) assert.equal(lookupQChart(s.id,n)!==null, !(page===5&&[39,56,57,58,59,60].includes(n)),`page ${page} count ${n}`);
    assert.equal(lookupQChart(s.id,min-1),null);assert.equal(lookupQChart(s.id,max+1),null);
  }
});
test('every supported row conserves the exact pot, ceil recipient count and nonincreasing awards', () => {
  for(const s of qChartSchedules)for(const c of s.cells){
    assert.equal(c.scheduleId,s.id);assert.equal(c.ratio,s.ratio);assert.equal(c.feeMinor,s.feeMinor);
    assert.ok(c.sourceReference.includes(qChartSourceSha256));assert.ok(c.sourceReference.includes(`page ${s.page}`));
    assert.equal(c.awardsMinor.length,Math.ceil(c.paidCount/s.ratio));
    assert.equal(c.awardsMinor.reduce((n,a)=>n+BigInt(a),0n),BigInt(c.paidCount)*BigInt(s.feeMinor));
    c.awardsMinor.forEach((a,i)=>{assert.ok(Number.isSafeInteger(a)&&a>0);assert.equal(a%100,0);if(i)assert.ok(a<=c.awardsMinor[i-1]);});
    const cards=Array.from({length:c.paidCount},(_,i)=>({participantId:`P${i}`,gamePoints:2*(c.paidCount-i),gamesWon:c.paidCount-i,plusPoints:10*(c.paidCount-i),qualified:false,qualificationRank:null}));
    const r=previewQOperatingScheduleV2({policy:{method:'graduated-paid-card-rank-v2',feeMinor:s.feeMinor,ratio:s.ratio,scheduleId:s.id},cards,contributions:cards.map(x=>({participantId:x.participantId,amountMinor:s.feeMinor})),cuts:[],chart:lookupQChart(s.id,c.paidCount)});
    assert.equal(r.status,'preview');assert.deepEqual(r.awards.map(a=>a.amountMinor),c.awardsMinor);assert.equal(r.moneyMoved,false);
  }
});
test('independently supplied golden cells use dollars once and never scaled sibling tables',()=>{
  const examples=[[2,16,[80,50,30]],[3,21,[170,120,80,50]],[4,16,[390,250,160]],[5,16,[65,45,30,20]],[6,21,[125,90,70,55,45,35]],[7,16,[300,220,160,120]]];
  for(const [page,count,dollars]of examples){const s=qChartSchedules.find(s=>s.page===page);assert.deepEqual(lookupQChart(s.id,count).awardsMinor,dollars.map(n=>n*100));}
});
test('unavailable rows and malformed lookups fail closed without interpolation or mutation',()=>{
  const s=qChartSchedules.find(s=>s.page===5);
  for(const n of [39,56,57,58,59,60,0,-1,NaN,Infinity,11.5,'11',null,undefined])assert.equal(lookupQChart(s.id,n),null);
  for(const id of ['',null,undefined,{},'friend-q-p2-20-6-v1'])assert.equal(lookupQChart(id,11),null);
  const c=lookupQChart(s.id,11);c.awardsMinor[0]=1;c.feeMinor=1;
  assert.deepEqual(lookupQChart(s.id,11).awardsMinor,[5000,3500,2500]);assert.equal(lookupQChart(s.id,11).feeMinor,1000);
  assert.ok(Object.isFrozen(qChartSchedules));for(const row of qChartSchedules){assert.ok(Object.isFrozen(row));assert.ok(Object.isFrozen(row.cells));for(const c of row.cells){assert.ok(Object.isFrozen(c));assert.ok(Object.isFrozen(c.awardsMinor));}}
});
