-- 0219 -- Players can read their own tournament results.
--
-- A player who is checked in to an event has no row in app.tournament_roles.
-- Directors, co-directors, judges, cross-checkers and viewers do; a player only
-- ever becomes one if somebody adds them by hand. Seven read RPCs nevertheless
-- gate on that table while listing 'player' among the roles they accept, so for
-- an ordinary competitor every one of them returns null or an empty array. On
-- the tournament floor that reads as Results 404ing for everyone who played.
--
-- public.get_tournament_role already solved this in the singular: it unions a
-- derived 'player' onto the real rows when the caller is a checked-in
-- participant. This migration lifts that same rule into a view and points the
-- seven gates at it, so "who counts as a player here" is defined once instead of
-- seven times.
--
-- Each function below is reproduced verbatim from the migration that already
-- defines it, with one table reference changed and nothing else. Every body was
-- md5-verified against the live production definition before being copied, so
-- these are no-ops apart from the gate.

create or replace view app.tournament_roles_effective as
  select tournament_id, profile_id, role
  from app.tournament_roles
  union
  -- A checked-in competitor is a player whether or not anyone recorded a role
  -- row for them. 'union' rather than 'union all' so a player who also holds a
  -- real 'player' row is not counted twice by callers that aggregate.
  select participant.tournament_id, participant.profile_id, 'player'::text
  from app.event_participants participant
  where participant.profile_id is not null
    and participant.status = 'checked_in';

comment on view app.tournament_roles_effective is
  'app.tournament_roles plus a derived player role for checked-in participants. Mirrors public.get_tournament_role. Read by the tournament read-gates; never written to.';

revoke all on app.tournament_roles_effective from public, anon, authenticated;

-- get_tournament_roles_v1: gate only, lifted from 0211_setup_official_management_timezones_and_fee_controls.sql
create or replace function public.get_tournament_roles_v1(p_tournament_id uuid)
returns text[] language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(role order by case role when 'director' then 1 when 'co_director' then 2 when 'judge' then 3 when 'cross_checker' then 4 when 'player' then 5 else 6 end),array[]::text[])
  from app.tournament_roles_effective where tournament_id=p_tournament_id and profile_id=auth.uid()
$$;

-- get_tournament_result_events_v1: gate only, lifted from 0167_all_event_results_discovery.sql
create or replace function public.get_tournament_result_events_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select case when exists(select 1 from app.tournament_roles_effective role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('viewer','player','cross_checker','director','co_director')) then jsonb_build_object(
 'tournamentId',tournament.id,'tournamentName',tournament.name,'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',event_row.id,'name',event_row.name,'eventType',event_row.event_type,'format',event_row.format,'scoringMethod',event_row.scoring_method,'participantCount',(select count(*) from app.event_participants participant where participant.event_id=event_row.id)) order by setup_event.ordinal) from app.tournament_setup_activations activation join app.events event_row on event_row.id=activation.event_id and event_row.tournament_id=activation.tournament_id join app.tournament_setup_event_versions setup_event on setup_event.id=activation.setup_event_version_id and setup_event.tournament_id=activation.tournament_id where activation.tournament_id=tournament.id),'[]'::jsonb)) else null end from app.tournaments tournament where tournament.id=p_tournament_id
$$;

