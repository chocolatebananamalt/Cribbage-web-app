-- UNEXECUTED/default-off handoff + dispute-binding + adjudication prerequisites. Provisional progression is not resolution.
begin;
create function app.manual_mixed_can_continue_v1(gid uuid,pid uuid)returns boolean language sql stable security definer set search_path=''as $$
 select app.manual_mixed_handoff_enabled_v1()and exists(select 1 from app.canonical_games g join app.manual_mixed_handoff_v1 h on h.game_id=g.id and h.game_version=g.version and(h.decision='yes'or(h.decision='no'and (app.manual_mixed_dispute_binding_current_v1(g.id,h.submission_id)or exists(select 1 from app.manual_mixed_preverification_adjudications_v1 adj where adj.game_id=g.id and app.manual_mixed_adjudication_matches_v1(adj.id,g.id,h.submission_id,g.version,adj.winner_side,adj.margin,true)))))
 join app.score_submissions s on s.id=h.submission_id and s.canonical_game_id=g.id and s.source_method='digital'
 join app.event_participants d on d.id=s.submitter_participant_id and d.profile_id=h.actor_id and d.status='checked_in'and d.event_id=g.event_id and d.tournament_id=g.tournament_id
 join app.tournament_roster_entries rd on rd.id=d.roster_entry_id and rd.scorecard_type='digital'
 join app.event_participants p on p.id=case when d.id=g.side_a_participant_id then g.side_b_participant_id else g.side_a_participant_id end and p.status='checked_in'and p.event_id=g.event_id and p.tournament_id=g.tournament_id
 join app.tournament_roster_entries rp on rp.id=p.roster_entry_id and rp.scorecard_type='paper'
 where g.id=gid and pid in(d.id,p.id)and g.state='submitted'and(select count(*)from app.score_submissions where canonical_game_id=g.id)=1
 and not exists(select 1 from app.event_disputes x where x.canonical_game_id=g.id and app.event_dispute_is_open(x.id))
 and not exists(select 1 from app.hybrid_game_cases x where x.canonical_game_id=g.id and app.hybrid_game_latest_state(x.id)='rejected'));
$$;
alter function app.participant_game_progression_v1(uuid,uuid)rename to participant_game_progression_pre_manual_mixed_v1;
create function app.participant_game_progression_v1(p_game_id uuid,p_participant_id uuid)returns text language plpgsql stable security definer set search_path=''as $$begin
 if app.manual_mixed_handoff_enabled_v1()is distinct from true then return app.participant_game_progression_pre_manual_mixed_v1(p_game_id,p_participant_id);end if;
 return (  with target_rows as(
    select game.id,game.tournament_id,game.event_id,round_row.round_number,game.match_instance,schedule.import_row_number
    from app.canonical_games game
    join app.rounds round_row on round_row.id=game.round_id and round_row.tournament_id=game.tournament_id and round_row.event_id=game.event_id
    join app.event_schedule_games schedule on schedule.canonical_game_id=game.id and schedule.tournament_id=game.tournament_id and schedule.event_id=game.event_id
    where game.id=p_game_id and p_participant_id in(game.side_a_participant_id,game.side_b_participant_id)
  ), target as(
    select min(id::text)::uuid id,min(tournament_id::text)::uuid tournament_id,min(event_id::text)::uuid event_id,
      min(round_number) round_number,min(match_instance) match_instance,min(import_row_number) import_row_number
    from target_rows having count(*)=1
  )
  select case when not exists(select 1 from app.event_play_starts started where started.event_id=target.event_id)then 'not_started'
    when app.game_is_authoritatively_resolved_v1(target.id) then 'completed'
    when app.manual_mixed_can_continue_v1(target.id,p_participant_id) then 'awaiting_paper_review'
    when not exists(
      select 1 from app.canonical_games earlier
      join app.rounds earlier_round on earlier_round.id=earlier.round_id and earlier_round.tournament_id=earlier.tournament_id and earlier_round.event_id=earlier.event_id
      join app.event_schedule_games earlier_schedule on earlier_schedule.canonical_game_id=earlier.id
        and earlier_schedule.tournament_id=earlier.tournament_id and earlier_schedule.event_id=earlier.event_id
      where earlier.tournament_id=target.tournament_id and earlier.event_id=target.event_id
        and p_participant_id in(earlier.side_a_participant_id,earlier.side_b_participant_id)
        and not app.game_is_authoritatively_resolved_v1(earlier.id)
        and not app.manual_mixed_can_continue_v1(earlier.id,p_participant_id)
        and (earlier_round.round_number,earlier.match_instance,earlier_schedule.import_row_number,earlier.id)
          <(target.round_number,target.match_instance,target.import_row_number,target.id)
    ) then 'current' else 'upcoming' end from target
);end$$;
-- Preserve installed wrappers (including makeup/start additions); change only the explicit next-action mapping seam.
do $patch$declare d text;old text:='case when progress.status=''not_started''then''event_not_started'' when progress.status=''upcoming''then''upcoming_locked'' when progress.status=''completed''then''view_scorecard''else item.game->>''nextAction''end';begin
 select pg_get_functiondef('public.get_my_assigned_games_v1(uuid)'::regprocedure)into d;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'manual_mixed_progression_projection_seam_changed';end if;
 execute replace(d,old,'case when progress.status=''not_started''then''event_not_started'' when progress.status=''upcoming''then''upcoming_locked'' when progress.status=''completed''then''view_scorecard'' when progress.status=''awaiting_paper_review''then''await_paper_review''else item.game->>''nextAction''end');end$patch$;
