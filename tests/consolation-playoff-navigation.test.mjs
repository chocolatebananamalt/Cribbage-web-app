import test from 'node:test';import assert from 'node:assert/strict';
import {consolationPlayoffEntry}from'../src/lib/results/consolation-playoff-navigation.ts';
const tid='40000000-0000-4000-8000-000000000001',eid='40000000-0000-4000-8000-000000000002';
const valid={tournamentId:tid,eventId:eid,role:'director',eventType:'consolation',format:'standard_singles',qualifierCount:4,syntheticEventIds:[eid]};
test('normal results navigation reaches only the supported enrolled Consolation role path',()=>{
 assert.equal(consolationPlayoffEntry(valid),`/tournament/${tid}/events/${eid}/consolation-playoffs`);
 assert.equal(consolationPlayoffEntry({...valid,role:'co_director'}),consolationPlayoffEntry(valid));
 for(const patch of [{role:'player'},{role:'cross_checker'},{eventType:'main'},{format:'doubles'},{qualifierCount:5},{syntheticEventIds:[]},{syntheticEventIds:[tid]},{eventId:'../other'}])assert.equal(consolationPlayoffEntry({...valid,...patch}),null);
});
