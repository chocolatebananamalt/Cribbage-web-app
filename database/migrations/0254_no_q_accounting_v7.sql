-- LOCAL ONLY. Base-entry accounting with no Q or Side Pools; all obligations remain unpaid.
begin;
create table app.no_q_accounting_drafts_v7 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id), event_id uuid not null,
 version integer not null check(version between 1 and 256), supersedes_id uuid references app.no_q_accounting_drafts_v7(id),
 source_digest text not null check(source_digest ~ '^[a-f0-9]{64}$'),
 request_payload jsonb not null, facts jsonb not null, source_manifest jsonb not null,
 status text not null default 'unpaid' check(status='unpaid'),
 actor_id uuid not null references app.profiles(id), operation_receipt_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(event_id,version),unique(id,tournament_id,event_id)
);
create table app.no_q_accounting_finals_v7 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id), event_id uuid not null,
 draft_id uuid not null, version integer not null default 1 check(version=1),
 source_digest text not null check(source_digest ~ '^[a-f0-9]{64}$'),
 status text not null default 'unpaid' check(status='unpaid'),
 reason text not null check(length(trim(reason)) between 1 and 500),
 actor_id uuid not null references app.profiles(id), operation_receipt_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(draft_id,tournament_id,event_id)references app.no_q_accounting_drafts_v7(id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(event_id)
);
do $$declare n text;begin foreach n in array array['no_q_accounting_drafts_v7','no_q_accounting_finals_v7']loop
 execute format('alter table app.%I enable row level security',n);
 execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 execute format('create index %I on app.%I(tournament_id)',n||'_tournament_idx',n);
 execute format('create index %I on app.%I(actor_id)',n||'_actor_idx',n);
 execute format('create index %I on app.%I(operation_receipt_id,tournament_id)',n||'_receipt_idx',n);
end loop;end$$;
create index no_q_accounting_draft_supersedes_idx on app.no_q_accounting_drafts_v7(supersedes_id);
create index no_q_accounting_final_draft_idx on app.no_q_accounting_finals_v7(draft_id,tournament_id,event_id);


