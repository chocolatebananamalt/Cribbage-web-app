-- LOCAL PROPOSAL ONLY. No hosted install/grant or gate activation authorized.
-- Existing ordinary schedule publications only; native sources stay separate.
create function app.director_unresolved_queue_enabled_v31() returns boolean
language sql stable set search_path='' as $$ select false $$;
revoke all on function app.director_unresolved_queue_enabled_v31() from public,anon,authenticated,service_role;

create function public.get_director_unresolved_games_v31(p_actor_id uuid,p_tournament_id uuid,p_after_game_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when app.director_unresolved_queue_enabled_v31() and exists(
  select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director'))
 then (
  with unresolved as (
   select g.id,e.id event_id,e.name event_name,r.round_number,g.match_instance,g.state,
    coalesce(ra.claimed_display_name,pa.display_name) name_a,coalesce(sa.verification_id,a.table_seat) fixed_a,g.side_a_table_seat_snapshot chair_a,
    coalesce(rb.claimed_display_name,pb.display_name) name_b,coalesce(sb.verification_id,b.table_seat) fixed_b,g.side_b_table_seat_snapshot chair_b
   from app.canonical_games g
   join app.events e on e.id=g.event_id and e.tournament_id=g.tournament_id
   join app.event_schedule_games sg on sg.canonical_game_id=g.id and sg.tournament_id=g.tournament_id and sg.event_id=g.event_id
   join app.event_schedule_publications sp on sp.id=sg.publication_id and sp.tournament_id=g.tournament_id and sp.event_id=g.event_id
   join app.rounds r on r.id=g.round_id and r.tournament_id=g.tournament_id and r.event_id=g.event_id
   join app.event_participants a on a.id=g.side_a_participant_id and a.tournament_id=g.tournament_id and a.event_id=g.event_id
   join app.event_participants b on b.id=g.side_b_participant_id and b.tournament_id=g.tournament_id and b.event_id=g.event_id
   left join app.tournament_roster_entries ra on ra.id=a.roster_entry_id and ra.tournament_id=g.tournament_id
   left join app.tournament_roster_entries rb on rb.id=b.roster_entry_id and rb.tournament_id=g.tournament_id
   left join app.profiles pa on pa.id=a.profile_id
   left join app.profiles pb on pb.id=b.profile_id
   left join app.initial_seating_assignments sa on sa.roster_entry_id=a.roster_entry_id and sa.tournament_id=g.tournament_id
   left join app.initial_seating_assignments sb on sb.roster_entry_id=b.roster_entry_id and sb.tournament_id=g.tournament_id
   where g.tournament_id=p_tournament_id and e.operational_state='active'
    and e.format='standard_singles' and e.scoring_method='digital'
    and sp.source_method in('director_csv','director_entry')
    and not app.game_is_authoritatively_resolved_v1(g.id)
  ), page as (select * from unresolved where p_after_game_id is null or id>p_after_game_id order by id limit 101), numbered as (
   select *,row_number() over(order by id) n from page
  ) select jsonb_build_object('kind','director-unresolved-games-v31','actorId',p_actor_id,'tournamentId',p_tournament_id,
   'scope','ordinary-standard-singles-digital-events','observedAt',to_char(statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'afterGameId',p_after_game_id,'totalUnresolved',(select count(*) from unresolved),'hasMore',count(*)>100,
   'nextCursor',case when count(*)>100 then (select id from numbered where n=100) else null end,
   'rows',coalesce(jsonb_agg(jsonb_build_object('gameId',id,'eventId',event_id,'eventName',event_name,'gameNumber',round_number,
    'matchInstance',match_instance,'state',state,
    'sideA',jsonb_build_object('name',name_a,'fixedId',fixed_a,'chair',chair_a),
    'sideB',jsonb_build_object('name',name_b,'fixedId',fixed_b,'chair',chair_b)) order by id) filter(where n<=100),'[]'::jsonb)) from numbered
 ) else null end
$$;
revoke all on function public.get_director_unresolved_games_v31(uuid,uuid,uuid) from public,anon,authenticated,service_role;
-- No GRANT. The normal-client/server reader and route are independently OFF.
