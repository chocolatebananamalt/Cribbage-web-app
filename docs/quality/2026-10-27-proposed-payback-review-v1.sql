-- LOCAL REVIEWED MIGRATION. Not applied to hosted databases.
-- Adoption boundary: future eligible activations and post-proposal V5 drafts are marked;
-- pre-proposal drafts/finals remain historical until a new draft or accepted review.

create table app.event_payback_review_requirements(
 event_id uuid primary key,tournament_id uuid not null,requirement_source text not null check(requirement_source in('future_activation','new_v5_draft','explicit_review')),
 created_at timestamptz not null default clock_timestamp(),foreign key(event_id,tournament_id)references app.events(id,tournament_id));
create table app.event_payback_reviews_v1(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,draft_id uuid not null,draft_version integer not null check(draft_version>0),version integer not null check(version>0),supersedes_id uuid,
 request_payload jsonb not null,facts_snapshot jsonb not null,totals jsonb not null,recorded_by uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null,
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),foreign key(draft_id,tournament_id,event_id)references app.event_settlement_drafts_v5(id,tournament_id,event_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),foreign key(supersedes_id,tournament_id,event_id)references app.event_payback_reviews_v1(id,tournament_id,event_id),
 unique(event_id,version),unique(id,tournament_id,event_id));
create table app.event_payback_review_conflicts_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 attempted_request_hash text not null check(length(attempted_request_hash)=64),prior_receipt_id uuid references app.operation_receipts(id),reason_code text not null check(reason_code='idempotency_conflict'),created_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id));
alter table app.event_settlement_finals_v2 add column payback_review_id uuid;
alter table app.event_settlement_finals_v2 add constraint settlement_final_payback_review_scope_fk foreign key(payback_review_id,tournament_id,event_id)references app.event_payback_reviews_v1(id,tournament_id,event_id);
do $$declare n text;begin foreach n in array array['event_payback_review_requirements','event_payback_reviews_v1','event_payback_review_conflicts_v1']loop
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);end loop;end $$;
create index event_payback_review_receipt_idx on app.event_payback_reviews_v1(operation_receipt_id);
create index event_payback_review_draft_idx on app.event_payback_reviews_v1(draft_id);

create function app.payback_scope_is_eligible_v1(p_tid uuid,p_eid uuid)
returns boolean language sql stable security definer set search_path='' as $$select exists(
 select 1 from app.tournament_setup_activations a join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id and v.tournament_id=a.tournament_id
 where a.tournament_id=p_tid and a.event_id=p_eid and v.event_kind='main'and v.format_code='standard_singles'and v.game_count=12 and v.entry_fee_cents>0);$$;
revoke all on function app.payback_scope_is_eligible_v1(uuid,uuid)from public,anon,authenticated,service_role;
create function app.mark_event_payback_requirement_v1()
returns trigger language plpgsql security definer set search_path='' as $$declare tid uuid;eid uuid;source text;begin
 if tg_table_name='tournament_setup_activations'then tid:=new.tournament_id;eid:=new.event_id;source:='future_activation';else tid:=new.tournament_id;eid:=new.event_id;source:='new_v5_draft';end if;
 if app.payback_scope_is_eligible_v1(tid,eid)then insert into app.event_payback_review_requirements(event_id,tournament_id,requirement_source)values(eid,tid,source)on conflict(event_id)do nothing;end if;return new;end $$;
revoke all on function app.mark_event_payback_requirement_v1()from public,anon,authenticated,service_role;
create trigger future_activation_requires_payback_review after insert on app.tournament_setup_activations for each row execute function app.mark_event_payback_requirement_v1();
create trigger new_v5_draft_requires_payback_review after insert on app.event_settlement_drafts_v5 for each row execute function app.mark_event_payback_requirement_v1();

