-- Rollback-only integration fixture for migration 0110. Execute the migration
-- and this fixture inside one BEGIN/ROLLBACK on the isolated synthetic backend.

begin;

insert into auth.users(id, email) values
  ('aa000000-0000-4000-8000-000000000001', 'readiness-director@test.invalid'),
  ('aa000000-0000-4000-8000-000000000002', 'readiness-co-director@test.invalid'),
  ('aa000000-0000-4000-8000-000000000003', 'readiness-player-a@test.invalid'),
  ('aa000000-0000-4000-8000-000000000004', 'readiness-player-b@test.invalid'),
  ('aa000000-0000-4000-8000-000000000005', 'readiness-viewer@test.invalid');

insert into app.tournaments(id, director_profile_id, name, status, registration_status)
values
  ('ab000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001', 'Synthetic Readiness', 'open', 'open'),
  ('ab000000-0000-4000-8000-000000000002', 'aa000000-0000-4000-8000-000000000005', 'Other Synthetic Tournament', 'draft', 'open');

insert into app.tournament_roles(tournament_id, profile_id, role) values
  ('ab000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001', 'director'),
  ('ab000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000002', 'co_director'),
  ('ab000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000003', 'player'),
  ('ab000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000005', 'viewer'),
  ('ab000000-0000-4000-8000-000000000002', 'aa000000-0000-4000-8000-000000000005', 'director');

insert into app.operation_receipts(
  id, tournament_id, actor_profile_id, operation_type, target_id,
  request_hash, client_operation_id, outcome, response_payload, applied_at
) values (
  'ac000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000001',
  'aa000000-0000-4000-8000-000000000001',
  'synthetic_readiness_fixture',
  'ab000000-0000-4000-8000-000000000001',
  repeat('a', 64),
  'ac000000-0000-4000-8000-000000000002',
  'accepted', '{}'::jsonb, now()
);

insert into app.tournament_registration_links(
  id, tournament_id, token_hash, created_by_profile_id, enabled, lifecycle_state
) values (
  'ad000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000001', repeat('b', 64),
  'aa000000-0000-4000-8000-000000000001', false, 'retired'
);

insert into app.registration_claims(
  id, tournament_id, registration_link_id, display_name, normalized_name,
  email, normalized_email, intended_payment_method, status,
  client_operation_id, request_fingerprint
) values
  ('ae000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000001', 'Synthetic Player A', 'synthetic player a', 'readiness-player-a@test.invalid', 'readiness-player-a@test.invalid', 'cash', 'accepted', 'ae000000-0000-4000-8000-000000000011', repeat('c', 64)),
  ('ae000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000001', 'ad000000-0000-4000-8000-000000000001', 'Synthetic Player B', 'synthetic player b', 'readiness-player-b@test.invalid', 'readiness-player-b@test.invalid', 'unspecified', 'accepted', 'ae000000-0000-4000-8000-000000000012', repeat('d', 64));

insert into app.registration_claim_decisions(
  id, tournament_id, claim_id, decision, actor_profile_id, operation_receipt_id
) values
  ('af000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001', 'approved_for_roster', 'aa000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001'),
  ('af000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000002', 'approved_for_roster', 'aa000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001');

insert into app.tournament_roster_entries(
  id, tournament_id, source_claim_id, approval_decision_id,
  claimed_display_name, claimed_normalized_name, claimed_email,
  claimed_normalized_email, creator_profile_id, operation_receipt_id
) values
  ('b0000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001', 'af000000-0000-4000-8000-000000000001', 'Synthetic Player A', 'synthetic player a', 'readiness-player-a@test.invalid', 'readiness-player-a@test.invalid', 'aa000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000002', 'af000000-0000-4000-8000-000000000002', 'Synthetic Player B', 'synthetic player b', 'readiness-player-b@test.invalid', 'readiness-player-b@test.invalid', 'aa000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001');

