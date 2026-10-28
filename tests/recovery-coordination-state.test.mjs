import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecoveryCoordinationState,trackRecoveryWriter} from '../src/lib/recovery-coordination-state.ts';

test('draining synchronously blocks new writes and waits for every active async writer',async()=>{
  const state=createRecoveryCoordinationState();state.ready();
  const finishQueue=state.enterWriter(),finishCache=state.enterWriter();
  const drain=state.drain();assert.equal(state.drain(),drain);
  assert.throws(()=>state.ready(),/invalid_transition/);
  assert.throws(()=>state.enterWriter(),/barrier_closed/);
  assert.throws(()=>state.assertWriteAllowed(),/barrier_closed/);
  let done=false;void drain.then(()=>done=true);
  finishQueue();await Promise.resolve();assert.equal(done,false);
  assert.throws(()=>state.exclusive(),/invalid_transition/);
  finishCache();finishCache();await drain;assert.equal(done,true);
  state.exclusive();assert.deepEqual(state.snapshot(),{phase:'exclusive',activeWriters:0,destructiveStarted:false});
  assert.throws(()=>state.signedOut(),/invalid_transition/);
});
test('preflight failure can restore ready only before destructive work',async()=>{
  const state=createRecoveryCoordinationState();state.ready();await state.drain();
  state.exclusive();state.reacquiring();assert.throws(()=>state.assertWriteAllowed(),/barrier_closed/);
  state.ready();state.assertWriteAllowed();await state.drain();state.exclusive();state.destructiveStep();state.fail();
  assert.throws(()=>state.ready(),/invalid_transition/);
  assert.throws(()=>state.enterWriter(),/barrier_closed/);
  state.destructiveStep();state.signedOut();assert.throws(()=>state.assertWriteAllowed(),/barrier_closed/);
});
test('unsupported/uninitialized and signed-out documents never accept stale recovery writes',async()=>{
  const state=createRecoveryCoordinationState();assert.throws(()=>state.enterWriter(),/barrier_closed/);
  state.ready();await state.drain();state.exclusive();state.destructiveStep();state.signedOut();
  assert.throws(()=>state.ready(),/invalid_transition/);assert.throws(()=>state.enterWriter(),/barrier_closed/);
});
test('the entire async writer is drained even when interrupted or rejected',async()=>{
  const state=createRecoveryCoordinationState();state.ready();
  let rejectWrite;const underlying=new Promise((_,reject)=>rejectWrite=reject);
  const write=trackRecoveryWriter(state,()=>underlying);const rejection=assert.rejects(write,/synthetic interruption/);
  const drain=state.drain();assert.equal(state.snapshot().activeWriters,1);
  await assert.rejects(trackRecoveryWriter(state,async()=>null),/barrier_closed/);
  rejectWrite(Error('synthetic interruption'));await rejection;await drain;
  assert.equal(state.snapshot().activeWriters,0);state.exclusive();
});
test('same-account authentication terminates without pretending recovery was erased',async()=>{
  const state=createRecoveryCoordinationState();state.ready();await state.drain();state.exclusive();
  state.authenticated();assert.equal(state.snapshot().destructiveStarted,false);
  assert.throws(()=>state.enterWriter(),/barrier_closed/);assert.throws(()=>state.ready(),/invalid_transition/);
});
