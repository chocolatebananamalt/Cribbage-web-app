-- UNEXECUTED PRIVATE OPERATIONAL FINANCE ESTIMATE PROPOSAL.
-- LOCAL REVIEW CANDIDATE ONLY. No public wrapper, grant, ledger write, award,
-- finalization, payout recipient, payment or disbursement is created here.
-- Requires event-settings-operational-activation-v1.sql,
-- native-event-ledger-source-reader-v1.sql and
-- native-event-ledger-allocation-v1.sql.
begin;

-- Catalog presence is not enablement. A separately reviewed change is required
-- after isolated runtime, concurrency and recovery acceptance.
create function app.operational_event_finance_proposals_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create table app.operational_event_finance_operations_v1(
 actor_id uuid not null references app.profiles(id),
 operation_id uuid not null,
 tournament_id uuid not null,
 event_id uuid not null,
 request_payload jsonb not null,
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),
 unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array(
  'operational-event-finance-proposal-v1',actor_id,tournament_id,event_id,
  operation_id,request_payload
 )::text,'utf8'),'sha256'),'hex'))
);

create table app.operational_event_finance_revisions_v1(
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null,event_id uuid not null,
 version integer not null check(version between 1 and 2147483647),
 prior_revision_id uuid,
 actor_id uuid not null,operation_id uuid not null,
 binding_id uuid not null,activation_id uuid not null,
 setup_event_version_id uuid not null,settings_snapshot_id uuid not null,
 context_review_id uuid not null,native_allocation_revision_id uuid not null,
 qualification_result_version_id uuid,
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 basis_digest text not null check(basis_digest~'^[a-f0-9]{64}$'),
 source_capture jsonb not null,basis jsonb not null,editor jsonb not null,
 reason text not null,
 proposal_only boolean not null default true check(proposal_only),
 money_moved boolean not null default false check(not money_moved),
 finalization_authorized boolean not null default false check(not finalization_authorized),
 payout_authorized boolean not null default false check(not payout_authorized),
 created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id,version),
 unique(id,tournament_id,event_id),
 unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(prior_revision_id,tournament_id,event_id)
  references app.operational_event_finance_revisions_v1(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.operational_event_finance_operations_v1(actor_id,operation_id,tournament_id,event_id),
 foreign key(binding_id)references app.event_settings_operational_bindings_v1(id),
 foreign key(activation_id)references app.tournament_setup_activations(id),
 foreign key(setup_event_version_id)references app.tournament_setup_event_versions(id),
 foreign key(settings_snapshot_id)references app.event_settings_snapshots_v3(id),
 foreign key(context_review_id)references app.event_rule_context_reviews_v1(id),
 foreign key(native_allocation_revision_id,tournament_id)
  references app.native_ledger_allocation_revisions_v1(id,tournament_id),
 foreign key(qualification_result_version_id,tournament_id,event_id)
  references app.qualification_result_versions(id,tournament_id,event_id),
 check(reason=app.custom_payout_classification_text_v2(reason)
  and app.event_settings_js_text_length_v3(reason)between 1 and 2000)
);

create table app.operational_event_finance_outcomes_v1(
 actor_id uuid not null,operation_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,
 result jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.operational_event_finance_operations_v1(actor_id,operation_id,tournament_id,event_id)
);

do $$declare n text;begin
 foreach n in array array[
  'operational_event_finance_operations_v1',
  'operational_event_finance_revisions_v1',
  'operational_event_finance_outcomes_v1'
 ]loop
  execute format('alter table app.%I owner to postgres',n);
  execute format('alter table app.%I enable row level security',n);
  execute format('alter table app.%I force row level security',n);
  execute format('revoke all on table app.%I from public,anon,authenticated,service_role',n);
  execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 end loop;
end$$;

create index operational_event_finance_revisions_head_v1
 on app.operational_event_finance_revisions_v1(tournament_id,event_id,version desc);

-- The native source reader is statement-consistent only. Proposal reads and
-- writes take its complete SHARE/NOWAIT reservation and additionally freeze
-- operational bindings, allocation heads and qualification heads.
create function app.lock_operational_event_finance_sources_v1()returns void
language plpgsql security definer set search_path=''as $$
begin
 perform app.lock_native_ledger_sources_v1();
 perform app.lock_event_settings_playoff_sources_v1();
 lock table app.event_settings_operational_bindings_v1,
  app.event_settings_snapshots_v3,app.event_rule_context_reviews_v1,
  app.native_ledger_allocation_operations_v1,
  app.native_ledger_allocation_outcomes_v1,
  app.native_ledger_allocation_revisions_v1,
  app.qualification_result_versions in share mode nowait;
end$$;

-- Actor is explicit only for private composition. Every caller must separately
-- establish auth.uid/current role; this helper repeats the current role check.
create function app.operational_event_finance_source_v1(
 tid uuid,eid uuid,actor uuid
)returns jsonb
language plpgsql security definer set search_path=''as $$
declare
 t app.tournaments%rowtype;e app.events%rowtype;
 b app.event_settings_operational_bindings_v1%rowtype;
 activation app.tournament_setup_activations%rowtype;
 setup_event app.tournament_setup_event_versions%rowtype;
 settings_snapshot app.event_settings_snapshots_v3%rowtype;
 review app.event_rule_context_reviews_v1%rowtype;
 allocation app.native_ledger_allocation_revisions_v1%rowtype;
 qualification app.qualification_result_versions%rowtype;
 current_native jsonb;current_facts jsonb;event_sources jsonb;
 raw_capture jsonb;source_value jsonb;coverage jsonb;workspace jsonb;basis jsonb;
 source_digest text;basis_digest text;settings_value jsonb;source_ref jsonb;
 history_value jsonb;line_value jsonb;part jsonb;source_row jsonb;
 active_count integer;paid_count integer;entry_fee numeric;gross numeric:=0;
 benefit numeric:=0;expense numeric:=0;regular_parts integer:=0;
 paid_semantics boolean:=true;line_ids text[]:='{}';line_id text;md text;
 seen_sources text[]:='{}';seen_buckets text[];source_id text;
 qualification_value jsonb:=null;event_source_count integer;
