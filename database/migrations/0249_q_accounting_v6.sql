-- LOCAL PROPOSAL ONLY. Canonical accounting of UNPAID liabilities, never disbursement.
begin;
create table app.q_accounting_drafts_v6 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id), event_id uuid not null,
 version integer not null check(version between 1 and 256), supersedes_id uuid references app.q_accounting_drafts_v6(id),
 q_review_id uuid not null references app.q_obligation_reviews_v2(id),
 source_digest text not null check(source_digest ~ '^[a-f0-9]{64}$'),
 request_payload jsonb not null, facts jsonb not null, source_manifest jsonb not null,
 status text not null default 'unpaid' check(status='unpaid'),
 actor_id uuid not null references app.profiles(id), operation_receipt_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(event_id,version),unique(id,tournament_id,event_id)
);
create table app.q_accounting_finals_v6 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id), event_id uuid not null,
 draft_id uuid not null, version integer not null default 1 check(version=1),
 source_digest text not null check(source_digest ~ '^[a-f0-9]{64}$'),
 status text not null default 'unpaid' check(status='unpaid'),
 reason text not null check(length(trim(reason)) between 1 and 500),
 actor_id uuid not null references app.profiles(id), operation_receipt_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(draft_id,tournament_id,event_id)references app.q_accounting_drafts_v6(id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(event_id)
);
do $$declare n text;begin foreach n in array array['q_accounting_drafts_v6','q_accounting_finals_v6']loop
 execute format('alter table app.%I enable row level security',n);
 execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 execute format('create index %I on app.%I(tournament_id)',n||'_tournament_idx',n);
 execute format('create index %I on app.%I(actor_id)',n||'_actor_idx',n);
 execute format('create index %I on app.%I(operation_receipt_id,tournament_id)',n||'_receipt_idx',n);
end loop;end$$;
create index q_accounting_draft_review_idx on app.q_accounting_drafts_v6(q_review_id);
create index q_accounting_draft_supersedes_idx on app.q_accounting_drafts_v6(supersedes_id);
create index q_accounting_final_draft_idx on app.q_accounting_finals_v6(draft_id,tournament_id,event_id);

