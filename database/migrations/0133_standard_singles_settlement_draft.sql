-- Versioned, immutable post-event settlement DRAFT. This migration creates no
-- publication, approval, reconciliation, MRP, payout-rule, or ACC-export authority.

create table app.standard_singles_settlement_drafts (
  id uuid primary key,
  tournament_id uuid not null,
  event_id uuid not null,
  qualification_result_version_id uuid not null,
  version integer not null check(version > 0),
  supersedes_draft_id uuid,
  setup_revision_id uuid not null,
  setup_event_version_id uuid not null,
  payment_receipt_count integer not null check(payment_receipt_count >= 0),
  payment_receipt_total_minor bigint not null check(payment_receipt_total_minor >= 0),
  expense_count integer not null check(expense_count >= 0),
  expense_total_minor bigint not null check(expense_total_minor >= 0),
  currency_code text not null check(currency_code = 'USD'),
  blockers jsonb not null check(blockers = '["official_mrp_fixture_missing","q_pool_payout_fixture_missing","event_payment_allocation_unsupported","settlement_reconciliation_unsupported","official_export_unsupported"]'::jsonb),
  reconciled boolean not null check(not reconciled),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  created_at timestamptz not null,
  foreign key(qualification_result_version_id,tournament_id,event_id)
    references app.qualification_result_versions(id,tournament_id,event_id) on delete restrict,
  foreign key(setup_event_version_id,tournament_id,setup_revision_id)
    references app.tournament_setup_event_versions(id,tournament_id,setup_revision_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id)
    references app.operation_receipts(id,tournament_id) on delete restrict,
  foreign key(supersedes_draft_id) references app.standard_singles_settlement_drafts(id) on delete restrict,
  unique(event_id,version), unique(id,tournament_id), unique(id,tournament_id,event_id)
);

create table app.standard_singles_settlement_placements (
  settlement_draft_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  participant_id uuid not null,
  placement integer not null check(placement > 0),
  prize_amount_minor integer not null check(prize_amount_minor >= 0),
  currency_code text not null check(currency_code = 'USD'),
  primary key(settlement_draft_id,participant_id),
  foreign key(settlement_draft_id,tournament_id,event_id)
    references app.standard_singles_settlement_drafts(id,tournament_id,event_id) on delete restrict,
  foreign key(participant_id,event_id,tournament_id)
    references app.event_participants(id,event_id,tournament_id) on delete restrict,
  unique(settlement_draft_id,placement)
);

create table app.standard_singles_settlement_awards (
  id uuid primary key default extensions.gen_random_uuid(),
  settlement_draft_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  participant_id uuid not null,
  award_type text not null check(award_type in ('q_pool','other')),
  q_pool_slot smallint check(q_pool_slot in (1,2)),
  amount_minor integer not null check(amount_minor > 0),
  currency_code text not null check(currency_code = 'USD'),
  note text not null default '' check(length(note) <= 500 and octet_length(note) <= 2000),
  foreign key(settlement_draft_id,tournament_id,event_id)
    references app.standard_singles_settlement_drafts(id,tournament_id,event_id) on delete restrict,
  foreign key(participant_id,event_id,tournament_id)
    references app.event_participants(id,event_id,tournament_id) on delete restrict,
  check((award_type='q_pool' and q_pool_slot is not null) or (award_type='other' and q_pool_slot is null))
);
create unique index standard_singles_settlement_awards_identity_idx
  on app.standard_singles_settlement_awards(settlement_draft_id,participant_id,award_type,coalesce(q_pool_slot,0));

create table app.standard_singles_settlement_payment_sources (
  settlement_draft_id uuid not null,
  tournament_id uuid not null,
  payment_event_id uuid not null,
  roster_entry_id uuid not null,
  amount_minor integer not null check(amount_minor > 0),
  primary key(settlement_draft_id,payment_event_id),
  foreign key(settlement_draft_id,tournament_id)
    references app.standard_singles_settlement_drafts(id,tournament_id) on delete restrict,
  foreign key(payment_event_id,roster_entry_id,tournament_id)
    references app.roster_payment_events(id,roster_entry_id,tournament_id) on delete restrict
);

create table app.standard_singles_settlement_expense_sources (
  settlement_draft_id uuid not null,
  tournament_id uuid not null,
  expense_event_id uuid not null,
  expense_id uuid not null,
  amount_minor integer not null check(amount_minor > 0),
  primary key(settlement_draft_id,expense_event_id),
  foreign key(settlement_draft_id,tournament_id)
    references app.standard_singles_settlement_drafts(id,tournament_id) on delete restrict,
  foreign key(expense_event_id,expense_id,tournament_id)
    references app.tournament_expense_events(id,expense_id,tournament_id) on delete restrict
);