-- get_preliminary_event_standings: gate only, lifted from 0169_late_player_schedule_amendments.sql
create or replace function public.get_preliminary_event_standings(
  p_tournament_id uuid,
  p_event_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with authorized_event as (
    select tournament_row.id as tournament_id, tournament_row.name as tournament_name,
      event_row.id as event_id, event_row.name as event_name,
      coalesce(setup_event.game_count, publication.game_count)::integer as configured_game_count,
      publication.id is not null as schedule_published,
      coalesce(publication.match_count, 0)::integer as scheduled_match_count
    from app.tournaments tournament_row
    join app.events event_row on event_row.tournament_id = tournament_row.id
      and event_row.id = p_event_id
    join app.ruleset_versions ruleset on ruleset.id = event_row.ruleset_version_id
      and ruleset.tournament_id = event_row.tournament_id
      and ruleset.format = 'standard_singles' and ruleset.approved_at is not null
    left join app.tournament_setup_activations activation
      on activation.tournament_id = event_row.tournament_id
      and activation.event_id = event_row.id
    left join app.tournament_setup_event_versions setup_event
      on setup_event.id = activation.setup_event_version_id
      and setup_event.tournament_id = activation.tournament_id
    left join app.event_schedule_publications publication
      on publication.tournament_id = event_row.tournament_id
      and publication.event_id = event_row.id
    where tournament_row.id = p_tournament_id
      and event_row.format = 'standard_singles'
      and event_row.scoring_method = 'digital'
      and (select auth.uid()) is not null
      and exists (
        select 1 from app.tournament_roles_effective role_row
        where role_row.tournament_id = tournament_row.id
          and role_row.profile_id = (select auth.uid())
          and role_row.role in ('director','co_director','player','cross_checker','judge','viewer')
      )
  ), match_evidence as (
    select authorized_event.tournament_id, authorized_event.event_id,
      count(game.id)::integer as persisted_match_count,
      count(game.id) filter (where app.game_is_authoritatively_resolved_v1(game.id))::integer as resolved_match_count
    from authorized_event
    left join app.canonical_games game
      on game.tournament_id = authorized_event.tournament_id
      and game.event_id = authorized_event.event_id
    group by authorized_event.tournament_id, authorized_event.event_id
  ), totals as (
    select participant.id as participant_id,
      participant.status as participant_status,
      coalesce(nullif(trim(roster.claimed_display_name), ''), nullif(trim(profile.display_name), '')) as display_name,
      coalesce(sum(line.game_points), 0)::integer as game_points,
      count(*) filter (where line.is_winner)::integer as games_won,
      coalesce(sum(line.plus_points), 0)::integer as plus_points,
      coalesce(sum(line.minus_points), 0)::integer as minus_points,
      count(line.line_id)::integer as verified_games
    from authorized_event
    join app.event_participants participant
      on participant.tournament_id = authorized_event.tournament_id
      and participant.event_id = authorized_event.event_id
    left join app.tournament_roster_entries roster
      on roster.id = participant.roster_entry_id
      and roster.tournament_id = participant.tournament_id
    left join app.profiles profile on profile.id = participant.profile_id
    left join lateral (
      select effective.*
      from app.current_effective_scorelines(
        authorized_event.tournament_id, authorized_event.event_id
      ) effective where effective.participant_id = participant.id
    ) line on true
    where coalesce(nullif(trim(roster.claimed_display_name), ''), nullif(trim(profile.display_name), '')) is not null
    group by participant.id, participant.status,
      coalesce(nullif(trim(roster.claimed_display_name), ''), nullif(trim(profile.display_name), ''))
  ), ranked as (
    select totals.*,
      rank() over (order by game_points desc, games_won desc,
        (plus_points - minus_points) desc, plus_points desc)::integer as numeric_rank,
      count(*) over (partition by game_points, games_won,
        (plus_points - minus_points), plus_points)::integer as tied_count
    from totals
  )
  select jsonb_build_object(
    'tournamentId', authorized_event.tournament_id,
    'eventId', authorized_event.event_id,
    'tournamentName', authorized_event.tournament_name,
    'eventName', authorized_event.event_name,
    'status', 'preliminary',
    'configuredGameCount', authorized_event.configured_game_count,
    'schedulePublished', authorized_event.schedule_published,
    'scheduledMatchCount', authorized_event.scheduled_match_count,
    'persistedMatchCount', evidence.persisted_match_count,
    'resolvedMatchCount', evidence.resolved_match_count,
    'scheduledScorecardsComplete', authorized_event.schedule_published
      and authorized_event.configured_game_count is not null
      and authorized_event.scheduled_match_count > 0
      and evidence.persisted_match_count = authorized_event.scheduled_match_count
      and evidence.resolved_match_count = authorized_event.scheduled_match_count
      and exists (select 1 from totals)
      and not exists (select 1 from totals item
        where item.verified_games <> authorized_event.configured_game_count),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'participantId', row_data.participant_id,
      'displayName', row_data.display_name,
      'participantStatus', row_data.participant_status,
      'verifiedGames', row_data.verified_games,
      'gamePoints', row_data.game_points,
      'gamesWon', row_data.games_won,
      'plusPoints', row_data.plus_points,
      'minusPoints', row_data.minus_points,
      'netSpreadPoints', row_data.plus_points - row_data.minus_points,
      'numericRank', row_data.numeric_rank,
      'tied', row_data.tied_count > 1
    ) order by row_data.numeric_rank, row_data.display_name, row_data.participant_id)
    from ranked row_data), '[]'::jsonb)
  )
  from authorized_event
  join match_evidence evidence on evidence.tournament_id = authorized_event.tournament_id
    and evidence.event_id = authorized_event.event_id
$$;

