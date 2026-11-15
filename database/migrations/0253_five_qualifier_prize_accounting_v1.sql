-- LOCAL ONLY. Versioned five-person regular awards; no Q formula or rounding change.
begin;
-- Preserve original helper bodies and identity; existing callers dispatch by explicit kind.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.valid_director_prize_schedule_v1(jsonb)'::regprocedure);
 p:=replace(d,'FUNCTION app.valid_director_prize_schedule_v1(','FUNCTION app.valid_four_qualifier_prize_schedule_v1(');
 if p=d then raise exception 'Prize validator clone anchor changed';end if;execute p;
 d:=pg_get_functiondef('app.resolve_event_prize_schedule_v1(uuid,uuid,jsonb,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION app.resolve_event_prize_schedule_v1(','FUNCTION app.resolve_four_qualifier_prize_schedule_v1(');
 if p=d then raise exception 'Prize resolver clone anchor changed';end if;execute p;
end$$;
create function app.valid_five_qualifier_prize_schedule_v2(p_schedule jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; denominator numeric := 0; seen text[] := '{}'; band text;
begin
  if jsonb_typeof(p_schedule) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_schedule)) <> 6
    or not (p_schedule ?& array['kind', 'amountBasis', 'expectedQualifierCount', 'sourceReference', 'roundingRule', 'cohorts'])
    or jsonb_typeof(p_schedule->'kind') is distinct from 'string'
    or jsonb_typeof(p_schedule->'amountBasis') is distinct from 'string'
    or jsonb_typeof(p_schedule->'expectedQualifierCount') is distinct from 'number'
    or jsonb_typeof(p_schedule->'roundingRule') is distinct from 'string'
    or p_schedule->>'kind' <> 'director-selected-five-qualifier-prize-schedule-v2'
    or p_schedule->>'amountBasis' <> 'total_award'
    or p_schedule->>'expectedQualifierCount' <> '5'
    or p_schedule->>'roundingRule' <> 'floor_each_weighted_share_then_assign_remainder_to_champion'
    or jsonb_typeof(p_schedule->'sourceReference') is distinct from 'string'
    or length(trim(p_schedule->>'sourceReference')) not between 1 and 500
    or p_schedule->>'sourceReference' <> trim(p_schedule->>'sourceReference')
    or p_schedule->>'sourceReference' ~ '[[:cntrl:]]'
    or jsonb_typeof(p_schedule->'cohorts') is distinct from 'array'
    or jsonb_array_length(p_schedule->'cohorts') <> 4 then return false;
  end if;
  for item in select value from jsonb_array_elements(p_schedule->'cohorts') loop
    if jsonb_typeof(item) is distinct from 'object' or (select count(*) from jsonb_object_keys(item)) <> 3
      or not (item ?& array['bandStart', 'bandEnd', 'weight'])
      or jsonb_typeof(item->'bandStart') is distinct from 'number' or (item->>'bandStart') !~ '^[1-9][0-9]*$'
      or jsonb_typeof(item->'bandEnd') is distinct from 'number' or (item->>'bandEnd') !~ '^[1-9][0-9]*$'
      or jsonb_typeof(item->'weight') is distinct from 'number' or (item->>'weight') !~ '^[1-9][0-9]*$'
      or (item->>'weight')::numeric > 9007199254740991 then return false;
    end if;
    band := (item->>'bandStart') || ':' || (item->>'bandEnd');
    if band = any(seen) then return false; end if;
    seen := array_append(seen, band);
    denominator := denominator + (item->>'weight')::numeric * ((item->>'bandEnd')::integer - (item->>'bandStart')::integer + 1);
  end loop;
  return seen @> array['1:1', '2:2', '3:4', '5:5'] and denominator between 1 and 9007199254740991;
