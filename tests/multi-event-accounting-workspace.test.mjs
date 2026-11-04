import test from 'node:test';import assert from 'node:assert/strict';
import {projectAccountingWorkspace as project,isAccountingWorkspace as valid} from '../src/lib/api/multi-event-accounting-workspace.ts';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,tid=id(1),eid=id(2),hash='a'.repeat(64);
const event={tournamentId:tid,eventId:eid,currentDraftVersion:0,draft:null,closure:null,readiness:{status:'candidate_ready',eventId:eid,sourceDigest:hash,moneyMoved:false,humanReviewClaimed:false,physicalPlayClaimed:false,crosscheckClosed:false}};
const joint={status:'blocked',code:'event_draft_required'},final={status:'not_finalized',tournamentId:tid,financialClosed:false,moneyMoved:false};
test('accounting workspace projects only scoped verified source pins, not raw evidence',()=>{
 const value=project(event,joint,final,tid,eid);assert.equal(valid(value,tid,eid),true);assert.equal(value.readiness.sourceDigest,hash);assert.equal('manifest' in value,false);
 for(const bad of [{...event,eventId:id(3)},{...event,currentDraftVersion:1},{...event,readiness:{...event.readiness,humanReviewClaimed:true}},{...event,closure:{id:id(4),sourceDigest:'bad'}}])assert.equal(project(bad,joint,final,tid,eid),null);
 assert.equal(project(event,{status:'unknown'},final,tid,eid),null);
 assert.equal(valid({...value,moneyMoved:true},tid,eid),false);assert.equal(valid({...value,readiness:{ready:true,sourceDigest:null,code:null}},tid,eid),false);
});
test('joint readiness and saved final are separate, scoped states',()=>{
 const preview=e=>({status:'preview',eventId:e,sourceDigest:hash,moneyMoved:false,accountingAvailable:false,baseIncomeMinor:10000,expenseMinor:0,qIncomeMinor:0,sideIncomeMinor:0,restrictedResidualMinor:0,requiredFundingMinor:0,regularAwards:[4000,3000,1500,1500].map((amountMinor,i)=>({participantId:id(20+i),amountMinor})),pools:[]});
 const manifest={tournamentId:tid,events:[eid,id(3)].map(eventId=>({eventId,sourceDigest:hash,preview:preview(eventId)})),moneyMoved:false,humanReviewClaimed:false},names={[eid]:'Main',[id(3)]:'Consolation'};
 const ready={status:'candidate_ready',tournamentId:tid,jointDigest:hash,manifest,moneyMoved:false,humanReviewClaimed:false};
 const saved={status:'synthetic_joint_unpaid_finalized',tournamentId:tid,jointFinalId:id(4),jointDigest:hash,manifest,financialClosed:true,moneyMoved:false,humanReviewClaimed:false,recordedAt:'2026-11-03T01:00:00Z'};
 assert.equal(project(event,ready,final,tid,eid,names)?.joint.ready,true);assert.equal(project(event,ready,final,tid,eid,names)?.final,null);
 const result=project(event,joint,saved,tid,eid,names);assert.equal(result?.final.id,id(4));assert.equal(valid(result,tid,eid),true);assert.equal(result.final.events[0].regularMinor,10000);
 assert.equal(project(event,joint,{...saved,financialClosed:false},tid,eid,names),null);
 assert.equal(project(event,{...ready,manifest:{...manifest,events:[manifest.events[0],manifest.events[0]]}},final,tid,eid,names),null);
 assert.equal(project(event,ready,final,tid,eid,{}),null);
 assert.equal(project(event,{...ready,manifest:{...manifest,events:[manifest.events[0]]}},final,tid,eid,names),null);
 assert.equal(project(event,{...ready,manifest:{...manifest,events:[{...manifest.events[0],preview:{...manifest.events[0].preview,baseIncomeMinor:20000}},manifest.events[1]]}},final,tid,eid,names),null);
});
