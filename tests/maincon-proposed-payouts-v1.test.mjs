import test from 'node:test';import assert from 'node:assert/strict';
import {previewMainConProposedPayoutsV1}from'../src/lib/results/maincon-proposed-payouts-v1.ts';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function input(){const currentSource={tournamentId:id(1),eventId:id(2),sourceDigest:'a'.repeat(64),input:{entryCount:40,entryFeeMinor:5000,benefitsMinor:12000,expensesMinor:10000,additionalIncomeMinor:2000,qualifierCount:10,settings:{method:'graduated_all_qualifiers',factor:'1.5'}}};return{currentSource,retainedSource:structuredClone(currentSource),adjustments:[]};}
const adjustment=(firstPlace,lastPlace,perPersonMinor,reason='TEST ONLY balance proposed awards')=>({firstPlace,lastPlace,perPersonMinor,reason});
test('worksheet over-allocation remains visible; a reasoned whole-band change balances proposal only',()=>{
 const i=input(),before=JSON.stringify(i),raw=previewMainConProposedPayoutsV1(i);assert.equal(raw.status,'proposed_payouts');assert.equal(raw.fundMinor,180000);assert.equal(raw.proposedTotalMinor,180500);assert.equal(raw.discrepancyMinor,500);assert.deepEqual(raw.issues,['unbalanced_fund']);assert.equal(raw.qualifierCount,10);assert.equal(JSON.stringify(i),before);
 i.adjustments=[adjustment(1,1,43000)];const proposalInputBefore=JSON.stringify(i),proposed=previewMainConProposedPayoutsV1(i);assert.equal(proposed.status,'proposed_payouts');assert.equal(proposed.proposedTotalMinor,180000);assert.equal(proposed.balanced,true);assert.deepEqual(proposed.issues,[]);assert.equal(proposed.paidPlaces,10);assert.equal(proposed.changedFromSource,true);assert.equal(proposed.bands[0].reason,i.adjustments[0].reason);
 for(const field of['authoritative','finalizationAllowed','paymentsRecorded','moneyMoved'])assert.equal(proposed[field],false);assert.equal(proposed.reviewRequired,true);assert.equal(JSON.stringify(i),proposalInputBefore);
});
test('equal finishing bands cannot be split or duplicated; adjustment reasons and denomination are required',()=>{
 for(const adjustments of[[adjustment(3,3,19500)],[adjustment(3,4,19000),adjustment(3,4,18500)],[adjustment(1,1,43001)],[adjustment(1,1,43000,' ')],[adjustment(1,1,43000,'unsafe\nreason')]]){const i=input();i.adjustments=adjustments;assert.deepEqual(previewMainConProposedPayoutsV1(i),{status:'blocked',code:'invalid_adjustment'});}
});
test('balance alone cannot hide reversed ranking or zero-paid configured places',()=>{
 const i=input();i.adjustments=[adjustment(1,1,29000),adjustment(2,2,43000)];const r=previewMainConProposedPayoutsV1(i);assert.equal(r.status,'proposed_payouts');assert.equal(r.balanced,true);assert.ok(r.issues.includes('rank_order_violation'));assert.equal(r.finalizationAllowed,false);
 const zero=input();zero.adjustments=[adjustment(1,1,0)];const z=previewMainConProposedPayoutsV1(zero);assert.equal(z.status,'proposed_payouts');assert.ok(z.issues.includes('zero_paid_band'));assert.equal(z.paidPlaces,9);assert.equal(z.qualifierCount,10);
});
test('changed financial basis or event/source invalidates retained adjustments even with identical net fund',()=>{
 for(const change of[i=>i.currentSource.sourceDigest='b'.repeat(64),i=>i.currentSource.eventId=id(9),i=>{i.currentSource.input.expensesMinor+=500;i.currentSource.input.additionalIncomeMinor+=500;}]){const i=input();change(i);assert.deepEqual(previewMainConProposedPayoutsV1(i),{status:'blocked',code:'source_changed'});}
 const cyclic=input();cyclic.retainedSource.input=cyclic.retainedSource;assert.equal(previewMainConProposedPayoutsV1(cyclic).status,'blocked');
});
