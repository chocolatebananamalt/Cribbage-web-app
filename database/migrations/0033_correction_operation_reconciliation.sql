-- Resolve an ambiguous correction request using only the caller's immutable
-- receipt. This intentionally reveals no correction reason or another actor's
-- operation. It lets the browser discard a retry envelope only after a server
-- outcome has become authoritative.

create or replace function public.get_correction_operation_reconciliation(
  p_correction_id uuid,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_receipt app.operation_receipts%rowtype;
begin
  if v_actor is null or p_correction_id is null or p_idempotency_key is null then
    return jsonb_build_object('state', 'unknown');
  end if;
  select * into v_receipt
    from app.operation_receipts
    where actor_profile_id = v_actor
      and client_operation_id = p_idempotency_key
      and (
        (operation_type = 'review_game_correction' and target_id = p_correction_id)
        or (operation_type = 'propose_game_correction' and response_payload->>'correction_id' = p_correction_id::text)
      )
    order by applied_at desc
    limit 1;
  if found then
    return jsonb_build_object('state', 'resolved', 'response', v_receipt.response_payload);
  end if;
  return jsonb_build_object('state', 'unknown');
end; $$;

revoke all on function public.get_correction_operation_reconciliation(uuid,uuid) from public, anon;
grant execute on function public.get_correction_operation_reconciliation(uuid,uuid) to authenticated;
