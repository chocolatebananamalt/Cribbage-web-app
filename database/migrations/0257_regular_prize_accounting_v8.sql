-- LOCAL PROPOSAL. Whole-$5 regular prizes and explicit unpaid rounding reconciliation.
-- No existing record is updated. No transfer, refund or automatic contribution.
begin;
create table app.prize_accounting_drafts_v8(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null references app.tournaments(id),event_id uuid not null,
 version integer not null check(version between 1 and 256),supersedes_id uuid references app.prize_accounting_drafts_v8(id),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),request_payload jsonb not null,rounding jsonb not null,awards jsonb not null,source_manifest jsonb not null,
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(event_id,version),unique(id,tournament_id,event_id));
create table app.prize_rounding_funding_events_v8(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null references app.tournaments(id),event_id uuid not null,draft_id uuid not null,
 version integer not null check(version between 1 and 256),event_type text not null check(event_type in('received','voided')),
 amount_minor bigint not null check(amount_minor between 1 and 100000000),received_at timestamptz,evidence_reference text not null,
 reason text not null,voids_id uuid,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 check((event_type='received'and received_at is not null and voids_id is null)or(event_type='voided'and received_at is null and voids_id is not null)),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),foreign key(draft_id,tournament_id,event_id)references app.prize_accounting_drafts_v8(id,tournament_id,event_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),unique(event_id,version),unique(id,tournament_id,event_id),
 foreign key(voids_id,tournament_id,event_id)references app.prize_rounding_funding_events_v8(id,tournament_id,event_id),unique(voids_id));
create table app.prize_accounting_finals_v8(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null references app.tournaments(id),event_id uuid not null,draft_id uuid not null,
 version integer not null default 1 check(version=1),source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 funding_version integer not null check(funding_version between 0 and 256),funding_snapshot jsonb not null,restricted_balance_minor bigint not null check(restricted_balance_minor between 0 and 499),
 status text not null default 'unpaid'check(status='unpaid'),reason text not null,
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),foreign key(draft_id,tournament_id,event_id)references app.prize_accounting_drafts_v8(id,tournament_id,event_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),unique(event_id));
do $$declare n text;begin foreach n in array array['prize_accounting_drafts_v8','prize_rounding_funding_events_v8','prize_accounting_finals_v8']loop
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 execute format('create index %I on app.%I(tournament_id)',n||'_tournament_idx',n);
 execute format('create index %I on app.%I(actor_id)',n||'_actor_idx',n);
 execute format('create index %I on app.%I(operation_receipt_id,tournament_id)',n||'_operation_idx',n);
end loop;end$$;
create index prize_accounting_draft_supersedes_v8_idx on app.prize_accounting_drafts_v8(supersedes_id);
create index prize_rounding_funding_draft_v8_idx on app.prize_rounding_funding_events_v8(draft_id,tournament_id,event_id);
create index prize_accounting_final_draft_v8_idx on app.prize_accounting_finals_v8(draft_id,tournament_id,event_id);

create function app.valid_regular_prize_schedule_v3(s jsonb)returns boolean language plpgsql immutable set search_path=''as $$
declare old jsonb;n integer;begin
 if s->>'kind'is distinct from'regular-prize-cohort-5usd-v3'or s->>'roundingRule'is distinct from'automatic-five-dollar-cohort-v3'or s->>'expectedQualifierCount'not in('4','5')then return false;end if;
 n:=(s->>'expectedQualifierCount')::integer;
 old:=s||jsonb_build_object('kind',case when n=4 then'director-selected-prize-schedule-v1'else'director-selected-five-qualifier-prize-schedule-v2'end,'roundingRule','floor_each_weighted_share_then_assign_remainder_to_champion');
 if not(case when n=4 then app.valid_four_qualifier_prize_schedule_v1(old)else app.valid_five_qualifier_prize_schedule_v2(old)end)then return false;end if;
 return not exists(select 1 from jsonb_array_elements(s->'cohorts')with ordinality c(v,i)where(v->>'bandStart')::integer<>case i when 1 then 1 when 2 then 2 when 3 then 3 else 5 end or(v->>'bandEnd')::integer<>case i when 1 then 1 when 2 then 2 when 3 then 4 else 5 end);
