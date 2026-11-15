-- Rollback-only hosted proof for migration 0161. All identities are fictional.
begin;

insert into auth.users(id, email) values
  ('a1610000-0000-4000-8000-000000000001', 'assignment-director@test.invalid'),
  ('a1610000-0000-4000-8000-000000000002', 'assignment-candidate@test.invalid'),
  ('a1610000-0000-4000-8000-000000000003', 'assignment-official@test.invalid'),
  ('a1610000-0000-4000-8000-000000000004', 'assignment-outsider@test.invalid'),
  ('a1610000-0000-4000-8000-000000000005', 'assignment-other@test.invalid');

insert into app.tournaments(id, director_profile_id, name, status, registration_status) values
  ('b1610000-0000-4000-8000-000000000001', 'a1610000-0000-4000-8000-000000000001', 'Cross-check Assignment Fixture', 'open', 'open'),
  ('b1610000-0000-4000-8000-000000000002', 'a1610000-0000-4000-8000-000000000004', 'Other Assignment Fixture', 'open', 'open');

insert into app.tournament_roles(tournament_id, profile_id, role) values
  ('b1610000-0000-4000-8000-000000000001', 'a1610000-0000-4000-8000-000000000001', 'director'),
  ('b1610000-0000-4000-8000-000000000001', 'a1610000-0000-4000-8000-000000000003', 'judge'),
  ('b1610000-0000-4000-8000-000000000002', 'a1610000-0000-4000-8000-000000000004', 'director');

insert into app.operation_receipts(id, tournament_id, actor_profile_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at) values
  ('c1610000-0000-4000-8000-000000000001', 'b1610000-0000-4000-8000-000000000001', 'a1610000-0000-4000-8000-000000000001', 'fixture', 'b1610000-0000-4000-8000-000000000001', repeat('1',64), 'e1610000-0000-4000-8000-000000000011', 'accepted', '{}'::jsonb, now()),
  ('c1610000-0000-4000-8000-000000000002', 'b1610000-0000-4000-8000-000000000002', 'a1610000-0000-4000-8000-000000000004', 'fixture', 'b1610000-0000-4000-8000-000000000002', repeat('2',64), 'e1610000-0000-4000-8000-000000000012', 'accepted', '{}'::jsonb, now());

insert into app.tournament_roster_entries(id, tournament_id, source_kind, claimed_display_name, claimed_normalized_name, scorecard_type, creator_profile_id, operation_receipt_id) values
  ('d1610000-0000-4000-8000-000000000001', 'b1610000-0000-4000-8000-000000000001', 'director_manual', 'Director Person', 'director person', 'digital', 'a1610000-0000-4000-8000-000000000001', 'c1610000-0000-4000-8000-000000000001'),
  ('d1610000-0000-4000-8000-000000000002', 'b1610000-0000-4000-8000-000000000001', 'director_manual', 'Candidate Person', 'candidate person', 'digital', 'a1610000-0000-4000-8000-000000000001', 'c1610000-0000-4000-8000-000000000001'),
  ('d1610000-0000-4000-8000-000000000003', 'b1610000-0000-4000-8000-000000000001', 'director_manual', 'Official Person', 'official person', 'digital', 'a1610000-0000-4000-8000-000000000001', 'c1610000-0000-4000-8000-000000000001'),
  ('d1610000-0000-4000-8000-000000000004', 'b1610000-0000-4000-8000-000000000002', 'director_manual', 'Other Person', 'other person', 'digital', 'a1610000-0000-4000-8000-000000000004', 'c1610000-0000-4000-8000-000000000002');

insert into app.roster_account_links(tournament_id, roster_entry_id, profile_id, actor_profile_id, operation_receipt_id) values
  ('b1610000-0000-4000-8000-000000000001', 'd1610000-0000-4000-8000-000000000001', 'a1610000-0000-4000-8000-000000000001', 'a1610000-0000-4000-8000-000000000003', 'c1610000-0000-4000-8000-000000000001'),
  ('b1610000-0000-4000-8000-000000000001', 'd1610000-0000-4000-8000-000000000002', 'a1610000-0000-4000-8000-000000000002', 'a1610000-0000-4000-8000-000000000001', 'c1610000-0000-4000-8000-000000000001'),
  ('b1610000-0000-4000-8000-000000000001', 'd1610000-0000-4000-8000-000000000003', 'a1610000-0000-4000-8000-000000000003', 'a1610000-0000-4000-8000-000000000001', 'c1610000-0000-4000-8000-000000000001'),
  ('b1610000-0000-4000-8000-000000000002', 'd1610000-0000-4000-8000-000000000004', 'a1610000-0000-4000-8000-000000000005', 'a1610000-0000-4000-8000-000000000004', 'c1610000-0000-4000-8000-000000000002');

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;

