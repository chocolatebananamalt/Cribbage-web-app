-- UNEXECUTED PRIVATE DRAFT STORAGE ONLY. Requires event-settings-transaction-v3.
-- setupEventVersionId/source.eventId mean setup event VERSION, not operational
-- event identity. Strict typed history is stored, NOT approved fund/ledger truth.
-- Pure TS calculation remains separate; no payments, activation or settlement.
begin;
create table app.event_regular_finance_reservations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null references app.tournaments(id),
 request_payload jsonb not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('event-regular-finance-draft-v1',actor_id,tournament_id,operation_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
create table app.event_regular_finance_revisions_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,setup_revision_id uuid not null,setup_event_version_id uuid not null,
 settings_snapshot_id uuid not null references app.event_settings_snapshots_v3(id),version integer not null check(version>0),prior_revision_id uuid,
 actor_id uuid not null,operation_id uuid not null,proposal jsonb not null,reason text not null check(length(app.custom_payout_classification_text_v2(reason))>0 and app.event_settings_js_text_length_v3(reason)<=2000),created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,setup_event_version_id,version),unique(id,tournament_id,setup_event_version_id),
 foreign key(actor_id,operation_id,tournament_id)references app.event_regular_finance_reservations_v1(actor_id,operation_id,tournament_id),
 foreign key(setup_event_version_id,tournament_id,setup_revision_id)references app.tournament_setup_event_versions(id,tournament_id,setup_revision_id),
 foreign key(prior_revision_id,tournament_id,setup_event_version_id)references app.event_regular_finance_revisions_v1(id,tournament_id,setup_event_version_id)
);
create table app.event_regular_finance_outcomes_v1(
 actor_id uuid not null,operation_id uuid not null,response_payload jsonb not null,
 primary key(actor_id,operation_id),foreign key(actor_id,operation_id)references app.event_regular_finance_reservations_v1(actor_id,operation_id)
);
do $$declare n text;begin foreach n in array array['event_regular_finance_reservations_v1','event_regular_finance_revisions_v1','event_regular_finance_outcomes_v1']loop
 execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;

