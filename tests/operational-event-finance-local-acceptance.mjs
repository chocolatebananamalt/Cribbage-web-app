// Synthetic disposable-PostgreSQL acceptance for the private operational
// Finance estimate proposal. No provider, real payment, award or payout exists.
import assert from 'node:assert/strict';
const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const id=n=>`a2970000-0000-4000-8000-${String(n).padStart(12,'0')}`;

export async function verifyOperationalEventFinance({q,read,withHeldLock,parallelQueries,actorId,outsiderId,tournamentId,nextOperationId}){
 const owner=(sql,who=actorId)=>read(sql,who,'ownerAuthenticated');
 const enabled=sql=>owner(`set app.fixture_operational_finance_proposals='approved-local-only';${sql}`);
 const binding=owner(`select jsonb_build_object('eventId',event_id,'setupEventVersionId',setup_event_version_id)from app.event_settings_operational_bindings_v1 where tournament_id='${tournamentId}';`);
 assert.ok(binding);assert.notEqual(binding.eventId,binding.setupEventVersionId);
 const eventId=binding.eventId;
 const source=owner(`select app.get_operational_event_finance_source_v1('${tournamentId}','${eventId}');`);
 assert.equal(source.status,'source_available');assert.equal(source.kind,'operational-event-finance-source-v1');
 assert.equal(source.eventId,eventId);assert.equal(source.raw.binding.setupEventVersionId,binding.setupEventVersionId);
 assert.deepEqual(source.raw.coverage,{additionalIncome:'unavailable',optionalPools:'isolated_regular_allocation',recordedFundAvailable:false});
 assert.equal(source.basis.kind,'operational-finance-estimate-basis-v1');
 assert.deepEqual(source.basis.coverage,source.raw.coverage);
 const workspace=source.basis.workspace;
 assert.equal(workspace.mode,'estimate');assert.equal(workspace.complete,true);
 assert.equal(workspace.source.eventId,eventId);assert.equal(workspace.payoutSource.eventId,eventId);
 assert.equal(workspace.grossEntryMinor>0,true);assert.equal(workspace.entryCount,1);assert.equal(workspace.paidEntryCount,1);
 assert.equal(workspace.history.length,1);assert.equal(workspace.history[0].line.category,'operating_expense');
 assert.equal(source.raw.allocation.eventSources.length,2);
 for(const row of source.raw.allocation.eventSources){
  assert.deepEqual(Object.keys(row).sort(),['allocations','amountMinor','kind','physicalEvidenceId','sourceId','state'].sort());
  assert.equal(row.state,'active');assert.ok(row.allocations.every(part=>part.eventId===eventId&&part.poolId===null&&part.classificationReviewed===true));
 }
 assert.equal(source.raw.qualification,null);
 assert.equal(source.proposalOnly,true);assert.equal(source.moneyMoved,false);assert.equal(source.finalizationAuthorized,false);assert.equal(source.payoutAuthorized,false);
 assert.equal(owner(`select app.get_operational_event_finance_source_v1('${tournamentId}','${eventId}');`,outsiderId).code,'not_director');
 assert.equal(owner(`select to_jsonb(app.operational_event_finance_proposals_enabled_v1());`),false);

 const editor={basis:source.basis.workspace,history:structuredClone(workspace.history),overrideHistory:[],overrideInput:null,overridePlan:null,lineForm:null,bandForm:null,message:''};
 const request=operationId=>({kind:'operational-event-finance-proposal-v1',operationId,expectedVersion:0,expectedSourceDigest:source.sourceDigest,expectedBasisDigest:source.basisDigest,editor:structuredClone(editor),reason:'Synthetic local proposal only'});
 const defaultRequest=request(nextOperationId());
 assert.deepEqual(owner(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(defaultRequest)});`),{status:'rejected',code:'feature_unavailable',proposalOnly:true,moneyMoved:false,finalizationAuthorized:false,payoutAuthorized:false});
 assert.deepEqual(owner(`select jsonb_build_object('operations',(select count(*)from app.operational_event_finance_operations_v1),'revisions',(select count(*)from app.operational_event_finance_revisions_v1),'outcomes',(select count(*)from app.operational_event_finance_outcomes_v1));`),{operations:0,revisions:0,outcomes:0});

 const originalGate=owner(`select to_jsonb(pg_get_functiondef('app.operational_event_finance_proposals_enabled_v1()'::regprocedure));`);
 assert.match(originalGate,/select false/);
 let accepted,secondAccepted;
 try{
  q(`create or replace function app.operational_event_finance_proposals_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_operational_finance_proposals',true)='approved-local-only',false)$$;alter function app.operational_event_finance_proposals_enabled_v1()owner to postgres;revoke all on function app.operational_event_finance_proposals_enabled_v1()from public,anon,authenticated,service_role;`);
  assert.equal(owner(`select to_jsonb(app.operational_event_finance_proposals_enabled_v1());`),false);
  const first=request(nextOperationId());
  accepted=enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(first)});`);
  assert.equal(accepted.status,'accepted');assert.equal(accepted.version,1);assert.equal(accepted.moneyMoved,false);assert.equal(accepted.payoutAuthorized,false);
  assert.deepEqual(enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(first)});`),{...accepted,historicalReceipt:true,currentSourceVerified:false});
  assert.deepEqual(owner(`select app.reconcile_operational_event_finance_proposal_v1('${tournamentId}','${eventId}','${first.operationId}');`),{...accepted,historicalReceipt:true,currentSourceVerified:false});
  assert.equal(enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal({...first,reason:'Changed request'})});`).code,'idempotency_conflict');

  const tampered={...request(nextOperationId()),expectedVersion:1};tampered.editor.basis.grossEntryMinor+=1;
  assert.equal(enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(tampered)});`).code,'invalid_editor');
  const nullKind=request(nextOperationId());nullKind.kind=null;
  assert.equal(enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(nullKind)});`).code,'invalid_request');
  const stale=request(nextOperationId());
  assert.equal(enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(stale)});`).code,'stale_version');

  const nextEditor=structuredClone(editor);const lineId=id(500),recordId=id(501);
  nextEditor.history.push({label:'Local zero proposal',line:{recordId,lineId,priorRecordId:null,source:structuredClone(workspace.source),mode:'estimate',category:'unrestricted_income',amountMinor:0,voided:false,reason:'Explicit local zero'}});
  nextEditor.lineForm={category:'player_benefit',lineId:null,label:'',amount:'',reason:''};
  nextEditor.message='Incomplete form retained without creating ledger evidence.';
  const second={...request(nextOperationId()),expectedVersion:1,editor:nextEditor,reason:'Append explicit zero and incomplete form'};
  secondAccepted=enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(second)});`);
  assert.equal(secondAccepted.status,'accepted');assert.equal(secondAccepted.version,2);
  const saved=owner(`select jsonb_build_object('history',jsonb_array_length(editor->'history'),'lineForm',editor->'lineForm','proposalOnly',proposal_only,'moneyMoved',money_moved)from app.operational_event_finance_revisions_v1 where id='${secondAccepted.revisionId}';`);
  assert.equal(saved.history,2);assert.deepEqual(saved.lineForm,nextEditor.lineForm);assert.equal(saved.proposalOnly,true);assert.equal(saved.moneyMoved,false);

  // Direct validation of a complete whole-band override. This does not create
  // sporting/qualification authority; the real current source has no result yet.
  const syntheticBasis=structuredClone(source.basis);syntheticBasis.workspace.qualifierCount=4;
  syntheticBasis.workspace.settings={method:'graduated_all_qualifiers',factor:'1.5'};
  const overrideEditor={basis:syntheticBasis.workspace,history:structuredClone(syntheticBasis.workspace.history),overrideHistory:[{recordId:id(600),firstPlace:1,lastPlace:1,priorRecordId:null,perPersonMinor:500,voided:false,reason:'Synthetic whole-band check'}],overrideInput:null,overridePlan:null,lineForm:null,bandForm:{firstPlace:1,lastPlace:1,amount:'5.00',reason:''},message:''};
  const gross=syntheticBasis.workspace.grossEntryMinor,expense=syntheticBasis.workspace.history[0].line.amountMinor;
  overrideEditor.overrideInput={fundMinor:gross-expense,qualifierCount:4,settings:syntheticBasis.workspace.settings};
  overrideEditor.overridePlan=JSON.stringify({basis:syntheticBasis.workspace,history:overrideEditor.history});
  assert.equal(owner(`select to_jsonb(app.valid_operational_event_finance_editor_v1(${literal(overrideEditor)},${literal(syntheticBasis)},null));`),true);
  const badBand=structuredClone(overrideEditor);badBand.overrideHistory[0].perPersonMinor=501;
  assert.equal(owner(`select to_jsonb(app.valid_operational_event_finance_editor_v1(${literal(badBand)},${literal(syntheticBasis)},null));`),false);
  const nullCategory=structuredClone(overrideEditor);nullCategory.history[0].line.category=null;
  assert.equal(owner(`select to_jsonb(app.valid_operational_event_finance_editor_v1(${literal(nullCategory)},${literal(syntheticBasis)},null));`),false);
  const nullMode=structuredClone(overrideEditor);nullMode.history[0].line.mode=null;
  assert.equal(owner(`select to_jsonb(app.valid_operational_event_finance_editor_v1(${literal(nullMode)},${literal(syntheticBasis)},null));`),false);
  const unknownLine=structuredClone(overrideEditor);unknownLine.lineForm={category:'player_benefit',lineId:id(999),label:'',amount:'',reason:''};
  assert.equal(owner(`select to_jsonb(app.valid_operational_event_finance_editor_v1(${literal(unknownLine)},${literal(syntheticBasis)},null));`),false);
  const partialBand=structuredClone(overrideEditor);partialBand.bandForm={firstPlace:3,lastPlace:3,amount:'',reason:''};
  assert.equal(owner(`select to_jsonb(app.valid_operational_event_finance_editor_v1(${literal(partialBand)},${literal(syntheticBasis)},null));`),false);
  const onePlaceBasis=structuredClone(syntheticBasis);onePlaceBasis.workspace.qualifierCount=1;onePlaceBasis.workspace.settings={method:'custom_top_paid',paidPlaces:1,factor:'1.5'};
  const outOfRangeBand=structuredClone(overrideEditor);outOfRangeBand.basis=onePlaceBasis.workspace;outOfRangeBand.overrideHistory=[];outOfRangeBand.overrideInput=null;outOfRangeBand.overridePlan=null;outOfRangeBand.bandForm={firstPlace:2,lastPlace:2,amount:'',reason:''};
  assert.equal(owner(`select to_jsonb(app.valid_operational_event_finance_editor_v1(${literal(outOfRangeBand)},${literal(onePlaceBasis)},null));`),false);
  const stalePlan=structuredClone(overrideEditor);stalePlan.history.push({label:'Later proposal',line:{recordId:id(602),lineId:id(601),priorRecordId:null,source:structuredClone(syntheticBasis.workspace.source),mode:'estimate',category:'unrestricted_income',amountMinor:0,voided:false,reason:'Later retained zero'}});
  assert.equal(owner(`select to_jsonb(app.valid_operational_event_finance_editor_v1(${literal(stalePlan)},${literal(syntheticBasis)},null));`),true);
  const ratioBasis=structuredClone(syntheticBasis);ratioBasis.workspace.settings={method:'custom_paid_ratio',ratio:6,factor:'1.5'};
  const ratio=structuredClone(overrideEditor);ratio.basis=ratioBasis.workspace;ratio.overrideInput.settings=ratioBasis.workspace.settings;ratio.overridePlan=JSON.stringify({basis:ratioBasis.workspace,history:ratio.history});
  assert.equal(owner(`select to_jsonb(app.valid_operational_event_finance_editor_v1(${literal(ratio)},${literal(ratioBasis)},null));`),false);

  const busy={...request(nextOperationId()),expectedVersion:2,editor:nextEditor,reason:'Busy retry proof'};
  await withHeldLock(`begin;lock table app.roster_payment_events in access exclusive mode;select 'LOCK_HELD';`,()=>{
   assert.deepEqual(enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(busy)});`),{status:'retry_exact',code:'source_busy'});
   assert.equal(owner(`select to_jsonb(count(*))from app.operational_event_finance_operations_v1 where actor_id='${actorId}'and operation_id='${busy.operationId}';`),0);
  });

  const rollback={...request(nextOperationId()),expectedVersion:2,editor:nextEditor,reason:'Rollback recovery proof'};
  q(`create function app.fixture_operational_finance_outcome_failure()returns trigger language plpgsql as $$begin raise exception'fixture operational finance outcome failure';end$$;create trigger fixture_operational_finance_outcome_failure before insert on app.operational_event_finance_outcomes_v1 for each row execute function app.fixture_operational_finance_outcome_failure();`);
  try{assert.throws(()=>enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(rollback)});`),/fixture operational finance outcome failure/);}
  finally{q(`drop trigger fixture_operational_finance_outcome_failure on app.operational_event_finance_outcomes_v1;drop function app.fixture_operational_finance_outcome_failure();`);}
  assert.equal(owner(`select to_jsonb(count(*))from app.operational_event_finance_operations_v1 where actor_id='${actorId}'and operation_id='${rollback.operationId}';`),0);
  const recovered=enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(rollback)});`);
  assert.equal(recovered.status,'accepted');assert.equal(recovered.version,3);

  const raceA={...request(nextOperationId()),expectedVersion:3,editor:nextEditor,reason:'Concurrent A'};
  const raceB={...request(nextOperationId()),expectedVersion:3,editor:nextEditor,reason:'Concurrent B'};
  const race=await parallelQueries([
   `set app.fixture_operational_finance_proposals='approved-local-only';select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(raceA)});`,
   `set app.fixture_operational_finance_proposals='approved-local-only';select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(raceB)});`,
  ],actorId);
  const raceResults=race.map(text=>JSON.parse(text.split(/\r?\n/).filter(Boolean).at(-1)));
  const acceptedIndex=raceResults.findIndex(x=>x.status==='accepted');
  assert.notEqual(acceptedIndex,-1);assert.equal(raceResults[acceptedIndex].version,4);
  const loserIndex=acceptedIndex===0?1:0;let loser=raceResults[loserIndex];
  if(loser.status==='retry_exact'){
   assert.ok(['event_busy','operation_busy','source_busy'].includes(loser.code));
   const loserRequest=loserIndex===0?raceA:raceB;
   loser=enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(loserRequest)});`);
  }
  assert.deepEqual({status:loser.status,code:loser.code},{status:'rejected',code:'stale_version'});

  // A stale finalized qualification is blocked rather than treated as a usable
  // denominator. The synthetic immutable rows exist only inside this rollback.
  const staleQualification=owner(`begin;
   insert into app.event_participants(id,tournament_id,event_id,profile_id,status)
    values('${id(700)}','${tournamentId}','${eventId}','${actorId}','registered');
   insert into app.event_schedule_publications(id,tournament_id,event_id,source_method,game_count,participant_count,match_count,schedule_digest,actor_profile_id,operation_receipt_id,published_at)
    select '${id(701)}','${tournamentId}','${eventId}','director_entry',1,2,1,repeat('9',64),'${actorId}',id,clock_timestamp()
    from app.operation_receipts where tournament_id='${tournamentId}'and outcome='accepted'order by applied_at limit 1;
   insert into app.qualification_result_versions(id,tournament_id,event_id,version,ruleset_version_id,schedule_publication_id,participant_count,qualifier_count,high_non_qualifier_participant_id,standings_digest,finalized_by_profile_id,operation_receipt_id,finalized_at)
    select '${id(702)}','${tournamentId}','${eventId}',1,e.ruleset_version_id,'${id(701)}',2,1,p.id,repeat('8',64),'${actorId}',s.operation_receipt_id,clock_timestamp()
    from app.events e join app.event_participants p on p.event_id=e.id join app.event_schedule_publications s on s.event_id=e.id
    where e.id='${eventId}'order by p.id limit 1;
   select app.get_operational_event_finance_source_v1('${tournamentId}','${eventId}');rollback;`);
  assert.deepEqual(staleQualification,{status:'blocked',code:'qualification_source_changed'});

  const tables=['operational_event_finance_operations_v1','operational_event_finance_revisions_v1','operational_event_finance_outcomes_v1'];
  const functions=[
   `app.get_operational_event_finance_source_v1('${tournamentId}','${eventId}')`,
   `app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}','{}'::jsonb)`,
   `app.reconcile_operational_event_finance_proposal_v1('${tournamentId}','${eventId}','${first.operationId}')`,
  ];
  for(const role of ['anon','authenticated','service_role']){
   for(const table of tables){
    assert.throws(()=>q(`select*from app.${table} limit 0;`,actorId,role),/permission denied/);
    assert.throws(()=>q(`insert into app.${table} default values;`,actorId,role),/permission denied/);
    assert.throws(()=>q(`delete from app.${table} where false;`,actorId,role),/permission denied/);
   }
   for(const call of functions)assert.throws(()=>q(`select ${call};`,actorId,role),/permission denied/);
  }
  assert.deepEqual(owner(`select jsonb_build_object('tables',(select count(*)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app'and c.relname like'operational_event_finance_%_v1'and c.relkind='r'and c.relrowsecurity and c.relforcerowsecurity),'revisions',(select count(*)from app.operational_event_finance_revisions_v1),'operations',(select count(*)from app.operational_event_finance_operations_v1),'outcomes',(select count(*)from app.operational_event_finance_outcomes_v1));`),{tables:3,revisions:4,operations:7,outcomes:7});
 }finally{
  q(originalGate);
  assert.equal(owner(`select to_jsonb(app.operational_event_finance_proposals_enabled_v1());`),false);
  assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.operational_event_finance_proposals_enabled_v1()'::regprocedure));`),originalGate);
 }
 return{sourceAvailable:true,estimateCoverage:true,defaultHardFalse:true,fixtureGateRestoredExactly:true,replayReconcile:true,appendOnlyZeroAndIncomplete:true,wholeBandFiveDollarValidation:true,busyRetryNoJournal:true,rollbackRecovery:true,distinctOperationConcurrency:true,actualAclRls:true,moneyMoved:false,payoutAuthorized:false,finalizationAuthorized:false,hostedWrites:false,eventId,revisionId:secondAccepted?.revisionId??null};
}
