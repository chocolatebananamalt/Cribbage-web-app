// Actual application decoders against exported local SQL data, not provider auth.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {isCustomPoolDraftSavedV3}from '../src/lib/api/custom-pool-draft-result-v3.ts';
import {isQCustomWorkspaceV5}from '../src/lib/api/q-custom-policy-v5.ts';
import {isQReviewV2Workspace}from '../src/lib/api/q-obligation-review-v2.ts';
import {isQAccountingWorkspace,isQAccountingResult}from '../src/lib/api/q-accounting-v6.ts';
const dir=path.resolve(process.argv[2]);assert.equal(path.dirname(dir),path.resolve('test-results'));
const data=JSON.parse(fs.readFileSync(path.join(dir,'sql-result.json'),'utf8'));
for(const name of['firstSaved','amendedSaved','clearedSaved']){const x=data.side[name];assert(isCustomPoolDraftSavedV3(x,x.envelope,x.envelope.base),name);}
const q=data.qAccounting;
assert(isQCustomWorkspaceV5(q.review.source.manifest.operatingWorkspace,q.tournamentId));
assert(isQReviewV2Workspace(q.review.current,q.tournamentId));
assert(isQAccountingWorkspace(q.finalized.workspace,q.tournamentId,q.eventId));
assert(isQAccountingResult(q.draft,q.eventId));assert(isQAccountingResult(q.final,q.eventId));
const result={passed:true,kind:'actual-application-decoders-on-exported-local-SQL',sideAcks:3,qWorkspace:true,qReview:true,qAccounting:true,providerVerified:false,moneyMoved:false};
fs.writeFileSync(path.join(dir,'root-actual-dto-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
