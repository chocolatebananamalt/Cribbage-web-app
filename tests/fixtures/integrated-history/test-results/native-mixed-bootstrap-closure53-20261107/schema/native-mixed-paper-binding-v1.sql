-- PRIVATE DEFAULT-OFF per-game Paper metadata. No application grant.
begin;
create function app.get_native_mixed_paper_binding_v1(tid uuid,eid uuid,sid uuid,gid uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;root jsonb;key_id uuid;publication uuid;identity_id uuid;roles_value jsonb;
 people jsonb;tname text;ename text;game_number integer;
begin
 if app.native_mixed_game_writer_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_game_own_subject_v1();if actor is null then return null;end if;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);if root is null then return null;end if;
 lock table app.tournament_roles,app.paper_official_identity_bindings,app.event_participants,
  app.tournament_roster_entries,app.roster_account_links in share mode nowait;
 select jsonb_agg(to_jsonb(role)order by role)into roles_value from app.tournament_roles
  where tournament_id=tid and profile_id=actor and role in('director','co_director','cross_checker');
 if roles_value is null or app.paper_official_identity_is_current_valid(actor,tid)is distinct from true
  or app.paper_official_is_independent(actor,tid,gid)is distinct from true then return null;end if;
 if not exists(select 1 from jsonb_array_elements(root#>'{source,canonicalGames}')x where x->>'gameId'=gid::text)
  or exists(select 1 from app.canonical_games g join app.event_participants p on p.id in(g.side_a_participant_id,g.side_b_participant_id)
   where g.id=gid and g.tournament_id=tid and g.event_id=eid and p.profile_id=actor)then return null;end if;
 select id into identity_id from app.paper_official_identity_bindings
  where tournament_id=tid and official_profile_id=actor order by binding_version desc limit 1;
 select operation_receipt_id into key_id from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
 if identity_id is null or key_id is null then return null;end if;
 publication:=(root#>>'{source,publication,seatingPublicationId}')::uuid;
 select name into tname from app.tournaments where id=tid;select name into ename from app.events where id=eid and tournament_id=tid;
 select rn.round_number into game_number from app.canonical_games g join app.rounds rn on rn.id=g.round_id and rn.event_id=eid
  where g.id=gid and g.tournament_id=tid and g.event_id=eid;
 select jsonb_agg(jsonb_build_object('participantId',p.id,'displayName',r.claimed_display_name,'fixedTournamentId',i.initial_table_seat,
  'currentSeat',case when sides.side='a'then g.side_a_table_seat_snapshot else g.side_b_table_seat_snapshot end,'mode',r.scorecard_type,
  -- Correlation reference only, NEVER a profile/account ID or write authority.
  -- Derivation must match the all-viewer game-state display projection.
  'actorRef',case when r.scorecard_type='digital'then
   substr(encode(extensions.hmac(sid::text||':'||gid::text||':'||p.profile_id::text,key_id::text,'sha256'),'hex'),1,32)::uuid else null end)
  order by sides.side)into people
 from app.canonical_games g cross join lateral(values('a',g.side_a_participant_id),('b',g.side_b_participant_id))sides(side,pid)
 join app.event_participants p on p.id=sides.pid and p.event_id=eid and p.tournament_id=tid
 join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=tid
 join app.initial_seating_assignments i on i.publication_id=publication and i.tournament_id=tid and i.roster_entry_id=r.id
 where g.id=gid and g.tournament_id=tid and g.event_id=eid;
 if jsonb_array_length(people)is distinct from 2 or not exists(select 1 from jsonb_array_elements(people)x where x->>'mode'='paper')then return null;end if;
 return jsonb_build_object('kind','native-mixed-paper-binding-v1','actorId',actor,'sessionId',auth.jwt()->>'session_id',
  'tournamentId',tid,'eventId',eid,'startId',sid,'gameId',gid,'startSourceDigest',root->>'startSourceDigest',
  'tournamentName',tname,'eventName',ename,'gameNumber',game_number,'sideA',people->0,'sideB',people->1,
  'official',jsonb_build_object('roles',roles_value,'identityBindingId',identity_id,'nonselfChecked',true),'simulationOnly',true);
exception when lock_not_available then return null;end$$;
create function public.get_native_mixed_paper_binding_v1(p_tournament_id uuid,p_event_id uuid,p_start_id uuid,p_game_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.native_mixed_game_transport_enabled_v1()is distinct from true then return null;end if;
 return app.get_native_mixed_paper_binding_v1(p_tournament_id,p_event_id,p_start_id,p_game_id);end$$;
alter function app.get_native_mixed_paper_binding_v1(uuid,uuid,uuid,uuid)owner to postgres;
alter function public.get_native_mixed_paper_binding_v1(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function app.get_native_mixed_paper_binding_v1(uuid,uuid,uuid,uuid),public.get_native_mixed_paper_binding_v1(uuid,uuid,uuid,uuid)
 from public,anon,authenticated,service_role;
commit;
