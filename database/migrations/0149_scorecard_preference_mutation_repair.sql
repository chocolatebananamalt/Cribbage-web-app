-- Permit only the audited scorecard-preference projection to change on an
-- otherwise immutable roster entry. The append-only preference event remains
-- the source history; this column pair is its current read projection.

create or replace function app.guard_roster_scorecard_projection()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    raise exception 'immutable history cannot be changed';
  end if;
  if current_setting('app.scorecard_preference_write',true) is distinct from 'enabled'
    or (to_jsonb(new)-'scorecard_type'-'scorecard_preference_version')
       is distinct from (to_jsonb(old)-'scorecard_type'-'scorecard_preference_version')
    or new.scorecard_preference_version<>old.scorecard_preference_version+1
    or new.scorecard_type not in('digital','paper')
  then
    raise exception 'immutable history cannot be changed';
  end if;
  return new;
end $$;
revoke all on function app.guard_roster_scorecard_projection() from public,anon,authenticated;

drop trigger tournament_roster_entries_immutable on app.tournament_roster_entries;
create trigger tournament_roster_entries_restricted_updates
before update or delete on app.tournament_roster_entries
for each row execute function app.guard_roster_scorecard_projection();

create or replace function public.set_roster_scorecard_preference_v1(
  p_actor_id uuid,p_tournament_id uuid,p_roster_entry_id uuid,p_expected_version integer,
  p_scorecard_type text,p_reason text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row app.tournament_roster_entries%rowtype;v_hash text;v_existing app.operation_receipts%rowtype;v_receipt uuid;v_response jsonb;v_error text;v_code text;
begin begin
  if p_actor_id is null or p_tournament_id is null or p_roster_entry_id is null or p_expected_version is null or p_expected_version<1 or p_scorecard_type not in('digital','paper') or p_idempotency_key is null or length(coalesce(p_reason,''))>500 then raise exception using errcode='P0001',message='invalid request';end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then raise exception using errcode='P0001',message='director role required';end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('set_roster_scorecard_preference_v1',p_tournament_id::text,p_roster_entry_id::text,p_expected_version,p_scorecard_type,coalesce(nullif(trim(p_reason),''),''))::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;
  if found then if v_existing.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency conflict';end if;return v_existing.response_payload;end if;
  perform 1 from app.tournaments t where t.id=p_tournament_id and t.status in('draft','open') and t.registration_status='open' for update;
  if not found then raise exception using errcode='P0001',message='registration closed';end if;
  if exists(select 1 from app.initial_seating_publications p where p.tournament_id=p_tournament_id) then raise exception using errcode='P0001',message='initial seating already published';end if;
  select * into v_row from app.tournament_roster_entries r where r.id=p_roster_entry_id and r.tournament_id=p_tournament_id for update;
  if not found then raise exception using errcode='P0001',message='roster entry unavailable';end if;
  if v_row.scorecard_preference_version<>p_expected_version then raise exception using errcode='P0001',message='stale preference version';end if;
  v_response:=jsonb_build_object('status','scorecard_preference_updated','rosterEntryId',p_roster_entry_id,'scorecardType',p_scorecard_type,'version',p_expected_version+1);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(p_actor_id,p_tournament_id,'set_roster_scorecard_preference_v1',p_roster_entry_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  perform set_config('app.scorecard_preference_write','enabled',true);
  update app.tournament_roster_entries set scorecard_type=p_scorecard_type,scorecard_preference_version=p_expected_version+1 where id=p_roster_entry_id;
  insert into app.roster_scorecard_preference_events(tournament_id,roster_entry_id,version,scorecard_type,source,reason,actor_profile_id,operation_receipt_id)
    values(p_tournament_id,p_roster_entry_id,p_expected_version+1,p_scorecard_type,'director_update',nullif(trim(coalesce(p_reason,'')),''),p_actor_id,v_receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
    values(p_tournament_id,p_actor_id,v_receipt,'roster_scorecard_preference',p_roster_entry_id,'scorecard_preference_updated',jsonb_build_object('scorecardType',v_row.scorecard_type,'version',v_row.scorecard_preference_version),v_response);
  return v_response;
exception when sqlstate 'P0001' then
  get stacked diagnostics v_error=message_text;
  v_code:=case v_error when 'director role required' then 'not_director' when 'registration closed' then 'registration_closed' when 'initial seating already published' then 'initial_seating_already_published' when 'roster entry unavailable' then 'roster_entry_unavailable' when 'stale preference version' then 'stale_preference_version' when 'idempotency conflict' then 'idempotency_conflict' when 'invalid request' then 'invalid_request' else 'scorecard_preference_rejected' end;
  return jsonb_build_object('status','rejected','code',v_code,'rosterEntryId',p_roster_entry_id);
end;end $$;

revoke all on function public.set_roster_scorecard_preference_v1(uuid,uuid,uuid,integer,text,text,uuid) from public,anon,authenticated;
grant execute on function public.set_roster_scorecard_preference_v1(uuid,uuid,uuid,integer,text,text,uuid) to service_role;
notify pgrst,'reload schema';
