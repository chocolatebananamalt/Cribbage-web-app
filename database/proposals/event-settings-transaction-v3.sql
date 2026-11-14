-- UNEXECUTED private draft transaction candidate. NOT a migration/release.
-- Depends on the private custom-Q v2 proposals. No exposed grants or activation.
-- The old declarations/reviews remain unchanged. Public activation integration
-- and runtime role/concurrency/rollback acceptance are mandatory before release.
begin;
create table app.event_settings_save_reservations_v3(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null references app.tournaments(id),request_payload jsonb not null,
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id),created_at timestamptz not null default clock_timestamp(),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-setup-v3',actor_id,tournament_id,operation_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
create table app.event_settings_snapshots_v3(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null references app.tournaments(id),
 setup_revision_id uuid not null unique,
 actor_id uuid not null,operation_id uuid not null,effective_settings jsonb not null check(jsonb_typeof(effective_settings)='array'),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(actor_id,operation_id,tournament_id)references app.event_settings_save_reservations_v3(actor_id,operation_id,tournament_id),
 foreign key(setup_revision_id,tournament_id)references app.tournament_setup_revisions(id,tournament_id)
);
create table app.event_settings_save_outcomes_v3(
 actor_id uuid not null,operation_id uuid not null,response_payload jsonb not null,
 primary key(actor_id,operation_id),foreign key(actor_id,operation_id)references app.event_settings_save_reservations_v3(actor_id,operation_id)
);
do $$declare n text;begin
 foreach n in array array['event_settings_save_reservations_v3','event_settings_snapshots_v3','event_settings_save_outcomes_v3']loop
  execute format('alter table app.%I owner to postgres',n);
  execute format('alter table app.%I enable row level security',n);
  execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 end loop;
end$$;

-- Match JavaScript UTF-16 code-unit bounds, including non-BMP characters.
create function app.event_settings_js_text_length_v3(v text)returns integer
language sql immutable returns null on null input set search_path=''as $$
 select coalesce(sum(case when ascii(substr(v,n,1))>65535 then 2 else 1 end),0)::integer from generate_series(1,length(v))n;
$$;
create function app.valid_event_parameters_raw_v3(v jsonb)returns boolean
language plpgsql immutable set search_path=''as $$
declare s jsonb;k text;
begin
 if jsonb_typeof(v)is distinct from'object'or not(v?&array['version','finalMode','series','payoutMode','oneInText','topText','incrementFactorText'])
 or exists(select 1 from jsonb_object_keys(v)x where x<>all(array['version','finalMode','series','payoutMode','oneInText','topText','incrementFactorText']))
 or v->>'version'is distinct from'event-playoff-parameters-draft-v1'or coalesce(v->>'finalMode','')not in('same','separate')or coalesce(v->>'payoutMode','')not in('graduated','one-in','top')
 or jsonb_typeof(v->'series')is distinct from'object'or not((v->'series')?&array['regular','final'])or exists(select 1 from jsonb_object_keys(v->'series')x where x not in('regular','final'))then return false;end if;
 foreach k in array array['oneInText','topText','incrementFactorText']loop
  if jsonb_typeof(v->k)is distinct from'string'or app.event_settings_js_text_length_v3(v->>k)>256 then return false;end if;
 end loop;
 for s in select value from jsonb_each(v->'series')loop
  if jsonb_typeof(s)is distinct from'object'or not(s?&array['choice','winsText','gamesText'])or exists(select 1 from jsonb_object_keys(s)x where x not in('choice','winsText','gamesText'))
  or coalesce(s->>'choice','')not in('2-of-3','3-of-5','4-of-7','custom')then return false;end if;
  foreach k in array array['winsText','gamesText']loop
   if jsonb_typeof(s->k)is distinct from'string'or app.event_settings_js_text_length_v3(s->>k)>256 then return false;end if;
  end loop;
 end loop;
 return true;
end$$;

-- Older writers must not silently drop current configured settings. The new
-- reservation must already exist before the core revision is inserted.
create function app.guard_event_settings_carry_v3()returns trigger
language plpgsql security definer set search_path=''as $$
declare previous_id uuid;receipt app.operation_receipts%rowtype;r app.event_settings_save_reservations_v3%rowtype;
begin
 select id into previous_id from app.tournament_setup_revisions where tournament_id=new.tournament_id order by version desc limit 1;
 if previous_id is null or not exists(select 1 from app.event_settings_snapshots_v3 s,jsonb_array_elements(s.effective_settings)e where s.tournament_id=new.tournament_id and s.setup_revision_id=previous_id and e->>'mode'='configured')then return new;end if;
 select*into receipt from app.operation_receipts where id=new.operation_receipt_id and tournament_id=new.tournament_id;
 select*into r from app.event_settings_save_reservations_v3 where actor_id=new.actor_profile_id and operation_id=receipt.client_operation_id;
 if r.actor_id is null or r.tournament_id is distinct from new.tournament_id or receipt.actor_profile_id is distinct from r.actor_id
 or receipt.outcome is distinct from'accepted'or receipt.operation_type is distinct from'save_tournament_setup_version'
 or r.request_payload#>>'{setup,request,expectedVersion}'is distinct from(new.version-1)::text then raise exception'event_settings_require_versioned_save';end if;
 return new;
