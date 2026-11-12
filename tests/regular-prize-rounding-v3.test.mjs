import assert from 'node:assert/strict';
import test from 'node:test';
import {calculateRegularPrizeRoundingV3,isRegularPrizeRoundingV3,regularPrizeRoundingVersionV3,regularPrizeRoundingMaximumMinorV3} from '../src/lib/results/regular-prize-rounding-v3.ts';
const cohorts=weights=>weights.map((weight,i)=>({bandStart:[1,2,3,5][i],bandEnd:[1,2,4,5][i],weight}));
const input=(units=57,weights=[4,3,2,1])=>({grossBaseIncomeMinor:units*500,expenseTotalMinor:0,benefitExpenseMinor:0,expectedQualifierCount:weights.length===3?4:5,cohorts:cohorts(weights)});
const calculate=x=>{const r=calculateRegularPrizeRoundingV3(x);assert.equal(r.status,'calculated',JSON.stringify(r));return r;};
const abs=n=>n<0n?-n:n;
function oracle(units,weights){
 const mult=weights.length===3?[1,1,2]:[1,1,2,1],den=weights.reduce((s,w,i)=>s+BigInt(w)*BigInt(mult[i]),0n);let best=null,cost=null;
 const candidate=values=>{if(values.some((n,i)=>n<1||(i&&n>values[i-1])))return;const objective=values.reduce((s,n,i)=>s+BigInt(mult[i])*abs(BigInt(n)*den-BigInt(units)*BigInt(weights[i])),0n);const expanded=values.flatMap((n,i)=>Array(mult[i]).fill(n));if(cost===null||objective<cost||(objective===cost&&expanded.some((n,i)=>n!==best[i]&&expanded.slice(0,i).every((v,j)=>v===best[j])&&n>best[i]))){cost=objective;best=expanded;}};
 for(let c=1;c<=Math.floor(units/4);c++)for(let d=weights.length===3?0:1;d<=(weights.length===3?0:Math.min(c,units-4*c));d++){const sum=units-2*c-d;for(let second=c;second<=Math.floor(sum/2);second++)candidate(weights.length===3?[sum-second,second,c]:[sum-second,second,c,d]);}
 return best?.map(n=>n*500)??null;
}
function properties(r){assert.equal(r.policyVersion,regularPrizeRoundingVersionV3);assert.equal(r.roundingUnitMinor,500);assert.equal(r.awardsMinor.length,r.expectedQualifierCount);assert.equal(r.awardsMinor.reduce((s,n)=>s+n,0),r.roundedBudgetMinor);assert.ok(r.awardsMinor.every((n,i)=>n>0&&n%500===0&&(!i||n<=r.awardsMinor[i-1])));assert.equal(r.awardsMinor[2],r.awardsMinor[3]);assert.equal(r.requiredFundingMinor,Math.max(r.adjustmentMinor,0));assert.equal(r.restrictedBalanceMinor,Math.max(-r.adjustmentMinor,0));assert.equal(r.roundedBudgetMinor-r.originalBudgetMinor,r.adjustmentMinor);assert.equal(r.participantReturnMinor,r.roundedBudgetMinor+r.benefitExpenseMinor);assert.ok(r.participantReturnMinor>=r.minimumReturnMinor);assert.ok(r.cohorts.every(c=>c.rawAward.denominator!=='0'&&c.absoluteDeviation.denominator!=='0'));}
test('five-place golden minimizes exact objective and lexicographically favors higher finishing awards',()=>{
 const r=calculate(input());assert.deepEqual(r.awardsMinor,[9500,7500,4500,4500,2500]);assert.deepEqual(r.objective,{numeratorMinor:'1000',denominator:'1'});assert.equal(r.direction,'unchanged');properties(r);
 assert.deepEqual(r.cohorts[1].rawAward,{numeratorMinor:'7125',denominator:'1'});assert.deepEqual(r.cohorts[1].absoluteDeviation,{numeratorMinor:'375',denominator:'1'});
 assert.deepEqual(r.awardsMinor,oracle(57,[4,3,2,1]));
});
test('floor is selected only when exact 85 percent gross payback passes; otherwise ceil audits missing funding',()=>{
 const x={...input(),grossBaseIncomeMinor:51000,expenseTotalMinor:22950,benefitExpenseMinor:15300};const up=calculate(x);assert.equal(up.originalBudgetMinor,28050);assert.equal(up.roundedBudgetMinor,28500);assert.equal(up.direction,'up');assert.equal(up.adjustmentMinor,450);assert.equal(up.requiredFundingMinor,450);assert.equal(up.restrictedBalanceMinor,0);assert.equal(up.minimumReturnMinor,43350);assert.equal(up.participantReturnMinor,43800);properties(up);
 const down=calculate({...input(53,[4,3,2]),grossBaseIncomeMinor:48000,expenseTotalMinor:21600,benefitExpenseMinor:14800});assert.equal(down.roundedBudgetMinor,26000);assert.equal(down.direction,'down');assert.equal(down.adjustmentMinor,-400);assert.equal(down.restrictedBalanceMinor,400);assert.equal(down.requiredFundingMinor,0);assert.equal(down.participantReturnMinor,40800);properties(down);
 const cents=calculate({...input(20,[1,1,1]),grossBaseIncomeMinor:10001});assert.equal(cents.minimumReturnMinor,8501);assert.equal(cents.adjustmentMinor,-1);
});
test('strict shapes, safe integers, financial basis, bands and unsupported scopes fail closed',()=>{
 for(const x of [null,[],{}, {...input(),extra:true},{...input(),grossBaseIncomeMinor:1.5},{...input(),grossBaseIncomeMinor:Number.MAX_SAFE_INTEGER+1},{...input(),expenseTotalMinor:-1},{...input(),benefitExpenseMinor:'0'}])assert.equal(calculateRegularPrizeRoundingV3(x).status,'blocked');
 for(const changes of [{expenseTotalMinor:30000},{expenseTotalMinor:10,benefitExpenseMinor:11}])assert.deepEqual(calculateRegularPrizeRoundingV3({...input(),...changes}),{status:'blocked',code:'invalid_financial_basis'});
 for(const changes of [{expectedQualifierCount:6},{cohorts:cohorts([1,1])},{cohorts:cohorts([1,1,1,0])},{cohorts:[{bandStart:1,bandEnd:2,weight:1},...cohorts([1,1,1,1]).slice(1)]},{cohorts:cohorts([1,1,1,1]).map((c,i)=>i?c:{...c,extra:true})}])assert.deepEqual(calculateRegularPrizeRoundingV3({...input(),...changes}),{status:'blocked',code:'unsupported_scope'});
 assert.deepEqual(calculateRegularPrizeRoundingV3({...input(),grossBaseIncomeMinor:100000,expenseTotalMinor:50000}),{status:'blocked',code:'minimum_return_unmet'});
 assert.deepEqual(calculateRegularPrizeRoundingV3(input(4)),{status:'blocked',code:'insufficient_award_budget'});
 assert.deepEqual(calculateRegularPrizeRoundingV3(input(regularPrizeRoundingMaximumMinorV3/500+1)),{status:'blocked',code:'unsupported_computational_domain'});
});
test('independent complete small-domain oracle verifies optimality, ordering and exact lexicographic choice',()=>{
 let cases=0;for(const length of [3,4])for(let encoded=0;encoded<3**length;encoded++){let code=encoded;const weights=Array.from({length},()=>{const w=code%3+1;code=Math.floor(code/3);return w;});for(let units=length===3?4:5;units<=27;units++){const x=input(units,weights),r=calculate(x);properties(r);assert.deepEqual(r.awardsMinor,oracle(units,weights),JSON.stringify({units,weights}));cases++;}}
 assert.equal(cases,2511);
});
test('deterministic random small-domain oracle includes nonmonotonic/extreme weights without rewriting input',()=>{
 let state=1729;const next=()=>{state=(state*1664525+1013904223)>>>0;return state;};for(let i=0;i<500;i++){const length=i%2?3:4,weights=Array.from({length},()=>next()%100+1),units=length+1+next()%60,x=input(units,weights),before=JSON.stringify(x),r=calculate(x);assert.deepEqual(r.awardsMinor,oracle(units,weights));assert.deepEqual(calculateRegularPrizeRoundingV3(x),r);assert.equal(JSON.stringify(x),before);properties(r);}
});
test('documented maximum uses bounded breakpoint search and exact large-weight arithmetic',()=>{
 for(const weights of [[4,3,2,1],[1,1000,1,1000],[Number.MAX_SAFE_INTEGER,1,1,1],[1,1,1]]){const r=calculate(input(20000,weights));properties(r);assert.equal(r.roundedBudgetMinor,10000000);}
 const largeGross=calculate({...input(),grossBaseIncomeMinor:5000000000,expenseTotalMinor:5000000000-28500,benefitExpenseMinor:5000000000-28500});properties(largeGross);assert.equal(largeGross.originalBudgetMinor,28500);
});
test('calculated audit guard recomputes every amount, funding requirement and exact objective',()=>{
 const r=calculate(input());assert.ok(isRegularPrizeRoundingV3(r));assert.ok(isRegularPrizeRoundingV3(Object.fromEntries(Object.entries(r).reverse())));
 for(const change of [{requiredFundingMinor:1},{restrictedBalanceMinor:1},{awardsMinor:[9500,7000,5000,5000,2000]},{objective:{numeratorMinor:'0',denominator:'1'}},{extra:true}])assert.equal(isRegularPrizeRoundingV3({...r,...change}),false);
 const changed=structuredClone(r);changed.cohorts[0].rawAward.numeratorMinor='0';assert.equal(isRegularPrizeRoundingV3(changed),false);assert.equal(isRegularPrizeRoundingV3({status:'blocked',code:'invalid_input'}),false);
});
