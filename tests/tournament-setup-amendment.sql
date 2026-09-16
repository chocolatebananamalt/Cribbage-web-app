-- Rollback-only fixture for migration 0137. It retains no synthetic data.
begin;

create temporary table setup_amendment_results(label text primary key, result jsonb not null) on commit drop;
grant select, insert on setup_amendment_results to authenticated, service_role;

insert into auth.users(id,email) values
  ('a1370000-0000-4000-8000-000000000001','amend-director@test.invalid'),
  ('a1370000-0000-4000-8000-000000000002','amend-codirector@test.invalid'),
  ('a1370000-0000-4000-8000-000000000003','amend-outsider@test.invalid');
insert into app.tournaments(id,director_profile_id,name,status,registration_status)
values ('b1370000-0000-4000-8000-000000000001','a1370000-0000-4000-8000-000000000001','Amendment shell','draft','closed');
insert into app.tournament_roles(tournament_id,profile_id,role) values
  ('b1370000-0000-4000-8000-000000000001','a1370000-0000-4000-8000-000000000001','director'),
  ('b1370000-0000-4000-8000-000000000001','a1370000-0000-4000-8000-000000000002','co_director');

select set_config('request.jwt.claim.sub','a1370000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
insert into setup_amendment_results(label,result)
select 'setup_saved',public.save_tournament_setup_version(
  'b1370000-0000-4000-8000-000000000001',0,
  jsonb_build_object(
    'tournamentName','Synthetic October Tournament','city','Test City','venue','Test Venue',
    'startsAt','2026-10-03T09:00:00','endsAt','2026-10-03T22:00:00','timezone','Pacific/Honolulu',
    'tournamentContactPhone','+1 808 555 0101','tournamentContactEmail','amend-director@test.invalid',
    'tournamentMailingAddress','','sanctioningFeeCents',null,
    'officials',jsonb_build_array(jsonb_build_object('profileId','a1370000-0000-4000-8000-000000000001','role','director')),
    'events',jsonb_build_array(jsonb_build_object(
      'clientRowId','c1370000-0000-4000-8000-000000000001','eventKind','main','displayName','Main Event',
      'startsAt','2026-10-03T09:00:00','timezone','Pacific/Honolulu','styleCode','Standard',
      'formatCode','standard_singles','gameCount',22,'entryFeeCents',3000,'feeIncludesNote','',
      'payoutNote','','qualificationNote','','eligibilityNote','','mugginsStatus','unset','qPools',jsonb_build_array()
    ))
  ),'d1370000-0000-4000-8000-000000000001'
);
reset role;

-- `set local role service_role` controls PostgreSQL grants, while auth.role()
-- reads the request JWT claim. Model both halves of a real server-side RPC.
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
insert into setup_amendment_results(label,result)
select 'activated',public.activate_tournament_setup_v2(
  'a1370000-0000-4000-8000-000000000001','b1370000-0000-4000-8000-000000000001',
  (select (result->>'revisionId')::uuid from setup_amendment_results where label='setup_saved'),1,
  'd1370000-0000-4000-8000-000000000002'
);

create temporary table amendment_input(value jsonb not null) on commit drop;
insert into amendment_input values (jsonb_build_array(
  jsonb_build_object(
    'clientRowId','c1370000-0000-4000-8000-000000000002','eventKind','consolation','displayName','Consolation Event',
    'startsAt','2026-10-03T18:00:00','timezone','Pacific/Honolulu','styleCode','Consy Lite',
    'formatCode','standard_singles','gameCount',9,'entryFeeCents',1500,'feeIncludesNote','',
    'payoutNote','','qualificationNote','','eligibilityNote','','mugginsStatus','unset',
    'qPools',jsonb_build_array(jsonb_build_object('poolTypeCode','Graduated (1-in-6)','entryFeeCents',1000,'note',''))
  ),
  jsonb_build_object(
    'clientRowId','c1370000-0000-4000-8000-000000000003','eventKind','satellite','displayName','Canadian Doubles',
    'startsAt','2026-10-03T20:00:00','timezone','Pacific/Honolulu','styleCode','Canadian Doubles',
    'formatCode','canadian_doubles','gameCount',7,'entryFeeCents',1000,'feeIncludesNote','',
    'payoutNote','Top 4','qualificationNote','','eligibilityNote','','mugginsStatus','unset','qPools',jsonb_build_array()
  )
));

insert into setup_amendment_results(label,result)
select 'amended',public.append_tournament_setup_events_v1(
  'a1370000-0000-4000-8000-000000000001','b1370000-0000-4000-8000-000000000001',
  (select (result->>'revisionId')::uuid from setup_amendment_results where label='setup_saved'),1,
  (select value from amendment_input),'d1370000-0000-4000-8000-000000000003'
);
insert into setup_amendment_results(label,result)
select 'exact_replay',public.append_tournament_setup_events_v1(
  'a1370000-0000-4000-8000-000000000001','b1370000-0000-4000-8000-000000000001',
  (select (result->>'revisionId')::uuid from setup_amendment_results where label='setup_saved'),1,
  (select value from amendment_input),'d1370000-0000-4000-8000-000000000003'
);
insert into setup_amendment_results(label,result)
select 'changed_retry',public.append_tournament_setup_events_v1(
  'a1370000-0000-4000-8000-000000000001','b1370000-0000-4000-8000-000000000001',
  (select (result->>'setupRevisionId')::uuid from setup_amendment_results where label='amended'),2,
  jsonb_build_array((select value->0 from amendment_input)),'d1370000-0000-4000-8000-000000000003'
);
-- This models the losing side of two director requests serialized on the
-- tournament lock: its previously current revision is stale after the winner.
insert into setup_amendment_results(label,result)
select 'stale_competitor',public.append_tournament_setup_events_v1(
  'a1370000-0000-4000-8000-000000000002','b1370000-0000-4000-8000-000000000001',
  (select (result->>'revisionId')::uuid from setup_amendment_results where label='setup_saved'),1,
  jsonb_build_array(jsonb_build_object(
    'clientRowId','c1370000-0000-4000-8000-000000000004','eventKind','satellite','displayName','Late Satellite',
    'startsAt','2026-10-03T21:00:00','timezone','Pacific/Honolulu','styleCode','Standard',
    'formatCode','standard_singles','gameCount',7,'entryFeeCents',500,'feeIncludesNote','','payoutNote','1 in 4',
    'qualificationNote','','eligibilityNote','','mugginsStatus','unset','qPools',jsonb_build_array()
  )),'d1370000-0000-4000-8000-000000000004'
);
insert into setup_amendment_results(label,result)
select 'duplicate_event',public.append_tournament_setup_events_v1(
  'a1370000-0000-4000-8000-000000000001','b1370000-0000-4000-8000-000000000001',
  (select (result->>'setupRevisionId')::uuid from setup_amendment_results where label='amended'),2,
  jsonb_build_array(jsonb_build_object(
    'clientRowId','c1370000-0000-4000-8000-000000000005','eventKind','satellite','displayName','Main Event',
    'startsAt','2026-10-03T21:00:00','timezone','Pacific/Honolulu','styleCode','Standard',
    'formatCode','standard_singles','gameCount',7,'entryFeeCents',500,'feeIncludesNote','','payoutNote','1 in 4',
    'qualificationNote','','eligibilityNote','','mugginsStatus','unset','qPools',jsonb_build_array()
  )),'d1370000-0000-4000-8000-000000000005'
);
reset role;

select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ begin
  perform public.append_tournament_setup_events_v1(
    'a1370000-0000-4000-8000-000000000001','b1370000-0000-4000-8000-000000000001',
    (select (result->>'setupRevisionId')::uuid from setup_amendment_results where label='amended'),2,
    jsonb_build_array((select value->0 from amendment_input)),'d1370000-0000-4000-8000-000000000006');
  raise exception 'direct browser role was not denied';
exception when insufficient_privilege or sqlstate 'P0001' then
  if sqlerrm = 'direct browser role was not denied' then raise; end if;
end $$;
reset role;

do $$
declare accepted jsonb; replayed jsonb; state jsonb;
begin
  select result into accepted from setup_amendment_results where label='amended';
  select result into replayed from setup_amendment_results where label='exact_replay';
  if accepted->>'status' <> 'tournament_setup_amended' or accepted <> replayed then raise exception 'accepted amendment or exact replay failed'; end if;
  if (select result->>'code' from setup_amendment_results where label='changed_retry') <> 'idempotency_conflict' then raise exception 'changed retry was not rejected'; end if;
  if (select result->>'code' from setup_amendment_results where label='stale_competitor') <> 'stale_setup_revision' then raise exception 'serialized competing request was not stale'; end if;
  if (select result->>'code' from setup_amendment_results where label='duplicate_event') <> 'duplicate_event' then raise exception 'duplicate event was not rejected'; end if;
  if (select count(*) from app.tournament_setup_revisions where tournament_id='b1370000-0000-4000-8000-000000000001') <> 2
    or (select count(*) from app.tournament_setup_amendments where tournament_id='b1370000-0000-4000-8000-000000000001') <> 1
    or (select count(*) from app.events where tournament_id='b1370000-0000-4000-8000-000000000001') <> 3
    or (select count(*) from app.tournament_setup_activations where tournament_id='b1370000-0000-4000-8000-000000000001') <> 3 then
    raise exception 'append-only rows are incomplete or duplicated';
  end if;
  if exists(select 1 from app.events where tournament_id='b1370000-0000-4000-8000-000000000001' and ((format='standard_singles' and scoring_method<>'digital') or (format<>'standard_singles' and scoring_method<>'manual'))) then raise exception 'scoring methods are unsafe'; end if;
  select public.get_tournament_setup_activation_state_v3('a1370000-0000-4000-8000-000000000001','b1370000-0000-4000-8000-000000000001') into state;
  if state->>'status'<>'activated' or (state->>'setupVersion')::integer<>2 or (state->>'eventCount')::integer<>3 then raise exception 'activation projection did not include appended events'; end if;
  if has_function_privilege('anon','public.append_tournament_setup_events_v1(uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.append_tournament_setup_events_v1(uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.append_tournament_setup_events_v1(uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE') then raise exception 'function grants are invalid'; end if;
end $$;

rollback;
