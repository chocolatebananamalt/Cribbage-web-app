-- Protected roster workspace and recovery read model. Both are director scoped;
-- neither opens claim, roster, receipt, or audit tables to direct access.

create or replace function public.get_tournament_roster_workspace(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and exists (
    select 1 from app.tournament_roles r
    where r.tournament_id = p_tournament_id and r.profile_id = auth.uid()
      and r.role in ('director', 'co_director')
  ) then jsonb_build_object(
    'rosterEntries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rosterEntryId', e.id, 'sourceClaimId', e.source_claim_id,
        'approvalDecisionId', e.approval_decision_id,
        'displayName', e.claimed_display_name, 'email', e.claimed_email,
        'accNumber', e.claimed_acc_number, 'createdAt', e.created_at
      ) order by e.created_at)
      from app.tournament_roster_entries e where e.tournament_id = p_tournament_id
    ), '[]'::jsonb),
    'promotionCandidates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'approvalDecisionId', d.id, 'sourceClaimId', c.id,
        'displayName', c.display_name, 'email', c.email, 'accNumber', c.acc_number,
        'intendedPaymentMethod', c.intended_payment_method, 'submittedAt', c.submitted_at
      ) order by c.submitted_at)
      from app.registration_claim_decisions d
      join app.registration_claims c on c.id = d.claim_id and c.tournament_id = d.tournament_id
      left join app.tournament_roster_entries e on e.approval_decision_id = d.id
      where d.tournament_id = p_tournament_id and d.decision = 'approved_for_roster'
        and e.id is null
    ), '[]'::jsonb)
  ) else null end
$$;

create or replace function public.get_roster_promotion_operation_reconciliation(
  p_tournament_id uuid, p_approval_decision_id uuid, p_idempotency_key uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and p_tournament_id is not null
    and p_approval_decision_id is not null and p_idempotency_key is not null
    and exists (select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id
      and r.profile_id = auth.uid() and r.role in ('director', 'co_director'))
  then (select o.response_payload from app.operation_receipts o
    where o.actor_profile_id = auth.uid() and o.tournament_id = p_tournament_id
      and o.operation_type = 'create_roster_entry_from_registration_claim'
      and o.target_id = p_approval_decision_id and o.client_operation_id = p_idempotency_key
    limit 1) else null end
$$;

revoke all on function public.get_tournament_roster_workspace(uuid) from public, anon;
revoke all on function public.get_roster_promotion_operation_reconciliation(uuid, uuid, uuid) from public, anon;
grant execute on function public.get_tournament_roster_workspace(uuid) to authenticated;
grant execute on function public.get_roster_promotion_operation_reconciliation(uuid, uuid, uuid) to authenticated;