create function app.event_payback_facts_v1(p_tid uuid,p_eid uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare setup record;draft app.event_settlement_drafts_v5%rowtype;participant_facts jsonb;qualifiers jsonb;expenses jsonb;current_ledger jsonb;participant_count integer;event_participant_count integer;active_roster_count integer;gross bigint;code text;
begin
 select a.setup_event_version_id,v.entry_fee_cents into setup from app.tournament_setup_activations a join app.tournament_setup_event_versions v on v.id=a.setup_event_version_id and v.tournament_id=a.tournament_id
 where a.tournament_id=p_tid and a.event_id=p_eid and v.event_kind='main'and v.format_code='standard_singles'and v.game_count=12 and v.entry_fee_cents>0;
 if not found then code:='unsupported_payback_scope';end if;
 if code is null and((select count(*)from app.tournament_setup_activations where tournament_id=p_tid)<>1
  or(select count(*)from app.events where tournament_id=p_tid and operational_state='active')<>1)then code:='unsupported_payback_scope';end if;
 if code is null and(exists(select 1 from app.tournament_setup_q_pool_versions q join app.tournament_setup_event_versions v on v.id=q.setup_event_version_id where v.tournament_id=p_tid)
  or exists(select 1 from app.tournament_setup_side_pool_versions s join app.tournament_setup_event_versions v on v.id=s.setup_event_version_id where v.tournament_id=p_tid))then code:='unsupported_payback_scope';end if;
 select *into draft from app.event_settlement_drafts_v5 where tournament_id=p_tid and event_id=p_eid order by version desc limit 1;
 if code is null and draft.id is null then code:='source_unavailable';end if;
 if code is null and app.settlement_source_current_v5(p_tid,p_eid,draft.request_payload->'source')is distinct from true then code:='source_unavailable';end if;
 if code is null and draft.canonical_mrp->>'status'is distinct from'available'then code:='unsupported_payback_scope';end if;
 if code is null and jsonb_typeof(draft.canonical_mrp->'rows')is distinct from'array'then code:='unsupported_payback_scope';end if;
 if code is null and(jsonb_array_length(draft.canonical_mrp->'rows')not between 4 and 256
  or exists(select 1 from jsonb_array_elements(draft.canonical_mrp->'rows')r where coalesce((r->>'byeWins')::integer,0)<>0))then code:='unsupported_payback_scope';end if;
 if code is null then
  select count(*)into event_participant_count from app.event_participants where tournament_id=p_tid and event_id=p_eid;
  select count(*)into active_roster_count from app.tournament_roster_entries roster
   left join lateral(select lifecycle.event_type from app.roster_entry_lifecycle_events lifecycle where lifecycle.roster_entry_id=roster.id order by lifecycle.version desc limit 1)life on true
   where roster.tournament_id=p_tid and coalesce(life.event_type,'active')<>'withdrawn';
  with mapped as(select p.id participant_id,p.roster_entry_id direct_roster_entry_id,l.roster_entry_id linked_roster_entry_id,coalesce(l.link_count,0)link_count,
    coalesce(p.roster_entry_id,l.roster_entry_id)roster_entry_id from app.event_participants p
   left join lateral(select first_link.roster_entry_id,(select count(*)from app.roster_account_links counted where counted.tournament_id=p.tournament_id and counted.profile_id=p.profile_id)link_count
    from app.roster_account_links first_link where first_link.tournament_id=p.tournament_id and first_link.profile_id=p.profile_id order by first_link.id limit 1)l on true
   where p.tournament_id=p_tid and p.event_id=p_eid),facts as(
   select m.*,o.id obligation_id,o.version obligation_version,o.amount_owed_minor,r.id payment_event_id,r.version payment_version,r.event_type,r.amount_minor
   from mapped m left join lateral(select x.id,x.version,x.amount_owed_minor from app.roster_payment_obligation_versions x where x.roster_entry_id=m.roster_entry_id order by x.version desc limit 1)o on true
   left join lateral(select x.id,x.version,x.event_type,x.amount_minor from app.roster_payment_events x where x.roster_entry_id=m.roster_entry_id order by x.version desc limit 1)r on true)
  select count(*),coalesce(jsonb_agg(jsonb_build_object('participantId',participant_id,'rosterEntryId',roster_entry_id,'directRosterEntryId',direct_roster_entry_id,'linkedRosterEntryId',linked_roster_entry_id,'linkCount',link_count,
   'obligationId',obligation_id,'obligationVersion',obligation_version,'amountOwedMinor',amount_owed_minor,'paymentEventId',payment_event_id,'paymentVersion',payment_version,'paymentState',event_type,'amountReceivedMinor',amount_minor)order by participant_id),'[]')
  into participant_count,participant_facts from facts;
  if participant_count<1 or participant_count<>event_participant_count or participant_count<>active_roster_count
   or(select count(distinct value->>'rosterEntryId')from jsonb_array_elements(participant_facts))<>participant_count
   or exists(select 1 from jsonb_array_elements(participant_facts)f where f->>'rosterEntryId'is null or(f->>'linkCount')::integer>1
    or(f->>'directRosterEntryId'is not null and f->>'linkedRosterEntryId'is not null and f->>'directRosterEntryId'<>f->>'linkedRosterEntryId')
    or not exists(select 1 from app.tournament_roster_entries roster left join lateral(select lifecycle.event_type from app.roster_entry_lifecycle_events lifecycle where lifecycle.roster_entry_id=roster.id order by lifecycle.version desc limit 1)life on true
      where roster.id=(f->>'rosterEntryId')::uuid and roster.tournament_id=p_tid and coalesce(life.event_type,'active')<>'withdrawn')
    or f->>'obligationId'is null or f->>'obligationVersion'is null or(f->>'amountOwedMinor')::integer is distinct from setup.entry_fee_cents
    or f->>'paymentEventId'is null or f->>'paymentVersion'is null or f->>'paymentState'is distinct from'received'or(f->>'amountReceivedMinor')::integer is distinct from setup.entry_fee_cents)
  then code:='unsupported_payback_scope';else gross:=participant_count::bigint*setup.entry_fee_cents::bigint;end if;
  current_ledger:=app.settlement_ledger_v5(p_tid);
  if code is null and(current_ledger->>'paymentCount')::integer is distinct from participant_count
   or code is null and(current_ledger->>'paymentTotalMinor')::bigint is distinct from gross
   or code is null and exists(select 1 from app.roster_payment_events where tournament_id=p_tid and event_type='voided')
  then code:='unsupported_payback_scope';end if;
 end if;
 if code is null then
  select coalesce(jsonb_agg(jsonb_build_object('participantId',r->>'participantId','displayName',r->>'displayName','bandStart',(r->>'bandStart')::integer,'bandEnd',(r->>'bandEnd')::integer)order by(r->>'qualificationRank')::integer),'[]')into qualifiers from jsonb_array_elements(draft.canonical_mrp->'rows')r;
  with latest as(select distinct on(expense_id)*from app.tournament_expense_events where tournament_id=p_tid order by expense_id,version desc)
  select coalesce(jsonb_agg(jsonb_build_object('expenseEventId',id,'description',description,'amountMinor',amount_minor)order by id),'[]')into expenses from latest where event_type='recorded';
 end if;
 current_ledger:=coalesce(current_ledger,app.settlement_ledger_v5(p_tid));
 if code is not null then return jsonb_build_object('status','blocked','code',code,'grossEntryIncomeMinor',null,'qualifiers','[]'::jsonb,'expenses','[]'::jsonb,'draftId',case when draft.id is null then null else draft.id end,'draftVersion',case when draft.id is null then null else draft.version end,'participantFacts','[]'::jsonb,'ledgerSnapshot',current_ledger);end if;
 return jsonb_build_object('status','supported','code',null,'grossEntryIncomeMinor',gross,'qualifiers',qualifiers,'expenses',expenses,'draftId',draft.id,'draftVersion',draft.version,'participantFacts',participant_facts,'ledgerSnapshot',current_ledger);
end $$;
revoke all on function app.event_payback_facts_v1(uuid,uuid)from public,anon,authenticated,service_role;

create function app.minimum_payback_return_minor_v1(p_gross numeric)
returns numeric language sql immutable security definer set search_path='' as $$
 select case when p_gross is null or p_gross<0 or p_gross<>trunc(p_gross)or p_gross>9007199254740991::numeric then null
  else ceil(85::numeric*p_gross/100::numeric)end;$$;
revoke all on function app.minimum_payback_return_minor_v1(numeric)from public,anon,authenticated,service_role;

create function app.validate_event_payback_review_v1(p_tid uuid,p_eid uuid,p_request jsonb,p_facts jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare draft app.event_settlement_drafts_v5%rowtype;benefit numeric;operating numeric;awards numeric;gross numeric;assessment bigint;item jsonb;
begin
 if jsonb_typeof(p_request)<>'object'or(select count(*)from jsonb_object_keys(p_request))<>9
  or not(p_request?&array['draftId','draftVersion','expectedVersion','scheduleKind','amountBasis','scheduleReference','sourceReference','eligibilityEvidence','expenseClassifications'])
  or jsonb_typeof(p_request->'scheduleKind')is distinct from'string'or p_request->>'scheduleKind'<>'director_selected'
  or jsonb_typeof(p_request->'amountBasis')is distinct from'string'or p_request->>'amountBasis'<>'total_award'
  or jsonb_typeof(p_request->'scheduleReference')is distinct from'string'or length(trim(p_request->>'scheduleReference'))not between 1 and 500 or p_request->>'scheduleReference'<>trim(p_request->>'scheduleReference')or p_request->>'scheduleReference'~'[[:cntrl:]]'
  or jsonb_typeof(p_request->'sourceReference')is distinct from'string'or length(trim(p_request->>'sourceReference'))not between 1 and 500 or p_request->>'sourceReference'<>trim(p_request->>'sourceReference')or p_request->>'sourceReference'~'[[:cntrl:]]'
  or jsonb_typeof(p_request->'eligibilityEvidence')<>'array'or jsonb_typeof(p_request->'expenseClassifications')<>'array'
  or coalesce(p_request->>'draftId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  or jsonb_typeof(p_request->'draftVersion')is distinct from'number'or coalesce(p_request->>'draftVersion','')!~'^[1-9][0-9]*$'or(p_request->>'draftVersion')::numeric>2147483647
  or jsonb_typeof(p_request->'expectedVersion')is distinct from'number'or coalesce(p_request->>'expectedVersion','')!~'^(0|[1-9][0-9]*)$'or(p_request->>'expectedVersion')::numeric>2147483647
 then raise exception 'invalid_request';end if;
 if p_facts->>'status'<>'supported'then raise exception using message=coalesce(p_facts->>'code','unsupported_payback_scope');end if;
 select *into draft from app.event_settlement_drafts_v5 where id=(p_request->>'draftId')::uuid and tournament_id=p_tid and event_id=p_eid and version=(p_request->>'draftVersion')::integer;
 if not found or draft.id::text<>p_facts->>'draftId'or draft.version::text<>p_facts->>'draftVersion'then raise exception 'source_unavailable';end if;
 if exists(select 1 from app.event_settlement_finals_v2 where tournament_id=p_tid and event_id=p_eid and draft_id=draft.id)
  or exists(select 1 from app.standard_singles_settlement_final_versions where tournament_id=p_tid and event_id=p_eid)
 then raise exception 'source_already_finalized';end if;
 if draft.ledger_snapshot is distinct from app.settlement_ledger_v5(p_tid)or draft.ledger_snapshot is distinct from p_facts->'ledgerSnapshot'then raise exception 'ledger_snapshot_changed';end if;
 if jsonb_array_length(p_request->'eligibilityEvidence')<>jsonb_array_length(p_facts->'qualifiers')
  or(select count(distinct value->>'participantId')from jsonb_array_elements(p_request->'eligibilityEvidence'))<>jsonb_array_length(p_request->'eligibilityEvidence')
  or exists(select 1 from jsonb_array_elements(p_request->'eligibilityEvidence')e where jsonb_typeof(e)is distinct from'object'
   or(select count(*)from jsonb_object_keys(case when jsonb_typeof(e)='object'then e else'{}'::jsonb end))<>3 or not(e?&array['participantId','basis','evidenceReference'])
   or jsonb_typeof(e->'participantId')is distinct from'string'or coalesce(e->>'participantId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   or jsonb_typeof(e->'basis')is distinct from'string'or e->>'basis'<>'full_entry_cash_eligible'or jsonb_typeof(e->'evidenceReference')is distinct from'string'
   or length(trim(e->>'evidenceReference'))not between 1 and 500 or e->>'evidenceReference'<>trim(e->>'evidenceReference')or e->>'evidenceReference'~'[[:cntrl:]]'
   or not exists(select 1 from jsonb_array_elements(p_facts->'qualifiers')q where q->>'participantId'=e->>'participantId'))then raise exception 'payback_evidence_required';end if;
 if jsonb_array_length(p_request->'expenseClassifications')<>jsonb_array_length(p_facts->'expenses')
  or(select count(distinct value->>'expenseEventId')from jsonb_array_elements(p_request->'expenseClassifications'))<>jsonb_array_length(p_request->'expenseClassifications')
  or exists(select 1 from jsonb_array_elements(p_request->'expenseClassifications')c where jsonb_typeof(c)is distinct from'object'
   or(select count(*)from jsonb_object_keys(case when jsonb_typeof(c)='object'then c else'{}'::jsonb end))<>3 or not(c?&array['expenseEventId','category','evidenceReference'])
   or jsonb_typeof(c->'expenseEventId')is distinct from'string'or coalesce(c->>'expenseEventId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   or jsonb_typeof(c->'category')is distinct from'string'or c->>'category'not in('sanctioning','meals','coffee','donuts','pastries','snacks','charity','trophies','cards','printing','advertising','postage','telephone','supplies','hall_rental')
   or jsonb_typeof(c->'evidenceReference')is distinct from'string'or length(trim(c->>'evidenceReference'))not between 1 and 500 or c->>'evidenceReference'<>trim(c->>'evidenceReference')or c->>'evidenceReference'~'[[:cntrl:]]'
   or not exists(select 1 from jsonb_array_elements(p_facts->'expenses')e where e->>'expenseEventId'=c->>'expenseEventId'))then raise exception 'expense_classification_required';end if;
 assessment:=app.settlement_assessment_v5(p_eid);
 if assessment is null or(select count(*)from jsonb_array_elements(p_request->'expenseClassifications')c where c->>'category'='sanctioning')<>1
  or not exists(select 1 from jsonb_array_elements(p_request->'expenseClassifications')c join jsonb_array_elements(p_facts->'expenses')e on e->>'expenseEventId'=c->>'expenseEventId'
   where c->>'category'='sanctioning'and(e->>'amountMinor')::bigint=assessment and c->>'expenseEventId'=draft.request_payload->>'sanctioningExpenseEventId')
 then raise exception 'expense_classification_required';end if;
 -- V5 prizeClaims are one total-award row per participant. This review never
 -- adds cohort awards cumulatively and never derives an ACC payout schedule.
 if jsonb_array_length(draft.request_payload->'prizeClaims')<>jsonb_array_length(p_facts->'qualifiers')
  or(select count(distinct value->>'participantId')from jsonb_array_elements(draft.request_payload->'prizeClaims'))<>jsonb_array_length(draft.request_payload->'prizeClaims')
  or exists(select 1 from jsonb_array_elements(draft.request_payload->'prizeClaims')a where(a->>'amountMinor')::bigint<=0 or not exists(select 1 from jsonb_array_elements(p_facts->'qualifiers')q where q->>'participantId'=a->>'participantId'))then raise exception 'qualifier_award_missing';end if;
 if exists(select 1 from jsonb_array_elements(p_facts->'qualifiers')a join jsonb_array_elements(p_facts->'qualifiers')b on a->>'participantId'<b->>'participantId'and a->>'bandStart'=b->>'bandStart'and a->>'bandEnd'=b->>'bandEnd'
  join jsonb_array_elements(draft.request_payload->'prizeClaims')pa on pa->>'participantId'=a->>'participantId'join jsonb_array_elements(draft.request_payload->'prizeClaims')pb on pb->>'participantId'=b->>'participantId'
  where pa->>'amountMinor'<>pb->>'amountMinor'or pa->'prizeOrder'<>'null'::jsonb or pb->'prizeOrder'<>'null'::jsonb)then raise exception 'equal_cohort_award_mismatch';end if;
 select coalesce(sum((e->>'amountMinor')::bigint)filter(where c->>'category'in('sanctioning','meals','coffee','donuts','pastries','snacks','charity','trophies')),0),
  coalesce(sum((e->>'amountMinor')::bigint)filter(where c->>'category'in('cards','printing','advertising','postage','telephone','supplies','hall_rental')),0)
 into benefit,operating from jsonb_array_elements(p_request->'expenseClassifications')c join jsonb_array_elements(p_facts->'expenses')e on e->>'expenseEventId'=c->>'expenseEventId';
 select coalesce(sum((value->>'amountMinor')::bigint),0)into awards from jsonb_array_elements(draft.request_payload->'prizeClaims');gross:=(p_facts->>'grossEntryIncomeMinor')::bigint;
 if gross>9007199254740991::numeric or benefit>9007199254740991::numeric or operating>9007199254740991::numeric or awards>9007199254740991::numeric
  or benefit+operating>9007199254740991::numeric or awards+benefit>9007199254740991::numeric then raise exception 'non_conserving_ledger';end if;
 if(draft.request_payload->>'eventIncomeMinor')::bigint<>gross or(draft.request_payload->>'eventExpenseMinor')::bigint<>benefit+operating
  or(draft.request_payload->>'retainedBalanceMinor')::bigint<>0 or gross<>benefit+operating+awards then raise exception 'non_conserving_ledger';end if;
 if 100::numeric*(awards+benefit)<85::numeric*gross then raise exception 'insufficient_participant_return';end if;
 return jsonb_build_object('grossEntryIncomeMinor',gross,'benefitExpenseMinor',benefit,'operatingExpenseMinor',operating,'awardTotalMinor',awards,
  'minimumParticipantReturnMinor',app.minimum_payback_return_minor_v1(gross),'participantReturnMinor',awards+benefit);
end $$;
revoke all on function app.validate_event_payback_review_v1(uuid,uuid,jsonb,jsonb)from public,anon,authenticated,service_role;

create function public.get_event_payback_workspace_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare facts jsonb;review app.event_payback_reviews_v1%rowtype;required boolean;
begin
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))
  or not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id)then return null;end if;
 required:=exists(select 1 from app.event_payback_review_requirements where tournament_id=p_tournament_id and event_id=p_event_id);
 facts:=app.event_payback_facts_v1(p_tournament_id,p_event_id);
 select *into review from app.event_payback_reviews_v1 where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;
 return jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,'required',required,
  'currentReviewVersion',coalesce(review.version,0),'scope',jsonb_build_object('status',facts->>'status','code',facts->'code','grossEntryIncomeMinor',facts->'grossEntryIncomeMinor','qualifiers',facts->'qualifiers','expenses',facts->'expenses'),
  'review',case when review.id is null then null else jsonb_build_object('reviewId',review.id,'version',review.version,'draftId',review.draft_id,'draftVersion',review.draft_version,
   'current',review.draft_id::text=facts->>'draftId'and review.draft_version::text=facts->>'draftVersion'and review.facts_snapshot is not distinct from facts,
   'request',review.request_payload,'totals',review.totals)end);
end $$;

create function public.save_event_payback_review_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt app.operation_receipts%rowtype;response jsonb;facts jsonb;totals jsonb;hash text;code text;status_value text;version_no integer;prior uuid;
 rid uuid:=extensions.gen_random_uuid();review_id uuid:=extensions.gen_random_uuid();stamp timestamptz:=clock_timestamp();
begin
 if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','invalid_request');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('settlement:'||p_event_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('settlement-domain:'||p_event_id::text,0));
 select status into status_value from app.tournaments where id=p_tournament_id for update;
 if not found then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')for update;
 if not found then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','not_director');end if;
 if not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id)then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','source_unavailable');end if;
 hash:=encode(extensions.digest(convert_to(jsonb_build_array('save_event_payback_review_v1',p_actor_id,p_tournament_id,p_event_id,p_request)::text,'utf8'),'sha256'),'hex');
 select *into receipt from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
  if receipt.tournament_id=p_tournament_id and receipt.target_id=p_event_id and receipt.operation_type='save_event_payback_review_v1'and receipt.request_hash=hash then return receipt.response_payload;end if;
  insert into app.event_payback_review_conflicts_v1(tournament_id,event_id,actor_id,operation_id,attempted_request_hash,prior_receipt_id,reason_code)
   values(p_tournament_id,p_event_id,p_actor_id,p_operation_id,hash,case when receipt.tournament_id=p_tournament_id then receipt.id end,'idempotency_conflict');
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)
   values(p_tournament_id,p_actor_id,'event_payback_review_v1',p_event_id,'payback_review_idempotency_conflict',jsonb_build_object('operationId',p_operation_id));
  return jsonb_build_object('status','rejected','eventId',p_event_id,'code','idempotency_conflict');
 end if;
 begin
  if status_value not in('open','pending_finalization')then raise exception 'tournament_unavailable';end if;
  facts:=app.event_payback_facts_v1(p_tournament_id,p_event_id);
  select coalesce(max(version),0)into version_no from app.event_payback_reviews_v1 where tournament_id=p_tournament_id and event_id=p_event_id;
  if jsonb_typeof(p_request)is distinct from'object'or jsonb_typeof(p_request->'expectedVersion')is distinct from'number'
   or coalesce(p_request->>'expectedVersion','')!~'^(0|[1-9][0-9]*)$'or(p_request->>'expectedVersion')::numeric>2147483647 then raise exception 'invalid_request';end if;
  if(p_request->>'expectedVersion')::integer<>version_no then raise exception 'stale_version';end if;
  totals:=app.validate_event_payback_review_v1(p_tournament_id,p_event_id,p_request,facts);
  select id into prior from app.event_payback_reviews_v1 where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;
  version_no:=version_no+1;
  response:=jsonb_build_object('status','payback_review_saved_v1','tournamentId',p_tournament_id,'eventId',p_event_id,'reviewId',review_id,'version',version_no);
 exception when sqlstate'P0001'then
  code:=case when sqlerrm in('invalid_request','source_unavailable','unsupported_payback_scope','payback_evidence_required','expense_classification_required','qualifier_award_missing','equal_cohort_award_mismatch','insufficient_participant_return','non_conserving_ledger','stale_version','ledger_snapshot_changed','tournament_unavailable','source_already_finalized')then sqlerrm else null end;
  if code is null then raise;end if;response:=jsonb_build_object('status','rejected','eventId',p_event_id,'code',code);
 end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(rid,p_tournament_id,p_actor_id,'save_event_payback_review_v1',p_event_id,hash,p_operation_id,case when code is null then'accepted'else'rejected'end,response,stamp);
 if code is null then
  insert into app.event_payback_review_requirements(event_id,tournament_id,requirement_source)values(p_event_id,p_tournament_id,'explicit_review')on conflict(event_id)do nothing;
  insert into app.event_payback_reviews_v1(id,tournament_id,event_id,draft_id,draft_version,version,supersedes_id,request_payload,facts_snapshot,totals,recorded_by,operation_receipt_id,recorded_at)
  values(review_id,p_tournament_id,p_event_id,(p_request->>'draftId')::uuid,(p_request->>'draftVersion')::integer,version_no,prior,p_request,facts,totals,p_actor_id,rid,stamp);
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(p_tournament_id,p_actor_id,rid,'event_payback_review_v1',case when code is null then review_id else p_event_id end,case when code is null then'payback_review_saved_v1'else'payback_review_rejected'end,response);
 return response;
