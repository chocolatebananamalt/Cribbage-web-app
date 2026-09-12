-- Rollback-only integration fixture for migration 0128. Execute the migration
-- and this fixture on an isolated synthetic backend; no rows survive ROLLBACK.

begin;

create temporary table expense_test_results (
  label text primary key,
  result jsonb not null
) on commit drop;
grant select, insert, update on expense_test_results to authenticated;

insert into auth.users(id, email) values
  ('a1280000-0000-4000-8000-000000000001', 'expense-director@test.invalid'),
  ('a1280000-0000-4000-8000-000000000002', 'expense-co-director@test.invalid'),
  ('a1280000-0000-4000-8000-000000000003', 'expense-viewer@test.invalid'),
  ('a1280000-0000-4000-8000-000000000004', 'expense-other-director@test.invalid');

insert into app.tournaments(id, director_profile_id, name, status, registration_status) values
  ('b1280000-0000-4000-8000-000000000001', 'a1280000-0000-4000-8000-000000000001', 'Synthetic Expense Pilot', 'open', 'closed'),
  ('b1280000-0000-4000-8000-000000000002', 'a1280000-0000-4000-8000-000000000004', 'Other Synthetic Pilot', 'open', 'closed');

insert into app.tournament_roles(tournament_id, profile_id, role) values
  ('b1280000-0000-4000-8000-000000000001', 'a1280000-0000-4000-8000-000000000001', 'director'),
  ('b1280000-0000-4000-8000-000000000001', 'a1280000-0000-4000-8000-000000000002', 'co_director'),
  ('b1280000-0000-4000-8000-000000000001', 'a1280000-0000-4000-8000-000000000003', 'viewer'),
  ('b1280000-0000-4000-8000-000000000002', 'a1280000-0000-4000-8000-000000000004', 'director');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1280000-0000-4000-8000-000000000001', true);

insert into expense_test_results(label, result)
select 'record', public.record_tournament_expense(
  'b1280000-0000-4000-8000-000000000001', 1250, 'USD',
  'Venue supplies', 'd1280000-0000-4000-8000-000000000001'
);
reset role;

do $$
declare v_result jsonb;
begin
  select result into v_result from expense_test_results where label = 'record';
  if v_result->>'status' <> 'expense_recorded'
     or (v_result->>'amountMinor')::integer <> 1250
     or (v_result->>'expenseVersion')::integer <> 1
     or (v_result->>'reconciled')::boolean then
    raise exception 'expense record result was invalid';
  end if;
end;
$$;

set local role authenticated;
insert into expense_test_results(label, result)
select 'exact-replay', public.record_tournament_expense(
  'b1280000-0000-4000-8000-000000000001', 1250, 'USD',
  'Venue supplies', 'd1280000-0000-4000-8000-000000000001'
);
reset role;

do $$
begin
  if (select result from expense_test_results where label = 'record')
       <> (select result from expense_test_results where label = 'exact-replay')
     or (select count(*) from app.tournament_expense_events) <> 1 then
    raise exception 'exact replay created a duplicate expense';
  end if;
end;
$$;

set local role authenticated;
insert into expense_test_results(label, result)
select 'changed-replay', public.record_tournament_expense(
  'b1280000-0000-4000-8000-000000000001', 1300, 'USD',
  'Changed amount', 'd1280000-0000-4000-8000-000000000001'
);
reset role;

do $$
begin
  if (select result->>'code' from expense_test_results where label = 'changed-replay')
       <> 'idempotency_conflict'
     or (select count(*) from app.tournament_expense_operation_conflicts) <> 1
     or (select count(*) from app.tournament_expense_events) <> 1 then
    raise exception 'changed replay was not rejected';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'a1280000-0000-4000-8000-000000000003', true);
set local role authenticated;
insert into expense_test_results(label, result)
select 'viewer-denied', public.record_tournament_expense(
  'b1280000-0000-4000-8000-000000000001', 500, 'USD',
  'Unauthorized expense', 'd1280000-0000-4000-8000-000000000002'
);
reset role;

do $$
begin
  if (select result->>'code' from expense_test_results where label = 'viewer-denied') <> 'not_director'
     or (select count(*) from app.tournament_expense_events) <> 1 then
    raise exception 'viewer recorded an expense';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'a1280000-0000-4000-8000-000000000002', true);
