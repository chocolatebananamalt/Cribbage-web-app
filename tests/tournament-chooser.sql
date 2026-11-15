-- Rollback-only hosted proof for migration 0134. Uses fictional identities.
begin;

insert into auth.users(id, email) values
  ('a3400000-0000-4000-8000-000000000001', 'chooser-actor@test.invalid'),
  ('a3400000-0000-4000-8000-000000000002', 'chooser-outsider@test.invalid');

insert into app.tournaments(id, director_profile_id, name, status) values
  ('b3400000-0000-4000-8000-000000000001','a3400000-0000-4000-8000-000000000001','Chooser Open Event','open'),
  ('b3400000-0000-4000-8000-000000000002','a3400000-0000-4000-8000-000000000001','Chooser Draft Event','draft'),
  ('b3400000-0000-4000-8000-000000000003','a3400000-0000-4000-8000-000000000001','Chooser Archived Event','archived'),
  ('b3400000-0000-4000-8000-000000000004','a3400000-0000-4000-8000-000000000002','Other Person Event','open'),
  ('b3400000-0000-4000-8000-000000000005','a3400000-0000-4000-8000-000000000002','Z Chooser Implicit Player','draft');

insert into app.tournament_roles(tournament_id, profile_id, role) values
  ('b3400000-0000-4000-8000-000000000001','a3400000-0000-4000-8000-000000000001','viewer'),
  ('b3400000-0000-4000-8000-000000000001','a3400000-0000-4000-8000-000000000001','player'),
  ('b3400000-0000-4000-8000-000000000002','a3400000-0000-4000-8000-000000000001','director'),
  ('b3400000-0000-4000-8000-000000000003','a3400000-0000-4000-8000-000000000001','director'),
  ('b3400000-0000-4000-8000-000000000004','a3400000-0000-4000-8000-000000000002','director');

insert into app.ruleset_versions(id,tournament_id,name,format,source_reference,effective_on,approved_at) values
  ('c3400000-0000-4000-8000-000000000005','b3400000-0000-4000-8000-000000000005','Chooser Rules','standard_singles','Synthetic fixture','2026-01-01',now());
insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method) values
  ('d3400000-0000-4000-8000-000000000005','b3400000-0000-4000-8000-000000000005','c3400000-0000-4000-8000-000000000005','Chooser Main','main','standard_singles','digital');
insert into app.event_participants(id,tournament_id,event_id,profile_id,status) values
  ('e3400000-0000-4000-8000-000000000005','b3400000-0000-4000-8000-000000000005','d3400000-0000-4000-8000-000000000005','a3400000-0000-4000-8000-000000000001','checked_in');

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;

do $$
declare actor_result jsonb; outsider_result jsonb;
begin
  actor_result := public.list_actor_tournament_workspaces_v1('a3400000-0000-4000-8000-000000000001');
  outsider_result := public.list_actor_tournament_workspaces_v1('a3400000-0000-4000-8000-000000000002');

  if jsonb_array_length(actor_result) <> 3
    or actor_result->0->>'tournamentId' <> 'b3400000-0000-4000-8000-000000000001'
    or actor_result->0->>'effectiveRole' <> 'player'
    or actor_result->1->>'tournamentId' <> 'b3400000-0000-4000-8000-000000000002'
    or actor_result->1->>'effectiveRole' <> 'director'
    or actor_result->2->>'tournamentId' <> 'b3400000-0000-4000-8000-000000000005'
    or actor_result->2->>'effectiveRole' <> 'player'
    or actor_result::text like '%Archived%'
    or actor_result::text like '%Other Person%'
    or (select count(*) from jsonb_object_keys(actor_result->0)) <> 5
    or jsonb_array_length(outsider_result) <> 1
    or outsider_result->0->>'tournamentId' <> 'b3400000-0000-4000-8000-000000000004' then
    raise exception 'actor-scoped tournament chooser projection failed';
  end if;

  if has_function_privilege('authenticated','public.list_actor_tournament_workspaces_v1(uuid)','EXECUTE')
    or has_function_privilege('anon','public.list_actor_tournament_workspaces_v1(uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.list_actor_tournament_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'tournament chooser function grants failed';
  end if;
end;
$$;

reset role;
set constraints all immediate;
rollback;
