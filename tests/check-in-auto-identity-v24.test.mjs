import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityReadQueueV24 } from '../src/lib/seating/identity-read-queue-v24.ts';
const tick = () => new Promise(resolve => setImmediate(resolve));

test('automatic identity reads are bounded to two; cancelled queued rows never dispatch', async () => {
  const q = createIdentityReadQueueV24(), release = [], started = [];
  const signals = Array.from({ length: 6 }, () => new AbortController());
  signals.forEach((controller, i) => q.enqueue(async () => { started.push(i); await new Promise(resolve => release.push(resolve)); }, controller.signal));
  await tick(); assert.deepEqual(started, [0, 1]);
  signals[2].abort(); signals[3].abort();
  release.shift()(); await tick(); assert.deepEqual(started, [0, 1, 4]);
  release.shift()(); await tick(); assert.deepEqual(started, [0, 1, 4, 5]);
  release.splice(0).forEach(resolve => resolve()); await tick();
});

test('cancelled ready work and failed reads cannot dispatch more or wedge the queue', async () => {
  const q = createIdentityReadQueueV24(), cancelled = new AbortController(), started = [];
  q.enqueue(async () => { started.push('cancelled'); }, cancelled.signal); cancelled.abort();
  q.enqueue(async () => { started.push('failed'); throw Error('synthetic read unavailable'); }, new AbortController().signal);
  q.enqueue(async () => { started.push('next'); }, new AbortController().signal);
  await tick(); await tick(); assert.deepEqual(started, ['failed', 'next']);
});
