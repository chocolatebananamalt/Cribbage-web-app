-- Expose the immutable initial table plan to the director schedule preview so
-- capacity and same-table mistakes are caught before publication as well as
-- by the authoritative insert trigger.

create or replace function public.get_event_schedule_workspace_v1(p_actor_id uuid, p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when p_actor_id is not null and p_tournament_id is not null and exists (
    select 1 from app.tournament_roles tr where tr.tournament_id = p_tournament_id
      and tr.profile_id = p_actor_id and tr.role in ('director', 'co_director')
  ) then jsonb_build_object(
    'tournamentName', t.name,
    'tableCount', (select p.table_count from app.initial_seating_publications p where p.tournament_id = t.id),
    'seatsPerTable', (select p.seats_per_table from app.initial_seating_publications p where p.tournament_id = t.id),
    'events', coalesce((select jsonb_agg(jsonb_build_object(
      'eventId', e.id, 'name', e.name, 'format', e.format, 'scoringMethod', e.scoring_method,
      'gameCount', sev.game_count,
      'participantCount', (select count(*) from app.event_participants ep where ep.event_id = e.id),
      'schedulePublished', p.id is not null, 'publishedMatchCount', coalesce(p.match_count, 0)
    ) order by sev.ordinal)
    from app.tournament_setup_activations a
    join app.events e on e.id = a.event_id and e.tournament_id = a.tournament_id
    join app.tournament_setup_event_versions sev on sev.id = a.setup_event_version_id and sev.tournament_id = a.tournament_id
    left join app.event_schedule_publications p on p.event_id = e.id
    where a.tournament_id = t.id), '[]'::jsonb),
    'participants', coalesce((select jsonb_agg(jsonb_build_object(
      'eventId', ep.event_id, 'participantId', ep.id, 'displayName', coalesce(r.claimed_display_name, pr.display_name),
      'verificationId', coalesce(s.verification_id, ep.table_seat), 'profileLinked', ep.profile_id is not null
    ) order by ep.event_id, coalesce(s.verification_id, ep.table_seat))
    from app.event_participants ep
    left join app.tournament_roster_entries r on r.id = ep.roster_entry_id and r.tournament_id = ep.tournament_id
    left join app.profiles pr on pr.id = ep.profile_id
    left join app.initial_seating_assignments s on s.roster_entry_id = ep.roster_entry_id and s.tournament_id = ep.tournament_id
    where ep.tournament_id = t.id and coalesce(s.verification_id, ep.table_seat) is not null), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(jsonb_build_object(
      'eventId', cg.event_id, 'canonicalGameId', cg.id, 'gameNumber', ro.round_number,
      'sideAVerificationId', coalesce(sa.verification_id, a.table_seat),
      'sideBVerificationId', coalesce(sb.verification_id, b.table_seat),
      'sideATableSeat', cg.side_a_table_seat_snapshot, 'sideBTableSeat', cg.side_b_table_seat_snapshot,
      'sideADisplayName', coalesce(ra.claimed_display_name, pa.display_name),
      'sideBDisplayName', coalesce(rb.claimed_display_name, pb.display_name), 'state', cg.state
    ) order by cg.event_id, ro.round_number, sg.import_row_number)
    from app.event_schedule_games sg
    join app.canonical_games cg on cg.id = sg.canonical_game_id
    join app.rounds ro on ro.id = cg.round_id
    join app.event_participants a on a.id = cg.side_a_participant_id
    join app.event_participants b on b.id = cg.side_b_participant_id
    left join app.tournament_roster_entries ra on ra.id = a.roster_entry_id
    left join app.tournament_roster_entries rb on rb.id = b.roster_entry_id
    left join app.profiles pa on pa.id = a.profile_id
    left join app.profiles pb on pb.id = b.profile_id
    left join app.initial_seating_assignments sa on sa.tournament_id = a.tournament_id and sa.roster_entry_id = a.roster_entry_id
    left join app.initial_seating_assignments sb on sb.tournament_id = b.tournament_id and sb.roster_entry_id = b.roster_entry_id
    where sg.tournament_id = t.id), '[]'::jsonb)
  ) else null end from app.tournaments t where t.id = p_tournament_id
$$;

revoke all on function public.get_event_schedule_workspace_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_event_schedule_workspace_v1(uuid, uuid)
  to service_role;
