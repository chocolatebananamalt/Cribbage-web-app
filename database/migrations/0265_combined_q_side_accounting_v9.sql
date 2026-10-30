-- LOCAL ONLY. Combined Q/Side unpaid canonical accounting, preserving v8 history.
-- No existing record is updated. No transfer, refund or automatic contribution.
begin;
create table app.prize_accounting_drafts_v9(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null references app.tournaments(id),event_id uuid not null,
 version integer not null check(version between 1 and 256),supersedes_id uuid references app.prize_accounting_drafts_v9(id),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),request_payload jsonb not null,rounding jsonb not null,awards jsonb not null,source_manifest jsonb not null,
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(event_id,version),unique(id,tournament_id,event_id));
create table app.prize_rounding_funding_events_v9(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null references app.tournaments(id),event_id uuid not null,draft_id uuid not null,
 version integer not null check(version between 1 and 256),event_type text not null check(event_type in('received','voided')),
 amount_minor bigint not null check(amount_minor between 1 and 100000000),received_at timestamptz,evidence_reference text not null,
 reason text not null,voids_id uuid,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 check((event_type='received'and received_at is not null and voids_id is null)or(event_type='voided'and received_at is null and voids_id is not null)),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),foreign key(draft_id,tournament_id,event_id)references app.prize_accounting_drafts_v9(id,tournament_id,event_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),unique(event_id,version),unique(id,tournament_id,event_id),
 foreign key(voids_id,tournament_id,event_id)references app.prize_rounding_funding_events_v9(id,tournament_id,event_id),unique(voids_id));
create table app.prize_accounting_finals_v9(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null references app.tournaments(id),event_id uuid not null,draft_id uuid not null,
 version integer not null default 1 check(version=1),source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 funding_version integer not null check(funding_version between 0 and 256),funding_snapshot jsonb not null,restricted_balance_minor bigint not null check(restricted_balance_minor between 0 and 499),
 status text not null default 'unpaid'check(status='unpaid'),reason text not null,
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),foreign key(draft_id,tournament_id,event_id)references app.prize_accounting_drafts_v9(id,tournament_id,event_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),unique(event_id));
do $$declare n text;begin foreach n in array array['prize_accounting_drafts_v9','prize_rounding_funding_events_v9','prize_accounting_finals_v9']loop
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 execute format('create index %I on app.%I(tournament_id)',n||'_tournament_idx',n);
 execute format('create index %I on app.%I(actor_id)',n||'_actor_idx',n);
 execute format('create index %I on app.%I(operation_receipt_id,tournament_id)',n||'_operation_idx',n);
end loop;end$$;
create index prize_accounting_draft_supersedes_v9_idx on app.prize_accounting_drafts_v9(supersedes_id);
create index prize_rounding_funding_draft_v9_idx on app.prize_rounding_funding_events_v9(draft_id,tournament_id,event_id);
create index prize_accounting_final_draft_v9_idx on app.prize_accounting_finals_v9(draft_id,tournament_id,event_id);

