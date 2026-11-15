// Independent TypeScript-side reconstruction of actual local SQL source/request
// artifacts. This does not recreate a database or establish a bank/payment fact.
import fs from'node:fs/promises';import path from'node:path';import assert from'node:assert/strict';
import{readOperationalFinanceSourceAdoptionWorkspaceV1}from'../src/lib/api/operational-finance-source-adoption-v1.ts';
import{planNativeCostAdoptionV1,buildNativeCostAdoptionRequestV1}from'../src/lib/finance/native-cost-adoption-plan-v1.ts';
const dir=process.argv[2];if(!dir)throw Error('result_directory_required');
const read=async name=>JSON.parse((await fs.readFile(path.join(dir,name),'utf8')).replace(/^\uFEFF/,''));
const source=await read('operational-finance-source-adoption-workspace.json'),request=await read('operational-finance-source-adoption-request.json'),result=await read('operational-finance-source-adoption-result.json');
const scope={actorId:source.actorId,tournamentId:source.tournamentId,eventId:source.eventId},decoded=readOperationalFinanceSourceAdoptionWorkspaceV1(source,scope);assert.ok(decoded?.prepared,'actual source must independently reassemble');
const plan=planNativeCostAdoptionV1(decoded.prepared,request.dispositions);assert.equal(plan.status,'review_ready');
const rebuilt=buildNativeCostAdoptionRequestV1(plan,request.operationId,request.reason,request.editor);assert.ok(rebuilt);assert.deepEqual(rebuilt,request);
assert.equal(result.winnerStatus,'accepted');assert.equal(result.adoptionCount,1);assert.equal(result.loserStatus,'rejected');assert.equal(source.head.revisionId,request.expectedPriorRevisionId); const clarification=await read("operational-finance-source-adoption-artifact-clarification.json"); assert.ok(clarification);
const currentCost=source.costRows.reduce((sum,row)=>sum+row.currentBasisLines.reduce((n,line)=>n+BigInt(line.amountMinor),0n),0n),income=request.editor.history.slice(request.editor.basis.history.length),incomeHeads=new Map();
const priorIncome=source.head.editor.history.filter(r=>r.line.category==="unrestricted_income");assert.equal(income.length,priorIncome.length);for(let i=0;i<income.length;i++){const actual=structuredClone(income[i]),prior=structuredClone(priorIncome[i]);actual.line.source=prior.line.source;assert.deepEqual(actual,prior);}
for(const row of income){assert.equal(row.line.category,'unrestricted_income');incomeHeads.set(row.line.lineId,row.line);}
const incomeMinor=[...incomeHeads.values()].filter(row=>!row.voided).reduce((sum,row)=>sum+BigInt(row.amountMinor),0n),fund=BigInt(request.editor.basis.grossEntryMinor)-currentCost+incomeMinor;
assert.equal(Number(fund),plan.summary.newFundMinor);assert.equal(Number(currentCost),plan.summary.newCostsMinor);
const fee=source.sanctioning;assert.equal(fee.totalMinor,5400);assert.equal(fee.totalMinor,fee.rateMinor*fee.eligibleParticipantCount);assert.equal(source.costRows.filter(row=>row.currentBasisLines.some(line=>line.amountMinor===5400)).length,1);assert.equal(result.moneyMoved,false);
const receipt={status:'passed',scope:'actual-local-SQL-workspace-and-accepted-request-parity',priorRevisionId:request.expectedPriorRevisionId,originalSummaryInitialProposalRevisionId:result.priorRevisionId,adoptedRevisionId:result.adoptedRevisionId,adoptionId:result.adoptionId,recordedCostMinor:Number(currentCost),incomeMinor:Number(incomeMinor),proposedFundMinor:Number(fund),sanctioningMinor:fee.totalMinor,sanctioningCountedOnce:true,incomeCarryRows:income.length,originalIncomeIdsRetained:income.length>0,coffeeAlias:result.coffeeAlias,aliasSurvivedSameBasisSave:result.aliasSurvivedSameBasisSave,actualProviderVerified:false,bankReceiptVerified:false,moneyMoved:false};
await fs.writeFile(path.join(dir,'root-native-cost-adoption-parity.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
