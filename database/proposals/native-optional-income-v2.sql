-- PRIVATE LOCAL CANDIDATE. Recorded bookkeeping, not bank verification/payment.
-- Shared evidence roots have no V1 proposal FK. V2 records bind genuine V2 rows.
begin;
create function app.native_optional_income_enabled_v2()returns boolean language sql immutable set search_path=''as $$select false$$;
create table app.native_optional_income_operations_v2(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 request_payload jsonb not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-income-v2',actor_id,operation_id,tournament_id,event_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
create table app.native_optional_income_records_v2(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 version integer not null check(version between 1 and 2147483647),income_id uuid not null,record_id uuid not null,prior_record_id uuid,
 physical_evidence_id uuid not null,evidence_reference text not null,proposal_revision_id uuid not null,ownership_revision_id uuid not null,
 amount_minor bigint not null check(amount_minor between 0 and 9007199254740991),voided boolean not null,label text not null,reason text not null,
 actor_id uuid not null,operation_id uuid not null,source_capture jsonb not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),recorded_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id,version),unique(tournament_id,income_id,record_id),unique(tournament_id,record_id),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(tournament_id,income_id)references app.native_unrestricted_income_sources_v1(tournament_id,income_id),
 foreign key(tournament_id,income_id,prior_record_id)references app.native_optional_income_records_v2(tournament_id,income_id,record_id),
 foreign key(proposal_revision_id,tournament_id,event_id)references app.native_optional_finance_revisions_v2(id,tournament_id,event_id),
 foreign key(ownership_revision_id,tournament_id,event_id)references app.native_optional_pool_ownership_revisions_v2(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_optional_income_operations_v2(actor_id,operation_id,tournament_id,event_id),
 check(not voided or amount_minor=0),
 check(evidence_reference=app.custom_payout_classification_text_v2(evidence_reference)and app.event_settings_js_text_length_v3(evidence_reference)between 1 and 2000),
 check(label=app.custom_payout_classification_text_v2(label)and app.event_settings_js_text_length_v3(label)between 1 and 200),
 check(reason=app.custom_payout_classification_text_v2(reason)and app.event_settings_js_text_length_v3(reason)between 1 and 2000)
);
create table app.native_optional_income_outcomes_v2(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_optional_income_operations_v2(actor_id,operation_id,tournament_id,event_id)
);
do $$declare n text;begin foreach n in array array['native_optional_income_operations_v2','native_optional_income_records_v2','native_optional_income_outcomes_v2']loop
 execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;

-- One logical income root cannot be journaled in both proposal domains.
create function app.guard_native_optional_income_domain_v2()returns trigger language plpgsql security definer set search_path=''as $$begin
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if tg_table_name='native_optional_income_records_v2'then
  if exists(select 1 from app.native_unrestricted_income_records_v1 where tournament_id=new.tournament_id and income_id=new.income_id)then raise exception'income_journal_domain_conflict';end if;
 elsif tg_table_name='native_unrestricted_income_records_v1'then
  if exists(select 1 from app.native_optional_income_records_v2 where tournament_id=new.tournament_id and income_id=new.income_id)then raise exception'income_journal_domain_conflict';end if;
 else raise exception'income_journal_guard_table';end if;
 if not exists(select 1 from app.native_unrestricted_income_sources_v1 s where s.tournament_id=new.tournament_id and s.income_id=new.income_id and s.event_id=new.event_id and s.physical_evidence_id=new.physical_evidence_id and s.evidence_reference=new.evidence_reference)then raise exception'income_evidence_owner_mismatch';end if;
 return new;
end$$;
create trigger aa_income_domain_v2 before insert on app.native_optional_income_records_v2 for each row execute function app.guard_native_optional_income_domain_v2();
create trigger aa_income_domain_v2 before insert on app.native_unrestricted_income_records_v1 for each row execute function app.guard_native_optional_income_domain_v2();
create trigger aa_optional_source_open_v2 before insert on app.native_optional_income_records_v2 for each row execute function app.guard_native_optional_financial_source_open_v2();

