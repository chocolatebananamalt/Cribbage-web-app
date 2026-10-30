import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
import { calculateAccWeightedPool, accWeightedPoolVersion } from '../src/lib/results/acc-weighted-pool.ts';
import { qChartSchedules } from '../src/lib/results/q-chart-catalog.ts';

const calculated=input=>{const r=calculateAccWeightedPool(input);assert.equal(r.status,'calculated');return r;};
const add=(a,b)=>({n:a.n*b.d+b.n*a.d,d:a.d*b.d});
const fractions=r=>r.unroundedAwards.map(f=>({n:BigInt(f.numeratorMinor),d:BigInt(f.denominator)}));
function properties(r){
 assert.equal(r.policyVersion,accWeightedPoolVersion);assert.equal(r.currency,'USD');assert.equal(r.roundingUnitMinor,500);
 assert.equal(r.recipientCount,Math.ceil(r.paidCount/r.ratio));assert.equal(r.awardsMinor.length,r.recipientCount);
 assert.equal(r.fundMinor,r.paidCount*r.feeMinor);assert.equal(r.awardsMinor.reduce((s,n)=>s+n,0),r.fundMinor);
 assert.ok(r.awardsMinor.every((n,i)=>Number.isSafeInteger(n)&&n>=r.feeMinor&&n%500===0&&(i===0||r.awardsMinor[i-1]>=n)));
 const raw=fractions(r),sum=raw.reduce(add,{n:0n,d:1n});assert.equal(sum.n,BigInt(r.fundMinor)*sum.d);
 for(let i=0;i<raw.length;i++){
  const {n,d}=raw[i],award=BigInt(r.awardsMinor[i]);assert.ok(d>0n&&n>=BigInt(r.feeMinor)*d);
  const floor=n/(500n*d)*500n;assert.ok(award===floor||award===floor+500n,'each award must remain within adjacent $5 choices');
  if(n%(500n*d)===0n)assert.equal(award,floor,'an exact raw award cannot receive a spurious increment');
 }
}
test('new version uses exact ACC raw weights and conserves the documented $590 pool',()=>{
 const input=Object.freeze({paidCount:59,feeMinor:1000,ratio:4}),r=calculated(input);
 assert.equal(r.branch,'entry_fee_floor');assert.deepEqual(r.awardsMinor,[7000,6500,6000,5500,5000,5000,4500,4000,3500,3000,2500,2000,2000,1500,1000]);
 assert.equal(r.fundMinor,59000);assert.equal(r.recipientCount,15);properties(r);
 assert.deepEqual(r.unroundedAwards[0],{numeratorMinor:'20600',denominator:'3'});
 assert.deepEqual(input,{paidCount:59,feeMinor:1000,ratio:4});
});
test('single-recipient whole-pot and the raw-formula branch boundary are explicit',()=>{
 for(const ratio of[4,6])for(const feeMinor of[1000,2000,5000])for(let paidCount=1;paidCount<=ratio;paidCount++){
  const r=calculated({paidCount,feeMinor,ratio});assert.equal(r.branch,'single_recipient');assert.deepEqual(r.awardsMinor,[paidCount*feeMinor]);properties(r);
 }
 const boundary=calculated({paidCount:21,feeMinor:1000,ratio:4});assert.equal(boundary.recipientCount,6);
 assert.equal(boundary.branch,'entry_fee_floor');assert.deepEqual(boundary.awardsMinor,[6000,5000,4000,3000,2000,1000]);
 assert.equal(calculated({paidCount:20,feeMinor:1000,ratio:4}).branch,'descending_linear');
 assert.equal(calculated({paidCount:22,feeMinor:1000,ratio:4}).branch,'descending_linear');
});
test('equal fractional remainders favor the higher finishing place, not an identifier or random order',()=>{
 const r=calculated({paidCount:29,feeMinor:1000,ratio:4});
 assert.deepEqual(r.awardsMinor,[6500,5500,5000,4000,3000,2500,1500,1000]);
 const raw=fractions(r),a=raw[2],b=raw[4];
 assert.equal((a.n%(500n*a.d))*b.d,(b.n%(500n*b.d))*a.d);
 assert.equal(BigInt(r.awardsMinor[2]),a.n/(500n*a.d)*500n+500n);
 assert.equal(BigInt(r.awardsMinor[4]),b.n/(500n*b.d)*500n);
});
test('all 320 supplied chart domains match the independent research method, without changing the chart data',()=>{
 const bytes=fs.readFileSync(new URL('./fixtures/acc-weighted-pool-320-goldens.json',import.meta.url));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'cd8526aa2117ff85af3c00efeb90b377f0643ac685e7d462dc8e04b86ae71a14');
 const golden=JSON.parse(bytes),cells=qChartSchedules.flatMap(s=>s.cells),before=JSON.stringify(qChartSchedules);
 assert.equal(golden.rows.length,320);assert.equal(cells.length,320);
 const keys=new Set();for(const expected of golden.rows){const key=[expected.paidCount,expected.feeMinor,expected.ratio].join(':');assert.ok(!keys.has(key));keys.add(key);
  const r=calculated({paidCount:expected.paidCount,feeMinor:expected.feeMinor,ratio:expected.ratio});assert.deepEqual(r.awardsMinor,expected.awardsMinor,key);properties(r);
  assert.ok(cells.some(c=>c.paidCount===expected.paidCount&&c.feeMinor===expected.feeMinor&&c.ratio===expected.ratio));
 }
 assert.equal(JSON.stringify(qChartSchedules),before,'historical chart arrays/provenance must remain unchanged');
 assert.notDeepEqual(calculated({paidCount:12,feeMinor:1000,ratio:6}).awardsMinor,[7500,4500],'friend chart is not a raw formula oracle');
});
test('the complete supported domain of 1..256 entrants, three fees and both ratios is exact and deterministic',()=>{
 let count=0;for(let paidCount=1;paidCount<=256;paidCount++)for(const feeMinor of[1000,2000,5000])for(const ratio of[4,6]){
  const input={paidCount,feeMinor,ratio},r=calculated(input);properties(r);assert.deepEqual(calculateAccWeightedPool({...input}),r);count++;
 }
 assert.equal(count,1536);
});
test('for small recipient counts largest remainder minimizes exact absolute rounding error over every balanced adjacent choice',()=>{
 for(let paidCount=1;paidCount<=20;paidCount++)for(const feeMinor of[1000,2000,5000])for(const ratio of[4,6]){
  const r=calculated({paidCount,feeMinor,ratio}),raw=fractions(r),floors=raw.map(a=>a.n/(500n*a.d)*500n);
  const denominator=raw.reduce((d,a)=>d*a.d,1n),cost=awards=>raw.reduce((s,a,i)=>{const delta=BigInt(awards[i])*a.d-a.n;return s+(delta<0n?-delta:delta)*(denominator/a.d);},0n);
  const target=cost(r.awardsMinor);let best=null,bestAwards=null;
  for(let mask=0;mask<2**raw.length;mask++){
   const a=floors.map((n,i)=>n+((mask&(1<<i))?500n:0n));if(a.reduce((s,n)=>s+n,0n)!==BigInt(r.fundMinor))continue;
   const c=cost(a);if(best===null||c<best){best=c;bestAwards=a;}
   else if(c===best){for(let i=0;i<a.length;i++){if(a[i]!==bestAwards[i]){if(a[i]>bestAwards[i])bestAwards=a;break;}}}
  }
  assert.equal(target,best);assert.deepEqual(r.awardsMinor,bestAwards.map(Number));
 }
});
test('accepted count-to-count nonmonotonicity is visible: rank 22 falls from $15 to $10 at 89→90',()=>{
 const a=calculated({paidCount:89,feeMinor:1000,ratio:4}),b=calculated({paidCount:90,feeMinor:1000,ratio:4});
 assert.equal(a.recipientCount,23);assert.equal(b.recipientCount,23);assert.equal(a.awardsMinor[21],1500);assert.equal(b.awardsMinor[21],1000);
 properties(a);properties(b);
});
test('strict bounded input rejects coercion, foreign fund overrides, arbitrary-cent fees and unsupported policies',()=>{
 const good={paidCount:16,feeMinor:1000,ratio:6};
 for(const bad of[null,[],{},'16',{...good,paidCount:'16'},{...good,paidCount:1.5},{...good,feeMinor:1000n},{...good,ratio:NaN},
  {...good,fundMinor:16000},{...good,awardsMinor:[16000]},{...good,paidCount:Infinity},Object.create(good),{...good,[Symbol('fund')]:16000}])
  assert.deepEqual(calculateAccWeightedPool(bad),{status:'blocked',code:'invalid_input'});
 for(const paidCount of[0,-1,257,Number.MAX_SAFE_INTEGER])assert.deepEqual(calculateAccWeightedPool({...good,paidCount}),{status:'blocked',code:'unsupported_paid_count'});
 for(const feeMinor of[0,-1000,1,999,1001,2500])assert.deepEqual(calculateAccWeightedPool({...good,feeMinor}),{status:'blocked',code:'unsupported_fee'});
 for(const ratio of[0,-1,1,2,5,7,256])assert.deepEqual(calculateAccWeightedPool({...good,ratio}),{status:'blocked',code:'unsupported_ratio'});
 const hidden={...good};Object.defineProperty(hidden,'fundMinor',{value:16000});assert.deepEqual(calculateAccWeightedPool(hidden),{status:'blocked',code:'invalid_input'});
});
