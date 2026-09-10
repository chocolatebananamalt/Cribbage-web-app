import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const migrationPath = path.join(process.cwd(), 'database', 'migrations', '0001_vertical_slice_core.sql');
const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();
const tables = ['profiles', 'tournaments', 'tournament_roles', 'ruleset_versions', 'events', 'rounds', 'event_participants', 'canonical_games', 'card_scorelines', 'score_submissions', 'score_confirmations', 'operation_receipts', 'audit_events'];

test('local schema is private, UUID-backed, RLS-forced, and non-destructive', () => {
  assert.match(sql, /create schema if not exists app/);
  assert.match(sql, /references auth\.users\(id\) on delete restrict/);
  for (const table of tables) {
    assert.match(sql, new RegExp(`create table app\\.${table}\\s*\\(`), `${table} exists in private app schema`);
  }
  assert.match(sql, /enable row level security/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /revoke all on table app\.%i from anon, authenticated/);
  assert.doesNotMatch(sql, /on delete cascade/, 'history and core records have no destructive cascades');
  assert.doesNotMatch(sql, /create policy[\s\S]*using \(true\)/, 'no broad allow-all policy');
});

test('independent Rule 12 correction projections preserve both card claims without granting access', () => {
  const projectionSql = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0099_independent_card_correction_projection_foundation.sql'), 'utf8').toLowerCase();
  assert.match(projectionSql, /create table app\.independent_card_corrections/);
  assert.match(projectionSql, /rule_case text not null check \(rule_case in \('12\.2a', '12\.2b', '12\.2c', '12\.2d', '12\.2e', '12\.2f', '12\.2g', '12\.2h', '12\.2i'\)\)/);
  assert.match(projectionSql, /create table app\.independent_card_correction_projections/);
  assert.match(projectionSql, /original_is_winner boolean not null/);
  assert.match(projectionSql, /adjudicated_is_winner boolean not null/);
  assert.match(projectionSql, /unique \(correction_id, card_side\)/);
  assert.match(projectionSql, /references app\.card_scorelines\(id, canonical_game_id\)/);
  assert.match(projectionSql, /enable row level security/);
  assert.match(projectionSql, /force row level security/);
  assert.match(projectionSql, /revoke all on table app\.independent_card_corrections, app\.independent_card_correction_projections from public, anon, authenticated/);
  assert.doesNotMatch(projectionSql, /^grant\s+/im);
});

test('independent Rule 12 correction foundation rejects mismatched cards, inconsistent claims, and incomplete pairs', () => {
  const invariantSql = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0100_independent_card_correction_projection_invariants.sql'), 'utf8').toLowerCase();
  assert.match(invariantSql, /for update/);
  assert.match(invariantSql, /correction base game version is stale/);
  assert.match(invariantSql, /correction sequence must be next for game/);
  assert.match(invariantSql, /correction card side must match original scoreline/);
  assert.match(invariantSql, /correction adjudicated score is internally inconsistent/);
  assert.match(invariantSql, /correction requires exactly two independent card projections/);
  assert.match(invariantSql, /if tg_table_name = 'independent_card_corrections' then/);
  assert.match(invariantSql, /deferrable initially deferred/);
  assert.match(invariantSql, /revoke all on function app\.assert_independent_card_correction_sequence\(\) from public, anon, authenticated/);
  assert.doesNotMatch(invariantSql, /^grant\s+/im);

  const repairSql = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0101_independent_card_correction_claim_preservation_repair.sql'), 'utf8').toLowerCase();
  assert.match(repairSql, /rename column original_scoreline_id to canonical_scoreline_id/);
  assert.match(repairSql, /correction card side must match canonical scoreline/);
  assert.match(repairSql, /correction original claim is internally inconsistent/);
  assert.match(repairSql, /correction adjudicated score is internally inconsistent/);
  assert.doesNotMatch(repairSql, /original snapshot does not match/);

  const triggerRepairSql = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0102_independent_card_correction_trigger_context_repair.sql'), 'utf8').toLowerCase();
  assert.match(triggerRepairSql, /if tg_table_name = 'independent_card_corrections' then/);
  assert.match(triggerRepairSql, /v_correction_id := new\.id/);
  assert.match(triggerRepairSql, /v_correction_id := new\.correction_id/);
});

