-- Private director/co-director read model for manual payment evidence. It
-- exposes neither registration contact data nor a balance/paid/reconciliation
-- interpretation, and does not grant direct access to private ledger tables.

create or replace function public.get_roster_payment_workspace(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and p_tournament_id is not null and exists (
    select 1 from app.tournament_roles r
    where r.tournament_id = p_tournament_id and r.profile_id = auth.uid()
      and r.role in ('director', 'co_director')
  ) then jsonb_build_object(
    'rosterEntries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rosterEntryId', r.id,
        'displayName', r.claimed_display_name,
        'paymentVersion', coalesce(current_event.version, 0),
        'paymentState', coalesce(current_event.event_type, 'unrecorded'),
        'currentReceiptEventId', case when current_event.event_type = 'received' then current_event.id else null end,
        'history', coalesce(history.events, '[]'::jsonb)
      ) order by r.claimed_normalized_name, r.id)
      from app.tournament_roster_entries r
      left join lateral (
        select e.id, e.version, e.event_type
        from app.roster_payment_events e
        where e.tournament_id = p_tournament_id and e.roster_entry_id = r.id
        order by e.version desc
        limit 1
      ) current_event on true
      left join lateral (
        select jsonb_agg(jsonb_build_object(
          'paymentEventId', e.id,
          'version', e.version,
          'eventType', e.event_type,
          'amountMinor', e.amount_minor,
          'currencyCode', e.currency_code,
          'paymentMethod', e.payment_method,
          'paymentReceivedAt', e.payment_received_at,
          'paymentVoidedAt', e.payment_voided_at,
          'receiptNote', e.receipt_note,
          'voidReason', e.void_reason,
          'recorderDisplayName', p.display_name,
          'recordedAt', e.recorded_at
        ) order by e.version desc) as events
        from app.roster_payment_events e
        join app.profiles p on p.id = e.actor_profile_id
        where e.tournament_id = p_tournament_id and e.roster_entry_id = r.id
      ) history on true
      where r.tournament_id = p_tournament_id
    ), '[]'::jsonb)
  ) else null end
$$;

revoke all on function public.get_roster_payment_workspace(uuid) from public, anon;
grant execute on function public.get_roster_payment_workspace(uuid) to authenticated;
