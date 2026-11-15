-- Forward repairs found during independent review of migration 0114.

create or replace function app.protect_scheduled_event_participant()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_event_id uuid;
begin
  if tg_op = 'INSERT' then v_event_id := new.event_id; else v_event_id := old.event_id; end if;
  if exists (select 1 from app.event_schedule_publications p where p.event_id = v_event_id) then
    if tg_op in ('INSERT', 'DELETE') then raise exception 'published event participant set is immutable'; end if;
    if new.tournament_id is distinct from old.tournament_id or new.event_id is distinct from old.event_id
       or new.profile_id is distinct from old.profile_id or new.roster_entry_id is distinct from old.roster_entry_id
       or new.table_seat is distinct from old.table_seat then
      raise exception 'published event participant identity is immutable';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function app.protect_scheduled_event_participant() from public, anon, authenticated;
create trigger protect_scheduled_event_participant before insert or update or delete on app.event_participants
for each row execute function app.protect_scheduled_event_participant();

create or replace function app.validate_published_schedule_game_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_table_count integer; v_seats_per_table integer;
begin
  if exists (select 1 from app.event_schedule_publications p where p.event_id = new.event_id) then
    select p.table_count, p.seats_per_table into v_table_count, v_seats_per_table
    from app.initial_seating_publications p where p.tournament_id = new.tournament_id;
    if v_table_count is null
       or ascii(left(new.side_a_table_seat_snapshot, 1)) - ascii('A') + 1 not between 1 and v_table_count
       or ascii(left(new.side_b_table_seat_snapshot, 1)) - ascii('A') + 1 not between 1 and v_table_count
       or split_part(new.side_a_table_seat_snapshot, '-', 2)::integer not between 1 and v_seats_per_table
       or split_part(new.side_b_table_seat_snapshot, '-', 2)::integer not between 1 and v_seats_per_table
       or left(new.side_a_table_seat_snapshot, 1) <> left(new.side_b_table_seat_snapshot, 1) then
      raise exception using errcode = 'P0001', message = 'invalid schedule';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app.validate_published_schedule_game_capacity() from public, anon, authenticated;
create trigger validate_published_schedule_game_capacity before insert on app.canonical_games
for each row execute function app.validate_published_schedule_game_capacity();

create index event_schedule_games_tournament_event_idx
  on app.event_schedule_games(tournament_id, event_id, canonical_game_id);

alter function public.publish_director_reviewed_event_schedule_v1(uuid, uuid, uuid, jsonb, uuid)
  set schema app;
alter function app.publish_director_reviewed_event_schedule_v1(uuid, uuid, uuid, jsonb, uuid)
  rename to publish_director_reviewed_event_schedule_core_v1;
