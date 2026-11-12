-- Appended to a transaction containing the isolated full-schema pooled fixture.
do $$declare a uuid:='a2740000-0000-4000-8000-000000000001';t uuid:='b2740000-0000-4000-8000-000000000001';e uuid:='a2740000-0000-4000-8000-000000000011';r jsonb;w jsonb;begin
 w:=public.get_simulated_finance_selector_workspace_v1(a,t,e);
 if w->>'code'<>'owner_enrollment_required' then raise exception 'unenrolled workspace %',w;end if;
 if public.get_simulated_finance_selector_workspace_v1('a4740000-0000-4000-8000-000000000001',t,e) is not null then raise exception 'outsider accessed';end if;
 if public.get_simulated_finance_selector_workspace_v1(a,t,'a2740000-0000-4000-8000-000000000099')->>'code'<>'owner_enrollment_required' then raise exception 'unexpected unenrolled scope';end if;
 r:=public.activate_multi_event_finance_v1(a,t,'simulation','d2740000-0000-4000-8000-000000000041');
 if r->>'status'<>'multi_event_finance_activated' then raise exception 'fixture mode %',r;end if;
 w:=public.get_simulated_finance_selector_workspace_v1(a,t,e);
 if w->>'status'<>'available' or w->>'eventName'<>'Main' or w->>'baseFeeMinor'<>'5000'
  or jsonb_array_length(w->'pools')<>3 or jsonb_array_length(w->'participants')<>1
  or w->'participants'->0->>'name'<>'TEST ONLY Player' or w->>'moneyMoved'<>'false'
  or w->>'humanConsentClaimed'<>'false' or w->>'accountingAvailable'<>'false'
  or not exists(select 1 from jsonb_array_elements(w->'pools') p where p->>'kind'='side' and p->>'type'='graduated-1-in-6' and p->>'name'='TEST ONLY Side')
  or w::text ilike '%claimed_email%' or w::text ilike '%phone%' then raise exception 'bad selectors %',w;end if;
 if public.get_simulated_finance_selector_workspace_v1(a,t,'a2740000-0000-4000-8000-000000000099')->>'code'<>'event_unavailable' then raise exception 'invalid event leaked';end if;
 r:=public.publish_multi_event_pool_disclosure_v1(a,t,e,'{"kind":"q","poolDefinitionId":"b1740000-0000-4000-8000-000000000001","method":"graduated-acc-weighted-largest-remainder-5usd-v2","ratio":4,"disclosureReference":"TEST ONLY SYNTHETIC: disclosure","disclosed":true}','d2740000-0000-4000-8000-000000000042');
 if r->>'status'<>'synthetic_pool_policy_disclosed' then raise exception 'disclose %',r;end if;
 w:=public.get_simulated_finance_selector_workspace_v1(a,t,e);
 if not exists(select 1 from jsonb_array_elements(w->'pools') p where p->>'policyId'=r->>'policyId' and p->>'policyRatio'='4') then raise exception 'policy missing %',w;end if;
 perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 if public.get_simulated_finance_selector_workspace_v1(a,t,e) is not null then raise exception 'non-service accessed';end if;
end$$;
rollback;
