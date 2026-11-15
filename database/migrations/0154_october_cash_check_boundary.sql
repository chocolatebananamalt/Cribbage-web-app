-- October pilot payment boundary. Historical values remain readable so an
-- upgrade does not corrupt old audit history, but every new registration claim
-- and received-payment event is restricted to cash or check.

create or replace function app.enforce_october_registration_payment_method()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('pending_review', 'needs_review')
     and new.intended_payment_method not in ('cash', 'check') then
    raise exception 'October pilot registration payment method must be cash or check';
  end if;
  return new;
end;
$$;
revoke all on function app.enforce_october_registration_payment_method() from public, anon, authenticated;
drop trigger if exists registration_claims_october_payment_method on app.registration_claims;
create trigger registration_claims_october_payment_method
before insert on app.registration_claims for each row
execute function app.enforce_october_registration_payment_method();

create or replace function app.enforce_october_received_payment_method()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.event_type = 'received' and new.payment_method not in ('cash', 'check') then
    raise exception 'October pilot received payment method must be cash or check';
  end if;
  return new;
end;
$$;
revoke all on function app.enforce_october_received_payment_method() from public, anon, authenticated;
drop trigger if exists roster_payment_events_october_payment_method on app.roster_payment_events;
create trigger roster_payment_events_october_payment_method
before insert on app.roster_payment_events for each row
execute function app.enforce_october_received_payment_method();

create or replace function public.get_roster_payment_workspace(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and p_tournament_id is not null and exists (
    select 1 from app.tournament_roles role
    where role.tournament_id = p_tournament_id and role.profile_id = auth.uid()
      and role.role in ('director', 'co_director')
  ) then jsonb_build_object(
    'rosterEntries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rosterEntryId', roster.id,
        'displayName', roster.claimed_display_name,
        'plannedPaymentMethod', case when claim.intended_payment_method in ('cash','check') then claim.intended_payment_method else null end,
        'paymentVersion', coalesce(current_event.version, 0),
        'paymentState', coalesce(current_event.event_type, 'unrecorded'),
        'currentReceiptEventId', case when current_event.event_type = 'received' then current_event.id else null end,
        'history', coalesce(history.events, '[]'::jsonb)
      ) order by roster.claimed_normalized_name, roster.id)
      from app.tournament_roster_entries roster
      left join app.registration_claims claim
        on claim.id = roster.source_claim_id and claim.tournament_id = roster.tournament_id
      left join lateral (
        select event.id, event.version, event.event_type
        from app.roster_payment_events event
        where event.tournament_id = p_tournament_id and event.roster_entry_id = roster.id
        order by event.version desc limit 1
      ) current_event on true
      left join lateral (
        select jsonb_agg(jsonb_build_object(
          'paymentEventId', event.id, 'version', event.version, 'eventType', event.event_type,
          'amountMinor', event.amount_minor, 'currencyCode', event.currency_code,
          'paymentMethod', event.payment_method, 'paymentReceivedAt', event.payment_received_at,
          'paymentVoidedAt', event.payment_voided_at, 'receiptNote', event.receipt_note,
          'voidReason', event.void_reason, 'recorderDisplayName', profile.display_name,
          'recordedAt', event.recorded_at
        ) order by event.version desc) as events
        from app.roster_payment_events event
        join app.profiles profile on profile.id = event.actor_profile_id
        where event.tournament_id = p_tournament_id and event.roster_entry_id = roster.id
      ) history on true
      where roster.tournament_id = p_tournament_id
    ), '[]'::jsonb)
  ) else null end
$$;
revoke all on function public.get_roster_payment_workspace(uuid) from public, anon;
grant execute on function public.get_roster_payment_workspace(uuid) to authenticated;
