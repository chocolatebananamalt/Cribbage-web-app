-- Safely resolve a lost response without retaining private setup content in a
-- browser retry envelope. This is actor-, tournament-, operation-, and key-scoped.

create or replace function public.get_tournament_setup_operation_reconciliation(
  p_tournament_id uuid,
  p_idempotency_key uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and p_tournament_id is not null
    and p_idempotency_key is not null
    and exists (select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id
      and r.profile_id=auth.uid() and r.role in ('director','co_director'))
  then jsonb_build_object('authorized', true, 'result', (
    select o.response_payload from app.operation_receipts o
    where o.actor_profile_id=auth.uid() and o.tournament_id=p_tournament_id
      and o.target_id=p_tournament_id and o.client_operation_id=p_idempotency_key
      and o.operation_type='save_tournament_setup_version'
    limit 1
  )) else null end
$$;

revoke all on function public.get_tournament_setup_operation_reconciliation(uuid, uuid) from public, anon;
grant execute on function public.get_tournament_setup_operation_reconciliation(uuid, uuid) to authenticated;