exception when others then return false;end$$;
create or replace function app.valid_director_prize_schedule_v1(p_schedule jsonb)returns boolean language sql immutable set search_path=''as $$
 select case when p_schedule->>'kind'='regular-prize-cohort-5usd-v3'then app.valid_regular_prize_schedule_v3(p_schedule)
 when p_schedule->>'kind'='director-selected-five-qualifier-prize-schedule-v2'then app.valid_five_qualifier_prize_schedule_v2(p_schedule)else app.valid_four_qualifier_prize_schedule_v1(p_schedule)end;
$$;
-- Legacy readers retain their exact contracts, never certify a new policy as pennies.
create or replace function app.resolve_event_prize_schedule_v1(p_tournament_id uuid,p_event_id uuid,p_source jsonb,p_schedule_version_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=''as $$declare kind text;begin
 select v.schedule_payload->>'kind'into kind from app.event_prize_schedule_bindings_v1 b join app.setup_prize_schedule_versions_v1 v on v.id=b.schedule_version_id where b.tournament_id=p_tournament_id and b.event_id=p_event_id order by b.binding_version desc limit 1;
 if kind='regular-prize-cohort-5usd-v3'then return jsonb_build_object('status','blocked','code','rounding_policy_requires_v8');end if;
 if kind='director-selected-five-qualifier-prize-schedule-v2'then return app.resolve_five_qualifier_prize_schedule_v2(p_tournament_id,p_event_id,p_source,p_schedule_version_id);end if;
 return app.resolve_four_qualifier_prize_schedule_v1(p_tournament_id,p_event_id,p_source,p_schedule_version_id);end$$;

create function app.prize_accounting_source_v8(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare basis jsonb;qs jsonb;qr app.q_obligation_reviews_v2%rowtype;v3 app.playoff_outcome_versions_v3%rowtype;v4 app.playoff_outcome_versions_v4%rowtype;
 bind app.event_prize_schedule_bindings_v1%rowtype;rule app.setup_prize_schedule_versions_v1%rowtype;source jsonb;mrp jsonb;facts jsonb;manifest jsonb;blocks jsonb:='[]';hasq boolean;
 expenses jsonb;total numeric;qtotal numeric:=0;assessment bigint;regular jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director')or not exists(select 1 from app.events where id=eid and tournament_id=tid)then return null;end if;
 hasq:=exists(select 1 from app.tournament_setup_q_pool_versions where tournament_id=tid);
 if exists(select 1 from app.tournament_setup_side_pool_versions where tournament_id=tid)or(select count(*)from app.events where tournament_id=tid and operational_state='active')<>1 then blocks:=blocks||jsonb_build_array('unsupported_scope');end if;
 if hasq then
  basis:=app.q_base_financial_basis_v6(tid,eid);qs:=app.q_obligation_sources_v2(actor,tid);
  if qs is null or qs->>'eventId'is distinct from eid::text or jsonb_array_length(coalesce(qs->'blockers','["source_blocked"]'))<>0 then blocks:=blocks||jsonb_build_array('source_blocked');end if;
  select*into qr from app.q_obligation_reviews_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
  if qr.id is null or qr.source_digest is distinct from qs->>'sourceDigest'or qr.obligations is distinct from qs->'obligations'then blocks:=blocks||jsonb_build_array('q_review_required');end if;
  select coalesce(sum((p->>'fundMinor')::numeric),0)into qtotal from jsonb_array_elements(coalesce(qr.obligations,'[]'))p;
  if exists(select 1 from jsonb_array_elements(coalesce(qr.obligations,'[]'))p cross join lateral jsonb_array_elements(p->'rows')r where mod((r->>'amountMinor')::numeric,500)<>0)then blocks:=blocks||jsonb_build_array('whole_five_awards_required');end if;
 else basis:=app.event_prize_schedule_financial_basis_pre_q_v6(tid,eid);end if;
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
  else facts:=jsonb_build_object('baseIncomeMinor',(basis->>'grossEntryIncomeMinor')::bigint,'qIncomeMinor',qtotal::bigint,'receiptTotalMinor',(basis->'ledgerSnapshot'->>'paymentTotalMinor')::bigint,'expenseTotalMinor',total::bigint,'regularAwardMinor',(basis->>'grossEntryIncomeMinor')::bigint-total::bigint,'minimumReturnMinor',app.minimum_payback_return_minor_v1((basis->>'grossEntryIncomeMinor')::numeric),'expenseEvidence',expenses,'ledgerSnapshot',basis->'ledgerSnapshot','canonicalMrp',mrp);end if;
 end if;
 manifest:=jsonb_build_object('policy','regular-prize-cohort-5usd-v3','basis',basis,'qSource',qs,'qReview',to_jsonb(qr),'playoffSource',source,'playoffEvidence',case when v3.id is not null then to_jsonb(v3)else to_jsonb(v4)end,'mrp',mrp,'regularRule',to_jsonb(rule),'assessment',assessment,'blocks',blocks);
 return jsonb_build_object('sourceDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'),'manifest',manifest,'blockers',blocks,'facts',facts,'regularRule',regular,'source',source,'qReview',case when qr.id is null then null else jsonb_build_object('id',qr.id,'version',qr.version,'sourceDigest',qr.source_digest,'obligations',qr.obligations)end);
end$$;

create function app.classify_prize_expenses_v8(tid uuid,eid uuid,facts jsonb,classes jsonb)returns jsonb language plpgsql stable security definer set search_path=''as $$
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
create function app.prize_rounding_funding_v8(tid uuid,eid uuid,required bigint)returns jsonb language sql stable security definer set search_path=''as $$
 with rows as(select*from app.prize_rounding_funding_events_v8 where tournament_id=tid and event_id=eid),totals as(select coalesce(max(version),0)version,coalesce(sum(case when event_type='received'then amount_minor else -amount_minor end),0)::bigint received from rows)
 select jsonb_build_object('version',version,'requiredMinor',coalesce(required,0),'receivedMinor',received,'shortfallMinor',greatest(coalesce(required,0)-received,0),'unallocatedMinor',greatest(received-coalesce(required,0),0),'records',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'eventType',event_type,'amountMinor',amount_minor,'receivedAt',received_at,'evidenceReference',evidence_reference,'reason',reason,'voidsId',voids_id,'sourceDigest',source_digest,'recordedAt',recorded_at)order by version),'[]')from rows))from totals;
