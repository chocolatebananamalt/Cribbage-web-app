-- Private/default-off own-player metadata only. No application grants.
begin;
create function app.get_native_mixed_own_player_bindings_v1(tid uuid,eid uuid,sid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;root jsonb;own_id uuid;own_roster uuid;publication uuid;items jsonb;tname text;ename text;
begin
 if app.native_mixed_game_writer_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_game_own_subject_v1();if actor is null then return null;end if;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);if root is null then return null;end if;
 select p.id,p.roster_entry_id into own_id,own_roster from app.event_participants p
 join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
 join app.roster_account_links l on l.tournament_id=p.tournament_id and l.roster_entry_id=p.roster_entry_id and l.profile_id=p.profile_id
 where p.tournament_id=tid and p.event_id=eid and p.profile_id=actor and r.scorecard_type='digital';
 if own_id is null or(select count(*)from app.event_participants where tournament_id=tid and event_id=eid and profile_id=actor)<>1 then return null;end if;
 publication:=(root#>>'{source,publication,seatingPublicationId}')::uuid;
 select name into tname from app.tournaments where id=tid;select name into ename from app.events where id=eid and tournament_id=tid;
 select jsonb_agg(jsonb_build_object('gameId',g.id,'gameNumber',rn.round_number,'ownSide',case when g.side_a_participant_id=own_id then'a'else'b'end,
  'player',jsonb_build_object('participantId',p.id,'profileId',p.profile_id,'displayName',r.claimed_display_name,'fixedTournamentId',ia.initial_table_seat,
   'currentSeat',case when g.side_a_participant_id=own_id then g.side_a_table_seat_snapshot else g.side_b_table_seat_snapshot end,'mode','digital'),
  'opponent',jsonb_build_object('participantId',other.id,'profileId',null,'displayName',rr.claimed_display_name,
   'fixedTournamentId',ib.initial_table_seat,'currentSeat',case when g.side_a_participant_id=own_id then g.side_b_table_seat_snapshot else g.side_a_table_seat_snapshot end,'mode',rr.scorecard_type))order by rn.round_number)into items
 from app.canonical_games g join app.rounds rn on rn.id=g.round_id and rn.event_id=eid
 join app.event_participants p on p.id=own_id and p.event_id=eid
 join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=tid
 join app.event_participants other on other.id=case when g.side_a_participant_id=own_id then g.side_b_participant_id else g.side_a_participant_id end and other.event_id=eid
 join app.tournament_roster_entries rr on rr.id=other.roster_entry_id and rr.tournament_id=tid
 join app.initial_seating_assignments ia on ia.publication_id=publication and ia.tournament_id=tid and ia.roster_entry_id=p.roster_entry_id
 join app.initial_seating_assignments ib on ib.publication_id=publication and ib.tournament_id=tid and ib.roster_entry_id=other.roster_entry_id
 where g.tournament_id=tid and g.event_id=eid and own_id in(g.side_a_participant_id,g.side_b_participant_id)
 and exists(select 1 from jsonb_array_elements(root#>'{source,canonicalGames}')x where x->>'gameId'=g.id::text);
 if jsonb_array_length(items)is distinct from 12 then return null;end if;
 return jsonb_build_object('kind','native-mixed-own-player-bindings-v1','actorId',actor,'sessionId',auth.jwt()->>'session_id','tournamentId',tid,'eventId',eid,
 'startId',sid,'startSourceDigest',root->>'startSourceDigest','tournamentName',tname,'eventName',ename,'simulationOnly',true,'bindings',items);
exception when lock_not_available then return null;end$$;
create function public.get_native_mixed_own_player_bindings_v1(p_tournament_id uuid,p_event_id uuid,p_start_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.native_mixed_game_transport_enabled_v1()is distinct from true then return null;end if;
 return app.get_native_mixed_own_player_bindings_v1(p_tournament_id,p_event_id,p_start_id);end$$;
alter function app.get_native_mixed_own_player_bindings_v1(uuid,uuid,uuid)owner to postgres;
alter function public.get_native_mixed_own_player_bindings_v1(uuid,uuid,uuid)owner to postgres;
revoke all on function app.get_native_mixed_own_player_bindings_v1(uuid,uuid,uuid),public.get_native_mixed_own_player_bindings_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
