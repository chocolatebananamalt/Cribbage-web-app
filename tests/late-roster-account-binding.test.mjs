import assert from 'node:assert/strict';
import test from 'node:test';
import {isActivationWorkspace} from '../src/lib/api/roster-account-activation.ts';
const workspace={tournamentName:'TEST ONLY event',rosterEntries:[],pendingRequests:[]};
const issue={participantId:'02730000-0000-4000-8000-000000000001',playerName:'TEST ONLY player',eventName:'Main',reason:'Event account assignment needs director review'};
test('activation workspace remains compatible and labels unresolved event assignment separately',()=>{
 assert.equal(isActivationWorkspace(workspace),true);
 assert.equal(isActivationWorkspace({...workspace,eventBindingIssues:[]}),true);
 assert.equal(isActivationWorkspace({...workspace,eventBindingIssues:[issue]}),true);
});
test('event binding review metadata rejects secrets, malformed identities and unreviewed reasons',()=>{
 for(const eventBindingIssues of [null,{},[{...issue,participantId:'bad'}],[{...issue,reason:'unknown'}],[{...issue,credential:'secret'}]])
  assert.equal(isActivationWorkspace({...workspace,eventBindingIssues}),false);
});
