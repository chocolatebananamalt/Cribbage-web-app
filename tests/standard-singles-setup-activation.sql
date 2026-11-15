-- Rollback-only integration fixture for migration 0108. Run against the
-- isolated synthetic validation database after the migration SQL in the same
-- transaction. It creates no retained accounts or tournament data.

begin;

create temporary table setup_activation_test_results (
  label text primary key,
  result jsonb not null
) on commit drop;

grant select, insert on setup_activation_test_results to authenticated, service_role;

insert into auth.users(id, email)
values
  ('a8000000-0000-4000-8000-000000000001', 'setup-activation-director-v2@test.invalid'),
  ('a8000000-0000-4000-8000-000000000002', 'setup-activation-outsider-v2@test.invalid'),
  ('a8000000-0000-4000-8000-000000000003', 'setup-activation-new-director-v2@test.invalid');

insert into app.tournaments(id, director_profile_id, name, status, registration_status)
values
  ('b8000000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000001', 'Draft shell', 'draft', 'closed'),
  ('b8000000-0000-4000-8000-000000000002', 'a8000000-0000-4000-8000-000000000001', 'Unsupported shell', 'draft', 'closed'),
  ('b8000000-0000-4000-8000-000000000003', 'a8000000-0000-4000-8000-000000000001', 'Stale director shell', 'draft', 'closed');

insert into app.tournament_roles(tournament_id, profile_id, role)
values
  ('b8000000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-000000000001', 'director'),
  ('b8000000-0000-4000-8000-000000000002', 'a8000000-0000-4000-8000-000000000001', 'director'),
  ('b8000000-0000-4000-8000-000000000003', 'a8000000-0000-4000-8000-000000000001', 'director');

select set_config('request.jwt.claim.sub', 'a8000000-0000-4000-8000-000000000001', true);
set local role authenticated;

insert into setup_activation_test_results(label, result)
select 'setup_saved', public.save_tournament_setup_version(
  'b8000000-0000-4000-8000-000000000001',
  0,
  jsonb_build_object(
    'tournamentName', 'Synthetic Standard Singles',
    'city', 'Test City',
    'venue', 'Test Venue',
    'startsAt', '2026-10-01T09:00:00',
    'endsAt', '2026-10-01T17:00:00',
    'stateTerritory', 'Hawaii',
    'timezone', 'Pacific/Honolulu',
    'tournamentContactPhone', '+1 808 555 0101',
    'tournamentContactEmail', 'director-one@test.invalid',
    'tournamentMailingAddress', '',
    'sanctioningFeeCents', null,
    'officials', jsonb_build_array(jsonb_build_object(
      'profileId', 'a8000000-0000-4000-8000-000000000001',
      'role', 'director'
    )),
    'events', jsonb_build_array(jsonb_build_object(
      'clientRowId', 'c8000000-0000-4000-8000-000000000001',
      'eventKind', 'main',
      'displayName', 'Main',
      'startsAt', '2026-10-01T09:00:00',
      'timezone', 'Pacific/Honolulu',
      'styleCode', 'director_configured_standard_singles',
      'formatCode', 'standard_singles',
      'gameCount', 9,
      'entryFeeCents', 0,
      'feeIncludesNote', '',
      'payoutNote', '',
      'qualificationNote', '',
      'eligibilityNote', '',
      'mugginsStatus', 'unset',
      'qPools', jsonb_build_array()
    ))
  ),
  'd8000000-0000-4000-8000-000000000001'
);

insert into setup_activation_test_results(label, result)
select 'unsupported_setup_saved', public.save_tournament_setup_version(
  'b8000000-0000-4000-8000-000000000002',
  0,
  jsonb_build_object(
    'tournamentName', 'Synthetic Unsupported Team Event',
    'city', 'Test City',
    'venue', 'Test Venue',
    'startsAt', '2026-10-02T09:00:00',
    'endsAt', '2026-10-02T17:00:00',
    'stateTerritory', 'Hawaii',
    'timezone', 'Pacific/Honolulu',
    'tournamentContactPhone', '+1 808 555 0101',
    'tournamentContactEmail', 'director-two@test.invalid',
    'tournamentMailingAddress', '',
    'sanctioningFeeCents', null,
    'officials', jsonb_build_array(jsonb_build_object(
      'profileId', 'a8000000-0000-4000-8000-000000000001',
      'role', 'director'
    )),
    'events', jsonb_build_array(jsonb_build_object(
      'clientRowId', 'c8000000-0000-4000-8000-000000000002',
      'eventKind', 'custom',
      'displayName', 'Team Event',
      'startsAt', '2026-10-02T09:00:00',
      'timezone', 'Pacific/Honolulu',
      'styleCode', 'director_configured_team',
      'formatCode', 'team',
      'gameCount', 9,
      'entryFeeCents', 0,
      'feeIncludesNote', '',
      'payoutNote', '',
      'qualificationNote', '',
      'eligibilityNote', '',
      'mugginsStatus', 'unset',
      'qPools', jsonb_build_array()
    ))
  ),
  'd8000000-0000-4000-8000-000000000002'
);

