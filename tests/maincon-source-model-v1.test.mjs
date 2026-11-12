import test from 'node:test';import assert from 'node:assert/strict';
import {calculateMainConSourceModelV1 as calculate}from'../src/lib/results/maincon-source-model-v1.ts';
const input=(changes={})=>({entryCount:40,entryFeeMinor:1000,benefitsMinor:12000,expensesMinor:0,additionalIncomeMinor:0,qualifierCount:10,settings:{method:'graduated_all_qualifiers',factor:'1.5'},...changes});
test('observed $280 fund source rounds to $285 without hiding discrepancy',()=>{
 const result=calculate(input());assert.equal(result.status,'calculated');assert.equal(result.fundMinor,28000);assert.equal(result.roundedAwardsTotalMinor,28500);assert.equal(result.discrepancyMinor,500);assert.equal(result.balanced,false);
 assert.deepEqual(result.bands.map(b=>[b.firstPlace,b.lastPlace,b.perPersonMinor]),[[1,1,7000],[2,2,4500],[3,4,3000],[5,8,2000],[9,10,1500]]);assert.equal(result.comparisonOnly,true);assert.equal(result.authoritative,false);assert.equal(result.moneyMoved,false);
});
test('observed $1800 fund rounds to $1805 for ten supplied qualifiers',()=>{
 const r=calculate(input({entryFeeMinor:5000,expensesMinor:10000,additionalIncomeMinor:2000}));assert.equal(r.fundMinor,180000);assert.equal(r.roundedAwardsTotalMinor,180500);assert.equal(r.discrepancyMinor,500);assert.deepEqual(r.bands.map(b=>b.perPersonMinor),[43500,29000,19500,13000,8500]);
});
test('qualifiers supplied explicitly, same-round equality and exact rational audit across lookup128 boundary',()=>{
 for(const n of [1,2,3,5,10,129,10000]){const v=input({entryCount:Math.max(n,40),qualifierCount:n}),before=JSON.stringify(v),r=calculate(v);assert.equal(r.status,'calculated');assert.equal(r.qualifierCount,n);assert.equal(r.bands.reduce((s,b)=>s+b.people,0),n);assert.equal(r.bands.reduce((s,b)=>s+b.bandTotalMinor,0),r.roundedAwardsTotalMinor);assert.equal(JSON.stringify(v),before);for(const b of r.bands){assert.equal(b.bandTotalMinor,b.people*b.perPersonMinor);assert.equal(b.perPersonMinor%500,0);assert.match(b.unroundedPerPerson.numeratorMinor,/^[0-9]+$/);assert.match(b.unroundedPerPerson.denominator,/^[1-9][0-9]*$/);}assert.deepEqual(calculate(v),r);}
});
test('positive half rounds upward, factor1 equal shares, fractional decimal factor stays exact',()=>{
 const r=calculate(input({entryCount:1,qualifierCount:1,entryFeeMinor:250,benefitsMinor:0,settings:{method:'graduated_all_qualifiers',factor:'1'}}));assert.equal(r.bands[0].perPersonMinor,500);assert.equal(r.discrepancyMinor,250);
 const equal=calculate(input({settings:{method:'graduated_all_qualifiers',factor:'1.000000'}}));assert.equal(new Set(equal.bands.map(b=>b.perPersonMinor)).size,1);
 const fractional=calculate(input({settings:{method:'graduated_all_qualifiers',factor:'1.234567'}}));assert.equal(fractional.status,'calculated');assert.deepEqual(fractional,calculate(input({settings:{method:'graduated_all_qualifiers',factor:'1.234567'}})));
});
test('custom paid places remain blocked without inventing qualification or allocation semantics',()=>{
 for(const settings of [{method:'custom_paid_ratio',ratio:7,factor:'1.5'},{method:'custom_top_paid',paidPlaces:3,factor:'2.25'}])assert.deepEqual(calculate(input({settings})),{status:'blocked',code:'custom_paid_places_policy_unresolved'});
 for(const settings of [{method:'custom_paid_ratio',ratio:7},{method:'custom_top_paid',paidPlaces:3},{method:'custom_paid_ratio',ratio:7,factor:1.5},{method:'custom_top_paid',paidPlaces:3,factor:' 1.5'}])assert.equal(calculate(input({settings})).code,'invalid_input');
 for(const settings of [{method:'custom_paid_ratio',ratio:0},{method:'custom_top_paid',paidPlaces:1.5},{method:'graduated_all_qualifiers',factor:' 1.5'},{method:'graduated_all_qualifiers',factor:'01.5'},{method:'graduated_all_qualifiers',factor:1.5}])assert.equal(calculate(input({settings})).code,'invalid_input');
 assert.equal(calculate(input({settings:{method:'graduated_all_qualifiers',factor:'0.9'}})).code,'factor_below_one_unsupported');
});
test('invalid, negative fund, unsafe totals and resource boundaries fail closed',()=>{
 for(const change of [{qualifierCount:0},{qualifierCount:41},{entryFeeMinor:-1},{additionalIncomeMinor:0.5},{entryCount:'40'},{extra:1}])assert.equal(calculate(input(change)).code,'invalid_input');
 assert.equal(calculate(input({benefitsMinor:40001})).code,'negative_fund');assert.equal(calculate(input({entryCount:10001})).code,'technical_resource_bound');assert.equal(calculate(input({entryFeeMinor:Number.MAX_SAFE_INTEGER})).code,'technical_resource_bound');assert.equal(calculate(input({settings:{method:'graduated_all_qualifiers',factor:'1001'}})).code,'technical_resource_bound');
});
