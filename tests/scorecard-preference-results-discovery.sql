-- Rollback-only proof for explicit scorecard preference and results discovery.
begin;

insert into auth.users(id,email) values
 ('a1460000-0000-4000-8000-000000000001','director-146@test.invalid'),
 ('a1460000-0000-4000-8000-000000000002','viewer-146@test.invalid');
insert into app.tournaments(id,director_profile_id,name,status,registration_status)
values('b1460000-0000-4000-8000-000000000001','a1460000-0000-4000-8000-000000000001','October preference proof','open','open');
insert into app.tournament_roles(tournament_id,profile_id,role) values
 ('b1460000-0000-4000-8000-000000000001','a1460000-0000-4000-8000-000000000001','director'),
 ('b1460000-0000-4000-8000-000000000001','a1460000-0000-4000-8000-000000000002','viewer');

set local role service_role;
create temporary table preference_results(label text primary key,result jsonb) on commit drop;
insert into preference_results values('created',public.create_manual_roster_entry_v2(
 'a1460000-0000-4000-8000-000000000001','b1460000-0000-4000-8000-000000000001','Paper Player','','','paper','c1460000-0000-4000-8000-000000000001'));
insert into preference_results
select 'updated',public.set_roster_scorecard_preference_v1('a1460000-0000-4000-8000-000000000001','b1460000-0000-4000-8000-000000000001',(result->>'rosterEntryId')::uuid,1,'digital','Player changed preference','c1460000-0000-4000-8000-000000000002') from preference_results where label='created';
insert into preference_results
select 'updated_replay',public.set_roster_scorecard_preference_v1('a1460000-0000-4000-8000-000000000001','b1460000-0000-4000-8000-000000000001',(result->>'rosterEntryId')::uuid,1,'digital','Player changed preference','c1460000-0000-4000-8000-000000000002') from preference_results where label='created';
insert into preference_results
select 'updated_conflict',public.set_roster_scorecard_preference_v1('a1460000-0000-4000-8000-000000000001','b1460000-0000-4000-8000-000000000001',(result->>'rosterEntryId')::uuid,1,'paper','Changed reuse','c1460000-0000-4000-8000-000000000002') from preference_results where label='created';
insert into preference_results
select 'unauthorized_update',public.set_roster_scorecard_preference_v1('a1460000-0000-4000-8000-000000000002','b1460000-0000-4000-8000-000000000001',(result->>'rosterEntryId')::uuid,2,'paper','','c1460000-0000-4000-8000-000000000003') from preference_results where label='created';
insert into preference_results values('viewer_results',public.get_tournament_result_events_v1('a1460000-0000-4000-8000-000000000002','b1460000-0000-4000-8000-000000000001'));
insert into preference_results values('outsider_results',public.get_tournament_result_events_v1('a1460000-0000-4000-8000-000000000099','b1460000-0000-4000-8000-000000000001'));
insert into preference_results values('csv_created',public.import_roster_csv_v2(
 'a1460000-0000-4000-8000-000000000001','b1460000-0000-4000-8000-000000000001',
 '[{"displayName":"CSV Paper Player","email":"","accNumber":"","scorecardType":"paper"}]'::jsonb,
 'c1460000-0000-4000-8000-000000000004'));
insert into preference_results values('csv_replay',public.import_roster_csv_v2(
 'a1460000-0000-4000-8000-000000000001','b1460000-0000-4000-8000-000000000001',
 '[{"displayName":"CSV Paper Player","email":"","accNumber":"","scorecardType":"paper"}]'::jsonb,
 'c1460000-0000-4000-8000-000000000004'));
insert into preference_results values('csv_conflict',public.import_roster_csv_v2(
 'a1460000-0000-4000-8000-000000000001','b1460000-0000-4000-8000-000000000001',
 '[{"displayName":"Changed CSV Player","email":"","accNumber":"","scorecardType":"paper"}]'::jsonb,
 'c1460000-0000-4000-8000-000000000004'));
reset role;

update app.tournaments set registration_status='closed' where id='b1460000-0000-4000-8000-000000000001';
set local role service_role;
insert into preference_results
select 'closed_update',public.set_roster_scorecard_preference_v1('a1460000-0000-4000-8000-000000000001','b1460000-0000-4000-8000-000000000001',(result->>'rosterEntryId')::uuid,2,'paper','','c1460000-0000-4000-8000-000000000005') from preference_results where label='created';
reset role;

do $$ declare v_entry uuid;
begin
 select (result->>'rosterEntryId')::uuid into v_entry from preference_results where label='created';
 if (select scorecard_type from app.tournament_roster_entries where id=v_entry)<>'digital'
   or (select scorecard_preference_version from app.tournament_roster_entries where id=v_entry)<>2
   or (select count(*) from app.roster_scorecard_preference_events where roster_entry_id=v_entry)<>2 then raise exception 'versioned preference history failed';end if;
 if (select result->>'scorecardType' from preference_results where label='updated')<>'digital' then raise exception 'preference response failed';end if;
 if (select result from preference_results where label='updated_replay')<>(select result from preference_results where label='updated') then raise exception 'exact preference retry changed its response';end if;
 if (select result->>'code' from preference_results where label='updated_conflict')<>'idempotency_conflict' then raise exception 'changed preference retry was not rejected';end if;
 if (select result->>'code' from preference_results where label='unauthorized_update')<>'not_director' then raise exception 'unauthorized preference update was not rejected';end if;
 if (select result->>'code' from preference_results where label='closed_update')<>'registration_closed' then raise exception 'closed registration preference update was not rejected';end if;
 if (select result->>'tournamentName' from preference_results where label='viewer_results')<>'October preference proof' then raise exception 'viewer event discovery failed';end if;
 if (select result from preference_results where label='outsider_results') is not null then raise exception 'unauthorized result discovery was exposed';end if;
 if (select result from preference_results where label='csv_replay')<>(select result from preference_results where label='csv_created') then raise exception 'exact CSV retry changed its response';end if;
 if (select result->>'code' from preference_results where label='csv_conflict')<>'idempotency_conflict' then raise exception 'changed CSV retry was not rejected';end if;
 if not exists(select 1 from app.tournament_roster_entries where tournament_id='b1460000-0000-4000-8000-000000000001' and claimed_display_name='CSV Paper Player' and scorecard_type='paper') then raise exception 'CSV scorecard preference was not stored';end if;
 if has_function_privilege('authenticated','public.set_roster_scorecard_preference_v1(uuid,uuid,uuid,integer,text,text,uuid)','EXECUTE')
   or not has_function_privilege('service_role','public.get_tournament_result_events_v1(uuid,uuid)','EXECUTE') then raise exception 'service-only grants failed';end if;
end $$;

rollback;
