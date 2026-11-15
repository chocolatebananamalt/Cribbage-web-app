-- Read-only, role-scoped report for one fully finalized Standard Singles event.
-- The report binds qualification, playoff, settlement draft, and manual
-- reconciliation versions so provisional or superseded claims cannot print.

create or replace function public.get_finalized_standard_singles_event_report_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
with allowed as (
  select 1 where p_actor_id is not null and exists(
    select 1 from app.tournament_roles role_row
    where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id
      and role_row.role in('director','co_director','player','cross_checker','judge','viewer')
  )
), final_version as (
  select finalized.* from app.standard_singles_settlement_final_versions finalized
  where finalized.tournament_id=p_tournament_id and finalized.event_id=p_event_id
  order by finalized.version desc limit 1
), qualification as (
  select result.* from app.qualification_result_versions result join final_version finalized
    on finalized.qualification_result_version_id=result.id
   and finalized.tournament_id=result.tournament_id and finalized.event_id=result.event_id
), playoff as (
  select result.* from app.standard_singles_playoff_result_versions result join final_version finalized
    on finalized.playoff_result_version_id=result.id
   and finalized.tournament_id=result.tournament_id and finalized.event_id=result.event_id
), setup as (
  select revision.* from app.tournament_setup_activations activation
  join app.tournament_setup_revisions revision on revision.id=activation.setup_revision_id
  where activation.tournament_id=p_tournament_id and activation.event_id=p_event_id
), report_source as (
  select finalized.*,qualification.participant_count,qualification.qualifier_count,
    tournament_row.name tournament_name,event_row.name event_name,
    coalesce(to_char(setup.starts_at,'MM-DD-YYYY'),'') tournament_date,
    coalesce(nullif(trim(profile.display_name),''),'Director or co-director') finalized_by
  from final_version finalized join qualification on true join playoff on true
  join app.tournaments tournament_row on tournament_row.id=finalized.tournament_id
  join app.events event_row on event_row.id=finalized.event_id
  left join setup on true left join app.profiles profile on profile.id=finalized.actor_profile_id
  where finalized.settlement_draft_version=(select draft.version from app.standard_singles_settlement_drafts draft
    where draft.id=finalized.settlement_draft_id)
    and not exists(select 1 from app.qualification_result_versions newer
      where newer.event_id=finalized.event_id and newer.version>qualification.version)
    and not exists(select 1 from app.standard_singles_playoff_result_versions newer
      where newer.event_id=finalized.event_id and newer.version>playoff.version)
    and not exists(select 1 from app.standard_singles_settlement_drafts newer
      where newer.event_id=finalized.event_id and newer.version>finalized.settlement_draft_version)
)
select jsonb_build_object(
  'status','finalized_event_report','tournamentId',source.tournament_id,'eventId',source.event_id,
  'tournamentName',source.tournament_name,'tournamentDate',source.tournament_date,'eventName',source.event_name,
  'qualificationResultVersionId',source.qualification_result_version_id,
  'playoffResultVersionId',source.playoff_result_version_id,'settlementDraftId',source.settlement_draft_id,
  'finalizationId',source.id,'finalizationVersion',source.version,'participantCount',source.participant_count,
  'qualifierCount',source.qualifier_count,'currencyCode','USD','finalizedAt',source.finalized_at,
  'finalizedBy',source.finalized_by,'officialSourceReference',source.official_source_reference,
  'playoffPlacements',coalesce((select jsonb_agg(jsonb_build_object(
    'participantId',placement.participant_id,'displayName',placement.display_name_snapshot,
    'placement',placement.placement,'prizeAmountMinor',coalesce(prize.prize_amount_minor,0)) order by placement.placement)
    from app.standard_singles_playoff_placement_rows placement
    left join app.standard_singles_settlement_placements prize
      on prize.settlement_draft_id=source.settlement_draft_id and prize.participant_id=placement.participant_id
    where placement.playoff_result_version_id=source.playoff_result_version_id),'[]'::jsonb),
  'qualifiers',coalesce((select jsonb_agg(jsonb_build_object(
    'participantId',row_data.participant_id,'displayName',row_data.display_name_snapshot,
    'qualificationRank',row_data.ranking_ordinal,'gamePoints',row_data.game_points,'gamesWon',row_data.games_won,
    'plusPoints',row_data.plus_points,'minusPoints',row_data.minus_points,'netSpreadPoints',row_data.net_spread_points,
    'mrpPoints',claim.mrp_points,'qPoolAwardMinor',coalesce(award.q_pool_amount,0),
    'otherAwardMinor',coalesce(award.other_amount,0)) order by row_data.ranking_ordinal)
    from app.qualification_result_rows row_data
    left join app.standard_singles_settlement_mrp_claims claim
      on claim.settlement_draft_id=source.settlement_draft_id and claim.participant_id=row_data.participant_id
    left join lateral(select coalesce(sum(item.amount_minor) filter(where item.award_type='q_pool'),0)::bigint q_pool_amount,
      coalesce(sum(item.amount_minor) filter(where item.award_type='other'),0)::bigint other_amount
      from app.standard_singles_settlement_awards item where item.settlement_draft_id=source.settlement_draft_id
        and item.participant_id=row_data.participant_id) award on true
    where row_data.result_version_id=source.qualification_result_version_id
      and row_data.qualification_status='qualified'),'[]'::jsonb),
  'highNonQualifier',(select jsonb_build_object('participantId',row_data.participant_id,
    'displayName',row_data.display_name_snapshot,'gamePoints',row_data.game_points,'gamesWon',row_data.games_won,
    'plusPoints',row_data.plus_points,'minusPoints',row_data.minus_points,'netSpreadPoints',row_data.net_spread_points)
    from app.qualification_result_rows row_data where row_data.result_version_id=source.qualification_result_version_id
      and row_data.qualification_status='high_non_qualifier'))
from allowed join report_source source on true
$$;

revoke all on function public.get_finalized_standard_singles_event_report_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_finalized_standard_singles_event_report_v1(uuid,uuid,uuid) to service_role;

notify pgrst,'reload schema';
