// Injected-DB helper only. The runtime lead owns the disposable database and
// lifecycle fixture. This never creates a database or seeds sporting results.
import assert from 'node:assert/strict';
import {calculateCustomGraduatedAmountsV3}from'../src/lib/results/custom-graduated-amounts-v3.ts';

const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const json=value=>`${quote(JSON.stringify(value))}::jsonb`;

export function verifyCustomSideAmountParityV4(sql){
 const cases=[];
 for(const paidCount of[0,1,2,7,28,89,9999,10000])for(const ratio of[1,3,7,100,2147483647])for(const feeMinor of[500,1500,100000000])cases.push({paidCount,feeMinor,ratio});
 const actual=JSON.parse(sql(`select jsonb_agg(app.calculate_custom_graduated_amounts_v3(value)order by ord)from jsonb_array_elements(${json(cases)})with ordinality as x(value,ord);`));
 for(const[i,input]of cases.entries())assert.deepEqual(actual[i],calculateCustomGraduatedAmountsV3(input));
 const blocked=JSON.parse(sql(`select app.project_side_custom_source_v4(${json({policy:{id:'00000000-0000-4000-8000-000000000001',method:'side-custom-graduated-policy-v4'},paidCount:0,blockers:[],calculation:{status:'calculated',recipientCount:0},manifest:{}})},${json({policyId:'00000000-0000-4000-8000-000000000001'})});`));
 assert.deepEqual(blocked.blockers,['side_no_eligible_recipients']);assert.equal(blocked.calculation,null);
 return{amountCases:cases.length,zeroEligibleBlocked:true,noRefundPolicy:'no-pool-refunds-v1'};
}

export function publishCustomSidePoliciesV4({sql,actor,tournamentId,eventId,poolId,setupSidePoolVersionId,definitionVersionId,intent,ratio,legacyOperationId,policyOperationId,combinedBlockOperationId,recipientOperationId,zeroReviewOperationId,disclosureReference,combinedEnabled=false}){
 const service=statement=>sql(`set role service_role;set request.jwt.claim.role='service_role';set request.jwt.claims='{"role":"service_role"}';${statement}`);
 const roleSql=(role,statement)=>`set role ${role};set request.jwt.claim.sub='${actor}';set request.jwt.claim.role='${role}';set request.jwt.claims='{"role":"${role}","sub":"${actor}"}';${statement}`;
 const denied=(role,statement)=>{assert.throws(()=>sql(roleSql(role,statement)),/permission denied|42501/i);return true;};
 const request={action:'publish',setupSidePoolVersionId,definitionVersionId,method:'side-custom-graduated-policy-v4',ratio,amountMethod:'graduated-custom-ratio-largest-remainder-5usd-v3',disclosureReference,disclosed:true,intent};
 const stored=JSON.parse(sql(`select original_intent from app.setup_custom_payout_intents_v2 where tournament_id=${quote(tournamentId)} and scope='side' and ratio_denominator=${ratio} and amount_method='graduated-custom-ratio-largest-remainder-5usd-v3' and original_intent=${json(intent)};`));
 assert.deepEqual(stored,intent);
 const legacyRequest={method:'graduated-acc-weighted-largest-remainder-5usd-v2',ratio,definitionVersionId,disclosureReference:'TEST ONLY legacy method must not adopt custom setup',disclosed:true};
 const legacy=JSON.parse(service(`select public.save_side_pool_graduated_policy_v2(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(poolId)},${json(legacyRequest)},${quote(legacyOperationId)});`));assert.equal(legacy.status,'rejected');assert.equal(legacy.code,'invalid_request');
 assert.equal(sql(`select count(*)from app.side_pool_graduated_policies_v2 where pool_id=${quote(poolId)};`),'0');
 const call=(body=request,op=policyOperationId)=>JSON.parse(service(`select public.save_side_custom_policy_v4(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(poolId)},${json(body)},${quote(op)});`)||'null');
 const accepted=call();assert.equal(accepted.status,'side_custom_policy_published_v4');assert.equal(accepted.moneyMoved,false);assert.equal(accepted.setupSidePoolVersionId,setupSidePoolVersionId);assert.equal(accepted.definitionVersionId,definitionVersionId);
 assert.deepEqual(call(),accepted);assert.equal(call({...request,ratio:ratio+1}).code,'idempotency_conflict');
 const reconciliation=JSON.parse(service(`select public.get_side_custom_policy_reconciliation_v4(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(poolId)},${quote(policyOperationId)},${json(request)});`));assert.deepEqual(reconciliation,{authorized:true,result:accepted});
 const binding=JSON.parse(sql(`select app.custom_side_policy_binding_v4(${quote(tournamentId)},${quote(eventId)},${quote(poolId)});`));assert.equal(binding.policyId,accepted.policyId);assert.deepEqual(binding.originalIntent,intent);assert.equal(binding.amountMethod,request.amountMethod);
 let v9Source=null,v9Request=null,combinedBlocked=null;
 if(!combinedEnabled){
  v9Source=JSON.parse(sql(`select app.prize_accounting_source_v9(${quote(actor)},${quote(tournamentId)},${quote(eventId)});`));assert.ok(v9Source.blockers.includes('custom_side_combined_accounting_unsupported'));assert.equal(v9Source.facts,null);
  v9Request={expectedVersion:0,reason:'TEST ONLY custom Side must not enter combined V9',reviewed:true};
  combinedBlocked=JSON.parse(service(`select public.save_prize_accounting_draft_v9(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${json(v9Request)},${quote(combinedBlockOperationId)});`));assert.equal(combinedBlocked.status,'rejected');assert.equal(combinedBlocked.code,'source_blocked');assert.deepEqual(JSON.parse(service(`select public.save_prize_accounting_draft_v9(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${json(v9Request)},${quote(combinedBlockOperationId)});`)),combinedBlocked);
 }
 const recipientRequest={amountPolicyId:accepted.policyId,method:'paid-qualifying-cards-no-cutoff-v3',disclosureReference:'TEST ONLY paid-card Side recipient disclosure',disclosed:true};
 const recipient=JSON.parse(service(`select public.publish_side_pool_recipient_policy_v3(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(poolId)},${json(recipientRequest)},${quote(recipientOperationId)});`));assert.equal(recipient.status,'side_pool_recipient_policy_frozen');assert.equal(recipient.moneyMoved,false);
 const zeroSource=JSON.parse(sql(`select app.side_pool_recipient_source_v3(${quote(tournamentId)},${quote(eventId)},${quote(poolId)});`));assert.ok(zeroSource.blockers.includes('side_no_eligible_recipients'));assert.equal(zeroSource.obligations.length,0);
 const zeroRequest={expectedVersion:0,sourceDigest:zeroSource.sourceDigest,reason:'TEST ONLY zero-paid Side source remains blocked',reviewed:true};
 const zeroReview=JSON.parse(service(`select public.record_side_pool_recipient_review_v3(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(poolId)},${json(zeroRequest)},${quote(zeroReviewOperationId)});`));assert.equal(zeroReview.status,'rejected');assert.equal(zeroReview.code,'source_blocked');assert.equal(sql(`select count(*)from app.side_pool_recipient_reviews_v3 where pool_id=${quote(poolId)};`),'0');
 const saveSql=`select public.save_side_custom_policy_v4(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(poolId)},${json(request)},${quote(policyOperationId)});`,reconcileSql=`select public.get_side_custom_policy_reconciliation_v4(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(poolId)},${quote(policyOperationId)},${json(request)});`;
 const roleProof={serviceReplay:JSON.parse(service(saveSql)),serviceReconciliation:JSON.parse(service(reconcileSql))};assert.deepEqual(roleProof.serviceReplay,accepted);assert.deepEqual(roleProof.serviceReconciliation,{authorized:true,result:accepted});
 for(const role of['anon','authenticated']){roleProof[`${role}SaveDenied`]=denied(role,saveSql);roleProof[`${role}ReconciliationDenied`]=denied(role,reconcileSql);}
 roleProof.servicePrivateImplementationDenied=denied('service_role',`select app.save_side_custom_policy_v4_impl(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(poolId)},${json(request)},${quote(policyOperationId)});`);
 roleProof.servicePrivateReconciliationDenied=denied('service_role',`select app.get_side_custom_policy_reconciliation_v4_impl(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(poolId)},${quote(policyOperationId)},${json(request)});`);
 return{legacyRequest,legacy,request,accepted,reconciliation,binding,v9Source,v9Request,combinedBlocked,recipientRequest,recipient,zeroSource,zeroRequest,zeroReview,roleProof};
}

