import test from 'node:test';import assert from 'node:assert/strict';
import {expectedRequestOrigin,isSameOriginRequest} from '../src/lib/api/same-origin.ts';
import {rejectsApiMutationOrigin} from '../src/lib/api/mutation-origin-gateway.ts';
const req=(origin,host='127.0.0.1:3237',extra={})=>new Request('http://localhost:3237/auth/password',{headers:{origin,host,'sec-fetch-site':'same-origin',...extra}});
test('normalized Next loopback URL uses exact actual HTTP Host without trusting forwarding headers',()=>{
  assert.equal(expectedRequestOrigin(req('http://127.0.0.1:3237')),'http://127.0.0.1:3237');
  assert.equal(isSameOriginRequest(req('http://127.0.0.1:3237')),true);
  assert.equal(isSameOriginRequest(req('https://other.invalid')),false);
  assert.equal(isSameOriginRequest(req('https://other.invalid','127.0.0.1:3237',{'x-forwarded-host':'other.invalid'})),false);
  assert.equal(isSameOriginRequest(req('http://127.0.0.1:3237','127.0.0.1:3237',{'sec-fetch-site':'cross-site'})),false);
});
test('malformed authorities and empty expected origins fail closed',()=>{
  for(const host of ['good.invalid@evil.invalid','good.invalid/evil','good.invalid,evil.invalid','good.invalid:99999',''])assert.equal(expectedRequestOrigin(req('',host)),'');
  assert.equal(isSameOriginRequest(req('','')),false);
  assert.equal(rejectsApiMutationOrigin({pathname:'/api/v1/example',method:'POST',origin:'',requestOrigin:'',fetchSite:'same-origin'}),true);
});