end $$;

create function public.get_event_payback_reconciliation_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$declare response jsonb;begin
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))then return null;end if;
 select response_payload into response from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id and tournament_id=p_tournament_id and target_id=p_event_id and operation_type='save_event_payback_review_v1';
 return jsonb_build_object('authorized',true,'result',response);end $$;

create function app.current_event_payback_review_v1(p_tid uuid,p_eid uuid,p_draft_id uuid,p_draft_version integer)
returns uuid language plpgsql stable security definer set search_path='' as $$declare review app.event_payback_reviews_v1%rowtype;facts jsonb;begin
 select *into review from app.event_payback_reviews_v1 where tournament_id=p_tid and event_id=p_eid order by version desc limit 1;
 if not found or review.draft_id<>p_draft_id or review.draft_version<>p_draft_version then return null;end if;
 facts:=app.event_payback_facts_v1(p_tid,p_eid);if facts->>'status'<>'supported'or review.facts_snapshot is distinct from facts then return null;end if;return review.id;end $$;

create function app.require_payback_review_write_v1()
returns trigger language plpgsql security definer set search_path='' as $$declare review_id uuid;draft_version integer;begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('settlement-domain:'||new.event_id::text,0));
 if tg_table_name in('standard_singles_settlement_drafts','standard_singles_settlement_final_versions')then
  if exists(select 1 from app.event_payback_review_requirements where tournament_id=new.tournament_id and event_id=new.event_id)then raise exception 'settlement_domain_conflict';end if;
 elsif tg_table_name='event_settlement_finals_v2'and exists(select 1 from app.event_payback_review_requirements where tournament_id=new.tournament_id and event_id=new.event_id)then
  select version into strict draft_version from app.event_settlement_drafts_v5 where id=new.draft_id and tournament_id=new.tournament_id and event_id=new.event_id;
  review_id:=app.current_event_payback_review_v1(new.tournament_id,new.event_id,new.draft_id,draft_version);
  if review_id is null then raise exception 'payback_evidence_required';end if;new.payback_review_id:=review_id;
 end if;return new;end $$;
