-- Rollback-only integration fixture for migrations 0114-0116. Run on the
-- isolated/shared pilot database. Every synthetic row is rolled back.

begin;

create temporary table schedule_test_results (
  label text primary key,
  result jsonb not null
) on commit drop;
grant select, insert on schedule_test_results to service_role;

insert into auth.users(id, email) values
  ('a1140000-0000-4000-8000-000000000001', 'schedule-director@test.invalid'),
  ('a1140000-0000-4000-8000-000000000002', 'schedule-player-a@test.invalid'),
  ('a1140000-0000-4000-8000-000000000003', 'schedule-player-b@test.invalid'),
  ('a1140000-0000-4000-8000-000000000004', 'schedule-outsider@test.invalid'),
  ('a1140000-0000-4000-8000-000000000005', 'schedule-move@test.invalid'),
  ('a1140000-0000-4000-8000-000000000006', 'schedule-player-c@test.invalid'),
  ('a1140000-0000-4000-8000-000000000007', 'schedule-player-d@test.invalid');

insert into app.tournaments(id, director_profile_id, name, status, registration_status)
values ('b1140000-0000-4000-8000-000000000001',
  'a1140000-0000-4000-8000-000000000001', 'Synthetic Schedule', 'open', 'closed'),
  ('b1140000-0000-4000-8000-000000000002',
  'a1140000-0000-4000-8000-000000000001', 'Synthetic Other Tournament', 'open', 'closed');

insert into app.tournament_roles(tournament_id, profile_id, role) values
  ('b1140000-0000-4000-8000-000000000001', 'a1140000-0000-4000-8000-000000000001', 'director'),
  ('b1140000-0000-4000-8000-000000000001', 'a1140000-0000-4000-8000-000000000004', 'viewer'),
  ('b1140000-0000-4000-8000-000000000002', 'a1140000-0000-4000-8000-000000000001', 'director');

insert into app.operation_receipts(
  id, tournament_id, actor_profile_id, operation_type, target_id,
  request_hash, client_operation_id, outcome, response_payload, applied_at
) values
  ('c1140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
   'a1140000-0000-4000-8000-000000000001', 'schedule_fixture_setup',
   'b1140000-0000-4000-8000-000000000001', repeat('1', 64),
   'd1140000-0000-4000-8000-000000000001', 'accepted', '{}'::jsonb, now()),
  ('c1140000-0000-4000-8000-000000000002', 'b1140000-0000-4000-8000-000000000001',
   'a1140000-0000-4000-8000-000000000001', 'schedule_fixture_seating',
   'b1140000-0000-4000-8000-000000000001', repeat('2', 64),
   'd1140000-0000-4000-8000-000000000002', 'accepted', '{}'::jsonb, now());

insert into app.tournament_setup_revisions(
  id, tournament_id, version, tournament_name, city, venue, starts_at, ends_at,
  timezone_name, actor_profile_id, operation_receipt_id
) values (
  'e1140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
  1, 'Synthetic Schedule', 'Test City', 'Test Venue', '2026-10-03 09:00',
  '2026-10-03 18:00', 'Pacific/Honolulu', 'a1140000-0000-4000-8000-000000000001',
  'c1140000-0000-4000-8000-000000000001'
);

insert into app.tournament_setup_official_versions(
  id, tournament_id, setup_revision_id, profile_id, role
) values (
  'e1140000-0000-4000-8000-000000000004', 'b1140000-0000-4000-8000-000000000001',
  'e1140000-0000-4000-8000-000000000001', 'a1140000-0000-4000-8000-000000000001',
  'director'
);

insert into app.tournament_setup_event_versions(
  id, tournament_id, setup_revision_id, client_row_id, ordinal, event_kind,
  display_name, starts_at, timezone_name, style_code, format_code, game_count,
  entry_fee_cents, muggins_status
) values (
  'e1140000-0000-4000-8000-000000000002', 'b1140000-0000-4000-8000-000000000001',
  'e1140000-0000-4000-8000-000000000001', 'e1140000-0000-4000-8000-000000000003',
  1, 'main', 'Main', '2026-10-03 09:00', 'Pacific/Honolulu',
  'director_configured_standard_singles', 'standard_singles', 2, 0, 'unset'
);