-- get_satellite_results_workspace_v1: gate only, lifted from 0171_satellite_results_reporting.sql
create or replace function public.get_satellite_results_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from app.tournament_roles_effective where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director','cross_checker','viewer','player')) then jsonb_build_object(
  'tournamentName',tournament.name,'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',event_row.id,'name',event_row.name,'format',event_row.format,'scoringMethod',event_row.scoring_method,
   'participants',coalesce((select jsonb_agg(jsonb_build_object('participantId',participant.id,'displayName',coalesce(roster.claimed_display_name,profile.display_name)) order by coalesce(roster.claimed_display_name,profile.display_name)) from app.event_participants participant left join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id left join app.profiles profile on profile.id=participant.profile_id where participant.event_id=event_row.id),'[]'::jsonb),
   'current',case when current.id is null then null else jsonb_build_object('packageId',current.package_id,'versionId',current.id,'version',current.version,'status',current.status,'placements',current.placements,'specialHands',current.special_hands,'directorNotes',current.director_notes,'crossCheckComplete',current.cross_check_complete,'mrpStatus',current.mrp_status,'qualificationEffect',current.qualification_effect,'retentionUntil',current.retention_until,'approvedBy',approver.display_name,'approvedAt',current.created_at) end
  ) order by event_row.name) from app.events event_row left join app.satellite_result_packages package on package.event_id=event_row.id left join lateral(select * from app.satellite_result_versions version_row where version_row.package_id=package.id order by version_row.version desc limit 1)current on true left join app.profiles approver on approver.id=current.approved_by_profile_id where event_row.tournament_id=tournament.id and event_row.event_type='satellite'),'[]'::jsonb)
 ) else null end from app.tournaments tournament where tournament.id=p_tournament_id
$$;

-- get_standard_singles_qualification_result_v1: gate only, lifted from 0131_standard_singles_qualification_finalization.sql
create or replace function public.get_standard_singles_qualification_result_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
  select case when p_actor_id is not null and exists(select 1 from app.tournament_roles_effective role_row
    where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id
      and role_row.role in ('director','co_director','player','cross_checker','judge','viewer')) then
    jsonb_build_object('status','qualification_finalized','tournamentId',result.tournament_id,
      'eventId',result.event_id,'resultVersionId',result.id,'version',result.version,
      'tournamentName',tournament_row.name,'eventName',event_row.name,
      'participantCount',result.participant_count,'qualifierCount',result.qualifier_count,
      'finalizedAt',result.finalized_at,'finalizedBy',profile.display_name,
      'qualifiers',coalesce((select jsonb_agg(jsonb_build_object('participantId',row_data.participant_id,
        'displayName',row_data.display_name_snapshot,'qualificationRank',row_data.ranking_ordinal,
        'numericRank',row_data.numeric_rank,'tied',row_data.tied,'verifiedGames',row_data.verified_games,
        'gamePoints',row_data.game_points,'gamesWon',row_data.games_won,'plusPoints',row_data.plus_points,
        'minusPoints',row_data.minus_points,'netSpreadPoints',row_data.net_spread_points)
        order by row_data.ranking_ordinal) from app.qualification_result_rows row_data
        where row_data.result_version_id=result.id and row_data.qualification_status='qualified'),'[]'::jsonb),
      'highNonQualifier',(select jsonb_build_object('participantId',row_data.participant_id,
        'displayName',row_data.display_name_snapshot,'numericRank',row_data.numeric_rank,
        'verifiedGames',row_data.verified_games,'gamePoints',row_data.game_points,'gamesWon',row_data.games_won,
        'plusPoints',row_data.plus_points,'minusPoints',row_data.minus_points,'netSpreadPoints',row_data.net_spread_points)
        from app.qualification_result_rows row_data where row_data.result_version_id=result.id
          and row_data.qualification_status='high_non_qualifier'),
      'playoffResultsAvailable',false,'financialAwardsCalculated',false,'officialAccExportAvailable',false)
    else null end
  from app.qualification_result_versions result
  join app.tournaments tournament_row on tournament_row.id=result.tournament_id
  join app.events event_row on event_row.id=result.event_id
  join app.profiles profile on profile.id=result.finalized_by_profile_id
  where result.tournament_id=p_tournament_id and result.event_id=p_event_id
  order by result.version desc limit 1
$$;

