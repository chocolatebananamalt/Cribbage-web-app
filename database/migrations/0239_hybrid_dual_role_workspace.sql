-- Proposed additive migration 0239: preserve existing cross-checker capability for dual-role officials.
-- Reader-only replacement; return shape, identity/independence guards and writer RPCs unchanged.
create or replace function public.get_hybrid_game_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_role text;v_name text;v_candidates jsonb:='[]'::jsonb;v_reviews jsonb:='[]'::jsonb;
begin
  select t.name into v_name from app.tournaments t where t.id=p_tournament_id and t.status='open';
  if not found then return null; end if;
  select role into v_role from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director','cross_checker') order by case role when 'cross_checker' then 1 when 'director' then 2 else 3 end limit 1;
  if v_role is null then return null; end if;
  if v_role='cross_checker' and app.paper_official_identity_is_current_valid(p_actor_id,p_tournament_id) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'gameId',g.id,'eventId',g.event_id,'eventName',e.name,'gameNumber',r.round_number,'gameVersion',g.version,
      'digitalSubmissionId',s.id,'digitalWinnerSide',s.winner_side,'digitalMargin',s.margin,
      'digitalSide',case when s.submitter_participant_id=g.side_a_participant_id then 'a' else 'b' end,
      'digitalPlayerName',coalesce(rd.claimed_display_name,pd.display_name),'paperPlayerName',coalesce(rp.claimed_display_name,pp.display_name),
      'paperVerificationId',sp.verification_id) order by e.name,r.round_number,g.id),'[]'::jsonb) into v_candidates
    from app.canonical_games g
    join app.events e on e.id=g.event_id and e.tournament_id=g.tournament_id
    join app.ruleset_versions rv on rv.id=e.ruleset_version_id and rv.tournament_id=e.tournament_id and rv.approved_at is not null
    join app.rounds r on r.id=g.round_id
    join app.event_schedule_games sg on sg.canonical_game_id=g.id and sg.tournament_id=g.tournament_id and sg.event_id=g.event_id
    join app.score_submissions s on s.canonical_game_id=g.id and s.source_method='digital'
    join app.event_participants d on d.id=s.submitter_participant_id and d.status='checked_in'
    join app.tournament_roster_entries rd on rd.id=d.roster_entry_id and rd.scorecard_type='digital'
    left join app.profiles pd on pd.id=d.profile_id
    join app.event_participants p on p.id=case when d.id=g.side_a_participant_id then g.side_b_participant_id else g.side_a_participant_id end and p.status='checked_in'
    join app.tournament_roster_entries rp on rp.id=p.roster_entry_id and rp.scorecard_type='paper'
    left join app.profiles pp on pp.id=p.profile_id
    join app.initial_seating_assignments sp on sp.tournament_id=p.tournament_id and sp.roster_entry_id=p.roster_entry_id
    where g.tournament_id=p_tournament_id and e.format='standard_singles' and e.scoring_method='digital'
      and g.state in('pending','submitted') and (select count(*) from app.score_submissions x where x.canonical_game_id=g.id)=1
      and not exists(select 1 from app.score_confirmations x where x.canonical_game_id=g.id)
      and not exists(select 1 from app.card_scorelines x where x.canonical_game_id=g.id)
      and not app.paper_game_has_active_case(g.id) and not app.device_recovery_has_active_case(g.id) and not app.hybrid_game_has_active_case(g.id)
      and app.participant_game_progression_v1(g.id,d.id)='current' and app.participant_game_progression_v1(g.id,p.id)='current'
      and app.paper_official_is_independent(p_actor_id,p_tournament_id,g.id);
  end if;
  if app.paper_official_identity_is_current_valid(p_actor_id,p_tournament_id) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'caseId',c.id,'gameId',c.canonical_game_id,'eventName',e.name,'gameNumber',r.round_number,'gameVersion',g.version,
      'digitalSubmissionId',c.digital_submission_id,'digitalWinnerSide',c.winner_side,'digitalMargin',c.margin,
      'digitalSide',case when c.digital_participant_id=g.side_a_participant_id then 'a' else 'b' end,
      'digitalPlayerName',coalesce(rd.claimed_display_name,pd.display_name),'paperPlayerName',coalesce(rp.claimed_display_name,pp.display_name),
      'paperVerificationId',sp.verification_id) order by e.name,r.round_number,g.id),'[]'::jsonb) into v_reviews
    from app.hybrid_game_cases c
    join app.hybrid_game_state_events state on state.hybrid_case_id=c.id and state.transition_sequence=1 and state.state='pending_review'
    join app.canonical_games g on g.id=c.canonical_game_id
    join app.events e on e.id=c.event_id
    join app.rounds r on r.id=c.round_id
    join app.event_participants d on d.id=c.digital_participant_id
    join app.tournament_roster_entries rd on rd.id=d.roster_entry_id
    left join app.profiles pd on pd.id=d.profile_id
    join app.event_participants p on p.id=c.paper_participant_id
    join app.tournament_roster_entries rp on rp.id=p.roster_entry_id
    left join app.profiles pp on pp.id=p.profile_id
    join app.initial_seating_assignments sp on sp.tournament_id=p.tournament_id and sp.roster_entry_id=p.roster_entry_id
    where c.tournament_id=p_tournament_id and c.first_official_profile_id<>p_actor_id
      and not exists(select 1 from app.hybrid_game_state_events closed where closed.hybrid_case_id=c.id and closed.transition_sequence=2)
      and app.paper_official_is_independent(p_actor_id,p_tournament_id,c.canonical_game_id);
  end if;
  return jsonb_build_object('tournamentId',p_tournament_id,'tournamentName',v_name,'actorRole',v_role,'actorIdentityConfirmed',app.paper_official_identity_is_current_valid(p_actor_id,p_tournament_id),'candidates',v_candidates,'reviewCases',v_reviews);
end $$;

revoke all on function public.get_hybrid_game_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_hybrid_game_workspace_v1(uuid,uuid) to service_role;
notify pgrst,'reload schema';
