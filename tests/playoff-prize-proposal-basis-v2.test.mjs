import assert from 'node:assert/strict';import test from 'node:test';
import {buildPlayoffPrizeProposalBasisV2 as build} from '../src/lib/finance/playoff-prize-proposal-basis-v2.ts';
import {playoffPrizeBasisFixtureV2 as fixture} from './fixtures/playoff-prize-basis-v2.mjs';
const id=n=>`91000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('saved V2 policy uses isolated regular fund and actual finalized qualifying count',()=>{
 const v=fixture(),before=structuredClone(v),r=build(v);assert.equal(r.status,'proposal_basis');assert.equal(r.input.fundMinor,180000);assert.equal(r.input.field.qualifierCount,10);assert.equal(r.input.field.firstRoundLoserPlaces,null);assert.equal(r.input.field.entryFeeMinor,null);assert.equal(r.comparison.roundedAwardsTotalMinor,180500);assert.equal(r.comparison.discrepancyMinor,500);assert.equal(r.ledgerMode,'simulation');assert.equal(r.recipientAssignmentAllowed,false);assert.equal(r.financialFinalizationAllowed,false);assert.deepEqual(v,before);
});
test('immutable binding and current prize/allocation/qualification pointers reject drift',()=>{
 for(const change of[v=>v.binding.eventKind='consolation',v=>v.binding.eventId=id(90),v=>v.binding.settingsDigest='f'.repeat(64),v=>v.prizeSource.currentPrizeDigest='e'.repeat(64),v=>v.prizeSource.currentPrizeSnapshotId=id(90),v=>v.ledger.currentAllocationRevisionId=id(90),v=>v.qualification.currentResultVersionId=id(90),v=>v.qualification.result.qualifierCount=9,v=>v.fundMinor=1]){const v=fixture();change(v);assert.equal(build(v).status,'blocked');}
});
test('unreviewed or changed ledger, legacy prize and unsupported paid count never fall back',()=>{
 for(const change of[v=>v.ledger.current.sources[1].allocations[0].classificationReviewed=false,v=>v.ledger.current.sourceVersion=4,v=>v.prizeSource.snapshot.plans[0]={eventClientRowId:id(3),eventKind:'main',mode:'legacy_checks_required'},v=>v.prizeSource.snapshot.plans[0].draft.recipients='top-16']){const v=fixture();change(v);assert.equal(build(v).status,'blocked');}
});
test('new source digest changes after ledger correction; regular method ignores Q/Side rounding',()=>{
 const v=fixture(),a=build(v);v.prizeSource.snapshot.plans[0].draft.rounding.qPool='1';v.prizeSource.snapshot.plans[0].draft.rounding.sidePool='10';assert.deepEqual(build(v).comparison,a.comparison);
 v.ledger.current.sources[1].amountMinor=21000;v.ledger.current.sources[1].allocations[0].amountMinor=21000;v.ledger.current.sourceVersion=4;v.ledger.current.sourceDigest='d'.repeat(64);v.ledger.retained=structuredClone(v.ledger.current);const b=build(v);assert.equal(b.status,'proposal_basis');assert.equal(b.input.fundMinor,179000);assert.notEqual(b.source.ledgerDigest,a.source.ledgerDigest);assert.equal(b.source.resultsDigest,a.source.resultsDigest);
});
