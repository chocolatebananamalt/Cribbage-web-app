// Existing app decoders against actual exported local SQL; no provider claim.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {isPrizeAccountingWorkspaceV9,isPrizeAccountingResultV9}from'../src/lib/api/prize-accounting-v9.ts';
import {isSidePoolRecipientWorkspaceV3}from'../src/lib/api/side-pool-recipients-v3.ts';
const dir=path.resolve(process.argv[2]);assert.equal(path.dirname(dir),path.resolve('test-results'));
const data=JSON.parse(fs.readFileSync(path.join(dir,'sql-result.json'),'utf8')).combined;
const workspace=data.finalized;
assert(isPrizeAccountingWorkspaceV9(workspace,workspace.tournamentId,workspace.eventId));
assert(isPrizeAccountingResultV9(data.draft,workspace.eventId));
assert(isPrizeAccountingResultV9(data.final,workspace.eventId));
const side=data.sideReview.workspace;
const oldSideWorkspaceAccepted=isSidePoolRecipientWorkspaceV3(side,workspace.tournamentId,workspace.eventId,data.sidePolicies.accepted.poolId);
const result={passed:true,existingV9Workspace:true,existingV9DraftAndFinal:true,oldSideWorkspaceAccepted,
 note:oldSideWorkspaceAccepted?'Only this ratio-5 fixture workspace accepted; no widened-domain, explicit new-method adapter or normal Custom Side UI acceptance claimed':'Existing Side workspace decoder does not support this custom method; dedicated adapter/UI remains blocked',
 providerVerified:false};
fs.writeFileSync(path.join(dir,'actual-dto-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
