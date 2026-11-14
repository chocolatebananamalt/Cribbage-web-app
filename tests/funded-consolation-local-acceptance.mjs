// Fictional local funded linked Consolation; allocations/awards are bookkeeping only.
import assert from 'node:assert/strict';
import {createEventFinanceEditorV1,projectEventFinanceSectionV1}from'../src/lib/finance/event-finance-workspace-v1.ts';
import {prepareNativeFundReviewRequestV1}from'../src/lib/finance/native-fund-review-operation-v1.ts';
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
export async function verifyFundedConsolation({q,read,actorId,outsiderId,tournamentId,eventId,nextOperationId,writeEvidence=()=>{}}){
 const owner=(sql,who=actorId)=>read(sql,who,'ownerAuthenticated');
 const auth=(sql,who=actorId)=>read(sql,who,'authenticated');
 const names=['event_settings_operational_activation','linked_consy_native_losses','operational_event_finance_proposals','native_recorded_fund_review_source','native_playoff_finance_recipient_source','native_playoff_final_awards','operational_provider_transport'];
 const original=Object.fromEntries(names.map(n=>[n,owner(`select to_jsonb(pg_get_functiondef('app.${n}_enabled_v1()'::regprocedure));`)]));
 const mainId=owner(`select to_jsonb(app.linked_consolation_main_event_v1('${tournamentId}','${eventId}'));`);
 const mainHistory=()=>owner(`select jsonb_build_object('proposals',(select jsonb_agg(to_jsonb(r)order by version)from app.operational_event_finance_revisions_v1 r where event_id='${mainId}'),'series',(select jsonb_agg(to_jsonb(r)order by id)from app.playoff_series_results_v1 r where event_id='${mainId}'),'awards',(select count(*)from app.native_playoff_final_award_sets_v1 where event_id='${mainId}'));`);
 const priorMain=mainHistory();
 try{
  q(names.map(n=>`create or replace function app.${n}_enabled_v1()returns boolean language sql stable set search_path=''as $$select true$$;alter function app.${n}_enabled_v1()owner to postgres;revoke all on function app.${n}_enabled_v1()from public,anon,authenticated,service_role;`).join('\n'));
  const assessment=owner(`select jsonb_build_object('snapshotId',id,'totalMinor',total_cents,'rateMinor',rate_cents,'count',eligible_participant_count)from app.event_sanctioning_fee_snapshots where tournament_id='${tournamentId}'and event_id='${eventId}';`);
  assert.deepEqual({total:assessment.totalMinor,rate:assessment.rateMinor,count:assessment.count},{total:1600,rate:100,count:16});
  const expense=(amount,note)=>{const r=owner(`select public.record_tournament_expense('${tournamentId}',${amount},'USD','${note}','${nextOperationId()}');`);assert.equal(r.status,'expense_recorded');return r;};
  const sanction=expense(assessment.totalMinor,'TEST ONLY Consolation sanction assessment recorded once');
  const printing=expense(400,'TEST ONLY explicit Consolation printing cost four dollars');
  const facts=owner(`select app.get_native_event_ledger_sources_v1('${tournamentId}');`);assert.equal(facts.status,'sources_available');
  const head=owner(`select jsonb_build_object('id',id,'allocations',request_payload->'allocations')from app.native_ledger_allocation_revisions_v1 where tournament_id='${tournamentId}'order by version desc limit 1;`);
  const allocations=[...head.allocations,...[sanction,printing].map(e=>({sourceId:e.expenseEventId,allocations:[{eventId,bucket:'operating_expense',poolId:null,amountMinor:e.amountMinor,classificationReviewed:true}]}))];
  const allocationRequest={kind:'native-ledger-allocation-v1',operationId:nextOperationId(),expectedRevisionId:head.id,sourceDigest:facts.sourceDigest,allocations,reason:'TEST ONLY preserve all Main/Con receipts and Main expenses; add separately recorded Con costs',reviewed:true};
  const saved=owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(allocationRequest)});`);assert.equal(saved.status,'accepted',JSON.stringify(saved));
  assert.deepEqual(owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(allocationRequest)});`),{...saved,replayed:true,historicalReceipt:true,fundAvailable:false});
  for(const row of allocations){const physical=[...facts.facts.receiptEvents,...facts.facts.expenseEvents].find(x=>x.sourceId===row.sourceId);assert.ok(physical);assert.equal(row.allocations.reduce((n,x)=>n+x.amountMinor,0),physical.amountMinor);assert.ok(row.allocations.every(x=>!['q','side'].includes(x.bucket)));}
  const finance=owner(`select app.get_operational_event_finance_source_v1('${tournamentId}','${eventId}');`);writeEvidence('funded-con-finance-source.json',finance);assert.equal(finance.status,'source_available',JSON.stringify(finance));
  const workspace=finance.basis.workspace;assert.equal(workspace.grossEntryMinor,16000);assert.equal(workspace.paidEntryCount,16);assert.equal(workspace.entryCount,16);assert.equal(workspace.qualifierCount,4);
  const editor=createEventFinanceEditorV1(workspace);assert.ok(editor);const projected=projectEventFinanceSectionV1(editor,workspace);writeEvidence('funded-con-projection.json',projected);
  assert.equal(projected.fundMinor,14000);assert.equal(projected.adjustedTotalMinor,14000);assert.equal(projected.differenceMinor,0);
  const proposalRequest={kind:'operational-event-finance-proposal-v1',operationId:nextOperationId(),expectedVersion:0,expectedSourceDigest:finance.sourceDigest,expectedBasisDigest:finance.basisDigest,editor,reason:'TEST ONLY separately funded Consolation normal graduated equal-band proposal'};
  const proposal=auth(`select public.save_operational_finance_proposal_provider_v1('${tournamentId}','${eventId}',${literal(proposalRequest)});`);writeEvidence('funded-con-proposal.json',proposal);assert.equal(proposal.outcome.status,'accepted',JSON.stringify(proposal));
  const fund=auth(`select public.get_native_recorded_fund_review_source_provider_v1('${tournamentId}','${eventId}');`);writeEvidence('funded-con-fund-source.json',fund);assert.equal(fund.status,'review_source_available',JSON.stringify(fund));
  assert.equal(fund.totals.recordedFundMinor,14000);assert.equal(fund.income.activeMinor,0);
  const scope={actorId,tournamentId,eventId};const request=prepareNativeFundReviewRequestV1(fund,scope,nextOperationId(),sanction.expenseEventId,'TEST ONLY reviewed complete separate Con fund; sanction included once',true);assert.ok(request);
  const reviewed=auth(`select public.review_native_recorded_fund_provider_v1('${tournamentId}','${eventId}',${literal(request)});`);assert.equal(reviewed.outcome.status,'accepted',JSON.stringify(reviewed));
  const source=auth(`select public.get_native_playoff_final_award_source_provider_v1('${tournamentId}','${eventId}');`);writeEvidence('funded-con-final-source.json',source);assert.equal(source.status,'source_available',JSON.stringify(source));
  assert.equal(source.fund.awardFundMinor,14000);assert.equal(source.sanctioning.totalMinor,1600);
  const amounts=source.projection.recipients.map(r=>r.amountMinor).sort((a,b)=>b-a);assert.deepEqual(amounts,[5500,3500,2500,2500]);
  const finalRequest={kind:'native-playoff-final-awards-v1',operationId:nextOperationId(),expectedVersion:0,expectedSourceDigest:source.sourceDigest,expectedRecipientSourceDigest:source.recipientSourceDigest,expectedFundSourceDigest:source.fundSourceDigest,expectedProposalRevisionId:source.proposal.revisionId,expectedFundReviewId:source.income.reviewId,reason:'TEST ONLY record unpaid Con awards; no payment or disbursement'};
  assert.equal(auth(`select public.get_native_playoff_final_award_source_provider_v1('${tournamentId}','${eventId}');`,outsiderId),null);
  const recorded=auth(`select public.record_native_playoff_final_awards_provider_v1('${tournamentId}','${eventId}',${literal(finalRequest)});`);writeEvidence('funded-con-final-receipt.json',recorded);assert.equal(recorded.outcome.status,'accepted',JSON.stringify(recorded));
  const replay=auth(`select public.record_native_playoff_final_awards_provider_v1('${tournamentId}','${eventId}',${literal(finalRequest)});`);assert.equal(replay.outcome.awardSetId,recorded.outcome.awardSetId);
  const reconciliation=auth(`select public.get_native_playoff_finance_write_reconciliation_provider_v1('${tournamentId}','${eventId}','${finalRequest.operationId}');`);assert.deepEqual(reconciliation.request,finalRequest);assert.equal(reconciliation.outcome.awardSetId,recorded.outcome.awardSetId);
  const stored=auth(`select public.get_native_playoff_final_award_record_provider_v1('${tournamentId}','${eventId}');`);writeEvidence('funded-con-stored-awards.json',stored);assert.equal(stored.status,'recorded');assert.equal(stored.totalMinor,14000);assert.equal(stored.recipientCount,4);assert.equal(stored.groups.length,3);assert.deepEqual(stored.sourceCapture,source);
  assert.deepEqual(stored.recipients.map(r=>r.amountMinor).sort((a,b)=>b-a),amounts);for(const f of ['moneyMoved','payoutAuthorized','finalizationAuthorized'])assert.equal(stored[f],false);
  assert.deepEqual(mainHistory(),priorMain);
  const main=owner(`select app.get_operational_event_finance_source_v1('${tournamentId}','${mainId}');`);assert.equal(main.status,'source_available');assert.equal(main.basis.workspace.grossEntryMinor,54000);
  const result={passed:true,eventId,entryMinor:16000,paidEntrants:16,sanctionMinor:1600,printingMinor:400,awardFundMinor:14000,awardAmountsMinor:amounts,recordedUnpaid:true,mainEntryMinor:54000,mainHistoryUnchanged:true,physicalPlayVerified:false,providerCookieIdentityProved:false,moneyMoved:false};writeEvidence('funded-con-result.json',result);return result;
 }finally{q(Object.values(original).join(';\n'));for(const[n,d]of Object.entries(original))assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.${n}_enabled_v1()'::regprocedure));`),d);}
}
