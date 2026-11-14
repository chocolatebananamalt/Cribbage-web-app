import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const path = 'database/proposals/native-mixed-admission-v1.sql';
const sql = await fs.readFile(path, 'utf8');
const compact = sql.replace(/\s+/g, ' ').toLowerCase();

function includesAll(values) {
  for (const value of values) assert.ok(compact.includes(value.toLowerCase()), `missing ${value}`);
}

test('native mixed admission is private, immutable, default-off groundwork', () => {
  includesAll([
    "create function app.native_mixed_admission_enabled_v1()returns boolean",
    "as $$select false$$",
    "execute format('alter table app.%i enable row level security',n)",
    "execute format('alter table app.%i force row level security',n)",
    "revoke all on table app.%i from public,anon,authenticated,service_role",
    "execute function app.reject_immutable_history()",
    "revoke all on function %s from public,anon,authenticated,service_role",
  ]);
  assert.doesNotMatch(sql, /grant\s+execute/iu);
  assert.doesNotMatch(sql, /create\s+function\s+public\./iu);
  assert.match(sql, /source_available_v2 boolean not null default false check\(not source_available_v2\)/u);
  assert.match(sql, /money_moved boolean not null default false check\(not money_moved\)/u);
  assert.match(sql, /payout_authorized boolean not null default false check\(not payout_authorized\)/u);
  assert.match(sql, /finalization_authorized boolean not null default false check\(not finalization_authorized\)/u);
});