export function recordCustomSideRecipientReviewV4({sql,actor,tournamentId,eventId,poolId,operationId,reason}){
 const service=statement=>sql(`set role service_role;set request.jwt.claim.role='service_role';set request.jwt.claims='{"role":"service_role"}';${statement}`);
 const source=JSON.parse(sql(`select app.side_pool_recipient_source_v3(${quote(tournamentId)},${quote(eventId)},${quote(poolId)});`));
 assert.deepEqual(source.blockers,[]);assert.ok(source.obligations.length>0);assert.equal(source.moneyMoved,false);
 assert.equal(source.manifest.amountSource.manifest.sourceVersion,'side-custom-amount-source-v4');
 assert.equal(source.manifest.amountSource.manifest.refundPolicy,'no-pool-refunds-v1');
 assert.equal(source.obligations.reduce((sum,row)=>sum+Number(row.amountMinor),0),Number(source.fundMinor));
 assert.ok(source.obligations.every((row,index)=>row.status==='unpaid'&&row.amountMinor>0&&row.amountMinor%500===0&&row.poolRank===index+1));
 const workspace=JSON.parse(service(`select public.get_side_pool_recipient_workspace_v3(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(poolId)});`));
 const request={expectedVersion:workspace.history.length===0?0:Math.max(...workspace.history.map(row=>row.version)),sourceDigest:source.sourceDigest,reason,reviewed:true};
 const result=JSON.parse(service(`select public.record_side_pool_recipient_review_v3(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(poolId)},${json(request)},${quote(operationId)});`));
 assert.equal(result.status,'side_pool_recipients_reviewed_unpaid');assert.equal(result.moneyMoved,false);assert.deepEqual(result.obligations,source.obligations);
 const replay=JSON.parse(service(`select public.record_side_pool_recipient_review_v3(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(poolId)},${json(request)},${quote(operationId)});`));assert.deepEqual(replay,result);
 const reconciliation=JSON.parse(service(`select public.get_side_pool_recipient_reconciliation_v3(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(poolId)},${json(request)},${quote(operationId)});`));assert.deepEqual(reconciliation,{authorized:true,result});
 return{source,workspace,request,result,replay,reconciliation,moneyMoved:false,combinedQSideSupported:false,providerVerified:false};
}
