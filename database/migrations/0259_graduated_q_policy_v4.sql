-- LOCAL proposal. New disclosed Q amount policy; immutable prior policies and
-- reviews remain readable. No recipient-rule, paid-state or disbursement change.
begin;
alter table app.q_operating_policies_v2 drop constraint q_operating_method_v3_check;
alter table app.q_operating_policies_v2 drop constraint q_operating_configuration_v3_check;
alter table app.q_operating_policies_v2 add constraint q_operating_method_v4_check check(method in('equal-paid-playoff-qualifiers-v2','graduated-paid-card-rank-v2','acc-weighted-largest-remainder-5usd-v1','graduated-acc-weighted-largest-remainder-5usd-v2'));
alter table app.q_operating_policies_v2 add constraint q_operating_configuration_v4_check check(
 (method='equal-paid-playoff-qualifiers-v2'and ratio is null and schedule_id is null)or
 (method='graduated-paid-card-rank-v2'and ratio is not null and schedule_id is not null and
 ((ratio=6 and schedule_id in('friend-q-p2-10-6-v1','friend-q-p3-20-6-v1','friend-q-p4-50-6-v1'))or(ratio=4 and schedule_id in('friend-q-p5-10-4-v1','friend-q-p6-20-4-v1','friend-q-p7-50-4-v1'))))or
 (method='acc-weighted-largest-remainder-5usd-v1'and ratio is not null and ratio in(4,6)and schedule_id is not null and schedule_id='acc-weighted-largest-remainder-5usd-v1')or
 (method='graduated-acc-weighted-largest-remainder-5usd-v2'and ratio is not null and ratio in(4,6)and schedule_id is not null and schedule_id='graduated-acc-weighted-largest-remainder-5usd-v2'));

