-- Rollback-only proof for platform director approval and tournament creation.
-- Every identity and tournament is fictional.
begin;

insert into auth.users(id,email) values
  ('a1630000-0000-4000-8000-000000000001','admin163-owner@test.invalid'),
  ('a1630000-0000-4000-8000-000000000002','admin163-acc-admin@test.invalid'),
  ('a1630000-0000-4000-8000-000000000003','admin163-applicant@test.invalid'),
  ('a1630000-0000-4000-8000-000000000004','admin163-outsider@test.invalid'),
  ('a1630000-0000-4000-8000-000000000005','admin163-verified-applicant@test.invalid');

update app.profiles set display_name=case id
  when 'a1630000-0000-4000-8000-000000000001' then 'Fixture Owner'
  when 'a1630000-0000-4000-8000-000000000002' then 'Fixture ACC Admin'
  when 'a1630000-0000-4000-8000-000000000003' then 'Fixture Applicant'
  when 'a1630000-0000-4000-8000-000000000004' then 'Fixture Outsider'
  else 'Fixture Verified Applicant' end
where id::text like 'a163%';

insert into app.platform_administrators(profile_id,administrator_type) values
  ('a1630000-0000-4000-8000-000000000001','app_owner'),
  ('a1630000-0000-4000-8000-000000000002','acc_administrator');

select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;

do $$
declare application_result jsonb; application_id uuid; review_result jsonb;
  first_create jsonb; replay_create jsonb; second_create jsonb; workspace jsonb;
  verified_application jsonb; verified_application_id uuid; status_result jsonb;
