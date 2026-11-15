// Disposable local proof for bookkeeping income, fund review and unpaid awards.
// No bank proof, payout, disbursement, provider identity or money movement.
import assert from 'node:assert/strict';
import {reduceEventFinanceEditorV1} from '../src/lib/finance/event-finance-workspace-v1.ts';
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const canonical=value=>JSON.stringify(value,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);

export async function verifyNativePlayoffFinalAwards({q,read,withHeldLock,actorId,outsiderId,tournamentId,nextOperationId,writeEvidence=()=>{}}){
 const owner=(sql,who=actorId)=>read(sql,who,'ownerAuthenticated');
 const enabled=(sql,who=actorId)=>owner(`set app.fixture_native_playoff_recipient='approved-local-only';set app.fixture_native_final_awards='approved-local-only';set app.fixture_operational_finance_proposals='approved-local-only';${sql}`,who);
 const eventId=owner(`select to_jsonb(event_id)from app.event_settings_operational_bindings_v1 where tournament_id='${tournamentId}';`);
 assert.ok(eventId);
 assert.deepEqual(owner(`select app.native_playoff_final_award_source_v1('${tournamentId}','${eventId}','${actorId}');`),{status:'blocked',code:'feature_unavailable'});
 const originalFinalGate=owner(`select to_jsonb(pg_get_functiondef('app.native_playoff_final_awards_enabled_v1()'::regprocedure));`);
 const originalRecipientGate=owner(`select to_jsonb(pg_get_functiondef('app.native_playoff_finance_recipient_source_enabled_v1()'::regprocedure));`);
 const originalProposalGate=owner(`select to_jsonb(pg_get_functiondef('app.operational_event_finance_proposals_enabled_v1()'::regprocedure));`);
 for(const source of[originalFinalGate,originalRecipientGate,originalProposalGate])assert.match(source,/select false/i);
 let source,acceptedFinal,stored;
 try{
  q(`create or replace function app.native_playoff_final_awards_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_native_final_awards',true)='approved-local-only',false)$$;alter function app.native_playoff_final_awards_enabled_v1()owner to postgres;revoke all on function app.native_playoff_final_awards_enabled_v1()from public,anon,authenticated,service_role;
  create or replace function app.native_playoff_finance_recipient_source_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_native_playoff_recipient',true)='approved-local-only',false)$$;alter function app.native_playoff_finance_recipient_source_enabled_v1()owner to postgres;revoke all on function app.native_playoff_finance_recipient_source_enabled_v1()from public,anon,authenticated,service_role;
  create or replace function app.operational_event_finance_proposals_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_operational_finance_proposals',true)='approved-local-only',false)$$;alter function app.operational_event_finance_proposals_enabled_v1()owner to postgres;revoke all on function app.operational_event_finance_proposals_enabled_v1()from public,anon,authenticated,service_role;`);
  const recipient=enabled(`select app.get_native_playoff_finance_recipient_source_v1('${tournamentId}','${eventId}');`);
  assert.equal(recipient.status,'source_available',JSON.stringify(recipient));
  // A zero-income completeness review is exercised in one rollback-only probe.
  const zeroDigest=owner(`select to_jsonb(encode(extensions.digest(convert_to(jsonb_build_array('native-unrestricted-income-head-v1','${tournamentId}'::uuid,'${eventId}'::uuid,'[]'::jsonb)::text,'utf8'),'sha256'),'hex'));`);
  const zeroRequest={kind:'native-recorded-fund-review-v1',operationId:nextOperationId(),expectedVersion:0,
   proposalRevisionId:recipient.proposal.revisionId,nativeAllocationRevisionId:recipient.nativeFinanceSource.raw.allocation.revisionId,
   incomeHeadVersion:0,incomeHeadDigest:zeroDigest,status:'reviewed_zero',reason:'Synthetic rollback-only zero-income completeness review'};
  const zero=enabled(`begin;select app.review_native_recorded_fund_v1('${tournamentId}','${eventId}',${literal(zeroRequest)});rollback;`);
  writeEvidence('native-playoff-final-award-reviewed-zero-rollback.json',zero);
  assert.equal(zero.status,'accepted',JSON.stringify(zero));
  assert.equal(owner(`select to_jsonb(count(*))from app.native_recorded_fund_reviews_v1 where tournament_id='${tournamentId}'and event_id='${eventId}';`),0);
  let editor=structuredClone(recipient.proposal.editor);const workspace=editor.basis;
  const ids=[1,2,3,4,5].map(n=>`f5100000-0000-4000-8000-${String(n).padStart(12,'0')}`);
  const makeId=()=>{const id=ids.shift();assert.ok(id);return id;};
  for(const action of[{type:'add_line',category:'unrestricted_income'},{type:'line_field',field:'label',value:'Recorded Local Bookkeeping Income'},
   {type:'line_field',field:'amount',value:'25.00'},{type:'line_field',field:'reason',value:'Synthetic recorded bookkeeping evidence only'},{type:'apply_line'}])
   editor=reduceEventFinanceEditorV1(editor,action,workspace,makeId);
  const incomeLine=editor.history.at(-1);assert.equal(incomeLine.line.category,'unrestricted_income');assert.equal(incomeLine.line.amountMinor,2500);
  // Fixture-only explicit Director re-review. Production has no retained-override
  // rebase UI yet, so this transition is not claimed as production-reachable.
  editor.overrideInput={fundMinor:56000,qualifierCount:5,settings:structuredClone(workspace.settings)};
  editor.overridePlan=canonical({basis:editor.basis,history:editor.history});
  for(const [firstPlace,lastPlace,amount]of[[1,1,'340.00'],[2,2,'205.00'],[5,5,'5.00']])for(const action of[
   {type:'edit_band',firstPlace,lastPlace},{type:'band_field',field:'amount',value:amount},
   {type:'band_field',field:'reason',value:'Synthetic explicit recorded-fund re-review'},{type:'apply_band'}])
   editor=reduceEventFinanceEditorV1(editor,action,workspace,makeId);
  assert.equal(ids.length,0);assert.equal(editor.lineForm,null);assert.equal(editor.bandForm,null);assert.equal(editor.overrideInput.fundMinor,56000);
  const financeSource=enabled(`select app.get_operational_event_finance_source_v1('${tournamentId}','${eventId}');`);
  const proposalRequest={kind:'operational-event-finance-proposal-v1',operationId:nextOperationId(),expectedVersion:1,
   expectedSourceDigest:financeSource.sourceDigest,expectedBasisDigest:financeSource.basisDigest,editor,
   reason:'Synthetic fixture-only explicit recorded fund and award re-review'};
  const saved=enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(proposalRequest)});`);
  assert.equal(saved.status,'accepted',JSON.stringify(saved));assert.equal(saved.version,2);
  const incomeRequest={kind:'native-unrestricted-income-record-v1',operationId:nextOperationId(),expectedVersion:0,
   proposalRevisionId:saved.revisionId,recordId:incomeLine.line.recordId,
   physicalEvidenceId:'f5100000-0000-4000-8000-000000000006',evidenceReference:'TEST ONLY LOCAL BOOKKEEPING EVIDENCE 001'};
  const nativePhysicalId=recipient.nativeFinanceSource.raw.allocation.eventSources[0].physicalEvidenceId;
  const collision=enabled(`select app.record_native_unrestricted_income_v1('${tournamentId}','${eventId}',${literal({...incomeRequest,operationId:nextOperationId(),physicalEvidenceId:nativePhysicalId})});`);
  assert.equal(collision.code,'physical_evidence_conflict');
  assert.equal(owner(`select to_jsonb(count(*))from app.native_unrestricted_income_sources_v1 where tournament_id='${tournamentId}';`),0);
  const income=enabled(`select app.record_native_unrestricted_income_v1('${tournamentId}','${eventId}',${literal(incomeRequest)});`);
  assert.equal(income.status,'accepted',JSON.stringify(income));assert.equal(income.code,'native_unrestricted_income_recorded_v1');
  assert.deepEqual(enabled(`select app.record_native_unrestricted_income_v1('${tournamentId}','${eventId}',${literal(incomeRequest)});`),{...income,historicalReceipt:true,currentSourceVerified:false});
  const head=owner(`select jsonb_build_object('version',max(version),'digest',encode(extensions.digest(convert_to(jsonb_build_array(
   'native-unrestricted-income-head-v1','${tournamentId}'::uuid,'${eventId}'::uuid,
   jsonb_agg(jsonb_build_object('incomeId',income_id,'recordId',record_id,'priorRecordId',prior_record_id,
    'physicalEvidenceId',physical_evidence_id,'amountMinor',amount_minor,'voided',voided,'label',label,
    'evidenceReference',evidence_reference,'reason',reason,'recordedBy',recorded_by,'recordedAt',recorded_at)order by version)
   )::text,'utf8'),'sha256'),'hex'))from app.native_unrestricted_income_records_v1 where tournament_id='${tournamentId}'and event_id='${eventId}';`);
  const reviewRequest={kind:'native-recorded-fund-review-v1',operationId:nextOperationId(),expectedVersion:0,
   proposalRevisionId:saved.revisionId,nativeAllocationRevisionId:recipient.nativeFinanceSource.raw.allocation.revisionId,
   incomeHeadVersion:head.version,incomeHeadDigest:head.digest,status:'recorded_complete',
   reason:'Synthetic complete recorded-bookkeeping review only'};
  const reviewed=enabled(`select app.review_native_recorded_fund_v1('${tournamentId}','${eventId}',${literal(reviewRequest)});`);
  assert.equal(reviewed.status,'accepted',JSON.stringify(reviewed));assert.equal(reviewed.reviewStatus,'recorded_complete');
  source=enabled(`select app.native_playoff_final_award_source_v1('${tournamentId}','${eventId}','${actorId}');`);
  writeEvidence('native-playoff-final-award-source.json',source);
  assert.equal(source.status,'source_available',JSON.stringify(source));assert.equal(source.fund.awardFundMinor,56000);
  assert.deepEqual(source.projection.groups.map(row=>[row.firstPlace,row.lastPlace,row.included,row.perPersonMinor]),
   [[1,1,true,34000],[2,2,true,20500],[3,4,true,500],[5,5,true,500]]);
  assert.equal(source.projection.totalMinor,56000);assert.equal(source.income.records.length,1);
  assert.equal(source.income.sourceDigest,source.fundSourceDigest);assert.equal(source.finalizationAuthorized,false);
  const finalRequest={kind:'native-playoff-final-awards-v1',operationId:nextOperationId(),expectedVersion:0,
   expectedSourceDigest:source.sourceDigest,expectedRecipientSourceDigest:source.recipientSourceDigest,
   expectedFundSourceDigest:source.fundSourceDigest,expectedProposalRevisionId:source.proposal.revisionId,
   expectedFundReviewId:source.income.reviewId,reason:'Synthetic unpaid final award bookkeeping only'};
  acceptedFinal=enabled(`select app.record_native_playoff_final_awards_v1('${tournamentId}','${eventId}',${literal(finalRequest)});`);
  assert.equal(acceptedFinal.status,'accepted',JSON.stringify(acceptedFinal));assert.equal(acceptedFinal.totalMinor,56000);
  assert.equal(acceptedFinal.moneyMoved,false);assert.equal(acceptedFinal.payoutAuthorized,false);assert.equal(acceptedFinal.finalizationAuthorized,false);
  assert.deepEqual(enabled(`select app.record_native_playoff_final_awards_v1('${tournamentId}','${eventId}',${literal(finalRequest)});`),{...acceptedFinal,historicalReceipt:true,currentSourceVerified:false});
  stored=enabled(`select app.get_native_playoff_final_award_record_v1('${tournamentId}','${eventId}');`);
  writeEvidence('native-playoff-final-award-record.json',stored);
  assert.equal(stored.status,'recorded');assert.equal(stored.totalMinor,56000);assert.equal(stored.historicalReceipt,true);
  assert.equal(stored.currentSourceVerified,false);assert.equal(stored.finalizationAuthorized,false);
  assert.equal(stored.recipientCount,5);assert.equal(stored.sourceDigest,source.sourceDigest);
  assert.equal(stored.recipientSourceDigest,source.recipientSourceDigest);assert.equal(stored.fundSourceDigest,source.fundSourceDigest);
  assert.equal(stored.proposalRevisionId,source.proposal.revisionId);assert.equal(stored.fundReviewId,source.income.reviewId);
  assert.equal(stored.qualificationResultVersionId,source.proposal.qualificationResultVersionId);
  assert.deepEqual(stored.groups,source.projection.groups);
  const ordered=value=>structuredClone(value).sort((a,b)=>a.firstPlace-b.firstPlace||String(a.participantId).localeCompare(String(b.participantId)));
  assert.deepEqual(stored.recipients,ordered(source.projection.recipients));
  assert.equal(stored.recipients.reduce((sum,row)=>sum+row.amountMinor,0),56000);
  assert.deepEqual(stored.sourceCapture,source);
  const postFinal=enabled(`select app.record_native_unrestricted_income_v1('${tournamentId}','${eventId}',${literal({...incomeRequest,operationId:nextOperationId()})});`);
  assert.equal(postFinal.code,'final_awards_already_recorded');
  await withHeldLock(`begin;lock table app.playoff_series_game_actions_v1 in row exclusive mode;select 'LOCK_HELD';`,async()=>{
   const busy=enabled(`select app.native_playoff_final_award_source_v1('${tournamentId}','${eventId}','${actorId}');`);
   assert.equal(busy.status,'retry_exact');assert.equal(busy.code,'source_busy');
  });
  assert.equal(enabled(`select app.get_native_playoff_final_award_record_v1('${tournamentId}','${eventId}');`,outsiderId),null);
  // A temporary relation exercises the exact trigger body without disabling or
  // weakening the existing stronger legacy-finance backstop triggers.
  const reverseGuard=owner(`do $$begin create temporary table final_guard_probe(tournament_id uuid,event_id uuid);create trigger aa_native_final_award_liability_v1 before insert on final_guard_probe for each row execute function app.require_no_native_final_award_liability_v1();begin insert into final_guard_probe values('${tournamentId}','${eventId}');raise exception 'guard_missing';exception when others then if sqlerrm<>'native_final_award_liability_exists'then raise;end if;end;end$$;select to_jsonb(true);`);
  assert.equal(reverseGuard,true);
 }finally{
  q(originalFinalGate);q(originalRecipientGate);q(originalProposalGate);
  assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.native_playoff_final_awards_enabled_v1()'::regprocedure));`),originalFinalGate);
  assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.native_playoff_finance_recipient_source_enabled_v1()'::regprocedure));`),originalRecipientGate);
  assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.operational_event_finance_proposals_enabled_v1()'::regprocedure));`),originalProposalGate);
 }
 const acl=owner(`select jsonb_build_object(
  'anonSource',has_function_privilege('anon','app.native_playoff_final_award_source_v1(uuid,uuid,uuid)','EXECUTE'),
  'authSource',has_function_privilege('authenticated','app.native_playoff_final_award_source_v1(uuid,uuid,uuid)','EXECUTE'),
  'serviceSource',has_function_privilege('service_role','app.native_playoff_final_award_source_v1(uuid,uuid,uuid)','EXECUTE'),
  'anonFinal',has_function_privilege('anon','app.record_native_playoff_final_awards_v1(uuid,uuid,jsonb)','EXECUTE'),
  'authFinal',has_function_privilege('authenticated','app.record_native_playoff_final_awards_v1(uuid,uuid,jsonb)','EXECUTE'),
  'serviceFinal',has_function_privilege('service_role','app.record_native_playoff_final_awards_v1(uuid,uuid,jsonb)','EXECUTE'));`);
 assert.deepEqual(acl,{anonSource:false,authSource:false,serviceSource:false,anonFinal:false,authFinal:false,serviceFinal:false});
 return{status:'passed',eventId,awardSetId:acceptedFinal.awardSetId,sourceDigest:source.sourceDigest,
  fundSourceDigest:source.fundSourceDigest,totalMinor:stored.totalMinor,recipientCount:stored.recipientCount,
  recordedIncomeMinor:source.income.incomeTotalMinor,reviewStatus:source.income.reviewStatus,
  fixtureOnlyExplicitOverrideReReview:true,productionOverrideRebaseUiAvailable:false,
  moneyMoved:false,payoutAuthorized:false,disbursementAuthorized:false,finalizationAuthorized:false};
}