create table app.standard_singles_settlement_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  attempted_event_id uuid not null,
  attempted_operation_id uuid not null,
  attempted_request_hash text not null check(length(attempted_request_hash)=64),
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null check(reason_code='idempotency_conflict'),
  created_at timestamptz not null default now()
);

do $$ declare n text; begin foreach n in array array[
 'standard_singles_settlement_drafts','standard_singles_settlement_placements',
 'standard_singles_settlement_awards','standard_singles_settlement_payment_sources',
 'standard_singles_settlement_expense_sources','standard_singles_settlement_conflicts'
] loop execute format('alter table app.%I enable row level security',n);
 execute format('alter table app.%I force row level security',n);
 execute format('revoke all on table app.%I from public,anon,authenticated',n); end loop; end $$;
create trigger settlement_drafts_immutable before update or delete on app.standard_singles_settlement_drafts for each row execute function app.reject_immutable_history();
create trigger settlement_placements_immutable before update or delete on app.standard_singles_settlement_placements for each row execute function app.reject_immutable_history();
create trigger settlement_awards_immutable before update or delete on app.standard_singles_settlement_awards for each row execute function app.reject_immutable_history();
create trigger settlement_payment_sources_immutable before update or delete on app.standard_singles_settlement_payment_sources for each row execute function app.reject_immutable_history();
create trigger settlement_expense_sources_immutable before update or delete on app.standard_singles_settlement_expense_sources for each row execute function app.reject_immutable_history();
create trigger settlement_conflicts_immutable before update or delete on app.standard_singles_settlement_conflicts for each row execute function app.reject_immutable_history();
create index settlement_drafts_qualification_idx on app.standard_singles_settlement_drafts(qualification_result_version_id,version desc);
create index settlement_drafts_actor_idx on app.standard_singles_settlement_drafts(actor_profile_id);
create index settlement_drafts_receipt_idx on app.standard_singles_settlement_drafts(operation_receipt_id);
create index settlement_placements_participant_idx on app.standard_singles_settlement_placements(participant_id,event_id,tournament_id);
create index settlement_awards_participant_idx on app.standard_singles_settlement_awards(participant_id,event_id,tournament_id);
create index settlement_conflicts_actor_idx on app.standard_singles_settlement_conflicts(actor_profile_id,created_at desc);
create index settlement_conflicts_receipt_idx on app.standard_singles_settlement_conflicts(prior_receipt_id);

