-- Server-authoritative, read-only R-FINAL-01 readiness report. This combines
-- only evidence that exists today and fails closed for missing dispute,
-- event-lifecycle, schedule-completeness, seating/eligibility,
-- finance-reconciliation, attachment, result-version, and approval stores.
-- It creates no result, qualifier, MRP, Q-pool, payout, eligibility, export,
-- publication, payment, correction, score, or finalization authority.

create or replace function public.get_event_finalization_readiness_v1(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_event_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tournament_name text;
  v_tournament_status text;
  v_event_name text;
  v_scoring_method text;
  v_ruleset_source text;
  v_ruleset_approved boolean;
  v_publication_state text;
  v_configured_games integer := 0;
  v_verified_games integer := 0;
  v_corrected_games integer := 0;
  v_pending_games integer := 0;
  v_submitted_games integer := 0;
  v_mismatch_games integer := 0;
  v_confirmation_pending_games integer := 0;
  v_invalid_scoreline_games integer := 0;
  v_legacy_pending_corrections integer := 0;
  v_independent_pending_corrections integer := 0;
  v_roster_entries integer := 0;
  v_active_receipts integer := 0;
  v_voided_payments integer := 0;
  v_unrecorded_payments integer := 0;
  v_payment_events integer := 0;
  v_payment_conflicts integer := 0;
  v_blockers text[] := array[]::text[];
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only finalization readiness';
  end if;
  if p_actor_id is null or p_tournament_id is null or p_event_id is null then
    return null;
  end if;

  select t.name, t.status, e.name, e.scoring_method,
         nullif(trim(rv.source_reference), ''), rv.approved_at is not null,
         ps.state
    into v_tournament_name, v_tournament_status, v_event_name, v_scoring_method,
         v_ruleset_source, v_ruleset_approved, v_publication_state
  from app.tournaments t
  join app.events e on e.tournament_id = t.id
  join app.ruleset_versions rv
    on rv.id = e.ruleset_version_id and rv.tournament_id = e.tournament_id
  left join app.event_publication_states ps
    on ps.event_id = e.id and ps.tournament_id = e.tournament_id
  where t.id = p_tournament_id and e.id = p_event_id;
  if not found then return null; end if;

  if not exists (
    select 1 from app.tournament_roles r
    where r.tournament_id = p_tournament_id
      and r.profile_id = p_actor_id
      and r.role in ('director', 'co_director')
  ) then return null; end if;

  select count(*)::integer,
         count(*) filter (where g.state = 'verified')::integer,
         count(*) filter (where g.state = 'corrected')::integer,
         count(*) filter (where g.state = 'pending')::integer,
         count(*) filter (where g.state = 'submitted')::integer,
         count(*) filter (where g.state = 'mismatch')::integer,
         count(*) filter (where g.state = 'confirmation_pending')::integer
    into v_configured_games, v_verified_games, v_corrected_games,
         v_pending_games, v_submitted_games, v_mismatch_games,
         v_confirmation_pending_games
  from app.canonical_games g
  where g.tournament_id = p_tournament_id and g.event_id = p_event_id;

  select count(*)::integer into v_invalid_scoreline_games
  from app.canonical_games g
  where g.tournament_id = p_tournament_id and g.event_id = p_event_id
    and g.state in ('verified', 'corrected')
    and (select count(*) from app.card_scorelines s where s.canonical_game_id = g.id) <> 2;

  select count(*)::integer into v_legacy_pending_corrections
  from app.game_corrections c
  where c.tournament_id = p_tournament_id and c.event_id = p_event_id
    and c.required_approvals = 1
    and exists (
      select 1 from app.correction_state_events se
      where se.correction_id = c.id and se.state = 'pending'
    )
    and not exists (
      select 1 from app.correction_state_events se
      where se.correction_id = c.id and se.state in ('approved', 'applied', 'rejected')
    );

  select count(*)::integer into v_independent_pending_corrections
  from app.independent_card_correction_lifecycles c
  where c.tournament_id = p_tournament_id and c.event_id = p_event_id
    and exists (
      select 1 from app.independent_card_correction_state_events se
      where se.correction_id = c.correction_id and se.state = 'pending'
    )
    and not exists (
      select 1 from app.independent_card_correction_state_events se
      where se.correction_id = c.correction_id and se.state in ('approved', 'applied', 'rejected')
    );

  with roster_payment_state as (
    select r.id,
      (select pe.event_type
       from app.roster_payment_events pe
       where pe.tournament_id = p_tournament_id and pe.roster_entry_id = r.id
       order by pe.version desc
       limit 1) as payment_state
    from app.tournament_roster_entries r
    where r.tournament_id = p_tournament_id
  )
  select count(*)::integer,
         count(*) filter (where payment_state = 'received')::integer,
         count(*) filter (where payment_state = 'voided')::integer,
         count(*) filter (where payment_state is null)::integer
    into v_roster_entries, v_active_receipts, v_voided_payments, v_unrecorded_payments
  from roster_payment_state;

  select count(*)::integer into v_payment_events
  from app.roster_payment_events pe where pe.tournament_id = p_tournament_id;
  select count(*)::integer into v_payment_conflicts
  from app.roster_payment_operation_conflicts pc where pc.tournament_id = p_tournament_id;

  if v_configured_games = 0 then
    v_blockers := array_append(v_blockers, 'game_schedule_missing');
  elsif v_verified_games + v_corrected_games <> v_configured_games then
    v_blockers := array_append(v_blockers, 'score_verification_incomplete');
  end if;
  if v_invalid_scoreline_games > 0 then
    v_blockers := array_append(v_blockers, 'scoreline_evidence_incomplete');
  end if;
  if v_legacy_pending_corrections + v_independent_pending_corrections > 0 then
    v_blockers := array_append(v_blockers, 'correction_approval_pending');
  end if;
  if v_publication_state is distinct from 'draft' then
    v_blockers := array_append(v_blockers, 'event_publication_state_not_draft');
  end if;
  if not v_ruleset_approved or v_ruleset_source is null then
    v_blockers := array_append(v_blockers, 'ruleset_source_missing');
  end if;
  if v_scoring_method not in ('digital', 'manual', 'imported') then
    v_blockers := array_append(v_blockers, 'scoring_method_missing');
  end if;

  -- These stores do not yet exist. Absence is a blocker, never evidence that
  -- no dispute exists or that money/results have been reconciled or approved.
  v_blockers := array_append(v_blockers, 'dispute_register_unavailable');
  v_blockers := array_append(v_blockers, 'event_lifecycle_evidence_unavailable');
  v_blockers := array_append(v_blockers, 'schedule_completeness_evidence_unavailable');
  v_blockers := array_append(v_blockers, 'seating_or_eligibility_evidence_unavailable');
  v_blockers := array_append(v_blockers, 'finance_or_reporting_unreconciled');
  v_blockers := array_append(v_blockers, 'attachment_classification_evidence_unavailable');
  v_blockers := array_append(v_blockers, 'result_version_missing');
  v_blockers := array_append(v_blockers, 'director_approval_missing');

  return jsonb_build_object(
    'status', 'blocked',
    'tournamentId', p_tournament_id,
    'eventId', p_event_id,
    'tournamentName', v_tournament_name,
    'eventName', v_event_name,
    'readyForFinalization', false,
    'finalizationAuthorized', false,
    'blockers', to_jsonb(v_blockers),
    'scores', jsonb_build_object(
      'persistedGameCount', v_configured_games,
      'verifiedGameCount', v_verified_games,
      'correctedGameCount', v_corrected_games,
      'pendingGameCount', v_pending_games,
      'submittedGameCount', v_submitted_games,
      'mismatchGameCount', v_mismatch_games,
      'confirmationPendingGameCount', v_confirmation_pending_games,
      'invalidScorelineGameCount', v_invalid_scoreline_games
    ),
    'corrections', jsonb_build_object(
      'legacyPendingCount', v_legacy_pending_corrections,
      'independentPendingCount', v_independent_pending_corrections
    ),
    'disputes', jsonb_build_object(
      'registerAvailable', false,
      'unresolvedCount', null
    ),
    'finance', jsonb_build_object(
      'rosterEntryCount', v_roster_entries,
      'rosterEntriesWithLatestReceivedPaymentCount', v_active_receipts,
      'voidedPaymentCount', v_voided_payments,
      'unrecordedPaymentCount', v_unrecorded_payments,
      'paymentEventCount', v_payment_events,
      'operationConflictCount', v_payment_conflicts,
      'reconciliationEvidenceAvailable', false,
      'reconciled', false
    ),
    'configuredEvidence', jsonb_build_object(
      'tournamentStatus', v_tournament_status,
      'eventLifecycleAvailable', false,
      'scheduleCompletenessAvailable', false,
      'seatingOrEligibilityEvidenceAvailable', false,
      'eventPublicationState', v_publication_state,
      'rulesetSourceVersion', v_ruleset_source,
      'rulesetApproved', v_ruleset_approved,
      'scoringMethod', v_scoring_method,
      'attachmentClassificationAvailable', false,
      'resultVersionAvailable', false,
      'directorApprovalAvailable', false
    )
  );
end;
$$;

revoke all on function public.get_event_finalization_readiness_v1(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_event_finalization_readiness_v1(uuid, uuid, uuid)
  to service_role;
