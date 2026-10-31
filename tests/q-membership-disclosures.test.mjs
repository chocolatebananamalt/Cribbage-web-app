import {graduatedQMethodV4} from '../src/lib/api/q-graduated-policy-v4.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {qMembershipOperatingDisclosures} from '../src/lib/results/q-membership-disclosures.ts';
import {balancedQMethodV3,isQOperatingWorkspaceV2} from '../src/lib/api/q-operating-schedules.ts';
import {operatingSource,id} from './fixtures/q-operating-source.mjs';
test('balanced frozen policy reaches membership with exact ID and truthful formula disclosure',()=>{
 for(const method of [balancedQMethodV3,graduatedQMethodV4]){const s=operatingSource(17,1000);Object.assign(s.policies[0],{method,ratio:6,scheduleId:method});
 assert.equal(isQOperatingWorkspaceV2(s,s.tournamentId),false,'old reader reproduces the missing-policy bug');
 const policies=qMembershipOperatingDisclosures(s,s.tournamentId);assert.equal(policies.length,1);assert.equal(policies[0].id,id(6));assert.equal(policies[0].poolVersionId,id(5));assert.match(policies[0].disclosureText,/largest-remainder/);assert.doesNotMatch(policies[0].disclosureText,/Exact chart amounts/);
 assert.equal(qMembershipOperatingDisclosures(s,id(999)),null);s.policies[0].method='unknown';assert.equal(qMembershipOperatingDisclosures(s,s.tournamentId),null);}
});
test('equal and historical chart disclosures retain their policy identity and semantics',()=>{
 for(const method of ['equal-paid-playoff-qualifiers-v2','graduated-paid-card-rank-v2']){const s=operatingSource(4,1000,method);const p=qMembershipOperatingDisclosures(s,s.tournamentId)[0];assert.equal(p.id,id(6));assert.match(p.disclosureText,method.startsWith('equal')?/Equal Q/:/Exact chart amounts/);}
});
test('actual membership page projects the current operating reader result through the shared validator',()=>{
 const page=fs.readFileSync('src/app/tournament/[tournamentId]/q-pools/page.tsx','utf8');assert.match(page,/qMembershipOperatingDisclosures\(operatingRead.data,tournamentId\)/);assert.doesNotMatch(page,/isQOperatingWorkspaceV2/);
});
