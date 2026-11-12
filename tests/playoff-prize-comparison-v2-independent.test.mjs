import assert from 'node:assert/strict';
import test from 'node:test';
import {calculatePlayoffPrizeComparisonV2 as calculate} from '../src/lib/results/playoff-prize-comparison-v2.ts';
import {newPlayoffPrizePlanDraftV2} from '../src/lib/playoffs/playoff-prize-plan-v2.ts';

function input(qualifierCount=10,fundMinor=180000){
 return {plan:newPlayoffPrizePlanDraftV2(),field:{status:'known',qualifierCount,firstRoundLoserPlaces:null,entryFeeMinor:null},fundMinor};
}
function calculated(value){const result=calculate(value);assert.equal(result.status,'calculated_comparison');return result;}
function amounts(result){return result.bands.map(b=>b.perPersonMinor);}
function assertNoAuthority(result){for(const key of['authoritative','recipientAssignmentAllowed','finalizationAllowed','payoutAuthorized','moneyMoved','qualificationChanged'])assert.equal(result[key],false,key);}

test('independent original MainCon golden retains exact fractions, finishing groups and explicit excess',()=>{
 const result=calculated(input());
 assert.deepEqual(result.bands.map(b=>[b.firstPlace,b.lastPlace,b.people]),[[1,1,1],[2,2,1],[3,4,2],[5,8,4],[9,10,2]]);
 assert.deepEqual(amounts(result),[43500,29000,19500,13000,8500]);
 // Factor 3/2 gives integer weights81,54,36,24,16 with total weight335.
 assert.deepEqual(result.bands[0].unroundedPerPerson,{numeratorMinor:'2916000',denominator:'67'});
 assert.deepEqual(result.bands[4].unroundedPerPerson,{numeratorMinor:'576000',denominator:'67'});
 assert.equal(result.roundedAwardsTotalMinor,180500);assert.equal(result.discrepancyMinor,500);assert.equal(result.reviewRequired,true);assertNoAuthority(result);
});

test('independent Equal and multiplier goldens use per-person weights, not band totals',()=>{
 const equal=input(3,10000);equal.plan.method='equal';let result=calculated(equal);
 assert.deepEqual(amounts(result),[3500,3500,3500]);assert.equal(result.roundedAwardsTotalMinor,10500);assert.equal(result.discrepancyMinor,500);
 const twice=input(3,10000);twice.plan.method='winner-multiplier';twice.plan.winnerMultiplierText='2';twice.plan.rounding.regular='1';result=calculated(twice);
 assert.deepEqual(amounts(result),[5000,2500,2500]);assert.equal(result.balanced,true);
 const decimal=input(4,9000);decimal.plan.method='winner-multiplier';decimal.plan.winnerMultiplierText='1.5';decimal.plan.rounding.regular='1';result=calculated(decimal);
 assert.deepEqual(amounts(result),[3000,2000,2000]);assert.equal(result.bands[2].bandTotalMinor,4000);assert.equal(result.roundedAwardsTotalMinor,9000);
});

test('winner-only retains inactive drafts and recipient choice while rounding the explicit fund',()=>{
 for(const [step,expected]of[['1',10300],['5',10500],['10',10000]]){
  const value=input(1,10300);value.plan.method='winner-takes-all';value.plan.recipients='top-128';value.plan.incrementFactorText='unfinished';value.plan.winnerMultiplierText='unfinished';value.plan.rounding.regular=step;
  const before=structuredClone(value),result=calculated(value);assert.equal(result.requestedPaidPlaces,1);assert.equal(result.actualPaidPlaces,1);assert.deepEqual(amounts(result),[expected]);assert.equal(result.discrepancyMinor,expected-10300);assert.equal(result.comparison,'not_applicable');assert.deepEqual(value,before);assertNoAuthority(result);
 }
});

