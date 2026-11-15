-- A recovery route must never confuse a revoked or unauthorized caller with a
-- known operation that simply has no receipt. Return an explicit envelope so
-- the browser can unlock only after current authority is proven.

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
  if v_actor is null or p_tournament_id is null or p_idempotency_key is null then
    return jsonb_build_object('authorized', false);
  end if;
  if not exists (
    select 1 from app.tournament_roles
    where tournament_id = p_tournament_id and profile_id = v_actor
      and role in ('director', 'co_director')
  ) then
    return jsonb_build_object('authorized', false);
  end if;
  select response_payload into v_response
  from app.operation_receipts
  where actor_profile_id = v_actor
    and tournament_id = p_tournament_id
    and operation_type = 'configure_correction_policy'
    and target_id = p_tournament_id
    and client_operation_id = p_idempotency_key
  limit 1;
  return jsonb_build_object('authorized', true, 'result', v_response);
end;
$$;

create or replace function public.get_roster_promotion_operation_reconciliation(
  p_tournament_id uuid,
  p_approval_decision_id uuid,
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
  if v_actor is null or p_tournament_id is null or p_approval_decision_id is null or p_idempotency_key is null then
    return jsonb_build_object('authorized', false);
  end if;
  if not exists (
    select 1 from app.tournament_roles
    where tournament_id = p_tournament_id and profile_id = v_actor
      and role in ('director', 'co_director')
  ) then
    return jsonb_build_object('authorized', false);
  end if;
  select response_payload into v_response
  from app.operation_receipts
  where actor_profile_id = v_actor
    and tournament_id = p_tournament_id
    and operation_type = 'create_roster_entry_from_registration_claim'
    and target_id = p_approval_decision_id
    and client_operation_id = p_idempotency_key
  limit 1;
  return jsonb_build_object('authorized', true, 'result', v_response);
end;
$$;

revoke all on function public.get_correction_policy_operation_reconciliation(uuid, uuid) from public, anon;
grant execute on function public.get_correction_policy_operation_reconciliation(uuid, uuid) to authenticated;
revoke all on function public.get_roster_promotion_operation_reconciliation(uuid, uuid, uuid) from public, anon;
grant execute on function public.get_roster_promotion_operation_reconciliation(uuid, uuid, uuid) to authenticated;
