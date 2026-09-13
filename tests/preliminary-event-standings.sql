-- Rollback-only integration proof for the read-only preliminary standings RPC.
-- It creates no retained accounts or tournament data.

begin;

insert into auth.users(id, email) values
  ('f1000000-0000-4000-8000-000000000001', 'standings-director@test.invalid'),
  ('f1000000-0000-4000-8000-000000000002', 'standings-player-a@test.invalid'),
  ('f1000000-0000-4000-8000-000000000003', 'standings-player-b@test.invalid'),
  ('f1000000-0000-4000-8000-000000000004', 'standings-player-c@test.invalid'),
  ('f1000000-0000-4000-8000-000000000005', 'standings-player-d@test.invalid'),
  ('f1000000-0000-4000-8000-000000000006', 'standings-checker@test.invalid'),
  ('f1000000-0000-4000-8000-000000000007', 'standings-reviewer@test.invalid'),
  ('f1000000-0000-4000-8000-000000000008', 'standings-outsider@test.invalid');

update app.profiles set display_name = case id
  when 'f1000000-0000-4000-8000-000000000002' then 'Alice Winner'
  when 'f1000000-0000-4000-8000-000000000003' then 'Bert Opponent'
  when 'f1000000-0000-4000-8000-000000000004' then 'Cara Tie'
  when 'f1000000-0000-4000-8000-000000000005' then 'Dana Tie'
  else display_name end
where id in ('f1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000005');

