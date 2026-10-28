import test from 'node:test';
import assert from 'node:assert/strict';
import {createSafeSwitchGate, safeSwitchMessage} from '../src/lib/safe-device-switch.ts';

test('safe switch gate excludes duplicate clear and ordinary signout until settled', () => {
  const gate=createSafeSwitchGate();
  assert.equal(gate.enter(),true);
  assert.equal(gate.enter(),false);
  assert.equal(gate.enter(),false);
  gate.leave();
  assert.equal(gate.enter(),true);
});
test('safe diagnostics distinguish pending deletion from cancellation or successful signout', () => {
  const pending=safeSwitchMessage('offline-database-blocked');
  assert.match(pending,/still pending/);assert.match(pending,/Do not reload.*retry/);
  assert.doesNotMatch(pending,/cancelled|successfully/);
  const stages=['recovery-check','offline-database','offline-cache','retry-storage','sign-out'];
  const messages=stages.map(s=>safeSwitchMessage(s,true));
  assert.equal(new Set(messages).size,stages.length);
  for(const message of messages) assert.match(message,/same player/);
  assert.match(messages.at(-1),/could not be confirmed/);
});
