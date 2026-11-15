import test from 'node:test';import assert from 'node:assert/strict';
import {calculateEventRegularFinanceV1 as calculate}from'../src/lib/results/event-regular-finance-v1.ts';
const id=n=>`b2960000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const source={tournamentId:id(1),eventId:id(2),sourceVersion:3,sourceDigest:'a'.repeat(64)};
const line=(n,category,amountMinor,changes={})=>({recordId:id(100+n),lineId:id(200+n),priorRecordId:null,source:{...source},mode:'simulation',category,amountMinor,voided:false,reason:'',...changes});
const input=(history=[],changes={})=>({source:{...source},mode:'simulation',grossEntry:{source:{...source},mode:'simulation',amountMinor:48000},history,...changes});
test('explicit source gross less benefits/expenses plus unrestricted income; Q/Side excluded',()=>{
 const v=input([line(1,'player_benefit',14400),line(2,'operating_expense',7200),line(3,'unrestricted_income',2000),line(4,'q_pool_fund',30000),line(5,'side_pool_fund',10000)]),before=JSON.stringify(v),r=calculate(v);
 assert.equal(r.status,'calculated');assert.equal(r.regularFundMinor,28400);assert.equal(r.grossEntryMinor,48000);assert.equal(r.benefitsMinor,14400);assert.equal(r.expensesMinor,7200);assert.equal(r.additionalIncomeMinor,2000);assert.equal(r.excludedQMinor,30000);assert.equal(r.excludedSideMinor,10000);assert.equal(r.moneyMoved,false);assert.equal(r.finalizationAuthorized,false);assert.equal(r.proposalOnly,true);assert.equal(JSON.stringify(v),before);
 assert.equal(calculate({...v,entryCount:16,entryFeeMinor:3000}).code,'invalid_input');
});
test('append-only correction and void replace active value without mutating original audit entries',()=>{
 const first=line(1,'operating_expense',5000),corrected={...first,recordId:id(301),priorRecordId:first.recordId,amountMinor:4000,reason:'Corrected fictional receipt'},voided={...corrected,recordId:id(302),priorRecordId:corrected.recordId,amountMinor:0,voided:true,reason:'Duplicate receipt voided'};
 assert.equal(calculate(input([first,corrected])).expensesMinor,4000);const r=calculate(input([first,corrected,voided]));assert.equal(r.regularFundMinor,48000);assert.equal(r.historyRecordCount,3);assert.equal(r.activeLineCount,0);assert.equal(r.lines[0].voided,true);assert.equal(first.amountMinor,5000);
 for(const history of [[corrected],[first,first],[first,{...corrected,priorRecordId:id(999)}],[first,{...corrected,reason:' '}],[first,{...corrected,lineId:id(999)}],[first,{...voided,priorRecordId:first.recordId,amountMinor:1}],[first,corrected,{...voided,priorRecordId:first.recordId}]])assert.equal(calculate(input(history)).code,'invalid_lineage');
});
test('source and mode mixing fail closed for gross and each line; all three modes remain distinct',()=>{
 for(const mode of ['estimate','documented_actual','simulation']){const v=input([line(1,'operating_expense',1000,{mode})],{mode,grossEntry:{source:{...source},mode,amountMinor:12345}});assert.equal(calculate(v).mode,mode);assert.equal(calculate(v).grossEntryMinor,12345);}
 for(const field of ['tournamentId','eventId','sourceVersion','sourceDigest']){const changed={...source,[field]:field==='sourceVersion'?4:field==='sourceDigest'?'b'.repeat(64):id(999)};assert.equal(calculate(input([line(1,'operating_expense',500,{source:changed})])).code,'source_mismatch');assert.equal(calculate(input([],{grossEntry:{source:changed,mode:'simulation',amountMinor:48000}})).code,'source_mismatch');}
 assert.equal(calculate(input([line(1,'operating_expense',500,{mode:'estimate'})])).code,'mixed_modes');assert.equal(calculate(input([],{grossEntry:{source,mode:'documented_actual',amountMinor:48000}})).code,'mixed_modes');
});
test('restricted and unclassified income block until an explicit reasoned correction or void resolves it',()=>{
 for(const category of ['restricted_income','unclassified_income']){const first=line(1,category,500);assert.equal(calculate(input([first])).code,'income_requires_review');const correction={...first,recordId:id(400),priorRecordId:first.recordId,category:'unrestricted_income',reason:'Explicit classification review'};assert.equal(calculate(input([first,correction])).additionalIncomeMinor,500);assert.equal(calculate(input([first,{...correction,voided:true,amountMinor:0,reason:'Voided source'}])).additionalIncomeMinor,0);}
});
test('exact safe cents, negatives and technical batch limits do not create business category caps',()=>{
 const many=Array.from({length:10000},(_,i)=>line(i+1,'operating_expense',1));const r=calculate(input(many));assert.equal(r.status,'calculated');assert.equal(r.expensesMinor,10000);assert.equal(calculate(input([...many,line(20000,'operating_expense',1)])).code,'technical_batch_bound');
 assert.equal(calculate(input([line(1,'operating_expense',48001)])).code,'negative_regular_fund');assert.equal(calculate(input([line(1,'unrestricted_income',Number.MAX_SAFE_INTEGER)])).code,'unsafe_total');
 for(const amountMinor of [-1,0.1,NaN,Infinity,'100',-0])assert.equal(calculate(input([line(1,'operating_expense',amountMinor)])).code,'invalid_input');
 const zero=calculate(input([],{grossEntry:{source,mode:'simulation',amountMinor:0}}));assert.equal(zero.regularFundMinor,0);assert.equal(zero.activeLineCount,0);
});
test('funding buckets cannot change through correction, void or reopening even with a reason',()=>{
 const buckets=['operating_expense','q_pool_fund','side_pool_fund'];
 for(const category of buckets)for(const target of buckets){
  const first=line(1,category,500),changed={...first,recordId:id(500),priorRecordId:first.recordId,category:target,amountMinor:1000,reason:'Recorded correction'};
  const expected=category===target?'calculated':'blocked';assert.equal(calculate(input([first,changed])).status,expected);
  const voided={...changed,voided:true,amountMinor:0,reason:'Recorded void'};assert.equal(calculate(input([first,voided])).status,expected);
  const sameVoid={...first,recordId:id(501),priorRecordId:first.recordId,voided:true,amountMinor:0,reason:'Same-bucket void'},reopened={...changed,recordId:id(502),priorRecordId:sameVoid.recordId,reason:'Recorded reopen'};assert.equal(calculate(input([first,sameVoid,reopened])).status,expected);
 }
 for(const category of ['q_pool_fund','side_pool_fund'])for(const target of ['player_benefit','operating_expense','unrestricted_income','restricted_income','unclassified_income']){
  const first=line(1,category,500);assert.equal(calculate(input([first,{...first,recordId:id(503),priorRecordId:first.recordId,category:target,reason:'Cannot authorize transfer'}])).code,'invalid_lineage');
  const regular=line(1,target,500);assert.equal(calculate(input([regular,{...regular,recordId:id(504),priorRecordId:regular.recordId,category,reason:'Cannot authorize transfer'}])).code,'invalid_lineage');
 }
 const expense=line(1,'operating_expense',500),benefit={...expense,recordId:id(505),priorRecordId:expense.recordId,category:'player_benefit',reason:'Regular classification review'};assert.equal(calculate(input([expense,benefit])).benefitsMinor,500);
});