-- Existing setup schedule semantics and settings fingerprints are preserved.
-- New Q schedules may be saved only before ANY collection/election, never
-- invented retrospectively while finalizing a tournament.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('public.save_setup_prize_schedule_v1(uuid,uuid,uuid,jsonb,uuid)'::regprocedure);
 p:=replace(d, 'or settings->>''qPoolCount'' <> ''0'' or settings->>''sidePoolCount'' <> ''0''',
 'or (settings->>''qPoolCount'')::integer not between 0 and 2 or settings->>''sidePoolCount'' <> ''0''');
 if p=d then raise exception 'Reviewed setup eligibility anchor changed';end if;
 d:=p;p:=replace(d,'if app.prize_schedule_revision_is_open_v1(p_tournament_id, p_client_row_id) is distinct from true then',
 'if (settings->>''qPoolCount'')::integer>0 and (exists(select 1 from app.roster_payment_events where tournament_id=p_tournament_id) or exists(select 1 from app.q_pool_membership_versions_v1 where tournament_id=p_tournament_id)) then raise exception ''schedule_revision_closed'';end if;
    if app.prize_schedule_revision_is_open_v1(p_tournament_id, p_client_row_id) is distinct from true then');
 if p=d then raise exception 'Reviewed setup timing anchor changed';end if;execute p;
 d:=pg_get_functiondef('app.setup_prize_schedule_workspace_v1(uuid,uuid,uuid)'::regprocedure);
 p:=replace(d,'settings->>''qPoolCount'' = ''0''','(settings->>''qPoolCount'')::integer between 0 and 2');
 if p=d then raise exception 'Reviewed setup workspace anchor changed';end if;execute p;
end$$;

create function app.q_base_financial_basis_v6(p_tid uuid,p_eid uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid;m jsonb;e jsonb;p jsonb;ledger jsonb;expenses jsonb;gross numeric:=0;qfund numeric:=0;received numeric:=0;full_total numeric;count_entries integer;active_count integer;
begin
 select profile_id into actor from app.tournament_roles where tournament_id=p_tid and role='director' order by profile_id limit 1;
 if actor is null or (select count(*)from app.tournament_setup_activations where tournament_id=p_tid)<>1
  or (select count(*)from app.events where tournament_id=p_tid and operational_state='active')<>1
  or exists(select 1 from app.tournament_setup_side_pool_versions where tournament_id=p_tid)
  or not exists(select 1 from app.tournament_setup_activations a join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id where a.tournament_id=p_tid and a.event_id=p_eid and v.event_kind='main' and v.format_code='standard_singles' and v.style_code='Standard' and v.game_count=12 and v.entry_fee_cents>0)
 then return jsonb_build_object('status','blocked','code','unsupported_scope');end if;
 m:=public.get_q_pool_membership_workspace_v1(actor,p_tid);
 if m is null or m->>'supported' is distinct from 'true' or m->>'eventId' is distinct from p_eid::text
  or jsonb_array_length(m->'pools')not between 1 and 2 then return jsonb_build_object('status','blocked','code','unsupported_scope');end if;
 count_entries:=jsonb_array_length(m->'entries');
 select count(*)into active_count from app.tournament_roster_entries r left join lateral(select event_type from app.roster_entry_lifecycle_events x where x.roster_entry_id=r.id order by version desc limit 1)life on true where r.tournament_id=p_tid and coalesce(life.event_type,'active')<>'withdrawn';
 if count_entries<1 or count_entries<>active_count or count_entries<>(select count(*)from app.event_participants where tournament_id=p_tid and event_id=p_eid)
  or(select count(distinct value->>'receiptId')from jsonb_array_elements(m->'entries'))<>count_entries
 then return jsonb_build_object('status','blocked','code','funding_unreconciled');end if;
 for e in select value from jsonb_array_elements(m->'entries')loop
  if e->>'allocationCurrent' is distinct from 'true' or e->>'receiptId' is null or (e->>'baseAllocatedMinor')::numeric is distinct from (m->>'baseFeeMinor')::numeric
   or (e->>'receivedMinor')::numeric is distinct from (e->>'obligationMinor')::numeric
  then return jsonb_build_object('status','blocked','code','funding_unreconciled');end if;
  full_total:=(e->>'baseAllocatedMinor')::numeric;
  for p in select value from jsonb_array_elements(e->'pools')loop
   if p->>'elected'='true' and(p->>'paidEntryEligible' is distinct from 'true' or(p->>'amountAllocatedMinor')::numeric is distinct from(p->>'amountOwedMinor')::numeric)
    or p->>'elected'='false' and(p->>'amountAllocatedMinor')::numeric<>0 then return jsonb_build_object('status','blocked','code','funding_unreconciled');end if;
   full_total:=full_total+(p->>'amountAllocatedMinor')::numeric;
   qfund:=qfund+(p->>'amountAllocatedMinor')::numeric;
  end loop;
  if full_total is distinct from(e->>'receivedMinor')::numeric then return jsonb_build_object('status','blocked','code','funding_unreconciled');end if;
  gross:=gross+(e->>'baseAllocatedMinor')::numeric;received:=received+(e->>'receivedMinor')::numeric;
 end loop;
 ledger:=app.settlement_ledger_v5(p_tid);
 if exists(select 1 from app.roster_payment_events r where r.tournament_id=p_tid and r.event_type='received' and r.currency_code<>'USD' and not exists(select 1 from app.roster_payment_events newer where newer.roster_entry_id=r.roster_entry_id and newer.version>r.version))
  or exists(select 1 from app.tournament_expense_events e where e.tournament_id=p_tid and e.event_type='recorded' and e.currency_code<>'USD' and not exists(select 1 from app.tournament_expense_events newer where newer.expense_id=e.expense_id and newer.version>e.version))then return jsonb_build_object('status','blocked','code','funding_unreconciled');end if;
 if (ledger->>'paymentCount')::integer<>count_entries or(ledger->>'paymentTotalMinor')::numeric<>received or received<>gross+qfund or received>9007199254740991 then return jsonb_build_object('status','blocked','code','funding_unreconciled');end if;
 with latest as(select distinct on(expense_id)*from app.tournament_expense_events where tournament_id=p_tid order by expense_id,version desc)
 select coalesce(jsonb_agg(jsonb_build_object('expenseEventId',id,'description',description,'amountMinor',amount_minor)order by id),'[]')into expenses from latest where event_type='recorded';
 return jsonb_build_object('status','supported','grossEntryIncomeMinor',gross::bigint,'qIncomeMinor',qfund::bigint,'receiptTotalMinor',received::bigint,'expenses',expenses,'participantFacts',m->'entries','ledgerSnapshot',ledger);
end$$;
revoke all on function app.q_base_financial_basis_v6(uuid,uuid)from public,anon,authenticated,service_role;

-- Private dispatcher preserves the original no-Q implementation verbatim.
-- Clone rather than rename: the original function OID and dependent callers stay.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.event_prize_schedule_financial_basis_v1(uuid,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION app.event_prize_schedule_financial_basis_v1(','FUNCTION app.event_prize_schedule_financial_basis_pre_q_v6(');
 if p=d then raise exception 'Reviewed financial helper clone anchor changed';end if;execute p;
end$$;
create or replace function app.event_prize_schedule_financial_basis_v1(p_tournament_id uuid,p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if exists(select 1 from app.tournament_setup_q_pool_versions where tournament_id=p_tournament_id)then return app.q_base_financial_basis_v6(p_tournament_id,p_event_id);end if;
 return app.event_prize_schedule_financial_basis_pre_q_v6(p_tournament_id,p_event_id);
end$$;
revoke all on function app.event_prize_schedule_financial_basis_v1(uuid,uuid),app.event_prize_schedule_financial_basis_pre_q_v6(uuid,uuid)from public,anon,authenticated,service_role;

create function app.q_accounting_source_v6(p_actor uuid,p_tid uuid,p_eid uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare qs jsonb;qr app.q_obligation_reviews_v2%rowtype;basis jsonb;outcome app.playoff_outcome_versions_v3%rowtype;source jsonb;mrp jsonb;regular jsonb;facts jsonb;manifest jsonb;blocks jsonb:='[]';qtotal numeric;awardtotal numeric;expense_total numeric;assessment bigint;expense_evidence jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tid and profile_id=p_actor and role='director')or not exists(select 1 from app.events where id=p_eid and tournament_id=p_tid)then return null;end if;
 qs:=app.q_obligation_sources_v2(p_actor,p_tid);
 if qs is null or qs->>'eventId' is distinct from p_eid::text or jsonb_array_length(coalesce(qs->'blockers','["source_blocked"]'))<>0 then blocks:=blocks||'"source_blocked"';end if;
 select *into qr from app.q_obligation_reviews_v2 where tournament_id=p_tid and event_id=p_eid order by version desc limit 1;
 if qr.id is null or qr.source_digest is distinct from qs->>'sourceDigest' or qr.obligations is distinct from qs->'obligations' then blocks:=blocks||'"q_review_required"';end if;
 basis:=app.q_base_financial_basis_v6(p_tid,p_eid);
 if basis->>'status' is distinct from 'supported'then blocks:=blocks||jsonb_build_array(coalesce(basis->>'code','funding_unreconciled'));end if;
 select *into outcome from app.playoff_outcome_versions_v3 where tournament_id=p_tid and event_id=p_eid order by version desc limit 1;
 source:=case when outcome.id is null then null else jsonb_build_object('kind','playoff_outcome_v3','resultId',outcome.id,'qualificationResultVersionId',outcome.qualification_result_version_id)end;
 if source is null or app.settlement_source_current_v5(p_tid,p_eid,source)is distinct from true then blocks:=blocks||'"source_blocked"';else mrp:=app.canonical_settlement_mrp_v5(p_tid,p_eid,source);end if;
 if mrp is null or mrp->>'status' is distinct from 'available'or jsonb_array_length(mrp->'rows')<>4 or exists(select 1 from jsonb_array_elements(mrp->'rows')r where coalesce((r->>'byeWins')::integer,0)<>0)then blocks:=blocks||'"unsupported_scope"';end if;
 if source is not null then regular:=app.resolve_event_prize_schedule_v1(p_tid,p_eid,source);end if;
 if regular is null or regular->>'status'='unstructured'then blocks:=blocks||'"schedule_required"';elsif regular->>'status'<>'available'then blocks:=blocks||'"schedule_revision_required"';end if;
 if exists(select 1 from app.event_settlement_drafts_v5 where event_id=p_eid)or exists(select 1 from app.standard_singles_settlement_drafts where event_id=p_eid)or exists(select 1 from app.event_settlement_finals_v2 where event_id=p_eid)or exists(select 1 from app.standard_singles_settlement_final_versions where event_id=p_eid)then blocks:=blocks||'"legacy_settlement_preserved"';end if;
 select coalesce(jsonb_agg(jsonb_build_object('expenseEventId',e->'expenseEventId','description',e->'description','amountMinor',e->'amountMinor','currencyCode','USD')order by e->>'expenseEventId'),'[]')into expense_evidence from jsonb_array_elements(coalesce(basis->'expenses','[]'))e;
 if basis->>'status'='supported'and regular->>'status'='available'and qr.id is not null then
  select coalesce(sum((p->>'fundMinor')::numeric),0)into qtotal from jsonb_array_elements(qr.obligations)p;
  select coalesce(sum((a->>'totalAwardMinor')::numeric),0)into awardtotal from jsonb_array_elements(regular->'awards')a;
  select coalesce(sum((e->>'amountMinor')::numeric),0)into expense_total from jsonb_array_elements(basis->'expenses')e;
  if qtotal is distinct from(basis->>'qIncomeMinor')::numeric or(basis->>'grossEntryIncomeMinor')::numeric<>expense_total+awardtotal or(basis->>'receiptTotalMinor')::numeric<>(basis->>'grossEntryIncomeMinor')::numeric+qtotal then blocks:=blocks||'"non_conserving_ledger"';end if;
  assessment:=app.settlement_assessment_v5(p_eid);
  if assessment is null then blocks:=blocks||'"sanctioning_assessment_unfunded"';end if;
  facts:=jsonb_build_object('baseIncomeMinor',(basis->>'grossEntryIncomeMinor')::bigint,'qIncomeMinor',qtotal::bigint,'receiptTotalMinor',(basis->>'receiptTotalMinor')::bigint,'expenseTotalMinor',expense_total::bigint,'regularAwardMinor',awardtotal::bigint,'minimumReturnMinor',app.minimum_payback_return_minor_v1((basis->>'grossEntryIncomeMinor')::numeric),'expenseEvidence',expense_evidence,'ledgerSnapshot',basis->'ledgerSnapshot','canonicalMrp',mrp);
 end if;
 manifest:=jsonb_build_object('version','q-accounting-v6-unpaid','qSource',qs,'qReview',to_jsonb(qr),'baseBasis',basis,'playoffSource',source,'canonicalMrp',mrp,'regularSchedule',regular,'assessment',assessment,'blocks',blocks);
 return jsonb_build_object('sourceDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'),'manifest',manifest,'blockers',blocks,'facts',facts,'regularSchedule',case when regular->>'status'='available'then regular else null end,'source',source,
 'qReview',case when qr.id is null then null else jsonb_build_object('id',qr.id,'version',qr.version,'sourceDigest',qr.source_digest,'obligations',qr.obligations)end);
end$$;
revoke all on function app.q_accounting_source_v6(uuid,uuid,uuid)from public,anon,authenticated,service_role;

create function app.validate_q_accounting_expenses_v6(p_tid uuid,p_eid uuid,p_facts jsonb,p_classes jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare benefit numeric:=0;operating numeric:=0;item jsonb;e jsonb;assessment bigint;sanction_count integer:=0;
begin
 if jsonb_typeof(p_classes)is distinct from'array'then raise exception 'invalid_expense_classification';end if;
 if jsonb_array_length(p_classes)<>jsonb_array_length(p_facts->'expenseEvidence')or(select count(distinct value->>'expenseEventId')from jsonb_array_elements(p_classes))<>jsonb_array_length(p_classes)then raise exception 'invalid_expense_classification';end if;
 assessment:=app.settlement_assessment_v5(p_eid);if assessment is null then raise exception 'sanctioning_assessment_unfunded';end if;
 for item in select value from jsonb_array_elements(p_classes)loop
  if jsonb_typeof(item)is distinct from'object'then raise exception 'invalid_expense_classification';end if;
  if(select count(*)from jsonb_object_keys(item))<>3 or not(item?&array['expenseEventId','category','evidenceReference'])or jsonb_typeof(item->'category')is distinct from'string'or jsonb_typeof(item->'evidenceReference')is distinct from'string'or length(trim(item->>'evidenceReference'))not between 1 and 500 or item->>'evidenceReference'~'[[:cntrl:]]'or item->>'evidenceReference'<>trim(item->>'evidenceReference')then raise exception 'invalid_expense_classification';end if;
  select value into e from jsonb_array_elements(p_facts->'expenseEvidence')where value->>'expenseEventId'=item->>'expenseEventId';if e is null then raise exception 'invalid_expense_classification';end if;
  if item->>'category'in('sanctioning','meals','coffee','donuts','pastries','snacks','charity','trophies')then benefit:=benefit+(e->>'amountMinor')::numeric;
  elsif item->>'category'in('cards','printing','advertising','postage','telephone','supplies','hall_rental')then operating:=operating+(e->>'amountMinor')::numeric;
  else raise exception 'invalid_expense_classification';end if;
  if item->>'category'='sanctioning'then sanction_count:=sanction_count+1;if(e->>'amountMinor')::numeric<>assessment then raise exception 'sanctioning_assessment_unfunded';end if;end if;
 end loop;
 if(assessment>0 and sanction_count<>1)or(assessment=0 and sanction_count>1)then raise exception 'sanctioning_assessment_unfunded';end if;
 if benefit+operating<>(p_facts->>'expenseTotalMinor')::numeric or(p_facts->>'baseIncomeMinor')::numeric<>benefit+operating+(p_facts->>'regularAwardMinor')::numeric then raise exception 'non_conserving_ledger';end if;
 if 100*((p_facts->>'regularAwardMinor')::numeric+benefit)<85*(p_facts->>'baseIncomeMinor')::numeric then raise exception 'insufficient_participant_return';end if;
 return p_facts||jsonb_build_object('benefitExpenseMinor',benefit::bigint,'operatingExpenseMinor',operating::bigint,'participantReturnMinor',benefit+(p_facts->>'regularAwardMinor')::numeric,'expenseClassifications',p_classes);
end$$;
revoke all on function app.validate_q_accounting_expenses_v6(uuid,uuid,jsonb,jsonb)from public,anon,authenticated,service_role;

create function public.get_q_accounting_workspace_v6(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s jsonb;d app.q_accounting_drafts_v6%rowtype;f app.q_accounting_finals_v6%rowtype;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 s:=app.q_accounting_source_v6(p_actor_id,p_tournament_id,p_event_id);if s is null then return null;end if;
 select *into d from app.q_accounting_drafts_v6 where event_id=p_event_id and tournament_id=p_tournament_id order by version desc limit 1;
 select *into f from app.q_accounting_finals_v6 where event_id=p_event_id and tournament_id=p_tournament_id;
 return jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,'sourceDigest',s->'sourceDigest','blockers',s->'blockers','currentDraftVersion',coalesce(d.version,0),'currentFinalVersion',coalesce(f.version,0),'qReview',s->'qReview','regularSchedule',case when jsonb_typeof(s->'regularSchedule')='object'and s->'regularSchedule'->>'status'='available'then(s->'regularSchedule')-'ledgerBasis'else null end,'facts',s->'facts',
 'draft',case when d.id is null then null else jsonb_build_object('id',d.id,'version',d.version,'sourceDigest',d.source_digest,'request',d.request_payload,'facts',d.facts,'current',d.source_digest=s->>'sourceDigest'and jsonb_array_length(s->'blockers')=0)end,
 'finalization',case when f.id is null then null else jsonb_build_object('id',f.id,'version',f.version,'draftId',f.draft_id,'sourceDigest',f.source_digest,'current',f.source_digest=s->>'sourceDigest'and jsonb_array_length(s->'blockers')=0,'status','unpaid')end,'automaticPayment',false);
end$$;

create function app.write_q_accounting_v6(p_actor uuid,p_tid uuid,p_eid uuid,p_request jsonb,p_op uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r app.operation_receipts%rowtype;d app.q_accounting_drafts_v6%rowtype;s jsonb;facts jsonb;response jsonb;h text;code text;current_version integer;oid uuid:=extensions.gen_random_uuid();rid uuid:=extensions.gen_random_uuid();prior uuid;status_value text;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if p_actor is null or p_tid is null or p_eid is null or p_op is null or p_action not in('draft','final')then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||':'||p_op::text,0));
 perform pg_advisory_xact_lock(hashtextextended('qualification-finalization:'||p_eid::text,0));
 perform pg_advisory_xact_lock(hashtextextended('standard-singles-post-event:'||p_eid::text,0));
 perform pg_advisory_xact_lock(hashtextextended('settlement:'||p_eid::text,0));
 perform pg_advisory_xact_lock(hashtextextended('settlement-domain:'||p_eid::text,0));
 select status into status_value from app.tournaments where id=p_tid for update;
 if not found then return jsonb_build_object('status','rejected','eventId',p_eid,'code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=p_tid and profile_id=p_actor and role='director' for update;
 if not found then return jsonb_build_object('status','rejected','eventId',p_eid,'code','not_director');end if;
 perform 1 from app.events where id=p_eid and tournament_id=p_tid for update;
 if not found then return jsonb_build_object('status','rejected','eventId',p_eid,'code','source_blocked');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('q_accounting_v6',p_action,p_actor,p_tid,p_eid,p_request)::text,'utf8'),'sha256'),'hex');
 select *into r from app.operation_receipts where actor_profile_id=p_actor and client_operation_id=p_op;
 if found then
  if r.tournament_id=p_tid and r.target_id=p_eid and r.operation_type='q_accounting_v6_'||p_action and r.request_hash=h then return r.response_payload;end if;
  return jsonb_build_object('status','rejected','eventId',p_eid,'code','idempotency_conflict');
 end if;
 begin
  if status_value not in('open','pending_finalization')then raise exception 'tournament_unavailable';end if;
  if exists(select 1 from app.q_accounting_finals_v6 where event_id=p_eid)then raise exception 'already_finalized';end if;
  if jsonb_typeof(p_request)is distinct from'object'or jsonb_typeof(p_request->'reason')is distinct from'string'or length(trim(p_request->>'reason'))not between 1 and 500 or p_request->>'reason'<>trim(p_request->>'reason')or p_request->>'reason'~'[[:cntrl:]]'or p_request->'reviewed'is distinct from'true'::jsonb or jsonb_typeof(p_request->'expectedVersion')is distinct from'number'or(p_request->>'expectedVersion')!~'^(0|[1-9][0-9]*)$'or(p_request->>'expectedVersion')::numeric>255 then raise exception 'invalid_request';end if;
  s:=app.q_accounting_source_v6(p_actor,p_tid,p_eid);
  if s is null or jsonb_array_length(s->'blockers')<>0 or s->'facts'='null'::jsonb then raise exception 'source_blocked';end if;
  if p_action='draft'then
   if(select count(*)from jsonb_object_keys(p_request))<>7 or not(p_request?&array['expectedVersion','sourceDigest','qReviewId','scheduleVersionId','reason','expenseClassifications','reviewed'])then raise exception 'invalid_request';end if;
   if p_request->>'sourceDigest'is distinct from s->>'sourceDigest'then raise exception 'source_changed';end if;
   if p_request->>'qReviewId'is distinct from s->'qReview'->>'id'then raise exception 'q_review_required';end if;
   if p_request->>'scheduleVersionId'is distinct from s->'regularSchedule'->>'scheduleVersionId'then raise exception 'schedule_revision_required';end if;
   select *into d from app.q_accounting_drafts_v6 where event_id=p_eid order by version desc limit 1;current_version:=coalesce(d.version,0);
   if current_version<>(p_request->>'expectedVersion')::integer then raise exception 'stale_version';end if;
   if d.id is not null and d.source_digest=s->>'sourceDigest'and d.request_payload-'expectedVersion' is not distinct from p_request-'expectedVersion'then raise exception 'already_drafted';end if;
   facts:=app.validate_q_accounting_expenses_v6(p_tid,p_eid,s->'facts',p_request->'expenseClassifications')||jsonb_build_object('source',s->'source');
   prior:=d.id;current_version:=current_version+1;
   response:=jsonb_build_object('status','q_accounting_draft_saved_v6','draftId',rid,'eventId',p_eid,'version',current_version,'sourceDigest',s->'sourceDigest');
  else
   if(select count(*)from jsonb_object_keys(p_request))<>5 or not(p_request?&array['draftId','draftVersion','expectedVersion','reason','reviewed'])or p_request->>'expectedVersion'<>'0'then raise exception 'invalid_request';end if;
   select *into d from app.q_accounting_drafts_v6 where tournament_id=p_tid and event_id=p_eid and id=(p_request->>'draftId')::uuid and version=(p_request->>'draftVersion')::integer;
   if not found or exists(select 1 from app.q_accounting_drafts_v6 where event_id=p_eid and version>d.version)then raise exception 'stale_version';end if;
   if d.source_digest is distinct from s->>'sourceDigest'then raise exception 'source_changed';end if;
   facts:=app.validate_q_accounting_expenses_v6(p_tid,p_eid,s->'facts',d.request_payload->'expenseClassifications')||jsonb_build_object('source',s->'source');
   if facts is distinct from d.facts then raise exception 'source_changed';end if;
   if not exists(select 1 from app.cross_check_finalizations where tournament_id=p_tid)or app.cross_check_finalization_conditions_v1(p_tid)is null or exists(select 1 from jsonb_array_elements(app.cross_check_finalization_conditions_v1(p_tid))c where(c->>'outstanding')::boolean)then raise exception 'crosscheck_incomplete';end if;
   current_version:=1;response:=jsonb_build_object('status','q_accounting_finalized_unpaid_v6','finalizationId',rid,'draftId',d.id,'eventId',p_eid,'version',1,'sourceDigest',s->'sourceDigest');
  end if;
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
  code:=case when sqlerrm='settlement_domain_conflict'then'legacy_settlement_preserved'when sqlerrm in('tournament_unavailable','unsupported_scope','source_blocked','source_changed','stale_version','already_finalized','already_drafted','q_review_required','schedule_required','schedule_revision_required','funding_unreconciled','legacy_settlement_preserved','invalid_expense_classification','sanctioning_assessment_unfunded','insufficient_participant_return','non_conserving_ledger','crosscheck_incomplete')then sqlerrm else'invalid_request'end;
  response:=jsonb_build_object('status','rejected','eventId',p_eid,'code',code);
 end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(oid,p_tid,p_actor,'q_accounting_v6_'||p_action,p_eid,h,p_op,case when code is null then'accepted'else'rejected'end,response,clock_timestamp());
 if code is null and p_action='draft'then insert into app.q_accounting_drafts_v6(id,tournament_id,event_id,version,supersedes_id,q_review_id,source_digest,request_payload,facts,source_manifest,actor_id,operation_receipt_id)values(rid,p_tid,p_eid,current_version,prior,(s->'qReview'->>'id')::uuid,s->>'sourceDigest',p_request,facts,s->'manifest',p_actor,oid);
 elsif code is null then insert into app.q_accounting_finals_v6(id,tournament_id,event_id,draft_id,source_digest,reason,actor_id,operation_receipt_id)values(rid,p_tid,p_eid,d.id,s->>'sourceDigest',p_request->>'reason',p_actor,oid);end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tid,p_actor,oid,'q_accounting_v6',case when code is null then rid else p_eid end,'q_accounting_v6_'||p_action||case when code is null then'_unpaid'else'_rejected'end,response);
 return response;
end$$;
revoke all on function app.write_q_accounting_v6(uuid,uuid,uuid,jsonb,uuid,text)from public,anon,authenticated,service_role;
create function public.save_q_accounting_draft_v6(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_q_accounting_v6(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id,'draft');$$;
create function public.finalize_q_accounting_v6(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_q_accounting_v6(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id,'final');$$;
create function public.reconcile_q_accounting_v6(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb,p_action text)returns jsonb language plpgsql stable security definer set search_path=''as $$declare h text;r app.operation_receipts%rowtype;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director')or not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id)or p_action not in('draft','final')then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('q_accounting_v6',p_action,p_actor_id,p_tournament_id,p_event_id,p_request)::text,'utf8'),'sha256'),'hex');
 select *into r from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if not found then return jsonb_build_object('authorized',true,'result',null);end if;
 if r.tournament_id=p_tournament_id and r.target_id=p_event_id and r.operation_type='q_accounting_v6_'||p_action and r.request_hash=h then return jsonb_build_object('authorized',true,'result',r.response_payload);end if;
 return jsonb_build_object('authorized',true,'result',jsonb_build_object('status','rejected','eventId',p_event_id,'code','idempotency_conflict'));
end$$;
revoke all on function public.get_q_accounting_workspace_v6(uuid,uuid,uuid),public.save_q_accounting_draft_v6(uuid,uuid,uuid,jsonb,uuid),public.finalize_q_accounting_v6(uuid,uuid,uuid,jsonb,uuid),public.reconcile_q_accounting_v6(uuid,uuid,uuid,uuid,jsonb,text)from public,anon,authenticated;
grant execute on function public.get_q_accounting_workspace_v6(uuid,uuid,uuid),public.save_q_accounting_draft_v6(uuid,uuid,uuid,jsonb,uuid),public.finalize_q_accounting_v6(uuid,uuid,uuid,jsonb,uuid),public.reconcile_q_accounting_v6(uuid,uuid,uuid,uuid,jsonb,text)to service_role;

-- Bidirectional accounting domain guard; old paths cannot introduce a second
-- liability stream after v6 drafts/finals, and v6 never adopts old settlements.
create function app.require_q_accounting_domain_v6()returns trigger language plpgsql security definer set search_path=''as $$begin
 perform pg_advisory_xact_lock(hashtextextended('settlement-domain:'||new.event_id::text,0));
 if tg_table_name in('q_accounting_drafts_v6','q_accounting_finals_v6')then
  if exists(select 1 from app.standard_singles_settlement_drafts where event_id=new.event_id)or exists(select 1 from app.event_settlement_drafts_v5 where event_id=new.event_id)or exists(select 1 from app.standard_singles_settlement_final_versions where event_id=new.event_id)or exists(select 1 from app.event_settlement_finals_v2 where event_id=new.event_id)then raise exception 'settlement_domain_conflict';end if;
 else if exists(select 1 from app.q_accounting_drafts_v6 where event_id=new.event_id)or exists(select 1 from app.q_accounting_finals_v6 where event_id=new.event_id)then raise exception 'settlement_domain_conflict';end if;end if;
 return new;end$$;
revoke all on function app.require_q_accounting_domain_v6()from public,anon,authenticated,service_role;
do $$declare n text;begin foreach n in array array['q_accounting_drafts_v6','q_accounting_finals_v6','standard_singles_settlement_drafts','event_settlement_drafts_v5','standard_singles_settlement_final_versions','event_settlement_finals_v2']loop execute format('create trigger %I before insert on app.%I for each row execute function app.require_q_accounting_domain_v6()',n||'_q_domain_v6',n);end loop;end$$;
create function app.block_q_review_after_accounting_v6()returns trigger language plpgsql security definer set search_path=''as $$begin
 perform pg_advisory_xact_lock(hashtextextended('qualification-finalization:'||new.event_id::text,0));
 -- The v6 final writer acquires this qualification lock before its domain lock.
 -- Do not acquire domain here after Q's tournament-row lock: legacy v5 obtains
 -- domain before tournament, so that reverse ordering could deadlock.
 if exists(select 1 from app.q_accounting_finals_v6 where event_id=new.event_id and tournament_id=new.tournament_id)then raise exception 'settlement_finalized';end if;
 return new;end$$;
revoke all on function app.block_q_review_after_accounting_v6()from public,anon,authenticated,service_role;
create trigger q_review_blocks_finalized_accounting_v6 before insert on app.q_obligation_reviews_v2 for each row execute function app.block_q_review_after_accounting_v6();
-- Keep old v5 hashes/signatures/grants and accepted replay untouched. New v5
-- attempts against a v6-owned event receive its existing structured rejection
-- inside the original controlled block, before the insert trigger backstop.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.write_event_settlement_v5(uuid,uuid,uuid,jsonb,uuid,text)'::regprocedure);
 p:=replace(d,'if not app.valid_settlement_request_v5(p_request,p_action)then',
 'if exists(select 1 from app.q_operating_policies_v2 where event_id=p_event_id and tournament_id=p_tournament_id)or exists(select 1 from app.q_accounting_drafts_v6 where event_id=p_event_id and tournament_id=p_tournament_id)or exists(select 1 from app.q_accounting_finals_v6 where event_id=p_event_id and tournament_id=p_tournament_id)then raise exception ''settlement_domain_conflict'';end if;
  if not app.valid_settlement_request_v5(p_request,p_action)then');
 if p=d then raise exception 'Reviewed v5 controlled domain anchor changed';end if;execute p;
end$$;
commit;