-- Copy the fully guarded earlier writer into a separate operation namespace.
-- Do not expand an old client's accepted method or replay payload.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('public.save_q_operating_policy_v3(uuid,uuid,jsonb,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION public.save_q_operating_policy_v3(','FUNCTION app.save_q_operating_policy_v4_impl(');
 if p=d then raise exception 'Q v4 writer name anchor changed';end if;d:=p;
 p:=replace(d,'q_operating_v3','q_operating_v4');if p=d then raise exception 'Q v4 operation anchor changed';end if;d:=p;
 p:=replace(d,'acc-weighted-largest-remainder-5usd-v1','graduated-acc-weighted-largest-remainder-5usd-v2');if p=d then raise exception 'Q v4 method anchor changed';end if;d:=p;
 p:=replace(d,'if fee not in(1000,2000,5000)then','if fee not between 500 and 100000000 or mod(fee,500)<>0 then');
 if p=d then raise exception 'Q v4 fee anchor changed';end if;
 p:=replace(replace(p,'q_acc_weighted_policy_frozen','q_graduated_policy_frozen_v4'),'q_acc_weighted_policy_rejected','q_graduated_policy_rejected_v4');
 execute p;
 d:=pg_get_functiondef('public.get_q_operating_reconciliation_v3(uuid,uuid,uuid,jsonb)'::regprocedure);
 p:=replace(d,'FUNCTION public.get_q_operating_reconciliation_v3(','FUNCTION app.get_q_operating_reconciliation_v4_impl(');
 if p=d then raise exception 'Q v4 reconciliation name anchor changed';end if;d:=p;
 p:=replace(d,'q_operating_v3','q_operating_v4');if p=d then raise exception 'Q v4 reconciliation hash anchor changed';end if;execute p;
end$$;
revoke all on function app.save_q_operating_policy_v4_impl(uuid,uuid,jsonb,uuid),app.get_q_operating_reconciliation_v4_impl(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
create function public.save_q_operating_policy_v4(p_actor_id uuid,p_tournament_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb
language sql security definer set search_path=''as $$select app.save_q_operating_policy_v4_impl(p_actor_id,p_tournament_id,p_request,p_operation_id);$$;
create function public.get_q_operating_reconciliation_v4(p_actor_id uuid,p_tournament_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language sql stable security definer set search_path=''as $$select app.get_q_operating_reconciliation_v4_impl(p_actor_id,p_tournament_id,p_operation_id,p_request);$$;
revoke all on function public.save_q_operating_policy_v4(uuid,uuid,jsonb,uuid),public.get_q_operating_reconciliation_v4(uuid,uuid,uuid,jsonb)from public,anon,authenticated;
grant execute on function public.save_q_operating_policy_v4(uuid,uuid,jsonb,uuid),public.get_q_operating_reconciliation_v4(uuid,uuid,uuid,jsonb)to service_role;

-- New-method dispatcher retains exact old-only results. A mixed pool continues
-- to use its separately disclosed equal/chart/earlier formula amount policy.
do $$declare d text;p text;old text;replacement text;begin
 d:=pg_get_functiondef('app.calculate_q_obligations_v2(jsonb)'::regprocedure);
 p:=replace(d,'FUNCTION app.calculate_q_obligations_v2(','FUNCTION app.calculate_q_obligations_pre_graduated_v4(');
 if p=d then raise exception 'Q v4 legacy dispatcher anchor changed';end if;execute p;
 d:=pg_get_functiondef('app.calculate_q_obligations_with_acc_v3(jsonb)'::regprocedure);
 p:=replace(d,'FUNCTION app.calculate_q_obligations_with_acc_v3(','FUNCTION app.calculate_q_obligations_with_graduated_v4(');
 if p=d then raise exception 'Q v4 calculator name anchor changed';end if;d:=p;
 old:=$a$elsif pol->>'method'='acc-weighted-largest-remainder-5usd-v1' then$a$;
 replacement:=$a$elsif pol->>'method'in('acc-weighted-largest-remainder-5usd-v1','graduated-acc-weighted-largest-remainder-5usd-v2')then$a$;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'Q v4 method branch anchor changed';end if;d:=replace(d,old,replacement);
 old:=$a$if pol->>'scheduleId'is distinct from'acc-weighted-largest-remainder-5usd-v1'then$a$;
 replacement:=$a$if pol->>'scheduleId'is distinct from(pol->>'method')then$a$;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'Q v4 schedule branch anchor changed';end if;d:=replace(d,old,replacement);
 old:=$a$computed:=app.calculate_acc_weighted_pool_v1(jsonb_build_object('paidCount',n,'feeMinor',fee,'ratio',ratio));$a$;
 replacement:=$a$if pol->>'method'='graduated-acc-weighted-largest-remainder-5usd-v2'then
    computed:=app.calculate_graduated_pool_amounts_v2(jsonb_build_object('paidCount',n,'feeMinor',fee,'ratio',ratio));
    else computed:=app.calculate_acc_weighted_pool_v1(jsonb_build_object('paidCount',n,'feeMinor',fee,'ratio',ratio));end if;$a$;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'Q v4 shared amount anchor changed';end if;d:=replace(d,old,replacement);execute d;
end$$;
create or replace function app.calculate_q_obligations_v2(w jsonb)returns jsonb language plpgsql immutable set search_path=''as $$begin
 if jsonb_typeof(w->'policies')='array'and exists(select 1 from jsonb_array_elements(w->'policies')p where p->>'method'='graduated-acc-weighted-largest-remainder-5usd-v2')then return app.calculate_q_obligations_with_graduated_v4(w);end if;
 return app.calculate_q_obligations_pre_graduated_v4(w);
end$$;
revoke all on function app.calculate_q_obligations_pre_graduated_v4(jsonb),app.calculate_q_obligations_with_graduated_v4(jsonb),app.calculate_q_obligations_v2(jsonb)from public,anon,authenticated,service_role;

-- Bind the new calculator revision into sources only where that policy exists.
do $$declare d text;p text;old text;replacement text;begin
 d:=replace(pg_get_functiondef('public.get_q_operating_workspace_v2(uuid,uuid)'::regprocedure),E'\r\n',E'\n');
 old:=$a$if exists(select 1 from jsonb_array_elements(policies)p where p->>'method'='acc-weighted-largest-remainder-5usd-v1')then$a$;
 replacement:=$a$if exists(select 1 from jsonb_array_elements(policies)p where p->>'method'='graduated-acc-weighted-largest-remainder-5usd-v2')then
 manifest:=jsonb_build_object('version','q-operating-mixed-methods-v4','graduatedAlgorithmVersion','graduated-acc-weighted-largest-remainder-5usd-v2',
  'algorithmDisclosure','Observed ACC raw weights with application-owned exact largest-remainder 5USD rounding; higher-place remainder priority; amount calculation is not eligibility',
  'legacySources',s,'scoreFinancialManifest',b->'manifest','policies',policies,'cards',cards,'blockers',blocks);
 elsif exists(select 1 from jsonb_array_elements(policies)p where p->>'method'='acc-weighted-largest-remainder-5usd-v1')then$a$;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'Q v4 operating source anchor changed';end if;p:=replace(d,old,replacement);execute p;
 d:=replace(pg_get_functiondef('app.q_obligation_sources_v2(uuid,uuid)'::regprocedure),E'\r\n',E'\n');
 old:=$a$if exists(select 1 from jsonb_array_elements(w->'policies')p where p->>'method'='acc-weighted-largest-remainder-5usd-v1')then$a$;
 replacement:=$a$if exists(select 1 from jsonb_array_elements(w->'policies')p where p->>'method'='graduated-acc-weighted-largest-remainder-5usd-v2')then
 manifest:=jsonb_build_object('calculatorVersion','q-unpaid-dispatch-v4','graduatedAlgorithmVersion','graduated-acc-weighted-largest-remainder-5usd-v2','catalogRevision',app.q_chart_catalog_revision_v2(),'operatingWorkspace',w,'context',c);
 elsif exists(select 1 from jsonb_array_elements(w->'policies')p where p->>'method'='acc-weighted-largest-remainder-5usd-v1')then$a$;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'Q v4 obligation source anchor changed';end if;p:=replace(d,old,replacement);execute p;
end$$;

-- Existing penny reviews and exact operation replays are immutable evidence.
-- Newly inserted reviews may not introduce penny awards under the standing rule.
create function app.require_whole_five_q_review_v4()returns trigger language plpgsql security definer set search_path=''as $$begin
 if exists(select 1 from jsonb_array_elements(new.obligations)p cross join lateral jsonb_array_elements(p->'rows')r where p->>'kind'='award'and mod((r->>'amountMinor')::numeric,500)<>0)then raise exception 'whole_five_awards_required';end if;
 return new;
end$$;
revoke all on function app.require_whole_five_q_review_v4()from public,anon,authenticated,service_role;
create trigger q_review_whole_five_v4 before insert on app.q_obligation_reviews_v2 for each row execute function app.require_whole_five_q_review_v4();
do $$declare d text;p text;old text;begin
 d:=pg_get_functiondef('public.record_q_obligation_review_v2(uuid,uuid,jsonb,uuid)'::regprocedure);
 old:=$a$'q_review_domain_conflict','settlement_finalized'$a$;
 p:=replace(d,old,$a$'q_review_domain_conflict','settlement_finalized','whole_five_awards_required'$a$);
 if p=d then raise exception 'Q whole-five review rejection anchor changed';end if;execute p;
end$$;
commit;