alter function app.manual_mixed_can_continue_v1(uuid,uuid)owner to postgres;alter function app.participant_game_progression_v1(uuid,uuid)owner to postgres;
revoke all on function app.manual_mixed_can_continue_v1(uuid,uuid),app.participant_game_progression_v1(uuid,uuid),app.participant_game_progression_pre_manual_mixed_v1(uuid,uuid)from public,anon,authenticated,service_role;
-- Paper cross-checks must remain possible after the player has moved on.
create function app.manual_mixed_review_progression_v1(gid uuid,pid uuid)returns boolean language sql stable security definer set search_path=''as $$select coalesce(app.participant_game_progression_v1(gid,pid)='current'or(app.manual_mixed_handoff_enabled_v1()and app.participant_game_progression_v1(gid,pid)='awaiting_paper_review'and app.manual_mixed_can_continue_v1(gid,pid)),false)$$;
alter function app.manual_mixed_review_progression_v1(uuid,uuid)owner to postgres;revoke all on function app.manual_mixed_review_progression_v1(uuid,uuid)from public,anon,authenticated,service_role;
do $review_patch$declare name text;d text;oid regprocedure;needle text;replacement text;args text[];part text;begin
 foreach name in array array['create_hybrid_digital_paper_case_v1','review_hybrid_digital_paper_case_v1','get_hybrid_game_workspace_v1']loop
 select p.oid::regprocedure into strict oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname=name;
 select pg_get_functiondef(oid)into d;
 args:=case name when'create_hybrid_digital_paper_case_v1'then array['p_game_id,v_digital.id','p_game_id,v_paper.id']when'review_hybrid_digital_paper_case_v1'then array['v_case.canonical_game_id,v_case.digital_participant_id','v_case.canonical_game_id,v_case.paper_participant_id']else array['g.id,d.id','g.id,p.id']end;
 foreach part in array args loop
 needle:='app.participant_game_progression_v1('||part||')'||case when name='get_hybrid_game_workspace_v1'then'=''current'''else' is distinct from ''current'''end;
 replacement:='app.manual_mixed_review_progression_v1('||part||')'||case when name='get_hybrid_game_workspace_v1'then'=true'else' is distinct from true'end;
 if(length(d)-length(replace(d,needle,'')))/length(needle)<>1 then raise exception 'manual_mixed_review_progression_seam_changed';end if;d:=replace(d,needle,replacement);end loop;
 execute d;end loop;end$review_patch$;
commit;
