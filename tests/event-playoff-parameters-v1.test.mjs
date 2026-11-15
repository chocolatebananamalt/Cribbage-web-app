import test from 'node:test';
import assert from 'node:assert/strict';
import { newEventPlayoffParametersDraftV1 as fresh, resolveEventPlayoffParametersDraftV1 as resolve, validIncrementFactorDraftV1 as factor } from '../src/lib/playoffs/event-playoff-parameters-v1.ts';
test('new event defaults differ by event without inventing persisted approval',()=>{
 for(const kind of ['main','consolation']){const d=fresh(kind),r=resolve(d);assert.equal(r.series.regular.winsRequired,kind==='main'?3:2);assert.deepEqual(r.series.regular,r.series.final);assert.equal(r.payout.factor,'1.5');assert.equal(r.persistenceAvailable,false);assert.equal(r.calculatedPayoutsAvailable,false);assert.equal(d.oneInText,'');assert.equal(d.topText,'');}
});
test('separate final draft is retained when same rounds is selected',()=>{
 const d=fresh('main');d.series.final={choice:'4-of-7',winsText:'',gamesText:''};const before=JSON.stringify(d);assert.equal(resolve(d).series.final.winsRequired,3);assert.equal(JSON.stringify(d),before);d.finalMode='separate';assert.equal(resolve(d).series.final.winsRequired,4);
});
test('inactive incomplete Custom Final is retained without blocking valid same-round settings',()=>{
 const d=fresh('main');d.series.final={choice:'custom',winsText:'',gamesText:''};d.finalMode='separate';assert.equal(resolve(d),null);d.finalMode='same';const before=JSON.stringify(d);assert.equal(resolve(d).series.final.winsRequired,3);assert.equal(JSON.stringify(d),before);d.finalMode='separate';assert.equal(resolve(d),null);assert.deepEqual(d.series.final,{choice:'custom',winsText:'',gamesText:''});
});
test('paid place settings retain factor and never compute qualification or payouts',()=>{
 const d=fresh('main');d.incrementFactorText='2.25';d.oneInText='7';d.topText='3';
 d.payoutMode='one-in';assert.deepEqual(resolve(d).payout,{method:'custom_paid_ratio',ratio:7,factor:'2.25'});
 d.payoutMode='top';assert.deepEqual(resolve(d).payout,{method:'custom_top_paid',paidPlaces:3,factor:'2.25'});
 d.payoutMode='graduated';assert.deepEqual(resolve(d).payout,{method:'graduated_all_qualifiers',factor:'2.25'});assert.equal(d.oneInText,'7');assert.equal(d.topText,'3');
});
test('invalid values and unknown metadata fail closed without coercion',()=>{
 for(const raw of ['', ' 1.5','1.5 ','0.9','1000.1','1e2','01.5','1.1234567',1.5,null])assert.equal(factor(raw),false);
 for(const raw of ['1','1.5','1000','1.123456'])assert.equal(factor(raw),true);
 const d=fresh('main');for(const raw of ['', '0','-1','1.5',' 7','2147483648'])assert.equal(resolve({...d,payoutMode:'one-in',oneInText:raw}),null);
 assert.equal(resolve({...d,extra:true}),null);assert.equal(resolve({...d,payoutMode:'other'}),null);assert.equal(resolve({...d,finalMode:'other'}),null);
});
