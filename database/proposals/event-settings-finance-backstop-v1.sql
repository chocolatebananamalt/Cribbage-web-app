-- UNEXECUTED PRIVATE PROPOSAL. Requires native operational settings bindings.
-- New configured events must not fall through to legacy/manual regular-prize
-- accounting merely because they intentionally have no V1/V2 prize binding.
-- This blocks unsupported authoritative accounting; it does NOT calculate,
-- fund, approve or disburse any payout. Independent Q/Side estimates stay intact.
begin;
create function app.require_event_settings_finance_backstop_v1()returns trigger
language plpgsql security definer set search_path=''as $$
begin
 -- A retained snapshot could hide a newly committed configured binding.
 if current_setting('transaction_isolation')<>'read committed'then raise exception'event_settings_finance_isolation_not_supported';end if;
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if not found then raise exception'event_settings_finance_tournament_unavailable';end if;
 if tg_table_name='multi_event_joint_finals_v1'then
  if exists(select 1 from app.event_settings_operational_bindings_v1 where tournament_id=new.tournament_id)then raise exception'event_settings_finance_integration_required';end if;
 elsif exists(select 1 from app.event_settings_operational_bindings_v1 where tournament_id=new.tournament_id and event_id=new.event_id)then
  raise exception'event_settings_finance_integration_required';
 end if;
 return new;
end$$;
do $$declare n text;begin
 foreach n in array array['standard_singles_settlement_drafts','standard_singles_settlement_final_versions',
 'event_settlement_drafts_v5','event_settlement_finals_v2','q_accounting_drafts_v6','q_accounting_finals_v6',
 'no_q_accounting_drafts_v7','no_q_accounting_finals_v7','prize_accounting_drafts_v8','prize_accounting_finals_v8',
 'prize_accounting_drafts_v9','prize_accounting_finals_v9','multi_event_unpaid_drafts_v1',
 'multi_event_unpaid_finals_v1','multi_event_joint_finals_v1']loop
  execute format('create trigger aa_event_settings_finance_backstop_v1 before insert on app.%I for each row execute function app.require_event_settings_finance_backstop_v1()',n);
 end loop;
end$$;
-- Presence only: no public enablement and no claim of runtime acceptance.
create function app.event_settings_finance_guard_available_v1()returns boolean
language sql stable security definer set search_path=''as $$
 select count(*)=15 from pg_catalog.pg_trigger t where t.tgname='aa_event_settings_finance_backstop_v1'
 and t.tgenabled='O'and t.tgfoid='app.require_event_settings_finance_backstop_v1()'::regprocedure
 and t.tgrelid=any(array['app.standard_singles_settlement_drafts'::regclass,'app.standard_singles_settlement_final_versions'::regclass,
 'app.event_settlement_drafts_v5'::regclass,'app.event_settlement_finals_v2'::regclass,
 'app.q_accounting_drafts_v6'::regclass,'app.q_accounting_finals_v6'::regclass,
 'app.no_q_accounting_drafts_v7'::regclass,'app.no_q_accounting_finals_v7'::regclass,
 'app.prize_accounting_drafts_v8'::regclass,'app.prize_accounting_finals_v8'::regclass,
 'app.prize_accounting_drafts_v9'::regclass,'app.prize_accounting_finals_v9'::regclass,
 'app.multi_event_unpaid_drafts_v1'::regclass,'app.multi_event_unpaid_finals_v1'::regclass,
 'app.multi_event_joint_finals_v1'::regclass]);
$$;
alter function app.require_event_settings_finance_backstop_v1()owner to postgres;
alter function app.event_settings_finance_guard_available_v1()owner to postgres;
revoke all on function app.require_event_settings_finance_backstop_v1(),app.event_settings_finance_guard_available_v1()from public,anon,authenticated,service_role;
commit;
