-- October-pilot manual financial reconciliation for one finalized Standard
-- Singles event settlement. This records reviewed director inputs; it does not
-- calculate ACC payouts/MRPs, publish results, send money, or submit to ACC.

create table app.standard_singles_settlement_final_versions (
  id uuid primary key,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  event_id uuid not null,
  settlement_draft_id uuid not null,
  settlement_draft_version integer not null check (settlement_draft_version > 0),
  qualification_result_version_id uuid not null,
  playoff_result_version_id uuid not null,
  version integer not null check (version > 0),
  supersedes_final_version_id uuid references app.standard_singles_settlement_final_versions(id) on delete restrict,
  event_income_minor bigint not null check (event_income_minor >= 0),
  event_expense_minor bigint not null check (event_expense_minor >= 0),
  placement_payout_total_minor bigint not null check (placement_payout_total_minor >= 0),
  q_pool_payout_total_minor bigint not null check (q_pool_payout_total_minor >= 0),
  other_award_total_minor bigint not null check (other_award_total_minor >= 0),
  retained_balance_minor bigint not null check (retained_balance_minor >= 0),
  payment_receipt_count integer not null check (payment_receipt_count >= 0),
  payment_receipt_total_minor bigint not null check (payment_receipt_total_minor >= 0),
  expense_count integer not null check (expense_count >= 0),
  expense_total_minor bigint not null check (expense_total_minor >= 0),
  mrp_claim_count integer not null check (mrp_claim_count >= 0),
  official_source_reference text not null check (
    length(trim(official_source_reference)) between 1 and 500
    and octet_length(official_source_reference) <= 2000
    and official_source_reference !~ '[[:cntrl:]]'
  ),
  attestations jsonb not null check (attestations = '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb),
  currency_code text not null check (currency_code = 'USD'),
  reconciled boolean not null check (reconciled),
  acc_submitted boolean not null check (not acc_submitted),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  finalized_at timestamptz not null,
  foreign key (settlement_draft_id,tournament_id,event_id,qualification_result_version_id)
    references app.standard_singles_settlement_drafts(id,tournament_id,event_id,qualification_result_version_id) on delete restrict,
  foreign key (playoff_result_version_id,tournament_id,event_id,qualification_result_version_id)
    references app.standard_singles_playoff_result_versions(id,tournament_id,event_id,qualification_result_version_id) on delete restrict,
  foreign key (operation_receipt_id,tournament_id)
    references app.operation_receipts(id,tournament_id) on delete restrict,
  unique (event_id,version),
  unique (id,tournament_id,event_id)
);

alter table app.standard_singles_settlement_final_versions enable row level security;
alter table app.standard_singles_settlement_final_versions force row level security;
revoke all on table app.standard_singles_settlement_final_versions from public,anon,authenticated;
create trigger standard_singles_settlement_final_versions_immutable before update or delete
  on app.standard_singles_settlement_final_versions for each row execute function app.reject_immutable_history();
create index settlement_final_versions_tournament_event_idx on app.standard_singles_settlement_final_versions(tournament_id,event_id,version desc);
create index settlement_final_versions_draft_idx on app.standard_singles_settlement_final_versions(settlement_draft_id,tournament_id,event_id,qualification_result_version_id);
create index settlement_final_versions_playoff_idx on app.standard_singles_settlement_final_versions(playoff_result_version_id,tournament_id,event_id,qualification_result_version_id);
create index settlement_final_versions_actor_idx on app.standard_singles_settlement_final_versions(actor_profile_id);
create index settlement_final_versions_receipt_idx on app.standard_singles_settlement_final_versions(operation_receipt_id,tournament_id);
create index settlement_final_versions_supersedes_idx on app.standard_singles_settlement_final_versions(supersedes_final_version_id);

create table app.standard_singles_settlement_finalization_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  attempted_event_id uuid not null,
  attempted_operation_id uuid not null,
  attempted_request_hash text not null check (length(attempted_request_hash)=64),
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null check (reason_code='idempotency_conflict'),
  created_at timestamptz not null default clock_timestamp()
);
alter table app.standard_singles_settlement_finalization_conflicts enable row level security;
alter table app.standard_singles_settlement_finalization_conflicts force row level security;
revoke all on table app.standard_singles_settlement_finalization_conflicts from public,anon,authenticated;
create trigger settlement_finalization_conflicts_immutable before update or delete
  on app.standard_singles_settlement_finalization_conflicts for each row execute function app.reject_immutable_history();
