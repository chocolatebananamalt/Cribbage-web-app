-- Browser clients must not reproduce PostgreSQL's canonical financial-request
-- hash. Recover an interrupted operation by its immutable, caller-scoped
-- identity instead. A receipt remains unique per current actor/idempotency key
-- and is additionally bound to tournament, roster target, and exact kind.
create or replace function public.get_roster_payment_operation_identity_reconciliation(
  p_tournament_id uuid, p_roster_entry_id uuid, p_operation_type text,
  p_idempotency_key uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and p_tournament_id is not null
    and p_roster_entry_id is not null and p_idempotency_key is not null
    and p_operation_type in ('record_manual_roster_payment', 'void_manual_roster_payment')
    and exists (select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id
      and r.profile_id=auth.uid() and r.role in ('director','co_director'))
  then (select o.response_payload from app.operation_receipts o
    where o.actor_profile_id=auth.uid() and o.tournament_id=p_tournament_id
      and o.target_id=p_roster_entry_id and o.client_operation_id=p_idempotency_key
      and o.operation_type=p_operation_type limit 1)
  else null end
$$;

revoke all on function public.get_roster_payment_operation_identity_reconciliation(uuid,uuid,text,uuid)
  from public, anon;
grant execute on function public.get_roster_payment_operation_identity_reconciliation(uuid,uuid,text,uuid)
  to authenticated;
