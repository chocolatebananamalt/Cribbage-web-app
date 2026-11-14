// Pure read models only; these tests do not execute or certify the SQL producer.
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import {mainFourBoundCase}from'./helpers/main-four-bound-fixture.mjs';
import {readMainFourPlayoffBindingV1 as readBinding}from'../src/lib/results/main-four-playoff-binding-v1.ts';
import {projectExistingPlayoffReadModels as bracket,createExistingBracketReader}from'../src/lib/results/player-playoff-read-model.ts';
import {projectFinalRecipientEstimateV1 as recipients}from'../src/lib/finance/final-recipient-estimate-v1.ts';
import {reduceEventFinanceEditorV1}from'../src/lib/finance/event-finance-workspace-v1.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const display=c=>bracket(c.scope.tournamentId,c.scope.eventId,'main-v3',c.playoffModels);

test('Main4 maps only bound current source using the actual aggregate result plus three ordinals',()=>{
 const c=mainFourBoundCase(),before=structuredClone(c),r=display(c);assert.equal(r.status,'available');
 assert.equal(r.display.champion.participantId,id(1));assert.deepEqual(r.input.results.map(x=>x.sourceSeriesOrdinal),[1,2,3]);
 assert.ok(r.input.results.every(x=>x.resultId===c.playoffModels.playoff.result.resultId));
 assert.equal(new Set(r.input.results.map(x=>x.resultId)).size,1);assert.equal(r.publicAccessGranted,false);assert.equal(r.independentPlayEstablished,false);
 const raw=JSON.stringify(r);for(const key of['PRIVATE','receiptId','requestHash','evidenceNote','qualifyingMrp','receiptBinding','workspace'])assert.ok(!raw.includes(key),key);
 assert.deepEqual(c,before);
});

test('missing or contradictory binding never converts historical DTOs into a current result',()=>{
 const changes=[c=>delete c.playoffModels.mainFourBinding,c=>c.playoffModels.mainFourBinding=null,
  c=>c.playoffModels.mainFourBinding.resultHead.qualificationResultVersionId=id(999),c=>c.playoffModels.mainFourBinding.qualificationHead.resultVersionId=id(999),
  c=>c.playoffModels.mainFourBinding.qualificationHead.version=2,c=>c.playoffModels.mainFourBinding.resultHead.resultId=id(999),
  c=>c.playoffModels.mainFourBinding.resultHead.version=2,c=>c.playoffModels.mainFourBinding.eventId=id(999),
  c=>c.playoffModels.mainFourBinding.sourceDigest='x',c=>c.playoffModels.mainFourBinding.readOnly=false,
  c=>c.playoffModels.mainFourBinding.publicAccessGranted=true,c=>c.playoffModels.mainFourBinding.independentPlayEstablished=true,
  c=>c.playoffModels.mainFourBinding.receiptBinding.accepted=false,c=>c.playoffModels.mainFourBinding.receiptBinding.auditMatched=false,
  c=>c.playoffModels.mainFourBinding.receiptBinding.requestHash='x',c=>c.playoffModels.mainFourBinding.workspace.result.series[0].evidenceNote='Changed',
  c=>c.playoffModels.mainFourBinding.extra=true,c=>c.playoffModels.playoff.legacyConflict=true,
  c=>c.playoffModels.schedule.matches[0].state='submitted',c=>c.playoffModels.ties.finalized=false];
 for(const change of changes){const c=mainFourBoundCase();change(c);assert.equal(display(c).status,'blocked');assert.equal(recipients(c).status,'blocked');}
 const c=mainFourBoundCase();c.playoffModels.playoff.result.outcomes[2].bandEnd=3;c.playoffModels.mainFourBinding.workspace=structuredClone(c.playoffModels.playoff);assert.equal(display(c).status,'blocked');
});

test('four-player payout recipients retain equal third/fourth and expand a split paid-place group',()=>{
 const c=mainFourBoundCase(),r=recipients(c);assert.equal(r.status,'recipient_estimate');assert.equal(r.recipients.length,4);
 assert.deepEqual(r.groups.map(g=>[g.firstPlace,g.lastPlace,g.participantIds.length]),[[1,1,1],[2,2,1],[3,4,2]]);
 const thirds=r.recipients.filter(p=>p.firstPlace===3);assert.deepEqual(thirds.map(p=>p.participantId).sort(),[id(3),id(4)]);
 assert.equal(new Set(thirds.map(p=>p.amountMinor)).size,1);assert.equal(r.totalMinor,r.recipients.reduce((n,p)=>n+p.amountMinor,0));
 assert.equal(r.finalizationAuthorized,false);assert.equal(r.payoutAuthorized,false);assert.equal(r.moneyMoved,false);
 const w=c.nativeFinanceSource.basis.workspace;w.settings={method:'custom_top_paid',paidPlaces:3,factor:'1.5'};
 c.nativeFinanceSource.raw.settings.draft.payoutMode='top';c.nativeFinanceSource.raw.settings.draft.topText='3';c.proposal.editor.basis=structuredClone(w);
 const expanded=recipients(c);assert.equal(expanded.status,'recipient_estimate');assert.equal(expanded.requestedPaidPlaces,3);assert.equal(expanded.includedPaidPlaces,4);assert.ok(expanded.warnings.length>0);
});

