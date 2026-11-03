do $$declare w jsonb;begin
 w:=public.get_simulated_finance_selector_workspace_v1('a2740000-0000-4000-8000-000000000001','b2740000-0000-4000-8000-000000000001','a2740000-0000-4000-8000-000000000011');
 if w->>'status'<>'available' or w->>'anyReceiptRecorded'<>'true' or w->>'eventStarted'<>'false'
 or not exists(select 1 from jsonb_array_elements(w->'participants') p where p->>'participantId'='a5740000-0000-4000-8000-000000000001' and p->>'receiptRecorded'='true') then raise exception 'collection state %',w;end if;
end$$;
rollback;