begin
 if current_setting('transaction_isolation')<>'read committed'then
  return jsonb_build_object('status','retry_exact','code','isolation_not_supported');
 end if;
 if tid is null or eid is null or actor is null then
  return jsonb_build_object('status','blocked','code','invalid_request');
 end if;
 perform 1 from app.tournaments where id=tid for share nowait;
 if not found then return jsonb_build_object('status','blocked','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles
  where tournament_id=tid and profile_id=actor and role in('director','co_director')
  order by role for key share nowait;
 if not found then return jsonb_build_object('status','blocked','code','not_director');end if;
 perform app.lock_operational_event_finance_sources_v1();
 select*into t from app.tournaments where id=tid;
 select*into e from app.events where id=eid and tournament_id=tid and operational_state='active';
 if e.id is null or e.event_type not in('main','consolation')or e.format<>'standard_singles'then
  return jsonb_build_object('status','blocked','code','unsupported_event_scope');
 end if;
 select*into b from app.event_settings_operational_bindings_v1
  where tournament_id=tid and event_id=eid;
 if b.id is null then return jsonb_build_object('status','blocked','code','operational_binding_required');end if;
 select*into activation from app.tournament_setup_activations
  where id=b.activation_id and tournament_id=tid and event_id=eid
   and setup_event_version_id=b.setup_event_version_id;
 select*into setup_event from app.tournament_setup_event_versions
  where id=b.setup_event_version_id and tournament_id=tid
   and event_kind=e.event_type and format_code='standard_singles'and style_code='Standard';
 select*into settings_snapshot from app.event_settings_snapshots_v3
  where id=b.settings_snapshot_id and tournament_id=tid;
 select*into review from app.event_rule_context_reviews_v1
  where id=b.review_id and tournament_id=tid
   and setup_event_version_id=b.setup_event_version_id
   and settings_snapshot_id=b.settings_snapshot_id;
 if activation.id is null or setup_event.id is null or settings_snapshot.id is null
  or review.id is null or review.draft is distinct from b.draft
  or review.context is distinct from b.context
  or not exists(
   select 1 from jsonb_array_elements(settings_snapshot.effective_settings)x
   where x->>'eventClientRowId'=setup_event.client_row_id::text
    and x->>'mode'='configured'and x->'draft'=b.draft
  )then return jsonb_build_object('status','blocked','code','binding_or_settings_changed');
 end if;
 if not app.valid_event_parameters_raw_v3(b.draft)then
  return jsonb_build_object('status','blocked','code','settings_invalid');
 end if;
 current_native:=app.get_native_event_ledger_sources_v1(tid);
 if current_native->>'status'='retry_exact'then return current_native;end if;
 if current_native->>'status'is distinct from'sources_available'
  or current_native->>'tournamentId'is distinct from tid::text then
  return jsonb_build_object('status','blocked','code','native_source_unavailable');
 end if;
 current_facts:=current_native->'facts';
 if current_facts->'existingOptionalAllocationEvidence'is distinct from'false'::jsonb then
  return jsonb_build_object('status','blocked','code','optional_pool_bridge_required');
 end if;
 select*into allocation from app.native_ledger_allocation_revisions_v1
  where tournament_id=tid order by version desc limit 1;
 if allocation.id is null or allocation.source_digest is distinct from current_native->>'sourceDigest'
  or allocation.snapshot->>'kind'is distinct from'event-ledger-snapshot-v1'
  or allocation.snapshot->>'mode'is distinct from'documented_actual'
  or allocation.snapshot->'complete'is distinct from'true'::jsonb
  or allocation.snapshot->>'tournamentId'is distinct from tid::text
  or allocation.snapshot->>'sourceDigest'is distinct from allocation.source_digest
  or not(allocation.snapshot->'eventIds'?eid::text)then
  return jsonb_build_object('status','blocked','code','current_native_allocation_required');
 end if;
 entry_fee:=setup_event.entry_fee_cents;
 if entry_fee is null or entry_fee<0 then
  return jsonb_build_object('status','blocked','code','entry_fee_unavailable');
 end if;
 select count(*)into active_count from app.event_participants p
  where p.tournament_id=tid and p.event_id=eid and p.status in('registered','checked_in');

 -- Preserve each physical source amount while filtering allocation parts to
 -- this operational event. No Q/Side/income source is synthesized.
 select coalesce(jsonb_agg(jsonb_build_object(
  'sourceId',s->>'sourceId','physicalEvidenceId',s->>'physicalEvidenceId',
  'kind',s->>'kind','amountMinor',(s->>'amountMinor')::numeric,
  'state',s->>'state','allocations',filtered.parts
 )order by s->>'sourceId'),'[]'::jsonb)into event_sources
 from jsonb_array_elements(allocation.snapshot->'sources')s
 cross join lateral(
  select coalesce(jsonb_agg(p order by p->>'bucket'),'[]'::jsonb)parts
  from jsonb_array_elements(s->'allocations')p where p->>'eventId'=eid::text
 )filtered
 where jsonb_array_length(filtered.parts)>0;
 event_source_count:=jsonb_array_length(event_sources);
 if event_source_count>10000 then return jsonb_build_object('status','blocked','code','technical_resource_bound');end if;

 history_value:='[]'::jsonb;
 for source_row in select value from jsonb_array_elements(event_sources)order by value->>'sourceId'loop
  source_id:=source_row->>'sourceId';seen_buckets:='{}';
  if coalesce(source_row->>'sourceId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or coalesce(source_row->>'physicalEvidenceId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or source_row->>'physicalEvidenceId'is distinct from source_id
   or source_row->>'state'is distinct from'active'
   or source_row->>'kind'not in('entry_receipt','expense')
   or jsonb_typeof(source_row->'amountMinor')is distinct from'number'
   or(source_row->>'amountMinor')!~'^[1-9][0-9]*$'
   or(source_row->>'amountMinor')::numeric>9007199254740991
   or source_id=any(seen_sources)then
   return jsonb_build_object('status','blocked','code','invalid_allocation_source');
  end if;
  seen_sources:=array_append(seen_sources,source_id);
  for part in select value from jsonb_array_elements(source_row->'allocations')order by value->>'bucket'loop
   if jsonb_typeof(part)is distinct from'object'
    or(select count(*)from jsonb_object_keys(part))<>5
    or not(part?&array['eventId','bucket','poolId','amountMinor','classificationReviewed'])
    or part->>'eventId'is distinct from eid::text
    or part->'poolId'is distinct from'null'::jsonb
    or part->'classificationReviewed'is distinct from'true'::jsonb
    or part->>'bucket'not in('regular_entry','player_benefit','operating_expense')
    or jsonb_typeof(part->'amountMinor')is distinct from'number'
    or(part->>'amountMinor')!~'^[1-9][0-9]*$'
    or(part->>'amountMinor')::numeric>9007199254740991
    or(source_row->>'kind'='entry_receipt'and part->>'bucket'<>'regular_entry')
    or(source_row->>'kind'='expense'and part->>'bucket'='regular_entry')
    or(part->>'bucket')=any(seen_buckets)then
    return jsonb_build_object('status','blocked','code','unsupported_or_unreviewed_allocation');
   end if;
   seen_buckets:=array_append(seen_buckets,part->>'bucket');
   if part->>'bucket'='regular_entry'then
    gross:=gross+(part->>'amountMinor')::numeric;regular_parts:=regular_parts+1;
    if(part->>'amountMinor')::numeric<>entry_fee
     or not exists(select 1 from jsonb_array_elements(current_facts->'receiptEvents')r
      where r->>'sourceId'=source_row->>'sourceId'
       and r->'eligibleEventIds'?eid::text
       and(r->>'amountMinor')::numeric>=(part->>'amountMinor')::numeric)then
     paid_semantics:=false;
    end if;
   else
    if part->>'bucket'='player_benefit'then benefit:=benefit+(part->>'amountMinor')::numeric;
    else expense:=expense+(part->>'amountMinor')::numeric;end if;
    md:=encode(extensions.digest(convert_to(
     'operational-finance-basis-line-v1|'||tid::text||'|'||eid::text||'|'||
     allocation.id::text||'|'||(source_row->>'sourceId')||'|'||(part->>'bucket'),'utf8'
    ),'md5'),'hex');
    line_id:=substring(md,1,8)||'-'||substring(md,9,4)||'-'||substring(md,13,4)||'-'||substring(md,17,4)||'-'||substring(md,21,12);
    if line_id=any(line_ids)then return jsonb_build_object('status','blocked','code','basis_identity_collision');end if;
    line_ids:=array_append(line_ids,line_id);
    line_value:=jsonb_build_object(
     'label',case part->>'bucket'when'player_benefit'then'Allocated Player Benefit'else'Allocated Operating Expense'end,
     'line',jsonb_build_object(
      'recordId',line_id,'lineId',line_id,'priorRecordId',null,
      'source',null,'mode','estimate',
      'category',part->>'bucket','amountMinor',(part->>'amountMinor')::numeric,
      'voided',false,'reason','Recorded allocation basis'
     )
    );
    history_value:=history_value||jsonb_build_array(line_value);
   end if;
  end loop;
 end loop;
 if gross>9007199254740991 or benefit>9007199254740991 or expense>9007199254740991
  or benefit+expense>9007199254740991 then
  return jsonb_build_object('status','blocked','code','unsafe_finance_total');
 end if;
 if paid_semantics then
  select count(distinct r->>'rosterEntryId')into paid_count
  from jsonb_array_elements(current_facts->'receiptEvents')r
  where exists(select 1 from jsonb_array_elements(event_sources)s
   cross join lateral jsonb_array_elements(s->'allocations')p
   where s->>'sourceId'=r->>'sourceId'and p->>'bucket'='regular_entry');
  if paid_count<>regular_parts then paid_semantics:=false;paid_count:=null;end if;
 else paid_count:=null;end if;
 select*into qualification from app.qualification_result_versions
  where tournament_id=tid and event_id=eid order by version desc limit 1;
 if qualification.id is not null then
  if app.qualification_resolution_snapshot_current_v1(qualification.id)is distinct from true
   then return jsonb_build_object('status','blocked','code','qualification_source_changed');end if;
  if qualification.participant_count<1
   or qualification.qualifier_count<>(qualification.participant_count+3)/4 then
   return jsonb_build_object('status','blocked','code','qualification_source_invalid');
  end if;
  qualification_value:=jsonb_build_object(
   'resultVersionId',qualification.id,'version',qualification.version,
   'participantCount',qualification.participant_count,
   'qualifierCount',qualification.qualifier_count
  );
 end if;
 coverage:=jsonb_build_object(
  'additionalIncome','unavailable',
  'optionalPools','isolated_regular_allocation',
  'recordedFundAvailable',false
 );
 raw_capture:=jsonb_build_object(
  'binding',jsonb_build_object('bindingId',b.id,'activationId',b.activation_id,
   'setupEventVersionId',b.setup_event_version_id,
   'settingsSnapshotId',b.settings_snapshot_id,'reviewId',b.review_id),
  'event',jsonb_build_object('tournamentName',t.name,'eventName',e.name,
   'eventKind',e.event_type,'format',e.format,'operationalState',e.operational_state,
  'startLabel',coalesce(to_char(t.planned_start_date,'FMMonth FMDD, YYYY'),'Date unavailable')),
  'settings',jsonb_build_object('draft',b.draft,'context',b.context),
  'allocation',jsonb_build_object('revisionId',allocation.id,'version',allocation.version,
   'sourceDigest',allocation.source_digest,
   'createdAt',to_char(allocation.created_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'eventSources',event_sources),
  'counts',jsonb_build_object('activeParticipants',active_count,
   'paidEligibleEntries',paid_count),
  'qualification',qualification_value,'coverage',coverage
 );
 source_digest:=encode(extensions.digest(convert_to(jsonb_build_array(
  'operational-event-finance-source-v1',tid,eid,raw_capture
 )::text,'utf8'),'sha256'),'hex');
 source_ref:=jsonb_build_object('tournamentId',tid,'eventId',eid,
  'sourceVersion',allocation.version,'sourceDigest',source_digest);
 -- Insert the now-known shared source into every deterministic basis line.
 select coalesce(jsonb_agg(jsonb_set(x.value,'{line,source}',source_ref,true)order by x.n),'[]'::jsonb)
  into history_value from jsonb_array_elements(history_value)with ordinality x(value,n);
 settings_value:=case b.draft->>'payoutMode'
  when'graduated'then jsonb_build_object('method','graduated_all_qualifiers','factor',b.draft->>'incrementFactorText')
  when'top'then jsonb_build_object('method','custom_top_paid','paidPlaces',(b.draft->>'topText')::integer,'factor',b.draft->>'incrementFactorText')
  when'one-in'then jsonb_build_object('method','custom_paid_ratio','ratio',(b.draft->>'oneInText')::integer,'factor',b.draft->>'incrementFactorText')
  else null end;
 if settings_value is null or coalesce(b.draft->>'incrementFactorText','')!~'^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$'
  or(b.draft->>'incrementFactorText')::numeric<1
  or(b.draft->>'incrementFactorText')::numeric>1000 then
  return jsonb_build_object('status','blocked','code','payout_settings_unavailable');
 end if;
 workspace:=jsonb_build_object(
  'complete',true,'source',source_ref,'mode','estimate',
  'tournamentName',t.name,'eventName',e.name,'eventKind',e.event_type,
  'startLabel',coalesce(to_char(t.planned_start_date,'FMMonth FMDD, YYYY'),'Date unavailable'),
  'entryCount',active_count,'paidEntryCount',paid_count,
  'qualifierCount',case when qualification.id is null then null else qualification.qualifier_count end,
  'grossEntryMinor',gross,'history',history_value,'settings',settings_value,
  'payoutSource',jsonb_build_object('tournamentId',tid,'eventId',eid,
   'settingsSnapshotId',b.settings_snapshot_id,'ledgerDigest',source_digest,
   'resultsDigest',source_digest),
  'savedAt',to_char(allocation.created_at at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'overrideHistory','[]'::jsonb
 );
 basis:=jsonb_build_object('kind','operational-finance-estimate-basis-v1',
  'sourceDigest',source_digest,'coverage',coverage,'workspace',workspace);
 basis_digest:=encode(extensions.digest(convert_to(jsonb_build_array(
  'operational-finance-estimate-basis-v1',basis
 )::text,'utf8'),'sha256'),'hex');
 source_value:=jsonb_build_object(
  'status','source_available','kind','operational-event-finance-source-v1',
  'actorId',actor,'tournamentId',tid,'eventId',eid,
  'sourceDigest',source_digest,'raw',raw_capture,'basis',basis,
  'basisDigest',basis_digest,'proposalOnly',true,'moneyMoved',false,
  'finalizationAuthorized',false,'payoutAuthorized',false
 );
 return source_value;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then
  return jsonb_build_object('status','blocked','code','source_shape_invalid');
end$$;

create function app.get_operational_event_finance_source_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();begin
 if a is null then return jsonb_build_object('status','blocked','code','authentication_required');end if;
 return app.operational_event_finance_source_v1(tid,eid,a);
end$$;

-- Structural mirror of the existing V1 editor. It validates the authoritative
-- basis, append-only histories, zero/incomplete forms and whole-band/$5 rules.
-- It intentionally does not duplicate factor-based award calculation.
create function app.valid_operational_event_finance_editor_v1(
 editor jsonb,basis jsonb,prior_editor jsonb default null
)returns boolean
language plpgsql immutable set search_path=''as $$
declare w jsonb;history jsonb;overrides jsonb;r jsonb;line jsonb;old jsonb;
 latest jsonb:='{}'::jsonb;records text[]:='{}';k text;oldcat text;cat text;
 base_count integer;old_count integer;override_latest jsonb:='{}'::jsonb;
 first_place integer;last_place integer;qualifiers integer;award_places integer;fund numeric;gross numeric;
 override_ids text[]:='{}';
 benefit numeric:=0;expense numeric:=0;income numeric:=0;plan jsonb;plan_history jsonb;
 plan_latest jsonb:='{}'::jsonb;plan_benefit numeric:=0;plan_expense numeric:=0;
 plan_income numeric:=0;plan_fund numeric;override_total numeric:=0;
begin
 if jsonb_typeof(editor)is distinct from'object'
  or(select count(*)from jsonb_object_keys(editor))<>8
  or not(editor?&array['basis','history','overrideHistory','overrideInput','overridePlan','lineForm','bandForm','message'])
  or editor->'basis'is distinct from basis->'workspace'
  or jsonb_typeof(editor->'history')is distinct from'array'
  or jsonb_typeof(editor->'overrideHistory')is distinct from'array'
  or jsonb_typeof(editor->'message')is distinct from'string'
  or app.event_settings_js_text_length_v3(editor->>'message')>4000
  or jsonb_array_length(editor->'history')>10000
  or jsonb_array_length(editor->'overrideHistory')>10000
  or octet_length(editor::text)>4000000 then return false;end if;
 w:=basis->'workspace';history:=editor->'history';overrides:=editor->'overrideHistory';
 if jsonb_typeof(w)is distinct from'object'
  or jsonb_typeof(w->'mode')is distinct from'string'
  or w->>'mode'is distinct from'estimate'
  or w->'complete'is distinct from'true'::jsonb
  or jsonb_typeof(w->'history')is distinct from'array'
  or jsonb_typeof(w->'overrideHistory')is distinct from'array'
  or jsonb_array_length(w->'overrideHistory')<>0 then return false;end if;
 base_count:=jsonb_array_length(w->'history');
 if jsonb_array_length(history)<base_count
  or exists(select 1 from jsonb_array_elements(w->'history')with ordinality x(value,n)
   where value is distinct from history->((n-1)::integer))then return false;end if;
 if prior_editor is not null then
  if jsonb_typeof(prior_editor)is distinct from'object'or prior_editor->'basis'is distinct from w then return false;end if;
  old_count:=jsonb_array_length(prior_editor->'history');
  if jsonb_array_length(history)<old_count
   or exists(select 1 from jsonb_array_elements(prior_editor->'history')with ordinality x(value,n)
    where value is distinct from history->((n-1)::integer))then return false;end if;
  old_count:=jsonb_array_length(prior_editor->'overrideHistory');
  if jsonb_array_length(overrides)<old_count
   or exists(select 1 from jsonb_array_elements(prior_editor->'overrideHistory')with ordinality x(value,n)
    where value is distinct from overrides->((n-1)::integer))then return false;end if;
 end if;
 for r in select value from jsonb_array_elements(history)loop
  if jsonb_typeof(r)is distinct from'object'or(select count(*)from jsonb_object_keys(r))<>2
   or not(r?&array['label','line'])or jsonb_typeof(r->'label')is distinct from'string'
   or r->>'label'<>app.custom_payout_classification_text_v2(r->>'label')
   or app.event_settings_js_text_length_v3(r->>'label')not between 1 and 200 then return false;end if;
  line:=r->'line';
  if jsonb_typeof(line)is distinct from'object'or(select count(*)from jsonb_object_keys(line))<>9
   or not(line?&array['recordId','lineId','priorRecordId','source','mode','category','amountMinor','voided','reason'])
   or coalesce(line->>'recordId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or coalesce(line->>'lineId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or not(line->'priorRecordId'='null'::jsonb or(jsonb_typeof(line->'priorRecordId')='string'and line->>'priorRecordId'~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
    or line->'source'is distinct from w->'source'
    or jsonb_typeof(line->'mode')is distinct from'string'
    or line->>'mode'is distinct from'estimate'
    or jsonb_typeof(line->'category')is distinct from'string'
    or coalesce(line->>'category','')not in('player_benefit','operating_expense','unrestricted_income')
   or jsonb_typeof(line->'amountMinor')is distinct from'number'
   or(line->>'amountMinor')!~'^(0|[1-9][0-9]*)$'
   or(line->>'amountMinor')::numeric>9007199254740991
   or jsonb_typeof(line->'voided')is distinct from'boolean'
   or jsonb_typeof(line->'reason')is distinct from'string'
   or length(app.custom_payout_classification_text_v2(line->>'reason'))=0
    or line->>'reason'is distinct from app.custom_payout_classification_text_v2(line->>'reason')
   or app.event_settings_js_text_length_v3(line->>'reason')>2000 then return false;end if;
  k:=line->>'lineId';old:=latest->k;cat:=line->>'category';
  if line->>'recordId'=any(records)
   or(old is null and line->'priorRecordId'<>'null'::jsonb)
   or(old is not null and line->'priorRecordId'is distinct from old->'recordId')
   or((old is not null or(line->>'voided')::boolean)
      and length(app.custom_payout_classification_text_v2(line->>'reason'))=0)
   or((line->>'voided')::boolean and(line->>'amountMinor')::numeric<>0)then return false;end if;
  if old is not null then oldcat:=old->>'category';if oldcat<>cat then return false;end if;end if;
  records:=array_append(records,line->>'recordId');latest:=jsonb_set(latest,array[k],line,true);
 end loop;
 for line in select value from jsonb_each(latest)loop
  if not(line->>'voided')::boolean then
   if line->>'category'='player_benefit'then benefit:=benefit+(line->>'amountMinor')::numeric;
   elsif line->>'category'='operating_expense'then expense:=expense+(line->>'amountMinor')::numeric;
   else income:=income+(line->>'amountMinor')::numeric;end if;
  end if;
 end loop;
 gross:=(w->>'grossEntryMinor')::numeric;fund:=gross-benefit-expense+income;
 if gross<0 or fund<0 or greatest(benefit,expense,income,fund)>9007199254740991 then return false;end if;
 qualifiers:=case when w->'qualifierCount'='null'::jsonb then null else(w->>'qualifierCount')::integer end;
 award_places:=case when qualifiers is null then null
  when w#>>'{settings,method}'='custom_top_paid'then least(qualifiers,(w#>>'{settings,paidPlaces}')::integer)
  else qualifiers end;

 -- Incomplete forms are retained as strings, but their object/identity shape is exact.
 if editor->'lineForm'<>'null'::jsonb then
  line:=editor->'lineForm';
  if jsonb_typeof(line)is distinct from'object'or(select count(*)from jsonb_object_keys(line))<>5
   or not(line?&array['category','lineId','label','amount','reason'])
    or jsonb_typeof(line->'category')is distinct from'string'
    or coalesce(line->>'category','')not in('player_benefit','operating_expense','unrestricted_income')
   or not(line->'lineId'='null'::jsonb or(jsonb_typeof(line->'lineId')='string'and line->>'lineId'~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
   or jsonb_typeof(line->'label')is distinct from'string'or app.event_settings_js_text_length_v3(line->>'label')>200
   or jsonb_typeof(line->'amount')is distinct from'string'or app.event_settings_js_text_length_v3(line->>'amount')>20
    or jsonb_typeof(line->'reason')is distinct from'string'or app.event_settings_js_text_length_v3(line->>'reason')>2000 then return false;end if;
   if line->'lineId'<>'null'::jsonb then
    old:=latest->(line->>'lineId');
    if old is null or(old->>'voided')::boolean
     or old->>'category'is distinct from line->>'category'
     or coalesce(old->>'category','')not in('player_benefit','operating_expense','unrestricted_income')then return false;end if;
   end if;
 end if;
 if editor->'bandForm'<>'null'::jsonb then
  line:=editor->'bandForm';
  if jsonb_typeof(line)is distinct from'object'or(select count(*)from jsonb_object_keys(line))<>4
   or not(line?&array['firstPlace','lastPlace','amount','reason'])
   or jsonb_typeof(line->'firstPlace')is distinct from'number'or(line->>'firstPlace')!~'^(0|[1-9][0-9]*)$'
   or jsonb_typeof(line->'lastPlace')is distinct from'number'or(line->>'lastPlace')!~'^(0|[1-9][0-9]*)$'
   or jsonb_typeof(line->'amount')is distinct from'string'or app.event_settings_js_text_length_v3(line->>'amount')>20
    or jsonb_typeof(line->'reason')is distinct from'string'or app.event_settings_js_text_length_v3(line->>'reason')>2000
    or qualifiers is null or qualifiers<1
    or(line->>'firstPlace')::integer<1
    or(line->>'lastPlace')::integer<(line->>'firstPlace')::integer
    or(line->>'lastPlace')::integer>award_places
    or not((line->>'firstPlace')::integer=1 and(line->>'lastPlace')::integer=1)
      and not((line->>'firstPlace')::integer=2 and(line->>'lastPlace')::integer=2)
      and not((line->>'firstPlace')::integer>=3
       and(line->>'firstPlace')::integer=(case when(line->>'firstPlace')::integer=3 then 3 else(((line->>'firstPlace')::integer+1)/2)*2-1 end)
       and(((line->>'firstPlace')::integer-1)&((line->>'firstPlace')::integer-2))=0
       and(line->>'lastPlace')::integer=least(award_places,((line->>'firstPlace')::integer-1)*2))then return false;end if;
 end if;
 if jsonb_array_length(overrides)=0 then
  if editor->'overrideInput'<>'null'::jsonb or editor->'overridePlan'<>'null'::jsonb then return false;end if;
 else
  if qualifiers is null or qualifiers<1 or w#>>'{settings,method}'='custom_paid_ratio'then return false;end if;
   if jsonb_typeof(editor->'overrideInput')is distinct from'object'
   or(select count(*)from jsonb_object_keys(editor->'overrideInput'))<>3
   or editor#>'{overrideInput,qualifierCount}'is distinct from to_jsonb(qualifiers)
   or editor#>'{overrideInput,settings}'is distinct from w->'settings'
   or jsonb_typeof(editor->'overridePlan')is distinct from'string'
   or app.event_settings_js_text_length_v3(editor->>'overridePlan')>4000000 then return false;end if;
  begin plan:=(editor->>'overridePlan')::jsonb;exception when others then return false;end;
   if jsonb_typeof(plan)is distinct from'object'or(select count(*)from jsonb_object_keys(plan))<>2
    or plan->'basis'is distinct from w or jsonb_typeof(plan->'history')is distinct from'array'
    or jsonb_array_length(plan->'history')>jsonb_array_length(history)
    or exists(select 1 from jsonb_array_elements(plan->'history')with ordinality x(value,n)
     where value is distinct from history->((n-1)::integer))then return false;end if;
   plan_history:=plan->'history';
   if not app.valid_operational_event_finance_editor_v1(jsonb_build_object(
    'basis',w,'history',plan_history,'overrideHistory','[]'::jsonb,
    'overrideInput',null,'overridePlan',null,'lineForm',null,'bandForm',null,'message',''
   ),basis,null)then return false;end if;
   for r in select value from jsonb_array_elements(plan_history)loop
    line:=r->'line';plan_latest:=jsonb_set(plan_latest,array[line->>'lineId'],line,true);
   end loop;
   for line in select value from jsonb_each(plan_latest)loop
    if not(line->>'voided')::boolean then
     if line->>'category'='player_benefit'then plan_benefit:=plan_benefit+(line->>'amountMinor')::numeric;
     elsif line->>'category'='operating_expense'then plan_expense:=plan_expense+(line->>'amountMinor')::numeric;
     else plan_income:=plan_income+(line->>'amountMinor')::numeric;end if;
    end if;
   end loop;
   plan_fund:=gross-plan_benefit-plan_expense+plan_income;
   if plan_fund<0 or plan_fund>9007199254740991
    or editor#>'{overrideInput,fundMinor}'is distinct from to_jsonb(plan_fund)then return false;end if;
 end if;
 for r in select value from jsonb_array_elements(overrides)loop
  if jsonb_typeof(r)is distinct from'object'or(select count(*)from jsonb_object_keys(r))<>7
   or not(r?&array['recordId','firstPlace','lastPlace','priorRecordId','perPersonMinor','voided','reason'])
   or coalesce(r->>'recordId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or jsonb_typeof(r->'firstPlace')is distinct from'number'or(r->>'firstPlace')!~'^[1-9][0-9]*$'
   or jsonb_typeof(r->'lastPlace')is distinct from'number'or(r->>'lastPlace')!~'^[1-9][0-9]*$'
   or(r->>'firstPlace')::numeric>2147483647 or(r->>'lastPlace')::numeric>2147483647
   or(r->>'firstPlace')::integer>(r->>'lastPlace')::integer
   or(r->>'lastPlace')::integer>award_places
   or not(r->'priorRecordId'='null'::jsonb or(jsonb_typeof(r->'priorRecordId')='string'and r->>'priorRecordId'~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
   or jsonb_typeof(r->'perPersonMinor')is distinct from'number'or(r->>'perPersonMinor')!~'^(0|[1-9][0-9]*)$'
   or(r->>'perPersonMinor')::numeric>9007199254740991
   or(r->>'perPersonMinor')::numeric%500<>0
   or jsonb_typeof(r->'voided')is distinct from'boolean'
   or jsonb_typeof(r->'reason')is distinct from'string'
   or length(app.custom_payout_classification_text_v2(r->>'reason'))=0
    or r->>'reason'is distinct from app.custom_payout_classification_text_v2(r->>'reason')
   or app.event_settings_js_text_length_v3(r->>'reason')>2000
   or r->>'recordId'=any(override_ids)then return false;end if;
  override_ids:=array_append(override_ids,r->>'recordId');
  first_place:=(r->>'firstPlace')::integer;last_place:=(r->>'lastPlace')::integer;k:=first_place||':'||last_place;
  -- Exact complete geometric cohort: 1, 2, 3-4, 5-8, ... truncated at qualifier count.
  if not(first_place=1 and last_place=1)
   and not(first_place=2 and last_place=2)
   and not(first_place>=3 and first_place=(case when first_place=3 then 3 else((first_place+1)/2)*2-1 end)
   and((first_place-1)&(first_place-2))=0
   and last_place=least(award_places,(first_place-1)*2))then return false;end if;
  old:=override_latest->k;
  if old is null and(r->'priorRecordId'<>'null'::jsonb or(r->>'voided')::boolean)then return false;end if;
  if old is not null and r->'priorRecordId'is distinct from old->'recordId'then return false;end if;
  override_latest:=jsonb_set(override_latest,array[k],r,true);
 end loop;
  for r in select value from jsonb_each(override_latest)loop
   if not(r->>'voided')::boolean then
    override_total:=override_total+((r->>'lastPlace')::integer-(r->>'firstPlace')::integer+1)*(r->>'perPersonMinor')::numeric;
   end if;
  end loop;
  if override_total>coalesce(plan_fund,fund)then return false;end if;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range or division_by_zero then return false;
end$$;

create function app.finish_operational_event_finance_operation_v1(
 actor uuid,tid uuid,eid uuid,op uuid,result_value jsonb
)returns jsonb
language plpgsql security definer set search_path=''as $$
declare operation app.operational_event_finance_operations_v1%rowtype;result jsonb;begin
 select*into strict operation from app.operational_event_finance_operations_v1
  where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;
 if result_value->>'status'not in('accepted','rejected')then raise exception'invalid_operational_finance_outcome';end if;
 result:=result_value||jsonb_build_object(
  'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,
  'request',operation.request_payload,'fullRequestHash',operation.request_hash,
  'proposalOnly',true,'moneyMoved',false,'finalizationAuthorized',false,
  'payoutAuthorized',false
 );
 insert into app.operational_event_finance_outcomes_v1(
  actor_id,operation_id,tournament_id,event_id,result
 )values(actor,op,tid,eid,result);
 return result;
end$$;

create function app.save_operational_event_finance_proposal_v1(
 tid uuid,eid uuid,request_value jsonb
)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;request_hash text;
 prior app.operational_event_finance_operations_v1%rowtype;
 prior_result jsonb;head app.operational_event_finance_revisions_v1%rowtype;
 source_value jsonb;raw jsonb;basis jsonb;response jsonb;revision_id uuid;
 expected integer;reason_value text;qualification_id uuid;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(request_value)is distinct from'object'
  or(select count(*)from jsonb_object_keys(request_value))<>7
  or not(request_value?&array['kind','operationId','expectedVersion','expectedSourceDigest','expectedBasisDigest','editor','reason'])
   or jsonb_typeof(request_value->'kind')is distinct from'string'
   or request_value->>'kind'is distinct from'operational-event-finance-proposal-v1'
   or jsonb_typeof(request_value->'operationId')is distinct from'string'
   or coalesce(request_value->>'operationId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or jsonb_typeof(request_value->'expectedVersion')is distinct from'number'
  or(request_value->>'expectedVersion')!~'^(0|[1-9][0-9]*)$'
   or(request_value->>'expectedVersion')::numeric>2147483646
  or coalesce(request_value->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'
  or coalesce(request_value->>'expectedBasisDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request_value->'editor')is distinct from'object'
  or jsonb_typeof(request_value->'reason')is distinct from'string'
  or request_value->>'reason'<>app.custom_payout_classification_text_v2(request_value->>'reason')
  or app.event_settings_js_text_length_v3(request_value->>'reason')not between 1 and 2000
  or octet_length(request_value::text)>4100000 then
  return jsonb_build_object('status','rejected','code','invalid_request');
 end if;
 op:=(request_value->>'operationId')::uuid;expected:=(request_value->>'expectedVersion')::integer;
 reason_value:=request_value->>'reason';
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 request_hash:=encode(extensions.digest(convert_to(jsonb_build_array(
  'operational-event-finance-proposal-v1',a,tid,eid,op,request_value
 )::text,'utf8'),'sha256'),'hex');
 select*into prior from app.operational_event_finance_operations_v1 where actor_id=a and operation_id=op;
 if found then
  if prior.tournament_id is distinct from tid or prior.event_id is distinct from eid
   or prior.request_hash is distinct from request_hash or prior.request_payload is distinct from request_value then
   return jsonb_build_object('status','rejected','code','idempotency_conflict');
  end if;
  select result into prior_result from app.operational_event_finance_outcomes_v1
   where actor_id=a and operation_id=op and tournament_id=tid and event_id=eid;
  if prior_result is null then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
  return prior_result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 if app.operational_event_finance_proposals_enabled_v1()is distinct from true then
  return jsonb_build_object('status','rejected','code','feature_unavailable','proposalOnly',true,'moneyMoved',false,'finalizationAuthorized',false,'payoutAuthorized',false);
 end if;
 source_value:=app.operational_event_finance_source_v1(tid,eid,a);
 if source_value->>'status'='retry_exact'then return source_value;end if;
 if source_value->>'status'<>'source_available'then
  return jsonb_build_object('status','rejected','code',coalesce(source_value->>'code','source_unavailable'));
 end if;
 insert into app.operational_event_finance_operations_v1(
  actor_id,operation_id,tournament_id,event_id,request_payload,request_hash
 )values(a,op,tid,eid,request_value,request_hash);
 if source_value->>'sourceDigest'is distinct from request_value->>'expectedSourceDigest'
  or source_value->>'basisDigest'is distinct from request_value->>'expectedBasisDigest'then
  return app.finish_operational_event_finance_operation_v1(a,tid,eid,op,
   jsonb_build_object('status','rejected','code','source_changed'));
 end if;
 basis:=source_value->'basis';raw:=source_value->'raw';
 select*into head from app.operational_event_finance_revisions_v1
  where tournament_id=tid and event_id=eid order by version desc limit 1;
 if coalesce(head.version,0)<>expected then
  return app.finish_operational_event_finance_operation_v1(a,tid,eid,op,
   jsonb_build_object('status','rejected','code','stale_version'));
 end if;
 if head.id is not null and(head.source_digest is distinct from source_value->>'sourceDigest'
  or head.basis_digest is distinct from source_value->>'basisDigest')then
  return app.finish_operational_event_finance_operation_v1(a,tid,eid,op,
   jsonb_build_object('status','rejected','code','source_revision_changed_requires_review'));
 end if;
 if not app.valid_operational_event_finance_editor_v1(
  request_value->'editor',basis,head.editor
 )then
  return app.finish_operational_event_finance_operation_v1(a,tid,eid,op,
   jsonb_build_object('status','rejected','code','invalid_editor'));
 end if;
 qualification_id:=case when raw->'qualification'='null'::jsonb then null
  else(raw#>>'{qualification,resultVersionId}')::uuid end;
 insert into app.operational_event_finance_revisions_v1(
  tournament_id,event_id,version,prior_revision_id,actor_id,operation_id,
  binding_id,activation_id,setup_event_version_id,settings_snapshot_id,
  context_review_id,native_allocation_revision_id,qualification_result_version_id,
  source_digest,basis_digest,source_capture,basis,editor,reason
 )values(
  tid,eid,expected+1,head.id,a,op,
  (raw#>>'{binding,bindingId}')::uuid,(raw#>>'{binding,activationId}')::uuid,
  (raw#>>'{binding,setupEventVersionId}')::uuid,(raw#>>'{binding,settingsSnapshotId}')::uuid,
  (raw#>>'{binding,reviewId}')::uuid,(raw#>>'{allocation,revisionId}')::uuid,
  qualification_id,source_value->>'sourceDigest',source_value->>'basisDigest',
  raw,basis,request_value->'editor',reason_value
 )returning id into revision_id;
 response:=jsonb_build_object('status','accepted','code','operational_finance_proposal_saved',
  'revisionId',revision_id,'version',expected+1,'sourceDigest',source_value->>'sourceDigest',
  'basisDigest',source_value->>'basisDigest','historicalReceipt',false,
  'currentSourceVerified',true);
 return app.finish_operational_event_finance_operation_v1(a,tid,eid,op,response);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then
  return jsonb_build_object('status','rejected','code','invalid_request');
end$$;

create function app.reconcile_operational_event_finance_proposal_v1(
 tid uuid,eid uuid,op uuid
)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();operation app.operational_event_finance_operations_v1%rowtype;result jsonb;begin
 if a is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then
  return jsonb_build_object('status','retry_exact','code','operation_busy');
 end if;
 select*into operation from app.operational_event_finance_operations_v1
  where actor_id=a and operation_id=op and tournament_id=tid and event_id=eid;
 if not found then return jsonb_build_object('status','unknown','actorId',a,'tournamentId',tid,'eventId',eid,'operationId',op);end if;
 select o.result into result from app.operational_event_finance_outcomes_v1 o
  where o.actor_id=a and o.operation_id=op and o.tournament_id=tid and o.event_id=eid;
 if result is null then return jsonb_build_object('status','retry_exact','code','operation_incomplete');end if;
 return result||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
exception when lock_not_available then return null;
end$$;

alter function app.operational_event_finance_proposals_enabled_v1()owner to postgres;
alter function app.lock_operational_event_finance_sources_v1()owner to postgres;
alter function app.operational_event_finance_source_v1(uuid,uuid,uuid)owner to postgres;
alter function app.get_operational_event_finance_source_v1(uuid,uuid)owner to postgres;
alter function app.valid_operational_event_finance_editor_v1(jsonb,jsonb,jsonb)owner to postgres;
alter function app.finish_operational_event_finance_operation_v1(uuid,uuid,uuid,uuid,jsonb)owner to postgres;
alter function app.save_operational_event_finance_proposal_v1(uuid,uuid,jsonb)owner to postgres;
alter function app.reconcile_operational_event_finance_proposal_v1(uuid,uuid,uuid)owner to postgres;

revoke all on function app.operational_event_finance_proposals_enabled_v1(),
 app.lock_operational_event_finance_sources_v1(),
 app.operational_event_finance_source_v1(uuid,uuid,uuid),
 app.get_operational_event_finance_source_v1(uuid,uuid),
 app.valid_operational_event_finance_editor_v1(jsonb,jsonb,jsonb),
 app.finish_operational_event_finance_operation_v1(uuid,uuid,uuid,uuid,jsonb),
 app.save_operational_event_finance_proposal_v1(uuid,uuid,jsonb),
 app.reconcile_operational_event_finance_proposal_v1(uuid,uuid,uuid)
 from public,anon,authenticated,service_role;
commit;
