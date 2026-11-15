// Local fictional late Con fees: separate charge streams, no Main replacement.
import assert from'node:assert/strict';
import{planNativeLedgerAllocationsV1}from'../src/lib/finance/native-ledger-allocation-plan-v1.ts';
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
export function prepareLateConPayments({q,read,actorId,outsiderId,tournamentId,nextOperationId,writeEvidence=()=>{}}){
 const owner=(sql,who=actorId)=>read(sql,who,'ownerAuthenticated');
 const original=owner(`select to_jsonb(pg_get_functiondef('app.consy_addon_payments_enabled_v1()'::regprocedure));`);
 const baseHistory=()=>owner(`select jsonb_build_object('payments',(select jsonb_agg(to_jsonb(p)order by roster_entry_id,version)from app.roster_payment_events p where tournament_id='${tournamentId}'),'obligations',(select jsonb_agg(to_jsonb(p)order by roster_entry_id,version)from app.roster_payment_obligation_versions p where tournament_id='${tournamentId}'));`);
 const before=baseHistory();let scopeRequest,eventId,firstRequest,firstRoster,receiptRows=[];
 q(`create or replace function app.consy_addon_payments_enabled_v1()returns boolean language sql immutable set search_path=''as $$select true$$;alter function app.consy_addon_payments_enabled_v1()owner to postgres;revoke all on function app.consy_addon_payments_enabled_v1()from public,anon,authenticated,service_role;`);
 const hook=({eventId:eid,mainId,admitted})=>{
  eventId=eid;const binding=owner(`select jsonb_build_object('activationId',id,'setupEventVersionId',setup_event_version_id)from app.tournament_setup_activations where tournament_id='${tournamentId}'and event_id='${eventId}';`);
  scopeRequest={kind:'consy-addon-scope-v1',operationId:nextOperationId(),...binding,confirmed:true};
  const scope=owner(`select app.open_consy_addon_scope_v1('${tournamentId}','${eventId}',${literal(scopeRequest)});`);assert.equal(scope.status,'scope_opened',JSON.stringify(scope));
  assert.deepEqual(owner(`select app.open_consy_addon_scope_v1('${tournamentId}','${eventId}',${literal(scopeRequest)});`),{...scope,historicalReceipt:true,currentSourceVerified:false});
  const paid=()=>owner(`select jsonb_build_object('main',(select count(*)from app.event_participants p where event_id='${mainId}'and app.event_qr_player_is_paid_and_enrolled('${tournamentId}',p.event_id,p.roster_entry_id)),'con',(select count(*)from app.event_participants p where event_id='${eventId}'and app.event_qr_player_is_paid_and_enrolled('${tournamentId}',p.event_id,p.roster_entry_id)));`);
  assert.deepEqual(paid(),{main:18,con:0});
  assert.equal(owner(`select app.get_consy_addon_workspace_v1('${tournamentId}','${eventId}');`,outsiderId),null);
  for(let index=0;index<admitted.length;index++){
   const row=admitted[index];if(index===15){const version=owner(`select to_jsonb(coalesce(max(version),0))from app.tournament_payment_method_config_versions where tournament_id='${tournamentId}';`);assert.equal(owner(`select public.set_tournament_payment_method_configuration('${tournamentId}',${version},false,true,'${nextOperationId()}');`).status,'payment_methods_configured');}
   const source=owner(`select app.get_consy_addon_receipt_source_v1('${tournamentId}','${eventId}','${row.rosterId}');`);assert.equal(source.status,'source_available',JSON.stringify(source));
   const request={kind:'consy-addon-receipt-v1',operationId:nextOperationId(),rosterEntryId:row.rosterId,sourceDigest:source.sourceDigest,amountMinor:1000,currency:'USD',paymentMethod:index===15?'check':'cash',receivedAt:new Date().toISOString(),note:'TEST ONLY additional Con fee received separately after Main; no actual money',confirmed:true};
   if(index===0){const bad={...request,operationId:nextOperationId(),amountMinor:500};const rejected=owner(`select app.record_consy_addon_receipt_v1('${tournamentId}','${eventId}','${row.rosterId}',${literal(bad)});`);assert.equal(rejected.status,'rejected');assert.equal(rejected.code,'source_changed');}
   const recorded=owner(`select app.record_consy_addon_receipt_v1('${tournamentId}','${eventId}','${row.rosterId}',${literal(request)});`);assert.equal(recorded.status,'consolation_addon_recorded',JSON.stringify(recorded));
   assert.deepEqual(owner(`select app.record_consy_addon_receipt_v1('${tournamentId}','${eventId}','${row.rosterId}',${literal(request)});`),{...recorded,historicalReceipt:true,currentSourceVerified:false});
   const lookup=owner(`select app.get_consy_addon_operation_v1('${tournamentId}','${eventId}','${request.operationId}');`);assert.deepEqual(lookup.request,request);assert.equal(lookup.receiptId,recorded.receiptId);assert.equal(lookup.currentSourceVerified,false);
   if(index===0){firstRequest=request;firstRoster=row.rosterId;const duplicate=owner(`select app.record_consy_addon_receipt_v1('${tournamentId}','${eventId}','${row.rosterId}',${literal({...request,operationId:nextOperationId()})});`);assert.equal(duplicate.code,'already_recorded');}
   receiptRows.push(recorded);
  }
  const nonce=owner(`select public.record_manual_roster_payment('${tournamentId}','${firstRoster}',1,1000,'USD','cash',clock_timestamp()-interval '1second','TEST ONLY shared nonce conflict','${firstRequest.operationId}');`);assert.equal(nonce.code,'idempotency_conflict');
  assert.equal(owner(`select to_jsonb(count(*))from app.operation_receipts where actor_profile_id='${actorId}'and client_operation_id='${firstRequest.operationId}';`),1);
  const baseId=owner(`select to_jsonb(base_receipt_id)from app.consy_addon_receipts_v1 where tournament_id='${tournamentId}'and roster_entry_id='${firstRoster}';`);
  const voided=owner(`select public.void_manual_roster_payment('${tournamentId}','${firstRoster}',1,'${baseId}','TEST ONLY prohibited Main void after separate Con payment','${nextOperationId()}');`);assert.equal(voided.status,'rejected');
  assert.throws(()=>q(`insert into app.native_unrestricted_income_sources_v1(tournament_id,event_id,income_id,physical_evidence_id,evidence_reference,created_by)values('${tournamentId}','${eventId}','${nextOperationId()}','${receiptRows[0].receiptId}','TEST ONLY forbidden addon as income','${actorId}');`),/consy_addon_physical_identity_conflict/);
  assert.deepEqual(paid(),{main:18,con:16});assert.equal(owner(`select to_jsonb(count(*))from app.consy_addon_receipts_v1 where tournament_id='${tournamentId}'and app.consy_addon_receipt_valid_v1(id);`),16);
  const workspace=owner(`select app.get_consy_addon_workspace_v1('${tournamentId}','${eventId}');`);assert.ok(workspace.players.every(r=>r.baseReceiptMinor===3000&&r.legacyBaseObligationMinor===3000&&r.thisConsolationAddonMinor===1000&&r.allRecordedReceiptMinor===4000&&r.thisEventPaymentRecorded));writeEvidence('late-con-workspace.json',workspace);
  const source=owner(`select app.get_native_event_ledger_sources_v1('${tournamentId}');`);assert.equal(source.kind,'native-event-ledger-sources-consolation-addons-v1');assert.equal(source.facts.receiptEvents.length,34);
  const head=owner(`select jsonb_build_object('id',id,'allocations',request_payload->'allocations')from app.native_ledger_allocation_revisions_v1 where tournament_id='${tournamentId}'order by version desc limit 1;`);
  const allocations=[...head.allocations,...receiptRows.map(r=>({sourceId:r.receiptId,allocations:[{eventId,bucket:'regular_entry',poolId:null,amountMinor:1000,classificationReviewed:true}]}))];
  const request={kind:'native-ledger-allocation-v1',operationId:nextOperationId(),expectedRevisionId:head.id,sourceDigest:source.sourceDigest,allocations,reason:'TEST ONLY preserve Main30 and separately allocate Con10 receipts',reviewed:true};
  const {kind,expectedRevisionId,...pure}=request;void kind;void expectedRevisionId;assert.equal(planNativeLedgerAllocationsV1({current:source,request:pure}).status,'planned');
  const bad=structuredClone(request);bad.operationId=nextOperationId();const root=bad.allocations.find(r=>r.sourceId===source.facts.addonBindings[0].baseReceiptId);root.allocations=[{eventId:mainId,bucket:'regular_entry',poolId:null,amountMinor:2000,classificationReviewed:true},{eventId,bucket:'regular_entry',poolId:null,amountMinor:1000,classificationReviewed:true}];
  const rejected=owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(bad)});`);assert.equal(rejected.status,'rejected');assert.equal(rejected.code,'base_allocation_ineligible');
  const saved=owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(request)});`);assert.equal(saved.status,'accepted',JSON.stringify(saved));
  assert.deepEqual(baseHistory(),before);writeEvidence('late-con-receipts-allocation.json',{scope,receipts:receiptRows,allocation:saved,protectedBaseHistory:before});
 };
 return{hook,finish:()=>{
  assert.deepEqual(baseHistory(),before);q(original);
  const replay=owner(`select app.record_consy_addon_receipt_v1('${tournamentId}','${eventId}','${firstRoster}',${literal(firstRequest)});`);assert.equal(replay.status,'consolation_addon_recorded');assert.equal(replay.historicalReceipt,true);
  assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.consy_addon_payments_enabled_v1()'::regprocedure));`),original);
  return{lateReceipts:receiptRows.length,mainReceiptAndObligationHistoryUnchanged:true,separateRecordedMinor:16000,sharedNonceAndHistoricalReplay:true,mainFundProtected:true,moneyMoved:false};
 },restore:()=>q(original)};
}
