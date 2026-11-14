// Injected disposable DB. Real editor actions; fictional recorded funds only.
import assert from'node:assert/strict';
import{advanceNativeOptionalIncomeProposal}from'./native-optional-income-proposal-scenario.mjs';
import{verifyNativeOptionalIncomeFinalV3}from'./native-optional-income-final-local-acceptance.mjs';
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const id=n=>`0d960000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export async function verifyNativeOptionalIncomeFinalizationV3({q,read,withHeldLock,fixture,checkpoint,source,editor}){
 const actor=fixture.actor,tid=fixture.tournamentId,eid=fixture.eventId;let counter=1000,version=source.proposal.version,lineId=null,lastReview=null;
 const context=`set app.fixture_native_optional_finance='approved-local-only';set app.fixture_native_playoff_recipient='approved-local-only';set app.fixture_native_optional_final='approved-local-only';set request.jwt.claim.role='service_role';set request.jwt.claim.sub='${actor}';set request.jwt.claims='{"role":"service_role","sub":"${actor}"}';`;
 const get=query=>read(context+query),raw=query=>q(context+query);
 const gates=['native_optional_income_enabled_v2','native_optional_income_fund_enabled_v3','native_optional_recorded_fund_enabled_v2','native_optional_final_awards_enabled_v2'];
 const originals=gates.map(name=>get(`select to_jsonb(pg_get_functiondef('app.${name}()'::regprocedure));`));for(const value of originals)assert.match(value,/select false/i);
 const evidence=[];let final;
 try{
  for(const name of gates)q(`create or replace function app.${name}()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_native_optional_final',true)='approved-local-only',false)$$;alter function app.${name}()owner to postgres;revoke all on function app.${name}()from public,anon,authenticated,service_role;`);
  const expenseId=get(`select to_jsonb(id)from app.tournament_expense_events where tournament_id='${tid}'and description='TEST ONLY sanctioning';`);
  const initialReviewVersion=get(`select to_jsonb(coalesce(max(version),0))from app.native_optional_fund_reviews_v2 where tournament_id='${tid}'and event_id='${eid}';`);
  raw(`begin;insert into app.native_unrestricted_income_sources_v1(tournament_id,event_id,income_id,physical_evidence_id,evidence_reference,created_by)values('${tid}','${eid}','${id(801)}','${id(802)}','TEST ONLY orphan root must not mean zero','${actor}');do $orphan$declare r jsonb;begin r:=app.get_native_optional_income_projection_v2('${actor}','${tid}','${eid}');if r->>'code'is distinct from'income_source_unresolved'then raise exception'orphan root did not block %',r;end if;end$orphan$;rollback;`);
  const currentSource=source.nativeFinanceSource;
  for(let stage=0;stage<4;stage++){
   const advanced=advanceNativeOptionalIncomeProposal({editor,stage,lineId,nextId:()=>id(counter++)});editor=advanced.editor;if(stage===0)lineId=advanced.lineId;
   const request={kind:'native-optional-finance-proposal-v2',expectedVersion:version,sourceDigest:currentSource.sourceDigest,basisDigest:currentSource.basisDigest,editor,reason:'TEST ONLY income lifecycle proposal '+stage,reviewed:true};
   const saved=get(`select app.save_native_optional_finance_proposal_v2('${actor}','${tid}','${eid}','${id(100+stage)}',${literal(request)});`);assert.equal(saved.status,'optional_finance_proposal_saved_v2',JSON.stringify(saved));version=saved.version;
   const pending=get(`select app.get_native_optional_income_projection_v2('${actor}','${tid}','${eid}');`);assert.equal(pending.status,'income_source_available',JSON.stringify(pending));assert.equal(pending.complete,false);assert.equal(pending.headVersion,stage);assert.deepEqual(pending.nextUnposted,advanced.record);
   assert.equal(get(`select app.native_optional_recorded_fund_source_v3('${actor}','${tid}','${eid}','${expenseId}');`).code,'income_history_incomplete');
   const recordRequest={kind:'native-optional-income-record-v2',expectedVersion:stage,proposalRevisionId:saved.revisionId,ownershipRevisionId:source.proposal.ownershipRevisionId,recordId:advanced.record.line.recordId,physicalEvidenceId:id(stage===3?502:501),evidenceReference:stage===3?'TEST ONLY Donation Evidence Two':'TEST ONLY Donation Evidence One'};
   const op=id(200+stage),call=(operation=op,body=recordRequest)=>`app.record_native_optional_income_v2('${actor}','${tid}','${eid}','${operation}',${literal(body)})`;
   if(stage===0){
    const receiptId=source.nativeFinanceSource.raw.ownershipSource.capture.rosterReceiptPartitions[0].receipt.id;
    assert.equal(get(`select ${call(id(600),{...recordRequest,physicalEvidenceId:receiptId})};`).code,'physical_evidence_conflict');
    assert.equal(get(`select ${call(id(601),{...recordRequest,proposalRevisionId:id(999)})};`).code,'proposal_source_changed');
    // Force a late child failure: a fresh root and operation must roll back too.
    raw(`create function app.fixture_optional_income_abort_v2()returns trigger language plpgsql set search_path=''as $$begin raise exception'fixture_income_abort';end$$;create trigger zz_fixture_optional_income_abort_v2 before insert on app.native_optional_income_records_v2 for each row execute function app.fixture_optional_income_abort_v2();do $atomic$begin begin perform ${call(id(602))};raise exception'fixture_did_not_abort';exception when raise_exception then if sqlerrm is distinct from'fixture_income_abort'then raise;end if;end;if exists(select 1 from app.native_unrestricted_income_sources_v1 where tournament_id='${tid}'and income_id='${advanced.lineId}')or exists(select 1 from app.native_optional_income_operations_v2 where actor_id='${actor}'and operation_id='${id(602)}')then raise exception'income_atomic_rollback_failed';end if;end$atomic$;drop trigger zz_fixture_optional_income_abort_v2 on app.native_optional_income_records_v2;drop function app.fixture_optional_income_abort_v2();`);
   }
   let accepted,sameBusy=null,distinctBusy=null;
   if(stage===3){
    await withHeldLock(`begin;${context}do $save$declare r jsonb;begin r:=${call()};if r->>'status'is distinct from'optional_income_recorded_v2'then raise exception'income save failed %',r;end if;end$save$;select 'LOCK_HELD';`,async()=>{
     sameBusy=get(`select ${call()};`);assert.deepEqual(sameBusy,{status:'retry_exact',code:'operation_busy'});
     distinctBusy=get(`select ${call(id(700))};`);assert.deepEqual(distinctBusy,{status:'retry_exact',code:'event_busy'});
    },'commit');
    accepted=get(`select ${call()};`);assert.equal(get(`select ${call(id(700))};`).code,'stale_version');
   }else accepted=get(`select ${call()};`);
   assert.equal(accepted.status,'optional_income_recorded_v2',JSON.stringify(accepted));assert.equal(accepted.version,stage+1);assert.equal(accepted.moneyMoved,false);assert.deepEqual(get(`select ${call()};`),accepted);
   assert.equal(get(`select ${call(op,{...recordRequest,evidenceReference:'Changed same operation'})};`).code,'idempotency_conflict');
   const reconciliation=get(`select app.reconcile_native_optional_income_v2('${actor}','${tid}','${eid}','${op}',${literal(recordRequest)});`);assert.deepEqual(reconciliation.result,accepted);
   const projection=get(`select app.get_native_optional_income_projection_v2('${actor}','${tid}','${eid}');`);assert.equal(projection.complete,true);assert.equal(projection.headVersion,stage+1);assert.equal(projection.activeMinor,[10000,15000,0,20000][stage]);assert.equal(projection.records.length,stage+1);
   if(stage===0)raw(`do $domain$begin begin insert into app.native_unrestricted_income_records_v1 select(jsonb_populate_record(null::app.native_unrestricted_income_records_v1,${literal({tournament_id:tid,event_id:eid,income_id:advanced.lineId})})).*;raise exception'cross_domain_insert_not_blocked';exception when raise_exception then if sqlerrm is distinct from'income_journal_domain_conflict'then raise;end if;end;end$domain$;`);
   const fundSource=get(`select app.native_optional_recorded_fund_source_v3('${actor}','${tid}','${eid}','${expenseId}');`);assert.equal(fundSource.status,'source_available',JSON.stringify(fundSource));assert.equal(fundSource.funds.regularFundMinor,[53000,58000,43000,63000][stage]);assert.equal(fundSource.funds.qFundMinor,17000);assert.equal(fundSource.funds.sideFundMinor,16000);
   if(lastReview)assert.equal(get(`select app.native_optional_final_award_source_v2('${actor}','${tid}','${eid}');`).code,'recorded_fund_review_stale');
   const reviewRequest={kind:'native-optional-recorded-fund-review-v3',expectedVersion:initialReviewVersion+stage,sourceDigest:fundSource.sourceDigest,proposalRevisionId:saved.revisionId,ownershipRevisionId:source.proposal.ownershipRevisionId,recipientSourceDigest:fundSource.recipientSource.sourceDigest,sanctioningExpenseEventId:expenseId,status:stage===2?'reviewed_zero':'recorded_complete',reason:'TEST ONLY review exact recorded income head '+stage,incomeHeadVersion:projection.headVersion,incomeHeadDigest:projection.headDigest};
   const review=get(`select app.review_native_optional_recorded_fund_v3('${actor}','${tid}','${eid}','${id(300+stage)}',${literal(reviewRequest)});`);assert.equal(review.status,'optional_recorded_fund_reviewed_v3',JSON.stringify(review));lastReview=review;
   assert.equal(get(`select app.native_optional_final_award_source_v2('${actor}','${tid}','${eid}');`).status,'source_available');
   evidence.push({stage,record:advanced.record,saved,recordRequest,accepted,reconciliation,projection,fundSource,reviewRequest,review,sameBusy,distinctBusy});checkpoint('income_stage_'+stage,evidence.at(-1));
  }
  final=await verifyNativeOptionalIncomeFinalV3({q,read,withHeldLock,fixture,checkpoint});
  const last=evidence.at(-1);assert.equal(get(`select app.record_native_optional_income_v2('${actor}','${tid}','${eid}','${id(899)}',${literal({...last.recordRequest,expectedVersion:4})});`).code,'existing_financial_liability');
  const first=evidence[0];raw(`begin;delete from app.tournament_roles where tournament_id='${tid}'and profile_id='${actor}'and role='director';do $revoked$declare r jsonb;begin r:=app.record_native_optional_income_v2('${actor}','${tid}','${eid}','${id(200)}',${literal(first.recordRequest)});if r is not null then raise exception'revoked income replay returned data';end if;end$revoked$;rollback;`);
  const counts=get(`select jsonb_build_object('incomeRecords',(select count(*)from app.native_optional_income_records_v2 where tournament_id='${tid}'and event_id='${eid}'),'roots',(select count(*)from app.native_unrestricted_income_sources_v1 where tournament_id='${tid}'and event_id='${eid}'));`);assert.deepEqual(counts,{incomeRecords:4,roots:2});
  const result={evidence,final,counts,noRefunds:true,atomicIncomeRollback:true,orphanRootRejected:true,crossDomainRejected:true,postFinalIncomeRejected:true,incomeConcurrentWriterProof:true,revokedIncomeReplayDenied:true,moneyMoved:false,providerVerified:false};checkpoint('income_complete_v3',result);return result;
 }finally{for(const value of originals)q(value);for(let i=0;i<gates.length;i++)assert.equal(get(`select to_jsonb(pg_get_functiondef('app.${gates[i]}()'::regprocedure));`),originals[i]);}
}