-- Reuse the original full base-entry receipt verifier. Do not create a dummy Q
-- policy/review, relax its mandatory binding, or allocate entry cash to a pool.
create function app.no_q_accounting_source_v7(p_actor uuid,p_tid uuid,p_eid uuid)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare basis jsonb;v3 app.playoff_outcome_versions_v3%rowtype;v4 app.playoff_outcome_versions_v4%rowtype;
 source jsonb;mrp jsonb;regular jsonb;facts jsonb;manifest jsonb;blocks jsonb:='[]';expense_total numeric;award_total numeric;assessment bigint;expense_evidence jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tid and profile_id=p_actor and role='director')or not exists(select 1 from app.events where id=p_eid and tournament_id=p_tid)then return null;end if;
 if exists(select 1 from app.tournament_setup_q_pool_versions where tournament_id=p_tid)or exists(select 1 from app.tournament_setup_side_pool_versions where tournament_id=p_tid)
  or exists(select 1 from app.q_obligation_reviews_v1 where tournament_id=p_tid)or exists(select 1 from app.q_obligation_reviews_v2 where tournament_id=p_tid)
  or(select count(*)from app.events where tournament_id=p_tid and operational_state='active')<>1
 then blocks:=blocks||jsonb_build_array('unsupported_scope');end if;
 if exists(select 1 from app.standard_singles_settlement_drafts where tournament_id=p_tid)or exists(select 1 from app.event_settlement_drafts_v5 where tournament_id=p_tid)
  or exists(select 1 from app.standard_singles_settlement_final_versions where tournament_id=p_tid)or exists(select 1 from app.event_settlement_finals_v2 where tournament_id=p_tid)
  or exists(select 1 from app.q_accounting_drafts_v6 where tournament_id=p_tid)or exists(select 1 from app.q_accounting_finals_v6 where tournament_id=p_tid)
  or exists(select 1 from app.no_q_accounting_drafts_v7 where tournament_id=p_tid and event_id<>p_eid)
 then blocks:=blocks||jsonb_build_array('legacy_settlement_preserved');end if;
 basis:=app.event_prize_schedule_financial_basis_pre_q_v6(p_tid,p_eid);
 if basis->>'status'is distinct from'supported'then blocks:=blocks||jsonb_build_array('funding_unreconciled');end if;
 if exists(select 1 from app.roster_payment_events e where e.tournament_id=p_tid and e.event_type='received'and e.currency_code<>'USD'and not exists(select 1 from app.roster_payment_events n where n.roster_entry_id=e.roster_entry_id and n.version>e.version))
  or exists(select 1 from app.tournament_expense_events e where e.tournament_id=p_tid and e.event_type='recorded'and e.currency_code<>'USD'and not exists(select 1 from app.tournament_expense_events n where n.expense_id=e.expense_id and n.version>e.version))then blocks:=blocks||jsonb_build_array('funding_unreconciled');end if;
 select*into v3 from app.playoff_outcome_versions_v3 where tournament_id=p_tid and event_id=p_eid order by version desc limit 1;
 select*into v4 from app.playoff_outcome_versions_v4 where tournament_id=p_tid and event_id=p_eid order by version desc limit 1;
 source:=case when v3.id is not null and v4.id is null then jsonb_build_object('kind','playoff_outcome_v3','resultId',v3.id,'qualificationResultVersionId',v3.qualification_result_version_id)
  when v4.id is not null and v3.id is null then jsonb_build_object('kind','playoff_outcome_v4','resultId',v4.id,'qualificationResultVersionId',v4.qualification_result_version_id)else null end;
 if source is null or app.settlement_source_current_v5(p_tid,p_eid,source)is distinct from true then blocks:=blocks||jsonb_build_array('source_blocked');else mrp:=app.canonical_settlement_mrp_v5(p_tid,p_eid,source);end if;
 if mrp is null or mrp->>'status'is distinct from'available'or not(case when source->>'kind'='playoff_outcome_v4'then jsonb_array_length(mrp->'rows')=5 and(select count(*)from jsonb_array_elements(mrp->'rows')r where r->>'byeWins'='1')=3
  else jsonb_array_length(mrp->'rows')=4 and not exists(select 1 from jsonb_array_elements(mrp->'rows')r where coalesce((r->>'byeWins')::integer,0)<>0)end)then blocks:=blocks||jsonb_build_array('unsupported_scope');end if;
 if source is not null then regular:=app.resolve_event_prize_schedule_v1(p_tid,p_eid,source);end if;
 if regular is null or regular->>'status'='unstructured'then blocks:=blocks||jsonb_build_array('schedule_required');elsif regular->>'status'<>'available'then blocks:=blocks||jsonb_build_array('schedule_revision_required');end if;
 select coalesce(jsonb_agg(jsonb_build_object('expenseEventId',e->'expenseEventId','description',e->'description','amountMinor',e->'amountMinor','currencyCode','USD')order by e->>'expenseEventId'),'[]')into expense_evidence from jsonb_array_elements(coalesce(basis->'expenses','[]'))e;
 if basis->>'status'='supported'and regular->>'status'='available'then
  select coalesce(sum((a->>'totalAwardMinor')::numeric),0)into award_total from jsonb_array_elements(regular->'awards')a;
  select coalesce(sum((e->>'amountMinor')::numeric),0)into expense_total from jsonb_array_elements(basis->'expenses')e;
  if(basis->>'grossEntryIncomeMinor')::numeric<>expense_total+award_total or(basis->'ledgerSnapshot'->>'paymentTotalMinor')::numeric<>(basis->>'grossEntryIncomeMinor')::numeric then blocks:=blocks||jsonb_build_array('non_conserving_ledger');end if;
  assessment:=app.settlement_assessment_v5(p_eid);if assessment is null then blocks:=blocks||jsonb_build_array('sanctioning_assessment_unfunded');end if;
  facts:=jsonb_build_object('baseIncomeMinor',(basis->>'grossEntryIncomeMinor')::bigint,'qIncomeMinor',0,'receiptTotalMinor',(basis->>'grossEntryIncomeMinor')::bigint,'expenseTotalMinor',expense_total::bigint,'regularAwardMinor',award_total::bigint,
   'minimumReturnMinor',app.minimum_payback_return_minor_v1((basis->>'grossEntryIncomeMinor')::numeric),'expenseEvidence',expense_evidence,'ledgerSnapshot',basis->'ledgerSnapshot','canonicalMrp',mrp);
 end if;
 manifest:=jsonb_build_object('version','base-no-q-accounting-v7-unpaid','baseBasis',basis,'playoffSource',source,'playoffEvidence',case when v3.id is not null then to_jsonb(v3)else to_jsonb(v4)end,
  'canonicalMrp',mrp,'regularSchedule',regular,'assessment',assessment,'blocks',blocks);
 return jsonb_build_object('sourceDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'),'manifest',manifest,'blockers',blocks,'facts',facts,
  'regularSchedule',case when regular->>'status'='available'then regular else null end,'source',source);