insert into setup_activation_test_results(label, result)
select 'stale_director_setup_saved', public.save_tournament_setup_version(
  'b8000000-0000-4000-8000-000000000003', 0,
  jsonb_build_object(
    'tournamentName', 'Synthetic Stale Director', 'city', 'Test City',
    'venue', 'Test Venue', 'startsAt', '2026-10-03T09:00:00',
    'endsAt', '2026-10-03T17:00:00', 'stateTerritory', 'Hawaii', 'timezone', 'Pacific/Honolulu',
    'tournamentContactPhone', '+1 808 555 0101', 'tournamentContactEmail', 'director-three@test.invalid',
    'tournamentMailingAddress', '', 'sanctioningFeeCents', null,
    'officials', jsonb_build_array(jsonb_build_object(
      'profileId', 'a8000000-0000-4000-8000-000000000001', 'role', 'director'
    )),
    'events', jsonb_build_array(jsonb_build_object(
      'clientRowId', 'c8000000-0000-4000-8000-000000000003',
      'eventKind', 'main', 'displayName', 'Main',
      'startsAt', '2026-10-03T09:00:00', 'timezone', 'Pacific/Honolulu',
      'styleCode', 'director_configured_standard_singles',
      'formatCode', 'standard_singles', 'gameCount', 9,
      'entryFeeCents', 0, 'feeIncludesNote', '', 'payoutNote', '',
      'qualificationNote', '', 'eligibilityNote', '',
      'mugginsStatus', 'unset', 'qPools', jsonb_build_array()
    ))
  ),
  'd8000000-0000-4000-8000-000000000003'
);

reset role;

update app.tournaments
set director_profile_id = 'a8000000-0000-4000-8000-000000000003'
where id = 'b8000000-0000-4000-8000-000000000003';
insert into app.tournament_roles(tournament_id, profile_id, role)
values ('b8000000-0000-4000-8000-000000000003', 'a8000000-0000-4000-8000-000000000003', 'director');

set local role service_role;

insert into setup_activation_test_results(label, result)
select 'activated', public.activate_standard_singles_setup_v1(
  'a8000000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  (select (result ->> 'revisionId')::uuid from setup_activation_test_results where label = 'setup_saved'),
  1,
  'e8000000-0000-4000-8000-000000000001'
);

insert into setup_activation_test_results(label, result)
select 'exact_replay', public.activate_standard_singles_setup_v1(
  'a8000000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  (select (result ->> 'revisionId')::uuid from setup_activation_test_results where label = 'setup_saved'),
  1,
  'e8000000-0000-4000-8000-000000000001'
);

insert into setup_activation_test_results(label, result)
select 'changed_retry', public.activate_standard_singles_setup_v1(
  'a8000000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  (select (result ->> 'revisionId')::uuid from setup_activation_test_results where label = 'setup_saved'),
  2,
  'e8000000-0000-4000-8000-000000000001'
);

insert into setup_activation_test_results(label, result)
select 'unsupported', public.activate_standard_singles_setup_v1(
  'a8000000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000002',
  (select (result ->> 'revisionId')::uuid from setup_activation_test_results where label = 'unsupported_setup_saved'),
  1,
  'e8000000-0000-4000-8000-000000000002'
);

insert into setup_activation_test_results(label, result)
select 'outsider', public.activate_standard_singles_setup_v1(
  'a8000000-0000-4000-8000-000000000002',
  'b8000000-0000-4000-8000-000000000002',
  (select (result ->> 'revisionId')::uuid from setup_activation_test_results where label = 'unsupported_setup_saved'),
  1,
  'e8000000-0000-4000-8000-000000000003'
);

insert into setup_activation_test_results(label, result)
select 'stale_director', public.activate_standard_singles_setup_v1(
  'a8000000-0000-4000-8000-000000000003',
  'b8000000-0000-4000-8000-000000000003',
  (select (result ->> 'revisionId')::uuid from setup_activation_test_results where label = 'stale_director_setup_saved'),
  1,
  'e8000000-0000-4000-8000-000000000004'
);

