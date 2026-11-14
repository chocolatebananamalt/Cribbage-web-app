// Injected local legacy-first liability proof. The V9 fixture is synthetic and
// records an immutable unpaid accounting final through supported public RPCs.
// This helper moves no money, creates no refund and launches no database.
import assert from'node:assert/strict';
import {verifyCustomCombinedAccountingRuntimeV10}from'./custom-combined-accounting-local-acceptance.mjs';
import {actor,tid,uuid}from'./fixtures/q-review-foundation.mjs';

const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const literal=value=>`${quote(JSON.stringify(value))}::jsonb`;

export function verifyNativeOptionalLegacyFirstLiabilityV2({sql,checkpoint=()=>{}}){
 const legacy=verifyCustomCombinedAccountingRuntimeV10({sql,checkpoint:(phase,value)=>checkpoint(`legacy_${phase}`,value)});
 const eid=legacy.source?.eventId??legacy.final?.eventId;assert.match(eid,/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
 assert.equal(legacy.final.status,'prize_accounting_finalized_unpaid_v9');assert.equal(legacy.finalized.finalization.status,'unpaid');assert.equal(legacy.moneyMoved,false);
 const context=`set role postgres;set request.jwt.claim.role='service_role';set request.jwt.claim.sub=${quote(actor)};set request.jwt.claims=${quote(JSON.stringify({role:'service_role',sub:actor}))};`;
 const read=statement=>JSON.parse(sql(context+statement));
 const get=expression=>read(`select to_jsonb((${expression}));`);
 const capture=()=>get(`select jsonb_build_object('final',to_jsonb(f),'draft',to_jsonb(d),'operationReceipt',to_jsonb(o),'finalCount',(select count(*)from app.prize_accounting_finals_v9 where tournament_id=${quote(tid)}::uuid and event_id=${quote(eid)}::uuid),'fingerprint',encode(extensions.digest(convert_to(jsonb_build_array(to_jsonb(f),to_jsonb(d),to_jsonb(o))::text,'utf8'),'sha256'),'hex'))from app.prize_accounting_finals_v9 f join app.prize_accounting_drafts_v9 d on d.id=f.draft_id join app.operation_receipts o on o.id=f.operation_receipt_id and o.tournament_id=f.tournament_id where f.tournament_id=${quote(tid)}::uuid and f.event_id=${quote(eid)}::uuid`);
 const counts=()=>get(`select jsonb_build_object('ownershipOperations',(select count(*)from app.native_optional_pool_ownership_operations_v2 where tournament_id=${quote(tid)}::uuid and event_id=${quote(eid)}::uuid),'ownershipRevisions',(select count(*)from app.native_optional_pool_ownership_revisions_v2 where tournament_id=${quote(tid)}::uuid and event_id=${quote(eid)}::uuid),'financeRevisions',(select count(*)from app.native_optional_finance_revisions_v2 where tournament_id=${quote(tid)}::uuid and event_id=${quote(eid)}::uuid),'fundOperations',(select count(*)from app.native_optional_fund_operations_v2 where tournament_id=${quote(tid)}::uuid and event_id=${quote(eid)}::uuid),'fundReviews',(select count(*)from app.native_optional_fund_reviews_v2 where tournament_id=${quote(tid)}::uuid and event_id=${quote(eid)}::uuid),'finalOperations',(select count(*)from app.native_optional_final_operations_v2 where tournament_id=${quote(tid)}::uuid and event_id=${quote(eid)}::uuid),'finalSets',(select count(*)from app.native_optional_final_award_sets_v2 where tournament_id=${quote(tid)}::uuid and event_id=${quote(eid)}::uuid))`);
 const before=capture(),beforeCounts=counts();assert.equal(before.finalCount,1);assert.equal(before.final.status,'unpaid');assert.equal(before.final.id,legacy.final.finalizationId);assert.match(before.fingerprint,/^[a-f0-9]{64}$/);assert.equal(get(`select app.legacy_financial_liability_exists_v1(${quote(tid)}::uuid,${quote(eid)}::uuid)`),true);assert.deepEqual(beforeCounts,{ownershipOperations:0,ownershipRevisions:0,financeRevisions:0,fundOperations:0,fundReviews:0,finalOperations:0,finalSets:0});
 checkpoint('legacy_final_recorded',{actor,tournamentId:tid,eventId:eid,legacyFinal:legacy.final,legacyCapture:before,noRefunds:true,moneyMoved:false});

 const gates=['native_optional_pool_ownership_enabled_v2','native_optional_finance_source_enabled_v2','native_optional_playoff_source_enabled_v2','native_optional_recorded_fund_enabled_v2','native_optional_final_awards_enabled_v2'];
 const incomeInstalled=get("select to_regprocedure('app.native_optional_income_enabled_v2()')is not null");
 if(incomeInstalled)gates.push('native_optional_income_enabled_v2','native_optional_income_fund_enabled_v3');
 const originals=gates.map(name=>get(`select pg_get_functiondef(${quote(`app.${name}()`)}::regprocedure)`));for(const source of originals)assert.match(source,/select false/i);
 const marker="set app.fixture_native_optional_legacy_first='approved-local-only';";
 try{
  for(const name of gates)sql(context+`create or replace function app.${name}()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_native_optional_legacy_first',true)='approved-local-only',false)$$;alter function app.${name}()owner to postgres;revoke all on function app.${name}()from public,anon,authenticated,service_role;`);
  const source=read(`${marker}select to_jsonb(app.native_optional_pool_ownership_source_v2(${quote(actor)}::uuid,${quote(tid)}::uuid,${quote(eid)}::uuid));`);assert.deepEqual(source,{status:'blocked',code:'existing_financial_liability'});
  const ownershipRequest={kind:'native-optional-pool-ownership-v2',expectedVersion:0,sourceDigest:'0'.repeat(64),costClassifications:[],reason:'TEST ONLY legacy-first duplicate liability refusal',reviewed:true};
  const ownership=read(`${marker}select to_jsonb(app.save_native_optional_pool_ownership_v2(${quote(actor)}::uuid,${quote(tid)}::uuid,${quote(eid)}::uuid,${quote(uuid('0d90',1))}::uuid,${literal(ownershipRequest)}));`);assert.deepEqual(ownership,{status:'rejected',code:'source_blocked'});
  const financeSource=read(`${marker}select to_jsonb(app.native_optional_finance_source_v2(${quote(actor)}::uuid,${quote(tid)}::uuid,${quote(eid)}::uuid));`);assert.deepEqual(financeSource,{status:'blocked',code:'existing_financial_liability'});
  const fundSource=read(`${marker}select to_jsonb(app.native_optional_recorded_fund_source_v2(${quote(actor)}::uuid,${quote(tid)}::uuid,${quote(eid)}::uuid,null));`);assert.deepEqual(fundSource,{status:'blocked',code:'existing_financial_liability'});
  const finalSource=read(`${marker}select to_jsonb(app.native_optional_final_award_source_v2(${quote(actor)}::uuid,${quote(tid)}::uuid,${quote(eid)}::uuid));`);assert.deepEqual(finalSource,{status:'blocked',code:'recorded_fund_review_required'});
  const finalRequest={kind:'native-optional-final-awards-v2',expectedVersion:0,fundReviewId:uuid('0d90',2),fundReviewVersion:1,sourceDigest:'0'.repeat(64),proposalRevisionId:uuid('0d90',3),ownershipRevisionId:uuid('0d90',4),recipientSourceDigest:'0'.repeat(64),reviewed:true,reason:'TEST ONLY refuse a second immutable liability'};
  const finalWrite=read(`${marker}select to_jsonb(app.record_native_optional_final_awards_v2(${quote(actor)}::uuid,${quote(tid)}::uuid,${quote(eid)}::uuid,${quote(uuid('0d90',5))}::uuid,${literal(finalRequest)}));`);assert.deepEqual(finalWrite,{status:'rejected',code:'recorded_fund_review_required'});
  const trigger=read(`${marker}do $guard$begin begin insert into app.native_optional_final_award_sets_v2 select(jsonb_populate_record(null::app.native_optional_final_award_sets_v2,${literal({tournament_id:tid,event_id:eid,actor_id:actor})})).*;raise exception'legacy_first_guard_did_not_reject';exception when raise_exception then if sqlerrm is distinct from'other_final_award_liability_exists'then raise;end if;perform set_config('app.fixture_native_optional_legacy_guard',sqlerrm,false);end;end$guard$;select to_jsonb(current_setting('app.fixture_native_optional_legacy_guard'));`);assert.equal(trigger,'other_final_award_liability_exists');
  let incomeProof=null;
  if(incomeInstalled){
   const projection=read(`${marker}select app.get_native_optional_income_projection_v2('${actor}','${tid}','${eid}');`);assert.deepEqual(projection,{status:'blocked',code:'existing_financial_liability'});
   const v3Fund=read(`${marker}select app.native_optional_recorded_fund_source_v3('${actor}','${tid}','${eid}',null);`);assert.deepEqual(v3Fund,{status:'blocked',code:'existing_financial_liability'});
   const incomeRequest={kind:'native-optional-income-record-v2',expectedVersion:0,proposalRevisionId:uuid('0d91',1),ownershipRevisionId:uuid('0d91',2),recordId:uuid('0d91',3),physicalEvidenceId:uuid('0d91',4),evidenceReference:'TEST ONLY legacy-first must not create income'};
   const incomeWrite=read(`${marker}select app.record_native_optional_income_v2('${actor}','${tid}','${eid}','${uuid('0d91',5)}',${literal(incomeRequest)});`);assert.deepEqual(incomeWrite,{status:'rejected',code:'existing_financial_liability'});
   const incomeCounts=get(`select jsonb_build_object('records',(select count(*)from app.native_optional_income_records_v2 where tournament_id='${tid}'),'operations',(select count(*)from app.native_optional_income_operations_v2 where tournament_id='${tid}'),'roots',(select count(*)from app.native_unrestricted_income_sources_v1 where tournament_id='${tid}'))`);assert.deepEqual(incomeCounts,{records:0,operations:0,roots:0});incomeProof={projection,v3Fund,incomeWrite,incomeCounts};
  }
  const after=capture(),afterCounts=counts();assert.deepEqual(after,before);assert.deepEqual(afterCounts,beforeCounts);
  const result={legacy,legacyCapture:before,source,ownership,financeSource,fundSource,finalSource,finalWrite,trigger,counts:afterCounts,incomeInstalled,incomeProof,legacyFinalUnchanged:true,noSecondLiability:true,noRefunds:true,moneyMoved:false,providerVerified:false,syntheticFoundations:true};checkpoint('native_optional_legacy_first_refused',result);return result;
 }finally{for(const source of originals)sql(context+source);for(let index=0;index<gates.length;index++)assert.equal(get(`select pg_get_functiondef(${quote(`app.${gates[index]}()`)}::regprocedure)`),originals[index]);}
}
