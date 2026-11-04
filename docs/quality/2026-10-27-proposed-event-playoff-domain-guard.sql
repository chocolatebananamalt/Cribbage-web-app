-- LOCAL DESIGN PROPOSAL ONLY. Requires the v3 table, but revokes no existing grant.
-- Not registered, executed or approved for rollout. No settlement replacement implied.
-- Install in the same transaction as an additive v3 schema, before enabling its writers.
do $$ begin
 if exists(select 1 from app.standard_singles_playoff_result_versions legacy
   join app.playoff_outcome_versions_v3 outcomes
   on outcomes.tournament_id=legacy.tournament_id and outcomes.event_id=legacy.event_id) then
  raise exception 'playoff write domain preflight failed: existing mixed-domain history requires review';
 end if;
end $$;
create or replace function app.require_single_playoff_write_domain_v3()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('standard-singles-post-event:'||new.event_id::text,0));
 if tg_table_name='standard_singles_playoff_result_versions' then
  if exists(select 1 from app.playoff_outcome_versions_v3 v
    where v.tournament_id=new.tournament_id and v.event_id=new.event_id) then
   raise exception using errcode='P0001',message='playoff write domain conflict: this event uses versioned outcomes';
  end if;
 elsif tg_table_name='playoff_outcome_versions_v3' then
  if exists(select 1 from app.standard_singles_playoff_result_versions v
    where v.tournament_id=new.tournament_id and v.event_id=new.event_id) then
   raise exception using errcode='P0001',message='playoff write domain conflict: this event has legacy placement history';
  end if;
 else
  raise exception 'unexpected playoff write domain table';
 end if;
 return new;
end $$;
revoke all on function app.require_single_playoff_write_domain_v3()
 from public,anon,authenticated,service_role;
create trigger playoff_legacy_domain_exclusion_v3
 before insert on app.standard_singles_playoff_result_versions
 for each row execute function app.require_single_playoff_write_domain_v3();
create trigger playoff_outcome_domain_exclusion_v3
 before insert on app.playoff_outcome_versions_v3
 for each row execute function app.require_single_playoff_write_domain_v3();

-- Retain all legacy writer/reader grants, ownership and search paths unchanged.
-- Do not register this guard with the withdrawn 0240 global-revocation tail.
-- This only prevents dual write domains. It does NOT validate legacy MRP evidence,
-- authorize new callers, attest a bracket, or make v3 financial settlement available.
-- Before rollout, writer preflight/error mapping must turn these backstop exceptions
-- into structured rejected receipts without rewriting prior accepted receipts.
