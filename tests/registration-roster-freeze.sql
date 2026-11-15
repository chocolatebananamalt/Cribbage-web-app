-- Rollback-only proof that registration closure freezes new roster identities
-- while preserving an accepted request's exact idempotent replay.

begin;

create temporary table roster_freeze_results(
  label text primary key,
  result jsonb not null
) on commit drop;
grant select, insert on roster_freeze_results to authenticated;

insert into auth.users(id, email)
values ('a1240000-0000-4000-8000-000000000001', 'roster-freeze-director@test.invalid');

insert into app.tournaments(id, director_profile_id, name, status, registration_status)
values (
  'b1240000-0000-4000-8000-000000000001',
  'a1240000-0000-4000-8000-000000000001',
  'Synthetic roster freeze', 'open', 'open'
);

insert into app.tournament_roles(tournament_id, profile_id, role)
values (
  'b1240000-0000-4000-8000-000000000001',
  'a1240000-0000-4000-8000-000000000001',
  'director'
);

select set_config('request.jwt.claim.sub', 'a1240000-0000-4000-8000-000000000001', true);
set local role authenticated;

insert into roster_freeze_results(label, result)
select 'created', public.create_manual_roster_entry_v1(
  'b1240000-0000-4000-8000-000000000001',
  'Synthetic Paper Player', null, 'TEST-124',
  'c1240000-0000-4000-8000-000000000001'
);

reset role;
update app.tournaments set registration_status = 'closed'
where id = 'b1240000-0000-4000-8000-000000000001';

set local role authenticated;
insert into roster_freeze_results(label, result)
select 'exact_replay', public.create_manual_roster_entry_v1(
  'b1240000-0000-4000-8000-000000000001',
  'Synthetic Paper Player', null, 'TEST-124',
  'c1240000-0000-4000-8000-000000000001'
);
insert into roster_freeze_results(label, result)
select 'new_after_close', public.create_manual_roster_entry_v1(
  'b1240000-0000-4000-8000-000000000001',
  'Late Synthetic Player', null, 'TEST-125',
  'c1240000-0000-4000-8000-000000000002'
);
reset role;

do $$
declare
  v_created jsonb;
  v_replay jsonb;
  v_closed jsonb;
begin
  select result into v_created from roster_freeze_results where label = 'created';
  select result into v_replay from roster_freeze_results where label = 'exact_replay';
  select result into v_closed from roster_freeze_results where label = 'new_after_close';

  if v_created->>'status' <> 'manual_roster_entry_created'
     or v_replay <> v_created then
    raise exception 'accepted roster request did not replay exactly after closure';
  end if;
  if v_closed->>'status' <> 'rejected'
     or v_closed->>'code' <> 'manual_roster_entry_rejected' then
    raise exception 'new roster request was not rejected after closure';
  end if;
  if (select count(*) from app.tournament_roster_entries
      where tournament_id = 'b1240000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'registration closure did not preserve the exact roster boundary';
  end if;
end;
$$;

rollback;
