-- Team standings use the ACC score-card ordering, but a numeric tie at the
-- qualification boundary is never broken by a person's or team's name.
create or replace function public.get_event_team_results_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
with summaries as (
  select t.name tournament_name,e.id event_id,e.name event_name,e.format,e.event_type,te.id team_entry_id,team.display_name team_name,
    coalesce(sum(sl.game_points),0)::integer game_points,coalesce(count(*) filter(where sl.is_winner),0)::integer games_won,
    coalesce(sum(sl.plus_points),0)::integer plus_points,coalesce(sum(sl.minus_points),0)::integer minus_points,
    coalesce(sum(sl.plus_points-sl.minus_points),0)::integer net_points
  from app.events e join app.tournaments t on t.id=e.tournament_id join app.event_team_entries te on te.event_id=e.id join app.event_teams team on team.id=te.team_id
  left join app.event_team_scorelines sl on sl.team_entry_id=te.id and exists(select 1 from app.event_team_games g where g.id=sl.team_game_id and g.state in('verified','corrected'))
  where e.id=p_event_id and e.tournament_id=p_tournament_id
  group by t.name,e.id,e.name,e.format,e.event_type,te.id,team.display_name
), scored as (
  select *,rank() over(order by game_points desc,games_won desc,net_points desc,plus_points desc,minus_points asc) numeric_rank,
    count(*) over(partition by game_points,games_won,net_points,plus_points,minus_points) tie_size,
    count(*) over() total_count
  from summaries
), annotated as (
  select *,case when event_type='satellite' then 0 else ceil(total_count::numeric/4.0)::integer end qualification_count,
    event_type<>'satellite' and numeric_rank<=ceil(total_count::numeric/4.0)::integer
      and numeric_rank+tie_size-1>ceil(total_count::numeric/4.0)::integer boundary_tie
  from scored
), authority as (
  select (exists(select 1 from app.tournament_roles role where role.tournament_id=p_tournament_id and role.profile_id=p_actor_id)
      or exists(select 1 from app.event_team_entries entry join app.event_team_members member on member.team_id=entry.team_id where entry.event_id=p_event_id and entry.tournament_id=p_tournament_id and member.profile_id=p_actor_id)) can_read,
    exists(select 1 from app.tournament_roles role where role.tournament_id=p_tournament_id and role.profile_id=p_actor_id and role.role in('director','co_director','cross_checker','judge')) can_see_acc
)
select case when authority.can_read then jsonb_build_object(
  'tournamentName',(array_agg(a.tournament_name))[1],
  'eventId',(array_agg(a.event_id))[1],
  'eventName',(array_agg(a.event_name))[1],
  'format',(array_agg(a.format))[1],
  'eventType',(array_agg(a.event_type))[1],
  'qualificationCount',(array_agg(a.qualification_count))[1],
  'qualificationBlocked',coalesce(bool_or(a.boundary_tie),false),
  'mrps',case when (array_agg(a.event_type))[1]='satellite' then 'not_applicable_satellite' else 'eligible_after_review' end,
  'entries',coalesce(jsonb_agg(jsonb_build_object(
    'rank',a.numeric_rank,'teamEntryId',a.team_entry_id,'teamName',a.team_name,
    'members',(select jsonb_agg(jsonb_build_object('name',member.claimed_display_name,'accNumber',case when authority.can_see_acc then member.claimed_acc_number else null end) order by tm.member_role)
      from app.event_team_members tm join app.tournament_roster_entries member on member.id=tm.roster_entry_id
      where tm.team_id=(select entry.team_id from app.event_team_entries entry where entry.id=a.team_entry_id)),
    'gamePoints',a.game_points,'gamesWon',a.games_won,'plusSpreadPoints',a.plus_points,'minusSpreadPoints',a.minus_points,'netSpreadPoints',a.net_points,
    'qualifies',a.event_type<>'satellite' and not a.boundary_tie and a.numeric_rank+a.tie_size-1<=a.qualification_count,
    'qualificationStatus',case when a.event_type='satellite' then 'not_applicable' when a.boundary_tie then 'tie_review_required' when a.numeric_rank+a.tie_size-1<=a.qualification_count then 'qualified' else 'not_qualified' end
  ) order by a.game_points desc,a.games_won desc,a.net_points desc,a.plus_points desc,a.minus_points asc,a.team_name),'[]'::jsonb)
) else null end
from annotated a cross join authority
group by authority.can_read
$$;
revoke all on function public.get_event_team_results_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_event_team_results_v1(uuid,uuid,uuid) to service_role;

notify pgrst,'reload schema';
