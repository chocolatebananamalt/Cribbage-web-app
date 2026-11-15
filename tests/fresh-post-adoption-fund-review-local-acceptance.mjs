import assert from'node:assert/strict';
import{readNativeRecordedFundReviewSourceServerV1}from'../src/lib/api/native-recorded-fund-review-source-v1.ts';
import{readNativeRecordedFundReviewSourceV1}from'../src/lib/finance/native-recorded-fund-review-source-v1.ts';
import{projectNativeFinalRecipientEstimateV1}from'../src/lib/finance/native-playoff-recipient-v1.ts';
import{prepareNativeFundReviewRequestV1,NativeFundReviewOperationV1}from'../src/lib/finance/native-fund-review-operation-v1.ts';
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
export async function verifyFreshPostAdoptionFundReviewV1({q,read,withHeldLock,parallelQueries,actorId,outsiderId,tournamentId,crossEventId,nextOperationId,writeEvidence=()=>{}}){
 const owner=(sql,who=actorId)=>read(sql,who,'ownerAuthenticated'),eventId=owner(`select to_jsonb(event_id)from app.event_settings_operational_bindings_v1 where tournament_id='${tournamentId}'`),scope={actorId,tournamentId,eventId};
 const gates=['native_recorded_fund_review_source','native_playoff_finance_recipient_source','native_playoff_final_awards','operational_provider_transport'];
 const original=Object.fromEntries(gates.map(name=>[name,owner(`select to_jsonb(pg_get_functiondef('app.${name}_enabled_v1()'::regprocedure))`)]));
 for(const definition of Object.values(original))assert.match(definition,/select false/i);
 assert.deepEqual(owner(`select app.get_native_recorded_fund_review_source_v1('${tournamentId}','${eventId}')`),{status:'blocked',code:'feature_unavailable'});
 assert.equal(owner(`select public.get_native_recorded_fund_review_source_provider_v1('${tournamentId}','${eventId}')`),null);
 const marker="set app.fixture_fresh_fund_review='approved-local-only';",enabled=(sql,who=actorId)=>owner(marker+sql,who);
 const get=()=>enabled(`select public.get_native_recorded_fund_review_source_provider_v1('${tournamentId}','${eventId}')`);
 const post=request=>enabled(`select public.review_native_recorded_fund_provider_v1('${tournamentId}','${eventId}',${literal(request)})`);
 try{
  q(gates.map(name=>`create or replace function app.${name}_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_fresh_fund_review',true)='approved-local-only',false)$$;alter function app.${name}_enabled_v1()owner to postgres;revoke all on function app.${name}_enabled_v1()from public,anon,authenticated,service_role;`).join('\n'));
  // An estimated donation carried through adoption must not become recorded cash.
  assert.deepEqual(get(),{status:'blocked',code:'income_history_incomplete'});
  const proposal=enabled(`select jsonb_build_object('id',id,'editor',editor)from app.operational_event_finance_revisions_v1 where tournament_id='${tournamentId}'and event_id='${eventId}'order by version desc limit 1`),incomeLine=proposal.editor.history.slice(proposal.editor.basis.history.length)[0];
  assert.equal(incomeLine.line.category,'unrestricted_income');assert.equal(incomeLine.line.amountMinor,500);
  const recorded=enabled(`select public.record_native_unrestricted_income_provider_v1('${tournamentId}','${eventId}',${literal({kind:'native-unrestricted-income-record-v1',operationId:nextOperationId(),expectedVersion:0,proposalRevisionId:proposal.id,recordId:incomeLine.line.recordId,physicalEvidenceId:nextOperationId(),evidenceReference:'TEST ONLY local donation bookkeeping - no real money'})})`);
  assert.equal(recorded.outcome.status,'accepted',JSON.stringify(recorded));
  const raw=get();writeEvidence('fresh-fund-review-source-observed.json',raw);const source=readNativeRecordedFundReviewSourceServerV1(raw,scope);writeEvidence('fresh-fund-review-source-diagnostic.json',{status:raw?.status,code:raw?.code,pureDecoderPassed:!!readNativeRecordedFundReviewSourceV1(raw,scope),nativeProjection:raw?.recipientSource?projectNativeFinalRecipientEstimateV1(raw.recipientSource,scope):null});assert.ok(source,'actual SQL source must pass independent native game/recipient proof');
  assert.equal(source.totals.regularEntryMinor,54000);assert.equal(source.totals.operatingExpenseMinor+source.totals.benefitExpenseMinor,6400);assert.equal(source.income.activeMinor,500);assert.equal(source.totals.recordedFundMinor,48100);assert.equal(source.sanctioning.totalMinor,5400);assert.equal(source.sanctioning.candidates.length,1);
  const expense=source.sanctioning.candidates[0].expenseSourceId;
  assert.equal(source.sanctioning.candidates[0].allocatedExpenseMinor,5400);
  const request=prepareNativeFundReviewRequestV1(source,scope,nextOperationId(),expense,'TEST ONLY fresh post-adoption recorded-fund review',true);assert.ok(request);
  // Owner-seeded historical inconsistency only, inside rollback. No trigger,
  // constraint or authorization setting is weakened. Ordinary writers cannot
  // create this state; readers/writers must also fail closed if it pre-exists.
  const crossEventEvidence=[];
  for(const physical of[expense,source.recipientSource.nativeFinanceSource.raw.allocation.eventSources.find(s=>s.kind==='entry_receipt').sourceId]){
   const financeOp=nextOperationId(),financeRevision=nextOperationId(),nativeOp=nextOperationId(),incomeId=nextOperationId(),recordId=nextOperationId();
   const corruption=enabled(`begin;
    insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method)
     select '${crossEventId}',tournament_id,ruleset_version_id,'TEST ONLY rollback cross-event guard','satellite','standard_singles','digital'from app.events where id='${eventId}';
    insert into app.operational_event_finance_operations_v1(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)
     select '${actorId}','${financeOp}','${tournamentId}','${crossEventId}','{}'::jsonb,encode(extensions.digest(convert_to(jsonb_build_array('operational-event-finance-proposal-v1','${actorId}'::uuid,'${tournamentId}'::uuid,'${crossEventId}'::uuid,'${financeOp}'::uuid,'{}'::jsonb)::text,'utf8'),'sha256'),'hex');
    insert into app.operational_event_finance_revisions_v1 select (jsonb_populate_record(null::app.operational_event_finance_revisions_v1,to_jsonb(r)||jsonb_build_object('id','${financeRevision}','event_id','${crossEventId}','version',1,'prior_revision_id',null,'operation_id','${financeOp}','qualification_result_version_id',null))).*
     from app.operational_event_finance_revisions_v1 r where id='${proposal.id}';
    insert into app.native_playoff_finance_write_operations_v1(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)
     select '${actorId}','${nativeOp}','${tournamentId}','${crossEventId}','{}'::jsonb,encode(extensions.digest(convert_to(jsonb_build_array('native-playoff-finance-write-v1','${actorId}'::uuid,'${tournamentId}'::uuid,'${crossEventId}'::uuid,'${nativeOp}'::uuid,'{}'::jsonb)::text,'utf8'),'sha256'),'hex');
    insert into app.native_unrestricted_income_sources_v1(tournament_id,event_id,income_id,physical_evidence_id,evidence_reference,created_by)
     values('${tournamentId}','${crossEventId}','${incomeId}','${physical}','TEST ONLY cross-event ${incomeId}','${actorId}');
    insert into app.native_unrestricted_income_records_v1(tournament_id,event_id,version,income_id,record_id,prior_record_id,physical_evidence_id,evidence_reference,proposal_revision_id,amount_minor,voided,label,reason,recorded_by,actor_id,operation_id,source_capture,source_digest)
     values('${tournamentId}','${crossEventId}',1,'${incomeId}','${recordId}',null,'${physical}','TEST ONLY cross-event ${incomeId}','${financeRevision}',100,false,'TEST ONLY historical collision','Rollback-only negative fixture','${actorId}','${actorId}','${nativeOp}','{}'::jsonb,repeat('a',64));
    select jsonb_build_object('source',app.get_native_recorded_fund_review_source_v1('${tournamentId}','${eventId}'),'write',public.review_native_recorded_fund_provider_v1('${tournamentId}','${eventId}',${literal({...request,operationId:nextOperationId()})}),'final',app.native_playoff_final_award_source_v1('${tournamentId}','${eventId}','${actorId}'),
     'globalCollision',exists(select 1 from app.native_unrestricted_income_records_v1 ir where ir.tournament_id='${tournamentId}'and exists(select 1 from app.roster_payment_events p where p.tournament_id=ir.tournament_id and p.id=ir.physical_evidence_id union all select 1 from app.tournament_expense_events x where x.tournament_id=ir.tournament_id and x.id=ir.physical_evidence_id)),
     'oldEventScopedCollision',exists(select 1 from app.native_unrestricted_income_records_v1 ir where ir.tournament_id='${tournamentId}'and ir.event_id='${eventId}'and exists(select 1 from app.roster_payment_events p where p.tournament_id=ir.tournament_id and p.id=ir.physical_evidence_id union all select 1 from app.tournament_expense_events x where x.tournament_id=ir.tournament_id and x.id=ir.physical_evidence_id)));rollback;`);
   assert.equal(corruption.globalCollision,true);assert.equal(corruption.oldEventScopedCollision,false);
   assert.equal(corruption.source.status,'blocked');assert.equal(corruption.write.outcome.status,'rejected');assert.equal(corruption.final.status,'blocked');crossEventEvidence.push({physical,globalCollision:corruption.globalCollision,oldEventScopedCollision:corruption.oldEventScopedCollision,source:corruption.source,write:corruption.write.outcome,final:corruption.final});
   assert.equal(owner(`select to_jsonb(count(*))from app.native_unrestricted_income_records_v1 where tournament_id='${tournamentId}'and event_id='${crossEventId}'`),0);
  }
  writeEvidence('fresh-fund-review-cross-event-collisions.json',crossEventEvidence);
  const missing=post({...request,operationId:nextOperationId(),sanctioningExpenseEventId:null});assert.equal(missing.outcome.status,'rejected');assert.equal(missing.outcome.code,'sanctioning_coverage_unverified');
  const stale=post({...request,operationId:nextOperationId(),expectedVersion:99});assert.equal(stale.outcome.status,'rejected');assert.equal(stale.outcome.code,'stale_version');
  const zero=post({...request,operationId:nextOperationId(),status:'reviewed_zero'});assert.equal(zero.outcome.status,'rejected');assert.equal(zero.outcome.code,'income_head_changed');
  assert.equal(enabled(`select to_jsonb(count(*))from app.native_recorded_fund_reviews_v1 where tournament_id='${tournamentId}'and event_id='${eventId}'`),0);
  const rolled=enabled(`begin;select public.review_native_recorded_fund_provider_v1('${tournamentId}','${eventId}',${literal(request)});rollback;`);assert.equal(rolled.outcome.status,'accepted');
  assert.equal(enabled(`select to_jsonb(count(*))from app.native_recorded_fund_reviews_v1 where tournament_id='${tournamentId}'and event_id='${eventId}'`),0);
  const first=post(request);assert.equal(first.outcome.status,'accepted');assert.equal(first.outcome.version,1);
  const replay=post(request);assert.equal(replay.outcome.historicalReceipt,true);assert.equal(replay.outcome.currentSourceVerified,false);
  const current=get();assert.equal(current.latestReview.reviewId,first.outcome.reviewId);
  const one=prepareNativeFundReviewRequestV1(current,scope,nextOperationId(),expense,'TEST ONLY concurrent fresh review A',true),two=prepareNativeFundReviewRequestV1(current,scope,nextOperationId(),expense,'TEST ONLY concurrent fresh review B',true);
  assert(one&&two);
  const race=(await parallelQueries([one,two].map(r=>`${marker}select public.review_native_recorded_fund_provider_v1('${tournamentId}','${eventId}',${literal(r)});`),actorId)).map(value=>JSON.parse(String(value).trim().split(/\r?\n/).at(-1)));
  const winner=race.find(r=>r.outcome.status==='accepted');assert.ok(winner,JSON.stringify(race));let loser=race.find(r=>r!==winner);assert(loser);
  if(loser.outcome.status==='retry_exact')loser=post(loser.operationId===one.operationId?one:two);
  assert.equal(loser.outcome.status,'rejected');assert.equal(loser.outcome.code,'stale_version');
  const latest=get();assert.equal(latest.expectedReviewVersion,2);assert.ok(readNativeRecordedFundReviewSourceServerV1(latest,scope));
  const receipts=new Map(),archives=new Map(),retained={read:async k=>receipts.get(k)??null,transition:async(k,prior,next,archive)=>{if((receipts.get(k)??null)!==prior)return false;if(archive)archives.set(archive.id,archive.raw);if(next===null)receipts.delete(k);else receipts.set(k,next);return true;}};
  const winnerRequest=winner.request,key=`native-fund-review-operation-v1:${actorId}:${tournamentId}:${eventId}`;
  receipts.set(key,JSON.stringify({kind:'native-fund-review-pending-v1',scope,request:winnerRequest}));
  const operation=new NativeFundReviewOperationV1(scope,retained,{save:async()=>{throw Error('must_not_repost')},reconcile:async op=>enabled(`select public.get_native_playoff_finance_write_reconciliation_provider_v1('${tournamentId}','${eventId}','${op}')`)});
  operation.setActive(true);await operation.initialize();assert.equal(operation.getSnapshot().status,'outcome_unknown');await operation.check(operation.getSnapshot());assert.equal(operation.getSnapshot().status,'accepted');
  const changed=structuredClone(latest);changed.latestReview.recipientSourceDigest='f'.repeat(64);await operation.archiveAccepted(changed,operation.getSnapshot());assert.equal(receipts.size,1);
  await operation.archiveAccepted(latest,operation.getSnapshot());assert.equal(receipts.size,0);assert.equal(archives.size,1);
  await withHeldLock(`begin;select pg_advisory_xact_lock(hashtextextended('event-lifecycle:${eventId}',0));select 'LOCK_HELD';`,async()=>assert.equal(get().status,'retry_exact'));
  assert.equal(enabled(`select app.get_native_recorded_fund_review_source_v1('${tournamentId}','${eventId}')`,outsiderId),null);
  const acl=owner(`select jsonb_build_object('privateAuth',has_function_privilege('authenticated','app.get_native_recorded_fund_review_source_v1(uuid,uuid)','EXECUTE'),'publicAuth',has_function_privilege('authenticated','public.get_native_recorded_fund_review_source_provider_v1(uuid,uuid)','EXECUTE'),'publicAnon',has_function_privilege('anon','public.get_native_recorded_fund_review_source_provider_v1(uuid,uuid)','EXECUTE'),'publicService',has_function_privilege('service_role','public.get_native_recorded_fund_review_source_provider_v1(uuid,uuid)','EXECUTE'))`);assert.deepEqual(acl,{privateAuth:false,publicAuth:true,publicAnon:false,publicService:false});
  assert.equal(owner(`select to_jsonb(count(*))from app.native_playoff_final_award_sets_v1 where tournament_id='${tournamentId}'and event_id='${eventId}'`),0);
  writeEvidence('fresh-fund-review-source-before.json',raw);writeEvidence('fresh-fund-review-request.json',request);writeEvidence('fresh-fund-review-first-receipt.json',first);writeEvidence('fresh-fund-review-winning-receipt.json',winner);writeEvidence('fresh-fund-review-source-after.json',latest);
  const result={passed:true,scope,recordedFundMinor:48100,sanctioningMinor:5400,sanctioningCountedOnce:true,estimatedIncomeInitiallyBlocked:true,recordedIncomeMinor:500,reviewRows:2,rollback:true,replay:true,crossEventCatalogPredicateCases:crossEventEvidence.length,negativeCorruptionFailsClosed:true,physicalGuardBranchTraversalProven:false,concurrentWinner:1,concurrentLoser:'stale_version',exactReconciliationAndArchive:true,staleReadbackBlocked:true,acl,providerSessionVerified:false,bankReceiptVerified:false,moneyMoved:false,payoutAuthorized:false};writeEvidence('fresh-fund-review-result.json',result);return result;
 }finally{q(Object.values(original).join(';\n'));for(const[name,definition]of Object.entries(original))assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.${name}_enabled_v1()'::regprocedure))`),definition);}
}
