-- Continues the synthetic classified-expense fixture in its transaction.
do $$declare a uuid:='a2740000-0000-4000-8000-000000000001';t uuid:='b2740000-0000-4000-8000-000000000001';e uuid:='a2740000-0000-4000-8000-000000000011';r jsonb;begin
 r:=public.get_multi_event_award_preview_v1(a,t,e);
 if r->>'status'<>'blocked' or r->>'code'<>'financial_source_blocked' or r->>'moneyMoved'<>'false' then raise exception 'stale source was not blocked %',r;end if;
 if public.get_multi_event_award_preview_v1('a2740000-0000-4000-8000-000000000002',t,e) is not null then raise exception 'unauthorized actor received preview';end if;
 if has_function_privilege('authenticated','public.get_multi_event_award_preview_v1(uuid,uuid,uuid)','execute') then raise exception 'browser can execute award preview directly';end if;
end$$;
rollback;
