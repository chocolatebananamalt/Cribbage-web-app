// Synthetic local PostgreSQL acceptance for current private setup/Finance candidates.
// Direct ledger foundation rows are fixture evidence only; no provider/payment exists.
import assert from 'node:assert/strict';
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const id = n => `a2960000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export async function verifyCurrentEventSettingsFinance({q, read, withHeldLock, actorId, outsiderId, tournamentId, nextOperationId, settingsResult}) {
  const owner = (sql, who = actorId) => read(sql, who, 'ownerAuthenticated');
  const service = sql => owner(`set request.jwt.claim.role='service_role';set request.jwt.claim.sub='${actorId}';set request.jwt.claims='{"role":"service_role","sub":"${actorId}"}';${sql}`);
  const source = owner(`select app.get_event_settings_activation_source_v4('${tournamentId}');`);
  assert.equal(source.status, 'source_available');
  assert.equal(source.configuredRows.length, 1);
  const configured = source.configuredRows[0];
  const activationOperationId = nextOperationId();
  const emptyEnvelope = {
    kind: 'event-settings-activation-intent-v1',
    request: {setupRevisionId: source.setupRevisionId, expectedVersion: source.setupVersion, confirmed: true, idempotencyKey: activationOperationId},
    associationHash: source.associationHash,
    settingsSnapshotId: source.settingsSnapshotId,
    settingsDigest: source.settingsDigest,
    settingsPins: [],
    confirmedContext: true,
  };

  // Product source is hard-false. This must precede any fixture-only override.
  const defaultDenied = service(`select app.finalize_event_settings_operational_activation_v1('${actorId}','${tournamentId}',${literal(emptyEnvelope)});`);
  assert.deepEqual(defaultDenied, {status: 'unavailable', code: 'activation_runtime_acceptance_required', operationAttempted: false, operationalActivationPerformed: false});
  assert.deepEqual(owner(`select jsonb_build_object('attempts',(select count(*)from app.event_settings_operational_attempts_v1 where tournament_id='${tournamentId}'),'outcomes',(select count(*)from app.event_settings_operational_outcomes_v1 where tournament_id='${tournamentId}'),'bindings',(select count(*)from app.event_settings_operational_bindings_v1 where tournament_id='${tournamentId}'));`), {attempts: 0, outcomes: 0, bindings: 0});
  assert.equal(service(`select app.reconcile_event_settings_operational_activation_v1('${actorId}','${tournamentId}',${literal(emptyEnvelope)});`), null);

  const contextRequest = {
    kind: 'event-rule-context-v1', operationId: nextOperationId(), expectedReviewId: null,
    setupRevisionId: source.setupRevisionId, settingsSnapshotId: source.settingsSnapshotId,
    eventClientRowId: configured.eventClientRowId,
    context: {sanctioned: true, eventKind: configured.eventKind, durationDays: 2, originalEntrants: null},
    reason: 'Synthetic local context review', approvalReference: 'LOCAL TEST EVIDENCE ONLY', confirmed: true,
  };
  const contextSaved = owner(`select app.save_event_rule_context_v1('${tournamentId}',${literal(contextRequest)});`);
  assert.equal(contextSaved.status, 'context_recorded');
  assert.deepEqual(owner(`select app.save_event_rule_context_v1('${tournamentId}',${literal(contextRequest)});`), {...contextSaved, historicalReceipt: true});
  const envelope = structuredClone(emptyEnvelope);
  envelope.settingsPins = [{eventClientRowId: configured.eventClientRowId, reviewId: contextSaved.reviewId, draftDigest: contextSaved.source.draftDigest}];
  const prepared = owner(`select app.prepare_event_settings_activation_v1('${tournamentId}',${literal(envelope)});`);
  assert.equal(prepared.status, 'activation_intent_prepared');
  assert.equal(prepared.operationalActivationPerformed, false);
  assert.equal(prepared.moneyMoved, false);
  assert.equal(service(`select app.finalize_event_settings_operational_activation_v1('${actorId}','${tournamentId}',${literal(envelope)});`).code, 'activation_runtime_acceptance_required');

  const originalGate = owner(`select to_jsonb(pg_get_functiondef('app.event_settings_operational_activation_enabled_v1()'::regprocedure));`);
  assert.match(originalGate, /select false/);
  let activation;
  try {
    // Disposable-DB-only instrumentation. Every source/role/context/finance/playoff
    // gate remains unchanged; the helper additionally requires an explicit local GUC.
    q(`create or replace function app.event_settings_operational_activation_enabled_v1()returns boolean language sql stable set search_path=''as $$select coalesce(current_setting('app.fixture_event_settings_operational_acceptance',true)='approved-local-only',false)$$;alter function app.event_settings_operational_activation_enabled_v1()owner to postgres;revoke all on function app.event_settings_operational_activation_enabled_v1()from public,anon,authenticated,service_role;`);
    assert.equal(service(`select to_jsonb(app.event_settings_operational_activation_enabled_v1());`), false);
    activation = service(`set app.fixture_event_settings_operational_acceptance='approved-local-only';select app.finalize_event_settings_operational_activation_v1('${actorId}','${tournamentId}',${literal(envelope)});`);
    assert.equal(activation.status, 'event_settings_operationally_activated');
    assert.equal(activation.operationalActivationPerformed, true);
    assert.equal(activation.activationCount, 1);
    assert.equal(activation.bindingCount, 1);
    assert.deepEqual(service(`set app.fixture_event_settings_operational_acceptance='approved-local-only';select app.finalize_event_settings_operational_activation_v1('${actorId}','${tournamentId}',${literal(envelope)});`), activation);
    assert.deepEqual(service(`select app.reconcile_event_settings_operational_activation_v1('${actorId}','${tournamentId}',${literal(envelope)});`), activation);
  } finally {
    q(originalGate);
    assert.equal(owner(`select to_jsonb(app.event_settings_operational_activation_enabled_v1());`), false);
    assert.equal(owner(`select to_jsonb(pg_get_functiondef('app.event_settings_operational_activation_enabled_v1()'::regprocedure));`), originalGate);
  }

  const binding = owner(`select jsonb_build_object('bindingId',b.id,'eventId',b.event_id,'setupEventVersionId',b.setup_event_version_id,'activationId',b.activation_id)from app.event_settings_operational_bindings_v1 b where b.tournament_id='${tournamentId}';`);
  assert.equal(binding.setupEventVersionId, settingsResult.setupEventVersionId);
  assert.notEqual(binding.eventId, binding.setupEventVersionId);

  // The legacy draft source is explicitly setup-event-version scoped. An
  // operational event UUID is not silently reinterpreted as that identity.
  const financeCount = owner(`select to_jsonb(count(*))from app.event_regular_finance_revisions_v1 where tournament_id='${tournamentId}';`);
  const wrongLegacyBase = owner(`select app.get_event_regular_finance_base_v1('${tournamentId}','${binding.eventId}');`);
  assert.notEqual(wrongLegacyBase?.status, 'source_available');
  assert.equal(owner(`select to_jsonb(count(*))from app.event_regular_finance_revisions_v1 where tournament_id='${tournamentId}';`), financeCount);

  // Prove every configured-event authoritative Finance path is stopped before
  // table constraints can turn the probe into a business row.
  const financeTargets = [
    'standard_singles_settlement_drafts','standard_singles_settlement_final_versions','event_settlement_drafts_v5','event_settlement_finals_v2',
    'q_accounting_drafts_v6','q_accounting_finals_v6','no_q_accounting_drafts_v7','no_q_accounting_finals_v7',
    'prize_accounting_drafts_v8','prize_accounting_finals_v8','prize_accounting_drafts_v9','prize_accounting_finals_v9',
    'multi_event_unpaid_drafts_v1','multi_event_unpaid_finals_v1','multi_event_joint_finals_v1',
  ];
  assert.equal(owner(`select to_jsonb(app.event_settings_finance_guard_available_v1());`), true);
  for (const table of financeTargets) {
    const columns = table === 'multi_event_joint_finals_v1' ? '(tournament_id)' : '(tournament_id,event_id)';
    const values = table === 'multi_event_joint_finals_v1' ? `('${tournamentId}')` : `('${tournamentId}','${binding.eventId}')`;
    assert.throws(() => q(`insert into app.${table}${columns}values${values};`), /event_settings_finance_integration_required/);
  }

  // Registration/roster/participant prerequisites are directly seeded synthetic
  // data. Payment and expense evidence below uses the supported local RPCs;
  // none of these records represents real-world money or provider authentication.
  const linkId=id(10), claimId=id(11), decisionId=id(12), rosterId=id(13), participantId=id(14);
  const rosterReceipt=id(15), paymentOperation=id(16), expenseOperation=id(17);
  q(`
    insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values
      ('${rosterReceipt}','${tournamentId}','${actorId}','fixture_roster','${rosterId}',repeat('a',64),'${id(101)}','accepted','{}',clock_timestamp());
    insert into app.tournament_registration_links(id,tournament_id,token_hash,created_by_profile_id,enabled)values('${linkId}','${tournamentId}',repeat('d',64),'${actorId}',false);
    insert into app.registration_claims(id,tournament_id,registration_link_id,display_name,normalized_name,email,normalized_email,intended_payment_method,status,client_operation_id,request_fingerprint)
      values('${claimId}','${tournamentId}','${linkId}','Synthetic Player','synthetic player','player@test.invalid','player@test.invalid','cash','accepted','${id(104)}',repeat('e',64));
    insert into app.registration_claim_decisions(id,tournament_id,claim_id,decision,actor_profile_id,operation_receipt_id)
      values('${decisionId}','${tournamentId}','${claimId}','approved_for_roster','${actorId}','${rosterReceipt}');
    insert into app.tournament_roster_entries(id,tournament_id,source_claim_id,approval_decision_id,claimed_display_name,claimed_normalized_name,claimed_email,claimed_normalized_email,creator_profile_id,operation_receipt_id)
      values('${rosterId}','${tournamentId}','${claimId}','${decisionId}','Synthetic Player','synthetic player','player@test.invalid','player@test.invalid','${actorId}','${rosterReceipt}');
    insert into app.event_participants(id,tournament_id,event_id,profile_id,status,roster_entry_id)
      values('${participantId}','${tournamentId}','${binding.eventId}','${outsiderId}','registered','${rosterId}');
  `);
  const entryFeeMinor = owner(`select to_jsonb(v.entry_fee_cents)from app.tournament_setup_activations a join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id where a.id='${binding.activationId}';`);
  const paymentAck = owner(`select public.record_manual_roster_payment('${tournamentId}','${rosterId}',0,${entryFeeMinor},'USD','cash',clock_timestamp()-interval '1 second','Synthetic local receipt','${paymentOperation}');`);
  assert.equal(paymentAck.status, 'payment_recorded');
  const expenseAck = owner(`select public.record_tournament_expense('${tournamentId}',500,'USD','Synthetic local operating expense','${expenseOperation}');`);
  assert.equal(expenseAck.status, 'expense_recorded');
  const nativeSource = owner(`select app.get_native_event_ledger_sources_v1('${tournamentId}');`);
  assert.equal(nativeSource.status, 'sources_available');
  assert.equal(nativeSource.facts.receiptEvents.length, 1);
  assert.equal(nativeSource.facts.expenseEvents.length, 1);
  const eventId = binding.eventId;
  const sourceRows = [...nativeSource.facts.receiptEvents.map(row => ({sourceId: row.sourceId, allocations: [{eventId, bucket: 'regular_entry', poolId: null, amountMinor: row.amountMinor, classificationReviewed: true}]})),
    ...nativeSource.facts.expenseEvents.map(row => ({sourceId: row.sourceId, allocations: [{eventId, bucket: 'operating_expense', poolId: null, amountMinor: row.amountMinor, classificationReviewed: true}]}))];
  const nativeRequest = {operationId: nextOperationId(), expectedRevisionId: null, sourceDigest: nativeSource.sourceDigest, allocations: sourceRows, reason: 'Synthetic local allocation review', reviewed: true, kind: 'native-ledger-allocation-v1'};
  const nativeSaved = owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(nativeRequest)});`);
  assert.equal(nativeSaved.status, 'accepted');
  assert.equal(nativeSaved.moneyMoved, false); assert.equal(nativeSaved.payoutAuthorized, false);
  assert.deepEqual(owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(nativeRequest)});`), {...nativeSaved, replayed: true, historicalReceipt: true, fundAvailable: false});
  assert.deepEqual(owner(`select app.get_native_ledger_allocation_operation_v1('${tournamentId}','${nativeRequest.operationId}');`), {...nativeSaved, historicalReceipt: true, fundAvailable: false});
  assert.equal(owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal({...nativeRequest, reason:'changed'})});`).code, 'operation_conflict');

  const wrongDomainRequest = structuredClone(nativeRequest);
  wrongDomainRequest.operationId = nextOperationId(); wrongDomainRequest.expectedRevisionId = nativeSaved.revisionId;
  wrongDomainRequest.allocations[0].allocations[0].eventId = settingsResult.setupEventVersionId;
  assert.equal(owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(wrongDomainRequest)});`).code, 'foreign_event');

  const busyRequest = {...nativeRequest, operationId: nextOperationId(), expectedRevisionId: nativeSaved.revisionId};
  await withHeldLock(`begin;lock table app.roster_payment_events in access exclusive mode;select 'LOCK_HELD';`, () => {
    assert.deepEqual(owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(busyRequest)});`), {status:'retry_exact',code:'source_busy'});
    assert.equal(owner(`select app.get_native_ledger_allocation_operation_v1('${tournamentId}','${busyRequest.operationId}');`).status, 'unknown');
    assert.equal(owner(`select to_jsonb(count(*))from app.native_ledger_allocation_operations_v1 where actor_id='${actorId}'and operation_id='${busyRequest.operationId}';`), 0);
  });
  const afterBusy = owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(busyRequest)});`);
  assert.equal(afterBusy.status, 'accepted');

  const recoveryRequest = {...nativeRequest, operationId: nextOperationId(), expectedRevisionId: afterBusy.revisionId};
  q(`create function app.fixture_native_outcome_failure()returns trigger language plpgsql as $$begin raise exception'fixture native outcome failure';end$$;create trigger fixture_native_outcome_failure before insert on app.native_ledger_allocation_outcomes_v1 for each row execute function app.fixture_native_outcome_failure();`);
  try { assert.throws(() => owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(recoveryRequest)});`), /fixture native outcome failure/); }
  finally { q('drop trigger fixture_native_outcome_failure on app.native_ledger_allocation_outcomes_v1;drop function app.fixture_native_outcome_failure();'); }
  assert.equal(owner(`select app.get_native_ledger_allocation_operation_v1('${tournamentId}','${recoveryRequest.operationId}');`).status, 'unknown');
  const recovered = owner(`select app.save_native_ledger_allocation_v1('${tournamentId}',${literal(recoveryRequest)});`);
  assert.equal(recovered.status, 'accepted');

  // Actual database ACL/RLS, including service_role: all candidates stay private.
  const acl = owner(`select jsonb_build_object(
   'badTables',(select count(*)from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join unnest(array['anon','authenticated','service_role'])r where n.nspname='app'and(c.relname like'event_settings_%_v1'or c.relname like'event_rule_%_v1'or c.relname like'native_ledger_%_v1')and c.relkind='r'and(not c.relrowsecurity or has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))),
   'badFunctions',(select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['anon','authenticated','service_role'])r where n.nspname='app'and(p.proname like'event_settings_%_v1'or p.proname like'event_rule_%_v1'or p.proname like'native_ledger_%_v1'or p.proname like'%native_ledger%')and has_function_privilege(r,p.oid,'EXECUTE')),
   'notForced',(select coalesce(jsonb_agg(c.relname order by c.relname),'[]')from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app'and(c.relname like'event_settings_%_v1'or c.relname like'event_rule_%_v1'or c.relname like'native_ledger_%_v1')and c.relkind='r'and c.relrowsecurity and not c.relforcerowsecurity));`);
  assert.equal(acl.badTables, 0); assert.equal(acl.badFunctions, 0);
  assert.deepEqual(acl.notForced, ['native_ledger_allocation_operations_v1','native_ledger_allocation_outcomes_v1','native_ledger_allocation_revisions_v1']);
  const privateTables = ['event_regular_finance_outcomes_v1','event_regular_finance_reservations_v1','event_regular_finance_revisions_v1','event_rule_context_operations_v1','event_rule_context_reviews_v1','event_settings_activation_intents_v1','event_settings_operational_attempts_v1','event_settings_operational_bindings_v1','event_settings_operational_outcomes_v1','event_settings_playoff_operations_v1','event_settings_playoff_reviews_v1','event_settings_playoff_starts_v1','event_settings_save_outcomes_v3','event_settings_save_reservations_v3','event_settings_snapshots_v3','native_ledger_allocation_operations_v1','native_ledger_allocation_outcomes_v1','native_ledger_allocation_revisions_v1','setup_custom_payout_batches_v2','setup_custom_payout_intents_v2','setup_custom_q_save_outcomes_v2','setup_custom_q_save_reservations_v2'];
  const privateCalls = [`app.get_native_event_ledger_sources_v1('${tournamentId}')`,`app.save_native_ledger_allocation_v1('${tournamentId}','{}'::jsonb)`,`app.get_native_ledger_allocation_v1('${tournamentId}')`,`app.get_native_ledger_allocation_operation_v1('${tournamentId}','${nativeRequest.operationId}')`,`app.get_event_settings_activation_source_v4('${tournamentId}')`,`app.finalize_event_settings_operational_activation_v1('${actorId}','${tournamentId}','{}'::jsonb)`];
  for (const role of ['anon','authenticated','service_role']) {
    for (const table of privateTables) {
      assert.throws(() => q(`select*from app.${table} limit 0;`, actorId, role), /permission denied/);
      assert.throws(() => q(`insert into app.${table} default values;`, actorId, role), /permission denied/);
      assert.throws(() => q(`delete from app.${table} where false;`, actorId, role), /permission denied/);
      assert.throws(() => q(`truncate table app.${table};`, actorId, role), /permission denied/);
    }
    for (const call of privateCalls) assert.throws(() => q(`select ${call};`, actorId, role), /permission denied/);
  }

  return {
    defaultHardFalseProved: true, fixtureOnlyGateOverrideRestoredExactly: true,
    operationalActivation: true, activationCount: activation.activationCount, bindingCount: activation.bindingCount,
    financeBackstopTargets: financeTargets.length, nativeAllocationAccepted: true,
    nativeReplayReconcile: true, nativeBusyRetry: true, nativeRollbackRecovery: true,
    actualAclRls: true, directSetRoleDenials: {roles:3,tables:privateTables.length,functions:privateCalls.length}, nonForcedOwnerTables: acl.notForced, setupVersionOperationalEventIdentitySeparated: true,
    bridgeStatus: 'blocked_missing_reviewed_setup_version_to_operational_event_save_and_payout_bridge',
    moneyMoved: false, payoutAuthorized: false, hostedWrites: false,
    limitations: ['private owner-candidate evidence, not release clearance','Supabase/provider role attributes and table installer ownership not verified','three native allocation tables enable but do not FORCE RLS, so installer-owner bypass remains','ledger registration/roster/participant foundations were directly seeded synthetic prerequisites','no provider/bank/payment processor','private allocation is not payout/disbursement','operational capability remains hard-false after exact restoration'],
  };
}