$$;
create function public.get_prize_accounting_workspace_v8(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare s jsonb;d app.prize_accounting_drafts_v8%rowtype;f app.prize_accounting_finals_v8%rowtype;fund jsonb;cur boolean;begin
 s:=app.prize_accounting_source_v8(p_actor_id,p_tournament_id,p_event_id);if s is null then return null;end if;
 select*into d from app.prize_accounting_drafts_v8 where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;
 select*into f from app.prize_accounting_finals_v8 where tournament_id=p_tournament_id and event_id=p_event_id;
 cur:=d.id is not null and d.source_digest=s->>'sourceDigest'and jsonb_array_length(s->'blockers')=0;
 fund:=app.prize_rounding_funding_v8(p_tournament_id,p_event_id,coalesce((d.rounding->>'requiredFundingMinor')::bigint,0));
 return jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,'sourceDigest',s->'sourceDigest','blockers',s->'blockers','currentDraftVersion',coalesce(d.version,0),'currentFinalVersion',coalesce(f.version,0),'regularRule',s->'regularRule','facts',s->'facts','qReview',s->'qReview',
 'draft',case when d.id is null then null else jsonb_build_object('id',d.id,'version',d.version,'sourceDigest',d.source_digest,'current',cur,'request',d.request_payload,'rounding',d.rounding,'awards',d.awards)end,
 'funding',fund,'finalization',case when f.id is null then null else jsonb_build_object('id',f.id,'version',1,'draftId',f.draft_id,'draftVersion',d.version,'sourceDigest',f.source_digest,'current',cur and f.draft_id=d.id and f.funding_version=(fund->>'version')::integer,'status','unpaid','fundingVersion',f.funding_version,'restrictedBalanceMinor',f.restricted_balance_minor,'fundingReceivedMinor',f.funding_snapshot->'receivedMinor')end,'automaticPayment',false);
end$$;

