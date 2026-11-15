import {verifyNativeOptionalIncomeUpgradeV3}from'./native-optional-income-upgrade-local-acceptance.mjs';
// Injected isolated test only. No database creation, provider session or money.
import assert from 'node:assert/strict';
import {verifyNativeOptionalFinanceCostReclassificationAdoptionV2}from'./native-optional-finance-source-adoption-v2-acceptance.mjs';
import {verifyNativeOptionalPlayoffsV2}from'./native-optional-playoff-local-acceptance.mjs';
import {verifyNativeOptionalProposalRaceV2}from'./native-optional-proposal-race-local-acceptance.mjs';
import {verifyNativeOptionalIncomeFinalizationV3}from'./native-optional-income-local-acceptance.mjs';
import {reduceEventFinanceEditorV1,projectEventFinanceSectionV1}from'../src/lib/finance/event-finance-workspace-v1.ts';
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const id=n=>`0d830000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export async function verifyNativeOptionalIncomeIntegrationV3({sql,q,read,withHeldLock,fixture,finance,checkpoint,writeEvidence,installIncome}){
 const adoption=await verifyNativeOptionalFinanceCostReclassificationAdoptionV2({sql,fixture,financeResult:finance,checkpoint});
 const basis=adoption.adopted.basis;let editor=reduceEventFinanceEditorV1(adoption.adopted,{type:'edit_band',firstPlace:3,lastPlace:4},basis,()=>id(1));
 editor=reduceEventFinanceEditorV1(editor,{type:'band_field',field:'reason',value:'TEST ONLY restore calculated equal-group amount for balanced proposal'},basis,()=>id(2));
 editor=reduceEventFinanceEditorV1(editor,{type:'restore_band'},basis,()=>id(3));
 const view=projectEventFinanceSectionV1(editor,basis);assert.equal(view.adjustedTotalMinor,43000);assert.equal(view.differenceMinor,0);
 const request={kind:'native-optional-finance-proposal-v2',expectedVersion:adoption.accepted.version,sourceDigest:adoption.accepted.sourceDigest,basisDigest:adoption.accepted.basisDigest,editor,reason:'TEST ONLY balanced proposal retains override correction history',reviewed:true};
 const enabled=query=>`set app.fixture_native_optional_finance='approved-local-only';${query}`;
 const saved=read(enabled(`set request.jwt.claim.role='service_role';select app.save_native_optional_finance_proposal_v2('${fixture.actor}','${fixture.tournamentId}','${fixture.eventId}','${id(4)}',${literal(request)});`));
 assert.equal(saved.status,'optional_finance_proposal_saved_v2',JSON.stringify(saved));
 checkpoint('balanced_proposal_after_adoption',{adoption,request,saved,view});
 let raceCounter=200;
 const race=await verifyNativeOptionalProposalRaceV2({q,read,withHeldLock,fixture,request:{...request,expectedVersion:saved.version,reason:'TEST ONLY concurrent native V2 proposal'},nextOperationId:()=>id(raceCounter++),checkpoint});
 let counter=20;
 const playoffs=await verifyNativeOptionalPlayoffsV2({q:(query,who,role)=>q(enabled(query),who,role),read:(query,who,role)=>read(enabled(query),who,role),actorId:fixture.actor,outsiderId:'a1310000-0000-4000-8000-000000000006',tournamentId:fixture.tournamentId,eventId:fixture.eventId,qualificationId:fixture.nativePlayoffSource.qualificationId,nextOperationId:()=>id(counter++),writeEvidence,onReady:async source=>{
  checkpoint('verified_playoff_source_v2',source);
  const calculate=(s,e,fund=43000)=>read(`select app.native_optional_regular_awards_v2(${literal(s)},${literal(e)},${fund===null?'null':fund});`);
  const balanced=calculate(source,editor);assert.equal(balanced.status,'calculated',JSON.stringify(balanced));assert.equal(balanced.totalMinor,43000);assert.equal(balanced.recipients.length,4);
  assert.deepEqual(balanced.groups.map(g=>g.perPersonMinor),[17000,11000,7500]);
  assert.equal(calculate(source,adoption.adopted).code,'recorded_fund_imbalance');
  for(const [s,e,fund]of[[null,editor,43000],[source,null,43000],[source,editor,null],[{...source,playoff:{...source.playoff,qualifierCount:null}},editor,43000],[source,{...editor,basis:{...editor.basis,settings:{...editor.basis.settings,factor:null}}},43000],[source,{...editor,basis:{...editor.basis,settings:{...editor.basis.settings,method:'custom_top_paid',paidPlaces:null}}},43000]])assert.equal(calculate(s,e,fund).status,'blocked');
  const invalidOverride=structuredClone(editor);invalidOverride.overrideHistory.push({firstPlace:3,lastPlace:4,voided:false,perPersonMinor:null});assert.equal(calculate(source,invalidOverride).code,'override_shape_invalid');
  const duplicate=structuredClone(source);duplicate.playoff.players[1]=structuredClone(duplicate.playoff.players[0]);assert.equal(calculate(duplicate,editor).code,'recipient_mapping_incomplete');
  const duplicateFinal=structuredClone(source);duplicateFinal.playoff.matches[0]=structuredClone(duplicateFinal.playoff.matches.at(-1));assert.equal(calculate(duplicateFinal,editor).code,'recipient_mapping_incomplete');
  checkpoint('regular_award_math_v2',{balanced,unbalancedBlocked:true,nullShapeBlocked:true,missingOverrideBlocked:true});
  const upgrade=verifyNativeOptionalIncomeUpgradeV3({q,read,fixture,install:installIncome,checkpoint});
  const final=await verifyNativeOptionalIncomeFinalizationV3({q,read,withHeldLock,fixture,checkpoint,source,editor});
  return{balanced,unbalancedBlocked:true,nullShapeBlocked:true,upgrade,final};
 }});
 return{adoption,race,balancedProposal:saved,playoffs,moneyMoved:false,providerVerified:false,finalizationSupported:false};
}