end$$;
revoke all on function app.no_q_accounting_source_v7(uuid,uuid,uuid)from public,anon,authenticated,service_role;
create function public.get_no_q_accounting_workspace_v7(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s jsonb;d app.no_q_accounting_drafts_v7%rowtype;f app.no_q_accounting_finals_v7%rowtype;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 s:=app.no_q_accounting_source_v7(p_actor_id,p_tournament_id,p_event_id);if s is null then return null;end if;
 select *into d from app.no_q_accounting_drafts_v7 where event_id=p_event_id and tournament_id=p_tournament_id order by version desc limit 1;
 select *into f from app.no_q_accounting_finals_v7 where event_id=p_event_id and tournament_id=p_tournament_id;
 return jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,'sourceDigest',s->'sourceDigest','blockers',s->'blockers','currentDraftVersion',coalesce(d.version,0),'currentFinalVersion',coalesce(f.version,0),'regularSchedule',case when jsonb_typeof(s->'regularSchedule')='object'and s->'regularSchedule'->>'status'='available'then(s->'regularSchedule')-'ledgerBasis'else null end,'facts',s->'facts',
 'draft',case when d.id is null then null else jsonb_build_object('id',d.id,'version',d.version,'sourceDigest',d.source_digest,'request',d.request_payload,'facts',d.facts,'current',d.source_digest=s->>'sourceDigest'and jsonb_array_length(s->'blockers')=0)end,
 'finalization',case when f.id is null then null else jsonb_build_object('id',f.id,'version',f.version,'draftId',f.draft_id,'sourceDigest',f.source_digest,'current',f.source_digest=s->>'sourceDigest'and jsonb_array_length(s->'blockers')=0,'status','unpaid')end,'automaticPayment',false);
end$$;