create or replace function public.save_standard_singles_settlement_draft_v1(
 p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_qualification_result_version_id uuid,
 p_expected_version integer,p_placements jsonb,p_awards jsonb,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_hash text; v_existing app.operation_receipts%rowtype; v_current app.standard_singles_settlement_drafts%rowtype;
 v_activation app.tournament_setup_activations%rowtype; v_version integer; v_id uuid:=extensions.gen_random_uuid();
 v_receipt uuid:=extensions.gen_random_uuid(); v_now timestamptz:=clock_timestamp(); v_role text;
 v_payment_count integer; v_payment_total bigint; v_expense_count integer; v_expense_total bigint;
 v_response jsonb; v_error text; v_code text; v_authorized boolean:=false;
 v_blockers jsonb:='["official_mrp_fixture_missing","q_pool_payout_fixture_missing","event_payment_allocation_unsupported","settlement_reconciliation_unsupported","official_export_unsupported"]'::jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception using errcode='P0001',message='server-only settlement draft'; end if;
 begin
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_qualification_result_version_id is null
    or p_expected_version is null or p_expected_version<0 or p_placements is null or jsonb_typeof(p_placements)<>'array'
    or p_awards is null or jsonb_typeof(p_awards)<>'array' or p_operation_id is null
    then raise exception using errcode='P0001',message='invalid settlement draft'; end if;
  if jsonb_array_length(p_placements)<2 or jsonb_array_length(p_placements)>10000 or jsonb_array_length(p_awards)>10000
    or exists(select 1 from jsonb_array_elements(p_placements) x where jsonb_typeof(x)<>'object'
      or (select count(*) from jsonb_object_keys(x))<>3 or not (x ?& array['participantId','placement','prizeAmountMinor'])
      or not((x->>'participantId')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      or jsonb_typeof(x->'placement')<>'number' or not((x->>'placement')~'^[1-9][0-9]*$')
      or jsonb_typeof(x->'prizeAmountMinor')<>'number' or not((x->>'prizeAmountMinor')~'^(0|[1-9][0-9]*)$')
      or (x->>'prizeAmountMinor')::numeric>2147483647)
    or exists(select 1 from jsonb_array_elements(p_awards) x where jsonb_typeof(x)<>'object'
      or (select count(*) from jsonb_object_keys(x))<>5 or not (x ?& array['participantId','awardType','qPoolSlot','amountMinor','note'])
      or not((x->>'participantId')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      or x->>'awardType' not in('q_pool','other') or jsonb_typeof(x->'amountMinor')<>'number'
      or not((x->>'amountMinor')~'^[1-9][0-9]*$') or (x->>'amountMinor')::numeric>2147483647
      or jsonb_typeof(x->'note')<>'string' or length(x->>'note')>500 or octet_length(x->>'note')>2000
      or (x->>'awardType'='q_pool' and (jsonb_typeof(x->'qPoolSlot')<>'number' or x->>'qPoolSlot' not in('1','2')))
      or (x->>'awardType'='other' and jsonb_typeof(x->'qPoolSlot')<>'null'))
    then raise exception using errcode='P0001',message='invalid settlement draft'; end if;
  -- No extra field is accepted; an MRP value therefore cannot enter this draft.
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('save_standard_singles_settlement_draft_v1',p_actor_id,p_tournament_id,p_event_id,p_qualification_result_version_id,p_expected_version,p_placements,p_awards)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('settlement:'||p_event_id::text,0));
  perform 1 from app.tournaments t where t.id=p_tournament_id and t.status in('open','pending_finalization') for update;
  if not found then raise exception using errcode='P0001',message='tournament unavailable'; end if;
  select r.role into v_role from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director') order by r.role limit 1 for update;
  if v_role is null then raise exception using errcode='P0001',message='director role required'; end if; v_authorized:=true;
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
  if found then
   if v_existing.tournament_id<>p_tournament_id or v_existing.operation_type<>'save_standard_singles_settlement_draft_v1'
    or v_existing.target_id<>p_event_id or v_existing.request_hash<>v_hash then
    insert into app.standard_singles_settlement_conflicts(tournament_id,actor_profile_id,attempted_event_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code)
    values(p_tournament_id,p_actor_id,p_event_id,p_operation_id,v_hash,case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
    return jsonb_build_object('status','rejected','code','idempotency_conflict','eventId',p_event_id);
   end if; return v_existing.response_payload;
  end if;
  if not exists(select 1 from app.qualification_result_versions q where q.id=p_qualification_result_version_id and q.tournament_id=p_tournament_id and q.event_id=p_event_id
    and not exists(select 1 from app.qualification_result_versions newer where newer.event_id=q.event_id and newer.version>q.version))
   or not exists(select 1 from app.events e where e.id=p_event_id and e.tournament_id=p_tournament_id and e.format='standard_singles' and e.scoring_method='digital')
   then raise exception using errcode='P0001',message='qualification result unavailable'; end if;
  select * into v_activation from app.tournament_setup_activations a where a.tournament_id=p_tournament_id and a.event_id=p_event_id;
  if not found then raise exception using errcode='P0001',message='activated setup unavailable'; end if;
  select * into v_current from app.standard_singles_settlement_drafts d where d.tournament_id=p_tournament_id and d.event_id=p_event_id order by d.version desc limit 1 for update;
  if coalesce(v_current.version,0)<>p_expected_version then raise exception using errcode='P0001',message='stale settlement version'; end if;
  v_version:=p_expected_version+1;
  if (select count(distinct (x->>'participantId')::uuid) from jsonb_array_elements(p_placements)x)<>jsonb_array_length(p_placements)
    or (select count(distinct (x->>'placement')::integer) from jsonb_array_elements(p_placements)x)<>jsonb_array_length(p_placements)
    or (select min((x->>'placement')::integer) from jsonb_array_elements(p_placements)x)<>1
    or (select max((x->>'placement')::integer) from jsonb_array_elements(p_placements)x)<>jsonb_array_length(p_placements)
    or exists(select 1 from jsonb_array_elements(p_placements)x where not exists(select 1 from app.qualification_result_rows q where q.result_version_id=p_qualification_result_version_id and q.participant_id=(x->>'participantId')::uuid and q.qualification_status='qualified'))
    or exists(select 1 from jsonb_array_elements(p_awards)x where not exists(select 1 from app.qualification_result_rows q where q.result_version_id=p_qualification_result_version_id and q.participant_id=(x->>'participantId')::uuid and q.qualification_status='qualified'))
    or exists(select 1 from jsonb_array_elements(p_awards)x where x->>'awardType'='q_pool' and not exists(select 1 from app.tournament_setup_q_pool_versions qp where qp.tournament_id=p_tournament_id and qp.setup_revision_id=v_activation.setup_revision_id and qp.setup_event_version_id=v_activation.setup_event_version_id and qp.slot=(x->>'qPoolSlot')::integer))
    or exists(select 1 from (select (x->>'participantId')::uuid participant_id,x->>'awardType' award_type,coalesce((x->>'qPoolSlot')::integer,0) slot,count(*) from jsonb_array_elements(p_awards)x group by 1,2,3 having count(*)>1) duplicate)
    then raise exception using errcode='P0001',message='invalid settlement claims'; end if;
  with latest as(select distinct on(roster_entry_id) * from app.roster_payment_events where tournament_id=p_tournament_id order by roster_entry_id,version desc)
   select count(*)::integer,coalesce(sum(amount_minor),0)::bigint into v_payment_count,v_payment_total from latest where event_type='received';
  with latest as(select distinct on(expense_id) * from app.tournament_expense_events where tournament_id=p_tournament_id order by expense_id,version desc)
   select count(*)::integer,coalesce(sum(amount_minor),0)::bigint into v_expense_count,v_expense_total from latest where event_type='recorded';
  v_response:=jsonb_build_object('status','settlement_draft_saved','tournamentId',p_tournament_id,'eventId',p_event_id,
   'qualificationResultVersionId',p_qualification_result_version_id,'settlementDraftId',v_id,'version',v_version,
   'supersedesSettlementDraftId',v_current.id,'placementCount',jsonb_array_length(p_placements),'awardCount',jsonb_array_length(p_awards),
   'currencyCode','USD',
   'paymentReceiptCount',v_payment_count,'paymentReceiptTotalMinor',v_payment_total,'expenseCount',v_expense_count,
   'expenseTotalMinor',v_expense_total,'reconciled',false,'blockers',v_blockers);
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
   values(v_receipt,p_tournament_id,p_actor_id,'save_standard_singles_settlement_draft_v1',p_event_id,v_hash,p_operation_id,'accepted',v_response,v_now);
  insert into app.standard_singles_settlement_drafts(id,tournament_id,event_id,qualification_result_version_id,version,supersedes_draft_id,setup_revision_id,setup_event_version_id,payment_receipt_count,payment_receipt_total_minor,expense_count,expense_total_minor,currency_code,blockers,reconciled,actor_profile_id,operation_receipt_id,created_at)
   values(v_id,p_tournament_id,p_event_id,p_qualification_result_version_id,v_version,v_current.id,v_activation.setup_revision_id,v_activation.setup_event_version_id,v_payment_count,v_payment_total,v_expense_count,v_expense_total,'USD',v_blockers,false,p_actor_id,v_receipt,v_now);
  insert into app.standard_singles_settlement_placements(settlement_draft_id,tournament_id,event_id,participant_id,placement,prize_amount_minor,currency_code)
   select v_id,p_tournament_id,p_event_id,(x->>'participantId')::uuid,(x->>'placement')::integer,(x->>'prizeAmountMinor')::integer,'USD' from jsonb_array_elements(p_placements)x;
  insert into app.standard_singles_settlement_awards(settlement_draft_id,tournament_id,event_id,participant_id,award_type,q_pool_slot,amount_minor,currency_code,note)
   select v_id,p_tournament_id,p_event_id,(x->>'participantId')::uuid,x->>'awardType',case when jsonb_typeof(x->'qPoolSlot')='number' then (x->>'qPoolSlot')::smallint end,(x->>'amountMinor')::integer,'USD',x->>'note' from jsonb_array_elements(p_awards)x;
  with latest as(select distinct on(roster_entry_id) * from app.roster_payment_events where tournament_id=p_tournament_id order by roster_entry_id,version desc)
   insert into app.standard_singles_settlement_payment_sources select v_id,p_tournament_id,id,roster_entry_id,amount_minor from latest where event_type='received';
  with latest as(select distinct on(expense_id) * from app.tournament_expense_events where tournament_id=p_tournament_id order by expense_id,version desc)
   insert into app.standard_singles_settlement_expense_sources select v_id,p_tournament_id,id,expense_id,amount_minor from latest where event_type='recorded';
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
   values(p_tournament_id,p_actor_id,v_receipt,'standard_singles_settlement_draft',v_id,'settlement_draft_saved',v_response);
  return v_response;
 exception when sqlstate 'P0001' then get stacked diagnostics v_error=message_text;
  v_code:=case v_error when 'tournament unavailable' then 'tournament_unavailable' when 'director role required' then 'not_director'
   when 'qualification result unavailable' then 'qualification_result_unavailable' when 'activated setup unavailable' then 'activated_setup_unavailable'
   when 'stale settlement version' then 'stale_version' when 'invalid settlement claims' then 'invalid_claims' else 'invalid_request' end;
  v_response:=jsonb_build_object('status','rejected','code',v_code,'eventId',p_event_id);
  if v_authorized and p_operation_id is not null and v_hash is not null then
   insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
   values(p_tournament_id,p_actor_id,'save_standard_singles_settlement_draft_v1',coalesce(p_event_id,p_tournament_id),v_hash,p_operation_id,'rejected',v_response,clock_timestamp());
  end if; return v_response;
 end;
end $$;

create or replace function public.get_standard_singles_settlement_workspace_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
with allowed as(select 1 where coalesce(auth.role(),'')='service_role' and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director'))),
 qv as(select * from app.qualification_result_versions where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1),
 activation as(select * from app.tournament_setup_activations where tournament_id=p_tournament_id and event_id=p_event_id),
 current_draft as(select * from app.standard_singles_settlement_drafts where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1)
select jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,'qualificationResultVersionId',qv.id,'currencyCode','USD',
 'currentVersion',coalesce(current_draft.version,0),'qualifierChoices',coalesce((select jsonb_agg(jsonb_build_object('participantId',r.participant_id,'displayName',r.display_name_snapshot,'qualificationRank',r.ranking_ordinal) order by r.ranking_ordinal) from app.qualification_result_rows r where r.result_version_id=qv.id and r.qualification_status='qualified'),'[]'::jsonb),
 'configuredQPools',coalesce((select jsonb_agg(jsonb_build_object('qPoolId',p.id,'slot',p.slot,'poolTypeCode',p.pool_type_code,'entryFeeMinor',p.entry_fee_cents) order by p.slot) from app.tournament_setup_q_pool_versions p where p.tournament_id=p_tournament_id and p.setup_revision_id=activation.setup_revision_id and p.setup_event_version_id=activation.setup_event_version_id),'[]'::jsonb),
 'draft',case when current_draft.id is null then null else jsonb_build_object('settlementDraftId',current_draft.id,'version',current_draft.version,'createdAt',current_draft.created_at,'createdBy',profile.display_name,
  'placements',coalesce((select jsonb_agg(jsonb_build_object('participantId',p.participant_id,'placement',p.placement,'prizeAmountMinor',p.prize_amount_minor) order by p.placement) from app.standard_singles_settlement_placements p where p.settlement_draft_id=current_draft.id),'[]'::jsonb),
  'awards',coalesce((select jsonb_agg(jsonb_build_object('participantId',a.participant_id,'awardType',a.award_type,'qPoolSlot',a.q_pool_slot,'amountMinor',a.amount_minor,'note',a.note) order by a.participant_id,a.award_type,a.q_pool_slot) from app.standard_singles_settlement_awards a where a.settlement_draft_id=current_draft.id),'[]'::jsonb),
  'serverTotals',jsonb_build_object('currencyCode','USD','activePaymentReceiptCount',current_draft.payment_receipt_count,'activePaymentReceiptTotalMinor',current_draft.payment_receipt_total_minor,'activeExpenseCount',current_draft.expense_count,'activeExpenseTotalMinor',current_draft.expense_total_minor,'netCashPositionMinor',current_draft.payment_receipt_total_minor-current_draft.expense_total_minor),
  'reconciled',false,'blockers',current_draft.blockers) end,
 'capabilities',jsonb_build_object('publication',false,'approval',false,'officialExport',false,'mrpEntry',false))
from allowed cross join qv cross join activation left join current_draft on true left join app.profiles profile on profile.id=current_draft.actor_profile_id
$$;

create or replace function public.get_standard_singles_settlement_reconciliation_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when coalesce(auth.role(),'')='service_role' and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director'))
 then jsonb_build_object('authorized',true,'result',(select receipt.response_payload from app.operation_receipts receipt where receipt.actor_profile_id=p_actor_id and receipt.tournament_id=p_tournament_id and receipt.operation_type='save_standard_singles_settlement_draft_v1' and receipt.target_id=p_event_id and receipt.client_operation_id=p_operation_id limit 1)) else null end
$$;

revoke all on function public.save_standard_singles_settlement_draft_v1(uuid,uuid,uuid,uuid,integer,jsonb,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_settlement_workspace_v1(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_settlement_reconciliation_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_standard_singles_settlement_draft_v1(uuid,uuid,uuid,uuid,integer,jsonb,jsonb,uuid) to service_role;
grant execute on function public.get_standard_singles_settlement_workspace_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.get_standard_singles_settlement_reconciliation_v1(uuid,uuid,uuid,uuid) to service_role;