insert into app.ruleset_versions(id, tournament_id, name, format, source_reference, effective_on, approved_at)
values
  ('f1140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
   'Schedule fixture rules', 'standard_singles', 'ACC Rulebook 2025; fixture only', '2026-01-01', now()),
  ('f1140000-0000-4000-8000-000000000002', 'b1140000-0000-4000-8000-000000000001',
   'Unpublished fixture rules', 'standard_singles', 'fixture only', '2026-01-01', now());

insert into app.events(id, tournament_id, ruleset_version_id, name, event_type, format, scoring_method)
values
  ('11140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
   'f1140000-0000-4000-8000-000000000001', 'Main', 'main', 'standard_singles', 'digital'),
  ('11140000-0000-4000-8000-000000000002', 'b1140000-0000-4000-8000-000000000001',
   'f1140000-0000-4000-8000-000000000002', 'Unpublished', 'satellite', 'standard_singles', 'digital');

insert into app.tournament_setup_activations(
  id, tournament_id, setup_revision_id, setup_event_version_id, ruleset_version_id,
  event_id, actor_profile_id, operation_receipt_id
) values (
  '21140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
  'e1140000-0000-4000-8000-000000000001', 'e1140000-0000-4000-8000-000000000002',
  'f1140000-0000-4000-8000-000000000001', '11140000-0000-4000-8000-000000000001',
  'a1140000-0000-4000-8000-000000000001', 'c1140000-0000-4000-8000-000000000001'
);

insert into app.initial_seating_publications(
  id, tournament_id, table_count, seats_per_table, actor_profile_id, operation_receipt_id
) values (
  '31140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
  1, 4, 'a1140000-0000-4000-8000-000000000001', 'c1140000-0000-4000-8000-000000000002'
);

insert into app.event_participants(id, tournament_id, event_id, profile_id, table_seat, status) values
  ('41140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001', '11140000-0000-4000-8000-000000000001', 'a1140000-0000-4000-8000-000000000002', 'A-1', 'checked_in'),
  ('41140000-0000-4000-8000-000000000002', 'b1140000-0000-4000-8000-000000000001', '11140000-0000-4000-8000-000000000001', 'a1140000-0000-4000-8000-000000000003', 'A-2', 'checked_in'),
  ('41140000-0000-4000-8000-000000000003', 'b1140000-0000-4000-8000-000000000001', '11140000-0000-4000-8000-000000000002', 'a1140000-0000-4000-8000-000000000005', 'A-1', 'checked_in'),
  ('41140000-0000-4000-8000-000000000004', 'b1140000-0000-4000-8000-000000000001', '11140000-0000-4000-8000-000000000001', 'a1140000-0000-4000-8000-000000000006', 'A-3', 'checked_in'),
  ('41140000-0000-4000-8000-000000000005', 'b1140000-0000-4000-8000-000000000001', '11140000-0000-4000-8000-000000000001', 'a1140000-0000-4000-8000-000000000007', 'A-4', 'checked_in');

set local role service_role;

insert into schedule_test_results(label, result)
select 'not_reviewed', public.publish_director_reviewed_event_schedule_v1(
  'a1140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
  '11140000-0000-4000-8000-000000000001', '[]'::jsonb, false,
  '51140000-0000-4000-8000-000000000001');

insert into schedule_test_results(label, result)
select 'outsider', public.publish_director_reviewed_event_schedule_v1(
  'a1140000-0000-4000-8000-000000000004', 'b1140000-0000-4000-8000-000000000001',
  '11140000-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-1','sideBVerificationId','A-2','sideATableSeat','A-1','sideBTableSeat','A-2'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-2','sideBVerificationId','A-1','sideATableSeat','A-2','sideBTableSeat','A-1')
  ), true, '51140000-0000-4000-8000-000000000002');

insert into schedule_test_results(label, result)
select 'wrong_event', public.publish_director_reviewed_event_schedule_v1(
  'a1140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
  '11140000-0000-4000-8000-000000000002', jsonb_build_array(
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-1','sideBVerificationId','A-2','sideATableSeat','A-1','sideBTableSeat','A-2'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-2','sideBVerificationId','A-1','sideATableSeat','A-2','sideBTableSeat','A-1')
  ), true, '51140000-0000-4000-8000-000000000003');