test('assigned-game retry context is actor-scoped without widening table access', () => {
  const actorScopeSql = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0103_assigned_game_context_actor_scoped_retry.sql'), 'utf8').toLowerCase();
  assert.match(actorScopeSql, /'actorid', auth\.uid\(\)/);
  assert.match(actorScopeSql, /security definer/);
  assert.match(actorScopeSql, /set search_path = ''/);
  assert.match(actorScopeSql, /revoke all on function public\.get_assigned_game_context\(uuid\) from public, anon/);
  assert.match(actorScopeSql, /grant execute on function public\.get_assigned_game_context\(uuid\) to authenticated/);
  assert.doesNotMatch(actorScopeSql, /grant (select|insert|update|delete|all) on table/i);
});

test('game scope, assignments, immutable submissions, and exact verification boundaries are explicit', () => {
  assert.match(sql, /foreign key \(round_id, tournament_id, event_id\) references app\.rounds/);
  assert.match(sql, /foreign key \(side_a_participant_id, event_id, tournament_id\) references app\.event_participants/);
  assert.match(sql, /foreign key \(side_b_participant_id, event_id, tournament_id\) references app\.event_participants/);
  assert.match(sql, /check \(side_a_participant_id <> side_b_participant_id\)/);
  assert.match(sql, /unique \(event_id, round_id, match_instance, side_low_participant_id, side_high_participant_id\)/);
  assert.match(sql, /submission_slot smallint not null check \(submission_slot in \(1, 2\)\)/);
  assert.match(sql, /unique \(canonical_game_id, submission_slot\)/);
  assert.match(sql, /unique \(canonical_game_id, submitter_profile_id\)/);
  assert.match(sql, /winner_side text not null/);
  assert.match(sql, /margin integer not null check \(margin between 1 and 121\)/);
  assert.match(sql, /score_submissions_immutable/);
  assert.match(sql, /unique \(canonical_game_id, confirmation_actor_id\)/);
  assert.match(sql, /foreign key \(submission_id, canonical_game_id, submission_actor_id\) references app\.score_submissions/);
  assert.doesNotMatch(sql, /confirmation_actor_id <> submission_actor_id/, 'self-confirmation remains allowed');
  assert.match(sql, /state text not null default 'pending' check \(state in \('pending', 'submitted', 'mismatch', 'confirmation_pending', 'verified', 'corrected'\)\)/);
  assert.match(sql, /pending game cannot have canonical scorelines/);
  assert.match(sql, /game requires exactly two submissions/);
  assert.match(sql, /game requires two confirmations/);
  assert.match(sql, /verified game requires exactly two scorelines/);
  assert.match(sql, /canonical winner and margin must equal matching submissions/);
  assert.match(sql, /table_seat_snapshot text not null/);
  assert.match(sql, /only verified or corrected games can have canonical scorelines/);
  assert.match(sql, /confirmations must bind two distinct submissions/);
  assert.match(sql, /submission slots must map to assigned game sides/);
  assert.match(sql, /reciprocal plus-minus and game points are invalid/);
  assert.match(sql, /score_confirmations_immutable/);
  assert.match(sql, /audit_events_immutable/);
  assert.match(sql, /ruleset_versions_immutable/);
});

test('scoring, idempotency, and format boundaries are explicit', () => {
  assert.match(sql, /game_points smallint not null check \(game_points in \(0, 2, 3\)\)/);
  assert.doesNotMatch(sql, /total_points|net_points|derived_total/);
  assert.doesNotMatch(sql, /unique \(actor_profile_id, operation_type, target_id, request_hash\)/, 'request hash is compared by future RPC, not a uniqueness key');
  assert.match(sql, /unique \(actor_profile_id, client_operation_id\)/);
  assert.match(sql, /response_payload jsonb/);
  assert.match(sql, /foreign key \(operation_receipt_id, tournament_id\) references app\.operation_receipts/);
  assert.match(sql, /foreign key \(canonical_game_id, tournament_id\) references app\.canonical_games/);
  assert.match(sql, /confirmations require two submissions and an eligible game state/);
  assert.match(sql, /confirmations require matching submission winner and margin/);
  assert.match(sql, /opponent_participant_id = g\.side_b_participant_id/);
  assert.match(sql, /is_winner and side <> g\.winner_side/);
  assert.match(sql, /scoring_method = 'digital' and format = 'standard_singles'/);
  assert.match(sql, /scoring_method in \('manual', 'imported'\)/);
  assert.match(sql, /digital_event_requires_approved_ruleset/);
});