test('whole-group manual corrections remain equal and preserve history, including an explicit zero',()=>{
 const c=mainFourBoundCase();let editor=c.proposal.editor,n=810;
 for(const action of[{type:'edit_band',firstPlace:3,lastPlace:4},{type:'band_field',field:'amount',value:'0.00'},{type:'band_field',field:'reason',value:'Fictional whole-band correction'},{type:'apply_band'}])editor=reduceEventFinanceEditorV1(editor,action,editor.basis,()=>id(n++));
 c.proposal.editor=editor;const before=structuredClone(editor),r=recipients(c);assert.equal(r.status,'recipient_estimate');
 assert.ok(r.recipients.filter(p=>p.firstPlace===3).every(p=>p.amountMinor===0));assert.equal(r.balanced,false);assert.ok(r.warnings.some(w=>w.includes('zero-dollar')));assert.deepEqual(c.proposal.editor,before);
});

test('changed reviewed results map changed winners without reusing source digests or fabricated IDs',()=>{
 const a=mainFourBoundCase(),b=mainFourBoundCase(4,2),ra=recipients(a),rb=recipients(b);
 assert.equal(ra.status,'recipient_estimate');assert.equal(rb.status,'recipient_estimate');assert.equal(rb.recipients.find(p=>p.firstPlace===1).participantId,id(4));
 assert.deepEqual(rb.recipients.filter(p=>p.firstPlace===3).map(p=>p.participantId).sort(),[id(1),id(2)]);
 assert.notEqual(ra.binding.playoffSourceDigest,rb.binding.playoffSourceDigest);assert.notEqual(ra.digest,rb.digest);
 const c=mainFourBoundCase();c.playoffModels.playoff.result.series[0].evidenceNote='SYNTHETIC example';c.playoffModels.mainFourBinding.workspace=structuredClone(c.playoffModels.playoff);
 assert.equal(display(c).origin,'synthetic-indicated');
});

test('private coordinator rejects role revocation and binding drift, retaining non-atomic observation limits',async()=>{
 const c=mainFourBoundCase();let reads=0;
 const reader=createExistingBracketReader({access:async()=>({actorId:c.scope.actorId,roles:['director']}),models:async()=>{const m=structuredClone(c.playoffModels);if(++reads===2)m.mainFourBinding.receiptBinding.requestHash='e'.repeat(64);return m;}});
 assert.equal((await reader(c.scope.tournamentId,c.scope.eventId,'main-v3')).status,'blocked');
 let access=0;reads=0;const revoked=createExistingBracketReader({access:async()=>++access===1?{actorId:c.scope.actorId,roles:['director']}:null,models:async()=>{reads++;return c.playoffModels;}});
 assert.equal((await revoked(c.scope.tournamentId,c.scope.eventId,'main-v3')).status,'blocked');assert.equal(reads,1);
 const r=readBinding(c.playoffModels.mainFourBinding,{tournamentId:c.scope.tournamentId,eventId:c.scope.eventId,qualificationResultVersionId:c.playoffModels.qualification.resultVersionId,qualificationVersion:1},c.playoffModels.playoff);assert.match(r.sourceDigest,/^[a-f0-9]{64}$/);
});

test('SQL candidate is default-off and private, with native row, derived outcome, receipt/hash and audit checks',()=>{
 const s=fs.readFileSync('database/proposals/main-four-playoff-binding-v1.sql','utf8');
 assert.match(s,/select false/);assert.match(s,/request\.jwt\.claim\.role/);assert.match(s,/role in\('director','co_director'\)/);
 assert.match(s,/derive_four_player_playoff_v3/);assert.match(s,/v\.version-1,v\.series/);assert.match(s,/playoff_outcomes_v3_recorded/);
 assert.ok(!/grant\s+execute|insert\s+into|update\s+app\.|delete\s+from/i.test(s));
 assert.match(s,/revoke all on function app\.get_main_four_playoff_binding_v1.*from public,anon,authenticated,service_role/);
});