test('intent binds current configured event and exact 6 Digital / 12 Paper scope before activity', () => {
  includesAll([
    "v->>'environment'='test-only-local-candidate'",
    "v->>'protocol'='native-mixed-6d12p-v1'",
    "v->'participantcount'='18'::jsonb",
    "v->'digitalcount'='6'::jsonb",
    "v->'papercount'='12'::jsonb",
    "v->'roundcount'='12'::jsonb",
    "v->'matchcount'='108'::jsonb",
    "from app.event_settings_operational_bindings_v1 where event_id=eid and tournament_id=tid",
    "from app.tournament_setup_activations where id=b.activation_id and tournament_id=tid and event_id=eid and setup_event_version_id=b.setup_event_version_id",
    "e.ruleset_version_id is distinct from a.ruleset_version_id",
    "assessment->>'status'is distinct from'eligible'",
    "b.context->'sanctioned'is distinct from'false'::jsonb",
    "p.status not in('registered','checked_in')",
    "name like'test only%'for update nowait",
    "exists(select 1 from app.initial_seating_publications where tournament_id=tid)",
    "exists(select 1 from app.event_schedule_publications where tournament_id=tid)",
    "exists(select 1 from app.event_play_starts where tournament_id=tid)",
    "app.native_mixed_admission_score_history_empty_v1(tid,eid)is distinct from true",
    "app.native_mixed_admission_finance_idle_v1(tid,eid)is distinct from true",
  ]);
  assert.ok(compact.indexOf('app.native_mixed_admission_base_source_v1(tid,eid)') >= 0);
  assert.doesNotMatch(sql, /event_settings_playoff_source_v1\s*\(/u);
  assert.match(sql, /head\.binding_capture is distinct from source->'binding'/u);
  assert.match(sql, /head\.activation_capture is distinct from source->'activation'/u);
  assert.match(sql, /head\.event_capture is distinct from source->'event'/u);
  assert.match(sql, /head\.setup_event_capture is distinct from source->'setupEvent'/u);
  assert.match(sql, /head\.base_source_capture is distinct from source/u);
  assert.match(sql, /'participantStatus',case when include_fixed_ids then p\.status else null end/u);
  assert.doesNotMatch(sql, /x->>'mode'='digital'and x->>'participantStatus'='checked_in'/u);
  assert.match(sql, /head\.roster_capture is distinct from source->'roster'/u);
  assert.match(sql, /head\.scope_capture is distinct from request->'scope'/u);
});

test('intent and seal requests cannot pin future draw, publication, schedule, Start, or game IDs', () => {
  const intentStart = sql.indexOf('create function app.native_mixed_admission_intent_request_valid_v1');
  const sealStart = sql.indexOf('create function app.native_mixed_admission_seal_request_valid_v1');
  const intentBody = sql.slice(intentStart, sealStart);
  const sealBody = sql.slice(sealStart, sql.indexOf('create function app.native_mixed_admission_roster_v1'));
  const intentKeys = "'expectedOperationalBindingId','expectedPriorIntentId','expectedVersion','kind','nonce','operationId','reason','scope'";
  const sealKeys = "'expectedIntentId','expectedIntentNonce','expectedIntentVersion','kind','operationId','reason'";
  assert.ok(intentBody.replace(/\s+/g, '').includes(`array[${intentKeys}]`));
  assert.ok(sealBody.replace(/\s+/g, '').includes(`array[${sealKeys}]`));
  for (const forbidden of ['drawId', 'planId', 'publicationId', 'schedulePublicationId', 'eventPlayStartId', 'gameId']) {
    assert.ok(!intentBody.slice(0, intentBody.indexOf('$$;')).includes(forbidden), `intent pins future ${forbidden}`);
    assert.ok(!sealBody.slice(0, sealBody.indexOf('$$;')).includes(forbidden), `seal pins future ${forbidden}`);
  }
});

test('seal derives reviewed draw, fixed IDs, 108 pending games, and official Start before scoring', () => {
  includesAll([
    "from app.reviewed_initial_seating_publications_v1 where tournament_id=tid",
    "app.reviewed_initial_seating_bound_v1(reviewed.actor_id,reviewed.operation_id)",
    "reviewed.request#>>'{reviewedcandidate,algorithmversion}'<>'local-circle-18-v1'",
    "jsonb_array_length(reviewed.request#>'{reviewedcandidate,matches}')<>108",
    "publication.table_count<>1 or publication.seats_per_table<>18",
    "schedule.game_count<>12 or schedule.participant_count<>18 or schedule.match_count<>108",
    "play.start_source<>'official'",
    "play.participant_snapshot_digest<>app.event_participant_snapshot_digest_v1(eid)",
    "x->>'participantstatus'is distinct from'checked_in'",
    "select count(*)from app.canonical_games where tournament_id=tid and event_id=eid)<>108",
    "state<>'pending'or version<>1 or winner_side is not null or margin is not null",
    "exists(select 1 from app.score_confirmations where tournament_id=tid and event_id=eid)",
    "exists(select 1 from app.paper_game_completions where tournament_id=tid and event_id=eid)",
    "exists(select 1 from app.qualification_result_versions where tournament_id=tid and event_id=eid)",
    "'sourceavailablev2',false",
  ]);
  assert.match(sql, /a\.roster_entry_id=\(m#>>'\{sides,0,participantId\}'\)::uuid/u);
  assert.match(sql, /b\.roster_entry_id=\(m#>>'\{sides,1,participantId\}'\)::uuid/u);
  for (const table of [
    'game_corrections', 'independent_card_corrections', 'operational_game_forfeits',
    'event_disputes', 'event_game_standings_eligibility_versions',
    'event_excluded_extra_game_records', 'event_schedule_amendment_versions',
  ]) assert.ok(compact.includes(`not exists(select 1 from app.${table} where tournament_id=tid and event_id=eid)`), `missing ${table} prescoring guard`);
});

test('seal accepts only the exact existing synthetic finance scope and fully provenanced paid rows', () => {
  includesAll([
    "perform app.assert_synthetic_mixed_finance_current_v1(tid,eid)",
    "perform app.assert_synthetic_mixed_current_v1(tid,eid)",
    "from app.synthetic_mixed_finance_scopes_v1 where tournament_id=tid and event_id=eid",
    "from app.synthetic_mixed_finance_bindings_v1 where tournament_id=tid and event_id=eid",
    "select count(*)from app.roster_payment_events where tournament_id=tid)<>18",
    "select count(distinct roster_entry_id)from app.roster_payment_events where tournament_id=tid and event_type='received')<>18",
    "app.native_mixed_admission_financial_row_provenanced_v1",
    "p.actual_money_received=false and p.money_moved=false",
    "p.fictional_paper_play_claimed=false and p.independent_human_play_certified=false",
    "financial_liability_refund_or_collision",
    "untagged_or_out_of_phase_financial_record",
    "event_side_pool_team_election_versions",
    "'financialscope',finance",
  ]);
  assert.match(sql, /app\.legacy_financial_liability_exists_v1\(tid,eid\)is distinct from false/u);
  assert.match(sql, /exists\(select 1 from app\.late_player_refund_decisions/u);
  assert.match(sql, /exists\(select 1 from app\.native_optional_final_award_sets_v2/u);
  assert.match(sql, /exists\(select 1 from app\.native_unrestricted_income_sources_v1/u);
  assert.match(sql, /KNOWN FAIL-CLOSED PRODUCER GAP/u);
  assert.match(sql, /positive native-configured seal remains unavailable/u);
  assert.doesNotMatch(sql, /insert\s+into\s+app\.event_prize_schedule_bindings_v1/iu);
  assert.doesNotMatch(sql, /save_setup_prize_schedule_v1\s*\(/iu);
  assert.doesNotMatch(sql, /event_settings_playoff_source_v1\s*\(/iu);
  includesAll([
    'app.native_optional_pool_ownership_revisions_v2,app.native_optional_pool_ownership_outcomes_v2',
    'app.native_optional_finance_revisions_v2,app.native_optional_finance_outcomes_v2',
    'app.native_optional_fund_operations_v2,app.native_optional_fund_reviews_v2,app.native_optional_fund_outcomes_v2',
    'app.native_unrestricted_income_sources_v1,app.native_unrestricted_income_records_v1',
  ]);
});

test('replay, nonce, correction, and current-role safeguards are explicit', () => {
  includesAll([
    "unique(tournament_id,event_id,nonce)",
    "check((version=1 and prior_intent_id is null)or(version>1 and prior_intent_id is not null))",
    "pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))",
    "pg_try_advisory_xact_lock(hashtextextended('native-mixed-admission-v1:'||tid::text||':'||eid::text,0))",
    "profile_id=actor and role='director'for key share nowait",
    "oldop.request_payload is distinct from request",
    "historicalreceipt',true,'currentsourceverified',false",
  ]);
  const intent = compact.indexOf('create function app.save_native_mixed_admission_intent_v1');
  const seal = compact.indexOf('create function app.seal_native_mixed_admission_v1');
  for (const start of [intent, seal]) {
    const body = compact.slice(start, compact.indexOf('end$$;', start) + 6);
    assert.ok(body.indexOf("role='director'for key share nowait") < body.indexOf('select*into oldop'), 'current role must precede replay');
  }
  assert.match(sql, /native_mixed_admission_intent_request_valid_v1\(request\)is distinct from true/u);
  assert.match(sql, /native_mixed_admission_seal_request_valid_v1\(request\)is distinct from true/u);
  assert.match(sql, /reviewed_initial_seating_bound_v1\(reviewed\.actor_id,reviewed\.operation_id\)is distinct from true/u);
  const sourceLocks = compact.slice(compact.indexOf('create function app.lock_native_mixed_admission_sources_v1'), compact.indexOf('create function app.native_mixed_admission_operation_reserved_v1'));
  assert.ok(sourceLocks.indexOf('perform app.lock_native_ledger_sources_v1()') < sourceLocks.indexOf('perform app.lock_event_settings_playoff_sources_v1()'), 'native ledger lock must precede event settings lock');
});
