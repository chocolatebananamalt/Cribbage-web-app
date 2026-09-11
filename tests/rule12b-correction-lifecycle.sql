-- Rollback-only integration fixture for migration 0106. Run against the
-- isolated synthetic validation database. All identities and tournament data
-- are anonymous fixtures and the final rollback retains none of them.

begin;

create temporary table rule12b_test_results (
  label text primary key,
  result jsonb
) on commit drop;

grant select, insert on rule12b_test_results to service_role;

insert into auth.users(id, email)
values
  ('a0000000-0000-4000-8000-000000000001', 'rule12-director@test.invalid'),
  ('a0000000-0000-4000-8000-000000000002', 'rule12-player-a@test.invalid'),
  ('a0000000-0000-4000-8000-000000000003', 'rule12-player-b@test.invalid'),
  ('a0000000-0000-4000-8000-000000000004', 'rule12-checker-one@test.invalid'),
  ('a0000000-0000-4000-8000-000000000005', 'rule12-checker-two@test.invalid'),
  ('a0000000-0000-4000-8000-000000000006', 'rule12-reviewer@test.invalid');

insert into app.tournaments(id, director_profile_id, name, status, registration_status)
values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
  'Rule 12 synthetic fixture', 'open', 'closed');

insert into app.tournament_roles(tournament_id, profile_id, role)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'director'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'cross_checker'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'cross_checker'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'cross_checker'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'co_director');

insert into app.ruleset_versions(id, tournament_id, name, format, source_reference, effective_on, approved_at)
values ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
  'Approved synthetic Standard Singles', 'standard_singles',
  'ACC Rulebook 2020-09 / Rule 12.2(b), synthetic validation only', '2020-09-01', now());

insert into app.events(id, tournament_id, ruleset_version_id, name, event_type, format, scoring_method)
values ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001', 'Synthetic Main', 'main', 'standard_singles', 'digital');

insert into app.rounds(id, tournament_id, event_id, round_number)
values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 1),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 2),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 3);

