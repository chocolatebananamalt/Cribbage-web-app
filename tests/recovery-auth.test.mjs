import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerMarkersAllowActor,ownerMarkersAreKnown} from '../src/lib/auth/recovery-owner.ts';
import {performRecoveryAuthentication,safeAuthNext,validRecoveryAuthInput} from '../src/lib/auth/recovery-auth.ts';
const a='40000000-0000-4000-8000-000000000001',b='40000000-0000-4000-8000-000000000002';
const input={mode:'password',email:'fictional@test.invalid',password:'fictional-test-only',attemptId:a,next:'/'};
const request=(body=input,headers={})=>new Request('https://fixture.invalid/auth/password',{method:'POST',headers:{origin:'https://fixture.invalid','content-type':'application/json','sec-fetch-site':'same-origin',...headers},body:JSON.stringify(body)});
test('owner markers preserve same actor and reject unknown, malformed and mixed ownership',()=>{
  assert.equal(ownerMarkersAllowActor([],a),true);assert.equal(ownerMarkersAllowActor([a,a],a),true);
  for(const owners of [['unknown'],[''],[b],[a,b],['malformed']])assert.equal(ownerMarkersAllowActor(owners,a),false);
  assert.equal(ownerMarkersAreKnown(['unknown']),false);assert.equal(ownerMarkersAllowActor([a],undefined),false);
});
test('auth JSON shape and destination reject extras, credentials in redirects and oversized values',()=>{
  assert.equal(validRecoveryAuthInput(input),true);
  for(const value of [{...input,actorId:a},{...input,password:''},{...input,password:'x'.repeat(1025)},{...input,next:'//outside.invalid'},{...input,next:'/%2foutside.invalid'}])assert.equal(validRecoveryAuthInput(value),false);
  assert.equal(safeAuthNext('/tournament/example'),'/tournament/example');assert.equal(safeAuthNext('/%0aoutside'),'/');
  assert.equal(validRecoveryAuthInput({mode:'code',code:'fictional_code_1234',attemptId:a,next:'/'}),true);
});
test('origin/type/size/unknown-owner rejection never calls authentication',async()=>{
  let calls=0;const auth=async()=>{calls++;return{actorId:a}};
  for(const req of [request(input,{origin:'https://other.invalid'}),request(input,{'sec-fetch-site':'cross-site'}),request(input,{'content-type':'text/plain'}),request({...input,password:'x'.repeat(9000)})]){
    const result=await performRecoveryAuthentication(req,[],auth);assert.equal(result.accepted,null);assert.ok(result.response.status>=400);
  }
  assert.equal((await performRecoveryAuthentication(request(),['unknown'],auth)).response.status,409);assert.equal(calls,0);
});
test('candidate actor mismatch cannot be accepted or leak downstream auth errors',async()=>{
  const result=await performRecoveryAuthentication(request(),[a],async()=>({actorId:b}));
  assert.equal(result.accepted,null);assert.equal(result.response.status,409);assert.equal(result.response.headers.get('set-cookie'),null);
  const failed=await performRecoveryAuthentication(request(),[],async()=>{throw Error('PRIVATE_CREDENTIAL_SENTINEL')});
  assert.doesNotMatch(await failed.response.text(),/PRIVATE_CREDENTIAL_SENTINEL/);assert.equal(failed.response.headers.get('cache-control'),'private, no-store');assert.equal(failed.response.headers.get('referrer-policy'),'no-referrer');
});
test('same-actor pending recovery is accepted without clearing; successful attempt is explicitly bound',async()=>{
  const result=await performRecoveryAuthentication(request(),[a],async value=>{assert.equal(value.password,'fictional-test-only');return{actorId:a}});
  assert.deepEqual(result.accepted,{attemptId:a,actorId:a});assert.deepEqual(await result.response.json(),{status:'signed_in',next:'/'});
});
test('rate and one-time-code errors are bounded and never automatically replayed',async()=>{
  let calls=0;const result=await performRecoveryAuthentication(request({mode:'code',code:'fictional_code_1234',attemptId:a,next:'/'}),[],async()=>{calls++;return{error:'rate_limited'}});
  assert.equal(calls,1);assert.equal(result.response.status,429);assert.equal(result.accepted,null);
});
