-- Results navigation includes every configured event. Digital Standard
-- Singles continues through calculated standings; manual/team Satellite
-- events use a separately reviewed reporting workflow and never receive MRPs.
create or replace function public.get_tournament_result_events_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select case when exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('viewer','player','cross_checker','director','co_director')) then jsonb_build_object(
 'tournamentId',tournament.id,'tournamentName',tournament.name,'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',event_row.id,'name',event_row.name,'eventType',event_row.event_type,'format',event_row.format,'scoringMethod',event_row.scoring_method,'participantCount',(select count(*) from app.event_participants participant where participant.event_id=event_row.id)) order by setup_event.ordinal) from app.tournament_setup_activations activation join app.events event_row on event_row.id=activation.event_id and event_row.tournament_id=activation.tournament_id join app.tournament_setup_event_versions setup_event on setup_event.id=activation.setup_event_version_id and setup_event.tournament_id=activation.tournament_id where activation.tournament_id=tournament.id),'[]'::jsonb)) else null end from app.tournaments tournament where tournament.id=p_tournament_id
$$;
revoke all on function public.get_tournament_result_events_v1(uuid,uuid) from public,anon,authenticated;grant execute on function public.get_tournament_result_events_v1(uuid,uuid) to service_role;
notify pgrst,'reload schema';
