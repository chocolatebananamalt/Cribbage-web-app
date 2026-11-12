import test from "node:test";
import assert from "node:assert/strict";
import { buildSimulatedPoolReceipt as build } from "../src/lib/api/simulated-finance-receipt.ts";
import { isMultiEventSimulationAction as valid } from "../src/lib/api/multi-event-simulation-action.ts";
const id=n=>`10000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
const roster=id(1), why="TEST ONLY SYNTHETIC: planned fixture";
const make=(n,paid)=>({eventId:id(n),baseFeeMinor:n===2?5000:1000,financialClosed:false,eventStarted:false,pools:[{kind:"q",feeMinor:1000,policyId:id(n+10)}],participants:[{participantId:id(n+20),rosterEntryId:roster,receiptRecorded:false,elections:[{policyId:id(n+10),electionId:id(n+30),elected:paid}]}]});
test("one synthetic receipt conserves selected Main and Consolation amounts",()=>{
 const result=build([make(2,true),make(3,false)],roster,why);
 assert.equal(result.amountMinor,7000);assert.equal(result.events[0].q.length,1);assert.equal(result.events[1].q.length,0);
 assert.equal(valid({action:"receipt",operationId:id(90),request:result}),true);
});
test("missing disclosure/election, duplicate events or cross-player participation block receipt",()=>{
 const missing=make(2,true);missing.pools[0].policyId=null;
 assert.equal(build([missing],roster,why),null);
 const missingVote=make(2,true);missingVote.participants[0].elections=[];
 assert.equal(build([missingVote],roster,why),null);
 assert.equal(build([make(2,true),make(2,true)],roster,why),null);
 assert.equal(build([make(2,true)],id(88),why),null);
 const closed=make(2,true);closed.participants[0].receiptRecorded=true;assert.equal(build([closed],roster,why),null);
 assert.equal(build([{...make(2,true),eventStarted:true}],roster,why),null);
 assert.equal(build([{...make(2,true),financialClosed:true}],roster,why),null);
});
