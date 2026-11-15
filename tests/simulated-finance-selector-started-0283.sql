do $$declare w jsonb;begin
 w:=public.get_simulated_finance_selector_workspace_v1('a2740000-0000-4000-8000-000000000001','b2740000-0000-4000-8000-000000000001','a2740000-0000-4000-8000-000000000011');
 if w->>'status'<>'available' or w->>'eventStarted'<>'true' or w->>'anyReceiptRecorded'<>'true' or w->>'expenseReviewVersion'<>'1' or w->>'sanctioningAssessmentMinor'<>'6000' then raise exception 'started selector %',w;end if;
end$$;
rollback;