do $$
declare workspace jsonb; first_result jsonb; replay_result jsonb; conflict_result jsonb; already_result jsonb;
begin
  workspace := public.get_cross_checker_assignment_workspace_v1('a1610000-0000-4000-8000-000000000001', 'b1610000-0000-4000-8000-000000000001');
  if jsonb_array_length(workspace->'candidates') <> 1
    or workspace->'candidates'->0->>'rosterEntryId' <> 'd1610000-0000-4000-8000-000000000002'
    or workspace->'candidates'->0->>'identityHint' is null
    or workspace->'candidates'->0->>'identityHint' not like '%D1610000-0000-4000-8000-000000000002'
    or workspace::text like '%@test.invalid%' then
    raise exception 'workspace leaked or candidate scope is wrong';
  end if;

  first_result := public.assign_cross_checker_v1(
    'a1610000-0000-4000-8000-000000000001', 'b1610000-0000-4000-8000-000000000001',
    'd1610000-0000-4000-8000-000000000002', 'e1610000-0000-4000-8000-000000000001');
  replay_result := public.assign_cross_checker_v1(
    'a1610000-0000-4000-8000-000000000001', 'b1610000-0000-4000-8000-000000000001',
    'd1610000-0000-4000-8000-000000000002', 'e1610000-0000-4000-8000-000000000001');
  conflict_result := public.assign_cross_checker_v1(
    'a1610000-0000-4000-8000-000000000001', 'b1610000-0000-4000-8000-000000000001',
    'd1610000-0000-4000-8000-000000000003', 'e1610000-0000-4000-8000-000000000001');
  if first_result <> replay_result or first_result->>'status' <> 'cross_checker_assigned'
    or conflict_result->>'code' <> 'idempotency_conflict' then
    raise exception 'assignment replay contract failed';
  end if;

  already_result := public.assign_cross_checker_v1(
    'a1610000-0000-4000-8000-000000000001', 'b1610000-0000-4000-8000-000000000001',
    'd1610000-0000-4000-8000-000000000002', 'e1610000-0000-4000-8000-000000000006');
  if already_result->>'code' <> 'already_assigned' then
    raise exception 'already-assigned rejection failed';
  end if;

  workspace := public.get_cross_checker_assignment_workspace_v1('a1610000-0000-4000-8000-000000000001', 'b1610000-0000-4000-8000-000000000001');
  if jsonb_array_length(workspace->'assignments') <> 1
    or workspace->'assignments'->0->>'assignmentId' is null
    or jsonb_array_length(workspace->'candidates') <> 0 then
    raise exception 'assigned workspace projection failed';
  end if;

  if public.assign_cross_checker_v1('a1610000-0000-4000-8000-000000000001', 'b1610000-0000-4000-8000-000000000001', 'd1610000-0000-4000-8000-000000000001', 'e1610000-0000-4000-8000-000000000002')->>'code' <> 'self_assignment_forbidden'
    or public.assign_cross_checker_v1('a1610000-0000-4000-8000-000000000001', 'b1610000-0000-4000-8000-000000000001', 'd1610000-0000-4000-8000-000000000003', 'e1610000-0000-4000-8000-000000000003')->>'code' <> 'official_role_conflict'
    or public.assign_cross_checker_v1('a1610000-0000-4000-8000-000000000001', 'b1610000-0000-4000-8000-000000000001', 'd1610000-0000-4000-8000-000000000004', 'e1610000-0000-4000-8000-000000000004')->>'code' <> 'linked_account_required'
    or public.assign_cross_checker_v1('a1610000-0000-4000-8000-000000000004', 'b1610000-0000-4000-8000-000000000001', 'd1610000-0000-4000-8000-000000000002', 'e1610000-0000-4000-8000-000000000005')->>'code' <> 'not_director' then
    raise exception 'assignment rejection paths failed';
  end if;
end;
$$;

reset role;

do $$
begin
  if (select count(*) from app.tournament_roles where tournament_id='b1610000-0000-4000-8000-000000000001' and profile_id='a1610000-0000-4000-8000-000000000002' and role='cross_checker') <> 1
    or (select count(*) from app.operation_receipts where tournament_id='b1610000-0000-4000-8000-000000000001' and operation_type='assign_cross_checker_v1' and outcome='accepted') <> 1
    or (select count(*) from app.operation_receipts where tournament_id='b1610000-0000-4000-8000-000000000001' and operation_type='assign_cross_checker_v1' and outcome='rejected') <> 4
    or (select count(*) from app.cross_checker_assignment_events where tournament_id='b1610000-0000-4000-8000-000000000001') <> 1
    or (select count(*) from app.cross_checker_assignment_operation_conflicts where tournament_id='b1610000-0000-4000-8000-000000000001') <> 1
    or (select count(*) from app.audit_events where tournament_id='b1610000-0000-4000-8000-000000000001' and action='cross_checker_assigned') <> 1
    or (select count(*) from app.audit_events where tournament_id='b1610000-0000-4000-8000-000000000001' and action='cross_checker_assignment_rejected') <> 4 then
    raise exception 'assignment durable evidence is incomplete';
  end if;
  if has_function_privilege('authenticated', 'public.assign_cross_checker_v1(uuid,uuid,uuid,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.assign_cross_checker_v1(uuid,uuid,uuid,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.assign_cross_checker_v1(uuid,uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'assignment grants are unsafe';
  end if;
  begin
    update app.cross_checker_assignment_events set created_at=now();
    raise exception 'assignment event was mutable';
  exception when others then
    if sqlerrm <> 'immutable history' then raise; end if;
  end;
end;
$$;

set constraints all immediate;
rollback;