insert into app.roster_payment_events(
  id, tournament_id, roster_entry_id, version, event_type, amount_minor,
  currency_code, payment_method, payment_received_at, actor_profile_id,
  operation_receipt_id
) values (
  'b1000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  1, 'received', 2500, 'USD', 'cash', now(),
  'aa000000-0000-4000-8000-000000000001',
  'ac000000-0000-4000-8000-000000000001'
);

insert into app.roster_payment_operation_conflicts(
  actor_profile_id, tournament_id, attempted_roster_entry_id,
  attempted_idempotency_key, attempted_request_hash, prior_receipt_id, reason_code
) values (
  'aa000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000099', repeat('9', 64),
  'ac000000-0000-4000-8000-000000000001', 'synthetic_retry_conflict'
);

insert into app.ruleset_versions(
  id, tournament_id, name, format, source_reference, effective_on, approved_at
) values (
  'b2000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000001',
  'Synthetic Standard Singles', 'standard_singles', 'synthetic-source-v1',
  current_date, now()
);

insert into app.events(id, tournament_id, ruleset_version_id, name, event_type, format, scoring_method)
values (
  'b3000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'Main', 'main', 'standard_singles', 'digital'
);

insert into app.event_participants(id, tournament_id, event_id, profile_id, table_seat, status) values
  ('b4000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000003', 'A-1', 'checked_in'),
  ('b4000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000004', 'A-2', 'checked_in');