create function app.write_prize_accounting_v8(actor uuid,tid uuid,eid uuid,req jsonb,op uuid,action text)returns jsonb language plpgsql security definer set search_path=''as $$
declare receipt app.operation_receipts%rowtype;d app.prize_accounting_drafts_v8%rowtype;prior_fund app.prize_rounding_funding_events_v8%rowtype;s jsonb;classes jsonb;calc jsonb;awards jsonb;fund jsonb;response jsonb;h text;code text;status_value text;ver integer;prior uuid;amount bigint;at_time timestamptz;ref text;rid uuid:=extensions.gen_random_uuid();oid uuid:=extensions.gen_random_uuid();begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null or tid is null or eid is null or op is null or action not in('draft','funding','void_funding','final')then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0));perform pg_advisory_xact_lock(hashtextextended('qualification-finalization:'||eid::text,0));perform pg_advisory_xact_lock(hashtextextended('standard-singles-post-event:'||eid::text,0));perform pg_advisory_xact_lock(hashtextextended('settlement:'||eid::text,0));perform pg_advisory_xact_lock(hashtextextended('settlement-domain:'||eid::text,0));
 select status into status_value from app.tournaments where id=tid for update;if not found then return jsonb_build_object('status','rejected','eventId',eid,'code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for update;if not found then return jsonb_build_object('status','rejected','eventId',eid,'code','not_director');end if;
 perform 1 from app.events where id=eid and tournament_id=tid for update;if not found then return jsonb_build_object('status','rejected','eventId',eid,'code','source_blocked');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('prize_accounting_v8',action,actor,tid,eid,req)::text,'utf8'),'sha256'),'hex');
 select*into receipt from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then if receipt.tournament_id=tid and receipt.target_id=eid and receipt.operation_type='prize_accounting_v8_'||action and receipt.request_hash=h then return receipt.response_payload;end if;return jsonb_build_object('status','rejected','eventId',eid,'code','idempotency_conflict');end if;
 begin
  if status_value not in('open','pending_finalization')then raise exception'tournament_unavailable';end if;
  if exists(select 1 from app.prize_accounting_finals_v8 where event_id=eid)then raise exception'already_finalized';end if;
  if jsonb_typeof(req)is distinct from'object'or jsonb_typeof(req->'reason')is distinct from'string'or length(trim(req->>'reason'))not between 1 and 500 or req->>'reason'<>trim(req->>'reason')or req->>'reason'~'[[:cntrl:]]'or req->'reviewed'is distinct from'true'::jsonb or jsonb_typeof(req->'expectedVersion')is distinct from'number'or req->>'expectedVersion'!~'^(0|[1-9][0-9]*)$'or(req->>'expectedVersion')::numeric>255 then raise exception'invalid_request';end if;
  s:=app.prize_accounting_source_v8(actor,tid,eid);if s is null or jsonb_array_length(s->'blockers')<>0 or s->'facts'='null'::jsonb then raise exception'source_blocked';end if;
  select*into d from app.prize_accounting_drafts_v8 where tournament_id=tid and event_id=eid order by version desc limit 1;
  if action='draft'then
   if(select count(*)from jsonb_object_keys(req))<>5 or not(req?&array['expectedVersion','sourceDigest','expenseClassifications','reason','reviewed'])then raise exception'invalid_request';end if;
   if req->>'sourceDigest'is distinct from s->>'sourceDigest'then raise exception'source_changed';end if;
   if coalesce(d.version,0)<>(req->>'expectedVersion')::integer then raise exception'stale_version';end if;
   if d.id is not null and d.source_digest=s->>'sourceDigest'and d.request_payload-'expectedVersion'is not distinct from req-'expectedVersion'then raise exception'already_drafted';end if;
   classes:=app.classify_prize_expenses_v8(tid,eid,s->'facts',req->'expenseClassifications');
   calc:=app.calculate_regular_prize_rounding_v3(jsonb_build_object('grossBaseIncomeMinor',s->'facts'->'baseIncomeMinor','expenseTotalMinor',s->'facts'->'expenseTotalMinor','benefitExpenseMinor',classes->'benefitExpenseMinor','expectedQualifierCount',s->'regularRule'->'rule'->'expectedQualifierCount','cohorts',s->'regularRule'->'rule'->'cohorts'));
   if calc->>'status'is distinct from'calculated'then if calc->>'code'='unsupported_computational_domain'then raise exception'unsupported_computational_domain';else raise exception'whole_five_awards_required';end if;end if;
   select jsonb_agg(jsonb_build_object('participantId',r->'participantId','displayName',r->'displayName','bandStart',r->'bandStart','bandEnd',r->'bandEnd','weight',c->'weight','totalAwardMinor',c->'awardMinor')order by(r->>'bandStart')::integer,r->>'participantId')into awards from jsonb_array_elements(s->'facts'->'canonicalMrp'->'rows')r join jsonb_array_elements(calc->'cohorts')c on r->'bandStart'=c->'bandStart'and r->'bandEnd'=c->'bandEnd';
   if jsonb_array_length(awards)<>(calc->>'expectedQualifierCount')::integer or(select sum((a->>'totalAwardMinor')::bigint)from jsonb_array_elements(awards)a)<>(calc->>'roundedBudgetMinor')::bigint then raise exception'whole_five_awards_required';end if;
   prior:=d.id;ver:=coalesce(d.version,0)+1;response:=jsonb_build_object('status','prize_accounting_draft_saved_v8','draftId',rid,'eventId',eid,'version',ver,'sourceDigest',s->'sourceDigest');
  else
   if d.id is null or d.id::text is distinct from req->>'draftId'then raise exception'stale_version';end if;
   if d.source_digest is distinct from s->>'sourceDigest'then raise exception'source_changed';end if;
   fund:=app.prize_rounding_funding_v8(tid,eid,(d.rounding->>'requiredFundingMinor')::bigint);
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
     select*into prior_fund from app.prize_rounding_funding_events_v8 where id=(req->>'voidsId')::uuid and tournament_id=tid and event_id=eid and event_type='received';if not found then raise exception'funding_not_found';end if;
     if exists(select 1 from app.prize_rounding_funding_events_v8 where voids_id=prior_fund.id)then raise exception'funding_already_voided';end if;
     amount:=prior_fund.amount_minor;ref:=prior_fund.evidence_reference;
    end if;
    response:=jsonb_build_object('status','prize_rounding_funding_recorded_v8','fundingId',rid,'eventId',eid,'version',ver,'sourceDigest',s->'sourceDigest','draftId',d.id,'eventType',case when action='funding'then'received'else'voided'end,'amountMinor',amount);
   else
    if(select count(*)from jsonb_object_keys(req))<>6 or not(req?&array['expectedVersion','draftId','draftVersion','expectedFundingVersion','reason','reviewed'])or req->>'expectedVersion'<>'0'or req->>'draftVersion'is distinct from d.version::text or req->>'expectedFundingVersion'is distinct from fund->>'version'then raise exception'stale_version';end if;
    if(fund->>'shortfallMinor')::bigint<>0 then raise exception'funding_shortfall';end if;if(fund->>'unallocatedMinor')::bigint<>0 then raise exception'funding_overage';end if;
    if not exists(select 1 from app.cross_check_finalizations where tournament_id=tid)or app.cross_check_finalization_conditions_v1(tid)is null or exists(select 1 from jsonb_array_elements(app.cross_check_finalization_conditions_v1(tid))c where(c->>'outstanding')::boolean)then raise exception'crosscheck_incomplete';end if;
    if(s->'facts'->>'receiptTotalMinor')::bigint+(fund->>'receivedMinor')::bigint<>(s->'facts'->>'expenseTotalMinor')::bigint+(d.rounding->>'roundedBudgetMinor')::bigint+(s->'facts'->>'qIncomeMinor')::bigint+(d.rounding->>'restrictedBalanceMinor')::bigint then raise exception'non_conserving_ledger';end if;
    ver:=1;response:=jsonb_build_object('status','prize_accounting_finalized_unpaid_v8','finalizationId',rid,'draftId',d.id,'eventId',eid,'version',1,'sourceDigest',s->'sourceDigest');
   end if;
  end if;
 exception when raise_exception or invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
  code:=case when sqlerrm in('tournament_unavailable','source_blocked','source_changed','stale_version','already_finalized','already_drafted','invalid_expense_classification','sanctioning_assessment_unfunded','whole_five_awards_required','unsupported_computational_domain','funding_shortfall','funding_overage','funding_already_voided','funding_not_found','amount_exceeds_shortfall','crosscheck_incomplete','non_conserving_ledger')then sqlerrm else'invalid_request'end;
  response:=jsonb_build_object('status','rejected','eventId',eid,'code',code);
 end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(oid,tid,actor,'prize_accounting_v8_'||action,eid,h,op,case when code is null then'accepted'else'rejected'end,response,clock_timestamp());
 if code is null then
  if action='draft'then insert into app.prize_accounting_drafts_v8(id,tournament_id,event_id,version,supersedes_id,source_digest,request_payload,rounding,awards,source_manifest,actor_id,operation_receipt_id)values(rid,tid,eid,ver,prior,s->>'sourceDigest',req,calc,awards,s->'manifest',actor,oid);
  elsif action in('funding','void_funding')then insert into app.prize_rounding_funding_events_v8(id,tournament_id,event_id,draft_id,version,event_type,amount_minor,received_at,evidence_reference,reason,voids_id,source_digest,actor_id,operation_receipt_id)values(rid,tid,eid,d.id,ver,case when action='funding'then'received'else'voided'end,amount,at_time,ref,req->>'reason',case when action='void_funding'then prior_fund.id else null end,s->>'sourceDigest',actor,oid);
  else insert into app.prize_accounting_finals_v8(id,tournament_id,event_id,draft_id,source_digest,funding_version,funding_snapshot,restricted_balance_minor,reason,actor_id,operation_receipt_id)values(rid,tid,eid,d.id,s->>'sourceDigest',(fund->>'version')::integer,fund,(d.rounding->>'restrictedBalanceMinor')::bigint,req->>'reason',actor,oid);end if;
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,oid,'prize_accounting_v8',case when code is null then rid else eid end,'prize_accounting_v8_'||action||case when code is null then'_unpaid'else'_rejected'end,response);
 return response;
