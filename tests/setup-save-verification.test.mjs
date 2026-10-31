import test from 'node:test';
import assert from 'node:assert/strict';
import {setupFinancialTermsMatch} from '../src/lib/setup-save-verification.ts';
import {qSetupPrizeWorkspace} from './fixtures/q-setup-prize-workspace.mjs';
const id='10000000-0000-4000-8000-000000000001';
function fixture(combined=false){
 const current=qSetupPrizeWorkspace(id).current;current.events[0].gameCount=12;current.events[0].entryFeeCents=3000;
 if(combined){current.events[0].qPools=[{slot:1,poolTypeCode:'Graduated (1-in-6)',entryFeeCents:1000,note:'',sourceStatus:'director_configured_unverified'}];current.events[0].sidePools=[{slot:1,poolTypeCode:'Side 1-in-6',entryFeeCents:1000,note:'',sourceStatus:'director_configured_unverified'}];}
 const payload=structuredClone(current);for(const k of ['revisionId','version','createdAt'])delete payload[k];
 for(const e of payload.events){delete e.sourceStatus;for(const p of [...e.qPools,...e.sidePools]){delete p.slot;delete p.sourceStatus;}}
 return{current,request:{expectedVersion:0,idempotencyKey:id,payload},receipt:{revisionId:id,version:1}};
}
test('save acknowledgement is verified against exact persisted event and pool financial terms for both replacement scenarios',()=>{
 for(const combined of[false,true]){const{current,request,receipt}=fixture(combined);assert.equal(setupFinancialTermsMatch(request,receipt,current),true);current.events[0].entryFeeCents=0;assert.equal(setupFinancialTermsMatch(request,receipt,current),false);}
});
test('readback rejects wrong revision/version, missing or altered pool slots, names, fees and cross-event terms',()=>{
 for(const mutate of[c=>c.revisionId=id.replace(/1$/,'2'),c=>c.version++,c=>c.events[0].clientRowId=id,c=>c.events[0].qPools[0].slot=2,c=>c.events[0].qPools[0].entryFeeCents=0,c=>c.events[0].sidePools[0].poolTypeCode='Other',c=>c.events[0].sidePools=[],c=>c.events[0].gameCount=9]){const f=fixture(true);mutate(f.current);assert.equal(setupFinancialTermsMatch(f.request,f.receipt,f.current),false);}
 const f=fixture();assert.equal(setupFinancialTermsMatch(f.request,f.receipt,null),false);assert.equal(setupFinancialTermsMatch(f.request,{...f.receipt,version:2},f.current),false);
});
test('intentional free entry is preserved, while invalid or blank-as-NaN is never accepted as zero',()=>{
 const f=fixture();f.current.events[0].entryFeeCents=0;f.request.payload.events[0].entryFeeCents=0;assert.equal(setupFinancialTermsMatch(f.request,f.receipt,f.current),true);
 f.request.payload.events[0].entryFeeCents=NaN;assert.equal(setupFinancialTermsMatch(f.request,f.receipt,f.current),false);
});
test('readback honors existing server name trimming without relaxing money or identity checks',()=>{
 const f=fixture(true);f.request.payload.events[0].displayName='  Synthetic Main  ';f.request.payload.events[0].qPools[0].poolTypeCode=' Graduated (1-in-6) ';f.request.payload.events[0].sidePools[0].poolTypeCode=' Side 1-in-6 ';
 assert.equal(setupFinancialTermsMatch(f.request,f.receipt,f.current),true);
 f.current.events[0].sidePools[0].entryFeeCents=999;assert.equal(setupFinancialTermsMatch(f.request,f.receipt,f.current),false);
});