create index settlement_finalization_conflicts_actor_idx on app.standard_singles_settlement_finalization_conflicts(actor_profile_id,created_at desc);
create index settlement_finalization_conflicts_receipt_idx on app.standard_singles_settlement_finalization_conflicts(prior_receipt_id);

create or replace function public.finalize_standard_singles_settlement_manual_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_settlement_draft_id uuid,
  p_settlement_draft_version integer,p_qualification_result_version_id uuid,p_playoff_result_version_id uuid,
  p_expected_final_version integer,p_event_income_minor bigint,p_event_expense_minor bigint,
  p_placement_payout_total_minor bigint,p_q_pool_payout_total_minor bigint,p_other_award_total_minor bigint,
  p_retained_balance_minor bigint,p_expected_payment_receipt_count integer,p_expected_payment_receipt_total_minor bigint,
  p_expected_expense_count integer,p_expected_expense_total_minor bigint,p_official_source_reference text,
  p_attestations jsonb,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_hash text; v_existing app.operation_receipts%rowtype; v_draft app.standard_singles_settlement_drafts%rowtype;
  v_current app.standard_singles_settlement_final_versions%rowtype; v_prior_id uuid; v_receipt_id uuid:=extensions.gen_random_uuid();
  v_final_id uuid:=extensions.gen_random_uuid(); v_now timestamptz:=clock_timestamp(); v_authorized boolean:=false;
  v_payment_count integer; v_payment_total bigint; v_expense_count integer; v_expense_total bigint;
  v_active_payment_event_ids uuid[]; v_draft_payment_event_ids uuid[];
  v_active_expense_event_ids uuid[]; v_draft_expense_event_ids uuid[];
  v_placement_total bigint; v_q_pool_total bigint; v_other_total bigint; v_mrp_count integer; v_qualifier_count integer;
  v_other_income bigint; v_other_expense bigint; v_response jsonb; v_error text; v_code text;
  v_tournament_status text;
  v_attestations constant jsonb := '{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"qPoolClaimsReviewed":true}'::jsonb;
