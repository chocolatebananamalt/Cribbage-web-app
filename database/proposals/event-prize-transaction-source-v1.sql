-- LOCAL-TESTED, DEFAULT-OFF SOURCE CANDIDATE. NOT A MIGRATION/RELEASE.
-- Dependencies: event-prize-guard-source-v1.sql, private V3/V4 setup candidates,
-- Custom Q/Side/link journals. Fictional local PostgreSQL save, recovery,
-- history, rollback and competing-writer proof: event-prize-local-v1-20261108.
-- No exposed grants. No calculation, activation, financial or payout authority.
begin;
alter table app.event_prize_reservations_v1 add column prior_snapshot jsonb;
create table app.event_prize_snapshots_v1(
 id uuid primary key,tournament_id uuid not null,setup_revision_id uuid not null,
 actor_id uuid not null,operation_id uuid not null,document jsonb not null,
 unique(id,tournament_id),unique(tournament_id,setup_revision_id),
 foreign key(actor_id,operation_id,tournament_id)
  references app.event_prize_reservations_v1(actor_id,operation_id,tournament_id),
 foreign key(tournament_id,setup_revision_id)
  references app.event_prize_revision_bindings_v1(tournament_id,setup_revision_id),
 check((document->>'kind'='event-prize-settings-snapshot-v1'
  and document->>'prizeSnapshotId'=id::text
  and document->>'tournamentId'=tournament_id::text
  and document->>'setupRevisionId'=setup_revision_id::text
  and document->'activationAllowed'='false'::jsonb
  and document->'accountingAllowed'='false'::jsonb
  and document->'moneyMoved'='false'::jsonb)is true)
);
create table app.event_prize_heads_v1(
 tournament_id uuid primary key references app.tournaments(id),snapshot_id uuid not null,
 foreign key(snapshot_id,tournament_id)references app.event_prize_snapshots_v1(id,tournament_id)
);
create table app.event_prize_outcomes_v1(
 actor_id uuid not null,operation_id uuid not null,record_payload jsonb not null,
 primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id)references app.event_prize_reservations_v1(actor_id,operation_id),
 check(octet_length(record_payload::text)<=8000000)
);
do $$declare n text;begin
 foreach n in array array['event_prize_snapshots_v1','event_prize_heads_v1','event_prize_outcomes_v1']loop
  execute format('alter table app.%I owner to postgres',n);
  execute format('alter table app.%I enable row level security',n);
  execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  if n<>'event_prize_heads_v1'then
   execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
  end if;
 end loop;
end$$;

create function app.event_prize_write_enabled_source_v1()returns boolean
language sql immutable set search_path=''as $$select false;$$;
create function app.event_prize_recovery_enabled_source_v1()returns boolean
language sql immutable set search_path=''as $$select false;$$;
create function app.event_prize_exact_keys_source_v1(v jsonb,keys text[])returns boolean
language sql immutable set search_path=''as $$
 select case when jsonb_typeof(v)='object'then
  v?&keys and not exists(select 1 from jsonb_object_keys(v)k where k<>all(keys))else false end;
