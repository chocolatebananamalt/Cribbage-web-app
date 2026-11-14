-- PRIVATE DEFAULT-OFF matchup directory. No scores, evidence, pending status,
-- account IDs, actor aliases, assignment or review authority are returned.
begin;
create function app.native_mixed_paper_directory_enabled_v1()returns boolean
language sql stable security definer set search_path=''as $$select false$$;
create function app.get_native_mixed_paper_directory_v1(tid uuid,eid uuid,sid uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;root jsonb;publication uuid;games_value jsonb;tname text;ename text;
begin
 if app.native_mixed_paper_directory_enabled_v1()is distinct from true
  or app.native_mixed_game_writer_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_game_own_subject_v1();if actor is null then return null;end if;
 lock table app.tournament_roles,app.paper_official_identity_bindings,app.event_participants,
  app.tournament_roster_entries,app.roster_account_links in share mode nowait;
 if not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor
  and role in('director','co_director','cross_checker'))
  or app.paper_official_identity_is_current_valid(actor,tid)is distinct from true then return null;end if;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);if root is null then return null;end if;
 -- Bounded to the reviewed 18-player/12-game rehearsal; not a generic event reader.
 if jsonb_array_length(root#>'{source,canonicalGames}')is distinct from 108 then return null;end if;
 publication:=(root#>>'{source,publication,seatingPublicationId}')::uuid;
 select name into tname from app.tournaments where id=tid;
 select name into ename from app.events where id=eid and tournament_id=tid;
 select coalesce(jsonb_agg(jsonb_build_object('gameId',g.id,'gameNumber',rn.round_number,
  'sideA',jsonb_build_object('displayName',ra.claimed_display_name,'fixedTournamentId',ia.initial_table_seat,
   'currentSeat',g.side_a_table_seat_snapshot,'mode',ra.scorecard_type),
  'sideB',jsonb_build_object('displayName',rb.claimed_display_name,'fixedTournamentId',ib.initial_table_seat,
   'currentSeat',g.side_b_table_seat_snapshot,'mode',rb.scorecard_type))order by rn.round_number,g.id),'[]'::jsonb)
 into games_value
 from app.canonical_games g
 join app.rounds rn on rn.id=g.round_id and rn.event_id=eid
 join app.event_participants pa on pa.id=g.side_a_participant_id and pa.tournament_id=tid and pa.event_id=eid
 join app.event_participants pb on pb.id=g.side_b_participant_id and pb.tournament_id=tid and pb.event_id=eid
 join app.tournament_roster_entries ra on ra.id=pa.roster_entry_id and ra.tournament_id=tid
 join app.tournament_roster_entries rb on rb.id=pb.roster_entry_id and rb.tournament_id=tid
 join app.initial_seating_assignments ia on ia.publication_id=publication and ia.tournament_id=tid and ia.roster_entry_id=ra.id
 join app.initial_seating_assignments ib on ib.publication_id=publication and ib.tournament_id=tid and ib.roster_entry_id=rb.id
 where g.tournament_id=tid and g.event_id=eid
  and exists(select 1 from jsonb_array_elements(root#>'{source,canonicalGames}')x where x->>'gameId'=g.id::text)
  and(ra.scorecard_type='paper'or rb.scorecard_type='paper')
  and pa.profile_id is distinct from actor and pb.profile_id is distinct from actor
  and app.paper_official_is_independent(actor,tid,g.id)is true;
 return jsonb_build_object('kind','native-mixed-paper-directory-v1','actorId',actor,'sessionId',auth.jwt()->>'session_id',
  'tournamentId',tid,'eventId',eid,'startId',sid,'startSourceDigest',root->>'startSourceDigest',
  'tournamentName',tname,'eventName',ename,'simulationOnly',true,'games',games_value);
exception when lock_not_available then return null;end$$;
create function public.get_native_mixed_paper_directory_v1(p_tournament_id uuid,p_event_id uuid,p_start_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.native_mixed_game_transport_enabled_v1()is distinct from true then return null;end if;
 return app.get_native_mixed_paper_directory_v1(p_tournament_id,p_event_id,p_start_id);end$$;
alter function app.native_mixed_paper_directory_enabled_v1()owner to postgres;
alter function app.get_native_mixed_paper_directory_v1(uuid,uuid,uuid)owner to postgres;
alter function public.get_native_mixed_paper_directory_v1(uuid,uuid,uuid)owner to postgres;
revoke all on function app.native_mixed_paper_directory_enabled_v1(),app.get_native_mixed_paper_directory_v1(uuid,uuid,uuid),
 public.get_native_mixed_paper_directory_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
