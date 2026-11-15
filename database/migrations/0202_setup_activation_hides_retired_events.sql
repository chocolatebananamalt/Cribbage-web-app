-- Setup activation history is immutable. Retired events remain preserved for
-- audit/reporting, but they are not current events available for enrollment
-- or team-scoring upgrades in the director's active Setup screen.

create or replace function public.get_tournament_setup_activation_state_v3(
  p_actor_id uuid, p_tournament_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  with allowed as (
    select 1 where p_actor_id is not null and p_tournament_id is not null and exists (
      select 1 from app.tournament_roles role_row where role_row.tournament_id = p_tournament_id
        and role_row.profile_id = p_actor_id and role_row.role in ('director','co_director')
    )
  ), latest as (
    select revision.id, revision.version from app.tournament_setup_revisions revision, allowed
    where revision.tournament_id = p_tournament_id order by revision.version desc limit 1
  ), activated_events as (
    select jsonb_agg(jsonb_build_object(
      'eventId',event.id,'eventType',event.event_type,'name',event.name,'format',event.format,
      'scoringMethod',event.scoring_method,'gameCount',setup_event.game_count
    ) order by activation.created_at, setup_event.ordinal, event.id) value
    from app.tournament_setup_activations activation
    join app.events event on event.id = activation.event_id and event.tournament_id = activation.tournament_id
    join app.tournament_setup_event_versions setup_event on setup_event.id = activation.setup_event_version_id
      and setup_event.tournament_id = activation.tournament_id
    where activation.tournament_id = p_tournament_id and event.operational_state = 'active'
  )
  select case when not exists(select 1 from allowed) then null
    when not exists(select 1 from app.tournament_setup_activations activation join app.events event on event.id=activation.event_id and event.tournament_id=activation.tournament_id where activation.tournament_id=p_tournament_id and event.operational_state='active')
      then jsonb_build_object('status','not_activated')
    else jsonb_build_object(
      'status','activated','setupRevisionId',latest.id,'setupVersion',latest.version,
      'eventCount',jsonb_array_length(coalesce(activated_events.value,'[]'::jsonb)),
      'events',coalesce(activated_events.value,'[]'::jsonb)
    ) end
  from allowed left join latest on true left join activated_events on true
$$;

revoke all on function public.get_tournament_setup_activation_state_v3(uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_tournament_setup_activation_state_v3(uuid,uuid) to service_role;

notify pgrst, 'reload schema';
