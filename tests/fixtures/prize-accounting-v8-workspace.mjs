import {workspace as legacy,tid,eid,actor,id,digest}from'./no-q-accounting-v7-workspace.mjs';
import {calculateRegularPrizeRoundingV3}from'../../src/lib/results/regular-prize-rounding-v3.ts';
export{tid,eid,actor,id,digest};
export function makePrizeAccountingV8Fixture({down=false}={}){
 const facts=structuredClone(legacy.facts),rule={...structuredClone(legacy.regularSchedule.rule),kind:'regular-prize-cohort-5usd-v3',roundingRule:'automatic-five-dollar-cohort-v3',sourceReference:'TEST ONLY standing whole-five-dollar regular awards'};
 facts.expenseEvidence[3].amountMinor=2550;
 if(down){facts.expenseEvidence[1].amountMinor=10500;facts.expenseEvidence[2].amountMinor=4800;}
 facts.expenseTotalMinor=22950;facts.regularAwardMinor=28050;facts.ledgerSnapshot.expenseTotalMinor=22950;
 const expenseClassifications=facts.expenseEvidence.map((e,i)=>({expenseEventId:e.expenseEventId,category:['sanctioning','meals','hall_rental','cards'][i],evidenceReference:'TEST ONLY '+e.description+' evidence'}));
 const request={expectedVersion:0,sourceDigest:digest,expenseClassifications,reason:'TEST ONLY standing rounding draft; all awards unpaid',reviewed:true};
 const rounding=calculateRegularPrizeRoundingV3({grossBaseIncomeMinor:51000,expenseTotalMinor:22950,benefitExpenseMinor:down?15600:15300,expectedQualifierCount:5,cohorts:rule.cohorts});if(rounding.status!=='calculated')throw Error('Fixture calculation failed');
 const workspace={tournamentId:tid,eventId:eid,sourceDigest:digest,blockers:[],currentDraftVersion:0,currentFinalVersion:0,regularRule:{scheduleVersionId:id(50),scheduleVersion:1,rule},qReview:null,facts,draft:null,funding:{version:0,requiredMinor:0,receivedMinor:0,shortfallMinor:0,unallocatedMinor:0,records:[]},finalization:null,automaticPayment:false};
 const withDraft={...workspace,currentDraftVersion:1,draft:{id:id(51),version:1,sourceDigest:digest,current:true,request,rounding,awards:facts.canonicalMrp.rows.map((r,i)=>({participantId:r.participantId,displayName:r.displayName,bandStart:r.bandStart,bandEnd:r.bandEnd,weight:[4,3,2,2,1][i],totalAwardMinor:rounding.awardsMinor[i]}))},funding:{...workspace.funding,requiredMinor:rounding.requiredFundingMinor,shortfallMinor:rounding.requiredFundingMinor}};
 const fundingRequest={expectedVersion:0,sourceDigest:digest,draftId:id(51),amountMinor:450,receivedAt:'2026-10-30T07:00:00.000Z',evidenceReference:'TEST ONLY fictional manual cover record',reason:'TEST ONLY received-cover evidence',reviewed:true};
 const funded=down?withDraft:{...withDraft,funding:{version:1,requiredMinor:450,receivedMinor:450,shortfallMinor:0,unallocatedMinor:0,records:[{id:id(60),version:1,eventType:'received',amountMinor:450,receivedAt:fundingRequest.receivedAt,evidenceReference:fundingRequest.evidenceReference,reason:fundingRequest.reason,voidsId:null,sourceDigest:digest,recordedAt:'2026-10-30T07:01:00.000Z'}]}};
 const finalRequest={expectedVersion:0,draftId:id(51),draftVersion:1,expectedFundingVersion:funded.funding.version,reason:'TEST ONLY final unpaid accounting',reviewed:true};
 const finalized={...funded,currentFinalVersion:1,finalization:{id:id(52),version:1,draftId:id(51),draftVersion:1,sourceDigest:digest,current:true,status:'unpaid',fundingVersion:funded.funding.version,restrictedBalanceMinor:rounding.restrictedBalanceMinor,fundingReceivedMinor:funded.funding.receivedMinor}};
 const voidRequest={expectedVersion:1,sourceDigest:digest,draftId:id(51),voidsId:id(60),reason:'TEST ONLY correction of erroneous record; no refund',reviewed:true};
 return{workspace,withDraft,funded,finalized,request,fundingRequest,voidRequest,finalRequest};
}
