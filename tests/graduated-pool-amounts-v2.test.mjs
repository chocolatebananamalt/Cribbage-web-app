import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {calculateGraduatedPoolAmountsV2,graduatedPoolAmountsVersionV2}from'../src/lib/results/graduated-pool-amounts-v2.ts';
import {calculateAccWeightedPool}from'../src/lib/results/acc-weighted-pool.ts';
const calculate=input=>{const r=calculateGraduatedPoolAmountsV2(input);assert.equal(r.status,'calculated',JSON.stringify(input));return r;};
function properties(r){
 assert.equal(r.policyVersion,graduatedPoolAmountsVersionV2);assert.equal(r.roundingUnitMinor,500);assert.equal(r.currency,'USD');assert.equal(r.moneyMoved,false);
 assert.equal(r.recipientCount,Math.ceil(r.paidCount/r.ratio));assert.equal(r.fundMinor,r.paidCount*r.feeMinor);assert.equal(r.awardsMinor.length,r.recipientCount);
 assert.equal(r.awardsMinor.reduce((sum,n)=>sum+n,0),r.fundMinor);
 const k=BigInt(r.recipientCount),divisor=k*(k+1n)/2n,den=r.branch==='single_recipient'?1n:r.branch==='descending_linear'?divisor:divisor-k;
 let rawSum=0n;
 r.awardsMinor.forEach((award,i)=>{
  assert.ok(Number.isSafeInteger(award)&&award>=r.feeMinor&&award>0&&award%500===0);if(i)assert.ok(award<=r.awardsMinor[i-1]);
  const a=r.unroundedAwards[i],n=BigInt(a.numeratorMinor),d=BigInt(a.denominator);assert.ok(d>0n);assert.equal(den%d,0n);rawSum+=n*(den/d);
  const floor=n/(d*500n)*500n;assert.ok(BigInt(award)===floor||BigInt(award)===floor+500n);
  if(n%(d*500n)===0n)assert.equal(BigInt(award),floor);
 });
 assert.equal(rawSum,BigInt(r.fundMinor)*den);
}
test('new shared version conserves $5/$10 funds and the $590 golden without manual adjustment',()=>{
 const a=calculate({paidCount:16,feeMinor:500,ratio:6});assert.deepEqual(a.awardsMinor,[4000,2500,1500]);properties(a);
 const b=calculate({paidCount:16,feeMinor:1000,ratio:6});assert.deepEqual(b.awardsMinor,[8000,5500,2500]);properties(b);
 const c=calculate({paidCount:59,feeMinor:1000,ratio:4});assert.deepEqual(c.awardsMinor,[7000,6500,6000,5500,5000,5000,4500,4000,3500,3000,2500,2000,2000,1500,1000]);properties(c);
});
test('all1536 historical v1 supported inputs agree exactly except the disclosed policy version',()=>{
 const oldBytes=fs.readFileSync('src/lib/results/acc-weighted-pool.ts'),before=crypto.createHash('sha256').update(oldBytes).digest('hex');
 let count=0;for(const feeMinor of[1000,2000,5000])for(const ratio of[4,6])for(let paidCount=1;paidCount<=256;paidCount++){
  const input=Object.freeze({paidCount,feeMinor,ratio}),old=calculateAccWeightedPool(input),next=calculate(input);
  const {moneyMoved,...sameAmountFields}=next;assert.equal(moneyMoved,false);assert.deepEqual({...sameAmountFields,policyVersion:old.policyVersion},old);count++;
 }
 assert.equal(count,1536);assert.equal(crypto.createHash('sha256').update(fs.readFileSync('src/lib/results/acc-weighted-pool.ts')).digest('hex'),before);
});
test('single recipient, exact branch boundary, arbitrary supported ratios and fee floor stay defined',()=>{
 for(const ratio of[2,4,6,100])for(const paidCount of[1,ratio-1,ratio]){const r=calculate({paidCount,feeMinor:1500,ratio});assert.equal(r.recipientCount,1);assert.deepEqual(r.awardsMinor,[paidCount*1500]);properties(r);}
 const boundary=calculate({paidCount:21,feeMinor:500,ratio:4});assert.equal(boundary.branch,'entry_fee_floor');properties(boundary);
 for(const ratio of[2,3,7,25,99,100])for(const paidCount of[ratio+1,2*ratio,2*ratio+1])properties(calculate({paidCount,feeMinor:3500,ratio}));
});
test('wide deterministic domain retains exact sum, ordered positive fee-floor awards and rational quotas',()=>{
 let count=0;for(const paidCount of[1,2,3,59,89,90,9999,10000])for(const ratio of[2,3,4,5,6,7,10,50,99,100])for(const feeMinor of[500,1500,100000000]){properties(calculate({paidCount,feeMinor,ratio}));count++;}
 let state=0x2550258;for(let i=0;i<250;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;const paidCount=1+state%10000;state=(Math.imul(state,1664525)+1013904223)>>>0;const ratio=2+state%99;state=(Math.imul(state,1664525)+1013904223)>>>0;properties(calculate({paidCount,ratio,feeMinor:(1+state%200000)*500}));count++;}
 assert.equal(count,490);
});
test('equal rounding remainders favor higher place and retain the accepted count tradeoff',()=>{
 assert.deepEqual(calculate({paidCount:29,feeMinor:1000,ratio:4}).awardsMinor,[6500,5500,5000,4000,3000,2500,1500,1000]);
 const a=calculate({paidCount:89,feeMinor:1000,ratio:4}),b=calculate({paidCount:90,feeMinor:1000,ratio:4});assert.equal(a.awardsMinor[21],1500);assert.equal(b.awardsMinor[21],1000);properties(a);properties(b);
});
test('strict shape, safe integer bounds, whole $5 fees and ratio limits reject rather than rescale',()=>{
 const good={paidCount:16,feeMinor:500,ratio:6};
 for(const bad of[null,[],{},Object.create(good),{...good,paidCount:'16'},{...good,feeMinor:500n},{...good,ratio:2.5},{...good,fundMinor:9000},{...good,[Symbol('fund')]:1},{...good,paidCount:Infinity}])assert.deepEqual(calculateGraduatedPoolAmountsV2(bad),{status:'blocked',code:'invalid_input'});
 for(const paidCount of[0,-1,10001,Number.MAX_SAFE_INTEGER])assert.deepEqual(calculateGraduatedPoolAmountsV2({...good,paidCount}),{status:'blocked',code:'unsupported_paid_count'});
 for(const feeMinor of[0,-500,499,100000001])assert.deepEqual(calculateGraduatedPoolAmountsV2({...good,feeMinor}),{status:'blocked',code:'unsupported_fee'});
 for(const feeMinor of[501,1001,99999999])assert.deepEqual(calculateGraduatedPoolAmountsV2({...good,feeMinor}),{status:'blocked',code:'unsupported_lattice'});
 for(const ratio of[0,1,101,Number.MAX_SAFE_INTEGER])assert.deepEqual(calculateGraduatedPoolAmountsV2({...good,ratio}),{status:'blocked',code:'unsupported_ratio'});
 assert.equal(calculate({paidCount:10000,feeMinor:100000000,ratio:2}).fundMinor,1000000000000);
});