create or replace function app.q_pool_context_v1(p_tournament_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with a as (
 select a.event_id,a.setup_event_version_id,s.entry_fee_cents,s.event_kind,s.format_code,s.style_code,e.name,e.operational_state
 from app.tournament_setup_activations a join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id and s.tournament_id=a.tournament_id
 join app.events e on e.id=a.event_id and e.tournament_id=a.tournament_id
 where a.tournament_id=p_tournament_id order by a.created_at,a.id limit 1
 ) select jsonb_build_object('eventId',a.event_id,'setupEventVersionId',a.setup_event_version_id,'eventName',a.name,'baseFeeMinor',a.entry_fee_cents,
 'supported',a.event_kind='main' and a.format_code='standard_singles' and a.style_code='Standard' and a.operational_state='active'
  and (select count(*) from app.events where tournament_id=p_tournament_id)=1
  and (select count(*) from app.tournament_setup_activations where tournament_id=p_tournament_id)=1
  and (select count(*) from app.tournament_setup_q_pool_versions p where p.setup_event_version_id=a.setup_event_version_id) between 1 and 2
  and not exists(select 1 from app.tournament_setup_q_pool_versions p where p.setup_event_version_id=a.setup_event_version_id and p.entry_fee_cents<=0),
 'started',exists(select 1 from app.event_play_starts where event_id=a.event_id),
 'pools',coalesce((select jsonb_agg(jsonb_build_object('poolVersionId',p.id,'slot',p.slot,'name','Q Pool '||p.slot||' - '||p.pool_type_code,'feeMinor',p.entry_fee_cents) order by p.slot)
 from app.tournament_setup_q_pool_versions p where p.setup_event_version_id=a.setup_event_version_id),'[]'::jsonb)) from a
$$;
revoke all on function app.q_pool_context_v1(uuid) from public,anon,authenticated,service_role;

create function app.q_base_financial_basis_v9(p_tid uuid,p_eid uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid;m jsonb;e jsonb;p jsonb;ledger jsonb;expenses jsonb;gross numeric:=0;qfund numeric:=0;received numeric:=0;full_total numeric;count_entries integer;active_count integer;
begin
 select profile_id into actor from app.tournament_roles where tournament_id=p_tid and role='director' order by profile_id limit 1;
 if actor is null or (select count(*)from app.tournament_setup_activations where tournament_id=p_tid)<>1
  or (select count(*)from app.events where tournament_id=p_tid and operational_state='active')<>1
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
revoke all on function app.q_base_financial_basis_v9(uuid,uuid)from public,anon,authenticated,service_role;


create function app.combined_side_basis_v9(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare sp record;s jsonb;r app.side_pool_recipient_reviews_v3%rowtype;total numeric:=0;manifest jsonb:='[]';reviews jsonb:='[]';blocks jsonb:='[]';n integer:=0;begin
 for sp in select *from app.event_side_pools where tournament_id=tid order by event_id,id loop
  n:=n+1;if sp.event_id<>eid then blocks:=blocks||jsonb_build_array('unsupported_side_scope');continue;end if;
  s:=app.side_pool_recipient_source_v3(tid,eid,sp.id);
  if s is null or jsonb_array_length(s->'blockers')<>0 then blocks:=blocks||jsonb_build_array('side_source_blocked');end if;
  select*into r from app.side_pool_recipient_reviews_v3 where pool_id=sp.id and tournament_id=tid and event_id=eid order by version desc limit 1;
  if r.id is null or r.source_digest is distinct from s->>'sourceDigest'or r.obligations is distinct from s->'obligations'then blocks:=blocks||jsonb_build_array('side_review_required');end if;
  manifest:=manifest||jsonb_build_array(jsonb_build_object('source',s,'review',to_jsonb(r)));
  if s->>'fundMinor'is not null then total:=total+(s->>'fundMinor')::numeric;end if;
  reviews:=reviews||jsonb_build_array(jsonb_build_object('poolId',sp.id,'reviewId',r.id,'sourceDigest',r.source_digest,'obligations',r.obligations));
 end loop;
 if n<1 or n>6 or total>9007199254740991 then blocks:=blocks||jsonb_build_array('unsupported_side_scope');end if;
 return jsonb_build_object('sideIncomeMinor',total::bigint,'reviews',reviews,'manifest',manifest,'blockers',blocks);
end$$;
revoke all on function app.combined_side_basis_v9(uuid,uuid,uuid)from public,anon,authenticated,service_role;

-- Clone the strict no-Q base ledger only for reviewed Side accounting.
-- Q absence, exact base receipts, participant mapping and expense proofs remain.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.event_prize_schedule_financial_basis_pre_q_v6(uuid,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION app.event_prize_schedule_financial_basis_pre_q_v6(','FUNCTION app.side_only_base_financial_basis_v9(');
 if p=d or position('or exists(select 1 from app.tournament_setup_side_pool_versions where tournament_id = p_tournament_id)'in p)=0 then raise exception'Side-only base helper clone anchor changed';end if;
 p:=replace(p,'or exists(select 1 from app.tournament_setup_side_pool_versions where tournament_id = p_tournament_id)','');execute p;
end$$;
revoke all on function app.side_only_base_financial_basis_v9(uuid,uuid)from public,anon,authenticated,service_role;

create function app.prize_accounting_source_v9(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare side_basis jsonb;basis jsonb;qs jsonb;qr app.q_obligation_reviews_v2%rowtype;v3 app.playoff_outcome_versions_v3%rowtype;v4 app.playoff_outcome_versions_v4%rowtype;
 bind app.event_prize_schedule_bindings_v1%rowtype;rule app.setup_prize_schedule_versions_v1%rowtype;source jsonb;mrp jsonb;facts jsonb;manifest jsonb;blocks jsonb:='[]';hasq boolean;
 expenses jsonb;total numeric;qtotal numeric:=0;assessment bigint;regular jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director')or not exists(select 1 from app.events where id=eid and tournament_id=tid)then return null;end if;
 hasq:=exists(select 1 from app.tournament_setup_q_pool_versions where tournament_id=tid);
 if(select count(*)from app.events where tournament_id=tid and operational_state='active')<>1 then blocks:=blocks||jsonb_build_array('unsupported_scope');end if;
 side_basis:=app.combined_side_basis_v9(actor,tid,eid);blocks:=blocks||(side_basis->'blockers');
 if exists(select 1 from app.prize_accounting_drafts_v8 where tournament_id=tid)or exists(select 1 from app.prize_accounting_finals_v8 where tournament_id=tid)then blocks:=blocks||jsonb_build_array('legacy_settlement_preserved');end if;
 if hasq then
  basis:=app.q_base_financial_basis_v9(tid,eid);qs:=app.q_obligation_sources_v2(actor,tid);
  if qs is null or qs->>'eventId'is distinct from eid::text or jsonb_array_length(coalesce(qs->'blockers','["source_blocked"]'))<>0 then blocks:=blocks||jsonb_build_array('source_blocked');end if;
  select*into qr from app.q_obligation_reviews_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
  if qr.id is null or qr.source_digest is distinct from qs->>'sourceDigest'or qr.obligations is distinct from qs->'obligations'then blocks:=blocks||jsonb_build_array('q_review_required');end if;
  select coalesce(sum((p->>'fundMinor')::numeric),0)into qtotal from jsonb_array_elements(coalesce(qr.obligations,'[]'))p;
  if exists(select 1 from jsonb_array_elements(coalesce(qr.obligations,'[]'))p cross join lateral jsonb_array_elements(p->'rows')r where p->>'kind'='award'and mod((r->>'amountMinor')::numeric,500)<>0)then blocks:=blocks||jsonb_build_array('whole_five_awards_required');end if;
 else basis:=app.side_only_base_financial_basis_v9(tid,eid);end if;
 if basis->>'status'is distinct from'supported'then blocks:=blocks||jsonb_build_array('funding_unreconciled');end if;
 select*into v3 from app.playoff_outcome_versions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 select*into v4 from app.playoff_outcome_versions_v4 where tournament_id=tid and event_id=eid order by version desc limit 1;
 source:=case when v3.id is not null and v4.id is null then jsonb_build_object('kind','playoff_outcome_v3','resultId',v3.id,'qualificationResultVersionId',v3.qualification_result_version_id)when v4.id is not null and v3.id is null then jsonb_build_object('kind','playoff_outcome_v4','resultId',v4.id,'qualificationResultVersionId',v4.qualification_result_version_id)else null end;
 if source is null or app.settlement_source_current_v5(tid,eid,source)is distinct from true then blocks:=blocks||jsonb_build_array('source_blocked');else mrp:=app.canonical_settlement_mrp_v5(tid,eid,source);end if;
 select*into bind from app.event_prize_schedule_bindings_v1 where tournament_id=tid and event_id=eid order by binding_version desc limit 1;
 select*into rule from app.setup_prize_schedule_versions_v1 where id=bind.schedule_version_id and tournament_id=tid;
 if rule.id is null then blocks:=blocks||jsonb_build_array('schedule_required');
 elsif app.valid_regular_prize_schedule_v3(rule.schedule_payload)is distinct from true then blocks:=blocks||jsonb_build_array('rounding_policy_required');
 elsif rule.settings_fingerprint is distinct from app.prize_schedule_settings_fingerprint_v1(app.prize_schedule_settings_v1(tid,bind.client_row_id))then blocks:=blocks||jsonb_build_array('schedule_revision_required');
 else regular:=jsonb_build_object('scheduleVersionId',rule.id,'scheduleVersion',rule.version,'rule',rule.schedule_payload);end if;
 if mrp is null or mrp->>'status'is distinct from'available'or jsonb_array_length(mrp->'rows')not in(4,5)or regular is not null and jsonb_array_length(mrp->'rows')<>(rule.schedule_payload->>'expectedQualifierCount')::integer then blocks:=blocks||jsonb_build_array('unsupported_scope');end if;
 if exists(select 1 from app.standard_singles_settlement_drafts where tournament_id=tid)or exists(select 1 from app.event_settlement_drafts_v5 where tournament_id=tid)or exists(select 1 from app.standard_singles_settlement_final_versions where tournament_id=tid)or exists(select 1 from app.event_settlement_finals_v2 where tournament_id=tid)or exists(select 1 from app.q_accounting_drafts_v6 where tournament_id=tid)or exists(select 1 from app.q_accounting_finals_v6 where tournament_id=tid)or exists(select 1 from app.no_q_accounting_drafts_v7 where tournament_id=tid)or exists(select 1 from app.no_q_accounting_finals_v7 where tournament_id=tid)then blocks:=blocks||jsonb_build_array('legacy_settlement_preserved');end if;
 select coalesce(jsonb_agg(jsonb_build_object('expenseEventId',e->'expenseEventId','description',e->'description','amountMinor',e->'amountMinor','currencyCode','USD')order by e->>'expenseEventId'),'[]'),coalesce(sum((e->>'amountMinor')::numeric),0)into expenses,total from jsonb_array_elements(coalesce(basis->'expenses','[]'))e;
 assessment:=app.settlement_assessment_v5(eid);if assessment is null then blocks:=blocks||jsonb_build_array('sanctioning_assessment_unfunded');end if;
 if basis->>'status'='supported'and mrp->>'status'='available'then
  if total>(basis->>'grossEntryIncomeMinor')::numeric or total>9007199254740991 or(hasq and(qtotal is distinct from(basis->>'qIncomeMinor')::numeric or(basis->>'receiptTotalMinor')::numeric<>(basis->>'grossEntryIncomeMinor')::numeric+qtotal))then blocks:=blocks||jsonb_build_array('non_conserving_ledger');
  else facts:=jsonb_build_object('baseIncomeMinor',(basis->>'grossEntryIncomeMinor')::bigint,'qIncomeMinor',qtotal::bigint,'receiptTotalMinor',(basis->'ledgerSnapshot'->>'paymentTotalMinor')::bigint+(side_basis->>'sideIncomeMinor')::bigint,'sideIncomeMinor',(side_basis->>'sideIncomeMinor')::bigint,'expenseTotalMinor',total::bigint,'regularAwardMinor',(basis->>'grossEntryIncomeMinor')::bigint-total::bigint,'minimumReturnMinor',app.minimum_payback_return_minor_v1((basis->>'grossEntryIncomeMinor')::numeric),'expenseEvidence',expenses,'ledgerSnapshot',basis->'ledgerSnapshot','canonicalMrp',mrp);end if;
 end if;
 manifest:=jsonb_build_object('policy','regular-prize-cohort-5usd-v3','basis',basis,'qSource',qs,'qReview',to_jsonb(qr),'sideSources',side_basis,'playoffSource',source,'playoffEvidence',case when v3.id is not null then to_jsonb(v3)else to_jsonb(v4)end,'mrp',mrp,'regularRule',to_jsonb(rule),'assessment',assessment,'blocks',blocks);
 return jsonb_build_object('sourceDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'),'manifest',manifest,'blockers',blocks,'facts',facts,'regularRule',regular,'sideReviews',side_basis->'reviews','source',source,'qReview',case when qr.id is null then null else jsonb_build_object('id',qr.id,'version',qr.version,'sourceDigest',qr.source_digest,'obligations',qr.obligations)end);
end$$;

create function app.classify_prize_expenses_v9(tid uuid,eid uuid,facts jsonb,classes jsonb)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare b numeric:=0;o numeric:=0;c jsonb;e jsonb;a bigint;sanctions integer:=0;begin
 if jsonb_typeof(classes)is distinct from'array'or jsonb_array_length(classes)<>jsonb_array_length(facts->'expenseEvidence')or(select count(distinct value->>'expenseEventId')from jsonb_array_elements(classes))<>jsonb_array_length(classes)then raise exception'invalid_expense_classification';end if;
 a:=app.settlement_assessment_v5(eid);if a is null then raise exception'sanctioning_assessment_unfunded';end if;
 for c in select value from jsonb_array_elements(classes)loop
  if jsonb_typeof(c)is distinct from'object'or(select count(*)from jsonb_object_keys(c))<>3 or not(c?&array['expenseEventId','category','evidenceReference'])or jsonb_typeof(c->'category')is distinct from'string'or jsonb_typeof(c->'evidenceReference')is distinct from'string'or length(trim(c->>'evidenceReference'))not between 1 and 500 or c->>'evidenceReference'<>trim(c->>'evidenceReference')or c->>'evidenceReference'~'[[:cntrl:]]'then raise exception'invalid_expense_classification';end if;
  select value into e from jsonb_array_elements(facts->'expenseEvidence')where value->>'expenseEventId'=c->>'expenseEventId';if e is null then raise exception'invalid_expense_classification';end if;
  if c->>'category'in('sanctioning','meals','coffee','donuts','pastries','snacks','charity','trophies')then b:=b+(e->>'amountMinor')::numeric;
  elsif c->>'category'in('cards','printing','advertising','postage','telephone','supplies','hall_rental')then o:=o+(e->>'amountMinor')::numeric;else raise exception'invalid_expense_classification';end if;
  if c->>'category'='sanctioning'then sanctions:=sanctions+1;if(e->>'amountMinor')::numeric<>a then raise exception'sanctioning_assessment_unfunded';end if;end if;
 end loop;
 if(a>0 and sanctions<>1)or(a=0 and sanctions>1)then raise exception'sanctioning_assessment_unfunded';end if;
 if b+o is distinct from(facts->>'expenseTotalMinor')::numeric then raise exception'non_conserving_ledger';end if;
 return jsonb_build_object('benefitExpenseMinor',b::bigint,'operatingExpenseMinor',o::bigint,'expenseClassifications',classes);
end$$;
create function app.prize_rounding_funding_v9(tid uuid,eid uuid,required bigint)returns jsonb language sql stable security definer set search_path=''as $$
 with rows as(select*from app.prize_rounding_funding_events_v9 where tournament_id=tid and event_id=eid),totals as(select coalesce(max(version),0)version,coalesce(sum(case when event_type='received'then amount_minor else -amount_minor end),0)::bigint received from rows)
 select jsonb_build_object('version',version,'requiredMinor',coalesce(required,0),'receivedMinor',received,'shortfallMinor',greatest(coalesce(required,0)-received,0),'unallocatedMinor',greatest(received-coalesce(required,0),0),'records',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'eventType',event_type,'amountMinor',amount_minor,'receivedAt',received_at,'evidenceReference',evidence_reference,'reason',reason,'voidsId',voids_id,'sourceDigest',source_digest,'recordedAt',recorded_at)order by version),'[]')from rows))from totals;
$$;
create function public.get_prize_accounting_workspace_v9(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare s jsonb;d app.prize_accounting_drafts_v9%rowtype;f app.prize_accounting_finals_v9%rowtype;fund jsonb;cur boolean;begin
 s:=app.prize_accounting_source_v9(p_actor_id,p_tournament_id,p_event_id);if s is null then return null;end if;
 select*into d from app.prize_accounting_drafts_v9 where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;
 select*into f from app.prize_accounting_finals_v9 where tournament_id=p_tournament_id and event_id=p_event_id;
 cur:=d.id is not null and d.source_digest=s->>'sourceDigest'and jsonb_array_length(s->'blockers')=0;
 fund:=app.prize_rounding_funding_v9(p_tournament_id,p_event_id,coalesce((d.rounding->>'requiredFundingMinor')::bigint,0));
 return jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,'sourceDigest',s->'sourceDigest','blockers',s->'blockers','currentDraftVersion',coalesce(d.version,0),'currentFinalVersion',coalesce(f.version,0),'regularRule',s->'regularRule','facts',s->'facts','qReview',s->'qReview','sideReviews',s->'sideReviews',
 'draft',case when d.id is null then null else jsonb_build_object('id',d.id,'version',d.version,'sourceDigest',d.source_digest,'current',cur,'request',d.request_payload,'rounding',d.rounding,'awards',d.awards)end,
 'funding',fund,'finalization',case when f.id is null then null else jsonb_build_object('id',f.id,'version',1,'draftId',f.draft_id,'draftVersion',d.version,'sourceDigest',f.source_digest,'current',cur and f.draft_id=d.id and f.funding_version=(fund->>'version')::integer,'status','unpaid','fundingVersion',f.funding_version,'restrictedBalanceMinor',f.restricted_balance_minor,'fundingReceivedMinor',f.funding_snapshot->'receivedMinor')end,'automaticPayment',false);
end$$;

create function app.write_prize_accounting_v9(actor uuid,tid uuid,eid uuid,req jsonb,op uuid,action text)returns jsonb language plpgsql security definer set search_path=''as $$
declare receipt app.operation_receipts%rowtype;d app.prize_accounting_drafts_v9%rowtype;prior_fund app.prize_rounding_funding_events_v9%rowtype;s jsonb;classes jsonb;calc jsonb;awards jsonb;fund jsonb;response jsonb;h text;code text;status_value text;ver integer;prior uuid;amount bigint;at_time timestamptz;ref text;rid uuid:=extensions.gen_random_uuid();oid uuid:=extensions.gen_random_uuid();begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null or tid is null or eid is null or op is null or action not in('draft','funding','void_funding','final')then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0));perform pg_advisory_xact_lock(hashtextextended('qualification-finalization:'||eid::text,0));perform pg_advisory_xact_lock(hashtextextended('standard-singles-post-event:'||eid::text,0));perform pg_advisory_xact_lock(hashtextextended('settlement:'||eid::text,0));perform pg_advisory_xact_lock(hashtextextended('settlement-domain:'||eid::text,0));
 select status into status_value from app.tournaments where id=tid for update;if not found then return jsonb_build_object('status','rejected','eventId',eid,'code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for update;if not found then return jsonb_build_object('status','rejected','eventId',eid,'code','not_director');end if;
 perform 1 from app.events where id=eid and tournament_id=tid for update;if not found then return jsonb_build_object('status','rejected','eventId',eid,'code','source_blocked');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('prize_accounting_v9',action,actor,tid,eid,req)::text,'utf8'),'sha256'),'hex');
 select*into receipt from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then if receipt.tournament_id=tid and receipt.target_id=eid and receipt.operation_type='prize_accounting_v9_'||action and receipt.request_hash=h then return receipt.response_payload;end if;return jsonb_build_object('status','rejected','eventId',eid,'code','idempotency_conflict');end if;
 begin
  if status_value not in('open','pending_finalization')then raise exception'tournament_unavailable';end if;
  if exists(select 1 from app.prize_accounting_finals_v9 where event_id=eid)then raise exception'already_finalized';end if;
  if jsonb_typeof(req)is distinct from'object'or jsonb_typeof(req->'reason')is distinct from'string'or length(trim(req->>'reason'))not between 1 and 500 or req->>'reason'<>trim(req->>'reason')or req->>'reason'~'[[:cntrl:]]'or req->'reviewed'is distinct from'true'::jsonb or jsonb_typeof(req->'expectedVersion')is distinct from'number'or req->>'expectedVersion'!~'^(0|[1-9][0-9]*)$'or(req->>'expectedVersion')::numeric>255 then raise exception'invalid_request';end if;
  s:=app.prize_accounting_source_v9(actor,tid,eid);if s is null or jsonb_array_length(s->'blockers')<>0 or s->'facts'='null'::jsonb then raise exception'source_blocked';end if;
  select*into d from app.prize_accounting_drafts_v9 where tournament_id=tid and event_id=eid order by version desc limit 1;
  if action='draft'then
   if(select count(*)from jsonb_object_keys(req))<>5 or not(req?&array['expectedVersion','sourceDigest','expenseClassifications','reason','reviewed'])then raise exception'invalid_request';end if;
   if req->>'sourceDigest'is distinct from s->>'sourceDigest'then raise exception'source_changed';end if;
   if coalesce(d.version,0)<>(req->>'expectedVersion')::integer then raise exception'stale_version';end if;
   if d.id is not null and d.source_digest=s->>'sourceDigest'and d.request_payload-'expectedVersion'is not distinct from req-'expectedVersion'then raise exception'already_drafted';end if;
   classes:=app.classify_prize_expenses_v9(tid,eid,s->'facts',req->'expenseClassifications');
   calc:=app.calculate_regular_prize_rounding_v3(jsonb_build_object('grossBaseIncomeMinor',s->'facts'->'baseIncomeMinor','expenseTotalMinor',s->'facts'->'expenseTotalMinor','benefitExpenseMinor',classes->'benefitExpenseMinor','expectedQualifierCount',s->'regularRule'->'rule'->'expectedQualifierCount','cohorts',s->'regularRule'->'rule'->'cohorts'));
   if calc->>'status'is distinct from'calculated'then if calc->>'code'='unsupported_computational_domain'then raise exception'unsupported_computational_domain';else raise exception'whole_five_awards_required';end if;end if;
   select jsonb_agg(jsonb_build_object('participantId',r->'participantId','displayName',r->'displayName','bandStart',r->'bandStart','bandEnd',r->'bandEnd','weight',c->'weight','totalAwardMinor',c->'awardMinor')order by(r->>'bandStart')::integer,r->>'participantId')into awards from jsonb_array_elements(s->'facts'->'canonicalMrp'->'rows')r join jsonb_array_elements(calc->'cohorts')c on r->'bandStart'=c->'bandStart'and r->'bandEnd'=c->'bandEnd';
   if jsonb_array_length(awards)<>(calc->>'expectedQualifierCount')::integer or(select sum((a->>'totalAwardMinor')::bigint)from jsonb_array_elements(awards)a)<>(calc->>'roundedBudgetMinor')::bigint then raise exception'whole_five_awards_required';end if;
   prior:=d.id;ver:=coalesce(d.version,0)+1;response:=jsonb_build_object('status','prize_accounting_draft_saved_v9','draftId',rid,'eventId',eid,'version',ver,'sourceDigest',s->'sourceDigest');
  else
   if d.id is null or d.id::text is distinct from req->>'draftId'then raise exception'stale_version';end if;
   if d.source_digest is distinct from s->>'sourceDigest'then raise exception'source_changed';end if;
   fund:=app.prize_rounding_funding_v9(tid,eid,(d.rounding->>'requiredFundingMinor')::bigint);
   if action in('funding','void_funding')then
    if req->>'sourceDigest'is distinct from s->>'sourceDigest'then raise exception'source_changed';end if;
    if(fund->>'version')::integer<>(req->>'expectedVersion')::integer then raise exception'stale_version';end if;
    ver:=(fund->>'version')::integer+1;
    if action='funding'then
     if(select count(*)from jsonb_object_keys(req))<>8 or not(req?&array['expectedVersion','sourceDigest','draftId','amountMinor','receivedAt','evidenceReference','reason','reviewed'])or jsonb_typeof(req->'amountMinor')is distinct from'number'or req->>'amountMinor'!~'^[1-9][0-9]*$'or(req->>'amountMinor')::numeric>100000000 or jsonb_typeof(req->'receivedAt')is distinct from'string'or jsonb_typeof(req->'evidenceReference')is distinct from'string'or length(trim(req->>'evidenceReference'))not between 1 and 500 or req->>'evidenceReference'<>trim(req->>'evidenceReference')or req->>'evidenceReference'~'[[:cntrl:]]'then raise exception'invalid_request';end if;
     amount:=(req->>'amountMinor')::bigint;if amount>(fund->>'shortfallMinor')::bigint then raise exception'amount_exceeds_shortfall';end if;
     at_time:=(req->>'receivedAt')::timestamptz;if not isfinite(at_time)or at_time>clock_timestamp()+interval'5 minutes'then raise exception'invalid_request';end if;ref:=req->>'evidenceReference';
    else
     if(select count(*)from jsonb_object_keys(req))<>6 or not(req?&array['expectedVersion','sourceDigest','draftId','voidsId','reason','reviewed'])then raise exception'invalid_request';end if;
     select*into prior_fund from app.prize_rounding_funding_events_v9 where id=(req->>'voidsId')::uuid and tournament_id=tid and event_id=eid and event_type='received';if not found then raise exception'funding_not_found';end if;
     if exists(select 1 from app.prize_rounding_funding_events_v9 where voids_id=prior_fund.id)then raise exception'funding_already_voided';end if;
     amount:=prior_fund.amount_minor;ref:=prior_fund.evidence_reference;
    end if;
    response:=jsonb_build_object('status','prize_rounding_funding_recorded_v9','fundingId',rid,'eventId',eid,'version',ver,'sourceDigest',s->'sourceDigest','draftId',d.id,'eventType',case when action='funding'then'received'else'voided'end,'amountMinor',amount);
   else
    if(select count(*)from jsonb_object_keys(req))<>6 or not(req?&array['expectedVersion','draftId','draftVersion','expectedFundingVersion','reason','reviewed'])or req->>'expectedVersion'<>'0'or req->>'draftVersion'is distinct from d.version::text or req->>'expectedFundingVersion'is distinct from fund->>'version'then raise exception'stale_version';end if;
    if(fund->>'shortfallMinor')::bigint<>0 then raise exception'funding_shortfall';end if;if(fund->>'unallocatedMinor')::bigint<>0 then raise exception'funding_overage';end if;
    if not exists(select 1 from app.cross_check_finalizations where tournament_id=tid)or app.cross_check_finalization_conditions_v1(tid)is null or exists(select 1 from jsonb_array_elements(app.cross_check_finalization_conditions_v1(tid))c where(c->>'outstanding')::boolean)then raise exception'crosscheck_incomplete';end if;
    if(s->'facts'->>'receiptTotalMinor')::bigint+(fund->>'receivedMinor')::bigint<>(s->'facts'->>'expenseTotalMinor')::bigint+(d.rounding->>'roundedBudgetMinor')::bigint+(s->'facts'->>'qIncomeMinor')::bigint+(s->'facts'->>'sideIncomeMinor')::bigint+(d.rounding->>'restrictedBalanceMinor')::bigint then raise exception'non_conserving_ledger';end if;
    ver:=1;response:=jsonb_build_object('status','prize_accounting_finalized_unpaid_v9','finalizationId',rid,'draftId',d.id,'eventId',eid,'version',1,'sourceDigest',s->'sourceDigest');
   end if;
  end if;
 exception when raise_exception or invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
  code:=case when sqlerrm in('tournament_unavailable','source_blocked','source_changed','stale_version','already_finalized','already_drafted','invalid_expense_classification','sanctioning_assessment_unfunded','whole_five_awards_required','unsupported_computational_domain','funding_shortfall','funding_overage','funding_already_voided','funding_not_found','amount_exceeds_shortfall','crosscheck_incomplete','non_conserving_ledger')then sqlerrm else'invalid_request'end;
  response:=jsonb_build_object('status','rejected','eventId',eid,'code',code);
 end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(oid,tid,actor,'prize_accounting_v9_'||action,eid,h,op,case when code is null then'accepted'else'rejected'end,response,clock_timestamp());
 if code is null then
  if action='draft'then insert into app.prize_accounting_drafts_v9(id,tournament_id,event_id,version,supersedes_id,source_digest,request_payload,rounding,awards,source_manifest,actor_id,operation_receipt_id)values(rid,tid,eid,ver,prior,s->>'sourceDigest',req,calc,awards,s->'manifest',actor,oid);
  elsif action in('funding','void_funding')then insert into app.prize_rounding_funding_events_v9(id,tournament_id,event_id,draft_id,version,event_type,amount_minor,received_at,evidence_reference,reason,voids_id,source_digest,actor_id,operation_receipt_id)values(rid,tid,eid,d.id,ver,case when action='funding'then'received'else'voided'end,amount,at_time,ref,req->>'reason',case when action='void_funding'then prior_fund.id else null end,s->>'sourceDigest',actor,oid);
  else insert into app.prize_accounting_finals_v9(id,tournament_id,event_id,draft_id,source_digest,funding_version,funding_snapshot,restricted_balance_minor,reason,actor_id,operation_receipt_id)values(rid,tid,eid,d.id,s->>'sourceDigest',(fund->>'version')::integer,fund,(d.rounding->>'restrictedBalanceMinor')::bigint,req->>'reason',actor,oid);end if;
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,oid,'prize_accounting_v9',case when code is null then rid else eid end,'prize_accounting_v9_'||action||case when code is null then'_unpaid'else'_rejected'end,response);
 return response;