insert into app.tournaments(id, director_profile_id, name, status, registration_status)
values ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'Synthetic Standings', 'open', 'open');
insert into app.tournament_roles(tournament_id, profile_id, role) values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'director'),
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 'player'),
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000006', 'cross_checker'),
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000007', 'co_director');
insert into app.operation_receipts(
  id, tournament_id, actor_profile_id, operation_type, target_id,
  request_hash, client_operation_id, outcome, response_payload, applied_at
) values (
  'fd000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001', 'standings_fixture_roster',
  'f2000000-0000-4000-8000-000000000001', repeat('d', 64),
  'fe000000-0000-4000-8000-000000000001', 'accepted', '{}'::jsonb, now()
);
insert into app.tournament_roster_entries(
  id, tournament_id, claimed_display_name, claimed_normalized_name,
  creator_profile_id, operation_receipt_id, source_kind
) values (
  'ff000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001',
  'Dana Paper Card', 'dana paper card', 'f1000000-0000-4000-8000-000000000001',
  'fd000000-0000-4000-8000-000000000001', 'director_manual'
);
insert into app.ruleset_versions(id, tournament_id, name, format, source_reference, effective_on, approved_at)
values ('f3000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'Synthetic Standard Singles', 'standard_singles', 'synthetic test only', current_date, now());
insert into app.events(id, tournament_id, ruleset_version_id, name, event_type, format, scoring_method)
values ('f4000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000001', 'Main', 'main', 'standard_singles', 'digital');
insert into app.event_participants(id, tournament_id, event_id, profile_id, roster_entry_id, table_seat, status) values
  ('f5000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', null, 'A-1', 'checked_in'),
  ('f5000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000003', null, 'A-2', 'checked_in'),
  ('f5000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000004', null, 'A-3', 'checked_in'),
  ('f5000000-0000-4000-8000-000000000004', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', null, 'ff000000-0000-4000-8000-000000000001', 'A-4', 'checked_in');
insert into app.rounds(id, tournament_id, event_id, round_number) values
  ('f6000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 1),
  ('f6000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 2);
insert into app.canonical_games(id, tournament_id, event_id, round_id, side_a_participant_id, side_b_participant_id, side_a_table_seat_snapshot, side_b_table_seat_snapshot, state, version, winner_side, margin) values
  ('f7000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000002', 'A-1', 'A-2', 'verified', 1, 'a', 20),
  ('f7000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000002', 'A-1', 'A-2', 'verified', 1, 'a', 10);
insert into app.score_submissions(id, tournament_id, event_id, canonical_game_id, submitter_profile_id, submitter_participant_id, submission_slot, winner_side, margin, source_method, payload_digest) values
  ('f8000000-0000-4000-8000-000000000011', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001', 1, 'a', 20, 'digital', repeat('1', 64)),
  ('f8000000-0000-4000-8000-000000000012', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000003', 'f5000000-0000-4000-8000-000000000002', 2, 'a', 20, 'digital', repeat('2', 64)),
  ('f8000000-0000-4000-8000-000000000021', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001', 1, 'a', 10, 'digital', repeat('3', 64)),
  ('f8000000-0000-4000-8000-000000000022', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000003', 'f5000000-0000-4000-8000-000000000002', 2, 'a', 10, 'digital', repeat('4', 64));
insert into app.score_confirmations(id, tournament_id, event_id, canonical_game_id, submission_id, submission_actor_id, confirmation_actor_id, confirmation_kind) values
  ('f9000000-0000-4000-8000-000000000011', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-000000000011', 'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000002', 'player'),
  ('f9000000-0000-4000-8000-000000000012', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-000000000012', 'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000003', 'player'),
  ('f9000000-0000-4000-8000-000000000021', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000002', 'f8000000-0000-4000-8000-000000000021', 'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000002', 'player'),
  ('f9000000-0000-4000-8000-000000000022', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000002', 'f8000000-0000-4000-8000-000000000022', 'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000003', 'player');
insert into app.card_scorelines(id, tournament_id, event_id, canonical_game_id, participant_id, opponent_participant_id, side, table_seat_snapshot, is_winner, margin, plus_points, minus_points, game_points) values
  ('fa000000-0000-4000-8000-000000000011', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000002', 'a', 'A-1', true, 20, 20, 0, 2),
  ('fa000000-0000-4000-8000-000000000012', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001', 'b', 'A-2', false, 20, 0, 20, 0),
  ('fa000000-0000-4000-8000-000000000021', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000002', 'a', 'A-1', true, 10, 10, 0, 2),
  ('fa000000-0000-4000-8000-000000000022', 'f2000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001', 'b', 'A-2', false, 10, 0, 10, 0);

set constraints all immediate;
set constraints all deferred;
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select public.create_rule12b_correction_v1('f1000000-0000-4000-8000-000000000006','f7000000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000001',1,0,true,20,false,19,false,null,'fc000000-0000-4000-8000-000000000001');
reset role;
insert into app.correction_policy_versions(tournament_id, version, reason_required, required_approvals, created_by_profile_id)
values ('f2000000-0000-4000-8000-000000000001', 1, false, 1, 'f1000000-0000-4000-8000-000000000001');
set local role service_role;
select public.create_rule12b_correction_v1('f1000000-0000-4000-8000-000000000006','f7000000-0000-4000-8000-000000000002','fb000000-0000-4000-8000-000000000002',1,0,true,10,false,9,false,null,'fc000000-0000-4000-8000-000000000002');
reset role;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare v_result jsonb;
begin
  select public.get_preliminary_event_standings('f2000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001') into v_result;
  if v_result->>'status' <> 'preliminary' or jsonb_array_length(v_result->'rows') <> 4
     or v_result->'configuredGameCount' <> 'null'::jsonb
     or (v_result->>'schedulePublished')::boolean
     or (v_result->>'scheduledMatchCount')::integer <> 0
     or (v_result->>'persistedMatchCount')::integer <> 2
     or (v_result->>'resolvedMatchCount')::integer <> 2
     or (v_result->>'scheduledScorecardsComplete')::boolean
     or not exists (select 1 from jsonb_array_elements(v_result->'rows') row_data where row_data->>'participantId' = 'f5000000-0000-4000-8000-000000000001' and (row_data->>'gamePoints')::integer = 4 and (row_data->>'plusPoints')::integer = 29 and (row_data->>'verifiedGames')::integer = 2)
     or not exists (select 1 from jsonb_array_elements(v_result->'rows') row_data where row_data->>'participantId' = 'f5000000-0000-4000-8000-000000000004' and row_data->>'displayName' = 'Dana Paper Card')
     or not exists (select 1 from jsonb_array_elements(v_result->'rows') row_data where row_data->>'participantId' = 'f5000000-0000-4000-8000-000000000002' and (row_data->>'minusPoints')::integer = 30 and (row_data->>'verifiedGames')::integer = 2)
     or (select count(*) from jsonb_array_elements(v_result->'rows') row_data where (row_data->>'numericRank')::integer = 2 and (row_data->>'tied')::boolean) <> 2
     or not exists (select 1 from jsonb_array_elements(v_result->'rows') row_data where row_data->>'participantId' = 'f5000000-0000-4000-8000-000000000002' and (row_data->>'numericRank')::integer = 4) then
    raise exception 'standings failed applied/pending correction or exact-tie scope';
  end if;
end;
$$;

reset role;
set local role service_role;
select public.review_rule12_correction_v1('f1000000-0000-4000-8000-000000000007','fb000000-0000-4000-8000-000000000002','reject','fc000000-0000-4000-8000-000000000003');
reset role;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare v_result jsonb;
begin
  select public.get_preliminary_event_standings('f2000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001') into v_result;
  if not exists (select 1 from jsonb_array_elements(v_result->'rows') row_data where row_data->>'participantId' = 'f5000000-0000-4000-8000-000000000001' and (row_data->>'plusPoints')::integer = 29) then
    raise exception 'rejected correction changed preliminary standings';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000008', true);
do $$ begin
  if public.get_preliminary_event_standings('f2000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001') is not null then raise exception 'cross-tournament outsider received standings'; end if;
end; $$;
reset role;
do $$ begin
  if has_function_privilege('anon', 'public.get_preliminary_event_standings(uuid,uuid)', 'EXECUTE') or not has_function_privilege('authenticated', 'public.get_preliminary_event_standings(uuid,uuid)', 'EXECUTE') then raise exception 'standings reader grants are invalid'; end if;
end; $$;

set constraints all immediate;
rollback;
