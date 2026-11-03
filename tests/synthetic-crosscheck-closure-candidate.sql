begin;
do $$declare r jsonb;begin
 r:=public.close_synthetic_event_crosscheck_v1(null,null,null,null,null);
 if r->>'status'<>'rejected' or r->>'code'<>'structured_crosscheck_verification_pending' or r->>'humanReviewClaimed'<>'false' or r->>'moneyMoved'<>'false' then raise exception 'unfinished closure exposed %',r;end if;
 if has_function_privilege('authenticated','public.close_synthetic_event_crosscheck_v1(uuid,uuid,uuid,jsonb,uuid)','execute') or has_function_privilege('service_role','app.close_synthetic_event_crosscheck_candidate_v1(uuid,uuid,uuid,jsonb,uuid)','execute') then raise exception 'closure privileges exposed';end if;
 if not exists(select 1 from pg_class where oid='app.synthetic_event_crosscheck_closures_v1'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'forced RLS missing';end if;
 if exists(select 1 from app.tournaments where id='b2740000-0000-4000-8000-000000000001') and app.close_synthetic_event_crosscheck_candidate_v1('a2740000-0000-4000-8000-000000000001','b2740000-0000-4000-8000-000000000001','a2740000-0000-4000-8000-000000000011','{}','d2850000-0000-4000-8000-000000000001')->>'code'<>'invalid_request' then raise exception 'candidate invalid request not blocked';end if;
end$$;
rollback;
