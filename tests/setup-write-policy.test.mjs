import test from 'node:test';
import assert from 'node:assert/strict';
import {allowSetupWriteOrAcceptedReplay} from '../src/lib/setup-write-policy.ts';
import {isSetupEvent} from '../src/lib/api/setup.ts';
import {qSetupPrizeWorkspace} from './fixtures/q-setup-prize-workspace.mjs';
test('new invalid Side intent never reaches any mutation, while accepted historical replay reaches hash validation',async()=>{
 const event=qSetupPrizeWorkspace('10000000-0000-4000-8000-000000000001').current.events[0];delete event.sourceStatus;
 for(const fee of [0,700,null,'',NaN]){
  event.sidePools=[{poolTypeCode:'Side',entryFeeCents:fee,note:''}];let revisions=0,activations=0,receiptReads=0;
  const allowed=await allowSetupWriteOrAcceptedReplay(isSetupEvent(event),async()=>{receiptReads++;return false;});
  if(allowed){revisions++;activations++;}
  assert.deepEqual({allowed,revisions,activations,receiptReads},{allowed:false,revisions:0,activations:0,receiptReads:1});
 }
 assert.equal(await allowSetupWriteOrAcceptedReplay(false,async()=>true),true);
 await assert.rejects(allowSetupWriteOrAcceptedReplay(false,async()=>{throw new Error('unavailable');}));
 assert.equal(await allowSetupWriteOrAcceptedReplay(true,async()=>{throw new Error('must not fetch');}),true);
});