end$$;
create function public.save_prize_accounting_draft_v8(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_prize_accounting_v8(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id,'draft');$$;
create function public.record_prize_rounding_funding_v8(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_prize_accounting_v8(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id,'funding');$$;
create function public.void_prize_rounding_funding_v8(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_prize_accounting_v8(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id,'void_funding');$$;
create function public.finalize_prize_accounting_v8(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_prize_accounting_v8(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id,'final');$$;
create function public.reconcile_prize_accounting_v8(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_action text,p_request jsonb)returns jsonb language plpgsql stable security definer set search_path=''as $$declare h text;r app.operation_receipts%rowtype;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or p_action not in('draft','funding','void_funding','final')or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director')or not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id)then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('prize_accounting_v8',p_action,p_actor_id,p_tournament_id,p_event_id,p_request)::text,'utf8'),'sha256'),'hex');
 select*into r from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if not found then return jsonb_build_object('authorized',true,'result',null);end if;
 return jsonb_build_object('authorized',true,'result',case when r.tournament_id=p_tournament_id and r.target_id=p_event_id and r.operation_type='prize_accounting_v8_'||p_action and r.request_hash=h then r.response_payload else jsonb_build_object('status','rejected','eventId',p_event_id,'code','idempotency_conflict')end);end$$;

-- Prevent duplicate monetary streams and protect new-policy events from penny writers.
create function app.prize_accounting_domain_v8()returns trigger language plpgsql security definer set search_path=''as $$declare newstream boolean;begin
 perform pg_advisory_xact_lock(hashtextextended('settlement-domain:'||new.event_id::text,0));newstream:=tg_table_name in('prize_accounting_drafts_v8','prize_accounting_finals_v8');
 if newstream then
  if exists(select 1 from app.q_accounting_drafts_v6 where tournament_id=new.tournament_id)or exists(select 1 from app.no_q_accounting_drafts_v7 where tournament_id=new.tournament_id)or exists(select 1 from app.standard_singles_settlement_drafts where tournament_id=new.tournament_id)or exists(select 1 from app.event_settlement_drafts_v5 where tournament_id=new.tournament_id)then raise exception'settlement_domain_conflict';end if;
 elsif exists(select 1 from app.prize_accounting_drafts_v8 where tournament_id=new.tournament_id)or exists(select 1 from app.event_prize_schedule_bindings_v1 b join app.setup_prize_schedule_versions_v1 r on r.id=b.schedule_version_id where b.tournament_id=new.tournament_id and r.schedule_payload->>'kind'='regular-prize-cohort-5usd-v3')then raise exception'settlement_domain_conflict';end if;return new;end$$;
do $$declare n text;begin foreach n in array array['prize_accounting_drafts_v8','prize_accounting_finals_v8','q_accounting_drafts_v6','q_accounting_finals_v6','no_q_accounting_drafts_v7','no_q_accounting_finals_v7','standard_singles_settlement_drafts','event_settlement_drafts_v5','standard_singles_settlement_final_versions','event_settlement_finals_v2']loop execute format('create trigger %I before insert on app.%I for each row execute function app.prize_accounting_domain_v8()',n||'_prize_domain_v8',n);end loop;end$$;
create function app.prize_final_source_guard_v8()returns trigger language plpgsql security definer set search_path=''as $$begin
 perform 1 from app.tournaments where id=new.tournament_id for update;
 if exists(select 1 from app.prize_accounting_finals_v8 where tournament_id=new.tournament_id)then raise exception'settlement_domain_conflict';end if;return new;end$$;
do $$declare n text;begin foreach n in array array['roster_payment_events','roster_payment_obligation_versions','tournament_expense_events','q_pool_membership_versions_v1','q_pool_allocation_versions_v1','q_operating_policies_v2','q_obligation_reviews_v2','playoff_outcome_versions_v3','playoff_outcome_versions_v4']loop execute format('create trigger %I before insert on app.%I for each row execute function app.prize_final_source_guard_v8()',n||'_prize_final_v8',n);end loop;end$$;
-- Reuse the existing member audience and expose only reviewed award amounts.
-- Funding, classification, evidence references and source manifests stay private.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('public.list_prize_award_summaries_v1(uuid,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION public.list_prize_award_summaries_v1(','FUNCTION app.list_prize_award_summaries_pre_prize_v8(');
 if p=d then raise exception 'V8 summary clone anchor changed';end if;execute p;
end$$;
revoke all on function app.list_prize_award_summaries_pre_prize_v8(uuid,uuid)from public,anon,authenticated,service_role;
create or replace function public.list_prize_award_summaries_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare result jsonb;director uuid;d app.prize_accounting_drafts_v8%rowtype;s jsonb;summary jsonb;begin
 result:=app.list_prize_award_summaries_pre_prize_v8(p_actor_id,p_tournament_id);if result is null then return null;end if;
 select profile_id into director from app.tournament_roles where tournament_id=p_tournament_id and role='director'order by profile_id limit 1;
 if director is null then return result;end if;
 for d in select distinct on(event_id)*from app.prize_accounting_drafts_v8 where tournament_id=p_tournament_id order by event_id,version desc loop
  s:=app.prize_accounting_source_v8(director,p_tournament_id,d.event_id);
  if s is null or s->>'sourceDigest'is distinct from d.source_digest or jsonb_array_length(s->'blockers')<>0 then continue;end if;
  select jsonb_build_object('eventId',d.event_id,'scheduleVersion',(s->'regularRule'->>'scheduleVersion')::integer,'status','unpaid',
   'finalized',exists(select 1 from app.prize_accounting_finals_v8 f where f.draft_id=d.id),'awards',
   (select jsonb_agg(jsonb_build_object('displayName',a->'displayName','bandStart',a->'bandStart','bandEnd',a->'bandEnd','amountMinor',a->'totalAwardMinor')order by(a->>'bandStart')::integer,a->>'displayName')from jsonb_array_elements(d.awards)a))into summary;
  result:=result||jsonb_build_array(summary);
 end loop;return result;end$$;
-- All private helpers retain no direct human or service execution.
revoke all on function app.valid_regular_prize_schedule_v3(jsonb),app.valid_director_prize_schedule_v1(jsonb),app.resolve_event_prize_schedule_v1(uuid,uuid,jsonb,uuid),app.prize_accounting_source_v8(uuid,uuid,uuid),app.classify_prize_expenses_v8(uuid,uuid,jsonb,jsonb),app.prize_rounding_funding_v8(uuid,uuid,bigint),app.write_prize_accounting_v8(uuid,uuid,uuid,jsonb,uuid,text),app.prize_accounting_domain_v8(),app.prize_final_source_guard_v8()from public,anon,authenticated,service_role;
revoke all on function public.get_prize_accounting_workspace_v8(uuid,uuid,uuid),public.save_prize_accounting_draft_v8(uuid,uuid,uuid,jsonb,uuid),public.record_prize_rounding_funding_v8(uuid,uuid,uuid,jsonb,uuid),public.void_prize_rounding_funding_v8(uuid,uuid,uuid,jsonb,uuid),public.finalize_prize_accounting_v8(uuid,uuid,uuid,jsonb,uuid),public.reconcile_prize_accounting_v8(uuid,uuid,uuid,uuid,text,jsonb)from public,anon,authenticated;
grant execute on function public.get_prize_accounting_workspace_v8(uuid,uuid,uuid),public.save_prize_accounting_draft_v8(uuid,uuid,uuid,jsonb,uuid),public.record_prize_rounding_funding_v8(uuid,uuid,uuid,jsonb,uuid),public.void_prize_rounding_funding_v8(uuid,uuid,uuid,jsonb,uuid),public.finalize_prize_accounting_v8(uuid,uuid,uuid,jsonb,uuid),public.reconcile_prize_accounting_v8(uuid,uuid,uuid,uuid,text,jsonb)to service_role;
commit;
