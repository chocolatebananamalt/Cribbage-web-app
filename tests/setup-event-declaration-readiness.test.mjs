import test from 'node:test';import assert from 'node:assert/strict';
import {checkEventPrizeDeclarations as check,readEventPrizeDeclarationPins as pins} from '../src/lib/setup-event-declaration-readiness.ts';
const id=n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`,actorId=id(1),tournamentId=id(2),main=id(3),con=id(4),scheduleId=id(5);
const schedule={kind:'regular-prize-cohort-5usd-v3',amountBasis:'total_award',expectedQualifierCount:4,sourceReference:'TEST ONLY formula',roundingRule:'automatic-five-dollar-cohort-v3',cohorts:[{bandStart:1,bandEnd:1,weight:4},{bandStart:2,bandEnd:2,weight:3},{bandStart:3,bandEnd:4,weight:2}]};
const events=[{clientRowId:main,eventKind:'main',entryFeeCents:5000},{clientRowId:con,eventKind:'consolation',entryFeeCents:1000}];
const workspace=e=>({tournamentId,clientRowId:e.clientRowId,currentVersion:1,supported:true,settingsCurrent:true,settings:{eventKind:e.eventKind,entryFeeCents:e.entryFeeCents},settingsFingerprint:'a'.repeat(64),schedule,scheduleId:e.clientRowId===main?scheduleId:id(6),accountingReady:false,limitation:'Declaration only'});
const args={actorId,tournamentId,events,readRecovery:()=>null,fetchWorkspace:async row=>workspace(events.find(e=>e.clientRowId===row))};
test('all paid event declarations must be current and scoped',async()=>{
 assert.equal(await check(args),true);
 assert.deepEqual(await pins({...args,events:[events[1],events[0]]}),[{clientRowId:main,declarationId:scheduleId,settingsFingerprint:'a'.repeat(64)},{clientRowId:con,declarationId:id(6),settingsFingerprint:'a'.repeat(64)}]);
 assert.equal(await check({...args,events:[events[0],{...events[1],entryFeeCents:0}],fetchWorkspace:async row=>workspace(events[0])}),true);
 for(const patch of [{supported:false},{settingsCurrent:false},{schedule:null},{tournamentId:id(99)},{settings:{eventKind:'main',entryFeeCents:1000}}]) assert.equal(await check({...args,fetchWorkspace:async row=>row===con?{...workspace(events[1]),...patch}:workspace(events[0])}),false);
});
test('pending, corrupt, missing, failed, duplicate, and in-flight recovery changes block',async()=>{
 assert.equal(await check({...args,readRecovery:key=>key.includes(con)?'corrupt':null}),false);
 assert.equal(await check({...args,readRecovery:()=>{throw Error('denied')}}),false);
 assert.equal(await check({...args,fetchWorkspace:async()=>{throw Error('offline')}}),false);
 assert.equal(await check({...args,events:[events[0],events[0]]}),false);
 assert.equal(await check({...args,events:[{...events[0],entryFeeCents:0},events[1]]}),false);
 let changed=false;assert.equal(await check({...args,readRecovery:()=>changed?'pending':null,fetchWorkspace:async row=>{changed=true;return workspace(events.find(e=>e.clientRowId===row));}}),false);
});
test('linked setup checks every paid Main and Consolation without imposing legacy caps',async()=>{
 const more=[events[0],events[1],{...events[0],clientRowId:id(7)},{clientRowId:id(8),eventKind:'satellite',entryFeeCents:500}];
 const fetchWorkspace=async row=>{const e=more.find(item=>item.clientRowId===row);return {...workspace(e),scheduleId:row};};
 assert.equal(await pins({...args,events:more,fetchWorkspace}),null);
 assert.deepEqual((await pins({...args,events:more,fetchWorkspace,allowLinkedEvents:true})).map(pin=>pin.clientRowId),[main,con,id(7)]);
 assert.deepEqual(await pins({...args,events:[{...events[0],entryFeeCents:0}],allowLinkedEvents:true}),[]);
});