test('all selected increments independently round exact positive halves upward without redistribution',()=>{
 for(const stepText of['1','5','10']){
  const step=Number(stepText)*100;
  for(const [fund,expected]of[[step/2-1,0],[step/2,step],[step/2+1,step]]){
   const value=input(1,fund);value.plan.method='winner-takes-all';value.plan.rounding.regular=stepText;
   const result=calculated(value);assert.deepEqual(amounts(result),[expected]);assert.equal(result.discrepancyMinor,expected-fund);assert.equal(result.reviewRequired,true);
  }
  const equal=input(2,step);equal.plan.method='equal';equal.plan.rounding.regular=stepText;
  const result=calculated(equal);assert.deepEqual(amounts(result),[step,step]);assert.equal(result.discrepancyMinor,step);
 }
});

test('factor-one and multiplier-one agree with Equal across irregular and maximum fields',()=>{
 for(const q of[1,2,5,6,10,129,10000])for(const step of['1','5','10']){
  const equal=input(q,1234567);equal.plan.method='equal';equal.plan.rounding.regular=step;
  const graduated=structuredClone(equal);graduated.plan.method='graduated';graduated.plan.incrementFactorText='1';
  const multiplier=structuredClone(equal);multiplier.plan.method='winner-multiplier';multiplier.plan.winnerMultiplierText='1.000000';
  const result=calculated(equal);assert.deepEqual(calculated(graduated).bands,result.bands);assert.deepEqual(calculated(multiplier).bands,result.bands);
  assert.equal(result.bands.reduce((n,b)=>n+b.people,0),q);assert.equal(result.bands.at(-1).lastPlace,q);
  assert.equal(result.bands.reduce((n,b)=>n+b.bandTotalMinor,0),result.roundedAwardsTotalMinor);
  for(const band of result.bands){assert.equal(band.perPersonMinor%(Number(step)*100),0);assert.equal(band.bandTotalMinor,band.people*band.perPersonMinor);}
 }
});

test('Top controls never cap silently or change qualifiers; unknown field blocks amount claims',()=>{
 const value=input(10,57500);value.plan.recipients='top-4';let result=calculated(value);
 assert.equal(result.qualifierCount,10);assert.equal(result.actualPaidPlaces,4);assert.deepEqual(amounts(result),[22500,15000,10000]);assert.equal(result.roundedAwardsTotalMinor,57500);
 for(const method of['graduated','equal','winner-multiplier']){const tooMany=input(5);tooMany.plan.method=method;tooMany.plan.recipients='top-8';assert.equal(calculate(tooMany).code,'payments_beyond_qualifiers_policy_unresolved');}
 const unknown=input();unknown.field={status:'unknown',qualifierCount:null,firstRoundLoserPlaces:null,entryFeeMinor:null};assert.equal(calculate(unknown).code,'known_playoff_field_required');
});

test('first-round uncertainty, absence, excluded places, fee and choice are distinct states',()=>{
 const value=input(5,60000);value.plan.method='winner-multiplier';
 assert.equal(calculated(value).comparison,'pending_field_evidence');
 value.field.firstRoundLoserPlaces=[];assert.equal(calculated(value).comparison,'not_applicable');
 value.field.firstRoundLoserPlaces=[5];assert.equal(calculated(value).comparison,'pending_entry_fee');
 value.field.entryFeeMinor=0;assert.equal(calculated(value).comparison,'pending_entry_fee');
 value.field.entryFeeMinor=10000;assert.equal(calculated(value).comparison,'choice_required');
 for(const [choice,fee,expected]of[['equal',10000,'satisfied'],['equal',9500,'not_satisfied'],['equal',5300,'incompatible_increment'],['less',10500,'satisfied'],['less',10000,'not_satisfied'],['more',5000,'satisfied']]){
  value.plan.firstRoundComparison=choice;value.field.entryFeeMinor=fee;const result=calculated(value);assert.equal(result.comparison,expected);assert.deepEqual(amounts(result),[20000,10000,10000,10000],'constraint must not rescale prizes');
 }
 value.plan.recipients='top-2';assert.equal(calculated(value).comparison,'not_applicable');
 for(const method of['equal','winner-takes-all']){value.plan.method=method;value.field.firstRoundLoserPlaces=null;assert.equal(calculated(value).comparison,'not_applicable');}
});

