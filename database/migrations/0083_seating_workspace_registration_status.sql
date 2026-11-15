-- Directors need the authoritative registration state before publishing seating.
-- Keep this narrow director/co-director workspace read private and immutable.

create or replace function public.get_initial_seating_workspace(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and p_tournament_id is not null and exists (
    select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id
      and r.profile_id = auth.uid() and r.role in ('director', 'co_director')
  ) then jsonb_build_object(
    'registrationClosed', (select t.registration_status = 'closed' from app.tournaments t where t.id = p_tournament_id),
    'publication', (select jsonb_build_object('publicationId', p.id, 'tableCount', p.table_count,
      'seatsPerTable', p.seats_per_table, 'publishedAt', p.published_at,
      'assignments', coalesce((select jsonb_agg(jsonb_build_object('rosterEntryId', a.roster_entry_id,
        'displayName', e.claimed_display_name, 'initialTableSeat', a.initial_table_seat,
        'verificationId', a.verification_id) order by a.initial_table_seat)
        from app.initial_seating_assignments a join app.tournament_roster_entries e on e.id = a.roster_entry_id
          and e.tournament_id = a.tournament_id where a.publication_id = p.id), '[]'::jsonb))
      from app.initial_seating_publications p where p.tournament_id = p_tournament_id),
    'checkIn', coalesce((select jsonb_agg(jsonb_build_object('rosterEntryId', e.id,
      'displayName', e.claimed_display_name, 'state', coalesce(c.check_in_state, 'not_checked_in'))
      order by e.claimed_normalized_name, e.id) from app.tournament_roster_entries e left join lateral (
        select x.check_in_state from app.roster_check_in_events x where x.tournament_id = p_tournament_id
          and x.roster_entry_id = e.id order by x.version desc limit 1
      ) c on true where e.tournament_id = p_tournament_id), '[]'::jsonb)
  ) else null end
$$;
