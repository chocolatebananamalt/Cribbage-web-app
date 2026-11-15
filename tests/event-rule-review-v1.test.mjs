import test from'node:test';import assert from'node:assert/strict';import{planEventRuleReviewV1 as plan,isEventRuleReviewExtensionV1 as extension}from'../src/lib/playoffs/event-rule-review-v1.ts';import{newEventPlayoffParametersDraftV1}from'../src/lib/playoffs/event-playoff-parameters-v1.ts';
const id=n=>`b3000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const source={tournamentId:id(1),setupRevisionId:id(2),settingsSnapshotId:id(3),eventClientRowId:id(4),setupEventVersionId:id(5),draftDigest:'a'.repeat(64)};
const current=(kind='main')=>({source:structuredClone(source),eventKind:kind,draft:newEventPlayoffParametersDraftV1(kind)});
const review=(changes={})=>({reviewId:id(10),priorReviewId:null,version:1,actorId:id(11),source:structuredClone(source),context:{sanctioned:true,durationDays:2,eventKind:'main',originalEntrants:null},reason:'Explicit director-declared context review',approvalReference:'',...changes});
test('setup review defers only actual original field count with source-bound durable requirement',()=>{
 const history=[review()],before=JSON.stringify(history),r=plan(history,current());assert.equal(r.status,'setup_review_plan');assert.equal(r.setupReviewEligible,true);assert.deepEqual(r.deferredRequirements.map(x=>[x.code,x.deadline,x.fulfilled,x.requiresNativeOriginalEntrants]),[['original_field_required','before_playoffs',false,true]]);assert.deepEqual(r.deferredRequirements[0].source,source);assert.equal(r.deferredRequirements[0].reviewId,id(10));assert.equal(JSON.stringify(history),before);assert.ok(Object.isFrozen(r.latestReview.context));
 for(const key of['activationAllowed','playStartAllowed','playoffStartAllowed','officialApprovalClaimed','externalApprovalVerified','durableReviewPersisted','moneyMoved'])assert.equal(r[key],false);
});
test('loaded event kind wins; setup count must remain null, never pasted or invented',()=>{
 assert.equal(plan([review()],current('consolation')).code,'event_kind_binding_changed');for(const originalEntrants of[0,16,257,'257'])assert.equal(plan([review({context:{...review().context,originalEntrants}})],current()).code,'invalid_review_history');const c=current('consolation'),r=review({context:{sanctioned:true,durationDays:2,eventKind:'consolation',originalEntrants:null}});assert.equal(plan([r],c).setupReviewEligible,true);
});
test('approval reference cannot waive RC approval or unsourced custom series',()=>{
 const c=current();c.draft.series.regular.choice='2-of-3';c.draft.series.final.choice='2-of-3';const r=review({context:{...review().context,durationDays:1},approvalReference:'Claimed RC approval in an email'});let result=plan([r],c);assert.equal(result.setupReviewEligible,false);assert.ok(result.assessment.issues.some(i=>i.severity==='rc_approval_required'));assert.equal(result.externalApprovalVerified,false);
 c.draft.series.regular={choice:'custom',winsText:'5',gamesText:'9'};result=plan([r],c);assert.equal(result.setupReviewEligible,false);assert.equal(result.officialApprovalClaimed,false);
});
test('all source pins stale independently; explicit appended re-review preserves original history',()=>{
 const first=review(),history=[first],before=JSON.stringify(history);for(const key of Object.keys(source)){const c=current();c.source[key]=key==='draftDigest'?'b'.repeat(64):id(99);assert.equal(plan(history,c).status,'blocked');}assert.equal(JSON.stringify(history),before);
 const c=current();c.source.settingsSnapshotId=id(33);c.source.setupEventVersionId=id(34);c.source.draftDigest='b'.repeat(64);const next={...structuredClone(first),reviewId:id(12),priorReviewId:first.reviewId,version:2,source:structuredClone(c.source),reason:'Explicit review of changed settings'};assert.equal(plan([first,next],c).status,'setup_review_plan');assert.equal(extension([first],[first,next],c),true);assert.equal(first.source.settingsSnapshotId,id(3));
});
test('append-only full canonical prefix rejects overwrites, truncation, branches, duplicate IDs and foreign ownership',()=>{
 const first=review(),second={...review(),reviewId:id(12),priorReviewId:first.reviewId,version:2,reason:'Context correction'};assert.equal(extension([first],[first,second],current()),true);assert.equal(extension([first,second],[first],current()),false);assert.equal(extension([first],[{...first,reason:'Overwritten'}],current()),false);
 for(const history of[[{...first,priorReviewId:id(99)}],[{...first,version:2}],[first,first],[first,{...second,version:3}],[first,{...second,priorReviewId:id(99)}],[{...first,source:{...source,tournamentId:id(99)}}],[{...first,context:{...first.context,sanctioned:'true'}}]])assert.equal(plan(history,current()).code,'invalid_review_history');
});
test('incomplete drafts and unsupported durations stay blocked/review-required; no hidden authority fields',()=>{
 const c=current();c.draft.payoutMode='top';assert.equal(plan([review()],c).code,'incomplete_settings');const result=plan([review({context:{...review().context,durationDays:3}})],current());assert.equal(result.status,'setup_review_plan');assert.equal(result.setupReviewEligible,false);assert.ok(result.assessment.issues.some(i=>i.code==='duration_not_covered'));
 assert.equal(plan([{...review(),approved:true}],current()).code,'invalid_review_history');assert.equal(plan([{...review(),reason:'\t\n\u00a0'}],current()).code,'invalid_review_history');const informal=review({context:{...review().context,sanctioned:false}});assert.equal(plan([informal],current()).assessment.status,'informal_settings');assert.equal(plan([informal],current()).activationAllowed,false);
});
test('review reason matches strict trim/control and UTF16 bounds; approval text stays metadata',()=>{
 for(const reason of[' leading','trailing ','\u00a0x','x\uFEFF','x\ny','x\u007fy','😀'.repeat(251)])assert.equal(plan([review({reason})],current()).code,'invalid_review_history');
 assert.equal(plan([review({reason:'😀'.repeat(250),approvalReference:'😀'.repeat(500)})],current()).status,'setup_review_plan');assert.equal(plan([review({approvalReference:'😀'.repeat(501)})],current()).code,'invalid_review_history');
});
