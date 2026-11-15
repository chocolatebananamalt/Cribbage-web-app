-- Disposable SQL only. No funded events or human claims.
begin;
do $$declare p jsonb;c jsonb;r jsonb;begin
 p:='{"status":"preview","moneyMoved":false,"accountingAvailable":false,"baseIncomeMinor":10000,"qIncomeMinor":1000,"sideIncomeMinor":500,"expenseMinor":1500,"benefitMinor":500,"requiredFundingMinor":0,"restrictedResidualMinor":0,"regularAwards":[{"participantId":"a2870000-0000-4000-8000-000000000001","amountMinor":3000},{"participantId":"a2870000-0000-4000-8000-000000000002","amountMinor":2500},{"participantId":"a2870000-0000-4000-8000-000000000003","amountMinor":1500},{"participantId":"a2870000-0000-4000-8000-000000000004","amountMinor":1500}],"pools":[{"calculation":{"status":"calculated","moneyMoved":false,"fundMinor":1000,"awards":[{"participantId":"a2870000-0000-4000-8000-000000000001","amountMinor":1000}]}},{"calculation":{"status":"calculated","moneyMoved":false,"fundMinor":500,"awards":[{"participantId":"a2870000-0000-4000-8000-000000000002","amountMinor":500}]}}]}'::jsonb;
 c:='{"status":"available","moneyMoved":false,"baseIncomeMinor":10000,"qIncomeMinor":1000,"sideIncomeMinor":500,"classifiedExpenses":{"expenseMinor":1500,"benefitMinor":500,"sanctioningMinor":500}}'::jsonb;
 if not app.valid_multi_event_final_totals_v1(p,c,500) then raise exception 'balanced synthetic source rejected';end if;
 if app.valid_multi_event_final_totals_v1(jsonb_set(p,'{requiredFundingMinor}','500'),c,500) or app.valid_multi_event_final_totals_v1(jsonb_set(p,'{expenseMinor}','1499'),c,500)
 or app.valid_multi_event_final_totals_v1(jsonb_set(p,'{regularAwards,0,amountMinor}','3500'),c,500) or app.valid_multi_event_final_totals_v1(jsonb_set(p,'{pools,0,calculation,awards,0,amountMinor}','500'),c,500)
 or app.valid_multi_event_final_totals_v1(p,c,501) or app.valid_multi_event_final_totals_v1(jsonb_set(p,'{moneyMoved}','true'),c,500) then raise exception 'invalid financial conservation accepted';end if;
 r:=public.finalize_multi_event_unpaid_v1(null,null,null,null);
 if r->>'code'<>'structured_final_verification_pending' or r->>'moneyMoved'<>'false' then raise exception 'public final prematurely exposed %',r;end if;
 if has_function_privilege('authenticated','public.finalize_multi_event_unpaid_v1(uuid,uuid,jsonb,uuid)','execute')
 or has_function_privilege('service_role','app.write_multi_event_joint_final_candidate_v1(uuid,uuid,jsonb,uuid)','execute')
 or has_function_privilege('service_role','app.get_multi_event_joint_final_candidate_v1(uuid,uuid)','execute') then raise exception 'private final candidate exposed';end if;
 if not exists(select 1 from pg_class where oid='app.multi_event_joint_finals_v1'::regclass and relrowsecurity and relforcerowsecurity)
 or not exists(select 1 from pg_class where oid='app.multi_event_unpaid_finals_v1'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'final RLS not forced';end if;
end$$;
rollback;
