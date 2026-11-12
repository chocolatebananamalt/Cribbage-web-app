import test from 'node:test';
import assert from 'node:assert/strict';
import {createSafeSwitchGate, safeSwitchMessage, safeRecoveryBarrierMessage} from '../src/lib/safe-device-switch.ts';

test('barrier reasons give distinct safe guidance without leaking arbitrary errors', () => {
  const tabs=safeRecoveryBarrierMessage(new Error('other_tournament_tabs_or_unknown_inventory'));
  assert.match(tabs,/unconfirmed browser window/);
  assert.match(tabs,/Finish and save/);
  for(const code of ['recovery_controller_unavailable','recovery_controller_changed_or_unknown','recovery_protocol_unavailable']) assert.match(safeRecoveryBarrierMessage(new Error(code)),/verify its recovery worker/);
  for(const code of ['recovery_inventory_unavailable','recovery_lock_inventory_unavailable','recovery_coordination_unavailable','recovery_document_lease_unavailable','recovery_navigation_lease_pending']) assert.match(safeRecoveryBarrierMessage(new Error(code)),/locks or window inventory/);
  for(const error of [new Error('secret-password-test'),{message:'recovery_protocol_unavailable'},null]) {
    const message=safeRecoveryBarrierMessage(error);
    assert.doesNotMatch(message,/secret-password-test/);
    assert.match(message,/No additional data was cleared and sign-out was not attempted during this attempt/);
    assert.match(message,/Keep this account signed in/);
  }
});

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
