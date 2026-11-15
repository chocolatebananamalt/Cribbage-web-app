import test from "node:test";
import assert from "node:assert/strict";
import { isSimulatedFinanceSelector as valid, projectSimulatedFinanceSelector as project } from "../src/lib/api/simulated-finance-selector.ts";
const t="10000000-0000-0000-0000-000000000001", e="10000000-0000-0000-0000-000000000002", p="10000000-0000-0000-0000-000000000003";
const id=n=>`10000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
const source={status:"available",tournamentId:t,eventId:e,moneyMoved:false,humanConsentClaimed:false,accountingAvailable:false,sourceDigest:"a".repeat(64),blockers:[],expenseEvidence:[]};
const base={status:"available",tournamentId:t,eventId:e,eventName:"Main",baseFeeMinor:5000,financialClosed:false,eventStarted:false,anyReceiptRecorded:false,expenseReviewVersion:0,sanctioningAssessmentMinor:null,writerRoleRequired:"director",moneyMoved:false,humanConsentClaimed:false,accountingAvailable:false,sources:source,pools:[{kind:"q",slot:1,name:"Q Pool 1",definitionId:p,type:"Graduated (1-in-4)",feeMinor:1000,policyId:null,policyMethod:null,policyRatio:null}],participants:[{participantId:p,rosterEntryId:t,name:"Fictional Player",status:"registered",receiptRecorded:false,elections:[]}]};
test("current bounded selector accepts named options and a clearly blocked fixture",()=>{
 assert.equal(valid(base,t,e),true);assert.equal(valid({status:"blocked",code:"owner_enrollment_required"},t,e),true);
});
test("policy and election bindings use exact types and only validated fields are exposed",()=>{
 const policy={...base.pools[0],policyId:id(4),policyMethod:"graduated-acc-weighted-largest-remainder-5usd-v2",policyRatio:4};
 const participant={...base.participants[0],elections:[{policyId:id(4),electionId:id(5),version:1,elected:true}]};
 const good={...base,pools:[policy],participants:[participant],sources:{...source,unvalidated:"not returned"}};
 assert.equal(valid(good,t,e),true);assert.equal(project(good).sources.unvalidated,undefined);
 assert.equal(valid({...good,pools:[{...policy,policyRatio:"4"}]},t,e),false);
 assert.equal(valid({...good,pools:[{...policy,policyId:null}]},t,e),false);
 assert.equal(valid({...good,participants:[{...participant,elections:[{...participant.elections[0],policyId:id(8)}]}]},t,e),false);
 assert.equal(valid({...good,participants:[participant,participant]},t,e),false);
});
test("cross-event, partial, duplicate and false-authority selectors are rejected",()=>{
 assert.equal(valid({...base,eventId:p},t,e),false);
 assert.equal(valid({...base,sources:{...source,eventId:p}},t,e),false);
 assert.equal(valid({...base,pools:[base.pools[0],base.pools[0]]},t,e),false);
 assert.equal(valid({...base,moneyMoved:true},t,e),false);
 assert.equal(valid({...base,participants:[{...base.participants[0],name:""}]},t,e),false);
 assert.equal(valid({...base,sources:{...source,sourceDigest:"bad"}},t,e),false);
});
