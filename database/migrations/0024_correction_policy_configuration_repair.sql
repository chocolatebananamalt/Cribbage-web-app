create table if not exists app.correction_policy_operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid references app.profiles(id) on delete restrict,
  tournament_id uuid references app.tournaments(id) on delete restrict,
  attempted_idempotency_key uuid,
  attempted_request_hash text not null,
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null,
  created_at timestamptz not null default now()
);
alter table app.correction_policy_operation_conflicts enable row level security;
alter table app.correction_policy_operation_conflicts force row level security;
revoke all on table app.correction_policy_operation_conflicts from public, anon, authenticated;
drop trigger if exists correction_policy_operation_conflicts_immutable on app.correction_policy_operation_conflicts;
create trigger correction_policy_operation_conflicts_immutable before update or delete on app.correction_policy_operation_conflicts
for each row execute function app.reject_immutable_history();

create or replace function public.configure_correction_policy(
  p_tournament_id uuid,
  p_reason_required boolean,
  p_required_approvals smallint,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_hash text; v_existing app.operation_receipts%rowtype; v_version integer;
  v_receipt uuid; v_response jsonb; v_error text; v_code text; v_tournament_exists boolean := false;
begin
  begin
  if v_actor is null then raise exception using errcode = 'P0001', message = 'authentication required'; end if;
  if p_tournament_id is null or p_reason_required is null or p_required_approvals is null
    or p_required_approvals not between 0 and 1 or p_idempotency_key is null then
    raise exception using errcode = 'P0001', message = 'invalid correction policy request';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array('configure_correction_policy', p_tournament_id::text, p_reason_required, p_required_approvals, p_idempotency_key::text)::text, 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0));
  perform 1 from app.tournaments where id = p_tournament_id for update;
  v_tournament_exists := found;
  if not v_tournament_exists then raise exception using errcode = 'P0001', message = 'tournament is not configurable'; end if;
  select * into v_existing from app.operation_receipts where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_hash then raise exception using errcode = 'P0001', message = 'idempotency conflict'; end if;
    return v_existing.response_payload;
  end if;
  if not exists (select 1 from app.tournaments where id = p_tournament_id and status in ('draft', 'open')) then
    raise exception using errcode = 'P0001', message = 'tournament is not configurable';
  end if;
  if not exists (select 1 from app.tournament_roles where tournament_id = p_tournament_id and profile_id = v_actor and role in ('director', 'co_director')) then
    raise exception using errcode = 'P0001', message = 'director role required';
  end if;
  select max(version) + 1 into v_version from app.correction_policy_versions where tournament_id = p_tournament_id;
  insert into app.correction_policy_versions(tournament_id, version, reason_required, required_approvals, created_by_profile_id)
  values (p_tournament_id, v_version, p_reason_required, p_required_approvals, v_actor);
  v_response := jsonb_build_object('status', 'configured', 'tournament_id', p_tournament_id, 'policy_version', v_version, 'reason_required', p_reason_required, 'required_approvals', p_required_approvals);
  insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
  values (v_actor, p_tournament_id, 'configure_correction_policy', p_tournament_id, v_hash, p_idempotency_key, 'accepted', v_response, now()) returning id into v_receipt;
  insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state)
  values (p_tournament_id, v_actor, v_receipt, 'correction_policy', p_tournament_id, 'correction_policy_configured', v_response);
  return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error when 'authentication required' then 'authentication_required' when 'invalid correction policy request' then 'invalid_request' when 'tournament is not configurable' then 'tournament_not_configurable' when 'director role required' then 'not_director' when 'idempotency conflict' then 'idempotency_conflict' else 'policy_rejected' end;
    v_response := jsonb_build_object('status','rejected','code',v_code,'tournament_id',p_tournament_id);
    if v_error = 'idempotency conflict' then
      insert into app.correction_policy_operation_conflicts(actor_profile_id,tournament_id,attempted_idempotency_key,attempted_request_hash,prior_receipt_id,reason_code)
      values(v_actor,p_tournament_id,p_idempotency_key,coalesce(v_hash,''),v_existing.id,'idempotency_conflict');
    elsif v_actor is not null and v_tournament_exists then
      insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
      values(v_actor,p_tournament_id,'configure_correction_policy',p_tournament_id,coalesce(v_hash,''),p_idempotency_key,'rejected',v_response,now()) returning id into v_receipt;
      insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
      values(p_tournament_id,v_actor,v_receipt,'correction_policy',p_tournament_id,'correction_policy_rejected',v_response);
    end if;
    return v_response;
  when others then raise;
  end;
end;
$$;

revoke all on function public.configure_correction_policy(uuid, boolean, smallint, uuid) from public, anon;
grant execute on function public.configure_correction_policy(uuid, boolean, smallint, uuid) to authenticated;
