import assert from "node:assert/strict";
import test from "node:test";
import { isPaybackReviewRequest, isPaybackReviewWorkspace, isPaybackReviewReconciliation, getPaybackReviewWorkspace, savePaybackReview, reconcilePaybackReview } from "../src/lib/api/payback-review.ts";
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const tid=id(20),eid=id(21),actor=id(22);
const request={draftId:id(10),draftVersion:1,expectedVersion:0,scheduleKind:"director_selected",amountBasis:"total_award",scheduleReference:"TEST ONLY explicitly selected schedule",sourceReference:"ACC Policy Manual chapter 6 III",
 eligibilityEvidence:[1,2,3,4].map(n=>({participantId:id(n),basis:"full_entry_cash_eligible",evidenceReference:"Explicit eligibility record "+n})),
 expenseClassifications:[{expenseEventId:id(5),category:"sanctioning",evidenceReference:"Recorded expense evidence"}]};
const workspace={tournamentId:tid,eventId:eid,required:true,currentReviewVersion:1,
 scope:{status:"supported",code:null,grossEntryIncomeMinor:48000,qualifiers:[1,2,3,4].map(n=>({participantId:id(n),displayName:"TEST ONLY "+n,bandStart:n<3?n:3,bandEnd:n<3?n:4})),expenses:[{expenseEventId:id(5),description:"Synthetic assessment",amountMinor:4800}]},
 review:{reviewId:id(11),current:true,version:1,draftId:id(10),draftVersion:1,request,totals:{grossEntryIncomeMinor:48000,benefitExpenseMinor:4800,operatingExpenseMinor:0,awardTotalMinor:43200,minimumParticipantReturnMinor:40800,participantReturnMinor:48000}}};
test("request codec rejects unknown policy, categories, zero versions, duplicates and hidden fields",()=>{
 assert.equal(isPaybackReviewRequest(request),true);
 for(const change of [{draftVersion:0},{draftVersion:2147483648},{expectedVersion:-1},{amountBasis:"incremental"},{amountBasis:undefined},{scheduleKind:"ACC_formula"},{idempotencyKey:id(1)},{sourceReference:" bad "},
 {eligibilityEvidence:[...request.eligibilityEvidence,request.eligibilityEvidence[0]]},
 {expenseClassifications:[{...request.expenseClassifications[0],category:"unknown"}]},
 {eligibilityEvidence:[{...request.eligibilityEvidence[0],basis:"age_exception"}]}]) assert.equal(isPaybackReviewRequest({...request,...change}),false,JSON.stringify(change));
});
test("workspace codec rejects cross-scope, inconsistent review bindings, unknown totals and malformed cohorts",()=>{
 assert.equal(isPaybackReviewWorkspace(workspace,tid,eid),true);
 assert.equal(isPaybackReviewWorkspace(workspace,tid,id(99)),false);
 for(const change of [{scope:{...workspace.scope,code:"unexpected"}},{scope:{...workspace.scope,qualifiers:[workspace.scope.qualifiers[0],workspace.scope.qualifiers[0]]}},
 {review:{...workspace.review,draftVersion:2}},{review:{...workspace.review,version:0}},
 {review:{...workspace.review,totals:{...workspace.review.totals,participantReturnMinor:47999}}},
 {review:{...workspace.review,totals:{...workspace.review.totals,minimumParticipantReturnMinor:40799}}}]) assert.equal(isPaybackReviewWorkspace({...workspace,...change},tid,eid),false,JSON.stringify(change));
});
test("oversized evidence is rejected before a client can retain an unsendable request",()=>{
 const oversized={...request,eligibilityEvidence:Array.from({length:256},(_,n)=>({participantId:id(n+500),basis:"full_entry_cash_eligible",evidenceReference:"x".repeat(500)}))};
 assert.equal(isPaybackReviewRequest(oversized),false);
});
test("reconciliation never treats an untrusted or cross-scope envelope as a conclusive receipt",()=>{
 const accepted={status:"payback_review_saved_v1",tournamentId:tid,eventId:eid,reviewId:id(11),version:1};
 assert.equal(isPaybackReviewReconciliation({authorized:true,result:accepted},tid,eid),true);
 assert.equal(isPaybackReviewReconciliation({authorized:true,result:null},tid,eid),true);
 for(const v of [{authorized:false,result:accepted},{authorized:true,result:{...accepted,eventId:id(99)}},{authorized:true,result:{status:"rejected",eventId:eid,code:"unknown"}},{authorized:true,result:accepted,extra:true}]) assert.equal(isPaybackReviewReconciliation(v,tid,eid),false);
});
test("RPC adapters retain explicit verified actor, scope and unchanged operation identity",async()=>{
 const calls=[];const rpc={rpc:async(name,args)=>{calls.push({name,args});return{data:name==="get_event_payback_workspace_v1"?workspace:null,error:null};}};
 assert.deepEqual(await getPaybackReviewWorkspace(rpc,actor,tid,eid),workspace);
 await savePaybackReview(rpc,actor,tid,eid,request,id(30));
 await reconcilePaybackReview(rpc,actor,tid,eid,id(30));
 assert.equal(calls[0].args.p_actor_id,actor);assert.equal(calls[1].args.p_request,request);
 assert.equal(calls[1].args.p_operation_id,calls[2].args.p_operation_id);
 assert.equal(calls[2].args.p_tournament_id,tid);
});