create function app.valid_event_regular_finance_draft_v1(v jsonb,s jsonb)returns boolean
language plpgsql immutable set search_path=''as $$
declare g jsonb;l jsonb;old jsonb;latest jsonb:='{}';ids text[]:=array[]::text[];k text;cat text;oldcat text;
begin
 if jsonb_typeof(v)is distinct from'object'or not(v?&array['source','mode','grossEntry','history'])or exists(select 1 from jsonb_object_keys(v)x where x<>all(array['source','mode','grossEntry','history']))
 or v->'source'is distinct from s or jsonb_typeof(v->'mode')is distinct from'string'or coalesce(v->>'mode','')not in('estimate','documented_actual','simulation')or jsonb_typeof(v->'history')is distinct from'array'then return false;end if;
 if jsonb_array_length(v->'history')>10000 then return false;end if; -- processing bound, not business category limit
 g:=v->'grossEntry';
 if jsonb_typeof(g)is distinct from'object'or not(g?&array['source','mode','amountMinor'])or exists(select 1 from jsonb_object_keys(g)x where x<>all(array['source','mode','amountMinor']))or g->'source'is distinct from s or g->'mode'is distinct from v->'mode'
 or jsonb_typeof(g->'amountMinor')is distinct from'number'or coalesce(g->>'amountMinor','')!~'^(0|[1-9][0-9]*)$'or(g->>'amountMinor')::numeric>9007199254740991 then return false;end if;
 for l in select value from jsonb_array_elements(v->'history')loop
  if jsonb_typeof(l)is distinct from'object'or not(l?&array['recordId','lineId','priorRecordId','source','mode','category','amountMinor','voided','reason'])or exists(select 1 from jsonb_object_keys(l)x where x<>all(array['recordId','lineId','priorRecordId','source','mode','category','amountMinor','voided','reason']))
  or jsonb_typeof(l->'recordId')is distinct from'string'or coalesce(l->>'recordId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'or jsonb_typeof(l->'lineId')is distinct from'string'or coalesce(l->>'lineId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or not(l->'priorRecordId'='null'::jsonb or(jsonb_typeof(l->'priorRecordId')='string'and l->>'priorRecordId'~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
  or l->'source'is distinct from s or l->'mode'is distinct from v->'mode'or jsonb_typeof(l->'category')is distinct from'string'or coalesce(l->>'category','')not in('player_benefit','operating_expense','unrestricted_income','restricted_income','unclassified_income','q_pool_fund','side_pool_fund')
  or jsonb_typeof(l->'amountMinor')is distinct from'number'or coalesce(l->>'amountMinor','')!~'^(0|[1-9][0-9]*)$'or(l->>'amountMinor')::numeric>9007199254740991
  or jsonb_typeof(l->'voided')is distinct from'boolean'or jsonb_typeof(l->'reason')is distinct from'string'or app.event_settings_js_text_length_v3(l->>'reason')>2000 then return false;end if;
  k:=l->>'lineId';old:=latest->k;cat:=case l->>'category'when'q_pool_fund'then'q'when'side_pool_fund'then'side'else'regular'end;
  if l->>'recordId'=any(ids)or(old is null and l->'priorRecordId'<>'null'::jsonb)or(old is not null and l->'priorRecordId'is distinct from old->'recordId')or((old is not null or(l->>'voided')::boolean)and length(app.custom_payout_classification_text_v2(l->>'reason'))=0)or((l->>'voided')::boolean and(l->>'amountMinor')::numeric<>0)then return false;end if;
  if old is not null then oldcat:=case old->>'category'when'q_pool_fund'then'q'when'side_pool_fund'then'side'else'regular'end;if oldcat<>cat then return false;end if;end if;
  ids:=array_append(ids,l->>'recordId');latest:=jsonb_set(latest,array[k],l,true);
 end loop;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end$$;

create function app.get_event_regular_finance_base_v1(p_tournament_id uuid,p_setup_event_version_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();e app.tournament_setup_event_versions%rowtype;s app.event_settings_snapshots_v3%rowtype;r app.tournament_setup_revisions%rowtype;h text;v integer;
begin
 if a is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=p_tournament_id for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=a and role in('director','co_director')order by role for key share nowait;if not found then return null;end if;
 select*into r from app.tournament_setup_revisions where tournament_id=p_tournament_id order by version desc limit 1;
 select*into e from app.tournament_setup_event_versions where id=p_setup_event_version_id and tournament_id=p_tournament_id and setup_revision_id=r.id and event_kind in('main','consolation');
 select*into s from app.event_settings_snapshots_v3 where tournament_id=p_tournament_id and setup_revision_id=r.id;
 if e.id is null or s.id is null or not exists(select 1 from jsonb_array_elements(s.effective_settings)x where x->>'eventClientRowId'=e.client_row_id::text and x->>'mode'='configured')then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-regular-finance-base-v1',p_tournament_id,to_jsonb(e),s.id,s.effective_settings)::text,'utf8'),'sha256'),'hex');
 select coalesce(max(version),0)into v from app.event_regular_finance_revisions_v1 where tournament_id=p_tournament_id and setup_event_version_id=e.id;
 return jsonb_build_object('capability',false,'settingsSnapshotId',s.id,'setupEventVersionId',e.id,'expectedVersion',v,'source',jsonb_build_object('tournamentId',p_tournament_id,'eventId',e.id,'sourceVersion',r.version,'sourceDigest',h));
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.save_event_regular_finance_draft_v1(p_tournament_id uuid,v jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;h text;prior app.event_regular_finance_reservations_v1%rowtype;old app.event_regular_finance_revisions_v1%rowtype;base jsonb;response jsonb;rid uuid;expected integer;p jsonb;n integer;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if jsonb_typeof(v)is distinct from'object'or jsonb_typeof(v->'operationId')is distinct from'string'or coalesce(v->>'operationId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(v->>'operationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=p_tournament_id for update nowait;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=a and role in('director','co_director')order by role for key share nowait;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-regular-finance-draft-v1',a,p_tournament_id,op,v)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.event_regular_finance_reservations_v1 where actor_id=a and operation_id=op;
 if found then
  if prior.tournament_id is distinct from p_tournament_id or prior.request_hash is distinct from h or prior.request_payload is distinct from v then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select response_payload into response from app.event_regular_finance_outcomes_v1 where actor_id=a and operation_id=op;if response is null then raise exception'finance reservation missing outcome';end if;return response;
 end if;
 if exists(select 1 from app.operation_receipts where actor_profile_id=a and client_operation_id=op)or exists(select 1 from app.event_settings_save_reservations_v3 where actor_id=a and operation_id=op)or exists(select 1 from app.setup_custom_q_save_reservations_v2 where actor_id=a and operation_id=op)or exists(select 1 from app.setup_event_link_save_reservations_v1 where actor_id=a and operation_id=op)then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 insert into app.event_regular_finance_reservations_v1(actor_id,operation_id,tournament_id,request_payload,request_hash)values(a,op,p_tournament_id,v,h);
 begin
  if not(v?&array['kind','operationId','expectedVersion','settingsSnapshotId','setupEventVersionId','proposal','reason'])or exists(select 1 from jsonb_object_keys(v)x where x<>all(array['kind','operationId','expectedVersion','settingsSnapshotId','setupEventVersionId','proposal','reason']))or v->>'kind'is distinct from'event-regular-finance-draft-v1'
  or jsonb_typeof(v->'expectedVersion')is distinct from'number'or coalesce(v->>'expectedVersion','')!~'^(0|[1-9][0-9]*)$'or jsonb_typeof(v->'reason')is distinct from'string'or length(app.custom_payout_classification_text_v2(v->>'reason'))=0 or app.event_settings_js_text_length_v3(v->>'reason')>2000
  or coalesce(v->>'settingsSnapshotId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'or coalesce(v->>'setupEventVersionId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then raise exception'finance_rejected:invalid_request';end if;
  expected:=(v->>'expectedVersion')::integer;base:=app.get_event_regular_finance_base_v1(p_tournament_id,(v->>'setupEventVersionId')::uuid);
  if base->>'status'='retry_exact'then raise exception using errcode='55P03',message='finance source busy';end if;
  if base is null or base->'settingsSnapshotId'is distinct from v->'settingsSnapshotId'then raise exception'finance_rejected:source_changed';end if;
  if(base->>'expectedVersion')::integer<>expected then raise exception'finance_rejected:stale_version';end if;
  p:=v->'proposal';if not app.valid_event_regular_finance_draft_v1(p,base->'source')then raise exception'finance_rejected:invalid_proposal';end if;
  select*into old from app.event_regular_finance_revisions_v1 where tournament_id=p_tournament_id and setup_event_version_id=(v->>'setupEventVersionId')::uuid order by version desc limit 1;
  if old.id is not null then
   if old.proposal->'mode'is distinct from p->'mode'or old.proposal->'grossEntry'is distinct from p->'grossEntry'then raise exception'finance_rejected:mode_or_gross_change_requires_new_source';end if;
   n:=jsonb_array_length(old.proposal->'history');if jsonb_array_length(p->'history')<n or exists(select 1 from jsonb_array_elements(old.proposal->'history')with ordinality x(value,ordinality)where value is distinct from(p->'history')->((ordinality-1)::integer))then raise exception'finance_rejected:history_not_append_only';end if;
  end if;
  insert into app.event_regular_finance_revisions_v1(tournament_id,setup_revision_id,setup_event_version_id,settings_snapshot_id,version,prior_revision_id,actor_id,operation_id,proposal,reason)
  select p_tournament_id,e.setup_revision_id,e.id,(v->>'settingsSnapshotId')::uuid,expected+1,old.id,a,op,p,v->>'reason'from app.tournament_setup_event_versions e where e.id=(v->>'setupEventVersionId')::uuid and e.tournament_id=p_tournament_id returning id into rid;
  if rid is null then raise exception'finance_rejected:source_changed';end if;
  response:=jsonb_build_object('status','event_regular_finance_draft_saved','revisionId',rid,'version',expected+1,'envelope',v,'fullRequestHash',h,'validationOnlyDraft',true,'modelCalculationApproved',false,'moneyMoved',false,'finalizationAuthorized',false);
 exception when raise_exception then if sqlerrm not like'finance_rejected:%'then raise;end if;response:=jsonb_build_object('status','rejected','code',split_part(sqlerrm,':',2));
 when invalid_text_representation or numeric_value_out_of_range then response:=jsonb_build_object('status','rejected','code','invalid_request');end;
 insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(a,p_tournament_id,'save_event_regular_finance_draft_v1',p_tournament_id,h,op,case when response->>'status'='rejected'then'rejected'else'accepted'end,response,clock_timestamp());
 insert into app.event_regular_finance_outcomes_v1(actor_id,operation_id,response_payload)values(a,op,response);return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.reconcile_event_regular_finance_draft_v1(p_tournament_id uuid,v jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;h text;r app.event_regular_finance_reservations_v1%rowtype;response jsonb;
begin
 if a is null or current_setting('transaction_isolation')<>'read committed'or jsonb_typeof(v)is distinct from'object'or coalesce(v->>'operationId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then return null;end if;
 perform 1 from app.tournaments where id=p_tournament_id for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=a and role in('director','co_director')order by role for key share nowait;if not found then return null;end if;
 op:=(v->>'operationId')::uuid;h:=encode(extensions.digest(convert_to(jsonb_build_array('event-regular-finance-draft-v1',a,p_tournament_id,op,v)::text,'utf8'),'sha256'),'hex');select*into r from app.event_regular_finance_reservations_v1 where actor_id=a and operation_id=op;
 if not found then return null;end if;if r.tournament_id is distinct from p_tournament_id or r.request_hash is distinct from h or r.request_payload is distinct from v then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 select response_payload into response from app.event_regular_finance_outcomes_v1 where actor_id=a and operation_id=op;if response is null then raise exception'finance reservation missing outcome';end if;return response;
exception when lock_not_available then return null;end$$;
alter function app.valid_event_regular_finance_draft_v1(jsonb,jsonb)owner to postgres;
alter function app.get_event_regular_finance_base_v1(uuid,uuid)owner to postgres;
alter function app.save_event_regular_finance_draft_v1(uuid,jsonb)owner to postgres;
alter function app.reconcile_event_regular_finance_draft_v1(uuid,jsonb)owner to postgres;
revoke all on function app.valid_event_regular_finance_draft_v1(jsonb,jsonb),app.get_event_regular_finance_base_v1(uuid,uuid),app.save_event_regular_finance_draft_v1(uuid,jsonb),app.reconcile_event_regular_finance_draft_v1(uuid,jsonb)from public,anon,authenticated,service_role;
-- No grants/wrappers. Structural draft storage is NOT TS financial-model parity.
-- Restricted/unclassified income or unsafe aggregate funds may be retained as
-- unresolved drafts, never acknowledged as an approved calculated fund.
commit;