insert into schedule_test_results(label, result)
select 'invalid_seat', public.publish_director_reviewed_event_schedule_v1(
  'a1140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
  '11140000-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-1','sideBVerificationId','A-2','sideATableSeat','A-1','sideBTableSeat','A-5'),
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-3','sideBVerificationId','A-4','sideATableSeat','A-3','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-1','sideBVerificationId','A-4','sideATableSeat','A-1','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-2','sideBVerificationId','A-3','sideATableSeat','A-2','sideBTableSeat','A-3')
  ), true, '51140000-0000-4000-8000-000000000004');

insert into schedule_test_results(label, result)
select 'duplicate_player', public.publish_director_reviewed_event_schedule_v1(
  'a1140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
  '11140000-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-1','sideBVerificationId','A-2','sideATableSeat','A-1','sideBTableSeat','A-2'),
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-1','sideBVerificationId','A-3','sideATableSeat','A-3','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-1','sideBVerificationId','A-4','sideATableSeat','A-1','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-2','sideBVerificationId','A-3','sideATableSeat','A-2','sideBTableSeat','A-3')
  ), true, '51140000-0000-4000-8000-000000000007');

insert into schedule_test_results(label, result)
select 'duplicate_seat', public.publish_director_reviewed_event_schedule_v1(
  'a1140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
  '11140000-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-1','sideBVerificationId','A-2','sideATableSeat','A-1','sideBTableSeat','A-2'),
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-3','sideBVerificationId','A-4','sideATableSeat','A-3','sideBTableSeat','A-2'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-1','sideBVerificationId','A-4','sideATableSeat','A-1','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-2','sideBVerificationId','A-3','sideATableSeat','A-2','sideBTableSeat','A-3')
  ), true, '51140000-0000-4000-8000-000000000008');

insert into schedule_test_results(label, result)
select 'cross_tournament', public.publish_director_reviewed_event_schedule_v1(
  'a1140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000002',
  '11140000-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-1','sideBVerificationId','A-2','sideATableSeat','A-1','sideBTableSeat','A-2')
  ), true, '51140000-0000-4000-8000-000000000009');

insert into schedule_test_results(label, result)
select 'published', public.publish_director_reviewed_event_schedule_v1(
  'a1140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
  '11140000-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-1','sideBVerificationId','A-2','sideATableSeat','A-1','sideBTableSeat','A-2'),
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-3','sideBVerificationId','A-4','sideATableSeat','A-3','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-1','sideBVerificationId','A-4','sideATableSeat','A-1','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-2','sideBVerificationId','A-3','sideATableSeat','A-2','sideBTableSeat','A-3')
  ), true, '51140000-0000-4000-8000-000000000005');

insert into schedule_test_results(label, result)
select 'exact_replay', public.publish_director_reviewed_event_schedule_v1(
  'a1140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
  '11140000-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-1','sideBVerificationId','A-2','sideATableSeat','A-1','sideBTableSeat','A-2'),
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-3','sideBVerificationId','A-4','sideATableSeat','A-3','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-1','sideBVerificationId','A-4','sideATableSeat','A-1','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-2','sideBVerificationId','A-3','sideATableSeat','A-2','sideBTableSeat','A-3')
  ), true, '51140000-0000-4000-8000-000000000005');

reset role;
delete from app.tournament_roles
where tournament_id='b1140000-0000-4000-8000-000000000001'
  and profile_id='a1140000-0000-4000-8000-000000000001' and role='director';
set local role service_role;
insert into schedule_test_results(label, result)
select 'stale_role_replay', public.publish_director_reviewed_event_schedule_v1(
  'a1140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
  '11140000-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-1','sideBVerificationId','A-2','sideATableSeat','A-1','sideBTableSeat','A-2'),
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-3','sideBVerificationId','A-4','sideATableSeat','A-3','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-1','sideBVerificationId','A-4','sideATableSeat','A-1','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-2','sideBVerificationId','A-3','sideATableSeat','A-2','sideBTableSeat','A-3')
  ), true, '51140000-0000-4000-8000-000000000005');
reset role;
insert into app.tournament_roles(tournament_id, profile_id, role)
values ('b1140000-0000-4000-8000-000000000001', 'a1140000-0000-4000-8000-000000000001', 'director');
set local role service_role;

