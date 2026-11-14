// Injected local synthetic bookkeeping proof. No bank/provider/human claim.
import assert from'node:assert/strict';
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const id=n=>`0d840000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export async function verifyNativeOptionalFinalV2({q,read,withHeldLock,fixture,checkpoint}){
 const actor=fixture.actor,tid=fixture.tournamentId,eid=fixture.eventId;
 const context=`set app.fixture_native_optional_finance='approved-local-only';set app.fixture_native_playoff_recipient='approved-local-only';set app.fixture_native_optional_final='approved-local-only';set request.jwt.claim.role='service_role';set request.jwt.claim.sub='${actor}';set request.jwt.claims='{"role":"service_role","sub":"${actor}"}';`;
 const get=statement=>read(context+statement);
 const raw=statement=>q(context+statement);
 const gates=['native_optional_recorded_fund_enabled_v2','native_optional_final_awards_enabled_v2'];
 const originals=gates.map(name=>get(`select to_jsonb(pg_get_functiondef('app.${name}()'::regprocedure));`));for(const source of originals)assert.match(source,/select false/i);
 assert.equal(get(`select app.native_optional_recorded_fund_source_v2('${actor}','${tid}','${eid}',null);`).code,'feature_unavailable');
 try{
  for(const name of gates)q(`create or replace function app.${name}()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_native_optional_final',true)='approved-local-only',false)$$;alter function app.${name}()owner to postgres;revoke all on function app.${name}()from public,anon,authenticated,service_role;`);
  assert.equal(get(`select app.native_optional_recorded_fund_source_v2('${actor}','${tid}','${eid}',null);`).code,'sanctioning_coverage_unverified');
  const expenseId=get(`select to_jsonb(id)from app.tournament_expense_events where tournament_id='${tid}'and description='TEST ONLY sanctioning';`);
  assert.match(expenseId,/^[a-f0-9-]{36}$/);
  const fundSource=get(`select app.native_optional_recorded_fund_source_v2('${actor}','${tid}','${eid}','${expenseId}');`);assert.equal(fundSource.status,'source_available',JSON.stringify(fundSource));
  assert.deepEqual(fundSource.funds,{regularReceiptsMinor:48000,regularCostMinor:5000,regularFundMinor:43000,qFundMinor:17000,sideFundMinor:16000,recordedReceiptsMinor:81000});
  assert.equal(fundSource.sanctioning.totalMinor,4800);assert.equal(fundSource.regularProjection.status,'calculated');assert.equal(fundSource.optionalPools.length,3);
  const reviewRequest={kind:'native-optional-recorded-fund-review-v2',expectedVersion:0,sourceDigest:fundSource.sourceDigest,proposalRevisionId:fundSource.proposalRevisionId,ownershipRevisionId:fundSource.ownershipRevisionId,recipientSourceDigest:fundSource.recipientSource.sourceDigest,sanctioningExpenseEventId:expenseId,status:'reviewed_zero',reason:'TEST ONLY explicit zero additional income and recorded fund review'};
  const reviewCall=(body=reviewRequest,op=id(1))=>`app.review_native_optional_recorded_fund_v2('${actor}','${tid}','${eid}','${op}',${literal(body)})`;
  const review=get(`select ${reviewCall()};`);assert.equal(review.status,'optional_recorded_fund_reviewed_v2',JSON.stringify(review));assert.deepEqual(get(`select ${reviewCall()};`),review);
  assert.equal(get(`select ${reviewCall({...reviewRequest,sourceDigest:'0'.repeat(64)},id(2))};`).code,'source_changed');
  const finalSource=get(`select app.native_optional_final_award_source_v2('${actor}','${tid}','${eid}');`);assert.equal(finalSource.status,'source_available',JSON.stringify(finalSource));
  const request={kind:'native-optional-final-awards-v2',expectedVersion:0,fundReviewId:review.reviewId,fundReviewVersion:review.version,sourceDigest:finalSource.sourceDigest,proposalRevisionId:fundSource.proposalRevisionId,ownershipRevisionId:fundSource.ownershipRevisionId,recipientSourceDigest:fundSource.recipientSource.sourceDigest,reviewed:true,reason:'TEST ONLY atomic unpaid regular and optional pool award records'};
  const call=(op=id(10),body=request)=>`app.record_native_optional_final_awards_v2('${actor}','${tid}','${eid}','${op}',${literal(body)})`;
  assert.equal(get(`select ${call(id(8),{...request,sourceDigest:'0'.repeat(64)})};`).code,'source_changed');
  raw(`begin;select public.record_tournament_expense('${tid}',25,'USD','TEST ONLY temporary stale final source','${id(9)}');do $stale$declare r jsonb;begin r:=${call(id(7))};if r->>'status'is distinct from'rejected'then raise exception'stale final accepted %',r;end if;end$stale$;rollback;`);
  // Fail after earlier rows were inserted; exception subtransaction must undo all.
  raw(`create function app.fixture_optional_final_abort_v2()returns trigger language plpgsql set search_path=''as $$begin if new.pool_kind='side'then raise exception'fixture_atomic_abort';end if;return new;end$$;create trigger zz_fixture_optional_final_abort_v2 before insert on app.native_optional_final_recipients_v2 for each row execute function app.fixture_optional_final_abort_v2();do $atomic$begin begin perform ${call(id(6))};raise exception'fixture_did_not_abort';exception when raise_exception then if sqlerrm is distinct from'fixture_atomic_abort'then raise;end if;end;if exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id='${tid}')or exists(select 1 from app.native_optional_final_operations_v2 where actor_id='${actor}'and operation_id='${id(6)}')then raise exception'atomic_rollback_failed';end if;end$atomic$;drop trigger zz_fixture_optional_final_abort_v2 on app.native_optional_final_recipients_v2;drop function app.fixture_optional_final_abort_v2();`);
  let sameBusy,distinctBusy;
  await withHeldLock(`begin;${context}do $first$declare r jsonb;begin r:=${call()};if r->>'status'is distinct from'optional_final_awards_recorded_v2'then raise exception'first final failed %',r;end if;end$first$;select 'LOCK_HELD';`,async()=>{
   sameBusy=get(`select ${call()};`);assert.deepEqual(sameBusy,{status:'retry_exact',code:'operation_busy'});
   distinctBusy=get(`select ${call(id(11))};`);assert.deepEqual(distinctBusy,{status:'retry_exact',code:'event_busy'});
  },'commit');
  const accepted=get(`select ${call()};`);assert.equal(accepted.status,'optional_final_awards_recorded_v2');assert.equal(accepted.totalMinor,76000);assert.equal(accepted.awardStatus,'recorded_unpaid');assert.equal(accepted.moneyMoved,false);
  assert.deepEqual(get(`select ${call()};`),accepted);assert.equal(get(`select ${call(id(11))};`).code,'final_awards_already_recorded');
  const record=get(`select app.get_native_optional_final_award_record_v2('${actor}','${tid}','${eid}');`);assert.equal(record.historicalRecord,true);assert.equal(record.currentFundAuthority,false);
  assert.equal(record.recipients.reduce((sum,row)=>sum+row.amount_minor,0),76000);assert.equal(record.optionalPools.length,3);
  const reconciliation=get(`select app.reconcile_native_optional_final_awards_v2('${actor}','${tid}','${eid}','${id(10)}',${literal(request)});`);assert.deepEqual(reconciliation.result,accepted);assert.equal(reconciliation.currentFundAuthority,false);
  checkpoint('native_optional_final_written_v2',{fundSource,reviewRequest,review,finalSource,request,accepted,record,reconciliation,sameBusy,distinctBusy,atomicRollback:true,exactReplay:true,moneyMoved:false});
  // BEFORE INSERT guards reject a second liability before unrelated required
  // columns/FKs. No fabricated legacy row is accepted or persisted.
  const legacyGuards=[];
  for(const table of['native_playoff_final_award_sets_v1','standard_singles_settlement_final_versions','event_settlement_finals_v2','q_accounting_finals_v6','no_q_accounting_finals_v7','prize_accounting_finals_v8','prize_accounting_finals_v9','multi_event_unpaid_finals_v1','multi_event_joint_finals_v1']){
   const result=get(`do $guard$begin begin insert into app.${table} select(jsonb_populate_record(null::app.${table},${literal({tournament_id:tid,event_id:eid})})).*;raise exception'legacy_liability_guard_did_not_reject';exception when raise_exception then if sqlerrm not in('optional_final_award_liability_exists','event_settings_finance_integration_required')then raise;end if;perform set_config('app.fixture_optional_guard_result',sqlerrm,false);end;end$guard$;select jsonb_build_object('table','${table}','code',current_setting('app.fixture_optional_guard_result'));`);
   assert.ok(['optional_final_award_liability_exists','event_settings_finance_integration_required'].includes(result.code));legacyGuards.push(result);
  }
  for(const table of['native_optional_pool_ownership_revisions_v2','native_optional_finance_revisions_v2','native_optional_finance_source_adoptions_v2','native_optional_fund_reviews_v2'])raw(`do $closed$begin begin insert into app.${table} select(jsonb_populate_record(null::app.${table},${literal({tournament_id:tid,event_id:eid})})).*;raise exception'closed_source_guard_did_not_reject';exception when raise_exception then if sqlerrm is distinct from'optional_financial_source_already_finalized'then raise;end if;end;end$closed$;`);
  raw(`begin;delete from app.tournament_roles where tournament_id='${tid}'and profile_id='${actor}'and role='director';do $role$declare r jsonb;begin r:=${call()};if r is not null then raise exception'revoked role final replay returned data';end if;end$role$;rollback;`);
  for(const role of['anon','authenticated','service_role'])assert.throws(()=>q(`select app.get_native_optional_final_award_record_v2('${actor}','${tid}','${eid}');`,actor,role),/permission denied/i);
  assert.equal(get(`select app.native_optional_recorded_fund_source_v2('${actor}','${tid}','${eid}','${expenseId}');`).code,'final_awards_already_recorded');
  const result={fundSource,reviewRequest,review,finalSource,request,accepted,record,reconciliation,sameBusy,distinctBusy,legacyGuards,atomicRollback:true,staleRejected:true,exactReplay:true,revokedReplayDenied:true,privateAclDenied:true,legacySecondLiabilityBlocked:true,postFinalSourceClosed:true,preexistingLegacyFirstRuntimeVerified:false,syntheticAssessment:true,normalStartRpcVerified:false,providerVerified:false,moneyMoved:false};checkpoint('native_optional_final_v2',result);return result;
 }finally{for(const source of originals)q(source);for(const name of gates)assert.equal(get(`select to_jsonb(app.${name}());`),false);}
}