create function app.write_no_q_accounting_v7(p_actor uuid,p_tid uuid,p_eid uuid,p_request jsonb,p_op uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r app.operation_receipts%rowtype;d app.no_q_accounting_drafts_v7%rowtype;s jsonb;facts jsonb;response jsonb;h text;code text;current_version integer;oid uuid:=extensions.gen_random_uuid();rid uuid:=extensions.gen_random_uuid();prior uuid;status_value text;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if p_actor is null or p_tid is null or p_eid is null or p_op is null or p_action is null or p_action not in('draft','final')then return null;end if;
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
 h:=encode(extensions.digest(convert_to(jsonb_build_array('no_q_accounting_v7',p_action,p_actor,p_tid,p_eid,p_request)::text,'utf8'),'sha256'),'hex');
 select *into r from app.operation_receipts where actor_profile_id=p_actor and client_operation_id=p_op;
 if found then
  if r.tournament_id=p_tid and r.target_id=p_eid and r.operation_type='no_q_accounting_v7_'||p_action and r.request_hash=h then return r.response_payload;end if;
  return jsonb_build_object('status','rejected','eventId',p_eid,'code','idempotency_conflict');
 end if;
 begin
  if status_value not in('open','pending_finalization')then raise exception 'tournament_unavailable';end if;
  if app.no_q_accounting_domain_conflict_v7(p_eid)then raise exception 'settlement_domain_conflict';end if;
  if exists(select 1 from app.no_q_accounting_finals_v7 where event_id=p_eid)then raise exception 'already_finalized';end if;
  if jsonb_typeof(p_request)is distinct from'object'or jsonb_typeof(p_request->'reason')is distinct from'string'or length(trim(p_request->>'reason'))not between 1 and 500 or p_request->>'reason'<>trim(p_request->>'reason')or p_request->>'reason'~'[[:cntrl:]]'or p_request->'reviewed'is distinct from'true'::jsonb or jsonb_typeof(p_request->'expectedVersion')is distinct from'number'or(p_request->>'expectedVersion')!~'^(0|[1-9][0-9]*)$'or(p_request->>'expectedVersion')::numeric>255 then raise exception 'invalid_request';end if;
  s:=app.no_q_accounting_source_v7(p_actor,p_tid,p_eid);
  if s is null or jsonb_array_length(s->'blockers')<>0 or s->'facts'='null'::jsonb then raise exception 'source_blocked';end if;
  if p_action='draft'then
   if(select count(*)from jsonb_object_keys(p_request))<>6 or not(p_request?&array['expectedVersion','sourceDigest','scheduleVersionId','reason','expenseClassifications','reviewed'])then raise exception 'invalid_request';end if;
   if p_request->>'sourceDigest'is distinct from s->>'sourceDigest'then raise exception 'source_changed';end if;
   if p_request->>'scheduleVersionId'is distinct from s->'regularSchedule'->>'scheduleVersionId'then raise exception 'schedule_revision_required';end if;
   select *into d from app.no_q_accounting_drafts_v7 where event_id=p_eid order by version desc limit 1;current_version:=coalesce(d.version,0);
   if current_version<>(p_request->>'expectedVersion')::integer then raise exception 'stale_version';end if;
   if d.id is not null and d.source_digest=s->>'sourceDigest'and d.request_payload-'expectedVersion' is not distinct from p_request-'expectedVersion'then raise exception 'already_drafted';end if;
   facts:=app.validate_q_accounting_expenses_v6(p_tid,p_eid,s->'facts',p_request->'expenseClassifications')||jsonb_build_object('source',s->'source');
   prior:=d.id;current_version:=current_version+1;
   response:=jsonb_build_object('status','no_q_accounting_draft_saved_v7','draftId',rid,'eventId',p_eid,'version',current_version,'sourceDigest',s->'sourceDigest');
  else
   if(select count(*)from jsonb_object_keys(p_request))<>5 or not(p_request?&array['draftId','draftVersion','expectedVersion','reason','reviewed'])or p_request->>'expectedVersion'<>'0' or jsonb_typeof(p_request->'draftVersion')is distinct from'number' or coalesce(p_request->>'draftVersion','')!~'^[1-9][0-9]*$' or (p_request->>'draftVersion')::numeric>256 then raise exception 'invalid_request';end if;
   select *into d from app.no_q_accounting_drafts_v7 where tournament_id=p_tid and event_id=p_eid and id=(p_request->>'draftId')::uuid and version=(p_request->>'draftVersion')::integer;
   if not found or exists(select 1 from app.no_q_accounting_drafts_v7 where event_id=p_eid and version>d.version)then raise exception 'stale_version';end if;
   if d.source_digest is distinct from s->>'sourceDigest'then raise exception 'source_changed';end if;
   facts:=app.validate_q_accounting_expenses_v6(p_tid,p_eid,s->'facts',d.request_payload->'expenseClassifications')||jsonb_build_object('source',s->'source');
   if facts is distinct from d.facts then raise exception 'source_changed';end if;
   if not exists(select 1 from app.cross_check_finalizations where tournament_id=p_tid)or app.cross_check_finalization_conditions_v1(p_tid)is null or exists(select 1 from jsonb_array_elements(app.cross_check_finalization_conditions_v1(p_tid))c where(c->>'outstanding')::boolean)then raise exception 'crosscheck_incomplete';end if;
   current_version:=1;response:=jsonb_build_object('status','no_q_accounting_finalized_unpaid_v7','finalizationId',rid,'draftId',d.id,'eventId',p_eid,'version',1,'sourceDigest',s->'sourceDigest');
  end if;
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
  code:=case when sqlerrm='settlement_domain_conflict'then'legacy_settlement_preserved'when sqlerrm in('tournament_unavailable','unsupported_scope','source_blocked','source_changed','stale_version','already_finalized','already_drafted','q_review_required','schedule_required','schedule_revision_required','funding_unreconciled','legacy_settlement_preserved','invalid_expense_classification','sanctioning_assessment_unfunded','insufficient_participant_return','non_conserving_ledger','crosscheck_incomplete')then sqlerrm else'invalid_request'end;
  response:=jsonb_build_object('status','rejected','eventId',p_eid,'code',code);
 end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(oid,p_tid,p_actor,'no_q_accounting_v7_'||p_action,p_eid,h,p_op,case when code is null then'accepted'else'rejected'end,response,clock_timestamp());
 if code is null and p_action='draft'then insert into app.no_q_accounting_drafts_v7(id,tournament_id,event_id,version,supersedes_id,source_digest,request_payload,facts,source_manifest,actor_id,operation_receipt_id)values(rid,p_tid,p_eid,current_version,prior,s->>'sourceDigest',p_request,facts,s->'manifest',p_actor,oid);
 elsif code is null then insert into app.no_q_accounting_finals_v7(id,tournament_id,event_id,draft_id,source_digest,reason,actor_id,operation_receipt_id)values(rid,p_tid,p_eid,d.id,s->>'sourceDigest',p_request->>'reason',p_actor,oid);end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tid,p_actor,oid,'no_q_accounting_v7',case when code is null then rid else p_eid end,'no_q_accounting_v7_'||p_action||case when code is null then'_unpaid'else'_rejected'end,response);
 return response;
