import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {equalQMethodV2,graduatedQMethodV2,isQOperatingRequestV2,isQOperatingResultV2,isQOperatingWorkspaceV2,qOperatingResultMatchesV2} from '../src/lib/api/q-operating-schedules.ts';
import {sourceFixture,id} from './fixtures/q-policy-source.mjs';
const publish=()=>({action:'publish',poolVersionId:id(5),method:equalQMethodV2,ratio:null,scheduleId:null,disclosureReference:'TEST ONLY disclosed flyer',disclosed:true});
const cut=()=>({action:'cut',poolVersionId:id(5),expectedSourceDigest:'a'.repeat(64),participantIdsLowFirst:[id(100),id(101)],reason:'TEST ONLY observed physical low-card cut'});
function workspace(){const old=sourceFixture();return {tournamentId:old.tournamentId,membership:old.membership,canPublish:false,policies:[{id:id(6),poolVersionId:id(5),method:equalQMethodV2,ratio:null,scheduleId:null,disclosureReference:'TEST ONLY flyer',publishedAt:'2026-10-29T00:00:00Z'}],cards:old.membership.entries.map((e,i)=>({participantId:e.participantId,gamePoints:24-i*2,gamesWon:12-i,plusPoints:180-i*10,qualified:i<3,qualificationRank:i<3?i+1:null})),cuts:[],sourceDigest:'a'.repeat(64),blockers:[]};}
test('v2 publish explicitly chooses equal or graduated and rejects hybrid/extra/legacy policies',()=>{
 assert.ok(isQOperatingRequestV2(publish()));assert.ok(isQOperatingRequestV2({...publish(),method:graduatedQMethodV2,ratio:6,scheduleId:'friend-q-p2-10-6-v1'}));
 for(const change of [{method:'equal-paid-qualifiers-v1'},{ratio:6},{scheduleId:'friend-q-p2-10-6-v1'},{disclosed:false},{disclosureReference:'\n'},{extra:true},{method:graduatedQMethodV2,ratio:5,scheduleId:'anything'}])assert.equal(isQOperatingRequestV2({...publish(),...change}),false);
});
test('physical cut requires exact source-bound distinct identities and reason',()=>{
 assert.ok(isQOperatingRequestV2(cut()));
 for(const change of [{expectedSourceDigest:''},{reason:''},{participantIdsLowFirst:[id(100),id(100)]},{participantIdsLowFirst:[id(100)]},{participantIdsLowFirst:['name1','name2']},{recordedBy:id(999)}])assert.equal(isQOperatingRequestV2({...cut(),...change}),false);
});
test('v2 workspace exact fields reject duplicate identities, rank ambiguity and unknown cut members',()=>{
 const s=workspace();assert.ok(isQOperatingWorkspaceV2(s,id(1)));
 assert.equal(isQOperatingWorkspaceV2({...s,tournamentId:id(2)},id(1)),false);
 assert.equal(isQOperatingWorkspaceV2({...s,extra:true},id(1)),false);
 const duplicate=workspace();duplicate.cards.push(duplicate.cards[0]);assert.equal(isQOperatingWorkspaceV2(duplicate,id(1)),false);
 const rank=workspace();rank.cards[1].qualificationRank=1;assert.equal(isQOperatingWorkspaceV2(rank,id(1)),false);
 const badCut=workspace();badCut.cuts=[{poolVersionId:id(5),sourceDigest:s.sourceDigest,participantIdsLowFirst:[id(100),id(999)],recordedBy:id(998),reason:'TEST ONLY observed'}];assert.equal(isQOperatingWorkspaceV2(badCut,id(1)),false);
 assert.equal(isQOperatingWorkspaceV2({...s,blockers:['arbitrary private error']},id(1)),false);
});
test('result identity/action must match retained mutation before clearing recovery',()=>{
 const p={status:'q_policy_published',policyId:id(6),poolVersionId:id(5)},c={status:'q_cut_recorded',cutId:id(8),poolVersionId:id(5)};
 assert.ok(isQOperatingResultV2(p));assert.ok(isQOperatingResultV2(c));assert.ok(qOperatingResultMatchesV2(p,publish()));assert.ok(qOperatingResultMatchesV2(c,cut()));
 assert.equal(qOperatingResultMatchesV2(c,publish()),false);assert.equal(qOperatingResultMatchesV2(p,cut()),false);assert.equal(qOperatingResultMatchesV2({...p,poolVersionId:id(9)},publish()),false);
 assert.equal(isQOperatingResultV2({...p,paid:true}),false);assert.equal(isQOperatingResultV2({status:'rejected',code:'unknown_secret_error'}),false);
});
test('v2 routes retain same-origin verified actor and private backend boundaries; history route unchanged',()=>{
 const route=fs.readFileSync('src/app/api/v1/tournaments/[id]/q-operating-schedules/route.ts','utf8');
 for(const text of ['isSameOriginRequest','requireVerifiedSubject','createServerOnlyAdminClient','isQOperatingRequestV2','isQOperatingWorkspaceV2','qOperatingResultMatchesV2'])assert.ok(route.includes(text));
 const reconciliation=fs.readFileSync('src/app/api/v1/tournaments/[id]/q-operating-schedules/reconciliation/route.ts','utf8');assert.ok(reconciliation.includes('get_q_operating_reconciliation_v2'));
 const page=fs.readFileSync('src/app/tournament/[tournamentId]/q-operating-schedules/page.tsx','utf8');assert.ok(page.includes('access.role !== "director"'));
 const client=fs.readFileSync('src/app/tournament/[tournamentId]/q-operating-schedules/operating-client.tsx','utf8');assert.ok(client.includes('setAppRecoveryItem'));assert.ok(client.includes('payment-obligation:q-operating-v2:'));assert.ok(!client.includes('localStorage.clear'));
 const old=fs.readFileSync('src/app/tournament/[tournamentId]/q-pool-policy/policy-client.tsx','utf8');assert.ok(old.includes('Q_POLICY_METHOD'));
});