set local role authenticated;
insert into expense_test_results(label, result)
select 'co-director-record', public.record_tournament_expense(
  'b1280000-0000-4000-8000-000000000001', 800, 'USD',
  'Printing', 'd1280000-0000-4000-8000-000000000003'
);
reset role;

delete from app.tournament_roles
where tournament_id = 'b1280000-0000-4000-8000-000000000001'
  and profile_id = 'a1280000-0000-4000-8000-000000000002'
  and role = 'co_director';

select set_config('request.jwt.claim.sub', 'a1280000-0000-4000-8000-000000000001', true);
set local role authenticated;
insert into expense_test_results(label, result)
select 'void', public.void_tournament_expense(
  'b1280000-0000-4000-8000-000000000001',
  (select (result->>'expenseId')::uuid from expense_test_results where label = 'record'),
  1,
  (select (result->>'expenseEventId')::uuid from expense_test_results where label = 'record'),
  'Entered twice', 'd1280000-0000-4000-8000-000000000004'
);
reset role;

set local role authenticated;
insert into expense_test_results(label, result)
select 'void-after-recorder-role-removed', public.void_tournament_expense(
  'b1280000-0000-4000-8000-000000000001',
  (select (result->>'expenseId')::uuid from expense_test_results where label = 'co-director-record'),
  1,
  (select (result->>'expenseEventId')::uuid from expense_test_results where label = 'co-director-record'),
  'Expense cancelled', 'd1280000-0000-4000-8000-000000000005'
);
reset role;

do $$
declare v_record jsonb; v_void jsonb;
begin
  select result into v_record from expense_test_results where label = 'record';
  select result into v_void from expense_test_results where label = 'void';
  if v_void->>'status' <> 'expense_voided'
     or v_void->>'expenseId' <> v_record->>'expenseId'
     or v_void->>'voidedExpenseEventId' <> v_record->>'expenseEventId'
     or (v_void->>'expenseVersion')::integer <> 2
     or (select count(*) from app.tournament_expense_events
         where expense_id = (v_record->>'expenseId')::uuid) <> 2 then
    raise exception 'expense void did not preserve the original';
  end if;
end;
$$;

set local role authenticated;
insert into expense_test_results(label, result)
select 'void-replay', public.void_tournament_expense(
  'b1280000-0000-4000-8000-000000000001',
  (select (result->>'expenseId')::uuid from expense_test_results where label = 'record'),
  1,
  (select (result->>'expenseEventId')::uuid from expense_test_results where label = 'record'),
  'Entered twice', 'd1280000-0000-4000-8000-000000000004'
);
reset role;

set local role authenticated;
do $$
declare v_workspace jsonb;
begin
  if (select result from expense_test_results where label = 'void')
       <> (select result from expense_test_results where label = 'void-replay') then
    raise exception 'expense void replay was not exact';
  end if;
  v_workspace := public.get_tournament_expense_workspace(
    'b1280000-0000-4000-8000-000000000001'
  );
  if (v_workspace->>'activeExpenseTotalMinor')::integer <> 0
     or jsonb_array_length(v_workspace->'expenses') <> 2
     or (v_workspace->>'reconciled')::boolean then
    raise exception 'expense workspace did not derive active ledger totals';
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'a1280000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$
begin
  if public.get_tournament_expense_workspace(
    'b1280000-0000-4000-8000-000000000001'
  ) is not null then
    raise exception 'viewer read private expenses';
  end if;
end;
$$;
reset role;

set local role authenticated;
do $$
begin
  begin
    perform count(*) from app.tournament_expense_events;
    raise exception 'authenticated role read private expense rows';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
do $$
begin
  begin
    update app.tournament_expense_events set description = 'Changed';
    raise exception 'expense history was mutable';
  exception when others then
    if sqlerrm = 'expense history was mutable' then raise; end if;
  end;
end;
$$;

do $$
begin
  if (select count(*) from app.audit_events
      where entity_type = 'tournament_expense'
        and action in ('tournament_expense_recorded', 'tournament_expense_voided')) <> 4 then
    raise exception 'expense audit history was incomplete';
  end if;
end;
$$;

rollback;