create trigger aaa_required_payback_legacy_draft_guard before insert on app.standard_singles_settlement_drafts for each row execute function app.require_payback_review_write_v1();
create trigger aaa_required_payback_legacy_final_guard before insert on app.standard_singles_settlement_final_versions for each row execute function app.require_payback_review_write_v1();
create trigger aaa_required_payback_v5_final_guard before insert on app.event_settlement_finals_v2 for each row execute function app.require_payback_review_write_v1();

-- Add the structured finalization preflight before the existing V5 insert. The
-- insert trigger above independently pins and rechecks the review as defense in depth.
do $$declare definition text;patched text;needle text;begin
 definition:=pg_get_functiondef('app.write_event_settlement_v5(uuid,uuid,uuid,jsonb,uuid,text)'::regprocedure);patched:=definition;
 needle:='if ledger is distinct from draft.ledger_snapshot then raise exception ''ledger_snapshot_changed'';end if;';
 patched:=replace(patched,needle,needle||$patch$
   if exists(select 1 from app.event_payback_review_requirements where tournament_id=p_tournament_id and event_id=p_event_id)
    and app.current_event_payback_review_v1(p_tournament_id,p_event_id,draft.id,draft.version)is null then
    if exists(select 1 from app.event_payback_reviews_v1 where tournament_id=p_tournament_id and event_id=p_event_id)then raise exception 'ledger_snapshot_changed';else raise exception 'payback_evidence_required';end if;
   end if;
$patch$);
 patched:=replace(patched,'''sanctioning_assessment_evidence_unavailable'')then sqlerrm else null end;',
  '''sanctioning_assessment_evidence_unavailable'',''payback_evidence_required'')then sqlerrm else null end;');
 if patched=definition or position('and app.current_event_payback_review_v1('in patched)=0
  or position('''payback_evidence_required'')then sqlerrm'in patched)=0 then raise exception 'V5 payback preflight or rejection anchor unavailable';end if;execute patched;
end $$;

revoke all on function app.current_event_payback_review_v1(uuid,uuid,uuid,integer)from public,anon,authenticated,service_role;
revoke all on function app.require_payback_review_write_v1()from public,anon,authenticated,service_role;
revoke all on function public.get_event_payback_workspace_v1(uuid,uuid,uuid)from public,anon,authenticated;
revoke all on function public.save_event_payback_review_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
revoke all on function public.get_event_payback_reconciliation_v1(uuid,uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.get_event_payback_workspace_v1(uuid,uuid,uuid)to service_role;
grant execute on function public.save_event_payback_review_v1(uuid,uuid,uuid,jsonb,uuid)to service_role;
grant execute on function public.get_event_payback_reconciliation_v1(uuid,uuid,uuid,uuid)to service_role;
notify pgrst,'reload schema';
