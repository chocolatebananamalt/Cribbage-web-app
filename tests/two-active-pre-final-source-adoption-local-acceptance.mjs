import assert from 'node:assert/strict';
import{reduceEventFinanceEditorV1}from'../src/lib/finance/event-finance-workspace-v1.ts';
import{buildNativeCostAdoptionRequestV1,planNativeCostAdoptionV1}from'../src/lib/finance/native-cost-adoption-plan-v1.ts';
import{readOperationalFinanceSourceAdoptionWorkspaceV1}from'../src/lib/api/operational-finance-source-adoption-v1.ts';

const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const parse=output=>{const line=String(output).split(/\r?\n/).filter(Boolean).at(-1);return line===undefined?null:JSON.parse(line);};

/** Bounded synthetic local proof. Registration, play and qualification are
 * supplied by the reviewed current-qualification helper. Expenses and native
 * allocation changes use their supported writers. No payment is made. */
export async function verifyTwoActivePreFinalFinanceSourceAdoptionV1({q,read,parallelQueries,actorId,outsiderId,tournamentId,nextOperationId,writeEvidence=()=>{},afterCurrentAdoption=null}){
 const eventId=read(`select to_jsonb(event_id)from app.event_settings_operational_bindings_v1 b join app.events e on e.id=b.event_id where b.tournament_id='${tournamentId}'and e.event_type='main'`,actorId,'ownerAuthenticated');
 assert.match(eventId,/^[a-f0-9-]{36}$/);
 const scope={actorId,tournamentId,eventId};
 const owner=sql=>read(sql,actorId,'ownerAuthenticated');
 const original=owner(`select jsonb_build_object(
  'proposal',pg_get_functiondef('app.operational_event_finance_proposals_enabled_v1()'::regprocedure),
  'adoption',pg_get_functiondef('app.operational_finance_source_adoption_enabled_v1()'::regprocedure)
 );`);
 assert.match(original.proposal,/select false/);assert.match(original.adoption,/select false/);
 const marker=`set app.fixture_operational_finance_proposals='approved-local-only';set app.fixture_operational_finance_adoption='approved-local-only';`;
 const enabled=sql=>owner(`${marker}${sql}`);
 let result;
 try{
  q(`create or replace function app.operational_event_finance_proposals_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_operational_finance_proposals',true)='approved-local-only',false)$$;
   create or replace function app.operational_finance_source_adoption_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_operational_finance_adoption',true)='approved-local-only',false)$$;
   alter function app.operational_event_finance_proposals_enabled_v1()owner to postgres;alter function app.operational_finance_source_adoption_enabled_v1()owner to postgres;
   revoke all on function app.operational_event_finance_proposals_enabled_v1()from public,anon,authenticated,service_role;
   revoke all on function app.operational_finance_source_adoption_enabled_v1()from public,anon,authenticated,service_role;`);
  assert.equal(owner(`select app.get_operational_finance_source_adoption_workspace_v1('${tournamentId}','${eventId}');`),null);

  const priorSource=owner(`select app.get_operational_event_finance_source_v1('${tournamentId}','${eventId}');`);
  const priorHead=owner(`select jsonb_build_object('id',id,'version',version,'editor',editor)from app.operational_event_finance_revisions_v1 where tournament_id='${tournamentId}'and event_id='${eventId}'order by version desc limit 1;`);
  assert.equal(priorHead.version,1);let editor=priorHead.editor,sequence=7000;
  const makeId=()=>`e6030000-0000-4000-8000-${String(sequence++).padStart(12,'0')}`;
  const apply=action=>{editor=reduceEventFinanceEditorV1(editor,action,priorSource.basis.workspace,makeId);assert.ok(editor);};
  const add=(category,label,amount,reason)=>{apply({type:'add_line',category});for(const[field,value]of Object.entries({label,amount,reason}))apply({type:'line_field',field,value});apply({type:'apply_line'});return editor.history.at(-1).line.lineId;};
  const sanctionBase=priorSource.basis.workspace.history.find(row=>row.line.amountMinor===5400);assert.ok(sanctionBase);
  apply({type:'void_line',lineId:sanctionBase.line.lineId,reason:'Draft-only classification held for recorded source adoption'});
  const coffeeLineId=add('operating_expense','Coffee and Tea','5.00','Proposed refreshments pending a recorded expense');
  const voidedLineId=add('player_benefit','Withdrawn Door Prize','7.00','Earlier proposed benefit');apply({type:'void_line',lineId:voidedLineId,reason:'Proposal withdrawn before source adoption'});
  const zeroLineId=add('operating_expense','No Charge Supplies','0','No charge expected');
  add('unrestricted_income','Fictional Donation','5.00','Proposal-only documented income estimate');
  const revisionTwoRequest={kind:'operational-event-finance-proposal-v1',operationId:nextOperationId(),expectedVersion:1,expectedSourceDigest:priorSource.sourceDigest,expectedBasisDigest:priorSource.basisDigest,editor,reason:'Prepare explicit local cost lineages before source adoption'};
  const revisionTwo=enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(revisionTwoRequest)});`);
  assert.equal(revisionTwo.status,'accepted',JSON.stringify(revisionTwo));assert.equal(revisionTwo.version,2);

  const coffeeExpense=owner(`select public.record_tournament_expense('${tournamentId}',500,'USD','TEST ONLY adoption coffee expense','${nextOperationId()}');`);
  assert.equal(coffeeExpense.status,'expense_recorded',JSON.stringify(coffeeExpense));
  const ledger=owner(`select app.get_native_event_ledger_sources_v1('${tournamentId}');`);assert.equal(ledger.status,'sources_available');
  const allocationHead=owner(`select app.get_native_ledger_allocation_v1('${tournamentId}');`);assert.equal(allocationHead.status,'stale');assert.equal(allocationHead.code,'native_source_changed');
  const allocations=[...ledger.facts.receiptEvents.map(row=>({sourceId:row.sourceId,allocations:[{eventId,bucket:'regular_entry',poolId:null,amountMinor:row.amountMinor,classificationReviewed:true}]})),...ledger.facts.expenseEvents.map(row=>({sourceId:row.sourceId,allocations:[{eventId,bucket:'operating_expense',poolId:null,amountMinor:row.amountMinor,classificationReviewed:true}]}))];
  const allocationRequest={kind:'native-ledger-allocation-v1',operationId:nextOperationId(),expectedRevisionId:allocationHead.revisionId,sourceDigest:ledger.sourceDigest,allocations,reason:'Add the supported recorded coffee expense to the complete local allocation',reviewed:true};
  const allocation=owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(allocationRequest)});`);assert.equal(allocation.status,'accepted',JSON.stringify(allocation));

  const raw=enabled(`select app.operational_finance_source_adoption_workspace_v1('${tournamentId}','${eventId}','${actorId}');`);assert.equal(raw.status,'available',JSON.stringify(raw));
  const workspace=readOperationalFinanceSourceAdoptionWorkspaceV1(raw,scope);assert.ok(workspace?.prepared);
  const costs=workspace.prepared.costs,lineages=workspace.prepared.costLineages;
  const byEvent=new Map(costs.map(cost=>[cost.expenseEventId,cost]));
  const coffeeCost=costs.find(cost=>cost.expenseEventId===coffeeExpense.expenseEventId);assert.ok(coffeeCost);
  const dispositions=lineages.map(lineage=>{
   if(lineage.origin==='native'){const cost=byEvent.get(lineage.sourceExpenseEventId);assert.ok(cost);return{kind:lineage.records.length>1?'restore_native':'carry_native',priorLineId:lineage.lineId,currentBasisLineId:cost.lineId,currentExpenseId:cost.expenseId,currentExpenseEventId:cost.expenseEventId,bucket:cost.bucket,alias:lineage.snapshotLabel,reason:lineage.records.length>1?'Explicitly restore the unchanged recorded source':'Carry the unchanged recorded source'};}
   if(lineage.lineId===coffeeLineId)return{kind:'replace_manual',priorLineId:lineage.lineId,currentBasisLineId:coffeeCost.lineId,currentExpenseId:coffeeCost.expenseId,currentExpenseEventId:coffeeCost.expenseEventId,bucket:coffeeCost.bucket,alias:'Coffee and Tea',reason:'Replace the proposal with the supported recorded expense'};
   if(lineage.lineId===voidedLineId)return{kind:'retire_voided_manual',priorLineId:lineage.lineId,currentBasisLineId:null,currentExpenseId:null,currentExpenseEventId:null,bucket:lineage.latest.category,alias:null,reason:'Retain and archive the withdrawn proposed benefit'};
   if(lineage.lineId===zeroLineId)return{kind:'retire_zero_manual',priorLineId:lineage.lineId,currentBasisLineId:null,currentExpenseId:null,currentExpenseEventId:null,bucket:lineage.latest.category,alias:null,reason:'Retain and archive the zero proposed cost'};
   throw Error(`Unexpected manual lineage ${lineage.lineId}`);
  });
  const plan=planNativeCostAdoptionV1(workspace.prepared,dispositions);assert.equal(plan.status,'review_ready',JSON.stringify(plan));
  const rollbackRequest=buildNativeCostAdoptionRequestV1(plan,nextOperationId(),'Rollback probe for the exact reviewed adoption');assert.ok(rollbackRequest);
  const beforeCounts=owner(`select jsonb_build_object('revisions',count(*),'adoptions',(select count(*)from app.operational_event_finance_source_adoptions_v1 where tournament_id='${tournamentId}'and event_id='${eventId}'))from app.operational_event_finance_revisions_v1 where tournament_id='${tournamentId}'and event_id='${eventId}';`);
  const rollback=owner(`begin;${marker}select app.save_operational_finance_source_adoption_v1('${tournamentId}','${eventId}',${literal(rollbackRequest)});rollback;`);assert.equal(rollback.status,'accepted');
  assert.deepEqual(owner(`select jsonb_build_object('revisions',count(*),'adoptions',(select count(*)from app.operational_event_finance_source_adoptions_v1 where tournament_id='${tournamentId}'and event_id='${eventId}'))from app.operational_event_finance_revisions_v1 where tournament_id='${tournamentId}'and event_id='${eventId}';`),beforeCounts);

  const first=buildNativeCostAdoptionRequestV1(plan,nextOperationId(),'First concurrent reviewed source adoption');const second=buildNativeCostAdoptionRequestV1(plan,nextOperationId(),'Second concurrent reviewed source adoption');assert.ok(first&&second);
  const concurrent=(await parallelQueries([`${marker}select app.save_operational_finance_source_adoption_v1('${tournamentId}','${eventId}',${literal(first)});`,`${marker}select app.save_operational_finance_source_adoption_v1('${tournamentId}','${eventId}',${literal(second)});`],actorId)).map(parse);
  let accepted=concurrent.find(row=>row?.status==='accepted'),loser=concurrent.find(row=>row!==accepted);assert.ok(accepted,JSON.stringify(concurrent));
  if(loser?.status==='retry_exact'){const request=accepted.operationId===first.operationId?second:first;loser=enabled(`select app.save_operational_finance_source_adoption_v1('${tournamentId}','${eventId}',${literal(request)});`);}
  assert.equal(loser?.status,'rejected');assert.ok(['adoption_not_required','source_changed'].includes(loser.code),JSON.stringify(loser));
  const winner=accepted.operationId===first.operationId?first:second;
  const replay=enabled(`select app.save_operational_finance_source_adoption_v1('${tournamentId}','${eventId}',${literal(winner)});`);assert.equal(replay.historicalReceipt,true);assert.equal(replay.currentSourceVerified,false);
  const reconciliation=enabled(`select app.reconcile_operational_finance_source_adoption_v1('${tournamentId}','${eventId}','${winner.operationId}');`);assert.equal(reconciliation.authorized,true);assert.deepEqual(reconciliation.request,winner);assert.equal(reconciliation.result.historicalReceipt,true);
  const persisted=owner(`select jsonb_build_object('revisions',(select count(*)from app.operational_event_finance_revisions_v1 where tournament_id='${tournamentId}'and event_id='${eventId}'),'adoptions',(select count(*)from app.operational_event_finance_source_adoptions_v1 where tournament_id='${tournamentId}'and event_id='${eventId}'),'aliases',(select dispositions from app.operational_event_finance_source_adoptions_v1 where tournament_id='${tournamentId}'and event_id='${eventId}'),'outcomes',(select count(*)from app.operational_event_finance_outcomes_v1 where tournament_id='${tournamentId}'and event_id='${eventId}'and result->>'code'in('operational_finance_source_adopted','adoption_not_required','source_changed')));`);
  assert.equal(persisted.revisions,3);assert.equal(persisted.adoptions,1);assert.equal(persisted.aliases.find(row=>row.currentBasisLineId===coffeeCost.lineId).alias,'Coffee and Tea');assert.ok(persisted.outcomes>=1&&persisted.outcomes<=2);

  const adoptedEditor=winner.editor,currentSource=enabled(`select app.get_operational_event_finance_source_v1('${tournamentId}','${eventId}');`);
  const sameBasisRequest={kind:'operational-event-finance-proposal-v1',operationId:nextOperationId(),expectedVersion:3,expectedSourceDigest:currentSource.sourceDigest,expectedBasisDigest:currentSource.basisDigest,editor:adoptedEditor,reason:'Ordinary same-basis save after adoption for alias continuity proof'};
  const sameBasis=enabled(`select app.save_operational_event_finance_proposal_v1('${tournamentId}','${eventId}',${literal(sameBasisRequest)});`);assert.equal(sameBasis.status,'accepted');assert.equal(sameBasis.version,4);
  if(afterCurrentAdoption)await afterCurrentAdoption({eventId});
  // This variant's callback records the immutable unpaid final. Do not create a
  // subsequent expense/adoption attempt. Later alias continuity has separate
  // pre-final two-active coverage; it is not claimed by this variant.
  assert.equal(enabled(`select app.operational_finance_source_adoption_workspace_v1('${tournamentId}','${eventId}','${outsiderId}');`),null);
  const acl=owner(`select jsonb_build_object('tableAnon',has_table_privilege('anon','app.operational_event_finance_source_adoptions_v1','select'),'tableAuthenticated',has_table_privilege('authenticated','app.operational_event_finance_source_adoptions_v1','select,insert,update,delete'),'tableService',has_table_privilege('service_role','app.operational_event_finance_source_adoptions_v1','select,insert,update,delete'),'appAuthenticated',has_function_privilege('authenticated','app.save_operational_finance_source_adoption_v1(uuid,uuid,jsonb)','execute'),'publicAuthenticated',has_function_privilege('authenticated','public.save_operational_finance_source_adoption_provider_v1(uuid,uuid,jsonb)','execute'),'publicAnon',has_function_privilege('anon','public.save_operational_finance_source_adoption_provider_v1(uuid,uuid,jsonb)','execute'));`);
  assert.deepEqual(acl,{tableAnon:false,tableAuthenticated:false,tableService:false,appAuthenticated:false,publicAuthenticated:true,publicAnon:false});
  result={eventId,initialProposalRevisionId:priorHead.id,priorRevisionId:winner.expectedPriorRevisionId,adoptedRevisionId:accepted.revisionId,adoptionId:accepted.adoptionId,winnerStatus:accepted.status,loserStatus:loser.status,loserCode:loser.code,revisionCount:persisted.revisions,adoptionCount:persisted.adoptions,coffeeAlias:'Coffee and Tea',aliasSurvivedSameBasisSave:true,laterAliasSourceChangeNotRunAfterFinal:true,rollbackProved:true,acl,proposalOnly:true,moneyMoved:false,payoutAuthorized:false,disbursementAuthorized:false,finalizationAuthorized:false};
  writeEvidence('operational-finance-source-adoption-workspace.json',raw);writeEvidence('operational-finance-source-adoption-request.json',winner);writeEvidence('operational-finance-source-adoption-result.json',result);
  return result;
 }finally{
  q(`${original.proposal};${original.adoption};`);
  assert.equal(owner(`select to_jsonb(app.operational_event_finance_proposals_enabled_v1());`),false);assert.equal(owner(`select to_jsonb(app.operational_finance_source_adoption_enabled_v1());`),false);
  assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.operational_event_finance_proposals_enabled_v1()'::regprocedure));`),original.proposal);assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.operational_finance_source_adoption_enabled_v1()'::regprocedure));`),original.adoption);
 }
}
