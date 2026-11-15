import test from'node:test';
import assert from'node:assert/strict';
import{calculateEventFinanceRegistrationForecastV1 as forecast}from'../src/lib/finance/event-finance-registration-forecast-v1.ts';

const input=(entryCount,more={})=>({policy:'regular-top-quarter-round-up',eventKind:'main',eventStyle:'Standard',eventFormat:'standard_singles',officialQualifierCount:null,entryCount,fundMinor:180000,settings:{method:'graduated_all_qualifiers',factor:'1.5'},...more});

test('quarter-up forecasts use all registration entries including comped entries',()=>{
 for(const [entryCount,qualifiers]of[[12,3],[17,5],[18,5],[40,10]]){
  const result=forecast(input(entryCount));assert.equal(result.status,'forecast');assert.equal(result.estimatedQualifierCount,qualifiers);assert.equal(result.comparison.qualifierCount,qualifiers);assert.equal(result.entryPopulation,'registration_entries_including_comped');
 }
 assert.equal(forecast({...input(17),paidEntryCount:12}).code,'invalid_input');
});

test('forecast remains explicitly non-authoritative and has no recipients or override inputs',()=>{
 const result=forecast(input(18));assert.equal(result.status,'forecast');assert.equal(result.sourceClaim,'forecast');assert.equal(result.officialQualifierCount,null);assert.equal(result.forecastOnly,true);
 for(const field of['qualificationChanged','authoritative','finalizationAllowed','payoutAuthorized','moneyMoved','writeAuthorized'])assert.equal(result[field],false);
 assert.equal(result.comparison.authoritative,false);assert.equal(result.comparison.finalizationAllowed,false);assert.equal(result.comparison.moneyMoved,false);
 assert.equal('recipients'in result,false);assert.equal('overrideHistory'in result,false);assert.equal('paidEntryCount'in result,false);
});

test('Top 6 expands to the equal 5th-8th band at a forty-entry field',()=>{
 const result=forecast(input(40,{settings:{method:'custom_top_paid',paidPlaces:6,factor:'1.5'}}));assert.equal(result.status,'forecast');
 assert.equal(result.estimatedQualifierCount,10);assert.equal(result.comparison.requestedPaidPlaces,6);assert.equal(result.comparison.actualPaidPlaces,8);assert.match(result.comparison.cutoffWarning,/5[–-]8/);
 const last=result.comparison.bands.at(-1);assert.deepEqual([last.firstPlace,last.lastPlace,last.people],[5,8,4]);assert.equal(last.bandTotalMinor,last.people*last.perPersonMinor);
});

test('source comparison discrepancy and whole-band warnings remain visible',()=>{
 const result=forecast(input(40,{settings:{method:'custom_top_paid',paidPlaces:6,factor:'1.5'}}));assert.equal(result.status,'forecast');assert.equal(result.comparison.discrepancyMinor,1000);assert.notEqual(result.comparison.balanceWarning,null);assert.notEqual(result.comparison.cutoffWarning,null);
 assert.equal(result.comparison.qualificationChanged,false);assert.equal(result.comparison.bands.filter(b=>b.firstPlace===5&&b.lastPlace===8).length,1);
});

test('unsupported sources, official counts, ratio policy, and unsafe inputs fail closed',()=>{
 for(const value of[null,{},input(0),input(-1),input(12,{fundMinor:-1}),input(12,{policy:'consy-lite-inferred'}),input(12,{eventStyle:'Consy Lite'}),input(12,{eventFormat:'doubles'}),input(12,{eventKind:'satellite'}),input(12,{officialQualifierCount:3}),{...input(12),stale:true}])assert.equal(forecast(value).status,'blocked');
 assert.equal(forecast(input(12,{settings:{method:'custom_paid_ratio',ratio:4,factor:'1.5'}})).code,'custom_ratio_paid_count_policy_unresolved');
 assert.equal(forecast(input(12,{fundMinor:Number.MAX_SAFE_INTEGER})).code,'technical_resource_bound');
});