insert into app.event_participants(id, tournament_id, event_id, profile_id, table_seat, status)
values
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'A-1', 'checked_in'),
  ('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'A-2', 'checked_in');

insert into app.canonical_games(
  id, tournament_id, event_id, round_id, side_a_participant_id, side_b_participant_id,
  side_a_table_seat_snapshot, side_b_table_seat_snapshot, state, version, winner_side, margin
) values
  ('10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
    'f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 'A-1', 'A-2', 'verified', 1, 'a', 17),
  ('10000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
    'f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 'A-2', 'A-1', 'verified', 1, 'a', 17),
  ('10000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003',
    'f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 'A-1', 'A-2', 'verified', 1, 'a', 17);

insert into app.score_submissions(
  id, tournament_id, event_id, canonical_game_id, submitter_profile_id,
  submitter_participant_id, submission_slot, winner_side, margin, source_method, payload_digest
) values
  ('20000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 1, 'a', 17, 'digital', repeat('1', 64)),
  ('20000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000003', 2, 'a', 17, 'digital', repeat('2', 64)),
  ('20000000-0000-4000-8000-000000000021', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 1, 'a', 17, 'digital', repeat('3', 64)),
  ('20000000-0000-4000-8000-000000000022', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000003', 2, 'a', 17, 'digital', repeat('4', 64)),
  ('20000000-0000-4000-8000-000000000031', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 1, 'a', 17, 'digital', repeat('5', 64)),
  ('20000000-0000-4000-8000-000000000032', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000003', 2, 'a', 17, 'digital', repeat('6', 64));

insert into app.score_confirmations(
  id, tournament_id, event_id, canonical_game_id, submission_id,
  submission_actor_id, confirmation_actor_id, confirmation_kind
) values
  ('30000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'player'),
  ('30000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'player'),
  ('30000000-0000-4000-8000-000000000021', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'player'),
  ('30000000-0000-4000-8000-000000000022', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'player'),
  ('30000000-0000-4000-8000-000000000031', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'player'),
  ('30000000-0000-4000-8000-000000000032', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000032', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'player');

insert into app.card_scorelines(
  id, tournament_id, event_id, canonical_game_id, participant_id, opponent_participant_id,
  side, table_seat_snapshot, is_winner, margin, plus_points, minus_points, game_points
) values
  ('40000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 'a', 'A-1', true, 17, 17, 0, 2),
  ('40000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002', 'b', 'A-2', false, 17, 0, 17, 0),
  ('40000000-0000-4000-8000-000000000021', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 'a', 'A-2', true, 17, 17, 0, 2),
  ('40000000-0000-4000-8000-000000000022', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002', 'b', 'A-1', false, 17, 0, 17, 0),
  ('40000000-0000-4000-8000-000000000031', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 'a', 'A-1', true, 17, 17, 0, 2),
  ('40000000-0000-4000-8000-000000000032', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002', 'b', 'A-2', false, 17, 0, 17, 0);

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;

insert into rule12b_test_results(label, result)
select 'immediate', public.create_rule12b_correction_v1(
  'a0000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001', 1, 0,
  true, 17, false, 16, false, null,
  '60000000-0000-4000-8000-000000000001'
);

insert into rule12b_test_results(label, result)
select 'immediate_replay', public.create_rule12b_correction_v1(
  'a0000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001', 1, 0,
  true, 17, false, 16, false, null,
  '60000000-0000-4000-8000-000000000001'
);

insert into rule12b_test_results(label, result)
select 'changed_retry', public.create_rule12b_correction_v1(
  'a0000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001', 1, 0,
  true, 17, false, 15, false, null,
  '60000000-0000-4000-8000-000000000001'
);

insert into rule12b_test_results(label, result)
select 'qualification_blocked', public.create_rule12b_correction_v1(
  'a0000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000002', 1, 0,
  true, 17, false, 16, true, null,
  '60000000-0000-4000-8000-000000000002'
);

insert into rule12b_test_results(label, result)
select 'self_blocked', public.create_rule12b_correction_v1(
  'a0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000003', 1, 0,
  true, 17, false, 16, false, null,
  '60000000-0000-4000-8000-000000000003'
);

-- Switch the second game to the versioned review-required policy. This direct
-- private insertion models the already-supported director configuration RPC
-- without granting that older browser RPC any renewed access.
reset role;
insert into app.correction_policy_versions(
  tournament_id, version, reason_required, required_approvals, created_by_profile_id
) values (
  'b0000000-0000-4000-8000-000000000001', 1, true, 1,
  'a0000000-0000-4000-8000-000000000001'
);
set local role service_role;

insert into rule12b_test_results(label, result)
select 'reason_blocked', public.create_rule12b_correction_v1(
  'a0000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000004', 1, 0,
  true, 17, false, 16, false, null,
  '60000000-0000-4000-8000-000000000004'
);

insert into rule12b_test_results(label, result)
select 'pending', public.create_rule12b_correction_v1(
  'a0000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000005', 1, 0,
  true, 17, false, 16, false, 'Cards disagreed by one point',
  '60000000-0000-4000-8000-000000000005'
);

insert into rule12b_test_results(label, result)
select 'editor_review_blocked', public.review_rule12_correction_v1(
  'a0000000-0000-4000-8000-000000000005',
  '50000000-0000-4000-8000-000000000005', 'approve',
  '60000000-0000-4000-8000-000000000006'
);

insert into rule12b_test_results(label, result)
select 'participant_review_blocked', public.review_rule12_correction_v1(
  'a0000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000005', 'approve',
  '60000000-0000-4000-8000-000000000007'
);

reset role;
delete from app.tournament_roles
where tournament_id = 'b0000000-0000-4000-8000-000000000001'
  and profile_id = 'a0000000-0000-4000-8000-000000000001'
  and role = 'director';
set local role service_role;

insert into rule12b_test_results(label, result)
select 'stale_primary_review_blocked', public.review_rule12_correction_v1(
  'a0000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000005', 'approve',
  '60000000-0000-4000-8000-000000000011'
);

insert into rule12b_test_results(label, result)
select 'stale_primary_reader', public.get_rule12_correction_v1(
  'a0000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000005'
);

insert into rule12b_test_results(label, result)
select 'approved', public.review_rule12_correction_v1(
  'a0000000-0000-4000-8000-000000000006',
  '50000000-0000-4000-8000-000000000005', 'approve',
  '60000000-0000-4000-8000-000000000008'
);

insert into rule12b_test_results(label, result)
select 'approved_replay', public.review_rule12_correction_v1(
  'a0000000-0000-4000-8000-000000000006',
  '50000000-0000-4000-8000-000000000005', 'approve',
  '60000000-0000-4000-8000-000000000008'
);

insert into rule12b_test_results(label, result)
select 'pending_rejection', public.create_rule12b_correction_v1(
  'a0000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003',
  '50000000-0000-4000-8000-000000000006', 1, 0,
  true, 17, false, 16, false, 'Independent review fixture',
  '60000000-0000-4000-8000-000000000009'
);

insert into rule12b_test_results(label, result)
select 'review_rejected', public.review_rule12_correction_v1(
  'a0000000-0000-4000-8000-000000000006',
  '50000000-0000-4000-8000-000000000006', 'reject',
  '60000000-0000-4000-8000-000000000010'
);

insert into rule12b_test_results(label, result)
select 'rejected_reader', public.get_rule12_correction_v1(
  'a0000000-0000-4000-8000-000000000006',
  '50000000-0000-4000-8000-000000000006'
);

insert into rule12b_test_results(label, result)
select 'reader', public.get_rule12_correction_v1(
  'a0000000-0000-4000-8000-000000000006',
  '50000000-0000-4000-8000-000000000005'
);

insert into rule12b_test_results(label, result)
select 'participant_reader', public.get_rule12_correction_v1(
  'a0000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000005'
);

reset role;
update app.tournaments set status = 'pending_finalization'
where id = 'b0000000-0000-4000-8000-000000000001';
set local role service_role;

insert into rule12b_test_results(label, result)
select 'closed_create_replay', public.create_rule12b_correction_v1(
  'a0000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001', 1, 0,
  true, 17, false, 16, false, null,
  '60000000-0000-4000-8000-000000000001'
);

insert into rule12b_test_results(label, result)
select 'closed_review_replay', public.review_rule12_correction_v1(
  'a0000000-0000-4000-8000-000000000006',
  '50000000-0000-4000-8000-000000000005', 'approve',
  '60000000-0000-4000-8000-000000000008'
);

reset role;

do $$
declare
  v_immediate jsonb;
  v_reader jsonb;
begin
  select result into v_immediate from rule12b_test_results where label = 'immediate';
  if v_immediate->>'status' <> 'applied'
     or (v_immediate->>'correctionSequence')::integer <> 1
     or (select result from rule12b_test_results where label = 'immediate_replay') <> v_immediate
     or (select result from rule12b_test_results where label = 'closed_create_replay') <> v_immediate then
    raise exception 'immediate correction or exact replay failed';
  end if;
  if (select result->>'code' from rule12b_test_results where label = 'changed_retry') <> 'idempotency_conflict'
     or (select count(*) from app.independent_card_correction_operation_conflicts
         where attempted_operation_id = '60000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'changed retry did not fail closed with retained conflict evidence';
  end if;
  if (select result->>'code' from rule12b_test_results where label = 'qualification_blocked') <> 'qualification_notice_unavailable'
     or (select result->>'code' from rule12b_test_results where label = 'self_blocked') <> 'self_correction_denied'
     or (select result->>'code' from rule12b_test_results where label = 'reason_blocked') <> 'reason_required' then
    raise exception 'qualification, self-edit, or required-reason rejection failed';
  end if;
  if (select result->>'status' from rule12b_test_results where label = 'pending') <> 'pending'
     or (select result->>'code' from rule12b_test_results where label = 'editor_review_blocked') <> 'reviewer_not_independent'
     or (select result->>'code' from rule12b_test_results where label = 'participant_review_blocked') <> 'reviewer_not_independent'
     or (select result->>'code' from rule12b_test_results where label = 'stale_primary_review_blocked') <> 'not_eligible_reviewer'
     or (select result from rule12b_test_results where label = 'stale_primary_reader') is not null
     or (select result->>'status' from rule12b_test_results where label = 'approved') <> 'applied'
     or (select result from rule12b_test_results where label = 'approved_replay')
        <> (select result from rule12b_test_results where label = 'approved')
     or (select result from rule12b_test_results where label = 'closed_review_replay')
        <> (select result from rule12b_test_results where label = 'approved') then
    raise exception 'review policy, independence, approval, or replay failed';
  end if;
  if (select result->>'status' from rule12b_test_results where label = 'pending_rejection') <> 'pending'
     or (select result->>'status' from rule12b_test_results where label = 'review_rejected') <> 'rejected'
     or (select result->>'decision' from rule12b_test_results where label = 'review_rejected') <> 'reject'
     or (select result->>'status' from rule12b_test_results where label = 'rejected_reader') <> 'rejected' then
    raise exception 'independent rejection lifecycle or reader failed';
  end if;
  select result into v_reader from rule12b_test_results where label = 'reader';
  if v_reader->>'status' <> 'applied'
     or v_reader->>'reason' <> 'Cards disagreed by one point'
     or v_reader#>>'{projections,0,cardSide}' <> 'a'
     or (v_reader#>>'{projections,0,original,margin}')::integer <> 17
     or (v_reader#>>'{projections,0,adjudicated,margin}')::integer <> 16
     or v_reader#>>'{projections,1,cardSide}' <> 'b'
     or (v_reader#>>'{projections,1,original,margin}')::integer <> 16
     or (v_reader#>>'{projections,1,adjudicated,margin}')::integer <> 17
     or (select result from rule12b_test_results where label = 'participant_reader') is not null then
    raise exception 'authorized reader, projection preservation, or participant denial failed';
  end if;
  if (select count(*) from app.independent_card_corrections) <> 3
     or (select count(*) from app.independent_card_correction_state_events where state = 'applied') <> 2
     or (select count(*) from app.audit_events where action like 'rule12_correction_%') < 5 then
    raise exception 'correction history or audit evidence is incomplete or duplicated';
  end if;
  if exists (
    select 1 from app.card_scorelines
    where canonical_game_id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')
      and ((side = 'a' and (not is_winner or margin <> 17 or plus_points <> 17 or minus_points <> 0 or game_points <> 2))
        or (side = 'b' and (is_winner or margin <> 17 or plus_points <> 0 or minus_points <> 17 or game_points <> 0)))
  ) then
    raise exception 'independent correction mutated the canonical reciprocal scorelines';
  end if;
  if has_function_privilege('anon', 'public.create_rule12b_correction_v1(uuid,uuid,uuid,integer,integer,boolean,integer,boolean,integer,boolean,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.create_rule12b_correction_v1(uuid,uuid,uuid,integer,integer,boolean,integer,boolean,integer,boolean,text,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.review_rule12_correction_v1(uuid,uuid,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_rule12_correction_v1(uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.get_rule12_correction_v1(uuid,uuid)', 'EXECUTE') then
    raise exception 'server-only correction function grants are invalid';
  end if;
end;
$$;

-- Force all deferred game, projection, and lifecycle invariants before the
-- rollback so the successful fixture proves them rather than bypassing them.
set constraints all immediate;

select jsonb_build_object(
  'status', 'rule12b_correction_lifecycle_passed',
    'corrections', (select count(*) from app.independent_card_corrections),
  'stateEvents', (select count(*) from app.independent_card_correction_state_events),
  'operationConflicts', (select count(*) from app.independent_card_correction_operation_conflicts),
  'retainedFixtureRowsAfterRollback', 0
) as validation_result;

rollback;