end$$;
create trigger event_settings_carry_v3 before insert on app.tournament_setup_revisions for each row execute function app.guard_event_settings_carry_v3();

create function app.save_event_settings_draft_v3(p_tournament_id uuid,p_envelope jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;h text;prior app.event_settings_save_reservations_v3%rowtype;response jsonb;
 setup jsonb;events jsonb;settings jsonb;s jsonb;old_s jsonb;effective jsonb:='[]';previous_settings jsonb;
 qreply jsonb;linked jsonb;rev app.tournament_setup_revisions%rowtype;snapshot_id uuid;seen uuid[]:=array[]::uuid[];row_id uuid;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 begin
  if jsonb_typeof(p_envelope)is distinct from'object'or coalesce(p_envelope#>>'{setup,request,idempotencyKey}','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then raise exception'invalid';end if;
  op:=(p_envelope#>>'{setup,request,idempotencyKey}')::uuid;
 exception when others then return jsonb_build_object('status','rejected','code','invalid_request');end;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=p_tournament_id for update nowait;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-setup-v3',a,p_tournament_id,op,p_envelope)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.event_settings_save_reservations_v3 where actor_id=a and operation_id=op;
 if found then
  if prior.tournament_id is distinct from p_tournament_id or prior.request_hash is distinct from h or prior.request_payload is distinct from p_envelope then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select response_payload into response from app.event_settings_save_outcomes_v3 where actor_id=a and operation_id=op;
  if response is null then raise exception'event settings reservation missing outcome';end if;
  return response;
 end if;
 if exists(select 1 from app.operation_receipts where actor_profile_id=a and client_operation_id=op)
 or exists(select 1 from app.setup_custom_q_save_reservations_v2 where actor_id=a and operation_id=op)
 or exists(select 1 from app.setup_event_link_save_reservations_v1 where actor_id=a and operation_id=op)then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 insert into app.event_settings_save_reservations_v3(actor_id,operation_id,tournament_id,request_payload,request_hash)values(a,op,p_tournament_id,p_envelope,h);
 begin
  if not(p_envelope?&array['kind','setup','eventSettings'])or exists(select 1 from jsonb_object_keys(p_envelope)x where x not in('kind','setup','eventSettings'))or p_envelope->>'kind'is distinct from'event-settings-setup-v3'then raise exception'event_settings_rejected:invalid_request';end if;
  setup:=p_envelope->'setup';events:=setup#>'{request,payload,events}';settings:=p_envelope->'eventSettings';
  if jsonb_typeof(events)is distinct from'array'or jsonb_typeof(settings)is distinct from'array'or jsonb_array_length(settings)>32
  or jsonb_array_length(settings)<>(select count(*)from jsonb_array_elements(events)e where e->>'eventKind'in('main','consolation'))then raise exception'event_settings_rejected:invalid_settings_coverage';end if;
  select s.effective_settings into previous_settings from app.event_settings_snapshots_v3 s join app.tournament_setup_revisions r on r.id=s.setup_revision_id and r.tournament_id=s.tournament_id
   where s.tournament_id=p_tournament_id and r.id=(select id from app.tournament_setup_revisions where tournament_id=p_tournament_id order by version desc limit 1);
  for s in select value from jsonb_array_elements(settings)loop
   if jsonb_typeof(s)is distinct from'object'or coalesce(s->>'eventClientRowId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then raise exception'event_settings_rejected:invalid_settings';end if;
   row_id:=(s->>'eventClientRowId')::uuid;
   if row_id=any(seen)or not exists(select 1 from jsonb_array_elements(events)e where e->>'clientRowId'=row_id::text and e->>'eventKind'in('main','consolation'))then raise exception'event_settings_rejected:invalid_settings_coverage';end if;
   seen:=array_append(seen,row_id);
   if s->>'mode'='configured'then
    if not(s?&array['eventClientRowId','mode','draft'])or exists(select 1 from jsonb_object_keys(s)x where x not in('eventClientRowId','mode','draft'))or not app.valid_event_parameters_raw_v3(s->'draft')then raise exception'event_settings_rejected:invalid_settings';end if;
    effective:=effective||jsonb_build_array(s);
   elsif s->>'mode'='preserve_historical'then
    if not(s?&array['eventClientRowId','mode'])or exists(select 1 from jsonb_object_keys(s)x where x not in('eventClientRowId','mode'))then raise exception'event_settings_rejected:invalid_settings';end if;
    old_s:=null;select x into old_s from jsonb_array_elements(coalesce(previous_settings,'[]'))x where x->>'eventClientRowId'=row_id::text;
    effective:=effective||jsonb_build_array(coalesce(old_s,jsonb_build_object('eventClientRowId',row_id,'mode','legacy_checks_required')));
   else raise exception'event_settings_rejected:invalid_settings';end if;
  end loop;
  qreply:=app.save_custom_q_setup_draft_v2(p_tournament_id,setup);
  if qreply->>'status'='retry_exact'then raise exception using errcode='55P03',message='nested setup busy';end if;
  if qreply->>'status'is distinct from'custom_q_setup_draft_saved'then raise exception'event_settings_rejected:%',coalesce(qreply->>'code','core_unavailable');end if;
  linked:=qreply->'linked';select*into rev from app.tournament_setup_revisions where id=(linked#>>'{result,revisionId}')::uuid and tournament_id=p_tournament_id;
  if rev.id is null or rev.actor_profile_id is distinct from a or rev.version is distinct from(setup#>>'{request,expectedVersion}')::integer+1 then raise exception'event_settings_rejected:core_unavailable';end if;
  insert into app.event_settings_snapshots_v3(tournament_id,setup_revision_id,actor_id,operation_id,effective_settings)values(p_tournament_id,rev.id,a,op,effective)returning id into snapshot_id;
  response:=jsonb_build_object('status','event_settings_draft_saved','fullRequestHash',h,'envelope',p_envelope,'linked',linked,'settingsSnapshotId',snapshot_id,'activationAllowed',false,'moneyMoved',false);
 exception when raise_exception then
  if sqlerrm not like'event_settings_rejected:%'then raise;end if;
  response:=jsonb_build_object('status','rejected','code',split_part(sqlerrm,':',2));
 when invalid_text_representation or numeric_value_out_of_range then response:=jsonb_build_object('status','rejected','code','invalid_request');
 end;
 if response->>'status'='rejected'then
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
   values(a,p_tournament_id,'save_event_settings_draft_v3',p_tournament_id,h,op,'rejected',response,clock_timestamp());
 end if;
 insert into app.event_settings_save_outcomes_v3(actor_id,operation_id,response_payload)values(a,op,response);
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;

create function app.reconcile_event_settings_draft_v3(p_tournament_id uuid,p_envelope jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;h text;r app.event_settings_save_reservations_v3%rowtype;response jsonb;
begin
 if a is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 if jsonb_typeof(p_envelope)is distinct from'object'or coalesce(p_envelope#>>'{setup,request,idempotencyKey}','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then return null;end if;
 op:=(p_envelope#>>'{setup,request,idempotencyKey}')::uuid;
 perform 1 from app.tournaments where id=p_tournament_id for share nowait;
 if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('event-settings-setup-v3',a,p_tournament_id,op,p_envelope)::text,'utf8'),'sha256'),'hex');
 select*into r from app.event_settings_save_reservations_v3 where actor_id=a and operation_id=op;
 if not found then return null;end if;
 if r.tournament_id is distinct from p_tournament_id or r.request_hash is distinct from h or r.request_payload is distinct from p_envelope then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 select response_payload into response from app.event_settings_save_outcomes_v3 where actor_id=a and operation_id=op;
 if response is null then raise exception'event settings reservation missing outcome';end if;
 return response;
exception when lock_not_available then return null;
end$$;

alter function app.valid_event_parameters_raw_v3(jsonb)owner to postgres;
alter function app.event_settings_js_text_length_v3(text)owner to postgres;
alter function app.guard_event_settings_carry_v3()owner to postgres;
alter function app.save_event_settings_draft_v3(uuid,jsonb)owner to postgres;
alter function app.reconcile_event_settings_draft_v3(uuid,jsonb)owner to postgres;
revoke all on function app.event_settings_js_text_length_v3(text),app.valid_event_parameters_raw_v3(jsonb),app.guard_event_settings_carry_v3(),app.save_event_settings_draft_v3(uuid,jsonb),app.reconcile_event_settings_draft_v3(uuid,jsonb)from public,anon,authenticated,service_role;
commit;
