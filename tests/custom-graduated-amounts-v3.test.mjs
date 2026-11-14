import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateCustomGraduatedAmountsV3, customGraduatedAmountsVersionV3, customGraduatedMaximumRatioV3 } from '../src/lib/results/custom-graduated-amounts-v3.ts';
import { calculateGraduatedPoolAmountsV2, graduatedPoolAmountsVersionV2 } from '../src/lib/results/graduated-pool-amounts-v2.ts';
const calc = input => {const r=calculateCustomGraduatedAmountsV3(input);assert.equal(r.status,'calculated',JSON.stringify(input));return r;};
function balanced(r){assert.equal(r.policyVersion,customGraduatedAmountsVersionV3);assert.equal(r.recipientCount,Math.ceil(r.paidCount/r.ratio));assert.equal(r.awardsMinor.length,r.recipientCount);assert.equal(r.fundMinor,r.paidCount*r.feeMinor);assert.equal(r.awardsMinor.reduce((s,n)=>s+n,0),r.fundMinor);assert.ok(r.awardsMinor.every((n,i,a)=>Number.isSafeInteger(n)&&n>=r.feeMinor&&n%500===0&&(!i||n<=a[i-1])));assert.equal(r.moneyMoved,false);}
test('custom numeric domain is positive whole PostgreSQL integer, not an ACC ratio limit',()=>{
 assert.equal(customGraduatedMaximumRatioV3,2147483647);
 const one=calc({paidCount:17,feeMinor:1000,ratio:1});balanced(one);assert.deepEqual(one.awardsMinor,Array(17).fill(1000));
 const seven=calc({paidCount:21,feeMinor:1000,ratio:7});assert.deepEqual(seven.awardsMinor,[10500,7000,3500]);balanced(seven);
 for(const ratio of[101,1000,2147483647]){const r=calc({paidCount:100,feeMinor:500,ratio});balanced(r);assert.deepEqual(r.awardsMinor,[50000]);}
 for(const ratio of[0,-1,2147483648])assert.deepEqual(calculateCustomGraduatedAmountsV3({paidCount:17,feeMinor:1000,ratio}),{status:'blocked',code:'unsupported_ratio'});
 for(const ratio of['7',7.5,Infinity,NaN])assert.deepEqual(calculateCustomGraduatedAmountsV3({paidCount:17,feeMinor:1000,ratio}),{status:'blocked',code:'invalid_input'});
});
test('all prior-domain sampled outputs remain byte-equivalent apart from the new explicit method version',()=>{
 for(const paidCount of[1,2,3,7,17,18,21,99,400,1000])for(const ratio of[2,3,4,5,6,7,8,10,11,99,100])for(const feeMinor of[500,1000,1500]){
  const input={paidCount,feeMinor,ratio},next=calc(input),old=calculateGraduatedPoolAmountsV2(input);balanced(next);
  assert.deepEqual({...next,policyVersion:graduatedPoolAmountsVersionV2},old);
 }
});
test('extended-domain sweep preserves exact fund, fee floor, $5 units and descending order',()=>{
 for(const paidCount of[1,2,17,18,101,499,1000,10000])for(const ratio of[1,7,101,127,1001,2147483647])for(const feeMinor of[500,1000,100000000])balanced(calc({paidCount,feeMinor,ratio}));
 // Historic methods still reject new domains and are not silently widened.
 for(const ratio of[1,101])assert.deepEqual(calculateGraduatedPoolAmountsV2({paidCount:17,feeMinor:1000,ratio}),{status:'blocked',code:'unsupported_ratio'});
});
test('unexecuted SQL candidate preserves pure historical algorithm and widens before max-ratio addition',()=>{
 const original=fs.readFileSync('database/migrations/0258_graduated_shared_amounts_v2.sql','utf8').replace(/\r\n/g,'\n');
 const candidate=fs.readFileSync('database/proposals/custom-graduated-amounts-v3.sql','utf8').replace(/\r\n/g,'\n');
 assert.ok(candidate.includes('k:=((n::bigint+r::bigint-1)/r)::integer'));
 assert.equal(/security definer|grant execute|insert into|update app\.|delete from/i.test(candidate),false);
 const reverted=candidate.split('\n').slice(3).join('\n').replaceAll('calculate_custom_graduated_amounts_v3','calculate_graduated_pool_amounts_v2').replaceAll('graduated-custom-ratio-largest-remainder-5usd-v3','graduated-acc-weighted-largest-remainder-5usd-v2').replace('not between 1 and 2147483647','not between 2 and 100').replace('k:=((n::bigint+r::bigint-1)/r)::integer','k:=(n+r-1)/r').replace('not between 0 and 10000','not between 1 and 10000').replace(/^ if n=0 then return jsonb_build_object.*?end if;\n/m,'');
 assert.equal(reverted,original);
});

test('known zero-funded pool produces no obligations without relaxing fee or ratio validation',()=>{const r=calc({paidCount:0,feeMinor:1000,ratio:7});balanced(r);assert.equal(r.branch,'empty_pool');assert.deepEqual(r.awardsMinor,[]);assert.deepEqual(r.unroundedAwards,[]);assert.deepEqual(calculateCustomGraduatedAmountsV3({paidCount:0,feeMinor:501,ratio:7}),{status:'blocked',code:'unsupported_lattice'});assert.deepEqual(calculateCustomGraduatedAmountsV3({paidCount:0,feeMinor:1000,ratio:0}),{status:'blocked',code:'unsupported_ratio'});});
