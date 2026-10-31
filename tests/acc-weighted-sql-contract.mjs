// Consume actual disposable SQL responses, never a hosted database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {isQOperatingWorkspaceV3}from'../src/lib/api/q-operating-schedules.ts';
import {operatingWorkspacePoolPreview}from'../src/lib/results/q-operating-workspace-preview.ts';
import {isQAccountingWorkspace}from'../src/lib/api/q-accounting-v6.ts';
const source=JSON.parse(fs.readFileSync('test-results/acc-weighted-operating-sql-workspace.json','utf8'));
assert.equal(isQOperatingWorkspaceV3(source,source.tournamentId),true);
const previews=source.membership.pools.map(p=>operatingWorkspacePoolPreview(source,p.poolVersionId));
assert.deepEqual(previews.map(p=>p.status),['preview','preview']);
assert.deepEqual(previews[0].awards.map(r=>r.amountMinor),[8000,5500,2500]);
assert.deepEqual(previews[1].refunds.map(r=>r.amountMinor),[1000]);
const {workspace}=JSON.parse(fs.readFileSync('test-results/seventeen-accounting-api-contract.json','utf8'));
assert.equal(isQAccountingWorkspace(workspace,source.tournamentId,workspace.eventId),true);
assert.equal(workspace.finalization.current,true);assert.equal(workspace.finalization.status,'unpaid');
assert.equal(workspace.facts.receiptTotalMinor,68000);
console.log('PASS actual SQL operating response -> strict v3 DTO -> frontend preview -> strict canonical accounting DTO; exact unpaid amounts conserved');