reset role;

do $$
declare
  v_accepted jsonb;
  v_replay jsonb;
begin
  select result into v_accepted from setup_activation_test_results where label = 'activated';
  select result into v_replay from setup_activation_test_results where label = 'exact_replay';
  if v_accepted->>'status' <> 'standard_singles_activated' or v_replay <> v_accepted then
    raise exception 'activation or exact replay failed';
  end if;
  if (select result->>'code' from setup_activation_test_results where label = 'changed_retry') <> 'idempotency_conflict' then
    raise exception 'changed retry was not controlled';
  end if;
  if (select result->>'code' from setup_activation_test_results where label = 'unsupported') <> 'unsupported_setup' then
    raise exception 'unsupported format was not blocked';
  end if;
  if (select result->>'code' from setup_activation_test_results where label = 'outsider') <> 'not_director' then
    raise exception 'non-director was not blocked';
  end if;
  if (select result->>'code' from setup_activation_test_results where label = 'stale_director') <> 'setup_officials_stale' then
    raise exception 'replaced primary director did not invalidate the setup snapshot';
  end if;
  if (select count(*) from app.tournament_setup_activations where tournament_id = 'b8000000-0000-4000-8000-000000000001') <> 1
     or (select count(*) from app.ruleset_versions where tournament_id = 'b8000000-0000-4000-8000-000000000001') <> 1
     or (select count(*) from app.events where tournament_id = 'b8000000-0000-4000-8000-000000000001') <> 1
     or (select count(*) from app.event_publication_states where tournament_id = 'b8000000-0000-4000-8000-000000000001' and state = 'draft') <> 1 then
    raise exception 'operational activation rows are incomplete or duplicated';
  end if;
  if (select status from app.tournaments where id = 'b8000000-0000-4000-8000-000000000001') <> 'open'
     or (select registration_status from app.tournaments where id = 'b8000000-0000-4000-8000-000000000001') <> 'open'
     or (select name from app.tournaments where id = 'b8000000-0000-4000-8000-000000000001') <> 'Synthetic Standard Singles' then
    raise exception 'tournament was not activated from the setup revision';
  end if;
  if exists (
    select 1 from app.ruleset_versions r
    where r.tournament_id = 'b8000000-0000-4000-8000-000000000001'
      and (r.format <> 'standard_singles' or r.approved_at is null
        or r.source_reference not like '%scope=standard_singles_scoring_core_only%')
  ) then
    raise exception 'ruleset source scope is invalid';
  end if;
  if (select count(*) from app.tournament_setup_activation_conflicts where tournament_id = 'b8000000-0000-4000-8000-000000000001') <> 1
     or (select count(*) from app.events where tournament_id = 'b8000000-0000-4000-8000-000000000002') <> 0
     or (select count(*) from app.ruleset_versions where tournament_id = 'b8000000-0000-4000-8000-000000000002') <> 0 then
    raise exception 'rejection persistence or rollback boundary failed';
  end if;
  if exists (select 1 from app.rounds where tournament_id in ('b8000000-0000-4000-8000-000000000001', 'b8000000-0000-4000-8000-000000000002'))
     or exists (select 1 from app.event_participants where tournament_id in ('b8000000-0000-4000-8000-000000000001', 'b8000000-0000-4000-8000-000000000002'))
     or exists (select 1 from app.initial_seating_publications where tournament_id in ('b8000000-0000-4000-8000-000000000001', 'b8000000-0000-4000-8000-000000000002')) then
    raise exception 'activation created an out-of-scope operational row';
  end if;
  if has_function_privilege('anon', 'public.activate_standard_singles_setup_v1(uuid,uuid,uuid,integer,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.activate_standard_singles_setup_v1(uuid,uuid,uuid,integer,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.activate_standard_singles_setup_v1(uuid,uuid,uuid,integer,uuid)', 'EXECUTE') then
    raise exception 'activation function grants are invalid';
  end if;
end;
$$;

update app.tournaments
set director_profile_id = 'a8000000-0000-4000-8000-000000000001'
where id = 'b8000000-0000-4000-8000-000000000003';
delete from app.tournament_roles
where tournament_id = 'b8000000-0000-4000-8000-000000000003'
  and profile_id = 'a8000000-0000-4000-8000-000000000003'
  and role = 'director';
set constraints all immediate;
rollback;
