do $$declare a uuid:='a2740000-0000-4000-8000-000000000001';t uuid:='b2740000-0000-4000-8000-000000000001';e uuid:='a2740000-0000-4000-8000-000000000011';r jsonb;begin
 r:=public.activate_multi_event_finance_v1(a,t,'simulation','d2740000-0000-4000-8000-000000000041');
 if r->>'status'<>'multi_event_finance_activated' then raise exception 'mode %',r;end if;
 r:=public.get_simulated_finance_selector_workspace_v1(a,t,e);
 if r->>'status'<>'blocked' or r->>'code'<>'joint_final_status_unavailable' then raise exception 'missing closure capability not blocked %',r;end if;
end$$;
rollback;
