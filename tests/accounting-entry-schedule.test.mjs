import test from 'node:test';
import assert from 'node:assert/strict';
import { accountingEntryForSchedule, getAccountingEntry } from '../src/lib/api/accounting-entry.ts';
import { buildSetupPrizeScheduleV3 } from '../src/lib/results/prize-schedule-setup.ts';
import { membership, tid, eid, id } from './fixtures/no-q-accounting-v7-workspace.mjs';

const current = {
 tournamentId: tid, clientRowId: id(71), currentVersion: 1, activated: true,
 eventId: eid, settingsCurrent: true,
 versions: [{scheduleId:id(72),version:1,recordedAt:'2026-10-30T00:00:00Z',
  reason:'TEST ONLY predeclared current five-dollar schedule',
  schedule:buildSetupPrizeScheduleV3(5,['4','3','2','1'],'TEST ONLY director-selected weights')}],
};

test('a bound current five-dollar declaration routes no-Q playoffs to v8, not legacy v7',async()=>{
 assert.equal(accountingEntryForSchedule(membership,[current],tid,eid),'prize-accounting-v8');
 let args;
 const rpc={rpc:async(name,value)=>{args={name,value};return{data:membership,error:null};}};
 assert.equal(await getAccountingEntry(rpc,id(1),tid,eid,[current]),'prize-accounting-v8');
 assert.deepEqual(args,{name:'get_q_pool_membership_workspace_v1',value:{p_actor_id:id(1),p_tournament_id:tid}});
});

test('missing declarations remain legacy compatibility rather than invented current-policy adoption',()=>{
 assert.equal(accountingEntryForSchedule(membership,[],tid,eid),'no-q-accounting-v7');
 const unstructured={...current,currentVersion:0,versions:[]};
 assert.equal(accountingEntryForSchedule(membership,[unstructured],tid,eid),'no-q-accounting-v7');
 // A declaration for another event cannot supply this event with a policy.
 assert.equal(accountingEntryForSchedule(membership,[{...current,eventId:id(99)}],tid,eid),'no-q-accounting-v7');
});

test('stale or duplicate current declarations cannot silently fall back to an older writer',()=>{
 assert.equal(accountingEntryForSchedule(membership,[{...current,settingsCurrent:false}],tid,eid),null);
 assert.equal(accountingEntryForSchedule(membership,[current,current],tid,eid),null);
 assert.equal(accountingEntryForSchedule(membership,[{...current,tournamentId:id(99)}],tid,eid),null);
 assert.equal(accountingEntryForSchedule(membership,null,tid,eid),null);
 assert.equal(accountingEntryForSchedule(null,[current],tid,eid),null);
});