end$$;
create function public.save_prize_accounting_draft_v9(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_prize_accounting_v9(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id,'draft');$$;
create function public.record_prize_rounding_funding_v9(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_prize_accounting_v9(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id,'funding');$$;
create function public.void_prize_rounding_funding_v9(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_prize_accounting_v9(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id,'void_funding');$$;
create function public.finalize_prize_accounting_v9(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_prize_accounting_v9(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id,'final');$$;
create function public.reconcile_prize_accounting_v9(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_action text,p_request jsonb)returns jsonb language plpgsql stable security definer set search_path=''as $$declare h text;r app.operation_receipts%rowtype;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or p_action not in('draft','funding','void_funding','final')or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director')or not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id)then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('prize_accounting_v9',p_action,p_actor_id,p_tournament_id,p_event_id,p_request)::text,'utf8'),'sha256'),'hex');
 select*into r from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if not found then return jsonb_build_object('authorized',true,'result',null);end if;
 return jsonb_build_object('authorized',true,'result',case when r.tournament_id=p_tournament_id and r.target_id=p_event_id and r.operation_type='prize_accounting_v9_'||p_action and r.request_hash=h then r.response_payload else jsonb_build_object('status','rejected','eventId',p_event_id,'code','idempotency_conflict')end);end$$;

-- Prevent duplicate monetary streams and protect new-policy events from penny writers.
-- Existing V8 RPCs reject a newly disclosed Side workflow before writes,
-- rather than allowing a domain trigger exception to escape the API. Historical
-- receipt replay still runs before source validation in the unchanged writer.
do $$declare d text;a text;r text;begin
 d:=pg_get_functiondef('app.prize_accounting_source_v8(uuid,uuid,uuid)'::regprocedure);
 a:='hasq:=exists(select 1 from app.tournament_setup_q_pool_versions where tournament_id=tid);';
 r:=a||' if not exists(select 1 from app.prize_accounting_finals_v8 where tournament_id=tid and event_id=eid)and(exists(select 1 from app.prize_accounting_drafts_v9 where tournament_id=tid and event_id=eid)or(exists(select 1 from app.side_pool_recipient_policies_v3 where tournament_id=tid and event_id=eid)and exists(select 1 from app.event_prize_schedule_bindings_v1 b join app.setup_prize_schedule_versions_v1 s on s.id=b.schedule_version_id where b.tournament_id=tid and b.event_id=eid and s.schedule_payload->>''kind''=''regular-prize-cohort-5usd-v3'')))then blocks:=blocks||jsonb_build_array(''source_blocked'');end if;';
 if position(a in d)=0 then raise exception'V8 Side routing anchor changed';end if;execute replace(d,a,r);
end$$;

create function app.prize_accounting_domain_v9()returns trigger language plpgsql security definer set search_path=''as $$declare newstream boolean;begin
 perform pg_advisory_xact_lock(hashtextextended('settlement-domain:'||new.event_id::text,0));newstream:=tg_table_name in('prize_accounting_drafts_v9','prize_accounting_finals_v9');
 if newstream then
  if exists(select 1 from app.prize_accounting_drafts_v8 where tournament_id=new.tournament_id)or exists(select 1 from app.prize_accounting_finals_v8 where tournament_id=new.tournament_id)or exists(select 1 from app.q_accounting_drafts_v6 where tournament_id=new.tournament_id)or exists(select 1 from app.no_q_accounting_drafts_v7 where tournament_id=new.tournament_id)or exists(select 1 from app.standard_singles_settlement_drafts where tournament_id=new.tournament_id)or exists(select 1 from app.event_settlement_drafts_v5 where tournament_id=new.tournament_id)then raise exception'settlement_domain_conflict';end if;
 elsif exists(select 1 from app.prize_accounting_drafts_v9 where tournament_id=new.tournament_id)or(exists(select 1 from app.side_pool_recipient_policies_v3 where tournament_id=new.tournament_id and event_id=new.event_id)and exists(select 1 from app.event_prize_schedule_bindings_v1 b join app.setup_prize_schedule_versions_v1 s on s.id=b.schedule_version_id where b.tournament_id=new.tournament_id and b.event_id=new.event_id and s.schedule_payload->>'kind'='regular-prize-cohort-5usd-v3'))then raise exception'settlement_domain_conflict';end if;return new;end$$;
do $$declare n text;begin foreach n in array array['prize_accounting_drafts_v9','prize_accounting_finals_v9','prize_accounting_drafts_v8','prize_accounting_finals_v8','q_accounting_drafts_v6','q_accounting_finals_v6','no_q_accounting_drafts_v7','no_q_accounting_finals_v7','standard_singles_settlement_drafts','event_settlement_drafts_v5','standard_singles_settlement_final_versions','event_settlement_finals_v2']loop execute format('create trigger %I before insert on app.%I for each row execute function app.prize_accounting_domain_v9()',n||'_prize_domain_v9',n);end loop;end$$;
create function app.prize_final_source_guard_v9()returns trigger language plpgsql security definer set search_path=''as $$begin
 perform 1 from app.tournaments where id=new.tournament_id for update;
 if exists(select 1 from app.prize_accounting_finals_v9 where tournament_id=new.tournament_id)then raise exception'settlement_domain_conflict';end if;return new;end$$;
do $$declare n text;begin foreach n in array array['roster_payment_events','roster_payment_obligation_versions','tournament_expense_events','q_pool_membership_versions_v1','q_pool_allocation_versions_v1','q_operating_policies_v2','q_obligation_reviews_v2','playoff_outcome_versions_v3','playoff_outcome_versions_v4','event_side_pools','event_side_pool_definition_versions','event_side_pool_election_versions','side_pool_graduated_policies_v2','side_pool_amount_reviews_v2','side_pool_recipient_policies_v3','side_pool_recipient_reviews_v3','qualification_result_versions','qualification_result_rows','qualification_tie_resolutions_v1','q_cut_attestations_v2','independent_card_corrections']loop execute format('create trigger %I before insert on app.%I for each row execute function app.prize_final_source_guard_v9()',n||'_prize_final_v9',n);end loop;end$$;
-- Reuse the existing member audience and expose only reviewed award amounts.
-- Funding, classification, evidence references and source manifests stay private.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('public.list_prize_award_summaries_v1(uuid,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION public.list_prize_award_summaries_v1(','FUNCTION app.list_prize_award_summaries_pre_prize_v9(');
 if p=d then raise exception 'V8 summary clone anchor changed';end if;execute p;
end$$;
revoke all on function app.list_prize_award_summaries_pre_prize_v9(uuid,uuid)from public,anon,authenticated,service_role;
create or replace function public.list_prize_award_summaries_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare result jsonb;director uuid;d app.prize_accounting_drafts_v9%rowtype;s jsonb;summary jsonb;begin
 result:=app.list_prize_award_summaries_pre_prize_v9(p_actor_id,p_tournament_id);if result is null then return null;end if;
 select profile_id into director from app.tournament_roles where tournament_id=p_tournament_id and role='director'order by profile_id limit 1;
 if director is null then return result;end if;
 for d in select distinct on(event_id)*from app.prize_accounting_drafts_v9 where tournament_id=p_tournament_id order by event_id,version desc loop
  s:=app.prize_accounting_source_v9(director,p_tournament_id,d.event_id);
  if s is null or s->>'sourceDigest'is distinct from d.source_digest or jsonb_array_length(s->'blockers')<>0 then continue;end if;
  select jsonb_build_object('eventId',d.event_id,'scheduleVersion',(s->'regularRule'->>'scheduleVersion')::integer,'status','unpaid',
   'finalized',exists(select 1 from app.prize_accounting_finals_v9 f where f.draft_id=d.id),'awards',
   (select jsonb_agg(jsonb_build_object('displayName',a->'displayName','bandStart',a->'bandStart','bandEnd',a->'bandEnd','amountMinor',a->'totalAwardMinor')order by(a->>'bandStart')::integer,a->>'displayName')from jsonb_array_elements(d.awards)a))into summary;
  result:=result||jsonb_build_array(summary);
 end loop;return result;end$$;
-- All private helpers retain no direct human or service execution.
revoke all on function app.valid_regular_prize_schedule_v3(jsonb),app.valid_director_prize_schedule_v1(jsonb),app.resolve_event_prize_schedule_v1(uuid,uuid,jsonb,uuid),app.prize_accounting_source_v9(uuid,uuid,uuid),app.classify_prize_expenses_v9(uuid,uuid,jsonb,jsonb),app.prize_rounding_funding_v9(uuid,uuid,bigint),app.write_prize_accounting_v9(uuid,uuid,uuid,jsonb,uuid,text),app.prize_accounting_domain_v9(),app.prize_final_source_guard_v9()from public,anon,authenticated,service_role;
revoke all on function public.get_prize_accounting_workspace_v9(uuid,uuid,uuid),public.save_prize_accounting_draft_v9(uuid,uuid,uuid,jsonb,uuid),public.record_prize_rounding_funding_v9(uuid,uuid,uuid,jsonb,uuid),public.void_prize_rounding_funding_v9(uuid,uuid,uuid,jsonb,uuid),public.finalize_prize_accounting_v9(uuid,uuid,uuid,jsonb,uuid),public.reconcile_prize_accounting_v9(uuid,uuid,uuid,uuid,text,jsonb)from public,anon,authenticated;
grant execute on function public.get_prize_accounting_workspace_v9(uuid,uuid,uuid),public.save_prize_accounting_draft_v9(uuid,uuid,uuid,jsonb,uuid),public.record_prize_rounding_funding_v9(uuid,uuid,uuid,jsonb,uuid),public.void_prize_rounding_funding_v9(uuid,uuid,uuid,jsonb,uuid),public.finalize_prize_accounting_v9(uuid,uuid,uuid,jsonb,uuid),public.reconcile_prize_accounting_v9(uuid,uuid,uuid,uuid,text,jsonb)to service_role;
commit;