create function app.lock_native_optional_income_sources_v2()returns void language plpgsql security definer set search_path=''as $$begin
 lock table app.native_unrestricted_income_sources_v1,app.native_unrestricted_income_records_v1,
 app.native_optional_income_operations_v2,app.native_optional_income_records_v2,app.native_optional_income_outcomes_v2,
 app.roster_payment_events,app.tournament_expense_events,app.event_side_pool_election_versions,app.event_side_pool_team_election_versions in share mode nowait;
end$$;
create function app.native_optional_income_physical_conflict_v2(tid uuid)returns boolean language sql stable security definer set search_path=''as $$
 select exists(select 1 from app.native_unrestricted_income_sources_v1 i where i.tournament_id=tid and(
  exists(select 1 from app.roster_payment_events p where p.tournament_id=tid and p.id=i.physical_evidence_id)
  or exists(select 1 from app.tournament_expense_events e where e.tournament_id=tid and e.id=i.physical_evidence_id)
  or exists(select 1 from app.event_side_pool_election_versions e where e.tournament_id=tid and e.id=i.physical_evidence_id)
  or exists(select 1 from app.event_side_pool_team_election_versions e where e.tournament_id=tid and e.id=i.physical_evidence_id)))
$$;

-- A projection may report pending proposal rows for bootstrap. Only complete=true
-- may enter a fund review/final source. No missing history is interpreted as zero.
create function app.native_optional_income_context_v2(actor uuid,tid uuid,eid uuid,allow_pending boolean)returns jsonb
language plpgsql security definer set search_path=''as $$
declare finance jsonb;proposal app.native_optional_finance_revisions_v2%rowtype;record_row app.native_optional_income_records_v2%rowtype;
 root app.native_unrestricted_income_sources_v1%rowtype;line_row jsonb;income_lines jsonb:='[]';records jsonb:='[]';latest jsonb:='{}';v jsonb;head integer:=0;active numeric:=0;digest text;next_row jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 if exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)
  or app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false then return jsonb_build_object('status','blocked','code','existing_financial_liability');end if;
 finance:=app.native_optional_finance_source_v2(actor,tid,eid);if finance is null or finance->>'status'is distinct from'source_available'then return finance;end if;
 lock table app.native_optional_finance_revisions_v2 in share mode nowait;
 perform app.lock_native_optional_income_sources_v2();
 select*into proposal from app.native_optional_finance_revisions_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if proposal.id is null or proposal.source_capture is distinct from finance or proposal.basis is distinct from finance->'basis'
  or proposal.source_digest is distinct from finance->>'sourceDigest'or proposal.basis_digest is distinct from finance->>'basisDigest'
  or app.valid_native_optional_finance_editor_v2(proposal.editor,finance->'basis',null)is distinct from true
 then return jsonb_build_object('status','blocked','code','proposal_source_changed');end if;
 if proposal.editor->'lineForm'is distinct from'null'::jsonb or proposal.editor->'bandForm'is distinct from'null'::jsonb then return jsonb_build_object('status','blocked','code','unfinished_proposal_form');end if;
 for line_row in select value from jsonb_array_elements(proposal.editor->'history')with ordinality x(value,n)where n>jsonb_array_length(proposal.editor#>'{basis,history}')order by n loop
  if line_row#>>'{line,category}'is distinct from'unrestricted_income'or line_row#>>'{line,mode}'is distinct from'estimate'or line_row#>'{line,source}'is distinct from proposal.editor#>'{basis,source}'then return jsonb_build_object('status','blocked','code','unrecorded_finance_edit');end if;
  income_lines:=income_lines||jsonb_build_array(line_row);
 end loop;
 if app.native_optional_income_enabled_v2()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 if exists(select 1 from app.native_unrestricted_income_records_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','blocked','code','income_journal_domain_conflict');end if;
 if exists(select 1 from app.native_unrestricted_income_sources_v1 source_row where source_row.tournament_id=tid and source_row.event_id=eid
  and not exists(select 1 from app.native_optional_income_records_v2 r where r.tournament_id=source_row.tournament_id and r.income_id=source_row.income_id))
 then return jsonb_build_object('status','blocked','code','income_source_unresolved');end if;
 if app.native_optional_income_physical_conflict_v2(tid)is distinct from false then return jsonb_build_object('status','blocked','code','physical_evidence_conflict');end if;
 for record_row in select*from app.native_optional_income_records_v2 where tournament_id=tid and event_id=eid order by version loop
  head:=head+1;line_row:=income_lines->(head-1);
  select*into root from app.native_unrestricted_income_sources_v1 where tournament_id=tid and income_id=record_row.income_id;
  if record_row.version<>head or line_row is null or root.income_id is null or root.event_id<>eid or root.physical_evidence_id<>record_row.physical_evidence_id or root.evidence_reference<>record_row.evidence_reference
   or line_row#>>'{line,lineId}'is distinct from record_row.income_id::text or line_row#>>'{line,recordId}'is distinct from record_row.record_id::text
   or line_row#>'{line,priorRecordId}'is distinct from coalesce(to_jsonb(record_row.prior_record_id),'null'::jsonb)
   or(line_row#>>'{line,amountMinor}')::numeric is distinct from record_row.amount_minor::numeric or(line_row#>>'{line,voided}')::boolean is distinct from record_row.voided
   or line_row->>'label'is distinct from record_row.label or line_row#>>'{line,reason}'is distinct from record_row.reason
  then return jsonb_build_object('status','blocked','code','income_history_changed');end if;
  records:=records||jsonb_build_array(to_jsonb(record_row)-'source_capture');
  latest:=jsonb_set(latest,array[record_row.income_id::text],jsonb_build_object('amountMinor',record_row.amount_minor,'voided',record_row.voided),true);
 end loop;
 if head>jsonb_array_length(income_lines)then return jsonb_build_object('status','blocked','code','income_history_changed');end if;
 for v in select value from jsonb_each(latest)loop if not(v->>'voided')::boolean then active:=active+(v->>'amountMinor')::numeric;end if;end loop;
 if active>9007199254740991 then return jsonb_build_object('status','blocked','code','unsafe_income_total');end if;
 digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-income-head-v2',tid,eid,records)::text,'utf8'),'sha256'),'hex');
 next_row:=income_lines->head;
 if not allow_pending and next_row is not null then return jsonb_build_object('status','blocked','code','income_history_incomplete');end if;
 return jsonb_build_object('status','income_source_available','kind','native-optional-income-source-v2','actorId',actor,'tournamentId',tid,'eventId',eid,
  'proposalRevisionId',proposal.id,'ownershipRevisionId',proposal.ownership_revision_id,'financeSourceDigest',finance->'sourceDigest','basisDigest',finance->'basisDigest',
  'headVersion',head,'headDigest',digest,'activeMinor',active::bigint,'records',records,'complete',next_row is null,'nextUnposted',next_row,
  'pendingCount',jsonb_array_length(income_lines)-head,'bankReceiptVerified',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','blocked','code','income_source_invalid');end$$;
create function app.get_native_optional_income_projection_v2(actor uuid,tid uuid,eid uuid)returns jsonb language sql security definer set search_path=''as $$select app.native_optional_income_context_v2(actor,tid,eid,true)$$;

create function app.record_native_optional_income_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare prior app.native_optional_income_operations_v2%rowtype;root app.native_unrestricted_income_sources_v1%rowtype;context_value jsonb;target jsonb;line_value jsonb;
 h text;result_value jsonb;income_id_value uuid;record_id_value uuid;prior_id_value uuid;physical_id_value uuid;latest_id uuid;capture_value jsonb;digest text;rid uuid:=extensions.gen_random_uuid();
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null or op is null then return null;end if;
 if app.native_optional_income_enabled_v2()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 if jsonb_typeof(request)is distinct from'object'or(select count(*)from jsonb_object_keys(request))<>7 or not(request?&array['kind','expectedVersion','proposalRevisionId','ownershipRevisionId','recordId','physicalEvidenceId','evidenceReference'])
  or request->>'kind'is distinct from'native-optional-income-record-v2'or jsonb_typeof(request->'expectedVersion')is distinct from'number'or coalesce(request->>'expectedVersion','')!~'^(0|[1-9][0-9]{0,9})$'or(request->>'expectedVersion')::numeric>=2147483647
  or coalesce(request->>'proposalRevisionId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or coalesce(request->>'ownershipRevisionId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
  or coalesce(request->>'recordId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'or coalesce(request->>'physicalEvidenceId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
  or jsonb_typeof(request->'evidenceReference')is distinct from'string'or request->>'evidenceReference'is distinct from app.custom_payout_classification_text_v2(request->>'evidenceReference')or app.event_settings_js_text_length_v3(request->>'evidenceReference')not between 1 and 2000
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-income-v2',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.native_optional_income_operations_v2 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id is distinct from tid or prior.event_id is distinct from eid or prior.request_payload is distinct from request or prior.request_hash is distinct from h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select result into result_value from app.native_optional_income_outcomes_v2 where actor_id=actor and operation_id=op;return coalesce(result_value,jsonb_build_object('status','retry_exact','code','operation_incomplete'));
 end if;
 context_value:=app.native_optional_income_context_v2(actor,tid,eid,true);
 if context_value->>'status'='retry_exact'then return context_value;end if;
 if context_value is null or context_value->>'status'is distinct from'income_source_available'then return jsonb_build_object('status','rejected','code',coalesce(context_value->>'code','income_source_unavailable'));end if;
 if context_value->>'proposalRevisionId'is distinct from request->>'proposalRevisionId'or context_value->>'ownershipRevisionId'is distinct from request->>'ownershipRevisionId'then return jsonb_build_object('status','rejected','code','proposal_source_changed');end if;
 if(context_value->>'headVersion')::integer<>(request->>'expectedVersion')::integer then return jsonb_build_object('status','rejected','code','stale_version');end if;
 target:=context_value->'nextUnposted';line_value:=target->'line';
 if target is null or target='null'::jsonb or line_value->>'recordId'is distinct from request->>'recordId'then return jsonb_build_object('status','rejected','code','income_record_unavailable');end if;
 income_id_value:=(line_value->>'lineId')::uuid;record_id_value:=(line_value->>'recordId')::uuid;physical_id_value:=(request->>'physicalEvidenceId')::uuid;
 prior_id_value:=case when line_value->'priorRecordId'='null'::jsonb then null else(line_value->>'priorRecordId')::uuid end;
 if exists(select 1 from app.roster_payment_events where tournament_id=tid and id=physical_id_value)
  or exists(select 1 from app.tournament_expense_events where tournament_id=tid and id=physical_id_value)
  or exists(select 1 from app.event_side_pool_election_versions where tournament_id=tid and id=physical_id_value)
  or exists(select 1 from app.event_side_pool_team_election_versions where tournament_id=tid and id=physical_id_value)
 then return jsonb_build_object('status','rejected','code','physical_evidence_conflict');end if;
 if exists(select 1 from app.native_unrestricted_income_records_v1 where tournament_id=tid and income_id=income_id_value)then return jsonb_build_object('status','rejected','code','income_journal_domain_conflict');end if;
 select*into root from app.native_unrestricted_income_sources_v1 where tournament_id=tid and income_id=income_id_value;
 if root.income_id is not null and(root.event_id<>eid or root.physical_evidence_id<>physical_id_value or root.evidence_reference is distinct from request->>'evidenceReference')then return jsonb_build_object('status','rejected','code','physical_evidence_conflict');end if;
 if root.income_id is null and exists(select 1 from app.native_unrestricted_income_sources_v1 where tournament_id=tid and(physical_evidence_id=physical_id_value or lower(evidence_reference)=lower(request->>'evidenceReference')))then return jsonb_build_object('status','rejected','code','physical_evidence_conflict');end if;
 select record_id into latest_id from app.native_optional_income_records_v2 where tournament_id=tid and income_id=income_id_value order by version desc limit 1;
 if prior_id_value is distinct from latest_id or(root.income_id is null and prior_id_value is not null)then return jsonb_build_object('status','rejected','code','income_lineage_invalid');end if;
 if exists(select 1 from app.native_optional_income_records_v2 where tournament_id=tid and record_id=record_id_value)then return jsonb_build_object('status','rejected','code','income_record_conflict');end if;
 capture_value:=jsonb_build_object('kind','native-optional-income-record-source-v2','context',context_value,'proposalLine',target,'physicalEvidenceId',physical_id_value,'evidenceReference',request->'evidenceReference');
 if octet_length(capture_value::text)>4200000 then return jsonb_build_object('status','rejected','code','technical_resource_bound');end if;
 digest:=encode(extensions.digest(convert_to(capture_value::text,'utf8'),'sha256'),'hex');
 if root.income_id is null then insert into app.native_unrestricted_income_sources_v1(tournament_id,event_id,income_id,physical_evidence_id,evidence_reference,created_by)values(tid,eid,income_id_value,physical_id_value,request->>'evidenceReference',actor);end if;
 insert into app.native_optional_income_operations_v2(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)values(actor,op,tid,eid,request,h);
 insert into app.native_optional_income_records_v2(id,tournament_id,event_id,version,income_id,record_id,prior_record_id,physical_evidence_id,evidence_reference,proposal_revision_id,ownership_revision_id,amount_minor,voided,label,reason,actor_id,operation_id,source_capture,source_digest)
 values(rid,tid,eid,(request->>'expectedVersion')::integer+1,income_id_value,record_id_value,prior_id_value,physical_id_value,request->>'evidenceReference',(request->>'proposalRevisionId')::uuid,(request->>'ownershipRevisionId')::uuid,
  (line_value->>'amountMinor')::bigint,(line_value->>'voided')::boolean,target->>'label',line_value->>'reason',actor,op,capture_value,digest);
 result_value:=jsonb_build_object('status','optional_income_recorded_v2','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'incomeRecordId',rid,'incomeId',income_id_value,'recordId',record_id_value,'version',(request->>'expectedVersion')::integer+1,
  'proposalRevisionId',request->'proposalRevisionId','ownershipRevisionId',request->'ownershipRevisionId','recordedBookkeepingOnly',true,'bankReceiptVerified',false,'moneyMoved',false,'payoutAuthorized',false,'disbursementAuthorized',false,'finalizationAuthorized',false);
 insert into app.native_optional_income_outcomes_v2(actor_id,operation_id,tournament_id,event_id,result)values(actor,op,tid,eid,result_value);return result_value;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when unique_violation then return jsonb_build_object('status','rejected','code','income_identity_conflict');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');end$$;

create function app.reconcile_native_optional_income_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
declare prior app.native_optional_income_operations_v2%rowtype;h text;r jsonb;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into prior from app.native_optional_income_operations_v2 where actor_id=actor and operation_id=op;if not found then return jsonb_build_object('status','unknown','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op);end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-income-v2',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 if prior.tournament_id is distinct from tid or prior.event_id is distinct from eid or prior.request_payload is distinct from request or prior.request_hash is distinct from h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 select result into r from app.native_optional_income_outcomes_v2 where actor_id=actor and operation_id=op;if not found then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
 return jsonb_build_object('status','historical_operation','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',prior.request_payload,'result',r,'currentFundAuthority',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
do $$declare signature text;begin foreach signature in array array[
 'app.native_optional_income_enabled_v2()','app.guard_native_optional_income_domain_v2()','app.lock_native_optional_income_sources_v2()',
 'app.native_optional_income_physical_conflict_v2(uuid)','app.native_optional_income_context_v2(uuid,uuid,uuid,boolean)',
 'app.get_native_optional_income_projection_v2(uuid,uuid,uuid)','app.record_native_optional_income_v2(uuid,uuid,uuid,uuid,jsonb)','app.reconcile_native_optional_income_v2(uuid,uuid,uuid,uuid,jsonb)'
]loop execute format('alter function %s owner to postgres',signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);end loop;end$$;
commit;