exception when others then return false;
end $$;
create function app.resolve_five_qualifier_prize_schedule_v2(p_tournament_id uuid, p_event_id uuid, p_source jsonb, p_schedule_version_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare binding app.event_prize_schedule_bindings_v1%rowtype; schedule app.setup_prize_schedule_versions_v1%rowtype; basis jsonb; canonical jsonb;
  denominator numeric; expense_total numeric; gross numeric; budget numeric; allocated numeric; remainder numeric; awards jsonb;
begin
  select * into binding from app.event_prize_schedule_bindings_v1 where tournament_id = p_tournament_id and event_id = p_event_id order by binding_version desc limit 1;
  if not found then return jsonb_build_object('status', 'unstructured'); end if;
  if p_schedule_version_id is not null and p_schedule_version_id <> binding.schedule_version_id then return jsonb_build_object('status', 'blocked', 'code', 'schedule_revision_required'); end if;
  select * into schedule from app.setup_prize_schedule_versions_v1 where id = binding.schedule_version_id and tournament_id = p_tournament_id;
  if schedule.settings_fingerprint <> app.prize_schedule_settings_fingerprint_v1(app.prize_schedule_settings_v1(p_tournament_id, binding.client_row_id))
    then return jsonb_build_object('status', 'blocked', 'code', 'schedule_revision_required'); end if;
  if app.settlement_source_current_v5(p_tournament_id, p_event_id, p_source) is distinct from true then return jsonb_build_object('status', 'blocked', 'code', 'source_unavailable'); end if;
  canonical := app.canonical_settlement_mrp_v5(p_tournament_id, p_event_id, p_source);
  if canonical->>'status' is distinct from 'available' or jsonb_array_length(canonical->'rows') <> 5
    or p_source->>'kind' is distinct from 'playoff_outcome_v4'
    or app.valid_five_qualifier_prize_schedule_v2(schedule.schedule_payload) is distinct from true
    or (select count(*) from jsonb_array_elements(canonical->'rows') item where item->>'byeWins'='1') <> 3
    or exists(select 1 from jsonb_array_elements(canonical->'rows') item where item->>'byeWins' not in ('0','1'))
    or (select count(*) from jsonb_array_elements(canonical->'rows') item where item->>'bandStart' = '1' and item->>'bandEnd' = '1') <> 1
    or (select count(*) from jsonb_array_elements(canonical->'rows') item where item->>'bandStart' = '2' and item->>'bandEnd' = '2') <> 1
    or (select count(*) from jsonb_array_elements(canonical->'rows') item where item->>'bandStart' = '3' and item->>'bandEnd' = '4') <> 2
    or (select count(*) from jsonb_array_elements(canonical->'rows') item where item->>'bandStart'='5' and item->>'bandEnd'='5') <> 1
    then return jsonb_build_object('status', 'blocked', 'code', 'schedule_revision_required'); end if;
  basis := app.event_prize_schedule_financial_basis_v1(p_tournament_id, p_event_id);
  if basis->>'status' <> 'supported' then return jsonb_build_object('status', 'blocked', 'code', coalesce(basis->>'code', 'unsupported_prize_schedule_scope')); end if;
  select coalesce(sum((item->>'amountMinor')::numeric), 0) into expense_total from jsonb_array_elements(basis->'expenses') item;
  gross := (basis->>'grossEntryIncomeMinor')::numeric; budget := gross - expense_total;
  if gross < 0 or gross > 9007199254740991::numeric or expense_total < 0 or expense_total > 9007199254740991::numeric
    or budget <= 0 or budget > 9007199254740991::numeric then return jsonb_build_object('status', 'blocked', 'code', 'schedule_revision_required'); end if;
  select sum((cohort->>'weight')::numeric * ((cohort->>'bandEnd')::integer - (cohort->>'bandStart')::integer + 1)) into denominator
    from jsonb_array_elements(schedule.schedule_payload->'cohorts') cohort;
  with calculated as (
    select row_item, cohort, floor(budget * (cohort->>'weight')::numeric / denominator) amount
    from jsonb_array_elements(canonical->'rows') row_item
    join jsonb_array_elements(schedule.schedule_payload->'cohorts') cohort
      on cohort->>'bandStart' = row_item->>'bandStart' and cohort->>'bandEnd' = row_item->>'bandEnd'
  ) select sum(amount) into allocated from calculated;
  remainder := budget - allocated;
  with calculated as (
    select row_item, cohort, floor(budget * (cohort->>'weight')::numeric / denominator)
      + case when row_item->>'bandStart' = '1' and row_item->>'bandEnd' = '1' then remainder else 0 end amount
    from jsonb_array_elements(canonical->'rows') row_item
    join jsonb_array_elements(schedule.schedule_payload->'cohorts') cohort
      on cohort->>'bandStart' = row_item->>'bandStart' and cohort->>'bandEnd' = row_item->>'bandEnd'
  ) select jsonb_agg(jsonb_build_object('participantId', row_item->>'participantId', 'displayName', row_item->>'displayName',
      'bandStart', (row_item->>'bandStart')::integer, 'bandEnd', (row_item->>'bandEnd')::integer,
      'weight', (cohort->>'weight')::bigint, 'totalAwardMinor', amount::bigint) order by (row_item->>'bandStart')::integer, row_item->>'participantId') into awards from calculated;
  if jsonb_array_length(awards) <> 5 or exists(select 1 from jsonb_array_elements(awards) item where (item->>'totalAwardMinor')::bigint <= 0)
    then return jsonb_build_object('status', 'blocked', 'code', 'schedule_revision_required'); end if;
  return jsonb_build_object('status', 'available', 'scheduleVersionId', schedule.id, 'scheduleVersion', schedule.version,
    'rule', schedule.schedule_payload, 'grossEntryIncomeMinor', gross::bigint, 'expenseTotalMinor', expense_total::bigint,
    'prizeBudgetMinor', budget::bigint, 'roundingRemainderMinor', remainder::bigint, 'awards', awards,
    'ledgerBasis', jsonb_build_object('participantFacts', basis->'participantFacts', 'expenseFacts', basis->'expenses', 'ledgerSnapshot', basis->'ledgerSnapshot'));
end $$;

create or replace function app.valid_director_prize_schedule_v1(p_schedule jsonb)
returns boolean language sql immutable set search_path='' as $$
 select case when p_schedule->>'kind'='director-selected-five-qualifier-prize-schedule-v2'
 then app.valid_five_qualifier_prize_schedule_v2(p_schedule) else app.valid_four_qualifier_prize_schedule_v1(p_schedule) end;
$$;
create or replace function app.resolve_event_prize_schedule_v1(p_tournament_id uuid,p_event_id uuid,p_source jsonb,p_schedule_version_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare kind text;begin
 select v.schedule_payload->>'kind' into kind from app.event_prize_schedule_bindings_v1 b join app.setup_prize_schedule_versions_v1 v on v.id=b.schedule_version_id
 where b.tournament_id=p_tournament_id and b.event_id=p_event_id order by b.binding_version desc limit 1;
 if kind='director-selected-five-qualifier-prize-schedule-v2' then return app.resolve_five_qualifier_prize_schedule_v2(p_tournament_id,p_event_id,p_source,p_schedule_version_id);end if;
 return app.resolve_four_qualifier_prize_schedule_v1(p_tournament_id,p_event_id,p_source,p_schedule_version_id);
end$$;
revoke all on function app.valid_four_qualifier_prize_schedule_v1(jsonb),app.valid_five_qualifier_prize_schedule_v2(jsonb),app.valid_director_prize_schedule_v1(jsonb),
 app.resolve_four_qualifier_prize_schedule_v1(uuid,uuid,jsonb,uuid),app.resolve_five_qualifier_prize_schedule_v2(uuid,uuid,jsonb,uuid),app.resolve_event_prize_schedule_v1(uuid,uuid,jsonb,uuid) from public,anon,authenticated,service_role;
-- Qualification already closes schedule revision, and explicit v4 history also blocks it.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.prize_schedule_revision_is_open_v1(uuid,uuid)'::regprocedure);
 p:=replace(d,'and (exists(select 1 from app.playoff_outcome_versions_v3 item where item.event_id = activation.event_id)',
 'and (exists(select 1 from app.playoff_outcome_versions_v4 item where item.event_id = activation.event_id) or exists(select 1 from app.playoff_outcome_versions_v3 item where item.event_id = activation.event_id)');
 if p=d then raise exception 'Prize timing anchor changed';end if;execute p;
end$$;
create or replace function app.q_accounting_source_v6(p_actor uuid,p_tid uuid,p_eid uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare qs jsonb;qr app.q_obligation_reviews_v2%rowtype;basis jsonb;outcome app.playoff_outcome_versions_v3%rowtype;outcome4 app.playoff_outcome_versions_v4%rowtype;source jsonb;mrp jsonb;regular jsonb;facts jsonb;manifest jsonb;blocks jsonb:='[]';qtotal numeric;awardtotal numeric;expense_total numeric;assessment bigint;expense_evidence jsonb;
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
 select *into outcome4 from app.playoff_outcome_versions_v4 where tournament_id=p_tid and event_id=p_eid order by version desc limit 1;
 source:=case when outcome4.id is not null and outcome.id is null then jsonb_build_object('kind','playoff_outcome_v4','resultId',outcome4.id,'qualificationResultVersionId',outcome4.qualification_result_version_id)
 when outcome4.id is null and outcome.id is not null then jsonb_build_object('kind','playoff_outcome_v3','resultId',outcome.id,'qualificationResultVersionId',outcome.qualification_result_version_id) else null end;
 if source is null or app.settlement_source_current_v5(p_tid,p_eid,source)is distinct from true then blocks:=blocks||'"source_blocked"';else mrp:=app.canonical_settlement_mrp_v5(p_tid,p_eid,source);end if;
 if mrp is null or mrp->>'status' is distinct from 'available'or not(case when source->>'kind'='playoff_outcome_v4' then jsonb_array_length(mrp->'rows')=5 and
 (select count(*)from jsonb_array_elements(mrp->'rows')r where r->>'byeWins'='1')=3 and
 not exists(select 1 from jsonb_array_elements(mrp->'rows')r where r->>'byeWins' not in('0','1'))
 else jsonb_array_length(mrp->'rows')=4 and not exists(select 1 from jsonb_array_elements(mrp->'rows')r where coalesce((r->>'byeWins')::integer,0)<>0)end)then blocks:=blocks||'"unsupported_scope"';end if;
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



-- Only the supported, current five-qualifier qualification removes the older
-- v1 preview's blanket bye blocker from the v2 Q workspace. Legacy v1 remains
-- blocked, and every other funding/dispute/source guard is retained.
do $$declare d text;p text;old text;replacement text;begin
 d:=pg_get_functiondef('public.get_q_operating_workspace_v2(uuid,uuid)'::regprocedure);
 old:=$anchor$if qid is null then blocks:=blocks||'"finalized_qualification_required"'::jsonb;end if;$anchor$;
 replacement:=$anchor$if qid is not null and app.five_qualifier_playoff_source_v4(p_tournament_id,eid,qid)is not null then
 select coalesce(jsonb_agg(value order by value),'[]')into blocks from jsonb_array_elements(blocks)where value<>'"unsupported_byes"'::jsonb;
 end if;
 if qid is null then blocks:=blocks||'"finalized_qualification_required"'::jsonb;end if;$anchor$;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception 'Q v2 bye eligibility anchor changed';end if;
 p:=replace(d,old,replacement);execute p;
end$$;

-- Existing members gain no new audience access: reuse the exact legacy access
-- check before deriving a minimal public unpaid-award summary. No source manifest
-- or funding/expense facts are returned to members.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('public.list_prize_award_summaries_v1(uuid,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION public.list_prize_award_summaries_v1(','FUNCTION app.list_legacy_prize_award_summaries_pre_five_v1(');
 if p=d then raise exception 'Summary clone anchor changed';end if;execute p;
 d:=pg_get_functiondef('public.get_event_prize_schedule_resolution_v1(uuid,uuid,uuid,jsonb)'::regprocedure);
 p:=replace(d,$old$('legacy_placement_v2', 'playoff_outcome_v3')$old$,$new$('legacy_placement_v2', 'playoff_outcome_v3', 'playoff_outcome_v4')$new$);
 if p=d then raise exception 'Read-only resolution source anchor changed';end if;execute p;
end$$;
revoke all on function app.list_legacy_prize_award_summaries_pre_five_v1(uuid,uuid)from public,anon,authenticated,service_role;
create or replace function public.list_prize_award_summaries_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare result jsonb;director uuid;d app.q_accounting_drafts_v6%rowtype;s jsonb;regular jsonb;summary jsonb;begin
 result:=app.list_legacy_prize_award_summaries_pre_five_v1(p_actor_id,p_tournament_id);
 if result is null then return null;end if;
 select profile_id into director from app.tournament_roles where tournament_id=p_tournament_id and role='director'order by profile_id limit 1;
 if director is null then return result;end if;
 for d in select distinct on(event_id)*from app.q_accounting_drafts_v6 where tournament_id=p_tournament_id order by event_id,version desc loop
  s:=app.q_accounting_source_v6(director,p_tournament_id,d.event_id);
  if s is null or s->>'sourceDigest' is distinct from d.source_digest or jsonb_array_length(s->'blockers')<>0 then continue;end if;
  regular:=s->'regularSchedule';
  if regular->>'status' is distinct from 'available' then continue;end if;
  select jsonb_build_object('eventId',d.event_id,'scheduleVersion',(regular->>'scheduleVersion')::integer,'status','unpaid',
   'finalized',exists(select 1 from app.q_accounting_finals_v6 f where f.draft_id=d.id),'awards',
   (select jsonb_agg(jsonb_build_object('displayName',a->'displayName','bandStart',a->'bandStart','bandEnd',a->'bandEnd','amountMinor',a->'totalAwardMinor')order by(a->>'bandStart')::integer,a->>'displayName')from jsonb_array_elements(regular->'awards')a))into summary;
  result:=result||jsonb_build_array(summary);
 end loop;
 return result;
end$$;
commit;

