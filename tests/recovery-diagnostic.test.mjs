import test from 'node:test';
import assert from 'node:assert/strict';
import { signOutClaimsStatus } from '../src/lib/auth/sign-out-claims.ts';
import { recoveryDiagnostic, recoveryStage, readRecoveryDiagnostic, resetRecoveryDiagnostic } from '../src/lib/recovery-diagnostic.ts';
import {createClient} from '@supabase/supabase-js';

test('installed Supabase SDK empty-session contract makes zero network requests', async () => {
  let requests=0;
  const client=createClient('https://fictional.invalid','fictional-publishable-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async()=>{requests++;throw Error('unexpected fictional network request');}},
  });
  const result=await client.auth.getClaims();
  assert.deepEqual(result,{data:null,error:null});
  assert.equal(requests,0);
  assert.equal(signOutClaimsStatus(result.data,result.error),'signed_out');
});

test('installed SDK explicit empty session is signed out; valid subject stays signed in', () => {
  assert.equal(signOutClaimsStatus(null, null), 'signed_out');
  assert.equal(signOutClaimsStatus(null, {name:'AuthSessionMissingError'}), 'signed_out');
  assert.equal(signOutClaimsStatus({claims:{sub:'fictional-actor'}}, null), 'signed_in');
});
test('malformed claims and non-missing auth errors never confirm sign out', () => {
  for (const data of [undefined, {}, {claims:null}, {claims:{}}, {claims:{sub:''}}, {claims:{sub:' '}}, {claims:{sub:1}}, false]) {
    assert.equal(signOutClaimsStatus(data, null), 'unconfirmed');
  }
  for (const error of [undefined, {name:'AuthRetryableFetchError'}, {name:'AuthApiError'}, new Error('fictional-private-error')]) {
    assert.equal(signOutClaimsStatus(null, error), 'unconfirmed');
  }
});
test('diagnostics whitelist codes and discard arbitrary error data', () => {
  const error = new Error('PRIVATE_SENTINEL password cookie account URL');
  error.name = 'PRIVATE_SENTINEL';
  assert.deepEqual(recoveryDiagnostic('worker-register', error), {stage:'worker-register',code:'recovery_initialization_failed'});
  assert.deepEqual(recoveryDiagnostic('protocol', Error('recovery_protocol_unavailable')), {stage:'protocol',code:'recovery_protocol_unavailable'});
  assert.doesNotMatch(JSON.stringify(recoveryDiagnostic('owner-check', error)), /PRIVATE_SENTINEL|password|cookie|account|URL/);
});
test('nested initialization records earliest failed stage and preserves original rejection', async () => {
  resetRecoveryDiagnostic();
  const error = Error('recovery_protocol_unavailable');
  await assert.rejects(recoveryStage('document-lease', () => recoveryStage('protocol', () => {throw error;})), candidate => candidate === error);
  assert.deepEqual(readRecoveryDiagnostic(), {stage:'protocol',code:'recovery_protocol_unavailable'});
  const copy = readRecoveryDiagnostic(); copy.code = 'modified';
  assert.equal(readRecoveryDiagnostic().code, 'recovery_protocol_unavailable');
  resetRecoveryDiagnostic();
  assert.equal(await recoveryStage('worker-ready', () => 42), 42);
  assert.equal(readRecoveryDiagnostic(), null);
});
