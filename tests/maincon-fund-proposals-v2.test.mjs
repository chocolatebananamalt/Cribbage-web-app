import test from'node:test';import assert from'node:assert/strict';import{calculateMainConFundProposalsV2 as calculate,isMainConFundProposalExtensionV2 as extension}from'../src/lib/results/maincon-fund-proposals-v2.ts';
const id=n=>`a2990000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const source={tournamentId:id(1),eventId:id(2),settingsSnapshotId:id(3),ledgerDigest:'a'.repeat(64),resultsDigest:'b'.repeat(64)},input={fundMinor:180000,qualifierCount:10,settings:{method:'custom_top_paid',paidPlaces:6,factor:'1.5'}},current={source,input};
const proposal=(overrideHistory=[])=>structuredClone({source,input,overrideHistory});const row=(n,firstPlace,lastPlace,perPersonMinor,changes={})=>({recordId:id(100+n),firstPlace,lastPlace,priorRecordId:null,perPersonMinor,voided:false,reason:'Explicit fictional proposal',...changes});
test('source discrepancy and whole-band cutoff warning remain independently visible',()=>{
 const p=proposal(),before=JSON.stringify(p),r=calculate(p,current);assert.equal(r.status,'proposal_review');assert.equal(r.sourceCalculation.roundedAwardsTotalMinor,181000);assert.equal(r.proposedTotalMinor,181000);assert.equal(r.requestedPaidPlaces,6);assert.equal(r.actualPaidPlaces,8);assert.ok(r.cutoffWarning);assert.equal(r.discrepancyMinor,1000);assert.equal(r.balanced,false);assert.equal(JSON.stringify(p),before);for(const key of['authoritative','finalizationAllowed','paymentAuthorized','moneyMoved','writeAuthorized'])assert.equal(r[key],false);
});
test('explicit whole-band140/champion490 proposals conserve1800 without automatic adjustment',()=>{
 const p=proposal([row(1,5,8,14000),row(2,1,1,49000)]),r=calculate(p,current);assert.deepEqual(r.proposedBands.map(b=>b.perPersonMinor),[49000,32000,21500,14000]);assert.equal(r.proposedTotalMinor,180000);assert.equal(r.balanced,true);assert.equal(r.rankOrderViolation,false);assert.equal(r.zeroAwardBand,false);assert.ok(r.cutoffWarning);assert.equal(r.sourceCalculation.roundedAwardsTotalMinor,181000);assert.equal(calculate(proposal([row(1,5,8,14000)]),current).balanced,false);
});
test('full source, settings, fund and results changes block without rebasing retained user amounts',()=>{
 const p=proposal([row(1,1,1,49000)]),before=JSON.stringify(p);
 for(const key of Object.keys(source)){const next=structuredClone(current);next.source[key]=key.endsWith('Digest')?'c'.repeat(64):id(99);assert.equal(calculate(p,next).code,'stale_source_or_fund');}
 for(const edit of [v=>v.input.fundMinor++,v=>v.input.qualifierCount++,v=>v.input.settings.factor='2',v=>v.input.settings.paidPlaces=8]){const next=structuredClone(current);edit(next);assert.equal(calculate(p,next).code,'stale_source_or_fund');}assert.equal(JSON.stringify(p),before);
});
test('only exact full finishing bands and whole5dollar per-person values accepted',()=>{
 for(const record of[row(1,5,6,14000),row(1,3,3,21500),row(1,9,10,1000),row(1,1,1,49001),row(1,1,1,-500),row(1,1,1,500,{reason:'\t\n'}),row(1,1,1,500,{reason:'😀'.repeat(1001)})])assert.equal(calculate(proposal([record]),current).status,'blocked');
});
test('append correction/void/reopen lineage preserves historical values and resets void to SOURCE amount',()=>{
 const first=row(1,5,8,14000),correction=row(2,5,8,13500,{priorRecordId:first.recordId}),voided=row(3,5,8,13500,{priorRecordId:correction.recordId,voided:true}),reopen=row(4,5,8,14000,{priorRecordId:voided.recordId});
 assert.equal(calculate(proposal([first,correction]),current).proposedBands[3].perPersonMinor,13500);const r=calculate(proposal([first,correction,voided]),current);assert.equal(r.proposedBands[3].perPersonMinor,r.proposedBands[3].sourcePerPersonMinor);assert.equal(r.proposedBands[3].overrideVoided,true);assert.equal(calculate(proposal([first,correction,voided,reopen]),current).proposedBands[3].perPersonMinor,14000);assert.equal(first.perPersonMinor,14000);
 for(const history of[[correction],[{...first,voided:true}],[first,first],[first,{...correction,priorRecordId:id(99)}],[first,correction,{...voided,priorRecordId:first.recordId}],[first,row(5,1,1,49000,{priorRecordId:first.recordId})]])assert.equal(calculate(proposal(history),current).code,'invalid_override_lineage');
 assert.equal(extension(proposal([first]),proposal([first,correction]),current),true);assert.equal(extension(proposal([first]),proposal([{...first,perPersonMinor:13500}]),current),false);assert.equal(extension(proposal([first]),proposal([]),current),false);
});
test('balance, ranking, zero awards and cutoff warning are independent, never silently repaired',()=>{
 const r=calculate(proposal([row(1,1,1,0),row(2,5,8,30000)]),current);assert.equal(r.rankOrderViolation,true);assert.equal(r.zeroAwardBand,true);assert.equal(r.balanced,false);assert.ok(r.cutoffWarning);assert.deepEqual(r.issues.map(i=>i.code),['unbalanced','rank_order_violation','zero_award_band']);
 assert.equal(r.positiveAwardPlaces,7);assert.equal(r.actualPaidPlaces,8);assert.equal(r.requestedPaidPlaces,6);
 const zeroBand=calculate(proposal([row(3,5,8,0)]),current);assert.equal(zeroBand.positiveAwardPlaces,4);assert.equal(zeroBand.actualPaidPlaces,8);assert.equal(zeroBand.zeroAwardBand,true);assert.equal(zeroBand.moneyMoved,false);
 const unsafe=calculate(proposal([row(3,5,8,9007199254740500)]),current);assert.equal(unsafe.code,'unsafe_total');
});
test('technical history bounds and strict shapes do not imply a business correction cap',()=>{
 const p=proposal();p.overrideHistory=Array.from({length:10001},()=>row(1,1,1,500));assert.equal(calculate(p,current).code,'technical_history_bound');assert.equal(calculate({...proposal(),paid:true},current).code,'invalid_input');
});
