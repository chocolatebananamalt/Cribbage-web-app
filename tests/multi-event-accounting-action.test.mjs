import test from 'node:test';
import assert from 'node:assert/strict';
import {isAccountingAction as valid,acceptedAccountingAction as accepted} from '../src/lib/api/multi-event-accounting-action.ts';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`, hash='a'.repeat(64),tid=id(1),eid=id(2),base={sourceDigest:hash,reason:'TEST ONLY SYNTHETIC: local fixture',reviewed:true};
test('accounting actions pin exact reviewed simulated source and scope',()=>{
 const cross={action:'crosscheck',eventId:eid,operationId:id(3),request:base};
 const draft={...cross,action:'draft',request:{...base,expectedVersion:0}};
 const final={action:'finalize',operationId:id(4),request:{jointDigest:hash,reason:base.reason,reviewed:true}};
 for(const value of [cross,draft,final]) assert.equal(valid(value),true);
 for(const value of [{...cross,actorId:id(5)},{...cross,request:{...base,humanReviewClaimed:true}},{...cross,request:{...base,reason:'observed cash'}},{...draft,request:{...draft.request,expectedVersion:-1}},{...final,eventId:eid}]) assert.equal(valid(value),false);
 const response={status:'synthetic_event_crosscheck_closed',eventId:eid,closureId:id(6),sourceDigest:hash,reviewerProfileIds:[id(7)],humanReviewClaimed:false,physicalPlayClaimed:false,moneyMoved:false};
 assert.equal(accepted(response,cross,tid),true);
 for(const value of [{...response,eventId:id(9)},{...response,humanReviewClaimed:true},{...response,reviewerProfileIds:[]},{...response,sourceDigest:'b'.repeat(64)},{...response,moneyMoved:true}]) assert.equal(accepted(value,cross,tid),false);
 assert.equal(accepted({status:'synthetic_unpaid_draft_saved',eventId:eid,draftId:id(8),version:1,sourceDigest:hash,moneyMoved:false,financialFinalized:false},draft,tid),true);
 assert.equal(accepted({status:'synthetic_joint_unpaid_finalized',tournamentId:tid,jointFinalId:id(9),jointDigest:hash,eventCount:2,moneyMoved:false,humanReviewClaimed:false,recordedAt:'2026-11-03T01:00:00Z'},final,tid),true);
});
