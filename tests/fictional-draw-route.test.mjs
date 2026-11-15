// Actual route, fictional ports: authorization/recovery unit proof only.
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const actor='11111111-1111-4111-8111-111111111111',event='22222222-2222-4222-8222-222222222222';
function fixture(subjects){let calls=0;const state={calls:0};const source=fs.readFileSync('src/app/api/v1/tournaments/[id]/fictional-draw/route.ts','utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const stubs={integratedTestBackendRef:()=> 'nnhcnvksxgxnpvdqjgpg',fictionalDrawBoundaryEnabled:()=>true,apiJson:(data,options={})=>({data,status:options.status??200}),requireVerifiedSubject:async()=>subjects[Math.min(calls++,subjects.length-1)],withApiFailureBoundary:fn=>fn(),readBoundedJson:async()=>({action:'admit',eventId:event,operationId:event,confirmed:true}),isSameOriginRequest:()=>true,isUuid:x=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x),createClient:async()=>({}),createServerOnlyAdminClient:()=>({rpc:async()=>{state.calls++;return{data:{status:'trial_scope_recorded',version:1,scopeVersionId:event,expiresAt:'2099-01-01T00:00:00Z'},error:null};}})};
 const exports={};vm.runInNewContext(code,{exports,require:()=>stubs});return{state,run:()=>exports.POST({}, {params:Promise.resolve({id:event})})};}
test('draw admission success requires the same verified actor after the service call',async()=>{const f=fixture([actor,actor]);assert.equal((await f.run()).status,200);assert.equal(f.state.calls,1);});
for(const subject of[null,event])test(`draw retains uncertain outcome after session loss or actor switch: ${subject}`,async()=>{const f=fixture([actor,subject]);const r=await f.run();assert.equal(r.status,503);assert.equal(r.data.error,'operation_outcome_unknown');assert.equal(f.state.calls,1);});
test('draw never constructs a service call for an unauthenticated actor',async()=>{const f=fixture([null]);assert.equal((await f.run()).status,401);assert.equal(f.state.calls,0);});