begin
  workspace := public.get_director_access_workspace_v1('a1630000-0000-4000-8000-000000000003');
  if workspace->>'canCreateTournament' <> 'false' or workspace->>'isPlatformAdmin' <> 'false'
    or workspace->>'accVerified' <> 'false' then raise exception 'unapproved access projection failed'; end if;

  application_result := public.submit_director_application_v1(
    'a1630000-0000-4000-8000-000000000003','e1630000-0000-4000-8000-000000000001');
  if application_result->>'status' <> 'application_submitted' then raise exception 'application submission failed'; end if;
  application_id := (application_result->>'applicationId')::uuid;
  if public.submit_director_application_v1(
    'a1630000-0000-4000-8000-000000000003','e1630000-0000-4000-8000-000000000001') <> application_result
    then raise exception 'application replay failed'; end if;

  if public.review_director_application_v1(
    'a1630000-0000-4000-8000-000000000003',application_id,'approve',false,'Self review',
    'e1630000-0000-4000-8000-000000000002')->>'code' <> 'not_platform_admin'
    then raise exception 'non-admin review was accepted'; end if;
  if public.review_director_application_v1(
    'a1630000-0000-4000-8000-000000000001',application_id,'approve',true,'ACC verified',
    'e1630000-0000-4000-8000-000000000003')->>'code' <> 'acc_verification_requires_acc_admin'
    then raise exception 'owner incorrectly granted ACC verification'; end if;

  review_result := public.review_director_application_v1(
    'a1630000-0000-4000-8000-000000000001',application_id,'approve',false,'Approved for app use',
    'e1630000-0000-4000-8000-000000000004');
  if review_result->>'status' <> 'application_reviewed' or review_result->>'decision' <> 'approve'
    then raise exception 'owner approval failed'; end if;
  if public.review_director_application_v1(
    'a1630000-0000-4000-8000-000000000001',application_id,'approve',false,'Approved for app use',
    'e1630000-0000-4000-8000-000000000004') <> review_result
    then raise exception 'review replay failed'; end if;

  if public.create_tournament_draft_v1(
    'a1630000-0000-4000-8000-000000000004','Unauthorized Tournament','2026-09-16',
    'e1630000-0000-4000-8000-000000000005')->>'code' <> 'director_approval_required'
    then raise exception 'unapproved tournament creation was accepted'; end if;

  first_create := public.create_tournament_draft_v1(
    'a1630000-0000-4000-8000-000000000003','Full Rehearsal — Fixture','2026-09-16',
    'e1630000-0000-4000-8000-000000000006');
  replay_create := public.create_tournament_draft_v1(
    'a1630000-0000-4000-8000-000000000003','Full Rehearsal — Fixture','2026-09-16',
    'e1630000-0000-4000-8000-000000000006');
  if first_create->>'status' <> 'tournament_created' or replay_create <> first_create
    then raise exception 'tournament creation or replay failed'; end if;
  if public.create_tournament_draft_v1(
    'a1630000-0000-4000-8000-000000000003','Full Rehearsal — Fixture','2026-09-16',
    'e1630000-0000-4000-8000-000000000007')->>'code' <> 'duplicate_tournament'
    then raise exception 'duplicate tournament was accepted'; end if;

  workspace := public.list_actor_tournament_workspaces_v1('a1630000-0000-4000-8000-000000000003');
  if jsonb_array_length(workspace) <> 1 or workspace->0->>'tournamentName' <> 'Full Rehearsal — Fixture'
    or workspace->0->>'tournamentDate' <> '09-16-2026' or workspace->0->>'effectiveRole' <> 'director'
    then raise exception 'created tournament chooser projection failed'; end if;

  status_result := public.set_director_authorization_status_v1(
    'a1630000-0000-4000-8000-000000000001','a1630000-0000-4000-8000-000000000003','suspended',
    'Rehearsal suspension test','e1630000-0000-4000-8000-000000000008');
  if status_result->>'directorStatus' <> 'suspended' then raise exception 'suspension failed'; end if;
  if public.create_tournament_draft_v1(
    'a1630000-0000-4000-8000-000000000003','Blocked While Suspended','2026-09-17',
    'e1630000-0000-4000-8000-000000000009')->>'code' <> 'director_approval_required'
    then raise exception 'suspended director created a tournament'; end if;
  if public.set_director_authorization_status_v1(
    'a1630000-0000-4000-8000-000000000001','a1630000-0000-4000-8000-000000000003','approved',
    'Rehearsal restore test','e1630000-0000-4000-8000-000000000010')->>'directorStatus' <> 'approved'
    then raise exception 'restoration failed'; end if;

  verified_application := public.submit_director_application_v1(
    'a1630000-0000-4000-8000-000000000005','e1630000-0000-4000-8000-000000000011');
  verified_application_id := (verified_application->>'applicationId')::uuid;
  if public.review_director_application_v1(
    'a1630000-0000-4000-8000-000000000002',verified_application_id,'approve',true,
    'ACC fixture verification','e1630000-0000-4000-8000-000000000012')->>'accVerified' <> 'true'
    then raise exception 'ACC administrator verification failed'; end if;

  workspace := public.get_platform_director_admin_workspace_v1('a1630000-0000-4000-8000-000000000001');
  if workspace->>'administratorType' <> 'app_owner'
    or jsonb_array_length(workspace->'applications') <> 2
    or jsonb_array_length(workspace->'authorizations') <> 2
    or workspace::text like '%@test.invalid%' then raise exception 'admin workspace scope failed'; end if;
  if public.get_platform_director_admin_workspace_v1('a1630000-0000-4000-8000-000000000004') is not null
    then raise exception 'outsider received admin workspace'; end if;
end;
$$;

reset role;

do $$
begin
  if (select count(*) from app.tournaments where name='Full Rehearsal — Fixture') <> 1
    or (select count(*) from app.tournament_roles role join app.tournaments tournament on tournament.id=role.tournament_id
      where tournament.name='Full Rehearsal — Fixture' and role.role='director'
        and role.profile_id='a1630000-0000-4000-8000-000000000003') <> 1
    or (select count(*) from app.audit_events audit join app.tournaments tournament on tournament.id=audit.tournament_id
      where tournament.name='Full Rehearsal — Fixture' and audit.action='tournament_draft_created') <> 1
    or (select count(*) from app.platform_audit_events) < 6
    or (select count(*) from app.platform_operation_receipts where outcome='accepted') < 6
    then raise exception 'durable administration evidence is incomplete'; end if;
  if has_function_privilege('authenticated','public.create_tournament_draft_v1(uuid,text,date,uuid)','EXECUTE')
    or has_function_privilege('anon','public.review_director_application_v1(uuid,uuid,text,boolean,text,uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.create_tournament_draft_v1(uuid,text,date,uuid)','EXECUTE')
    then raise exception 'platform function grants are unsafe'; end if;
  begin
    update app.platform_audit_events set created_at=now();
    raise exception 'platform audit was mutable';
  exception when others then if sqlerrm <> 'immutable history' then raise; end if; end;
end;
$$;

set constraints all immediate;
rollback;
