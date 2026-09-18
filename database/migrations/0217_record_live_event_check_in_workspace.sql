-- 0217: record the live definition of get_event_check_in_workspace_v1.
--
-- The database and the migration files had diverged. 0208 is the last migration
-- that defines this function, and it emits roster rows shaped
--   { rosterEntryId, displayName, accNumber, eventIds[], paid, checkedInEventIds[] }
-- but BOTH the production and pilot databases return
--   { rosterEntryId, displayName, accNumber, events[{eventId,participantStatus,
--     attendanceState}], paid, amountOwedMinor, amountReceivedMinor, paymentMethod }
--
-- Nothing in database/migrations produces that second shape, so it was applied
-- straight to the databases without a migration. Two consequences, both real:
--
--   1. The app still read row.eventIds, which does not exist, so Event QR
--      Check-In threw "Cannot read properties of undefined (reading 'includes')"
--      and answered 500 on every request. Measured on the built app against a
--      real database.
--   2. Rebuilding a database from these migrations would have produced the OLD
--      shape, so a fresh environment would break in the opposite direction.
--
-- This migration is the live definition copied out of production verbatim,
-- verified by md5 (3376842afe1647a5db0e68bdd7303244) rather than retyped. It is
-- a no-op against production and pilot, which already have exactly this body,
-- and it makes a rebuilt database match them.
--
-- The application code is updated to this shape in the same change.

CREATE OR REPLACE FUNCTION public.get_event_check_in_workspace_v1(p_actor_id uuid, p_tournament_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then jsonb_build_object(
  'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',e.id,'name',e.name,'eventType',e.event_type,'format',e.format,'playState',app.event_play_state_v1(e.id),'windowState',coalesce(w.state,'closed'),'checkedInCount',(select count(*) from app.event_participants p left join lateral(select x.state from app.event_check_in_events x where x.event_id=p.event_id and x.roster_entry_id=p.roster_entry_id order by x.version desc limit 1)latest on true where p.event_id=e.id and latest.state='checked_in'),'noShowCount',(select count(*) from app.event_participants p left join lateral(select x.state from app.event_check_in_events x where x.event_id=p.event_id and x.roster_entry_id=p.roster_entry_id order by x.version desc limit 1)latest on true where p.event_id=e.id and latest.state='no_show'),'unresolvedCount',app.event_attendance_unresolved_count_v1(e.id),'pendingDeskCount',coalesce((select count(*) from app.event_check_in_requests q where q.event_id=e.id and q.request_state='pending_desk'),0)) order by v.ordinal) from app.tournament_setup_activations a join app.events e on e.id=a.event_id and e.tournament_id=a.tournament_id and e.operational_state='active' join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id left join app.event_check_in_windows w on w.event_id=e.id where a.tournament_id=p_tournament_id),'[]'::jsonb),
  'requests',coalesce((select jsonb_agg(jsonb_build_object('requestId',q.id,'eventId',q.event_id,'rosterEntryId',q.roster_entry_id,'firstName',q.requested_first_name,'lastName',q.requested_last_name,'email',q.requested_email,'accNumber',q.requested_acc_number,'createdAt',q.created_at) order by q.created_at desc) from app.event_check_in_requests q join app.events e on e.id=q.event_id and e.tournament_id=q.tournament_id and e.operational_state='active' where q.tournament_id=p_tournament_id and q.request_state='pending_desk'),'[]'::jsonb),
  'roster',coalesce((select jsonb_agg(jsonb_build_object('rosterEntryId',r.id,'displayName',r.claimed_display_name,'accNumber',r.claimed_acc_number,'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',p.event_id,'participantStatus',p.status,'attendanceState',coalesce(latest.state,'unresolved')) order by p.event_id) from app.event_participants p join app.events e on e.id=p.event_id and e.tournament_id=p.tournament_id and e.operational_state='active' left join lateral(select x.state from app.event_check_in_events x where x.event_id=p.event_id and x.roster_entry_id=p.roster_entry_id order by x.version desc limit 1)latest on true where p.tournament_id=r.tournament_id and p.roster_entry_id=r.id),'[]'::jsonb),'paid',coalesce(payment.event_type='received' and payment.amount_minor>=obligation.amount_owed_minor,false),'amountOwedMinor',coalesce(obligation.amount_owed_minor,0),'amountReceivedMinor',case when payment.event_type='received' then payment.amount_minor else 0 end,'paymentMethod',case when payment.event_type='received' then payment.payment_method else null end) order by r.claimed_normalized_name,r.id) from app.tournament_roster_entries r left join lateral(select l.event_type from app.roster_entry_lifecycle_events l where l.roster_entry_id=r.id order by l.version desc limit 1)lifecycle on true left join lateral(select x.amount_owed_minor from app.roster_payment_obligation_versions x where x.roster_entry_id=r.id order by x.version desc limit 1)obligation on true left join lateral(select x.event_type,x.amount_minor,x.payment_method from app.roster_payment_events x where x.roster_entry_id=r.id order by x.version desc limit 1)payment on true where r.tournament_id=p_tournament_id and coalesce(lifecycle.event_type,'active')<>'withdrawn'),'[]'::jsonb)
 ) else null end
$function$
;