test('deferred constraint functions are security-definer safe for RPC mutations', () => {
  for (const name of ['revalidate_game', 'revalidate_game_from_scoreline', 'revalidate_game_from_submission', 'revalidate_game_from_confirmation', 'assert_two_submissions_before_verified', 'assert_digital_event_ruleset']) {
    const functionStart = sql.indexOf(`function app.${name}`);
    assert.notEqual(functionStart, -1, `${name} exists`);
    const functionBody = sql.slice(functionStart, functionStart + 500);
    assert.match(functionBody, /security definer/);
    assert.match(functionBody, /set search_path = ''/);
  }
  assert.match(sql, /revoke all on function app\.revalidate_game\(uuid\) from public, anon, authenticated/);
});

test('advisor baseline covers listed private-schema foreign keys without opening access', () => {
  const baseline = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0005_pilot_index_and_advisor_baseline.sql'), 'utf8').toLowerCase();
  for (const indexName of [
    'audit_events_actor_profile_id_idx',
    'audit_events_canonical_game_scope_idx',
    'audit_events_operation_receipt_scope_idx',
    'event_participants_event_scope_idx',
    'operation_conflicts_prior_receipt_id_idx',
    'score_confirmations_confirmation_actor_id_idx',
    'score_submissions_submitter_scope_idx',
    'score_submissions_submitter_profile_id_idx',
    'tournaments_director_profile_id_idx',
  ]) assert.match(baseline, new RegExp(`create index if not exists ${indexName}`));
  assert.match(baseline, /policy-free/);
  assert.match(baseline, /security-definer rpc/);
  assert.match(baseline, /magic-link\/otp only/);
  assert.match(baseline, /hosted email provider combines[\s\S]*password-only switch/);
  assert.match(baseline, /password authentication remains unsupported by the application/);
  assert.doesNotMatch(baseline, /grant select on table|create policy/);
});

test('every foreign-key prefix reported by the pilot advisor has a durable local coverage repair', () => {
  const repair = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0089_foreign_key_coverage.sql'), 'utf8');
  for (const prefix of [
    'initial_seating_assignments(publication_id, tournament_id)',
    'initial_seating_assignments(roster_entry_id, tournament_id)',
    'registration_link_lifecycle_events(operation_receipt_id, tournament_id)',
    'registration_link_operation_conflicts(prior_receipt_id, prior_receipt_tournament_id)',
    'roster_check_in_events(roster_entry_id, tournament_id)',
    'tournament_setup_operation_conflicts(prior_receipt_id, tournament_id, actor_profile_id)',
    'tournament_setup_q_pool_versions(setup_event_version_id, tournament_id, setup_revision_id)',
  ]) assert.match(repair, new RegExp(prefix.replaceAll('(', '\\(').replaceAll(')', '\\)')));
  assert.doesNotMatch(repair, /drop\s+(table|index)|delete\s+from|grant\s+/i);
});

