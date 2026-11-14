-- UNEXECUTED/default off. Persistent paper card merges ORIGINAL digital tentative rows and effective verified scorelines.
-- Never reads unfinished paper transcription answers. Existing row writers remain authoritative.
begin;
create function public.get_manual_paper_card_workspace_v1(tid uuid,eid uuid,paper_id text default null)returns jsonb language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare a uuid;name text;event_name text;options jsonb;target uuid;display text;rows jsonb;begin
 if app.manual_mixed_handoff_enabled_v1()is distinct from true then return null;end if;a:=app.manual_mixed_handoff_actor_v1();if a is null then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director','cross_checker')for share nowait;if not found or app.paper_official_identity_is_current_valid(a,tid)is distinct from true then return null;end if;
 select t.name,e.name into name,event_name from app.tournaments t join app.events e on e.tournament_id=t.id where t.id=tid and e.id=eid and e.format='standard_singles'and e.scoring_method='digital';if not found then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('paperId',seat.verification_id,'displayName',coalesce(nullif(r.claimed_display_name,''),p.display_name))order by seat.verification_id),'[]'::jsonb)into options
 from app.event_participants ep join app.tournament_roster_entries r on r.id=ep.roster_entry_id and r.tournament_id=ep.tournament_id and r.scorecard_type='paper'
 left join app.profiles p on p.id=ep.profile_id join app.initial_seating_assignments seat on seat.tournament_id=ep.tournament_id and seat.roster_entry_id=ep.roster_entry_id
 where ep.tournament_id=tid and ep.event_id=eid;
 if paper_id is not null then
 if paper_id!~'^[A-Z]-[1-9][0-9]*$'then return null;end if;
 select ep.id,coalesce(nullif(r.claimed_display_name,''),p.display_name)into strict target,display from app.event_participants ep join app.tournament_roster_entries r on r.id=ep.roster_entry_id and r.tournament_id=ep.tournament_id and r.scorecard_type='paper'left join app.profiles p on p.id=ep.profile_id join app.initial_seating_assignments seat on seat.tournament_id=ep.tournament_id and seat.roster_entry_id=ep.roster_entry_id where ep.tournament_id=tid and ep.event_id=eid and seat.verification_id=paper_id;
 with games as(select g.*,app.scorecard_game_number_v1(g.id,target)card_number,opp.id opponent_id,opp.profile_id opponent_profile_id,coalesce(nullif(ro.claimed_display_name,''),pr.display_name)opponent_name,seating.verification_id opponent_fixed_id,ro.scorecard_type opponent_mode
 from app.canonical_games g join app.event_schedule_games scheduled on scheduled.canonical_game_id=g.id and scheduled.event_id=g.event_id and scheduled.tournament_id=g.tournament_id
 join app.event_participants opp on opp.id=case when g.side_a_participant_id=target then g.side_b_participant_id else g.side_a_participant_id end and opp.tournament_id=g.tournament_id and opp.event_id=g.event_id
 left join app.tournament_roster_entries ro on ro.id=opp.roster_entry_id and ro.tournament_id=opp.tournament_id left join app.profiles pr on pr.id=opp.profile_id left join app.initial_seating_assignments seating on seating.tournament_id=opp.tournament_id and seating.roster_entry_id=opp.roster_entry_id
 where g.tournament_id=tid and g.event_id=eid and target in(g.side_a_participant_id,g.side_b_participant_id)and app.game_counts_in_standings_v1(g.id)),
 source as(select g.*,(app.paper_official_is_independent(a,tid,g.id)is distinct from true)self_game,
 line.line_id,line.is_winner,line.margin verified_margin,submission.id submission_id,submission.winner_side digital_winner,submission.margin digital_margin,h.decision,
 exists(select 1 from app.event_disputes dispute where dispute.canonical_game_id=g.id and app.event_dispute_is_open(dispute.id))open_dispute
 from games g left join lateral(select x.*from app.current_effective_scorelines(tid,eid)x where x.canonical_game_id=g.id and x.participant_id=target)line on true
 left join lateral(select s.*from app.score_submissions s where s.canonical_game_id=g.id and s.submitter_participant_id=g.opponent_id and s.source_method='digital'and g.opponent_mode='digital'and(select count(*)from app.score_submissions where canonical_game_id=g.id)=1)submission on true
 left join app.manual_mixed_handoff_v1 h on h.game_id=g.id and h.submission_id=submission.id)
 select coalesce(jsonb_agg(jsonb_build_object('gameId',g.id,'gameVersion',g.version,'gameNumber',g.card_number,'matchInstance',g.match_instance,'opponentId',g.opponent_fixed_id,'opponentName',g.opponent_name,'opponentMode',g.opponent_mode,
 'status',case when self_game then 'unavailable'when line_id is not null then'verified'when open_dispute or decision='no'then'disputed'when submission_id is not null then'tentative'else'unentered'end,
 'submissionId',case when self_game then null else submission_id end,'verifiedLineId',case when self_game then null else line_id end,
 'result',case when self_game then null when line_id is not null then jsonb_build_object('paperWon',g.is_winner,'margin',g.verified_margin)when submission_id is not null then jsonb_build_object('paperWon',digital_winner=case when target=g.side_a_participant_id then'a'else'b'end,'margin',g.digital_margin)else null end)order by g.card_number,g.match_instance,g.id),'[]'::jsonb)into rows from source g;
 end if;
 if app.manual_mixed_handoff_actor_v1()is distinct from a then return null;end if;
 return jsonb_build_object('kind','manual-paper-card-workspace-v1','actorId',a,'tournamentId',tid,'eventId',eid,'tournamentName',name,'eventName',event_name,'cards',options,'card',case when paper_id is null then null else jsonb_build_object('paperId',paper_id,'displayName',display,'rows',rows)end,'observedAt',clock_timestamp());
 exception when no_data_found or too_many_rows then return null;end$$;
alter function public.get_manual_paper_card_workspace_v1(uuid,uuid,text)owner to postgres;revoke all on function public.get_manual_paper_card_workspace_v1(uuid,uuid,text)from public,anon,authenticated,service_role;
commit;
