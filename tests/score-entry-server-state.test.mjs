import assert from 'node:assert/strict';
import test from 'node:test';
import {scoreEntryServerState as saved} from '../src/lib/games/score-entry-server-state.ts';
const empty={state:'pending',ownSubmission:null,ownConfirmed:false,canConfirm:false};
const submission={id:'60000000-0000-4000-8000-000000000009',winnerSide:'a',margin:20};
test('transport acceptance or one submission never claims authoritative verification',()=>{
 assert.match(saved(empty).status,/Enter your independent result/);
 const first=saved({...empty,state:'submitted',ownSubmission:submission});
 assert.equal(first.canConfirm,false);assert.match(first.status,/Required verification is still pending/);
});
test('server receipt, confirmation and final state changes all produce a new reconciliation key',()=>{
 const stages=[empty,{...empty,state:'submitted',ownSubmission:submission},{...empty,state:'confirmation_pending',ownSubmission:submission,canConfirm:true},{...empty,state:'confirmation_pending',ownSubmission:submission,ownConfirmed:true},{...empty,state:'verified',ownSubmission:submission,ownConfirmed:true}];
 assert.equal(new Set(stages.map(x=>saved(x).key)).size,stages.length);
 assert.equal(saved(stages[2]).canConfirm,true);assert.match(saved(stages[3]).status,/after the other player confirms/);
 assert.equal(saved(stages[4]).status,'Game verified. The authoritative scorecard is updated.');
});
test('confirmation cannot appear without matching server state, own submission and missing own confirmation',()=>{
 for(const context of [{...empty,canConfirm:true},{...empty,state:'submitted',ownSubmission:submission,canConfirm:true},{...empty,state:'confirmation_pending',ownSubmission:submission,canConfirm:true,ownConfirmed:true},{...empty,state:'mismatch',ownSubmission:submission,canConfirm:true},{...empty,state:'verified',ownSubmission:submission,canConfirm:true}])assert.equal(saved(context).canConfirm,false);
 assert.match(saved({...empty,state:'mismatch',ownSubmission:submission}).status,/do not match/);
});
