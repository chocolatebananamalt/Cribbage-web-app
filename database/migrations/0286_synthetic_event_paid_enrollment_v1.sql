-- LOCAL ONLY. The existing attendance check retains its identity and legacy
-- behavior. Synthetic mode derives paid status from exactly one current source.
begin;
do $$declare definition text;copy text;begin
 definition:=pg_get_functiondef('app.event_qr_player_is_paid_and_enrolled(uuid,uuid,uuid)'::regprocedure);
 copy:=replace(definition,'FUNCTION app.event_qr_player_is_paid_and_enrolled(','FUNCTION app.event_qr_player_is_paid_and_enrolled_legacy_0286(');
 if copy=definition then raise exception 'paid enrollment legacy function anchor changed';end if;
 execute copy;
end$$;
revoke all on function app.event_qr_player_is_paid_and_enrolled_legacy_0286(uuid,uuid,uuid)from public,anon,authenticated,service_role;

create function app.multi_event_base_receipt_current_v1(tid uuid,sourceid uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$
declare s app.multi_event_finance_sources_v1%rowtype;line jsonb;b jsonb;eid uuid;total numeric:=0;
begin
 select * into s from app.multi_event_finance_sources_v1 where tournament_id=tid and id=sourceid and source_kind='receipt' and evidence_kind='simulation';
 if not found or jsonb_array_length(s.allocations)=0 or jsonb_array_length(s.allocations)<>jsonb_array_length(s.source_bindings)then return false;end if;
 for line in select value from jsonb_array_elements(s.allocations)loop
  eid:=(line->>'eventId')::uuid;select value into b from jsonb_array_elements(s.source_bindings)where value->>'eventId'=eid::text;
  if (select count(*)from jsonb_array_elements(s.allocations)x where x->>'eventId'=eid::text)<>1 or (select count(*)from jsonb_array_elements(s.source_bindings)x where x->>'eventId'=eid::text)<>1 then return false;end if;
  if not exists(select 1 from app.events e join app.tournament_setup_activations a on a.tournament_id=e.tournament_id and a.event_id=e.id join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id and v.tournament_id=e.tournament_id join app.event_participants p on p.id::text=b->>'participantId' and p.event_id=e.id and p.tournament_id=tid and p.roster_entry_id=s.roster_entry_id and p.status in('registered','checked_in') where e.id=eid and e.tournament_id=tid and e.operational_state='active' and a.id::text=b->>'activationId' and v.id::text=b->>'setupEventVersionId' and v.entry_fee_cents=(line->>'amountMinor')::integer and v.entry_fee_cents>0 and not exists(select 1 from app.tournament_setup_q_pool_versions q where q.setup_event_version_id=v.id) and not exists(select 1 from app.tournament_setup_side_pool_versions sp where sp.setup_event_version_id=v.id) and not exists(select 1 from app.event_side_pools sp where sp.tournament_id=tid and sp.event_id=eid) and exists(select 1 from app.synthetic_paper_fixtures_v1 f join app.synthetic_paper_deployments_v1 d using(project_ref) where f.tournament_id=tid and f.event_id=eid and f.project_ref='nnhcnvksxgxnpvdqjgpg')) then return false;end if;
  if (select count(*)from app.event_participants p where p.tournament_id=tid and p.event_id=eid and p.roster_entry_id=s.roster_entry_id and p.status in('registered','checked_in'))<>1 or exists(select 1 from app.multi_event_finance_sources_v1 other cross join lateral jsonb_array_elements(other.allocations)x where other.tournament_id=tid and other.source_kind='receipt' and other.id<>s.id and other.roster_entry_id=s.roster_entry_id and x->>'eventId'=eid::text) or exists(select 1 from app.multi_event_pool_receipts_v1 other cross join lateral jsonb_array_elements(other.components)x where other.tournament_id=tid and other.roster_entry_id=s.roster_entry_id and x->>'eventId'=eid::text) then return false;end if;
  total:=total+(line->>'amountMinor')::numeric;
 end loop;
 return coalesce(total=s.amount_minor,false);
exception when invalid_text_representation or numeric_value_out_of_range then return false;end$$;
revoke all on function app.multi_event_base_receipt_current_v1(uuid,uuid)from public,anon,authenticated,service_role;

create or replace function app.event_qr_player_is_paid_and_enrolled(p_tournament_id uuid,p_event_id uuid,p_roster_entry_id uuid)
returns boolean language plpgsql stable security definer set search_path=''as $$
declare mode app.multi_event_finance_modes_v1%rowtype;source_count integer;sid uuid;pooled boolean;
begin
 select * into mode from app.multi_event_finance_modes_v1 where tournament_id=p_tournament_id;
 if not found then return app.event_qr_player_is_paid_and_enrolled_legacy_0286(p_tournament_id,p_event_id,p_roster_entry_id);end if;
 if mode.evidence_kind<>'simulation' or not app.multi_event_legacy_finance_absent_v1(p_tournament_id) or not exists(select 1 from app.event_participants p where p.tournament_id=p_tournament_id and p.event_id=p_event_id and p.roster_entry_id=p_roster_entry_id and p.status in('registered','checked_in')) then return false;end if;
 select count(*)::integer,min(source_id::text)::uuid,bool_or(is_pooled)into source_count,sid,pooled from (
  select s.id source_id,false is_pooled from app.multi_event_finance_sources_v1 s where s.tournament_id=p_tournament_id and s.roster_entry_id=p_roster_entry_id and s.source_kind='receipt' and exists(select 1 from jsonb_array_elements(s.allocations)x where x->>'eventId'=p_event_id::text)
  union all select s.id,true from app.multi_event_pool_receipts_v1 s where s.tournament_id=p_tournament_id and s.roster_entry_id=p_roster_entry_id and exists(select 1 from jsonb_array_elements(s.components)x where x->>'eventId'=p_event_id::text)
 ) candidates;
 if source_count<>1 then return false;end if;
 if pooled then
  if exists(select 1 from app.multi_event_pool_receipts_v1 r cross join lateral jsonb_array_elements(r.components)x where r.id=sid and r.tournament_id=p_tournament_id and not exists(select 1 from app.synthetic_paper_fixtures_v1 f join app.synthetic_paper_deployments_v1 d using(project_ref) where f.tournament_id=p_tournament_id and f.event_id::text=x->>'eventId' and f.project_ref='nnhcnvksxgxnpvdqjgpg')) then return false;end if;
  return coalesce(app.multi_event_pool_receipt_current_v1(mode.actor_id,p_tournament_id,sid),false);
 end if;
 return coalesce(app.multi_event_base_receipt_current_v1(p_tournament_id,sid),false);
exception when invalid_text_representation or numeric_value_out_of_range then return false;end$$;
commit;
