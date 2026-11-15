-- Candidate is private and must not imply an actual cross-check closure.
begin;
insert into auth.users(id,email)values('a2840000-0000-4000-8000-000000000001','crosscheck-candidate@test.invalid');
insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('b2840000-0000-4000-8000-000000000001','a2840000-0000-4000-8000-000000000001','TEST ONLY cross-check candidate','draft','open');
insert into app.tournament_roles(tournament_id,profile_id,role)values('b2840000-0000-4000-8000-000000000001','a2840000-0000-4000-8000-000000000001','director');
do $$begin
 if has_function_privilege('service_role','app.synthetic_event_crosscheck_readiness_candidate_v1(uuid,uuid,uuid)','execute') or has_function_privilege('authenticated','app.synthetic_event_crosscheck_readiness_candidate_v1(uuid,uuid,uuid)','execute') then raise exception 'cross-check candidate exposed';end if;
 if app.synthetic_event_crosscheck_readiness_candidate_v1(null,null,null) is not null then raise exception 'unauthorized actor received readiness';end if;
 if app.synthetic_event_crosscheck_readiness_candidate_v1('a2840000-0000-4000-8000-000000000001','b2840000-0000-4000-8000-000000000001','c2840000-0000-4000-8000-000000000001')->>'code'<>'tournament_unavailable' then raise exception 'draft tournament was not blocked';end if;
end$$;
rollback;
