-- Rollback-only proof for atomic, replay-safe director CSV roster import.
begin;

create temporary table roster_csv_results(label text primary key, result jsonb not null) on commit drop;
grant select, insert on roster_csv_results to authenticated;

insert into auth.users(id, email)
values ('a1300000-0000-4000-8000-000000000001', 'csv-director@test.invalid');
insert into app.tournaments(id, director_profile_id, name, status, registration_status)
values ('b1300000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', 'Synthetic CSV import', 'open', 'open');
insert into app.tournament_roles(tournament_id, profile_id, role)
values ('b1300000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', 'director');

select set_config('request.jwt.claim.sub', 'a1300000-0000-4000-8000-000000000001', true);
set local role authenticated;
insert into roster_csv_results(label, result)
select 'created', public.import_roster_csv_v1(
  'b1300000-0000-4000-8000-000000000001',
  '[{"displayName":"CSV Player One","email":"one@test.invalid","accNumber":"T-1"},{"displayName":"CSV Player Two","email":"","accNumber":""}]'::jsonb,
  'c1300000-0000-4000-8000-000000000001'
);
insert into roster_csv_results(label, result)
select 'replay', public.import_roster_csv_v1(
  'b1300000-0000-4000-8000-000000000001',
  '[{"displayName":"CSV Player One","email":"one@test.invalid","accNumber":"T-1"},{"displayName":"CSV Player Two","email":"","accNumber":""}]'::jsonb,
  'c1300000-0000-4000-8000-000000000001'
);
insert into roster_csv_results(label, result)
select 'duplicate_existing', public.import_roster_csv_v1(
  'b1300000-0000-4000-8000-000000000001',
  '[{"displayName":"CSV Player One","email":"one@test.invalid","accNumber":"T-1"},{"displayName":"New Player","email":"","accNumber":""}]'::jsonb,
  'c1300000-0000-4000-8000-000000000002'
);
insert into roster_csv_results(label, result)
select 'duplicate_batch', public.import_roster_csv_v1(
  'b1300000-0000-4000-8000-000000000001',
  '[{"displayName":"Same Player","email":"","accNumber":""},{"displayName":" same  player ","email":"","accNumber":""}]'::jsonb,
  'c1300000-0000-4000-8000-000000000003'
);
insert into roster_csv_results(label, result)
select 'duplicate_acc', public.import_roster_csv_v1(
  'b1300000-0000-4000-8000-000000000001',
  '[{"displayName":"Different Name","email":"","accNumber":" t-1 "}]'::jsonb,
  'c1300000-0000-4000-8000-000000000004'
);
reset role;

do $$
declare v_created jsonb;
begin
  select result into v_created from roster_csv_results where label='created';
  if v_created <> '{"status":"roster_csv_imported","importedCount":2}'::jsonb
     or (select result from roster_csv_results where label='replay') <> v_created then
    raise exception 'CSV import or exact replay failed';
  end if;
  if (select result->>'code' from roster_csv_results where label='duplicate_existing') <> 'duplicate_roster_entry'
     or (select result->>'code' from roster_csv_results where label='duplicate_batch') <> 'duplicate_in_batch' then
    raise exception 'CSV duplicate rejection failed';
  end if;
  if (select result->>'code' from roster_csv_results where label='duplicate_acc') <> 'duplicate_roster_entry' then
    raise exception 'CSV stable identity duplicate rejection failed';
  end if;
  if (select count(*) from app.tournament_roster_entries where tournament_id='b1300000-0000-4000-8000-000000000001') <> 2
     or (select count(*) from app.tournament_roster_entries where tournament_id='b1300000-0000-4000-8000-000000000001' and source_kind='director_csv') <> 2 then
    raise exception 'CSV batch was not atomic';
  end if;
  if (select count(*) from app.operation_receipts where tournament_id='b1300000-0000-4000-8000-000000000001' and operation_type='import_roster_csv_v1' and outcome='accepted') <> 1
     or (select count(*) from app.audit_events where tournament_id='b1300000-0000-4000-8000-000000000001' and action='roster_csv_imported') <> 1 then
    raise exception 'CSV receipt/audit evidence missing';
  end if;
  if has_function_privilege('anon','public.import_roster_csv_v1(uuid,jsonb,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.import_roster_csv_v1(uuid,jsonb,uuid)','EXECUTE') then
    raise exception 'CSV import grants invalid';
  end if;
end;
$$;

rollback;
