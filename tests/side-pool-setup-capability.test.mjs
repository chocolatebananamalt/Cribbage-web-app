import test from 'node:test';
import assert from 'node:assert/strict';
import { isLegacySideRequestUnbound, isSidePoolRequestConflict, sideSetupCapabilityState } from '../src/lib/api/side-pool-setup-capability.ts';
import { isLegacySideSetupSaveRequest } from '../src/lib/api/setup.ts';
import { qSetupPrizeWorkspace } from './fixtures/q-setup-prize-workspace.mjs';

test('only an exact capability-RPC schema-cache miss enables pre-migration legacy mode',()=>{
 assert.equal(sideSetupCapabilityState({data:{status:'available',version:1},error:null}),'ready');
 assert.equal(sideSetupCapabilityState({data:null,error:{code:'PGRST202',message:'Could not find public.get_side_pool_setup_type_capability_v1 in the schema cache'}}),'legacy');
 for(const error of [{code:'PGRST202',message:'some other function'}, {code:'42501',message:'get_side_pool_setup_type_capability_v1'}, {code:'PGRST301',message:'get_side_pool_setup_type_capability_v1'}, {}, null])
  assert.equal(sideSetupCapabilityState({data:null,error}),'unavailable');
 assert.equal(sideSetupCapabilityState({data:{status:'available',version:2},error:null}),'unavailable');
 assert.equal(sideSetupCapabilityState({data:{status:'available',version:1},error:{code:'PGRST202',message:'get_side_pool_setup_type_capability_v1'}}),'unavailable');
 assert.equal(sideSetupCapabilityState({data:null,error:{code:'PGRST202',message:'get_side_pool_setup_type_capability_v1_unrelated'}}),'unavailable');
});
test('only the exact unbound recovery result enters the retained warning path',()=>{
 assert.equal(isLegacySideRequestUnbound({error:'legacy_side_request_unbound'}),true);
 for(const value of [null,{}, {error:'legacy_side_request_unbound',extra:true},{error:'side_pool_request_conflict'}]) assert.equal(isLegacySideRequestUnbound(value),false);
 assert.equal(isSidePoolRequestConflict({error:'side_pool_request_conflict'}),true);
 for(const value of [null,{}, {error:'side_pool_request_conflict',extra:true},{error:'legacy_side_request_unbound'}]) assert.equal(isSidePoolRequestConflict(value),false);
});

test('legacy mode permits only old three-key Side payloads with valid fees',()=>{
 const id='10000000-0000-4000-8000-000000000001',current=qSetupPrizeWorkspace(id).current,payload=structuredClone(current);
 for(const k of ['revisionId','version','createdAt'])delete payload[k];for(const e of payload.events)delete e.sourceStatus;
 const r={expectedVersion:0,payload,idempotencyKey:id};
 assert.equal(isLegacySideSetupSaveRequest(r),true);
 r.payload.events[0].sidePools=[{poolTypeCode:'Side',entryFeeCents:1000,note:''}];
 assert.equal(isLegacySideSetupSaveRequest(r),true);
 r.payload.events[0].sidePools[0].payoutType='graduated-1-in-4';
 assert.equal(isLegacySideSetupSaveRequest(r),false);
 delete r.payload.events[0].sidePools[0].payoutType;r.payload.events[0].sidePools[0].entryFeeCents=700;
 assert.equal(isLegacySideSetupSaveRequest(r),false);
});
