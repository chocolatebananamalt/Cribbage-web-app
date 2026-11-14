// Injected-DB combined acceptance. The lead owns the disposable database,
// setup/activation and synthetic collection callback. No database is launched.
import assert from'node:assert/strict';
import {calculateCustomGraduatedAmountsV3}from'../src/lib/results/custom-graduated-amounts-v3.ts';
import {publishCustomQPolicyV5,recordCustomQReviewV5}from'./custom-q-accounting-bridge-local-acceptance.mjs';
import {publishCustomSidePoliciesV4,recordCustomSideRecipientReviewV4}from'./custom-side-accounting-bridge-local-acceptance.mjs';

const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const json=value=>`${quote(JSON.stringify(value))}::jsonb`;

/** The caller must provide an activated Main event before collection and a
 * callback that uses the supported local synthetic election/receipt/score/
 * qualification path. This helper adds no raw sporting or financial rows. */
export function verifyCustomQSideCombinedAccountingV10({
 sql,actor,tournamentId,eventId,q,side,preparedPolicies=null,collectionEvidence=null,
 completeSyntheticCollection=null,expenseClassifications,operations,checkpoint=()=>{},
}){
 assert.equal(side.ratio,5);assert.equal(side.feeMinor,1000);
 const service=statement=>sql(`set role service_role;set request.jwt.claim.role='service_role';${statement}`);
 const qPolicy=preparedPolicies?.qPolicy??publishCustomQPolicyV5({sql,actor,tournamentId,eventId,poolVersionId:q.poolVersionId,operationId:q.policyOperationId,request:q.policyRequest});
 const sidePolicies=preparedPolicies?.sidePolicies??publishCustomSidePoliciesV4({sql,actor,tournamentId,eventId,...side,combinedEnabled:true});
 checkpoint('policies',{qPolicy,sidePolicies,eventId,syntheticFoundations:true,moneyMoved:false});

 const collection=collectionEvidence??completeSyntheticCollection?.({sql,actor,tournamentId,eventId,q,side});assert.ok(collection);
 assert.equal(collection.paidEntrants,16);assert.equal(collection.qualifierCount,4);
 assert.equal(collection.qCustomPaidEntrants,16);assert.equal(collection.qEqualPaidEntrants,1);assert.equal(collection.sidePaidEntrants,16);
 checkpoint('collection_qualification',{collection,paidEntrants:16,qualifierCount:4,providerVerified:false});

 const qReview=recordCustomQReviewV5({sql,actor,tournamentId,eventId,poolVersionId:q.poolVersionId,operationId:q.reviewOperationId,reason:'TEST ONLY source-bound Custom Q7 combined review'});
 const customQ=qReview.source.obligations.find(item=>item.poolVersionId===q.poolVersionId);assert.ok(customQ);assert.equal(customQ.kind,'award');assert.equal(customQ.fundMinor,16000);assert.deepEqual(customQ.rows.map(row=>row.amountMinor),[8000,5500,2500]);
 assert.deepEqual(customQ.rows.map(row=>row.participantId),q.expectedCustomParticipants);
 assert.equal(qReview.source.obligations.some(item=>item.kind==='refund'),false);
 const equalQ=qReview.source.obligations.find(item=>item.poolVersionId===q.equalPoolVersionId);assert.ok(equalQ);assert.equal(equalQ.kind,'award');assert.equal(equalQ.fundMinor,1000);assert.equal(equalQ.rows.length,1);assert.equal(equalQ.rows[0].participantId,q.equalParticipantId);
 const sideReview=recordCustomSideRecipientReviewV4({sql,actor,tournamentId,eventId,poolId:side.poolId,operationId:side.reviewOperationId,reason:'TEST ONLY source-bound Custom Side5 combined review'});
 const expectedSide=calculateCustomGraduatedAmountsV3({paidCount:16,feeMinor:side.feeMinor,ratio:5});assert.equal(expectedSide.status,'calculated');assert.equal(expectedSide.fundMinor,16000);assert.deepEqual(sideReview.source.obligations.map(row=>row.amountMinor),expectedSide.awardsMinor);
 assert.deepEqual(sideReview.source.obligations.map(row=>row.participantId),side.expectedParticipants);
 checkpoint('unpaid_reviews',{qReview,sideReview,customQ,equalQ,noPoolRefunds:true,moneyMoved:false});

 const source=JSON.parse(sql(`select app.prize_accounting_source_v9(${quote(actor)},${quote(tournamentId)},${quote(eventId)});`));assert.deepEqual(source.blockers,[]);assert.ok(source.facts);
 const manifestText=JSON.stringify(source.manifest);for(const token of['custom-pool-accounting-v10','no-pool-refunds-v1','customSideScope'])assert.ok(manifestText.includes(token),token);
 assert.equal(source.facts.baseIncomeMinor,48000);assert.equal(source.facts.expenseTotalMinor,5000);assert.equal(source.facts.regularAwardMinor,43000);assert.equal(source.facts.qIncomeMinor,17000);assert.equal(source.facts.sideIncomeMinor,16000);
 const workspace=JSON.parse(service(`select public.get_prize_accounting_workspace_v9(${quote(actor)},${quote(tournamentId)},${quote(eventId)});`));assert.deepEqual(workspace.blockers,[]);assert.equal(workspace.sourceDigest,source.sourceDigest);assert.equal(workspace.automaticPayment,false);assert.equal(workspace.currentDraftVersion,0);
 const classifications=expenseClassifications??source.facts.expenseEvidence.map(row=>({expenseEventId:row.expenseEventId,category:String(row.description).replace('TEST ONLY ',''),evidenceReference:'TEST ONLY exact synthetic expense classification'}));
 const draftRequest={expectedVersion:0,sourceDigest:source.sourceDigest,expenseClassifications:classifications,reason:'TEST ONLY combined Custom Q7 and Side5 unpaid accounting',reviewed:true};
 const saveDraft=(body=draftRequest,op=operations.draft)=>JSON.parse(service(`select public.save_prize_accounting_draft_v9(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${json(body)},${quote(op)});`));
 const wrongDigest=saveDraft({...draftRequest,sourceDigest:'0'.repeat(64)},operations.wrongDigest);assert.equal(wrongDigest.code,'source_changed');
 const draft=saveDraft();assert.equal(draft.status,'prize_accounting_draft_saved_v9');assert.deepEqual(saveDraft(),draft);
 const draftReconciliation=JSON.parse(service(`select public.reconcile_prize_accounting_v9(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(operations.draft)},'draft',${json(draftRequest)});`));assert.deepEqual(draftReconciliation,{authorized:true,result:draft});
 const afterDraft=JSON.parse(service(`select public.get_prize_accounting_workspace_v9(${quote(actor)},${quote(tournamentId)},${quote(eventId)});`));assert.equal(afterDraft.draft.id,draft.draftId);assert.equal(afterDraft.draft.current,true);assert.equal(afterDraft.funding.shortfallMinor,0);assert.equal(afterDraft.funding.unallocatedMinor,0);
 checkpoint('combined_draft',{source,workspace,draftRequest,draft,draftReconciliation,afterDraft});

 const finalRequest={expectedVersion:0,draftId:draft.draftId,draftVersion:draft.version,expectedFundingVersion:afterDraft.funding.version,reason:'TEST ONLY combined custom accounting remains unpaid',reviewed:true};
 const expenseCountBefore=sql(`select count(*)from app.tournament_expense_events where tournament_id=${quote(tournamentId)};`);
 sql(`begin;do $stale$declare r jsonb;w jsonb;begin perform set_config('request.jwt.claim.sub',${quote(actor)},true);r:=public.record_tournament_expense(${quote(tournamentId)},25,'USD','TEST ONLY rollback stale combined draft',${quote(operations.staleExpense)});if r->>'status'is distinct from'expense_recorded'then raise exception'stale expense setup failed %',r;end if;w:=public.get_prize_accounting_workspace_v9(${quote(actor)},${quote(tournamentId)},${quote(eventId)});if w->'draft'->>'current'is distinct from'false'then raise exception'stale draft remained current %',w;end if;r:=public.finalize_prize_accounting_v9(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${json(finalRequest)},${quote(operations.staleFinal)});if r->>'code'is distinct from'source_changed'then raise exception'stale final accepted %',r;end if;end$stale$;rollback;`);assert.equal(sql(`select count(*)from app.tournament_expense_events where tournament_id=${quote(tournamentId)};`),expenseCountBefore);
 const saveFinal=(op=operations.final)=>JSON.parse(service(`select public.finalize_prize_accounting_v9(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${json(finalRequest)},${quote(op)});`));
 const final=saveFinal();assert.equal(final.status,'prize_accounting_finalized_unpaid_v9');assert.deepEqual(saveFinal(),final);
 const finalReconciliation=JSON.parse(service(`select public.reconcile_prize_accounting_v9(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${quote(operations.final)},'final',${json(finalRequest)});`));assert.deepEqual(finalReconciliation,{authorized:true,result:final});
 const finalized=JSON.parse(service(`select public.get_prize_accounting_workspace_v9(${quote(actor)},${quote(tournamentId)},${quote(eventId)});`));assert.equal(finalized.finalization.status,'unpaid');assert.equal(finalized.finalization.current,true);assert.equal(finalized.automaticPayment,false);
 sql(`begin;delete from app.tournament_roles where tournament_id=${quote(tournamentId)}and profile_id=${quote(actor)};do $revoked$declare r jsonb;begin r:=public.finalize_prize_accounting_v9(${quote(actor)},${quote(tournamentId)},${quote(eventId)},${json(finalRequest)},${quote(operations.final)});if r->>'code'is distinct from'not_director'then raise exception'revoked replay leaked %',r;end if;end$revoked$;rollback;`);
 checkpoint('combined_final',{finalRequest,final,finalReconciliation,finalized,staleSourceRollback:true,revokedReplayDenied:true,moneyMoved:false,providerVerified:false});
 return{qPolicy,sidePolicies,collection,qReview,sideReview,source,draftRequest,draft,draftReconciliation,finalRequest,final,finalReconciliation,finalized,noPoolRefunds:true,staleSourceRollback:true,revokedReplayDenied:true,serviceReplay:true,concurrencyTested:false,moneyMoved:false,providerVerified:false,syntheticFoundations:true};
}
