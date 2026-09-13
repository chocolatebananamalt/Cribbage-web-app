-- Director-only current-policy and idempotency-reconciliation read models.
-- Policy history remains private and append-only; these RPCs disclose only the
-- current policy and the caller's own configuration receipt.

-- Replace the first policy writer with an optimistic-concurrency version before
-- exposing its workspace. Retiring the old signature is important: otherwise a
-- stale caller could bypass the expected-version guard by invoking it directly.
revoke all on function public.configure_correction_policy(uuid, boolean, smallint, uuid) from public, anon, authenticated;
drop function public.configure_correction_policy(uuid, boolean, smallint, uuid);

create function public.configure_correction_policy(
  p_tournament_id uuid,
  p_reason_required boolean,
  p_required_approvals smallint,
  p_expected_policy_version integer,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_hash text; v_existing app.operation_receipts%rowtype; v_version integer;
  v_current_policy_version integer; v_receipt uuid; v_response jsonb;
  v_error text; v_code text; v_tournament_exists boolean := false;
begin
  begin
  if v_actor is null then raise exception using errcode = 'P0001', message = 'authentication required'; end if;
  if p_tournament_id is null or p_reason_required is null or p_required_approvals is null
    or p_required_approvals not between 0 and 1 or p_expected_policy_version is null
    or p_expected_policy_version < 0 or p_idempotency_key is null then
    raise exception using errcode = 'P0001', message = 'invalid correction policy request';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array('configure_correction_policy', p_tournament_id::text, p_reason_required, p_required_approvals, p_expected_policy_version, p_idempotency_key::text)::text, 'utf8'), 'sha256'), 'hex');
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
  select max(version) into v_current_policy_version from app.correction_policy_versions where tournament_id = p_tournament_id;
  if v_current_policy_version is distinct from p_expected_policy_version then
    raise exception using errcode = 'P0001', message = 'stale correction policy';
  end if;
  v_version := v_current_policy_version + 1;
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
    v_code := case v_error when 'authentication required' then 'authentication_required' when 'invalid correction policy request' then 'invalid_request' when 'tournament is not configurable' then 'tournament_not_configurable' when 'director role required' then 'not_director' when 'stale correction policy' then 'stale_policy' when 'idempotency conflict' then 'idempotency_conflict' else 'policy_rejected' end;
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

revoke all on function public.configure_correction_policy(uuid, boolean, smallint, integer, uuid) from public, anon;
grant execute on function public.configure_correction_policy(uuid, boolean, smallint, integer, uuid) to authenticated;

create or replace function public.get_correction_policy(p_tournament_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null or p_tournament_id is null then return null; end if;
  if not exists (
    select 1 from app.tournament_roles
    where tournament_id = p_tournament_id and profile_id = v_actor
      and role in ('director', 'co_director')
  ) then return null; end if;
  select jsonb_build_object(
    'tournamentId', t.id,
    'tournamentStatus', t.status,
    'policyVersion', p.version,
    'reasonRequired', p.reason_required,
    'requiredApprovals', p.required_approvals,
    'canConfigure', t.status in ('draft', 'open')
  ) into v_result
  from app.tournaments t
  join lateral (
    select version, reason_required, required_approvals
    from app.correction_policy_versions
    where tournament_id = t.id
    order by version desc
    limit 1
  ) p on true
  where t.id = p_tournament_id;
  return v_result;
end;
$$;

create or replace function public.get_correction_policy_operation_reconciliation(
  p_tournament_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_response jsonb;
begin
  if v_actor is null or p_tournament_id is null or p_idempotency_key is null then return null; end if;
  if not exists (
    select 1 from app.tournament_roles
    where tournament_id = p_tournament_id and profile_id = v_actor
      and role in ('director', 'co_director')
  ) then return null; end if;
  select response_payload into v_response
  from app.operation_receipts
  where actor_profile_id = v_actor
    and tournament_id = p_tournament_id
    and operation_type = 'configure_correction_policy'
    and target_id = p_tournament_id
    and client_operation_id = p_idempotency_key
  limit 1;
  return v_response;
end;
$$;

revoke all on function public.get_correction_policy(uuid) from public, anon;
revoke all on function public.get_correction_policy_operation_reconciliation(uuid, uuid) from public, anon;
grant execute on function public.get_correction_policy(uuid) to authenticated;
grant execute on function public.get_correction_policy_operation_reconciliation(uuid, uuid) to authenticated;