test('comparison checks every supplied paid first-round band rather than an inferred lowest award',()=>{
 const value=input(4,57500);value.field.firstRoundLoserPlaces=[2,3,4];value.field.entryFeeMinor=12000;
 value.plan.firstRoundComparison='more';assert.equal(calculated(value).comparison,'not_satisfied');
 value.plan.firstRoundComparison='less';assert.equal(calculated(value).comparison,'not_satisfied');
 value.field.firstRoundLoserPlaces=[2];value.plan.firstRoundComparison='more';assert.equal(calculated(value).comparison,'satisfied');
});

test('Q and Side increments and inactive method text never change regular amounts or mutate raw input',()=>{
 const value=input(6,87500);value.plan.method='equal';value.plan.incrementFactorText='invalid dormant';value.plan.winnerMultiplierText='invalid dormant';
 const original=structuredClone(value),baseline=calculated(value);
 for(const qPool of['1','5','10'])for(const sidePool of['1','5','10']){const candidate=structuredClone(value);candidate.plan.rounding.qPool=qPool;candidate.plan.rounding.sidePool=sidePool;assert.deepEqual(calculated(candidate),baseline);}
 assert.deepEqual(value,original);value.plan.method='graduated';assert.equal(calculate(value).code,'invalid_factor');value.plan.method='winner-multiplier';assert.equal(calculate(value).code,'invalid_winner_multiplier');
});

test('numeric/field rejections and selected-increment resource bounds remain exact',()=>{
 for(const fundMinor of[-0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER+1,'100'])assert.equal(calculate({...input(),fundMinor}).status,'blocked');
 for(const q of[-0,0,-1,1.5,10001,Number.MAX_SAFE_INTEGER]){const value=input(q);assert.equal(calculate(value).status,'blocked');}
 for(const places of[[1],[5,5],[6],['5']]){const value=input(5);value.field.firstRoundLoserPlaces=places;assert.equal(calculate(value).status,'blocked');}
 for(const factor of['0.999999','1000.000001','1.0000001',' 1.5','01.5','1e2']){const value=input();value.plan.incrementFactorText=factor;assert.equal(calculate(value).status,'blocked');}
 for(const step of['1','5','10']){const value=input(10000,Number.MAX_SAFE_INTEGER-Number(step)*100*10000);value.plan.method='equal';value.plan.rounding.regular=step;const result=calculated(value);assert(Number.isSafeInteger(result.roundedAwardsTotalMinor));assertNoAuthority(result);value.fundMinor++;assert.equal(calculate(value).code,'technical_resource_bound');}
 const zero=input(5,0);zero.plan.method='equal';const result=calculated(zero);assert.equal(result.roundedAwardsTotalMinor,0);assert.equal(result.zeroAwardBand,true);assert.equal(result.reviewRequired,true);assertNoAuthority(result);
});

test('unknown input with accessors is rejected without executing getters or throwing',()=>{
 for(const key of['fundMinor','plan','field']){
  const value=input();let calls=0;Object.defineProperty(value,key,{enumerable:true,get(){calls++;throw Error('untrusted accessor');}});
  let result;assert.doesNotThrow(()=>{result=calculate(value);});assert.equal(result.status,'blocked');assert.equal(calls,0);
 }
 const value=input();let calls=0;Object.defineProperty(value.plan,'method',{enumerable:true,get(){calls++;throw Error('untrusted nested accessor');}});
 let result;assert.doesNotThrow(()=>{result=calculate(value);});assert.equal(result.status,'blocked');assert.equal(calls,0);
});