begin
  begin
    if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_settlement_draft_id is null
      or p_qualification_result_version_id is null or p_playoff_result_version_id is null or p_operation_id is null
      or p_settlement_draft_version is null or p_expected_final_version is null
      or p_event_income_minor is null or p_event_expense_minor is null or p_placement_payout_total_minor is null
      or p_q_pool_payout_total_minor is null or p_other_award_total_minor is null or p_retained_balance_minor is null
      or p_expected_payment_receipt_count is null or p_expected_payment_receipt_total_minor is null
      or p_expected_expense_count is null or p_expected_expense_total_minor is null
      or p_settlement_draft_version<1 or p_expected_final_version<0
      or p_event_income_minor<0 or p_event_expense_minor<0 or p_placement_payout_total_minor<0
      or p_q_pool_payout_total_minor<0 or p_other_award_total_minor<0 or p_retained_balance_minor<0
      or p_expected_payment_receipt_count<0 or p_expected_payment_receipt_total_minor<0
      or p_expected_expense_count<0 or p_expected_expense_total_minor<0
      or greatest(p_event_income_minor,p_event_expense_minor,p_placement_payout_total_minor,p_q_pool_payout_total_minor,
        p_other_award_total_minor,p_retained_balance_minor,p_expected_payment_receipt_total_minor,p_expected_expense_total_minor)>9007199254740991
      or p_attestations is distinct from v_attestations
      or p_official_source_reference is null or length(trim(p_official_source_reference)) not between 1 and 500
      or octet_length(p_official_source_reference)>2000 or p_official_source_reference ~ '[[:cntrl:]]' then
      raise exception using errcode='P0001',message='invalid settlement finalization request';
    end if;
    v_hash:=encode(extensions.digest(convert_to(jsonb_build_array(
      'finalize_standard_singles_settlement_manual_v1',p_actor_id,p_tournament_id,p_event_id,p_settlement_draft_id,
      p_settlement_draft_version,p_qualification_result_version_id,p_playoff_result_version_id,p_expected_final_version,
      p_event_income_minor,p_event_expense_minor,p_placement_payout_total_minor,p_q_pool_payout_total_minor,
      p_other_award_total_minor,p_retained_balance_minor,p_expected_payment_receipt_count,p_expected_payment_receipt_total_minor,
      p_expected_expense_count,p_expected_expense_total_minor,trim(p_official_source_reference),p_attestations)::text,'utf8'),'sha256'),'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('standard-singles-post-event:'||p_event_id::text,0));
    -- Global lock order for settlement operations: actor/operation advisory,
    -- event advisory, tournament row, then actor role row. Payment and expense
    -- writers also lock the tournament row before appending ledger history, so
    -- the source-ID snapshot below cannot change during this transaction.
    select tournament.status into v_tournament_status from app.tournaments tournament
      where tournament.id=p_tournament_id for update;
    if not found then raise exception using errcode='P0001',message='tournament unavailable'; end if;
    perform 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id
      and role_row.profile_id=p_actor_id and role_row.role in('director','co_director') for update;
    if not found then raise exception using errcode='P0001',message='director role required'; end if;
    v_authorized:=true;
    select * into v_existing from app.operation_receipts receipt
      where receipt.actor_profile_id=p_actor_id and receipt.client_operation_id=p_operation_id;
    if found then
      if v_existing.tournament_id=p_tournament_id and v_existing.operation_type='finalize_standard_singles_settlement_manual_v1'
        and v_existing.target_id=p_event_id and v_existing.request_hash=v_hash then return v_existing.response_payload; end if;
    end if;
    if v_tournament_status not in('open','pending_finalization') then
      raise exception using errcode='P0001',message='tournament unavailable';
    end if;
    if v_existing.id is not null then
      insert into app.standard_singles_settlement_finalization_conflicts(tournament_id,actor_profile_id,attempted_event_id,
        attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code)
      values(p_tournament_id,p_actor_id,p_event_id,p_operation_id,v_hash,
        case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
      return jsonb_build_object('status','rejected','code','idempotency_conflict','eventId',p_event_id);
    end if;
    select * into v_draft from app.standard_singles_settlement_drafts draft
      where draft.id=p_settlement_draft_id and draft.tournament_id=p_tournament_id and draft.event_id=p_event_id
        and draft.qualification_result_version_id=p_qualification_result_version_id and draft.version=p_settlement_draft_version for update;
    if not found or exists(select 1 from app.standard_singles_settlement_drafts newer where newer.event_id=p_event_id and newer.version>v_draft.version)
      then raise exception using errcode='P0001',message='settlement draft unavailable'; end if;
    if not exists(select 1 from app.standard_singles_settlement_playoff_bindings binding
        where binding.settlement_draft_id=v_draft.id and binding.tournament_id=p_tournament_id and binding.event_id=p_event_id
          and binding.qualification_result_version_id=p_qualification_result_version_id and binding.playoff_result_version_id=p_playoff_result_version_id)
      or exists(select 1 from app.standard_singles_playoff_result_versions newer where newer.event_id=p_event_id
        and newer.version>(select version from app.standard_singles_playoff_result_versions current_result where current_result.id=p_playoff_result_version_id))
      or exists(select 1 from app.qualification_result_versions newer where newer.event_id=p_event_id
        and newer.version>(select version from app.qualification_result_versions current_result where current_result.id=p_qualification_result_version_id))
      then raise exception using errcode='P0001',message='version binding unavailable'; end if;
    if exists(select 1 from app.event_disputes dispute where dispute.tournament_id=p_tournament_id
        and dispute.event_id=p_event_id and app.event_dispute_is_open(dispute.id))
      then raise exception using errcode='P0001',message='event dispute unresolved'; end if;
    select result.qualifier_count into v_qualifier_count from app.qualification_result_versions result
      where result.id=p_qualification_result_version_id and result.tournament_id=p_tournament_id and result.event_id=p_event_id;
    select count(*)::integer into v_mrp_count from app.standard_singles_settlement_mrp_claims claim
      where claim.settlement_draft_id=v_draft.id and claim.qualification_result_version_id=p_qualification_result_version_id;
    if v_qualifier_count is null or v_mrp_count<>v_qualifier_count then
      raise exception using errcode='P0001',message='mrp claims incomplete';
    end if;
    select coalesce(sum(row.prize_amount_minor),0)::bigint into v_placement_total
      from app.standard_singles_settlement_placements row where row.settlement_draft_id=v_draft.id;
    select coalesce(sum(award.amount_minor) filter(where award.award_type='q_pool'),0)::bigint,
      coalesce(sum(award.amount_minor) filter(where award.award_type='other'),0)::bigint into v_q_pool_total,v_other_total
      from app.standard_singles_settlement_awards award where award.settlement_draft_id=v_draft.id;
    if v_placement_total<>p_placement_payout_total_minor or v_q_pool_total<>p_q_pool_payout_total_minor
      or v_other_total<>p_other_award_total_minor then raise exception using errcode='P0001',message='payout totals changed'; end if;
    with latest as(select distinct on(roster_entry_id) * from app.roster_payment_events
        where tournament_id=p_tournament_id order by roster_entry_id,version desc)
      select count(*)::integer,coalesce(sum(amount_minor),0)::bigint,
        coalesce(array_agg(id order by id),'{}'::uuid[])
      into v_payment_count,v_payment_total,v_active_payment_event_ids from latest where event_type='received';
    select coalesce(array_agg(source.payment_event_id order by source.payment_event_id),'{}'::uuid[])
      into v_draft_payment_event_ids from app.standard_singles_settlement_payment_sources source
      where source.settlement_draft_id=v_draft.id and source.tournament_id=p_tournament_id;
    with latest as(select distinct on(expense_id) * from app.tournament_expense_events
        where tournament_id=p_tournament_id order by expense_id,version desc)
      select count(*)::integer,coalesce(sum(amount_minor),0)::bigint,
        coalesce(array_agg(id order by id),'{}'::uuid[])
      into v_expense_count,v_expense_total,v_active_expense_event_ids from latest where event_type='recorded';
    select coalesce(array_agg(source.expense_event_id order by source.expense_event_id),'{}'::uuid[])
      into v_draft_expense_event_ids from app.standard_singles_settlement_expense_sources source
      where source.settlement_draft_id=v_draft.id and source.tournament_id=p_tournament_id;
    if v_payment_count<>p_expected_payment_receipt_count or v_payment_total<>p_expected_payment_receipt_total_minor
      or v_expense_count<>p_expected_expense_count or v_expense_total<>p_expected_expense_total_minor
      or v_payment_count<>v_draft.payment_receipt_count or v_payment_total<>v_draft.payment_receipt_total_minor
      or v_expense_count<>v_draft.expense_count or v_expense_total<>v_draft.expense_total_minor
      or v_active_payment_event_ids is distinct from v_draft_payment_event_ids
      or v_active_expense_event_ids is distinct from v_draft_expense_event_ids
      then raise exception using errcode='P0001',message='ledger snapshot changed'; end if;
    if p_event_income_minor<>p_event_expense_minor+v_placement_total+v_q_pool_total+v_other_total+p_retained_balance_minor
      then raise exception using errcode='P0001',message='ledger does not conserve'; end if;
    with latest as(select distinct on(finalized.event_id) finalized.* from app.standard_singles_settlement_final_versions finalized
        where finalized.tournament_id=p_tournament_id and finalized.event_id<>p_event_id order by finalized.event_id,finalized.version desc)
      select coalesce(sum(event_income_minor),0)::bigint,coalesce(sum(event_expense_minor),0)::bigint
      into v_other_income,v_other_expense from latest;
    if v_other_income+p_event_income_minor>v_payment_total or v_other_expense+p_event_expense_minor>v_expense_total
      then raise exception using errcode='P0001',message='ledger allocation exceeded'; end if;
    select * into v_current from app.standard_singles_settlement_final_versions finalized
      where finalized.tournament_id=p_tournament_id and finalized.event_id=p_event_id order by finalized.version desc limit 1 for update;
    if coalesce(v_current.version,0)<>p_expected_final_version then raise exception using errcode='P0001',message='stale finalization version'; end if;
    v_prior_id:=v_current.id;
    v_response:=jsonb_build_object('status','settlement_finalized_manual','tournamentId',p_tournament_id,'eventId',p_event_id,
      'settlementDraftId',v_draft.id,'settlementDraftVersion',v_draft.version,
      'qualificationResultVersionId',p_qualification_result_version_id,'playoffResultVersionId',p_playoff_result_version_id,
      'finalizationId',v_final_id,'version',p_expected_final_version+1,'supersedesFinalizationId',v_prior_id,
      'eventIncomeMinor',p_event_income_minor,'eventExpenseMinor',p_event_expense_minor,
      'placementPayoutTotalMinor',v_placement_total,'qPoolPayoutTotalMinor',v_q_pool_total,
      'otherAwardTotalMinor',v_other_total,'retainedBalanceMinor',p_retained_balance_minor,
      'paymentReceiptCount',v_payment_count,'paymentReceiptTotalMinor',v_payment_total,
      'expenseCount',v_expense_count,'expenseTotalMinor',v_expense_total,'mrpClaimCount',v_mrp_count,
      'currencyCode','USD','reconciled',true,'accSubmitted',false,'finalizedAt',v_now);
    insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
      values(v_receipt_id,p_tournament_id,p_actor_id,'finalize_standard_singles_settlement_manual_v1',p_event_id,v_hash,p_operation_id,'accepted',v_response,v_now);
    insert into app.standard_singles_settlement_final_versions(id,tournament_id,event_id,settlement_draft_id,settlement_draft_version,
      qualification_result_version_id,playoff_result_version_id,version,supersedes_final_version_id,event_income_minor,event_expense_minor,
      placement_payout_total_minor,q_pool_payout_total_minor,other_award_total_minor,retained_balance_minor,payment_receipt_count,
      payment_receipt_total_minor,expense_count,expense_total_minor,mrp_claim_count,official_source_reference,attestations,currency_code,
      reconciled,acc_submitted,actor_profile_id,operation_receipt_id,finalized_at)
    values(v_final_id,p_tournament_id,p_event_id,v_draft.id,v_draft.version,p_qualification_result_version_id,p_playoff_result_version_id,
      p_expected_final_version+1,v_prior_id,p_event_income_minor,p_event_expense_minor,v_placement_total,v_q_pool_total,v_other_total,
      p_retained_balance_minor,v_payment_count,v_payment_total,v_expense_count,v_expense_total,v_mrp_count,
      trim(p_official_source_reference),p_attestations,'USD',true,false,p_actor_id,v_receipt_id,v_now);
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
      values(p_tournament_id,p_actor_id,v_receipt_id,'standard_singles_settlement_finalization',v_final_id,
        'standard_singles_settlement_manually_finalized',case when v_prior_id is null then null else jsonb_build_object('supersedesFinalizationId',v_prior_id) end,v_response);
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error=message_text;
    v_code:=case v_error when 'director role required' then 'not_director' when 'tournament unavailable' then 'tournament_unavailable'
      when 'settlement draft unavailable' then 'settlement_draft_unavailable' when 'version binding unavailable' then 'version_binding_unavailable'
      when 'event dispute unresolved' then 'event_dispute_unresolved' when 'mrp claims incomplete' then 'mrp_claims_incomplete'
      when 'payout totals changed' then 'payout_totals_changed' when 'ledger snapshot changed' then 'ledger_snapshot_changed'
      when 'ledger does not conserve' then 'non_conserving_ledger' when 'ledger allocation exceeded' then 'ledger_allocation_exceeded'
      when 'stale finalization version' then 'stale_version' else 'invalid_request' end;
    v_response:=jsonb_build_object('status','rejected','code',v_code,'eventId',p_event_id);
    -- The expected-error subtransaction releases its advisory locks. Re-take
    -- the actor/operation lock before persisting a controlled rejection so
    -- simultaneous identical retries cannot race the receipt uniqueness key.
    if p_actor_id is not null and p_operation_id is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
    end if;
    if v_authorized and p_operation_id is not null and v_hash is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('standard-singles-post-event:'||p_event_id::text,0));
      select tournament.status into v_tournament_status from app.tournaments tournament
        where tournament.id=p_tournament_id for update;
      if not found then return v_response; end if;
      perform 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id
        and role_row.profile_id=p_actor_id and role_row.role in('director','co_director') for update;
      if not found then return v_response; end if;
      select * into v_existing from app.operation_receipts receipt where receipt.actor_profile_id=p_actor_id and receipt.client_operation_id=p_operation_id;
      if found then
        if v_existing.tournament_id=p_tournament_id and v_existing.operation_type='finalize_standard_singles_settlement_manual_v1'
          and v_existing.target_id=p_event_id and v_existing.request_hash=v_hash then return v_existing.response_payload; end if;
      end if;
      if v_tournament_status not in('open','pending_finalization') then return v_response; end if;
      if v_existing.id is not null then
        insert into app.standard_singles_settlement_finalization_conflicts(tournament_id,actor_profile_id,attempted_event_id,
          attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code)
        values(p_tournament_id,p_actor_id,p_event_id,p_operation_id,v_hash,
          case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
        return jsonb_build_object('status','rejected','code','idempotency_conflict','eventId',p_event_id);
      end if;
      insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
        values(p_tournament_id,p_actor_id,'finalize_standard_singles_settlement_manual_v1',coalesce(p_event_id,p_tournament_id),v_hash,p_operation_id,'rejected',v_response,clock_timestamp()) returning id into v_receipt_id;
      insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
        values(p_tournament_id,p_actor_id,v_receipt_id,'standard_singles_settlement_finalization',coalesce(p_event_id,p_tournament_id),
          'standard_singles_settlement_manual_finalization_rejected',v_response);
    end if;
    return v_response;
  end;
end $$;

create or replace function public.get_standard_singles_settlement_finalization_workspace_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
with allowed as(
  select 1 where exists(select 1 from app.tournament_roles role_row
    where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director'))
), draft as(
  select d.* from app.standard_singles_settlement_drafts d where d.tournament_id=p_tournament_id and d.event_id=p_event_id order by d.version desc limit 1
), binding as(
  select b.* from app.standard_singles_settlement_playoff_bindings b join draft d on d.id=b.settlement_draft_id
), current_final as(
  select f.* from app.standard_singles_settlement_final_versions f where f.tournament_id=p_tournament_id and f.event_id=p_event_id order by f.version desc limit 1
)
select jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,'currentVersion',coalesce((select version from current_final),0),
  'draft',case when draft.id is null then null else jsonb_build_object(
    'settlementDraftId',draft.id,'settlementDraftVersion',draft.version,'qualificationResultVersionId',draft.qualification_result_version_id,
    'playoffResultVersionId',binding.playoff_result_version_id,'paymentReceiptCount',draft.payment_receipt_count,
    'paymentReceiptTotalMinor',draft.payment_receipt_total_minor,'expenseCount',draft.expense_count,'expenseTotalMinor',draft.expense_total_minor,
    'placementPayoutTotalMinor',coalesce((select sum(row.prize_amount_minor) from app.standard_singles_settlement_placements row where row.settlement_draft_id=draft.id),0),
    'qPoolPayoutTotalMinor',coalesce((select sum(award.amount_minor) from app.standard_singles_settlement_awards award where award.settlement_draft_id=draft.id and award.award_type='q_pool'),0),
    'otherAwardTotalMinor',coalesce((select sum(award.amount_minor) from app.standard_singles_settlement_awards award where award.settlement_draft_id=draft.id and award.award_type='other'),0),
    'mrpClaimCount',(select count(*) from app.standard_singles_settlement_mrp_claims claim where claim.settlement_draft_id=draft.id),
    'qualifierCount',(select result.qualifier_count from app.qualification_result_versions result where result.id=draft.qualification_result_version_id)
  ) end,
  'finalization',case when current_final.id is null then null else jsonb_build_object(
    'finalizationId',current_final.id,'version',current_final.version,'settlementDraftId',current_final.settlement_draft_id,
    'eventIncomeMinor',current_final.event_income_minor,'eventExpenseMinor',current_final.event_expense_minor,
    'placementPayoutTotalMinor',current_final.placement_payout_total_minor,'qPoolPayoutTotalMinor',current_final.q_pool_payout_total_minor,
    'otherAwardTotalMinor',current_final.other_award_total_minor,'retainedBalanceMinor',current_final.retained_balance_minor,
    'officialSourceReference',current_final.official_source_reference,'currencyCode','USD','reconciled',true,'accSubmitted',false,
    'finalizedAt',current_final.finalized_at,'finalizedBy',coalesce(nullif(trim(profile.display_name),''),'Director or co-director')
  ) end,
  'capabilities',jsonb_build_object('manualReconciliation',true,'automaticPayoutCalculation',false,'automaticMrpCalculation',false,'accSubmission',false))
from allowed left join draft on true left join binding on true left join current_final on true
left join app.profiles profile on profile.id=current_final.actor_profile_id
$$;

create or replace function public.get_standard_singles_settlement_finalization_reconciliation_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
select case when exists(select 1 from app.tournament_roles role_row
  where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director'))
then jsonb_build_object('authorized',true,'result',(select receipt.response_payload from app.operation_receipts receipt
  where receipt.actor_profile_id=p_actor_id and receipt.tournament_id=p_tournament_id
    and receipt.operation_type='finalize_standard_singles_settlement_manual_v1' and receipt.target_id=p_event_id
    and receipt.client_operation_id=p_operation_id limit 1)) else null end
$$;

revoke all on function public.finalize_standard_singles_settlement_manual_v1(uuid,uuid,uuid,uuid,integer,uuid,uuid,integer,bigint,bigint,bigint,bigint,bigint,bigint,integer,bigint,integer,bigint,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_settlement_finalization_workspace_v1(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_settlement_finalization_reconciliation_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.finalize_standard_singles_settlement_manual_v1(uuid,uuid,uuid,uuid,integer,uuid,uuid,integer,bigint,bigint,bigint,bigint,bigint,bigint,integer,bigint,integer,bigint,text,jsonb,uuid) to service_role;
grant execute on function public.get_standard_singles_settlement_finalization_workspace_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.get_standard_singles_settlement_finalization_reconciliation_v1(uuid,uuid,uuid,uuid) to service_role;

notify pgrst,'reload schema';
