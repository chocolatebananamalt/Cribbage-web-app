import assert from'node:assert/strict';
/** Disposable-DB role/RPC simulation. SET ROLE/JWT GUCs are not an actual
 * Supabase provider session and this helper never claims provider acceptance. */
export function verifyOperationalProviderTransportV1({q,read,actorId,outsiderId,tournamentId}){
 const literal=value=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
 const owner=query=>read(query,actorId,'ownerAuthenticated');
 const defs={
  transport:owner(`select to_jsonb(pg_get_functiondef('app.operational_provider_transport_enabled_v1()'::regprocedure));`),
  proposal:owner(`select to_jsonb(pg_get_functiondef('app.operational_event_finance_proposals_enabled_v1()'::regprocedure));`),
  recipient:owner(`select to_jsonb(pg_get_functiondef('app.native_playoff_finance_recipient_source_enabled_v1()'::regprocedure));`),
  final:owner(`select to_jsonb(pg_get_functiondef('app.native_playoff_final_awards_enabled_v1()'::regprocedure));`),
 };
 Object.values(defs).forEach(def=>assert.match(def,/select false/i));
 const eventId=owner(`select to_jsonb(event_id)from app.event_settings_operational_bindings_v1 where tournament_id='${tournamentId}'order by created_at desc limit 1;`);
 const before=owner(`select jsonb_build_object('financeOps',(select count(*)from app.operational_event_finance_operations_v1),'financeRevisions',(select count(*)from app.operational_event_finance_revisions_v1),'nativeOps',(select count(*)from app.native_playoff_finance_write_operations_v1),'awardSets',(select count(*)from app.native_playoff_final_award_sets_v1));`);
 const acl=owner(`select jsonb_build_object(
  'authWorkspace',has_function_privilege('authenticated','public.get_operational_finance_provider_workspace_v1(uuid,uuid)','EXECUTE'),
  'anonWorkspace',has_function_privilege('anon','public.get_operational_finance_provider_workspace_v1(uuid,uuid)','EXECUTE'),
  'serviceWorkspace',has_function_privilege('service_role','public.get_operational_finance_provider_workspace_v1(uuid,uuid)','EXECUTE'),
  'authFinal',has_function_privilege('authenticated','public.record_native_playoff_final_awards_provider_v1(uuid,uuid,jsonb)','EXECUTE'),
  'anonFinal',has_function_privilege('anon','public.record_native_playoff_final_awards_provider_v1(uuid,uuid,jsonb)','EXECUTE'),
  'serviceFinal',has_function_privilege('service_role','public.record_native_playoff_final_awards_provider_v1(uuid,uuid,jsonb)','EXECUTE'),
  'authPrivate',has_function_privilege('authenticated','app.record_native_playoff_final_awards_v1(uuid,uuid,jsonb)','EXECUTE'),
  'servicePrivate',has_function_privilege('service_role','app.record_native_playoff_final_awards_v1(uuid,uuid,jsonb)','EXECUTE'))`);
 assert.deepEqual(acl,{authWorkspace:true,anonWorkspace:false,serviceWorkspace:false,authFinal:true,anonFinal:false,serviceFinal:false,authPrivate:false,servicePrivate:false});
 assert.equal(read(`select public.get_operational_finance_provider_workspace_v1('${tournamentId}','${eventId}');`,actorId,'authenticated'),null);
 try{
  q(`create or replace function app.operational_provider_transport_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_provider_transport',true)='approved-local-only',false)$$;
   create or replace function app.operational_event_finance_proposals_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_provider_transport',true)='approved-local-only',false)$$;
   create or replace function app.native_playoff_finance_recipient_source_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_provider_transport',true)='approved-local-only',false)$$;
   create or replace function app.native_playoff_final_awards_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_provider_transport',true)='approved-local-only',false)$$;
   alter function app.operational_provider_transport_enabled_v1()owner to postgres;alter function app.operational_event_finance_proposals_enabled_v1()owner to postgres;alter function app.native_playoff_finance_recipient_source_enabled_v1()owner to postgres;alter function app.native_playoff_final_awards_enabled_v1()owner to postgres;
   revoke all on function app.operational_provider_transport_enabled_v1(),app.operational_event_finance_proposals_enabled_v1(),app.native_playoff_finance_recipient_source_enabled_v1(),app.native_playoff_final_awards_enabled_v1()from public,anon,authenticated,service_role;`);
  const enabled=(query,who=actorId)=>read(`set app.fixture_provider_transport='approved-local-only';${query}`,who,'authenticated');
  const settings=enabled(`select public.get_event_settings_workspace_provider_v3('${tournamentId}');`);assert.equal(settings.actorId,actorId);assert.equal(settings.tid,tournamentId);
  const workspace=enabled(`select public.get_operational_finance_provider_workspace_v1('${tournamentId}','${eventId}');`);assert.equal(workspace.kind,'operational-finance-provider-workspace-v1');assert.equal(workspace.actorId,actorId);assert.equal(workspace.eventId,eventId);assert.equal(workspace.compatibility.status,'same_basis');assert.equal(workspace.compatibility.editable,true);
  const recipient=enabled(`select public.get_native_playoff_finance_recipient_source_provider_v1('${tournamentId}','${eventId}');`);assert.equal(recipient.status,'source_available');assert.equal(recipient.actorId,actorId);
  const finalSource=enabled(`select public.get_native_playoff_final_award_source_provider_v1('${tournamentId}','${eventId}');`);assert.equal(finalSource.status,'source_available');assert.equal(finalSource.actorId,actorId);assert.equal(finalSource.moneyMoved,false);
  const finalRecord=enabled(`select public.get_native_playoff_final_award_record_provider_v1('${tournamentId}','${eventId}');`);assert.equal(finalRecord.status,'recorded');assert.equal(finalRecord.moneyMoved,false);assert.equal(finalRecord.finalizationAuthorized,false);
  const financeRequest=owner(`select request_payload from app.operational_event_finance_operations_v1 where actor_id='${actorId}'and tournament_id='${tournamentId}'and event_id='${eventId}'order by created_at desc limit 1;`);
  const financeReplay=enabled(`select public.save_operational_finance_proposal_provider_v1('${tournamentId}','${eventId}',${literal(financeRequest)});`);assert.equal(financeReplay.actorId,actorId);assert.equal(financeReplay.operationId,financeRequest.operationId);assert.deepEqual(financeReplay.request,financeRequest);assert.equal(financeReplay.outcome.historicalReceipt,true);
  const financeRecovery=enabled(`select public.reconcile_operational_finance_proposal_provider_v1('${tournamentId}','${eventId}','${financeRequest.operationId}');`);assert.deepEqual(financeRecovery.request,financeRequest);assert.equal(financeRecovery.outcome.historicalReceipt,true);
  const changed={...financeRequest,reason:`${financeRequest.reason} changed`};const conflict=enabled(`select public.save_operational_finance_proposal_provider_v1('${tournamentId}','${eventId}',${literal(changed)});`);assert.equal(conflict.outcome.code,'idempotency_conflict');assert.deepEqual(conflict.request,changed);
  const eventEnvelope=owner(`select request_payload from app.event_settings_save_reservations_v3 where actor_id='${actorId}'and tournament_id='${tournamentId}'order by created_at desc limit 1;`);
  const eventReplay=enabled(`select public.save_event_settings_draft_provider_v3('${tournamentId}',${literal(eventEnvelope)});`);assert.equal(eventReplay.actorId,actorId);assert.deepEqual(eventReplay.envelope,eventEnvelope);assert.ok(['event_settings_draft_saved','rejected','retry_exact'].includes(eventReplay.outcome.status));
  const eventRecovery=enabled(`select public.get_event_settings_operation_provider_v3('${tournamentId}','${eventEnvelope.setup.request.idempotencyKey}');`);assert.deepEqual(eventRecovery.envelope,eventEnvelope);assert.equal(eventRecovery.actorId,actorId);
  const nativeRequest=owner(`select o.request_payload from app.native_playoff_finance_write_operations_v1 o join app.native_playoff_finance_write_outcomes_v1 x using(actor_id,operation_id,tournament_id,event_id)where o.actor_id='${actorId}'and o.tournament_id='${tournamentId}'and o.event_id='${eventId}'and x.result->>'code'='native_playoff_final_awards_recorded_v1'limit 1;`);
  const nativeRecovery=enabled(`select public.get_native_playoff_finance_write_reconciliation_provider_v1('${tournamentId}','${eventId}','${nativeRequest.operationId}');`);assert.deepEqual(nativeRecovery.request,nativeRequest);assert.equal(nativeRecovery.actorId,actorId);assert.equal(nativeRecovery.outcome.code,'native_playoff_final_awards_recorded_v1');
  assert.equal(enabled(`select public.get_operational_finance_provider_workspace_v1('${tournamentId}','${eventId}');`,outsiderId),null);
  const after=owner(`select jsonb_build_object('financeOps',(select count(*)from app.operational_event_finance_operations_v1),'financeRevisions',(select count(*)from app.operational_event_finance_revisions_v1),'nativeOps',(select count(*)from app.native_playoff_finance_write_operations_v1),'awardSets',(select count(*)from app.native_playoff_final_award_sets_v1));`);assert.deepEqual(after,before);
  return{eventId,workspaceStatus:workspace.compatibility.status,financeReplay:financeReplay.outcome.status,nativeReconciliation:nativeRecovery.outcome.code,roleSimulationOnly:true,actualProviderVerified:false,moneyMoved:false};
 }finally{
  q(defs.transport);q(defs.proposal);q(defs.recipient);q(defs.final);
  assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.operational_provider_transport_enabled_v1()'::regprocedure));`),defs.transport);
  assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.operational_event_finance_proposals_enabled_v1()'::regprocedure));`),defs.proposal);
  assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.native_playoff_finance_recipient_source_enabled_v1()'::regprocedure));`),defs.recipient);
  assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.native_playoff_final_awards_enabled_v1()'::regprocedure));`),defs.final);
 }
}