test('private append-only foreign keys retain covering indexes without granting access', () => {
  const indexes = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0058_private_foreign_key_indexes.sql'), 'utf8').toLowerCase();
  const executableIndexes = indexes.replace(/^--.*$/gm, '');
  for (const definition of [
    'initial_seating_assignments_publication_scope_idx\\s+on app\\.initial_seating_assignments\\(publication_id, tournament_id\\)',
    'initial_seating_assignments_roster_scope_idx\\s+on app\\.initial_seating_assignments\\(roster_entry_id, tournament_id\\)',
    'initial_seating_publications_receipt_scope_idx\\s+on app\\.initial_seating_publications\\(operation_receipt_id, tournament_id\\)',
    'roster_account_links_receipt_scope_idx\\s+on app\\.roster_account_links\\(operation_receipt_id, tournament_id\\)',
    'roster_account_links_profile_id_idx\\s+on app\\.roster_account_links\\(profile_id\\)',
    'roster_account_links_roster_scope_idx\\s+on app\\.roster_account_links\\(roster_entry_id, tournament_id\\)',
    'roster_check_in_events_receipt_scope_idx\\s+on app\\.roster_check_in_events\\(operation_receipt_id, tournament_id\\)',
    'roster_check_in_events_roster_scope_idx\\s+on app\\.roster_check_in_events\\(roster_entry_id, tournament_id\\)',
    'tournament_setup_event_versions_revision_scope_idx\\s+on app\\.tournament_setup_event_versions\\(setup_revision_id, tournament_id\\)',
    'tournament_setup_official_versions_revision_scope_idx\\s+on app\\.tournament_setup_official_versions\\(setup_revision_id, tournament_id\\)',
    'tournament_setup_operation_conflicts_receipt_scope_idx\\s+on app\\.tournament_setup_operation_conflicts\\(prior_receipt_id, tournament_id, actor_profile_id\\)',
    'tournament_setup_q_pool_versions_event_scope_idx\\s+on app\\.tournament_setup_q_pool_versions\\(setup_event_version_id, tournament_id, setup_revision_id\\)',
    'tournament_setup_revisions_receipt_scope_idx\\s+on app\\.tournament_setup_revisions\\(operation_receipt_id, tournament_id\\)',
    'tournament_setup_revisions_receipt_actor_scope_idx\\s+on app\\.tournament_setup_revisions\\(operation_receipt_id, tournament_id, actor_profile_id\\)',
  ]) assert.match(executableIndexes, new RegExp(`create index if not exists ${definition}`));
  assert.doesNotMatch(executableIndexes, /\bgrant\b|\bcreate\s+policy\b|\balter\s+table\b/);

  const pruning = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0059_prune_redundant_private_foreign_key_indexes.sql'), 'utf8').toLowerCase();
  for (const indexName of [
    'initial_seating_assignments_publication_scope_idx', 'initial_seating_assignments_roster_scope_idx',
    'initial_seating_publications_receipt_scope_idx', 'roster_account_links_receipt_scope_idx',
    'roster_account_links_roster_scope_idx', 'roster_check_in_events_receipt_scope_idx',
    'roster_check_in_events_roster_scope_idx', 'tournament_setup_event_versions_revision_scope_idx',
    'tournament_setup_official_versions_revision_scope_idx', 'tournament_setup_operation_conflicts_receipt_scope_idx',
    'tournament_setup_q_pool_versions_event_scope_idx', 'tournament_setup_revisions_receipt_scope_idx',
    'tournament_setup_revisions_receipt_actor_scope_idx',
  ]) assert.match(pruning, new RegExp(`drop index if exists app\\.${indexName}`));
  assert.doesNotMatch(pruning, /roster_account_links_profile_id_idx|\bgrant\b|\bcreate\s+policy\b|\balter\s+table\b/);
});

test('witnessed roster-account activation storage is private, digest-only, and has one live identity binding', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0090_roster_account_activation_private_schema.sql'), 'utf8');
  for (const table of ['roster_account_activations', 'roster_account_activation_requests', 'roster_account_activation_events']) {
    assert.match(sql, new RegExp(`create table app\\.${table}`));
    assert.match(sql, new RegExp(`'${table}'`));
  }
  assert.match(sql, /execute format\('alter table app\.%I enable row level security', table_name\)/);
  assert.match(sql, /execute format\('alter table app\.%I force row level security', table_name\)/);
  assert.match(sql, /execute format\('revoke all on table app\.%I from public, anon, authenticated', table_name\)/);
  assert.match(sql, /token_salt bytea not null check \(octet_length\(token_salt\) = 32\)/);
  assert.match(sql, /token_digest bytea not null check \(octet_length\(token_digest\) = 32\)/);
  assert.match(sql, /where state in \('issued', 'pending'\)/);
  assert.match(sql, /unique \(activation_id\)/);
  assert.match(sql, /roster_account_activation_requests_one_live_profile_idx/);
  assert.match(sql, /where state = 'pending'/);
  assert.match(sql, /link_operation_id uuid not null default extensions\.gen_random_uuid\(\) unique/);
  assert.match(sql, /confirmation_phrase text not null/);
  assert.match(sql, /roster_account_activation_events_immutable/);
  assert.doesNotMatch(sql, /token(?:_| )?(?:value|secret|raw)|claimed_email|claimed_acc_number/i);
});