$$;
create function app.valid_event_prize_draft_source_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$
 select coalesce(app.event_prize_exact_keys_source_v1(v,array['version','recipients','method','incrementFactorText','winnerMultiplierText','firstRoundComparison','rounding'])
 and v->>'version'='playoff-prize-plan-draft-v2'
 and v->>'recipients'=any(array['all','top-2','top-4','top-8','top-16','top-32','top-64','top-128'])
 and v->>'method'=any(array['graduated','equal','winner-multiplier','winner-takes-all'])
 and jsonb_typeof(v->'incrementFactorText')='string'and app.event_settings_js_text_length_v3(v->>'incrementFactorText')<=256
 and jsonb_typeof(v->'winnerMultiplierText')='string'and app.event_settings_js_text_length_v3(v->>'winnerMultiplierText')<=256
 and v->>'firstRoundComparison'=any(array['unset','less','equal','more'])
 and app.event_prize_exact_keys_source_v1(v->'rounding',array['regular','qPool','sidePool'])
 and jsonb_typeof(v#>'{rounding,regular}')='string'and jsonb_typeof(v#>'{rounding,qPool}')='string'and jsonb_typeof(v#>'{rounding,sidePool}')='string'
 and v#>>'{rounding,regular}'=any(array['1','5','10'])
 and v#>>'{rounding,qPool}'=any(array['1','5','10'])
 and v#>>'{rounding,sidePool}'=any(array['1','5','10']),false);
$$;

create function app.valid_event_prize_snapshot_source_v1(v jsonb)returns boolean
language plpgsql immutable set search_path=''as $$
declare p jsonb;k text;seen text[]:=array[]::text[];
begin
 if not app.event_prize_exact_keys_source_v1(v,array['kind','tournamentId','setupRevisionId','setupVersion','settingsSnapshotId','settingsDigest','prizeSnapshotId','prizeDigest','plans','activationAllowed','accountingAllowed','moneyMoved'])
 or v->>'kind'is distinct from'event-prize-settings-snapshot-v1'
 or v->'activationAllowed'is distinct from'false'::jsonb or v->'accountingAllowed'is distinct from'false'::jsonb or v->'moneyMoved'is distinct from'false'::jsonb
 or jsonb_typeof(v->'setupVersion')is distinct from'number'or coalesce(v->>'setupVersion','')!~'^[1-9][0-9]{0,9}$'

 or jsonb_typeof(v->'plans')is distinct from'array'then return false;end if;
 if(v->>'setupVersion')::numeric>2147483647 then return false;end if;
 if jsonb_array_length(v->'plans')>32 then return false;end if;
 foreach k in array array['tournamentId','setupRevisionId','settingsSnapshotId','prizeSnapshotId']loop
  if coalesce(v->>k,'')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then return false;end if;
 end loop;
 foreach k in array array['settingsDigest','prizeDigest']loop if jsonb_typeof(v->k)is distinct from'string'or coalesce(v->>k,'')!~'^[0-9a-f]{64}$'then return false;end if;end loop;
 for p in select value from jsonb_array_elements(v->'plans')loop
  if coalesce(p->>'eventClientRowId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or p->>'eventClientRowId'=any(seen)or coalesce(p->>'eventKind','')not in('main','consolation')then return false;end if;
  seen:=array_append(seen,p->>'eventClientRowId');
  if p->>'mode'='legacy_checks_required'and app.event_prize_exact_keys_source_v1(p,array['eventClientRowId','eventKind','mode'])then continue;end if;
  if p->>'mode'is distinct from'proposed_v2'or not app.event_prize_exact_keys_source_v1(p,array['eventClientRowId','eventKind','mode','draft'])or not app.valid_event_prize_draft_source_v1(p->'draft')then return false;end if;
 end loop;return true;
end$$;

-- Mirrors syntax/coverage/preservation only, never monetary calculations.
create function app.event_prize_plan_source_v1(e jsonb,prior jsonb)returns jsonb
language plpgsql immutable set search_path=''as $$
declare p jsonb;ev jsonb;old_plan jsonb;plans jsonb:='[]';row_id text;kind text;seen text[]:=array[]::text[];expected_count integer;n integer;
begin
 if prior is not null and not app.valid_event_prize_snapshot_source_v1(prior)then return null;end if;
 if jsonb_typeof(e->'prizePlans')is distinct from'array'or jsonb_typeof(e#>'{setup,setup,request,payload,events}')is distinct from'array'then return null;end if;
 if jsonb_array_length(e->'prizePlans')>32 then return null;end if;
 select count(*)into expected_count from jsonb_array_elements(e#>'{setup,setup,request,payload,events}')x where x->>'eventKind'in('main','consolation');
 if jsonb_array_length(e->'prizePlans')<>expected_count then return null;end if;
 for p in select value from jsonb_array_elements(e->'prizePlans')loop
  row_id:=p->>'eventClientRowId';
  if coalesce(row_id,'')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'or row_id=any(seen)then return null;end if;seen:=array_append(seen,row_id);
  select count(*)into n from jsonb_array_elements(e#>'{setup,setup,request,payload,events}')x where x->>'clientRowId'=row_id and x->>'eventKind'in('main','consolation');if n<>1 then return null;end if;
  select x into ev from jsonb_array_elements(e#>'{setup,setup,request,payload,events}')x where x->>'clientRowId'=row_id;kind:=ev->>'eventKind';
  if p->>'mode'='proposed_v2'and app.event_prize_exact_keys_source_v1(p,array['eventClientRowId','mode','draft'])and app.valid_event_prize_draft_source_v1(p->'draft')then plans:=plans||jsonb_build_array(p||jsonb_build_object('eventKind',kind));
  elsif p->>'mode'='preserve_historical'and app.event_prize_exact_keys_source_v1(p,array['eventClientRowId','mode'])then
   old_plan:=null;select x into old_plan from jsonb_array_elements(coalesce(prior->'plans','[]'::jsonb))x where x->>'eventClientRowId'=row_id;
   if old_plan is not null and old_plan->>'eventKind'is distinct from kind then return null;end if;
   plans:=plans||jsonb_build_array(coalesce(old_plan,jsonb_build_object('eventClientRowId',row_id,'eventKind',kind,'mode','legacy_checks_required')));
  else return null;end if;
 end loop;return plans;
end$$;

create function app.guard_event_prize_snapshot_source_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare r app.event_prize_reservations_v1%rowtype;expected jsonb;
begin
 if not app.valid_event_prize_snapshot_source_v1(new.document)then raise exception'event_prize_invalid_snapshot';end if;
 select*into r from app.event_prize_reservations_v1 where actor_id=new.actor_id and operation_id=new.operation_id and tournament_id=new.tournament_id;
 if r.actor_id is null or r.reserved_xid is distinct from txid_current()or auth.uid()is distinct from new.actor_id then raise exception'event_prize_snapshot_operation_mismatch';end if;
 if r.prior_snapshot is null then
  if exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=new.tournament_id)then raise exception'event_prize_snapshot_prior_mismatch';end if;
 elsif not exists(select 1 from app.event_prize_heads_v1 h join app.event_prize_snapshots_v1 s on s.id=h.snapshot_id and s.tournament_id=h.tournament_id
  where h.tournament_id=new.tournament_id and s.document=r.prior_snapshot)then raise exception'event_prize_snapshot_prior_mismatch';end if;
 expected:=app.event_prize_plan_source_v1(r.request_payload,r.prior_snapshot);
 if expected is null or new.document->'plans'is distinct from expected or new.document->>'prizeDigest'is distinct from r.request_hash
 or not exists(select 1 from app.event_prize_revision_bindings_v1 b
  join app.event_settings_snapshots_v3 s on s.id=b.settings_snapshot_id and s.tournament_id=b.tournament_id and s.setup_revision_id=b.setup_revision_id
  join app.event_settings_save_reservations_v3 sr on sr.actor_id=s.actor_id and sr.operation_id=s.operation_id and sr.tournament_id=s.tournament_id
  join app.tournament_setup_revisions rev on rev.id=b.setup_revision_id and rev.tournament_id=b.tournament_id
  where b.actor_id=new.actor_id and b.operation_id=new.operation_id and b.tournament_id=new.tournament_id and b.setup_revision_id=new.setup_revision_id
   and s.actor_id=new.actor_id and s.operation_id=r.nested_operation_id and sr.request_payload=r.request_payload->'setup'
   and new.document->>'settingsSnapshotId'=s.id::text and new.document->>'settingsDigest'=sr.request_hash
   and new.document->'setupVersion'=to_jsonb(rev.version)and rev.actor_profile_id=new.actor_id
   and rev.version=(r.request_payload#>>'{setup,setup,request,expectedVersion}')::integer+1)
 then raise exception'event_prize_snapshot_binding_mismatch';end if;return new;
end$$;
create trigger event_prize_snapshot_source_v1 before insert on app.event_prize_snapshots_v1
 for each row execute function app.guard_event_prize_snapshot_source_v1();

-- Every insertion into an older operation journal takes the SAME actor/key
-- advisory lock as the outer writer before checking its namespace. This closes
-- cross-tournament races even where the older writer has no advisory locking.
create function app.guard_event_prize_operation_source_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare a uuid;op uuid;tid uuid;r app.event_prize_reservations_v1%rowtype;
 inner_payload jsonb;key_text text;j jsonb:=to_jsonb(new);
begin
 if tg_table_schema<>'app'or tg_table_name<>all(array['operation_receipts','event_settings_save_reservations_v3','setup_custom_q_save_reservations_v2','setup_event_link_save_reservations_v1','setup_custom_payout_batches_v2'])then raise exception'event_prize_unknown_journal';end if;
 a:=case when tg_table_name='operation_receipts'then(j->>'actor_profile_id')::uuid else(j->>'actor_id')::uuid end;
 op:=case when tg_table_name='operation_receipts'then(j->>'client_operation_id')::uuid else(j->>'operation_id')::uuid end;
 tid:=(j->>'tournament_id')::uuid;
 if a is null or op is null then return new;end if;
 key_text:=a::text||':'||op::text;
 if not pg_try_advisory_xact_lock(hashtextextended(key_text,0))then raise lock_not_available using message='event_prize_operation_busy';end if;
 select*into r from app.event_prize_reservations_v1
  where actor_id=a and(operation_id=op or nested_operation_id=op);
 if r.actor_id is null then return new;end if;
 if r.nested_operation_id is distinct from op or r.tournament_id is distinct from tid
 or r.reserved_xid is distinct from txid_current()or auth.uid()is distinct from a
 then raise exception'event_prize_operation_collision';end if;
 if tg_table_name='event_settings_save_reservations_v3'then inner_payload:=j->'request_payload';
 else select request_payload into inner_payload from app.event_settings_save_reservations_v3 where actor_id=a and operation_id=op and tournament_id=tid;end if;
 if inner_payload is distinct from r.request_payload->'setup'then raise exception'event_prize_nested_request_mismatch';end if;
 if tg_table_name='operation_receipts'then
  -- Accepted evidence is core-only. Known nested rejection receipts may be
  -- produced while unwinding V4; the outer savepoint then rolls them ALL back
  -- before recording its own rejection. Do not turn normal validation into an
  -- unclassified transport failure merely because a nested writer journals it.
  if not coalesce((j->>'outcome'='accepted'and j->>'operation_type'='save_tournament_setup_version')
   or(j->>'outcome'='rejected'and j->>'operation_type'in('save_tournament_setup_version','save_linked_tournament_setup_v1','save_custom_q_setup_draft_v2','save_event_settings_draft_v3')),false)
  then raise exception'event_prize_nested_receipt_mismatch';end if;
 end if;
 return new;
end$$;
-- SOURCE ONLY: these reciprocal triggers must be installed together with the
-- tested writer, never independently. Nothing in this file has been applied.
do $$declare n text;begin
 foreach n in array array['operation_receipts','event_settings_save_reservations_v3','setup_custom_q_save_reservations_v2','setup_event_link_save_reservations_v1','setup_custom_payout_batches_v2']loop
  execute format('create trigger %I before insert on app.%I for each row execute function app.guard_event_prize_operation_source_v1()',n||'_prize_namespace_v1',n);
 end loop;
end$$;
create trigger event_prize_carry_source_v1 before insert on app.tournament_setup_revisions
 for each row execute function app.guard_event_prize_carry_source_v1();

create function app.event_prize_attempt_source_v1(a uuid,tid uuid,op uuid,h text,s text,c text)returns jsonb
language sql immutable set search_path=''as $$select jsonb_build_object('kind','event-prize-attempt-v1','scope',jsonb_build_object('actorId',a,'tournamentId',tid),'operationId',op,'requestHash',h,'result',jsonb_build_object('status',s,'code',c));$$;

create function app.save_event_prize_settings_source_v1(p_tid uuid,p_request_text text)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();e jsonb;op uuid;inner_op uuid;h text;key_op uuid;
 r app.event_prize_reservations_v1%rowtype;v3 app.event_settings_snapshots_v3%rowtype;
 prior jsonb;prior_head uuid;current_base jsonb;settings_hash text;plans jsonb:='[]';
 nested jsonb;snapshot jsonb;ack jsonb;outcome jsonb;record_value jsonb;
 new_revision uuid;new_version integer;new_settings uuid;new_snapshot uuid;
 code text;
begin
 if a is null or p_request_text is null or octet_length(p_request_text)>1000000 then return null;end if;
 begin
  e:=p_request_text::jsonb;op:=(e->>'operationId')::uuid;
  inner_op:=(e#>>'{setup,setup,request,idempotencyKey}')::uuid;
  if not app.event_prize_exact_keys_source_v1(e,array['kind','operationId','setup','prizeBase','prizePlans'])
  or e->>'kind'is distinct from'event-prize-settings-setup-v1'or op is null or inner_op is null or op=inner_op
  or e->>'operationId'is distinct from op::text or e#>>'{setup,setup,request,idempotencyKey}'is distinct from inner_op::text
  or e#>>'{setup,kind}'is distinct from'event-settings-setup-v3'
  or e#>>'{setup,setup,base,tournamentId}'is distinct from p_tid::text
  or not app.event_prize_exact_keys_source_v1(e->'prizeBase',array['settingsSnapshotId','settingsDigest','prizeSnapshotId','prizeDigest'])
  then return null;end if;
 exception when invalid_text_representation then return null;end;
 h:=encode(extensions.digest(convert_to(p_request_text,'utf8'),'sha256'),'hex');
 if app.event_prize_write_enabled_source_v1()is distinct from true then return app.event_prize_attempt_source_v1(a,p_tid,op,h,'rejected','feature_disabled');end if;
 if current_setting('transaction_isolation')<>'read committed'then return app.event_prize_attempt_source_v1(a,p_tid,op,h,'retry_exact','isolation_not_supported');end if;
 -- Acquire BOTH actor/key locks in stable order BEFORE tournament/role locks.
 for key_op in select x from unnest(array[op,inner_op])x order by x::text loop
  if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||key_op::text,0))then return app.event_prize_attempt_source_v1(a,p_tid,op,h,'retry_exact','operation_busy');end if;
 end loop;
 perform 1 from app.tournaments where id=p_tid for update nowait;
 if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tid and profile_id=a and role in('director','co_director')order by role for share nowait;
 if not found then return null;end if;
 -- Exact owned history precedes current source and lifecycle validation.
 select*into r from app.event_prize_reservations_v1 where actor_id=a and operation_id=op;
 if found then
  if r.tournament_id is distinct from p_tid or r.request_text is distinct from p_request_text or r.request_hash is distinct from h then return app.event_prize_attempt_source_v1(a,p_tid,op,h,'rejected','idempotency_conflict');end if;
  select o.record_payload into record_value from app.event_prize_outcomes_v1 o where o.actor_id=a and o.operation_id=op;
  if record_value is null then raise exception'event_prize_missing_outcome';end if;return record_value;
 end if;
 -- Neither outer nor inner key may adopt any old-protocol operation. All
 -- reciprocal inserts use those same actor/key locks, including across events.
 if exists(select 1 from app.event_prize_reservations_v1 where actor_id=a and(operation_id in(op,inner_op)or nested_operation_id in(op,inner_op)))
 or exists(select 1 from app.operation_receipts where actor_profile_id=a and client_operation_id in(op,inner_op))
 or exists(select 1 from app.event_settings_save_reservations_v3 where actor_id=a and operation_id in(op,inner_op))
 or exists(select 1 from app.setup_custom_q_save_reservations_v2 where actor_id=a and operation_id in(op,inner_op))
 or exists(select 1 from app.setup_event_link_save_reservations_v1 where actor_id=a and operation_id in(op,inner_op))
 or exists(select 1 from app.setup_custom_payout_batches_v2 where actor_id=a and operation_id in(op,inner_op))then return app.event_prize_attempt_source_v1(a,p_tid,op,h,'rejected','idempotency_conflict');end if;
 current_base:=app.get_custom_q_setup_base_v2(p_tid)->'base';
 if jsonb_typeof(current_base)is distinct from'object'or current_base is distinct from e#>'{setup,setup,base}'then return app.event_prize_attempt_source_v1(a,p_tid,op,h,'rejected','source_changed');end if;
 -- Prove settings absence from server history, never a posted null alone.
 select*into v3 from app.event_settings_snapshots_v3 where tournament_id=p_tid and setup_revision_id=(current_base->>'setupRevisionId')::uuid;
 if v3.id is null then
  if exists(select 1 from app.event_settings_snapshots_v3 where tournament_id=p_tid)then return app.event_prize_attempt_source_v1(a,p_tid,op,h,'rejected','settings_source_changed');end if;
 else
  select request_hash into settings_hash from app.event_settings_save_reservations_v3 where actor_id=v3.actor_id and operation_id=v3.operation_id and tournament_id=p_tid;
  if settings_hash is null then return app.event_prize_attempt_source_v1(a,p_tid,op,h,'rejected','settings_source_changed');end if;
 end if;
 if e#>'{prizeBase,settingsSnapshotId}'is distinct from coalesce(to_jsonb(v3.id),'null'::jsonb)
 or e#>'{prizeBase,settingsDigest}'is distinct from coalesce(to_jsonb(settings_hash),'null'::jsonb)then return app.event_prize_attempt_source_v1(a,p_tid,op,h,'rejected','settings_source_changed');end if;
 select s.id,s.document into prior_head,prior from app.event_prize_heads_v1 hd join app.event_prize_snapshots_v1 s on s.id=hd.snapshot_id and s.tournament_id=hd.tournament_id where hd.tournament_id=p_tid;
 if prior_head is null and exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=p_tid)then return app.event_prize_attempt_source_v1(a,p_tid,op,h,'rejected','prize_source_unavailable');end if;
 if e#>'{prizeBase,prizeSnapshotId}'is distinct from coalesce(to_jsonb(prior_head),'null'::jsonb)
 or e#>'{prizeBase,prizeDigest}'is distinct from coalesce(prior->'prizeDigest','null'::jsonb)
 or(prior is not null and(prior->>'setupRevisionId'is distinct from current_base->>'setupRevisionId'or prior->'setupVersion'is distinct from current_base->'setupVersion'
  or prior->>'settingsSnapshotId'is distinct from v3.id::text or prior->>'settingsDigest'is distinct from settings_hash))then return app.event_prize_attempt_source_v1(a,p_tid,op,h,'rejected','prize_source_unavailable');end if;
 -- Syntax-only intent storage; malformed/unknown historical versions fail closed.
 plans:=app.event_prize_plan_source_v1(e,prior);
 if plans is null then return app.event_prize_attempt_source_v1(a,p_tid,op,h,'rejected','invalid_request');end if;
 insert into app.event_prize_reservations_v1(actor_id,operation_id,tournament_id,nested_operation_id,request_text,request_payload,request_hash,prior_snapshot)
 values(a,op,p_tid,inner_op,p_request_text,e,h,prior);
 -- This PL/pgSQL exception block is the savepoint. A nested JSON rejection MUST
 -- raise: otherwise its earlier inner mutations could survive an outer reject.
 begin
  nested:=app.save_event_settings_custom_pool_draft_v4(p_tid,e->'setup');
  if nested->>'status'='retry_exact'then raise lock_not_available using message='event_prize_nested_busy';end if;
  if nested->>'status'is distinct from'event_settings_custom_pool_draft_saved_v4'or nested->'envelope'is distinct from e->'setup'
  or nested->'activationAllowed'is distinct from'false'::jsonb or nested->'moneyMoved'is distinct from'false'::jsonb
  then raise exception'event_prize_rejected:nested_write_rejected';end if;
  new_revision:=(nested#>>'{linked,result,revisionId}')::uuid;new_version:=(nested#>>'{linked,result,version}')::integer;new_settings:=(nested->>'settingsSnapshotId')::uuid;
  if new_version is distinct from(current_base->>'setupVersion')::integer+1
  or not exists(select 1 from app.tournament_setup_revisions where id=new_revision and tournament_id=p_tid and actor_profile_id=a and version=new_version)
   or not exists(select 1 from app.event_settings_snapshots_v3 s join app.event_settings_save_reservations_v3 nested_reservation on nested_reservation.actor_id=s.actor_id and nested_reservation.operation_id=s.operation_id and nested_reservation.tournament_id=s.tournament_id
    where s.id=new_settings and s.tournament_id=p_tid and s.setup_revision_id=new_revision and s.actor_id=a and s.operation_id=inner_op and nested_reservation.request_payload=e->'setup'and nested_reservation.request_hash=nested->>'fullRequestHash')
  then raise exception'event_prize_rejected:invalid_snapshot';end if;
  insert into app.event_prize_revision_bindings_v1(actor_id,operation_id,tournament_id,setup_revision_id,settings_snapshot_id)values(a,op,p_tid,new_revision,new_settings);
  new_snapshot:=extensions.gen_random_uuid();
  snapshot:=jsonb_build_object('kind','event-prize-settings-snapshot-v1','tournamentId',p_tid,'setupRevisionId',new_revision,'setupVersion',new_version,'settingsSnapshotId',new_settings,'settingsDigest',nested->>'fullRequestHash','prizeSnapshotId',new_snapshot,'prizeDigest',h,'plans',plans,'activationAllowed',false,'accountingAllowed',false,'moneyMoved',false);
  insert into app.event_prize_snapshots_v1(id,tournament_id,setup_revision_id,actor_id,operation_id,document)values(new_snapshot,p_tid,new_revision,a,op,snapshot);
  if prior_head is null then insert into app.event_prize_heads_v1(tournament_id,snapshot_id)values(p_tid,new_snapshot);
  else update app.event_prize_heads_v1 set snapshot_id=new_snapshot where tournament_id=p_tid and snapshot_id=prior_head;if not found then raise exception'event_prize_rejected:head_conflict';end if;end if;
  ack:=jsonb_build_object('status','event_prize_settings_draft_saved_v1','fullRequestHash',h,'envelope',e,'nested',nested,'snapshot',snapshot,'activationAllowed',false,'accountingAllowed',false,'moneyMoved',false);
  outcome:=jsonb_build_object('status','accepted','ack',ack);
 exception when raise_exception then
  if sqlerrm not like'event_prize_rejected:%'then raise;end if;
  code:=split_part(sqlerrm,':',2);outcome:=jsonb_build_object('status','rejected','code',code);
 when invalid_text_representation or numeric_value_out_of_range then outcome:=jsonb_build_object('status','rejected','code','invalid_snapshot');
 end;
 record_value:=jsonb_build_object('kind','event-prize-operation-record-v1','scope',jsonb_build_object('actorId',a,'tournamentId',p_tid),'operationId',op,'requestText',p_request_text,'requestHash',h,'priorSnapshot',prior,'result',outcome);
 insert into app.event_prize_outcomes_v1(actor_id,operation_id,record_payload)values(a,op,record_value);
 return record_value;
exception when lock_not_available then
 -- Exception handler rolls back ALL statements in the outer function block.
 return app.event_prize_attempt_source_v1(a,p_tid,op,h,'retry_exact','source_busy');
end$$;

-- No current setup/head dependency; only current authenticated authorization and
-- the caller-owned exact immutable operation. Never writes or clears pending.
create function app.get_event_prize_operation_source_v1(p_tid uuid,p_request_text text)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();e jsonb;op uuid;h text;r app.event_prize_reservations_v1%rowtype;v jsonb;
begin
 if app.event_prize_recovery_enabled_source_v1()is distinct from true or a is null
 or p_request_text is null or octet_length(p_request_text)>1000000 or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 begin e:=p_request_text::jsonb;op:=(e->>'operationId')::uuid;
  if op is null or e->>'kind'is distinct from'event-prize-settings-setup-v1'or e#>>'{setup,setup,base,tournamentId}'is distinct from p_tid::text then return null;end if;
 exception when invalid_text_representation then return null;end;
 h:=encode(extensions.digest(convert_to(p_request_text,'utf8'),'sha256'),'hex');
 perform 1 from app.tournaments where id=p_tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 select*into r from app.event_prize_reservations_v1 where actor_id=a and operation_id=op;
 if not found then return jsonb_build_object('kind','event-prize-no-record-v1','scope',jsonb_build_object('actorId',a,'tournamentId',p_tid),'operationId',op,'requestHash',h);end if;
 if r.tournament_id is distinct from p_tid or r.request_hash is distinct from h or r.request_text is distinct from p_request_text then return app.event_prize_attempt_source_v1(a,p_tid,op,h,'rejected','idempotency_conflict');end if;
 select record_payload into v from app.event_prize_outcomes_v1 where actor_id=a and operation_id=op;
 return v;
exception when lock_not_available then return null;
end$$;
create function public.save_event_prize_settings_provider_v1(p_tid uuid,p_request_text text)returns jsonb
language sql security definer set search_path=''as $$select app.save_event_prize_settings_source_v1(p_tid,p_request_text);$$;
create function public.get_event_prize_operation_provider_v1(p_tid uuid,p_request_text text)returns jsonb
language sql security definer set search_path=''as $$select app.get_event_prize_operation_source_v1(p_tid,p_request_text);$$;
do $$declare f regprocedure;begin
 foreach f in array array[
 'app.event_prize_write_enabled_source_v1()'::regprocedure,'app.event_prize_recovery_enabled_source_v1()'::regprocedure,
 'app.event_prize_exact_keys_source_v1(jsonb,text[])'::regprocedure,'app.valid_event_prize_draft_source_v1(jsonb)'::regprocedure,
 'app.valid_event_prize_snapshot_source_v1(jsonb)'::regprocedure,'app.event_prize_plan_source_v1(jsonb,jsonb)'::regprocedure,
 'app.guard_event_prize_snapshot_source_v1()'::regprocedure,'app.guard_event_prize_operation_source_v1()'::regprocedure,'app.event_prize_attempt_source_v1(uuid,uuid,uuid,text,text,text)'::regprocedure,
 'app.save_event_prize_settings_source_v1(uuid,text)'::regprocedure,'app.get_event_prize_operation_source_v1(uuid,text)'::regprocedure,
 'public.save_event_prize_settings_provider_v1(uuid,text)'::regprocedure,'public.get_event_prize_operation_provider_v1(uuid,text)'::regprocedure
 ]loop execute format('alter function %s owner to postgres',f);execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;
end$$;
commit;
