import fs from'node:fs';import assert from'node:assert/strict';
import{raw,call,checkpoint,actor,tid,sid,official,reviewer,op,lit,json,report}from'./main-con-owned-db-v3.mjs';
import{acceptMainConManualChainV3}from'./main-con-manual-awards-chain-v3.mjs';
const main=report.eventId,con=report.consolationEventId;assert(main&&con);
for(const eid of[main,con])await acceptMainConManualChainV3({raw,call,checkpoint:(k,v)=>checkpoint((eid===main?'main_':'con_')+k,v),actor,tid,eid,sid,official,reviewer,op,lit,json,report});
const args=[actor,sid,tid,main].map(lit).join(',');
const p=call('select app.get_selected_step_pool_source_v3('+[actor,tid,main].map(lit).join(',')+');');assert.equal(p.status,'source_available',JSON.stringify(p));
const proposal=call('select app.record_selected_step_pool_v3('+[actor,tid,main,op()].map(lit).join(',')+','+json({kind:'selected-step-pool-save-v3',expectedVersion:0,expectedSourceDigest:p.sourceDigest,reason:'Fictional separate current pool review',reviewed:true})+');');assert.equal(proposal.status,'proposal_saved',JSON.stringify(proposal));
const pool=call('select app.current_manual_pool_final_source_v1('+args+');');assert.equal(pool.status,'source_available',JSON.stringify(pool));
const pr={kind:'manual-pool-finalize-v1',expectedSourceDigest:pool.sourceDigest,poolProposalRevisionId:pool.poolProposalRevisionId,expectedPoolSourceDigest:p.sourceDigest,regularAwardSetId:pool.regularAwardSetId,fundReviewId:pool.fundReviewId,reviewed:true,reason:'Fictional separate Q and Side final review'};
const poolWrite='select public.record_manual_pool_final_provider_v1('+args+','+lit(op())+','+json(pr)+');';const pf=call(poolWrite);assert.equal(pf.status,'accepted',JSON.stringify(pf));assert.deepEqual(call(poolWrite),pf);checkpoint('main_pool_final',pf);
for(const eid of[main,con]){
 const a=[actor,sid,tid,eid].map(lit).join(','),regular=eid===con,prefix=regular?'regular_consolation':'modern_event';
 const source=call('select app.current_'+prefix+'_final_source_v1('+a+');');checkpoint(prefix+'_final_source',source);assert.equal(source.status,'source_available',JSON.stringify(source));
 const keys=['qualificationId','ownershipRevisionId','prizeRevisionId','fundReviewId','regularAwardSetId',...regular?[]:['poolProposalRevisionId','poolFinalId']];
 const req={kind:regular?'regular-consolation-finalize-v1':'modern-event-finalize-v1',expectedSourceDigest:source.sourceDigest,...Object.fromEntries(keys.map(k=>[k,source[k]])),approved:true,reason:'Fictional explicit unpaid event approval'};
 const write='select public.record_'+prefix+'_final_provider_v1('+a+','+lit(op())+','+json(req)+');';const final=call(write);assert.equal(final.status,'accepted',JSON.stringify(final));assert.deepEqual(call(write),final);checkpoint(prefix+'_final',final);
 const w=call('select public.get_'+(regular?'regular_consolation_closure':'modern_event_closure')+'_workspace_v1('+a+');');checkpoint(prefix+'_closure_workspace',w);
 assert.equal(w.status,'review',JSON.stringify(w));
 const cr={kind:regular?'regular-consolation-close-v1':'modern-event-close-v1',expectedSourceDigest:w.source.sourceDigest,snapshotId:w.snapshotId,confirmed:true,reason:'Fictional explicit event-only close'};
 const close='select public.record_'+(regular?'regular_consolation_closure':'modern_event_closure')+'_provider_v1('+a+','+lit(op())+','+json(cr)+');';const closed=call(close);assert.equal(closed.status,'accepted',JSON.stringify(closed));assert.deepEqual(call(close),closed);checkpoint(prefix+'_closed',closed);
}
report.passed=true;checkpoint('genuine_chain_completed',{main,con,moneyMoved:false,officialMrpAwarded:false,syntheticQualifyingUpstream:true,realProviderAcceptance:false});