test('activation issuance is a server-only, receipt-bound, role-checked database transaction', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0091_roster_account_activation_issue_rpc.sql'), 'utf8');
  assert.match(sql, /roster_account_activation_service_only/);
  assert.match(sql, /auth\.role\(\).*service_role/);
  assert.match(sql, /issue_roster_account_activation_v1/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /role in \('director', 'co_director'\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /octet_length\(p_salt\) <> 32/);
  assert.match(sql, /octet_length\(p_digest\) <> 32/);
  assert.match(sql, /roster_account_activation_operation_conflicts/);
  assert.match(sql, /roster_account_activation_operation_conflicts_actor_idx/);
  assert.match(sql, /idempotency_conflict/);
  assert.match(sql, /update app\.roster_account_activation_requests set state = 'rejected'/);
  assert.match(sql, /revoke all on function public\.issue_roster_account_activation_v1.*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.issue_roster_account_activation_v1.*to service_role/);
  assert.doesNotMatch(sql, /raw token|p_token|claimed_email|claimed_acc_number/i);
});

test('activation redemption derives its digest outside SQL and creates only a pending witnessed request', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0092_roster_account_activation_redeem_rpc.sql'), 'utf8');
  assert.match(sql, /get_roster_account_activation_salt_v1/);
  assert.match(sql, /redeem_roster_account_activation_v1/);
  assert.match(sql, /roster_account_activation_service_only/);
  assert.match(sql, /octet_length\(p_digest\) <> 32/);
  assert.match(sql, /state = 'pending'/);
  assert.match(sql, /confirmationPhrase/);
  assert.match(sql, /roster_account_activation_operation_conflicts/);
  assert.match(sql, /revoke all on function public\.redeem_roster_account_activation_v1.*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.redeem_roster_account_activation_v1.*to service_role/);
  assert.doesNotMatch(sql, /p_token|raw token|claimed_email|claimed_acc_number/i);
});

test('witnessed approval has a server-only nested link writer with a distinct stored operation ID', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0093_roster_account_activation_private_link_writer.sql'), 'utf8');
  assert.match(sql, /app\.link_roster_account_service_v1/);
  assert.match(sql, /roster_account_activation_service_only/);
  assert.match(sql, /role in \('director', 'co_director'\)/);
  assert.match(sql, /p_actor_id = p_profile_id/);
  assert.match(sql, /link_roster_entry_to_account_service_v1/);
  assert.match(sql, /revoke all on function app\.link_roster_account_service_v1[\s\S]*from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant execute.*authenticated/i);
});

test('activation approval is server-only, phrase-witnessed, and rolls back a failed nested link', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0094_roster_account_activation_approval_rpc.sql'), 'utf8');
  assert.match(sql, /decide_roster_account_activation_v1/);
  assert.match(sql, /roster_account_activation_service_only/);
  assert.match(sql, /p_decision not in \('approve', 'reject'\)[\s\S]*p_confirmation_phrase is null/);
  assert.match(sql, /p_confirmation_phrase <> v_request\.confirmation_phrase/);
  assert.match(sql, /begin[\s\S]*app\.link_roster_account_service_v1[\s\S]*exception when others[\s\S]*activation approval unavailable/);
  assert.match(sql, /v_request\.link_operation_id/);
  assert.match(sql, /revoke all on function public\.decide_roster_account_activation_v1.*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.decide_roster_account_activation_v1.*to service_role/);
});

test('activation cancellation is server-only, receipt-bound, and releases a pending request', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', '0095_roster_account_activation_cancel_rpc.sql'), 'utf8');
  assert.match(sql, /cancel_roster_account_activation_v1/);
  assert.match(sql, /roster_account_activation_service_only/);
  assert.match(sql, /state = 'cancelled', terminal_at = now\(\)/);
  assert.match(sql, /roster_account_activation_requests set state = 'rejected'/);
  assert.match(sql, /revoke all on function public\.cancel_roster_account_activation_v1.*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.cancel_roster_account_activation_v1.*to service_role/);
});

test('activation mutations acquire their shared advisory scope before mutable activation rows', () => {
  for (const migration of [
    '0092_roster_account_activation_redeem_rpc.sql',
    '0094_roster_account_activation_approval_rpc.sql',
    '0095_roster_account_activation_cancel_rpc.sql',
  ]) {
    const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migrations', migration), 'utf8');
    const advisory = sql.indexOf('pg_advisory_xact_lock');
    assert.ok(advisory >= 0, `${migration} needs the shared advisory lock`);
    assert.doesNotMatch(sql.slice(0, advisory), /roster_account_activation(?:s|_requests)[\s\S]{0,500}for update/);
    assert.match(sql.slice(advisory), /select \* into v_activation from app\.roster_account_activations\s+where[\s\S]*?for update/);
  }
});
