-- The candidate must remain unreachable until the structured preview is proven.
begin;
do $$declare r jsonb;begin
 r:=public.save_multi_event_unpaid_draft_v1(null,null,null,null,null);
 if r->>'status'<>'rejected' or r->>'code'<>'structured_preview_verification_pending' or r->>'moneyMoved'<>'false' then raise exception 'unfinished draft exposed %',r;end if;
 if has_function_privilege('authenticated','public.save_multi_event_unpaid_draft_v1(uuid,uuid,uuid,jsonb,uuid)','execute') or has_function_privilege('service_role','app.write_multi_event_unpaid_draft_candidate_v1(uuid,uuid,uuid,jsonb,uuid)','execute') then raise exception 'candidate privileges exposed';end if;
 if not exists(select 1 from pg_class where oid='app.multi_event_unpaid_drafts_v1'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'forced RLS missing';end if;
end$$;
rollback;