insert into app.rounds(id, tournament_id, event_id, round_number) values
  ('b5000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 1),
  ('b5000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 2);

insert into app.canonical_games(
  id, tournament_id, event_id, round_id, side_a_participant_id,
  side_b_participant_id, side_a_table_seat_snapshot,
  side_b_table_seat_snapshot, state, winner_side, margin
) values
  ('b6000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000002', 'A-1', 'A-2', 'verified', 'a', 20),
  ('b6000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000002', 'b4000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000002', 'A-2', 'A-1', 'pending', null, null);

insert into app.card_scorelines(
  tournament_id, event_id, canonical_game_id, participant_id,
  opponent_participant_id, side, table_seat_snapshot, is_winner,
  margin, plus_points, minus_points, game_points
) values
  ('ab000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000002', 'a', 'A-1', true, 20, 20, 0, 2),
  ('ab000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000002', 'b4000000-0000-4000-8000-000000000001', 'b', 'A-2', false, 20, 0, 20, 0);

insert into app.score_submissions(
  id, tournament_id, event_id, canonical_game_id, submitter_profile_id,
  submitter_participant_id, submission_slot, winner_side, margin,
  source_method, payload_digest
) values
  ('b6100000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000003', 'b4000000-0000-4000-8000-000000000001', 1, 'a', 20, 'digital', repeat('e', 64)),
  ('b6100000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000004', 'b4000000-0000-4000-8000-000000000002', 2, 'a', 20, 'digital', repeat('f', 64));

insert into app.score_confirmations(
  id, tournament_id, event_id, canonical_game_id, submission_id,
  submission_actor_id, confirmation_actor_id, confirmation_kind
) values
  ('b6200000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'b6100000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000003', 'aa000000-0000-4000-8000-000000000003', 'player'),
  ('b6200000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'b6100000-0000-4000-8000-000000000002', 'aa000000-0000-4000-8000-000000000004', 'aa000000-0000-4000-8000-000000000004', 'player');

set constraints all immediate;
set constraints all deferred;

insert into app.game_corrections(
  id, tournament_id, event_id, canonical_game_id, correction_sequence,
  base_game_version, editor_profile_id, previous_winner_side,
  previous_margin, corrected_winner_side, corrected_margin,
  policy_version, reason_required, required_approvals
) values (
  'b7000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  1, 1, 'aa000000-0000-4000-8000-000000000001',
  'a', 20, 'a', 21, 0, false, 1
);

insert into app.correction_state_events(
  correction_id, canonical_game_id, tournament_id, event_id,
  actor_profile_id, state, transition_sequence
) values (
  'b7000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'aa000000-0000-4000-8000-000000000001',
  'pending', 1
);

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;

do $$
declare
  v_report jsonb;
begin
  select public.get_event_finalization_readiness_v1(
    'aa000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001'
  ) into v_report;
  if v_report->>'status' <> 'blocked'
     or (v_report->>'readyForFinalization')::boolean
     or (v_report->>'finalizationAuthorized')::boolean
     or (v_report->'scores'->>'persistedGameCount')::integer <> 2
     or (v_report->'scores'->>'verifiedGameCount')::integer <> 1
     or (v_report->'scores'->>'pendingGameCount')::integer <> 1
     or (v_report->'corrections'->>'legacyPendingCount')::integer <> 1
     or (v_report->'corrections'->>'independentPendingCount')::integer <> 0
     or (v_report->'finance'->>'rosterEntryCount')::integer <> 2
     or (v_report->'finance'->>'rosterEntriesWithLatestReceivedPaymentCount')::integer <> 1
     or (v_report->'finance'->>'unrecordedPaymentCount')::integer <> 1
     or (v_report->'finance'->>'paymentEventCount')::integer <> 1
     or (v_report->'finance'->>'operationConflictCount')::integer <> 1
     or (v_report->'finance'->>'reconciliationEvidenceAvailable')::boolean
     or not (v_report->'blockers' ? 'score_verification_incomplete')
     or not (v_report->'blockers' ? 'correction_approval_pending')
     or not (v_report->'blockers' ? 'dispute_register_unavailable')
     or not (v_report->'blockers' ? 'event_lifecycle_evidence_unavailable')
     or not (v_report->'blockers' ? 'schedule_completeness_evidence_unavailable')
     or not (v_report->'blockers' ? 'seating_or_eligibility_evidence_unavailable')
     or not (v_report->'blockers' ? 'finance_or_reporting_unreconciled')
     or not (v_report->'blockers' ? 'result_version_missing')
     or not (v_report->'blockers' ? 'director_approval_missing') then
    raise exception 'readiness report did not preserve the exact blocker evidence';
  end if;

  if public.get_event_finalization_readiness_v1(
    'aa000000-0000-4000-8000-000000000005',
    'ab000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001'
  ) is not null then
    raise exception 'director from another tournament received readiness';
  end if;

  if public.get_event_finalization_readiness_v1(
    'aa000000-0000-4000-8000-000000000002',
    'ab000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001'
  )->>'eventId' <> 'b3000000-0000-4000-8000-000000000001' then
    raise exception 'co-director could not read scoped finalization readiness';
  end if;
end;
$$;

reset role;
delete from app.tournament_roles
where tournament_id = 'ab000000-0000-4000-8000-000000000001'
  and profile_id = 'aa000000-0000-4000-8000-000000000002'
  and role = 'co_director';
set local role service_role;

do $$
begin
  if public.get_event_finalization_readiness_v1(
    'aa000000-0000-4000-8000-000000000002',
    'ab000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001'
  ) is not null then
    raise exception 'revoked co-director retained finalization readiness access';
  end if;
end;
$$;

reset role;

delete from app.tournament_roles
where tournament_id = 'ab000000-0000-4000-8000-000000000001'
  and profile_id = 'aa000000-0000-4000-8000-000000000001'
  and role = 'director';
set local role service_role;

do $$
begin
  if public.get_event_finalization_readiness_v1(
    'aa000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001'
  ) is not null then
    raise exception 'primary director without current role retained readiness access';
  end if;
end;
$$;

reset role;

do $$
begin
  if has_function_privilege('anon', 'public.get_event_finalization_readiness_v1(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_event_finalization_readiness_v1(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('public', 'public.get_event_finalization_readiness_v1(uuid,uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.get_event_finalization_readiness_v1(uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'finalization readiness grants are invalid';
  end if;
end;
$$;

set constraints all immediate;
rollback;
