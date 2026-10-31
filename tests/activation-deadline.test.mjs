import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {isActivationRedemptionResult} from '../src/lib/api/roster-account-activation.ts';
import {redeemRosterAccountActivation} from '../src/lib/roster-account-activation-redeemer.ts';
import {createRosterAccountActivationCredential} from '../src/lib/roster-account-activation-token.ts';
const id='00000000-0000-4000-8000-000000000001',requestId='00000000-0000-4000-8000-000000000002';
const pending={status:'pending',activationId:id,requestId,confirmationPhrase:'ABCD-EFGH'};
const expiresAt='2030-01-01T00:30:00.000Z';
const ready={status:'ready',activationId:id,saltBase64:Buffer.alloc(32,7).toString('base64')};
const input={profileId:requestId,operationId:requestId,credential:createRosterAccountActivationCredential(id).canonicalToken};
test('deadline receipt accepts exact legacy/new shapes, rejects invalid timestamps and extras',()=>{
 assert.equal(isActivationRedemptionResult(pending),true);
 assert.equal(isActivationRedemptionResult({...pending,expiresAt}),true);
 for(const value of [null,42,'invalid',''])assert.equal(isActivationRedemptionResult({...pending,expiresAt:value}),false);
 assert.equal(isActivationRedemptionResult({...pending,expiresAt,extra:true}),false);
});
test('private immutable deadline is disclosed only after accepted redemption, with legacy fallback',async()=>{
 for(const salt of [ready,{...ready,expiresAt}]){
  const result=await redeemRosterAccountActivation({rpc:async name=>({data:name.includes('salt')?salt:pending,error:null})},input);
  assert.deepEqual(result,salt.expiresAt?{...pending,expiresAt}:pending);
 }
 const rejected=await redeemRosterAccountActivation({rpc:async name=>({data:name.includes('salt')?{...ready,expiresAt}:{status:'rejected'},error:null})},input);
 assert.deepEqual(rejected,{status:'rejected'});
});
test('malformed or broadened private deadline metadata fails before any redemption write',async()=>{
 for(const salt of [{...ready,expiresAt:'invalid'},{...ready,expiresAt:null},{...ready,extra:true},{...ready,expiresAt,extra:true}]){
  const calls=[];const result=await redeemRosterAccountActivation({rpc:async name=>{calls.push(name);return{data:salt,error:null};}},input);
  assert.deepEqual(result,{status:'rejected'});assert.deepEqual(calls,['get_roster_account_activation_salt_v1']);
 }
});
test('metadata migration preserves existing service-only expiry predicate and leaves all mutation RPCs alone',async()=>{
 const sql=await readFile('database/migrations/0237_activation_deadline_metadata.sql','utf8');
 assert.match(sql,/to_regprocedure/);assert.match(sql,/perform app\.roster_account_activation_service_only\(\)/);
 assert.match(sql,/state = 'issued' and expires_at > now\(\)/);
 assert.match(sql,/'expiresAt', v_expires_at/);
 assert.doesNotMatch(sql,/\b(grant|revoke|insert|update|delete|alter|drop)\b/i);
 assert.doesNotMatch(sql,/create or replace function public\.(redeem|decide|issue)/);
 const decision=await readFile('database/migrations/0094_roster_account_activation_approval_rpc.sql','utf8');
 assert.match(decision,/v_activation\.expires_at <= now\(\)/);
 const issue=await readFile('database/migrations/0091_roster_account_activation_issue_rpc.sql','utf8');
 assert.match(issue,/set state = 'expired'/);assert.match(issue,/set state = 'rejected'/);
});