-- get_finalized_standard_singles_event_report_v1: gate only, lifted from 0153_finalized_event_results_report.sql
create or replace function public.get_finalized_standard_singles_event_report_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
with allowed as (
  select 1 where p_actor_id is not null and exists(
    select 1 from app.tournament_roles_effective role_row
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

-- get_event_side_pool_workspace_base_v1: gate only, lifted from 0170_operational_side_pools.sql
create or replace function public.get_event_side_pool_workspace_base_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select case when exists(select 1 from app.tournament_roles_effective role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director','player','cross_checker','judge','viewer')) then jsonb_build_object(
 'tournamentName',tournament.name,'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',event_row.id,'name',event_row.name,'eventType',event_row.event_type,'pools',coalesce((select jsonb_agg(jsonb_build_object(
   'poolId',definition.pool_id,'version',definition.version,'categoryCode',definition.category_code,'displayName',definition.display_name,'entryFeeMinor',definition.entry_fee_minor,
   'policy',case when policy.id is null then null else jsonb_build_object('version',policy.version,'payoutRatioDenominator',policy.payout_ratio_denominator,'postedPayoutSchedule',policy.posted_payout_schedule,'postedBeforePlay',policy.posted_before_play) end,
   'elections',coalesce((select jsonb_agg(jsonb_build_object('electionId',election.election_id,'participantId',election.participant_id,'displayName',coalesce(roster.claimed_display_name,profile.display_name),'version',election.version,'elected',election.elected,'amountDueMinor',election.amount_due_minor,'amountReceivedMinor',election.amount_received_minor,'amountRemainingMinor',election.amount_due_minor-election.amount_received_minor,'paymentMethod',election.payment_method,'paymentReference',election.payment_reference) order by coalesce(roster.claimed_display_name,profile.display_name)) from(select distinct on(e.participant_id) e.* from app.event_side_pool_election_versions e where e.pool_id=definition.pool_id order by e.participant_id,e.version desc)election join app.event_participants participant on participant.id=election.participant_id left join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id left join app.profiles profile on profile.id=participant.profile_id),'[]'::jsonb),
   'payouts',coalesce((select jsonb_agg(jsonb_build_object('payoutId',payout.payout_id,'participantId',payout.participant_id,'displayName',coalesce(roster.claimed_display_name,profile.display_name),'version',payout.version,'placement',payout.placement,'amountMinor',payout.amount_minor,'voided',payout.voided) order by payout.placement) from(select distinct on(p.payout_id)p.* from app.event_side_pool_payout_versions p where p.pool_id=definition.pool_id order by p.payout_id,p.version desc)payout join app.event_participants participant on participant.id=payout.participant_id left join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id left join app.profiles profile on profile.id=participant.profile_id where not payout.voided),'[]'::jsonb),
   'collectedMinor',coalesce((select sum(e.amount_received_minor) from(select distinct on(x.participant_id)x.* from app.event_side_pool_election_versions x where x.pool_id=definition.pool_id order by x.participant_id,x.version desc)e where e.elected),0),
   'paidMinor',coalesce((select sum(p.amount_minor) from(select distinct on(x.payout_id)x.* from app.event_side_pool_payout_versions x where x.pool_id=definition.pool_id order by x.payout_id,x.version desc)p where not p.voided),0),
   'finalized',exists(select 1 from app.event_side_pool_reconciliations r where r.pool_id=definition.pool_id)
 ) order by definition.entry_fee_minor) from(select distinct on(d.pool_id)d.* from app.event_side_pool_definition_versions d where d.event_id=event_row.id order by d.pool_id,d.version desc)definition left join lateral(select * from app.event_side_pool_policy_versions p where p.pool_id=definition.pool_id order by p.version desc limit 1)policy on true where definition.active),'[]'::jsonb),
 'participants',coalesce((select jsonb_agg(jsonb_build_object('participantId',participant.id,'displayName',coalesce(roster.claimed_display_name,profile.display_name)) order by coalesce(roster.claimed_display_name,profile.display_name)) from app.event_participants participant left join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id left join app.profiles profile on profile.id=participant.profile_id where participant.event_id=event_row.id),'[]'::jsonb)) order by event_row.event_type,event_row.name) from app.events event_row where event_row.tournament_id=tournament.id),'[]'::jsonb)
) else null end from app.tournaments tournament where tournament.id=p_tournament_id
$$;

-- app.event_qr_player_is_paid_and_enrolled took the newest payment row by
-- version and compared its amount to the amount owed, without checking what
-- kind of row it was. A void carries the full amount of the payment it
-- reverses (0040), so voiding a payment left the QR gate still reading as paid
-- and the player could self check in without settling.
--
-- The desk already answers this question correctly in
-- get_event_check_in_workspace_v1: newest row by version, and it must be a
-- 'received'. This makes the QR gate agree with the desk rather than invent a
-- second rule. event_type is constrained to exactly 'received' or 'voided'.
create or replace function app.event_qr_player_is_paid_and_enrolled(p_tournament_id uuid, p_event_id uuid, p_roster_entry_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from app.event_participants participant
    where participant.tournament_id=p_tournament_id and participant.event_id=p_event_id
      and participant.roster_entry_id=p_roster_entry_id
  ) and exists (
    select 1 from lateral (
      select obligation.amount_owed_minor from app.roster_payment_obligation_versions obligation
      where obligation.tournament_id=p_tournament_id and obligation.roster_entry_id=p_roster_entry_id
      order by obligation.version desc limit 1
    ) owed
    left join lateral (
      select receipt.event_type, receipt.amount_minor from app.roster_payment_events receipt
      where receipt.tournament_id=p_tournament_id and receipt.roster_entry_id=p_roster_entry_id
      order by receipt.version desc limit 1
    ) received on true
    where coalesce(case when received.event_type = 'received' then received.amount_minor else 0 end, 0) >= owed.amount_owed_minor
  )
$$;