revoke all on function app.publish_director_reviewed_event_schedule_core_v1(uuid, uuid, uuid, jsonb, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.publish_director_reviewed_event_schedule_v1(
  p_actor_id uuid, p_tournament_id uuid, p_event_id uuid, p_matches jsonb,
  p_reviewed_and_approved boolean, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_reviewed_and_approved is distinct from true then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid_schedule');
  end if;
  return app.publish_director_reviewed_event_schedule_core_v1(
    p_actor_id, p_tournament_id, p_event_id, p_matches, p_idempotency_key
  );
end;
$$;
revoke all on function public.publish_director_reviewed_event_schedule_v1(uuid, uuid, uuid, jsonb, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.publish_director_reviewed_event_schedule_v1(uuid, uuid, uuid, jsonb, boolean, uuid)
  to service_role;

create or replace function public.get_event_schedule_workspace_v1(p_actor_id uuid, p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when p_actor_id is not null and p_tournament_id is not null and exists (
    select 1 from app.tournament_roles tr where tr.tournament_id = p_tournament_id
      and tr.profile_id = p_actor_id and tr.role in ('director', 'co_director')
  ) then jsonb_build_object(
    'tournamentName', t.name,
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
revoke all on function public.get_event_schedule_workspace_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_event_schedule_workspace_v1(uuid, uuid) to service_role;

-- A linked digital player can load a game whose opponent is paper-only.
create or replace function public.get_assigned_game_context(p_game_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'actorId', auth.uid(), 'gameId', cg.id, 'tournamentId', cg.tournament_id,
    'eventId', cg.event_id, 'roundNumber', r.round_number, 'matchInstance', cg.match_instance,
    'state', cg.state, 'eventName', e.name,
    'ownSubmission', case when own_submission.id is null then null else jsonb_build_object('id', own_submission.id, 'winnerSide', own_submission.winner_side, 'margin', own_submission.margin) end,
    'ownConfirmed', own_confirmation.id is not null,
    'canConfirm', cg.state = 'confirmation_pending' and own_submission.id is not null and own_confirmation.id is null,
    'player', jsonb_build_object(
      'displayName', coalesce(player_roster.claimed_display_name, player_profile.display_name),
      'side', case when cg.side_a_participant_id = player_participant.id then 'a' else 'b' end,
      'tableSeat', case when cg.side_a_participant_id = player_participant.id then cg.side_a_table_seat_snapshot else cg.side_b_table_seat_snapshot end,
      'verificationId', coalesce(player_seating.verification_id, player_participant.table_seat)),
    'opponent', jsonb_build_object(
      'displayName', coalesce(opponent_roster.claimed_display_name, opponent_profile.display_name),
      'side', case when cg.side_a_participant_id = opponent_participant.id then 'a' else 'b' end,
      'tableSeat', case when cg.side_a_participant_id = opponent_participant.id then cg.side_a_table_seat_snapshot else cg.side_b_table_seat_snapshot end,
      'verificationId', coalesce(opponent_seating.verification_id, opponent_participant.table_seat))
  )
  from app.canonical_games cg
  join app.tournaments t on t.id = cg.tournament_id and t.status = 'open'
  join app.events e on e.id = cg.event_id and e.tournament_id = cg.tournament_id
  join app.ruleset_versions rv on rv.id = e.ruleset_version_id and rv.tournament_id = e.tournament_id and rv.format = 'standard_singles' and rv.approved_at is not null
  join app.rounds r on r.id = cg.round_id and r.event_id = cg.event_id and r.tournament_id = cg.tournament_id
  join app.event_participants player_participant on player_participant.id in (cg.side_a_participant_id, cg.side_b_participant_id)
    and player_participant.profile_id = auth.uid() and player_participant.status = 'checked_in'
  join app.profiles player_profile on player_profile.id = player_participant.profile_id
  left join app.tournament_roster_entries player_roster on player_roster.id = player_participant.roster_entry_id and player_roster.tournament_id = cg.tournament_id
  left join app.initial_seating_assignments player_seating on player_seating.tournament_id = cg.tournament_id and player_seating.roster_entry_id = player_participant.roster_entry_id
  join app.event_participants opponent_participant on opponent_participant.id in (cg.side_a_participant_id, cg.side_b_participant_id) and opponent_participant.id <> player_participant.id
  left join app.profiles opponent_profile on opponent_profile.id = opponent_participant.profile_id
  left join app.tournament_roster_entries opponent_roster on opponent_roster.id = opponent_participant.roster_entry_id and opponent_roster.tournament_id = cg.tournament_id
  left join app.initial_seating_assignments opponent_seating on opponent_seating.tournament_id = cg.tournament_id and opponent_seating.roster_entry_id = opponent_participant.roster_entry_id
  left join lateral (select s.id, s.winner_side, s.margin from app.score_submissions s
    where s.canonical_game_id = cg.id and s.submitter_profile_id = auth.uid() order by s.submitted_at desc limit 1) own_submission on true
  left join lateral (select c.id from app.score_confirmations c
    where c.canonical_game_id = cg.id and c.confirmation_actor_id = auth.uid() order by c.confirmed_at desc limit 1) own_confirmation on true
  where cg.id = p_game_id and cg.state in ('pending', 'submitted', 'confirmation_pending', 'mismatch', 'verified')
    and e.format = 'standard_singles' and e.scoring_method = 'digital'
    and coalesce(player_roster.claimed_display_name, player_profile.display_name) is not null
    and coalesce(opponent_roster.claimed_display_name, opponent_profile.display_name) is not null
    and coalesce(player_seating.verification_id, player_participant.table_seat) is not null
    and coalesce(opponent_seating.verification_id, opponent_participant.table_seat) is not null
  limit 1
$$;
revoke all on function public.get_assigned_game_context(uuid) from public, anon;
grant execute on function public.get_assigned_game_context(uuid) to authenticated;