end$$;
revoke all on function app.write_no_q_accounting_v7(uuid,uuid,uuid,jsonb,uuid,text)from public,anon,authenticated,service_role;
create function public.save_no_q_accounting_draft_v7(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_no_q_accounting_v7(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id,'draft');$$;
create function public.finalize_no_q_accounting_v7(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path=''as $$select app.write_no_q_accounting_v7(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id,'final');$$;
create function public.reconcile_no_q_accounting_v7(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb,p_action text)returns jsonb language plpgsql stable security definer set search_path=''as $$declare h text;r app.operation_receipts%rowtype;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director')or not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id)or p_action is null or p_action not in('draft','final')then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('no_q_accounting_v7',p_action,p_actor_id,p_tournament_id,p_event_id,p_request)::text,'utf8'),'sha256'),'hex');
 select *into r from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if not found then return jsonb_build_object('authorized',true,'result',null);end if;
 if r.tournament_id=p_tournament_id and r.target_id=p_event_id and r.operation_type='no_q_accounting_v7_'||p_action and r.request_hash=h then return jsonb_build_object('authorized',true,'result',r.response_payload);end if;
 return jsonb_build_object('authorized',true,'result',jsonb_build_object('status','rejected','eventId',p_event_id,'code','idempotency_conflict'));
end$$;
revoke all on function public.get_no_q_accounting_workspace_v7(uuid,uuid,uuid),public.save_no_q_accounting_draft_v7(uuid,uuid,uuid,jsonb,uuid),public.finalize_no_q_accounting_v7(uuid,uuid,uuid,jsonb,uuid),public.reconcile_no_q_accounting_v7(uuid,uuid,uuid,uuid,jsonb,text)from public,anon,authenticated;
grant execute on function public.get_no_q_accounting_workspace_v7(uuid,uuid,uuid),public.save_no_q_accounting_draft_v7(uuid,uuid,uuid,jsonb,uuid),public.finalize_no_q_accounting_v7(uuid,uuid,uuid,jsonb,uuid),public.reconcile_no_q_accounting_v7(uuid,uuid,uuid,uuid,jsonb,text)to service_role;

-- One active accounting domain per event. This shares the established event
-- mutex and leaves all pre-existing grants/history and accepted replay intact.
create function app.no_q_accounting_domain_conflict_v7(p_eid uuid)
returns boolean language sql stable security definer set search_path=''as $$
 select exists(select 1 from app.standard_singles_settlement_drafts where tournament_id=(select tournament_id from app.events where id=p_eid))
 or exists(select 1 from app.event_settlement_drafts_v5 where tournament_id=(select tournament_id from app.events where id=p_eid))
 or exists(select 1 from app.standard_singles_settlement_final_versions where tournament_id=(select tournament_id from app.events where id=p_eid))
 or exists(select 1 from app.event_settlement_finals_v2 where tournament_id=(select tournament_id from app.events where id=p_eid))
 or exists(select 1 from app.q_accounting_drafts_v6 where tournament_id=(select tournament_id from app.events where id=p_eid))
 or exists(select 1 from app.q_accounting_finals_v6 where tournament_id=(select tournament_id from app.events where id=p_eid))
 or exists(select 1 from app.no_q_accounting_drafts_v7 where event_id<>p_eid and tournament_id=(select tournament_id from app.events where id=p_eid));
$$;
revoke all on function app.no_q_accounting_domain_conflict_v7(uuid)from public,anon,authenticated,service_role;
create function app.require_no_q_accounting_domain_v7()returns trigger language plpgsql security definer set search_path=''as $$begin
 perform pg_advisory_xact_lock(hashtextextended('settlement-domain:'||new.event_id::text,0));
 if tg_table_name in('no_q_accounting_drafts_v7','no_q_accounting_finals_v7')then
  if app.no_q_accounting_domain_conflict_v7(new.event_id)then raise exception 'settlement_domain_conflict';end if;
 elsif exists(select 1 from app.no_q_accounting_drafts_v7 where tournament_id=new.tournament_id)or exists(select 1 from app.no_q_accounting_finals_v7 where tournament_id=new.tournament_id)then raise exception 'settlement_domain_conflict';end if;
 return new;end$$;
revoke all on function app.require_no_q_accounting_domain_v7()from public,anon,authenticated,service_role;
do $$declare n text;begin foreach n in array array['no_q_accounting_drafts_v7','no_q_accounting_finals_v7','q_accounting_drafts_v6','q_accounting_finals_v6','standard_singles_settlement_drafts','event_settlement_drafts_v5','standard_singles_settlement_final_versions','event_settlement_finals_v2']loop
 execute format('create trigger %I before insert on app.%I for each row execute function app.require_no_q_accounting_domain_v7()',n||'_no_q_domain_v7',n);end loop;end$$;
-- Controlled v5/v6 rejection is after their exact old receipt lookup, before any
-- insert. Legacy entry points already map the same domain trigger rejection.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.write_event_settlement_v5(uuid,uuid,uuid,jsonb,uuid,text)'::regprocedure);
 p:=replace(d,'if not app.valid_settlement_request_v5(p_request,p_action)then',
 'if exists(select 1 from app.no_q_accounting_drafts_v7 where tournament_id=p_tournament_id)or exists(select 1 from app.no_q_accounting_finals_v7 where tournament_id=p_tournament_id)then raise exception ''settlement_domain_conflict'';end if;
  if not app.valid_settlement_request_v5(p_request,p_action)then');
 if p=d then raise exception 'V5 no-Q domain anchor changed';end if;execute p;
 d:=pg_get_functiondef('app.write_q_accounting_v6(uuid,uuid,uuid,jsonb,uuid,text)'::regprocedure);
 p:=replace(d,'if exists(select 1 from app.q_accounting_finals_v6 where event_id=p_eid)then',
 'if exists(select 1 from app.no_q_accounting_drafts_v7 where tournament_id=p_tid)or exists(select 1 from app.no_q_accounting_finals_v7 where tournament_id=p_tid)then raise exception ''settlement_domain_conflict'';end if;
  if exists(select 1 from app.q_accounting_finals_v6 where event_id=p_eid)then');
 if p=d then raise exception 'V6 no-Q domain anchor changed';end if;execute p;
end$$;
-- Playoff corrections may stale an unfinished draft. Once unpaid accounting is
-- final, new playoff outcomes are blocked; old exact requests still reconcile.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('public.record_standard_singles_playoff_outcomes_v4(uuid,uuid,uuid,jsonb,uuid)'::regprocedure);
 p:=replace(d,'if exists(select 1 from app.q_accounting_finals_v6 where tournament_id=p_tournament_id and event_id=p_event_id)then',
 'if exists(select 1 from app.q_accounting_finals_v6 where tournament_id=p_tournament_id and event_id=p_event_id)or exists(select 1 from app.no_q_accounting_finals_v7 where tournament_id=p_tournament_id and event_id=p_event_id)then');
 if p=d then raise exception 'V4 final no-Q guard anchor changed';end if;execute p;
 d:=pg_get_functiondef('public.get_standard_singles_playoff_outcome_workspace_v4(uuid,uuid,uuid)'::regprocedure);
 p:=replace(d,'when exists(select 1 from app.q_accounting_finals_v6 where event_id=p_event_id)then',
 'when exists(select 1 from app.q_accounting_finals_v6 where event_id=p_event_id)or exists(select 1 from app.no_q_accounting_finals_v7 where event_id=p_event_id)then');
 if p=d then raise exception 'V4 workspace no-Q guard anchor changed';end if;execute p;
 d:=pg_get_functiondef('app.playoff_outcome_blocker_v3(uuid,uuid,uuid)'::regprocedure);
 p:=replace(d,'select array_agg(participant_id order by ranking_ordinal) into ids',
 'if exists(select 1 from app.no_q_accounting_finals_v7 where event_id=p_event_id)then return ''legacy_conflict'';end if;
 select array_agg(participant_id order by ranking_ordinal) into ids');
 if p=d then raise exception 'V3 final no-Q guard anchor changed';end if;execute p;
end$$;
create function app.require_no_q_playoff_final_guard_v7()returns trigger language plpgsql security definer set search_path=''as $$begin
 perform pg_advisory_xact_lock(hashtextextended('standard-singles-post-event:'||new.event_id::text,0));
 if exists(select 1 from app.no_q_accounting_finals_v7 where event_id=new.event_id)then raise exception 'playoff_domain_conflict';end if;
 return new;end$$;
revoke all on function app.require_no_q_playoff_final_guard_v7()from public,anon,authenticated,service_role;
create trigger playoff_v3_no_q_final_guard_v7 before insert on app.playoff_outcome_versions_v3 for each row execute function app.require_no_q_playoff_final_guard_v7();
create trigger playoff_v4_no_q_final_guard_v7 before insert on app.playoff_outcome_versions_v4 for each row execute function app.require_no_q_playoff_final_guard_v7();
-- Current reviewed awards remain visible to the same existing member audience.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('public.list_prize_award_summaries_v1(uuid,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION public.list_prize_award_summaries_v1(','FUNCTION app.list_prize_award_summaries_pre_no_q_v7(');
 if p=d then raise exception 'No-Q summary clone anchor changed';end if;execute p;
end$$;
revoke all on function app.list_prize_award_summaries_pre_no_q_v7(uuid,uuid)from public,anon,authenticated,service_role;
create or replace function public.list_prize_award_summaries_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare result jsonb;director uuid;d app.no_q_accounting_drafts_v7%rowtype;s jsonb;regular jsonb;summary jsonb;begin
 result:=app.list_prize_award_summaries_pre_no_q_v7(p_actor_id,p_tournament_id);if result is null then return null;end if;
 select profile_id into director from app.tournament_roles where tournament_id=p_tournament_id and role='director'order by profile_id limit 1;
 if director is null then return result;end if;
 for d in select distinct on(event_id)*from app.no_q_accounting_drafts_v7 where tournament_id=p_tournament_id order by event_id,version desc loop
  s:=app.no_q_accounting_source_v7(director,p_tournament_id,d.event_id);
  if s is null or s->>'sourceDigest'is distinct from d.source_digest or jsonb_array_length(s->'blockers')<>0 then continue;end if;
  regular:=s->'regularSchedule';if regular->>'status'is distinct from'available'then continue;end if;
  select jsonb_build_object('eventId',d.event_id,'scheduleVersion',(regular->>'scheduleVersion')::integer,'status','unpaid',
   'finalized',exists(select 1 from app.no_q_accounting_finals_v7 f where f.draft_id=d.id),'awards',
   (select jsonb_agg(jsonb_build_object('displayName',a->'displayName','bandStart',a->'bandStart','bandEnd',a->'bandEnd','amountMinor',a->'totalAwardMinor')order by(a->>'bandStart')::integer,a->>'displayName')from jsonb_array_elements(regular->'awards')a))into summary;
  result:=result||jsonb_build_array(summary);
 end loop;return result;end$$;
commit;