insert into schedule_test_results(label, result)
select 'changed_retry', public.publish_director_reviewed_event_schedule_v1(
  'a1140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
  '11140000-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-1','sideBVerificationId','A-2','sideATableSeat','A-2','sideBTableSeat','A-1'),
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-3','sideBVerificationId','A-4','sideATableSeat','A-3','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-1','sideBVerificationId','A-4','sideATableSeat','A-1','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-2','sideBVerificationId','A-3','sideATableSeat','A-2','sideBTableSeat','A-3')
  ), true, '51140000-0000-4000-8000-000000000005');

insert into schedule_test_results(label, result)
select 'second_publication', public.publish_director_reviewed_event_schedule_v1(
  'a1140000-0000-4000-8000-000000000001', 'b1140000-0000-4000-8000-000000000001',
  '11140000-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-1','sideBVerificationId','A-2','sideATableSeat','A-1','sideBTableSeat','A-2'),
    jsonb_build_object('gameNumber',1,'sideAVerificationId','A-3','sideBVerificationId','A-4','sideATableSeat','A-3','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-1','sideBVerificationId','A-4','sideATableSeat','A-1','sideBTableSeat','A-4'),
    jsonb_build_object('gameNumber',2,'sideAVerificationId','A-2','sideBVerificationId','A-3','sideATableSeat','A-2','sideBTableSeat','A-3')
  ), true, '51140000-0000-4000-8000-000000000006');

reset role;

do $$
declare
  v_game uuid;
  v_round uuid;
  v_failed boolean;
begin
  if (select result->>'code' from schedule_test_results where label='not_reviewed') <> 'invalid_schedule'
     or (select result->>'code' from schedule_test_results where label='outsider') <> 'not_director'
     or (select result->>'code' from schedule_test_results where label='wrong_event') <> 'event_not_approved'
     or (select result->>'code' from schedule_test_results where label='invalid_seat') <> 'invalid_schedule'
     or (select result->>'code' from schedule_test_results where label='duplicate_player') <> 'invalid_schedule'
     or (select result->>'code' from schedule_test_results where label='duplicate_seat') <> 'invalid_schedule'
     or (select result->>'code' from schedule_test_results where label='cross_tournament') <> 'event_not_approved'
     or (select result->>'code' from schedule_test_results where label='stale_role_replay') <> 'not_director'
     or (select result->>'code' from schedule_test_results where label='changed_retry') <> 'idempotency_conflict' then
    raise exception 'schedule rejection contract failed';
  end if;
  if (select result->>'status' from schedule_test_results where label='published') <> 'event_schedule_published'
     or (select result from schedule_test_results where label='published')
        <> (select result from schedule_test_results where label='exact_replay')
     or (select result->>'code' from schedule_test_results where label='second_publication') <> 'schedule_already_published' then
    raise exception 'publication, replay, or second-publication contract failed';
  end if;
  if (select count(*) from app.rounds where event_id='11140000-0000-4000-8000-000000000001') <> 2
     or (select count(*) from app.canonical_games where event_id='11140000-0000-4000-8000-000000000001') <> 4
     or (select count(*) from app.event_schedule_games where event_id='11140000-0000-4000-8000-000000000001') <> 4 then
    raise exception 'published schedule rows are incomplete or duplicated';
  end if;

  select id, round_id into v_game, v_round from app.canonical_games
  where event_id='11140000-0000-4000-8000-000000000001' order by id limit 1;

  v_failed := false;
  begin update app.canonical_games set side_a_table_seat_snapshot='C-9' where id=v_game;
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'published game assignment remained mutable'; end if;

  v_failed := false;
  begin update app.rounds set round_number=99 where id=v_round;
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'published round remained mutable'; end if;

  v_failed := false;
  begin update app.event_participants set event_id='11140000-0000-4000-8000-000000000001'
    where id='41140000-0000-4000-8000-000000000003';
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'move into published participant set remained possible'; end if;

  if has_function_privilege('anon', 'public.publish_director_reviewed_event_schedule_v1(uuid,uuid,uuid,jsonb,boolean,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.publish_director_reviewed_event_schedule_v1(uuid,uuid,uuid,jsonb,boolean,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.publish_director_reviewed_event_schedule_v1(uuid,uuid,uuid,jsonb,boolean,uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'app.publish_director_reviewed_event_schedule_core_v1(uuid,uuid,uuid,jsonb,uuid)', 'EXECUTE') then
    raise exception 'schedule writer grants are invalid';
  end if;
end;
$$;

set constraints all immediate;
rollback;
