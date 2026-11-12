-- CLOSED TEST-ONLY PACKAGE. No cohort or application access is enabled.
-- The reviewed migration runner supplies the sole transaction boundary.
-- Use only after a fresh protected recovery point and approved staging preflight.
set local lock_timeout='5s';
set local statement_timeout='120s';
-- PRIVATE CLOSED CANDIDATE: NOT INSTALLED OR APPROVED FOR PUBLICATION
-- Exact reduced latest-Setup/native mixed Finance/playoff closure.
-- Requires the last verified preparation51 + review + native-play installation.
-- Existing function replacements make this more than an additive update.

-- BEGIN database/proposals/event-settings-custom-pool-transaction-v4.sql source SHA256 0c366e7cec63498b1c08437d8dcf3ccb21e6713260e2a5a8d9b4b9d8764a00b9
-- Unpublished, default-off Event Settings transaction using the reviewed
-- combined Custom Q/Side setup writer. Existing V3 functions, reservations,
-- request hashes and historical outcomes remain unchanged.
create or replace function app.event_settings_custom_pool_transaction_enabled_v4()
returns boolean language sql immutable set search_path=''as $$select false;$$;

do $$declare d text;p text;old text;replacement text;begin
 d:=replace(pg_get_functiondef('app.save_event_settings_draft_v3(uuid,jsonb)'::regprocedure),E'\r\n',E'\n');
 p:=replace(d,'FUNCTION app.save_event_settings_draft_v3(','FUNCTION app.save_event_settings_custom_pool_draft_v4(');
 if p=d then raise exception'Event Settings V4 clone name anchor changed';end if;
 old:=$a$qreply:=app.save_custom_q_setup_draft_v2(p_tournament_id,setup);$a$;
 replacement:=$a$qreply:=app.save_custom_pool_setup_draft_v3(p_tournament_id,setup);$a$;
 if(length(p)-length(replace(p,old,'')))/length(old)<>1 then raise exception'Event Settings V4 setup writer anchor changed';end if;p:=replace(p,old,replacement);
 old:=$a$if qreply->>'status'is distinct from'custom_q_setup_draft_saved'then$a$;
 replacement:=$a$if qreply->>'status'is distinct from'custom_pool_setup_draft_saved_v3'then$a$;
 if(length(p)-length(replace(p,old,'')))/length(old)<>1 then raise exception'Event Settings V4 setup result anchor changed';end if;p:=replace(p,old,replacement);
 old:=$a$'status','event_settings_draft_saved'$a$;replacement:=$a$'status','event_settings_custom_pool_draft_saved_v4'$a$;
 if(length(p)-length(replace(p,old,'')))/length(old)<>1 then raise exception'Event Settings V4 response anchor changed';end if;execute replace(p,old,replacement);
end$$;

create function app.reconcile_event_settings_custom_pool_draft_v4(p_tournament_id uuid,p_envelope jsonb)
returns jsonb language sql stable security definer set search_path=''as $$select app.reconcile_event_settings_draft_v3(p_tournament_id,p_envelope);$$;


alter function app.event_settings_custom_pool_transaction_enabled_v4()owner to postgres;
alter function app.save_event_settings_custom_pool_draft_v4(uuid,jsonb)owner to postgres;
alter function app.reconcile_event_settings_custom_pool_draft_v4(uuid,jsonb)owner to postgres;
revoke all on function app.event_settings_custom_pool_transaction_enabled_v4(),app.save_event_settings_custom_pool_draft_v4(uuid,jsonb),app.reconcile_event_settings_custom_pool_draft_v4(uuid,jsonb)from public,anon,authenticated,service_role;

-- END database/proposals/event-settings-custom-pool-transaction-v4.sql

-- BEGIN database/proposals/event-prize-guard-source-v1.sql source SHA256 0d0efe0a4f969adac9016f18a2da5f3863b35eac4507d65db68fecfed23d9352
-- LOCAL-TESTED SOURCE FOUNDATION, NOT A MIGRATION OR RELEASE.
-- No RPC writer or trigger attachment is supplied by this file. Applying this
-- alone would not enable prize saves. Do not attach the guard before a reviewed
-- atomic V4-backed writer and recovery reader exist and pass runtime acceptance.
-- Depends on event-settings-transaction-v3.sql and existing private core tables.
create table app.event_prize_reservations_v1(
 actor_id uuid not null references app.profiles(id),
 operation_id uuid not null,
 tournament_id uuid not null references app.tournaments(id),
 nested_operation_id uuid not null,
 request_text text not null check(octet_length(request_text)<=1000000),
 request_payload jsonb not null,
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 reserved_xid bigint not null default txid_current(),
 primary key(actor_id,operation_id),
 unique(actor_id,nested_operation_id),
 unique(actor_id,operation_id,tournament_id),
 check(operation_id<>nested_operation_id),
 check(request_payload=request_text::jsonb),
 check(request_hash=encode(extensions.digest(convert_to(request_text,'utf8'),'sha256'),'hex')),
 check((request_payload->>'kind'='event-prize-settings-setup-v1')is true),
 check((request_payload->>'operationId'=operation_id::text)is true),
 check((request_payload#>>'{setup,setup,request,idempotencyKey}'=nested_operation_id::text)is true),
 check((request_payload#>>'{setup,setup,base,tournamentId}'=tournament_id::text)is true)
);
-- Immutable evidence is sufficient for the compatibility barrier. The complete
-- snapshot/head/outcome schema and writer are still a separate implementation gate.
create table app.event_prize_revision_bindings_v1(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,
 setup_revision_id uuid not null,settings_snapshot_id uuid not null,
 primary key(tournament_id,setup_revision_id),
 foreign key(actor_id,operation_id,tournament_id)
  references app.event_prize_reservations_v1(actor_id,operation_id,tournament_id),
 foreign key(setup_revision_id,tournament_id)
  references app.tournament_setup_revisions(id,tournament_id),
 foreign key(settings_snapshot_id)references app.event_settings_snapshots_v3(id)
);
alter table app.event_prize_reservations_v1 owner to postgres;
alter table app.event_prize_revision_bindings_v1 owner to postgres;
alter table app.event_prize_reservations_v1 enable row level security;
alter table app.event_prize_reservations_v1 force row level security;
alter table app.event_prize_revision_bindings_v1 enable row level security;
alter table app.event_prize_revision_bindings_v1 force row level security;
revoke all on app.event_prize_reservations_v1,app.event_prize_revision_bindings_v1
 from public,anon,authenticated,service_role;
create trigger event_prize_reservations_v1_immutable before update or delete
 on app.event_prize_reservations_v1 for each row execute function app.reject_immutable_history();
create trigger event_prize_revision_bindings_v1_immutable before update or delete
 on app.event_prize_revision_bindings_v1 for each row execute function app.reject_immutable_history();

-- An ID-only foreign key is insufficient: pin the snapshot to this exact
-- tournament/revision and this reservation's nested operation and actor.
create function app.guard_event_prize_binding_source_v1()returns trigger
language plpgsql security definer set search_path=''as $$
begin
 perform 1 from app.event_settings_snapshots_v3 s
 join app.event_prize_reservations_v1 r on r.actor_id=new.actor_id
  and r.operation_id=new.operation_id and r.tournament_id=new.tournament_id
 where s.id=new.settings_snapshot_id and s.tournament_id=new.tournament_id
  and s.setup_revision_id=new.setup_revision_id and s.actor_id=new.actor_id
  and s.operation_id=r.nested_operation_id
 for key share of s,r nowait;
 if not found then raise exception 'event_prize_binding_source_mismatch';end if;
 return new;
end$$;
alter function app.guard_event_prize_binding_source_v1()owner to postgres;
revoke all on function app.guard_event_prize_binding_source_v1()
 from public,anon,authenticated,service_role;
create trigger event_prize_binding_source_v1 before insert
 on app.event_prize_revision_bindings_v1 for each row
 execute function app.guard_event_prize_binding_source_v1();

create function app.guard_event_prize_carry_source_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare receipt app.operation_receipts%rowtype;
 outer_row app.event_prize_reservations_v1%rowtype;
 inner_row app.event_settings_save_reservations_v3%rowtype;
 previous_id uuid;previous_version integer;
begin
 -- No GUC, actor argument, posted null head or presence boolean authorizes carry.
 select * into receipt from app.operation_receipts where id=new.operation_receipt_id
  and tournament_id=new.tournament_id;
 select * into outer_row from app.event_prize_reservations_v1
  where actor_id=new.actor_profile_id and nested_operation_id=receipt.client_operation_id;
 if outer_row.actor_id is null and not exists(
  select 1 from app.event_prize_revision_bindings_v1 where tournament_id=new.tournament_id
 )then return new;end if;
 if outer_row.actor_id is null then raise exception 'event_prize_requires_versioned_save';end if;
 -- The top-level transaction ID cannot be replayed by an older writer in a later
 -- transaction. Only the private future writer may insert this reservation.
 if outer_row.reserved_xid is distinct from txid_current()
 or outer_row.tournament_id is distinct from new.tournament_id
 or auth.uid() is distinct from new.actor_profile_id
 or receipt.actor_profile_id is distinct from new.actor_profile_id
 or receipt.outcome is distinct from 'accepted'
 or receipt.operation_type is distinct from 'save_tournament_setup_version'
 then raise exception 'event_prize_requires_versioned_save';end if;
 perform 1 from app.tournament_roles where tournament_id=new.tournament_id
  and profile_id=new.actor_profile_id and role in('director','co_director')
  order by role for key share nowait;
 if not found then raise exception 'event_prize_requires_director';end if;
 select * into inner_row from app.event_settings_save_reservations_v3
  where actor_id=new.actor_profile_id and operation_id=outer_row.nested_operation_id;
 select id,version into previous_id,previous_version from app.tournament_setup_revisions
  where tournament_id=new.tournament_id order by version desc limit 1;
 if inner_row.actor_id is null
 or inner_row.tournament_id is distinct from new.tournament_id
 or inner_row.request_payload is distinct from outer_row.request_payload->'setup'
 or outer_row.request_payload#>>'{setup,setup,request,expectedVersion}'
    is distinct from(new.version-1)::text
 or outer_row.request_payload#>>'{setup,setup,base,setupVersion}'
    is distinct from coalesce(previous_version,0)::text
 or (outer_row.request_payload#>>'{setup,setup,base,setupRevisionId}')::uuid
    is distinct from previous_id
 or new.version is distinct from coalesce(previous_version,0)+1
 then raise exception 'event_prize_requires_exact_nested_save';end if;
 return new;
end$$;
alter function app.guard_event_prize_carry_source_v1()owner to postgres;
revoke all on function app.guard_event_prize_carry_source_v1()
 from public,anon,authenticated,service_role;
-- INTENTIONALLY NO TRIGGER ATTACHMENT TO tournament_setup_revisions.
-- Future writer must acquire both operation advisory locks in consistent order
-- BEFORE the tournament lock; require a fresh nested reservation; reserve outer;
-- call V4 within a savepoint; validate its exact ACK; insert snapshot/binding and
-- CAS head; journal; commit. A rejected nested JSON reply must RAISE within the
-- savepoint. Lock/retry/error paths must never return a fabricated accepted ACK.
-- END database/proposals/event-prize-guard-source-v1.sql

-- BEGIN database/proposals/event-prize-transaction-source-v1.sql source SHA256 0634eb8f7f147c1bfbc2f46fcacf69e612d6e629463cb4d49be7e7833586adfc
-- LOCAL-TESTED, DEFAULT-OFF SOURCE CANDIDATE. NOT A MIGRATION/RELEASE.
-- Dependencies: event-prize-guard-source-v1.sql, private V3/V4 setup candidates,
-- Custom Q/Side/link journals. Fictional local PostgreSQL save, recovery,
-- history, rollback and competing-writer proof: event-prize-local-v1-20261108.
-- No exposed grants. No calculation, activation, financial or payout authority.
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
-- END database/proposals/event-prize-transaction-source-v1.sql

-- BEGIN database/proposals/event-prize-workspace-source-v1.sql source SHA256 b079d2ba8ff8479ef487f4e1a975c97b6eb4070b5529e837b1b1468b84b2987c
-- Local candidate, not a migration. Requires the complete prize transaction and
-- V3 workspace sources. No access grants, default enablement or data conversion.
create function app.get_event_prize_workspace_source_v1(p_tid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();base jsonb;again jsonb;current_setup jsonb;settings_reply jsonb;
 s app.event_settings_snapshots_v3%rowtype;h app.event_prize_heads_v1%rowtype;
 prize jsonb;settings_state jsonb;prize_state jsonb;settings_hash text;event_rows jsonb;
begin
 if app.event_prize_recovery_enabled_source_v1()is distinct from true or a is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 perform 1 from app.tournaments where id=p_tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 base:=app.get_custom_q_setup_base_v2(p_tid)->'base';
 if jsonb_typeof(base)is distinct from'object'or base->>'tournamentId'is distinct from p_tid::text then return null;end if;
 current_setup:=public.get_tournament_setup_workspace(p_tid)->'current';
 if (base->>'setupVersion')::integer=0 then
  if base->'setupRevisionId'is distinct from'null'::jsonb or current_setup is distinct from'null'::jsonb then return null;end if;
 else
  if jsonb_typeof(current_setup)is distinct from'object'or current_setup->>'revisionId'is distinct from base->>'setupRevisionId'or current_setup->'version'is distinct from base->'setupVersion'then return null;end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('eventClientRowId',client_row_id,'eventKind',event_kind)order by client_row_id),'[]'::jsonb)into event_rows
 from app.tournament_setup_event_versions where tournament_id=p_tid and setup_revision_id=(base->>'setupRevisionId')::uuid and event_kind in('main','consolation');
 select*into s from app.event_settings_snapshots_v3 where tournament_id=p_tid and setup_revision_id=(base->>'setupRevisionId')::uuid;
 if s.id is null then
  -- A legacy setup is adoptable only when absence of ALL settings history is
  -- established under the same lock. Never repair a missing/stale head here.
  if exists(select 1 from app.event_settings_snapshots_v3 where tournament_id=p_tid)then return null;end if;
  settings_state:=jsonb_build_object('state','absent','historyExists',false,'snapshot',null,'id',null,'digest',null);
 else
  settings_reply:=app.get_event_settings_workspace_v3(p_tid);
  if settings_reply->>'actorId'is distinct from a::text or settings_reply->>'tid'is distinct from p_tid::text or settings_reply->'base'is distinct from base or jsonb_typeof(settings_reply->'currentSnapshot')is distinct from'object'then return null;end if;
  select request_hash into settings_hash from app.event_settings_save_reservations_v3 where actor_id=s.actor_id and operation_id=s.operation_id and tournament_id=p_tid;
  if settings_hash is null then return null;end if;
  settings_state:=jsonb_build_object('state','present','historyExists',true,'snapshot',settings_reply->'currentSnapshot','id',s.id,'digest',settings_hash);
 end if;
 select*into h from app.event_prize_heads_v1 where tournament_id=p_tid;
 if h.snapshot_id is null then
  if exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=p_tid)then return null;end if;
  prize_state:=jsonb_build_object('state','absent','historyExists',false,'snapshot',null);
 else
  select document into prize from app.event_prize_snapshots_v1 where id=h.snapshot_id and tournament_id=p_tid;
  if not coalesce(app.valid_event_prize_snapshot_source_v1(prize),false)or s.id is null
   or prize->>'setupRevisionId'is distinct from base->>'setupRevisionId'or prize->'setupVersion'is distinct from base->'setupVersion'
   or prize->>'settingsSnapshotId'is distinct from s.id::text or prize->>'settingsDigest'is distinct from settings_hash then return null;end if;
  if jsonb_array_length(prize->'plans')<>jsonb_array_length(event_rows)or exists(
   select 1 from jsonb_array_elements(event_rows)e where(select count(*)from jsonb_array_elements(prize->'plans')p where p->>'eventClientRowId'=e->>'eventClientRowId'and p->>'eventKind'=e->>'eventKind')<>1)then return null;end if;
  prize_state:=jsonb_build_object('state','present','historyExists',true,'snapshot',prize);
 end if;
 again:=app.get_custom_q_setup_base_v2(p_tid)->'base';if again is distinct from base then return null;end if;
 return jsonb_build_object('kind','event-prize-workspace-v1','actorId',a,'tournamentId',p_tid,'base',base,'events',event_rows,'settings',settings_state,'prizes',prize_state,'activationAllowed',false,'accountingAllowed',false,'moneyMoved',false);
exception when lock_not_available then return null;
end$$;
create function public.get_event_prize_workspace_provider_v1(p_tid uuid)returns jsonb
language sql security definer set search_path=''as $$select app.get_event_prize_workspace_source_v1(p_tid);$$;
alter function app.get_event_prize_workspace_source_v1(uuid)owner to postgres;
alter function public.get_event_prize_workspace_provider_v1(uuid)owner to postgres;
revoke all on function app.get_event_prize_workspace_source_v1(uuid)from public,anon,authenticated,service_role;
revoke all on function public.get_event_prize_workspace_provider_v1(uuid)from public,anon,authenticated,service_role;
-- END database/proposals/event-prize-workspace-source-v1.sql

-- BEGIN database/proposals/event-prize-activation-source-v1.sql source SHA256 c1d414088b13fb35e6e962b626c5ae67b38ba2517cac69c4d3ce2129f59d8573
-- PRIVATE LOCAL CANDIDATE, NOT A MIGRATION OR RELEASE. Requires the complete
-- prize save/workspace, context/assessment, guarded operational activation,
-- finance source/backstop and playoff gate proposals. All grants remain revoked.
-- Registration only: new prize mathematics and playoff execution stay blocked.
create function app.event_prize_activation_write_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.event_prize_activation_read_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.event_prize_activation_recovery_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create table app.event_prize_policy_activation_pins_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null references app.tournaments(id),setup_revision_id uuid not null,
 settings_snapshot_id uuid not null references app.event_settings_snapshots_v3(id),
 prize_snapshot_id uuid not null,prize_digest text not null check(prize_digest~'^[0-9a-f]{64}$'),
 request_text text not null check(octet_length(request_text)<=1000000),
 request_payload jsonb not null,request_hash text not null,inner_intent jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id),
 foreign key(prize_snapshot_id,tournament_id)references app.event_prize_snapshots_v1(id,tournament_id),
 foreign key(setup_revision_id,tournament_id)references app.tournament_setup_revisions(id,tournament_id),
 foreign key(actor_id,operation_id,tournament_id)references app.event_settings_activation_intents_v1(actor_id,operation_id,tournament_id)deferrable initially deferred,
 check(request_payload=request_text::jsonb),
 check(request_hash=encode(extensions.digest(convert_to(request_text,'utf8'),'sha256'),'hex')),
 check((request_payload#>>'{activation,request,idempotencyKey}'=operation_id::text)is true),
 check((request_payload#>>'{activation,request,setupRevisionId}'=setup_revision_id::text)is true),
 check((request_payload#>>'{activation,settingsSnapshotId}'=settings_snapshot_id::text)is true),
 check((request_payload->>'prizeSnapshotId'=prize_snapshot_id::text)is true),
 check((request_payload->>'prizeDigest'=prize_digest)is true)
);
alter table app.event_prize_policy_activation_pins_v1 owner to postgres;
alter table app.event_prize_policy_activation_pins_v1 enable row level security;
alter table app.event_prize_policy_activation_pins_v1 force row level security;
revoke all on table app.event_prize_policy_activation_pins_v1 from public,anon,authenticated,service_role;
create trigger event_prize_policy_activation_pins_immutable_v1 before update or delete on app.event_prize_policy_activation_pins_v1
 for each row execute function app.reject_immutable_history();

-- Existing operational rows already reference this exact immutable intent
-- actor/operation/tournament tuple. Join that identity to the outer pin table;
-- do not add columns to those rows: historical to_jsonb(binding) fingerprints
-- must retain their original shape, including historical Finance sources.

create function app.valid_event_prize_activation_outer_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$
 select coalesce(app.event_prize_exact_keys_source_v1(v,array['kind','activation','prizeSnapshotId','prizeDigest','confirmedContext'])
 and v->>'kind'='event-prize-activation-v1'and v->'confirmedContext'='true'::jsonb
 and jsonb_typeof(v->'prizeSnapshotId')='string'and v->>'prizeSnapshotId'~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 and jsonb_typeof(v->'prizeDigest')='string'and v->>'prizeDigest'~'^[0-9a-f]{64}$'
 and app.event_prize_exact_keys_source_v1(v->'activation',array['kind','request','associationHash','settingsSnapshotId','settingsDigest','settingsPins'])
 and v#>>'{activation,kind}'='event-settings-activation-v4'
 and app.event_prize_exact_keys_source_v1(v#>'{activation,request}',array['setupRevisionId','expectedVersion','confirmed','idempotencyKey'])
 and v#>'{activation,request,confirmed}'='true'::jsonb,false);
$$;
create function app.event_prize_activation_inner_v1(v jsonb)returns jsonb
language sql immutable set search_path=''as $$select((v->'activation')-'kind')||jsonb_build_object('kind','event-settings-activation-intent-v1','confirmedContext',true)$$;
create function app.event_prize_policy_ready_v1(v jsonb)returns boolean
language plpgsql immutable set search_path=''as $$
declare factor_text text;
begin
 if not app.valid_event_prize_draft_source_v1(v)then return false;end if;
 if v->>'method'not in('graduated','winner-multiplier')then return true;end if;
 factor_text:=case v->>'method'when'graduated'then v->>'incrementFactorText'else v->>'winnerMultiplierText'end;
 if length(factor_text)>16 or factor_text!~'^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$'then return false;end if;
 return factor_text::numeric between 1 and 1000;
exception when invalid_text_representation or numeric_value_out_of_range then return false;end$$;

-- Private locked source, usable by authenticated preparation and the existing
-- service-only finalizer. Explicit actor is never accepted from a browser RPC.
-- This compares the prize's SAVE hash with its actual save reservation; the V4
-- activation settingsDigest has a different domain and is checked by old proof.
create function app.event_prize_activation_current_v1(tid uuid,actor uuid,op uuid default null)returns jsonb
language plpgsql security definer set search_path=''as $$
declare rev app.tournament_setup_revisions%rowtype;s app.event_settings_snapshots_v3%rowtype;
 pin app.event_prize_policy_activation_pins_v1%rowtype;p jsonb;save_hash text;n integer;
begin
 if current_setting('transaction_isolation')<>'read committed'or actor is null then return null;end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 perform app.lock_event_settings_activation_sources_v1();
 lock table app.event_prize_heads_v1,app.event_prize_snapshots_v1 in share mode nowait;
 select*into rev from app.tournament_setup_revisions where tournament_id=tid order by version desc limit 1;
 select*into s from app.event_settings_snapshots_v3 where tournament_id=tid and setup_revision_id=rev.id;
 if rev.id is null or s.id is null then return null;end if;
 select ps.document into p from app.event_prize_heads_v1 hd join app.event_prize_snapshots_v1 ps on ps.id=hd.snapshot_id and ps.tournament_id=hd.tournament_id where hd.tournament_id=tid;
 select sr.request_hash into save_hash from app.event_settings_save_reservations_v3 sr where sr.actor_id=s.actor_id and sr.operation_id=s.operation_id and sr.tournament_id=tid;
 if not coalesce(app.valid_event_prize_snapshot_source_v1(p),false)or save_hash is null
 or p->>'tournamentId'is distinct from tid::text or p->>'setupRevisionId'is distinct from rev.id::text or p->'setupVersion'is distinct from to_jsonb(rev.version)
 or p->>'settingsSnapshotId'is distinct from s.id::text or p->>'settingsDigest'is distinct from save_hash then return null;end if;
 select count(*)into n from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=rev.id and event_kind in('main','consolation');
 if n<1 or n>32 or jsonb_typeof(s.effective_settings)is distinct from'array'or jsonb_array_length(s.effective_settings)<>n or jsonb_array_length(p->'plans')<>n
 or exists(select 1 from app.tournament_setup_event_versions e where e.tournament_id=tid and e.setup_revision_id=rev.id and(e.event_kind not in('main','consolation','satellite')or e.style_code<>'Standard'or e.format_code<>'standard_singles'))
 or exists(select 1 from app.tournament_setup_event_versions e where e.tournament_id=tid and e.setup_revision_id=rev.id and e.event_kind in('main','consolation')and(
  (select count(*)from jsonb_array_elements(s.effective_settings)x where x->>'eventClientRowId'=e.client_row_id::text and x->>'mode'='configured'and app.valid_event_parameters_raw_v3(x->'draft'))<>1
  or(select count(*)from jsonb_array_elements(p->'plans')x where x->>'eventClientRowId'=e.client_row_id::text and x->>'eventKind'=e.event_kind and x->>'mode'='proposed_v2'and app.event_prize_policy_ready_v1(x->'draft'))<>1))then return null;end if;
 if op is not null then
  select*into pin from app.event_prize_policy_activation_pins_v1 where actor_id=actor and operation_id=op and tournament_id=tid;
  if pin.actor_id is null or pin.setup_revision_id is distinct from rev.id or pin.settings_snapshot_id is distinct from s.id or pin.prize_snapshot_id::text is distinct from p->>'prizeSnapshotId'or pin.prize_digest is distinct from p->>'prizeDigest'then return null;end if;
 end if;
 return jsonb_build_object('setupRevisionId',rev.id,'setupVersion',rev.version,'settingsSnapshotId',s.id,'prizeSnapshotId',p->'prizeSnapshotId','prizeDigest',p->'prizeDigest');
-- Contention is NOT missing/malformed policy. Let callers classify 55P03 as
-- retryable; swallowing it here could journal a permanent pin rejection.
end$$;

-- Create a real series-only assessment by extracting the existing series and
-- context logic. No synthetic/neutral V1 payout is manufactured. Unique anchors
-- fail installation if the reviewed prerequisite definitions have changed.
do $series$declare d text;start_at integer;end_at integer;begin
 d:=pg_get_functiondef('app.assess_event_rule_draft_v1(jsonb,jsonb)'::regprocedure);
 if(length(d)-length(replace(d,'factor_text:=draft->>','')))/length('factor_text:=draft->>')<>1
 or(length(d)-length(replace(d,'regular_format:=app.resolve_event_series_format_v1','')))/length('regular_format:=app.resolve_event_series_format_v1')<>1 then raise exception'Prize series assessment anchors changed';end if;
 start_at:=position('factor_text:=draft->>'in d);end_at:=position('regular_format:=app.resolve_event_series_format_v1'in d);
 if end_at<=start_at then raise exception'Prize series assessment order changed';end if;
 d:=left(d,start_at-1)||substring(d from end_at);
 d:=replace(d,'FUNCTION app.assess_event_rule_draft_v1(','FUNCTION app.assess_event_prize_series_draft_v1(');execute d;
end$series$;
create function app.assess_event_prize_activation_rules_v1(tid uuid,rid uuid,actor uuid,op uuid,draft jsonb,context jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare current_pin jsonb;
begin
 if not exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=tid)then return app.assess_event_rule_draft_v1(draft,context);end if;
 current_pin:=app.event_prize_activation_current_v1(tid,actor,op);
 if current_pin is null or current_pin->>'setupRevisionId'is distinct from rid::text then return jsonb_build_object('status','blocked','code','prize_activation_pin_required','deferredOriginalField',false,'officialApprovalClaimed',false);end if;
 return app.assess_event_prize_series_draft_v1(draft,context);
end$$;

-- Install-time helper, removed below. Every replacement has a unique literal
-- anchor; existing legacy bodies are preserved or retain identical dispatch.
create function app.install_event_prize_patch_v1(fn regprocedure,old_text text,new_text text,new_name text default null)returns void
language plpgsql set search_path=''as $$declare d text;old_name text;begin
 d:=pg_get_functiondef(fn);
 if old_text=''or(length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception'Prize patch anchor changed: %',fn;end if;
 d:=replace(d,old_text,new_text);
 if new_name is not null then old_name:=split_part(fn::text,'(',1);d:=replace(d,'FUNCTION '||old_name||'(','FUNCTION '||new_name||'(');end if;
 execute d;
end$$;

select app.install_event_prize_patch_v1('app.prepare_event_settings_activation_v1(uuid,jsonb)',
 'assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);',
 'assessment:=app.assess_event_prize_activation_rules_v1(tid,(req->>''setupRevisionId'')::uuid,a,op,r.draft,r.context);');
select app.install_event_prize_patch_v1('app.require_event_settings_context_v1()',
 'assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);',
 'assessment:=app.assess_event_prize_activation_rules_v1(new.tournament_id,new.setup_revision_id,new.actor_profile_id,o.client_operation_id,r.draft,r.context);');
select app.install_event_prize_patch_v1('app.bind_event_settings_operational_activation_v1()',
 'assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);',
 'assessment:=app.assess_event_prize_activation_rules_v1(new.tournament_id,new.setup_revision_id,new.actor_profile_id,receipt.client_operation_id,r.draft,r.context);');

-- Preserve the exact old proof; the latest clone changes only scope counting,
-- Main/Con context iteration, and the explicit series-only assessment dispatch.
select app.install_event_prize_patch_v1('app.event_settings_operational_proof_v1(uuid,uuid,uuid)',
 'assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);',
 'assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);','app.event_settings_operational_proof_prize_legacy_v1');
select app.install_event_prize_patch_v1('app.event_settings_operational_proof_v1(uuid,uuid,uuid)',
 'assessment:=app.assess_event_rule_draft_v1(r.draft,r.context);',
 'assessment:=app.assess_event_prize_activation_rules_v1(tid,rid,actor,op,r.draft,r.context);','app.event_settings_operational_proof_prize_latest_v1');
select app.install_event_prize_patch_v1('app.event_settings_operational_proof_prize_latest_v1(uuid,uuid,uuid)',
 'select count(*)into event_count from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=rid;',
 'select count(*)into event_count from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=rid and event_kind in(''main'',''consolation'');');
select app.install_event_prize_patch_v1('app.event_settings_operational_proof_prize_latest_v1(uuid,uuid,uuid)',
 'x.event_kind not in(''main'',''consolation'')or x.style_code',
 'x.event_kind not in(''main'',''consolation'',''satellite'')or x.style_code');
select app.install_event_prize_patch_v1('app.event_settings_operational_proof_prize_latest_v1(uuid,uuid,uuid)',
 'where x.tournament_id=tid and x.setup_revision_id=rid and(select count(*)from jsonb_array_elements(s.effective_settings)',
 'where x.tournament_id=tid and x.setup_revision_id=rid and x.event_kind in(''main'',''consolation'')and(select count(*)from jsonb_array_elements(s.effective_settings)');
select app.install_event_prize_patch_v1('app.event_settings_operational_proof_prize_latest_v1(uuid,uuid,uuid)',
 'for e in select*from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=rid order by client_row_id loop',
 'for e in select*from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=rid and event_kind in(''main'',''consolation'')order by client_row_id loop');
create or replace function app.event_settings_operational_proof_v1(tid uuid,actor uuid,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
begin
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','blocked','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for update nowait;
 if exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=tid)then
  if app.event_prize_activation_current_v1(tid,actor,op)is null then return jsonb_build_object('status','blocked','code','prize_activation_pin_required');end if;
  return app.event_settings_operational_proof_prize_latest_v1(tid,actor,op);
 end if;
 return app.event_settings_operational_proof_prize_legacy_v1(tid,actor,op);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- Bind each Main/Con operational row to the exact outer policy request. Native
-- Satellite activation rows intentionally acquire no series/prize binding.
create function app.bind_event_prize_operational_policy_v1()returns trigger
language plpgsql security definer set search_path=''as $$
begin
 if exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=new.tournament_id)then
  if app.event_prize_activation_current_v1(new.tournament_id,new.intent_actor_id,new.intent_operation_id)is null
   or not exists(select 1 from app.tournament_setup_event_versions where id=new.setup_event_version_id and tournament_id=new.tournament_id and event_kind in('main','consolation'))then raise exception'event_prize_operational_policy_required';end if;
 end if;
 return new;
end$$;
create trigger event_prize_operational_policy_v1 before insert on app.event_settings_operational_bindings_v1
 for each row execute function app.bind_event_prize_operational_policy_v1();

-- A proposed V2 prize plan controls the native insertion boundary even when an
-- older device preserves legacy SERIES settings. Those old context/operational
-- triggers intentionally return early for nonconfigured series; do not let that
-- early return bypass V2 policy protection. Historical rows/replays insert none.
create function app.require_event_prize_native_activation_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare e app.tournament_setup_event_versions%rowtype;p jsonb;receipt app.operation_receipts%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception'event_prize_activation_isolation_not_supported';end if;
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 select*into e from app.tournament_setup_event_versions where id=new.setup_event_version_id and tournament_id=new.tournament_id and setup_revision_id=new.setup_revision_id;
 if not found then raise exception'event_prize_activation_source_changed';end if;
 if e.event_kind not in('main','consolation')then return new;end if;
 select ps.document into p from app.event_prize_heads_v1 h join app.event_prize_snapshots_v1 ps on ps.id=h.snapshot_id and ps.tournament_id=h.tournament_id where h.tournament_id=new.tournament_id;
 if p is null then
  if exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=new.tournament_id)then raise exception'event_prize_activation_source_changed';end if;
  return new;
 end if;
 if p->>'setupRevisionId'is distinct from new.setup_revision_id::text or not app.valid_event_prize_snapshot_source_v1(p)then raise exception'event_prize_activation_source_changed';end if;
 if(select count(*)from jsonb_array_elements(p->'plans')x where x->>'eventClientRowId'=e.client_row_id::text and x->>'eventKind'=e.event_kind)<>1 then raise exception'event_prize_activation_source_changed';end if;
 if not exists(select 1 from jsonb_array_elements(p->'plans')x where x->>'eventClientRowId'=e.client_row_id::text and x->>'eventKind'=e.event_kind and x->>'mode'='proposed_v2')then return new;end if;
 select*into receipt from app.operation_receipts where id=new.operation_receipt_id and tournament_id=new.tournament_id and actor_profile_id=new.actor_profile_id and operation_type='activate_tournament_setup_v2'and outcome='accepted';
 if receipt.id is null or not app.event_settings_operational_guarded_shared_v1(new.tournament_id,new.setup_revision_id,new.actor_profile_id,new.operation_receipt_id)then raise exception'event_prize_activation_pin_required';end if;
 return new;
end$$;
create trigger aaa_event_prize_native_activation_v1 before insert on app.tournament_setup_activations
 for each row execute function app.require_event_prize_native_activation_v1();

-- Existing writer remains the writer. Only latest-path postconditions count
-- configured Main/Con bindings separately from all native activation rows.
select app.install_event_prize_patch_v1('app.finalize_event_settings_operational_activation_v1(uuid,uuid,jsonb)',
 'or binding_count is distinct from native_count',
 'or binding_count is distinct from native_count','app.finalize_event_settings_operational_prize_legacy_v1');
select app.install_event_prize_patch_v1('app.finalize_event_settings_operational_activation_v1(uuid,uuid,jsonb)',
 'or binding_count is distinct from native_count',
 'or binding_count is distinct from(select count(*)from app.tournament_setup_event_versions where tournament_id=p_tournament_id and setup_revision_id=rid and event_kind in(''main'',''consolation''))','app.finalize_event_settings_operational_prize_latest_v1');
select app.install_event_prize_patch_v1('app.finalize_event_settings_operational_prize_latest_v1(uuid,uuid,jsonb)',
 'and activation.setup_revision_id=rid and binding.id is null)',
 'and activation.setup_revision_id=rid and exists(select 1 from app.tournament_setup_event_versions se where se.id=activation.setup_event_version_id and se.event_kind in(''main'',''consolation''))and binding.id is null)');
create or replace function app.finalize_event_settings_operational_activation_v1(p_actor_id uuid,p_tournament_id uuid,p_envelope jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare op uuid;
begin
 if coalesce(auth.role(),'')<>'service_role'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(p_envelope#>>'{request,idempotencyKey}')::uuid;
 perform 1 from app.tournaments where id=p_tournament_id for update nowait;
 if exists(select 1 from app.event_prize_policy_activation_pins_v1 where actor_id=p_actor_id and operation_id=op and tournament_id=p_tournament_id and inner_intent=p_envelope)then
  return app.finalize_event_settings_operational_prize_latest_v1(p_actor_id,p_tournament_id,p_envelope);
 end if;
 -- Exact pre-V2 historical outcomes stay readable. No fresh unpinned attempt
 -- can use the old path after any new prize history exists.
 if exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=p_tournament_id)
 and not exists(select 1 from app.event_settings_operational_outcomes_v1 where actor_id=p_actor_id and operation_id=op and tournament_id=p_tournament_id and request_payload=p_envelope)then return jsonb_build_object('status','rejected','code','prize_activation_pin_required');end if;
 return app.finalize_event_settings_operational_prize_legacy_v1(p_actor_id,p_tournament_id,p_envelope);
exception when invalid_text_representation then return jsonb_build_object('status','rejected','code','invalid_request');
 when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- The common newer Finance source must not interpret dormant V1 payout fields.
-- Legacy accounting insert guards remain installed independently.
select app.install_event_prize_patch_v1('app.operational_event_finance_source_v1(uuid,uuid,uuid)',
 'if b.id is null then return jsonb_build_object(''status'',''blocked'',''code'',''operational_binding_required'');end if;',
 'if b.id is null then return jsonb_build_object(''status'',''blocked'',''code'',''operational_binding_required'');end if; if exists(select 1 from app.event_prize_policy_activation_pins_v1 pp where pp.actor_id=b.intent_actor_id and pp.operation_id=b.intent_operation_id and pp.tournament_id=b.tournament_id)then return jsonb_build_object(''status'',''blocked'',''code'',''new_prize_accounting_required'');end if;');
select app.install_event_prize_patch_v1('app.event_settings_playoff_source_v1(uuid,uuid)',
 'if not found then return jsonb_build_object(''status'',''blocked'',''code'',''settings_binding_required'');end if;',
 'if not found then return jsonb_build_object(''status'',''blocked'',''code'',''settings_binding_required'');end if; if exists(select 1 from app.event_prize_policy_activation_pins_v1 pp where pp.actor_id=b.intent_actor_id and pp.operation_id=b.intent_operation_id and pp.tournament_id=b.tournament_id)then return jsonb_build_object(''status'',''blocked'',''code'',''new_prize_playoff_integration_required'');end if;');

create function app.get_event_prize_activation_source_v1(tid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();w jsonb;src jsonb;reviewed jsonb;
begin
 if app.event_prize_activation_read_enabled_v1()is distinct from true or a is null then return null;end if;
 if app.event_prize_activation_current_v1(tid,a)is null then return jsonb_build_object('status','blocked','code','all_maincon_prize_adoption_required');end if;
 w:=app.get_event_prize_workspace_source_v1(tid);src:=app.get_event_settings_activation_source_v4(tid);reviewed:=app.get_event_settings_reviewed_source_v1(tid);
 if w->>'status'='retry_exact'then return w;end if;if src->>'status'='retry_exact'then return src;end if;if reviewed->>'status'='retry_exact'then return reviewed;end if;
 if w->>'actorId'is distinct from a::text or src->>'status'is distinct from'source_available'or reviewed->>'status'is distinct from'reviewed_source_available'then return jsonb_build_object('status','blocked','code','current_context_review_required');end if;
 return jsonb_build_object('kind','event-prize-activation-source-v1','actorId',a,'tournamentId',tid,'workspace',w,'activationSource',src,'reviews',reviewed#>'{facts,configuredReviews}','registrationOnly',true,'accountingAllowed',false,'playoffStartAllowed',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.event_prize_activation_record_v1(a uuid,tid uuid,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare pin app.event_prize_policy_activation_pins_v1%rowtype;prepared jsonb;activated jsonb;
begin
 select*into pin from app.event_prize_policy_activation_pins_v1 where actor_id=a and operation_id=op and tournament_id=tid;
 if not found then return null;end if;
 select result into prepared from app.event_settings_activation_intents_v1 where actor_id=a and operation_id=op and tournament_id=tid and request_payload=pin.inner_intent;
 if prepared is null then return null;end if;
 select result into activated from app.event_settings_operational_outcomes_v1 where actor_id=a and operation_id=op and tournament_id=tid and request_payload=pin.inner_intent;
 return jsonb_build_object('kind','event-prize-activation-record-v1','actorId',a,'tournamentId',tid,'operationId',op,'requestText',pin.request_text,'requestHash',pin.request_hash,'envelope',pin.request_payload,'preparation',prepared,'activation',activated,'registrationOnly',true,'accountingAllowed',false,'playoffStartAllowed',false,'moneyMoved',false);
end$$;
create function app.prepare_event_prize_activation_v1(tid uuid,request_text text)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();v jsonb;inner_value jsonb;op uuid;pin app.event_prize_policy_activation_pins_v1%rowtype;current_pin jsonb;outcome jsonb;
begin
 if a is null or request_text is null or octet_length(request_text)>1000000 then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 v:=request_text::jsonb;if not app.valid_event_prize_activation_outer_v1(v)then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(v#>>'{activation,request,idempotencyKey}')::uuid;inner_value:=app.event_prize_activation_inner_v1(v);
 if op is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 select*into pin from app.event_prize_policy_activation_pins_v1 where actor_id=a and operation_id=op;
 if found then
  if pin.tournament_id is distinct from tid or pin.request_text is distinct from request_text then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  return app.event_prize_activation_record_v1(a,tid,op);
 end if;
 if app.event_prize_activation_write_enabled_v1()is distinct from true then return jsonb_build_object('status','unavailable','code','feature_disabled');end if;
 if exists(select 1 from app.event_settings_activation_intents_v1 where actor_id=a and operation_id=op)
 or exists(select 1 from app.operation_receipts where actor_profile_id=a and client_operation_id=op)
 or exists(select 1 from app.event_prize_reservations_v1 where actor_id=a and(operation_id=op or nested_operation_id=op))then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 current_pin:=app.event_prize_activation_current_v1(tid,a);
 if current_pin is null or current_pin->>'setupRevisionId'is distinct from v#>>'{activation,request,setupRevisionId}'or current_pin->'setupVersion'is distinct from v#>'{activation,request,expectedVersion}'or current_pin->>'settingsSnapshotId'is distinct from v#>>'{activation,settingsSnapshotId}'or current_pin->>'prizeSnapshotId'is distinct from v->>'prizeSnapshotId'or current_pin->>'prizeDigest'is distinct from v->>'prizeDigest'then return jsonb_build_object('status','rejected','code','prize_source_changed');end if;
 begin
  insert into app.event_prize_policy_activation_pins_v1(actor_id,operation_id,tournament_id,setup_revision_id,settings_snapshot_id,prize_snapshot_id,prize_digest,request_text,request_payload,request_hash,inner_intent)
  values(a,op,tid,(current_pin->>'setupRevisionId')::uuid,(current_pin->>'settingsSnapshotId')::uuid,(current_pin->>'prizeSnapshotId')::uuid,current_pin->>'prizeDigest',request_text,v,encode(extensions.digest(convert_to(request_text,'utf8'),'sha256'),'hex'),inner_value);
  outcome:=app.prepare_event_settings_activation_v1(tid,inner_value);
  if not exists(select 1 from app.event_settings_activation_intents_v1 where actor_id=a and operation_id=op and tournament_id=tid and request_payload=inner_value)then
   if outcome->>'status'='retry_exact'then raise lock_not_available;end if;
   raise exception'event_prize_prepare_not_journaled';
  end if;
  return app.event_prize_activation_record_v1(a,tid,op);
 exception when raise_exception then
  if sqlerrm<>'event_prize_prepare_not_journaled'then raise;end if;
  return coalesce(outcome,jsonb_build_object('status','rejected','code','invalid_request'));
 end;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');
 when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.finalize_event_prize_activation_v1(actor uuid,tid uuid,request_text text)returns jsonb
language plpgsql security definer set search_path=''as $$
declare v jsonb;op uuid;pin app.event_prize_policy_activation_pins_v1%rowtype;outcome jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role'or actor is null or request_text is null or octet_length(request_text)>1000000 then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 v:=request_text::jsonb;if not app.valid_event_prize_activation_outer_v1(v)then return null;end if;op:=(v#>>'{activation,request,idempotencyKey}')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 select*into pin from app.event_prize_policy_activation_pins_v1 where actor_id=actor and operation_id=op and tournament_id=tid;
 if pin.actor_id is null or pin.request_text is distinct from request_text then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 if exists(select 1 from app.event_settings_operational_outcomes_v1 where actor_id=actor and operation_id=op and tournament_id=tid and request_payload=pin.inner_intent)then return app.event_prize_activation_record_v1(actor,tid,op);end if;
 if app.event_prize_activation_write_enabled_v1()is distinct from true then return jsonb_build_object('status','unavailable','code','feature_disabled');end if;
 outcome:=app.finalize_event_settings_operational_activation_v1(actor,tid,pin.inner_intent);
 if not exists(select 1 from app.event_settings_operational_outcomes_v1 where actor_id=actor and operation_id=op and tournament_id=tid and request_payload=pin.inner_intent)then return outcome;end if;
 return app.event_prize_activation_record_v1(actor,tid,op);
exception when invalid_text_representation then return null;
 when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function app.get_event_prize_activation_operation_v1(tid uuid,request_text text)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();v jsonb;op uuid;pin app.event_prize_policy_activation_pins_v1%rowtype;
begin
 if app.event_prize_activation_recovery_enabled_v1()is distinct from true or a is null or request_text is null or octet_length(request_text)>1000000 then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 v:=request_text::jsonb;if not app.valid_event_prize_activation_outer_v1(v)then return null;end if;op:=(v#>>'{activation,request,idempotencyKey}')::uuid;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 select*into pin from app.event_prize_policy_activation_pins_v1 where actor_id=a and operation_id=op;
 if pin.actor_id is null then return jsonb_build_object('status','unknown','code','operation_not_found');end if;
 if pin.tournament_id is distinct from tid or pin.request_text is distinct from request_text then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 return app.event_prize_activation_record_v1(a,tid,op);
exception when invalid_text_representation or lock_not_available then return null;end$$;

create function public.get_event_prize_activation_source_provider_v1(tid uuid)returns jsonb
language sql security definer set search_path=''as $$select app.get_event_prize_activation_source_v1(tid)$$;
create function public.prepare_event_prize_activation_provider_v1(tid uuid,request_text text)returns jsonb
language sql security definer set search_path=''as $$select app.prepare_event_prize_activation_v1(tid,request_text)$$;
create function public.finalize_event_prize_activation_provider_v1(actor uuid,tid uuid,request_text text)returns jsonb
language sql security definer set search_path=''as $$select app.finalize_event_prize_activation_v1(actor,tid,request_text)$$;
create function public.get_event_prize_activation_operation_provider_v1(tid uuid,request_text text)returns jsonb
language sql security definer set search_path=''as $$select app.get_event_prize_activation_operation_v1(tid,request_text)$$;

drop function app.install_event_prize_patch_v1(regprocedure,text,text,text);
do $acl$declare f regprocedure;begin
 foreach f in array array[
 'app.event_prize_activation_write_enabled_v1()'::regprocedure,'app.event_prize_activation_read_enabled_v1()'::regprocedure,'app.event_prize_activation_recovery_enabled_v1()'::regprocedure,
 'app.valid_event_prize_activation_outer_v1(jsonb)'::regprocedure,'app.event_prize_activation_inner_v1(jsonb)'::regprocedure,'app.event_prize_policy_ready_v1(jsonb)'::regprocedure,
 'app.event_prize_activation_current_v1(uuid,uuid,uuid)'::regprocedure,'app.assess_event_prize_series_draft_v1(jsonb,jsonb)'::regprocedure,'app.assess_event_prize_activation_rules_v1(uuid,uuid,uuid,uuid,jsonb,jsonb)'::regprocedure,
 'app.event_settings_operational_proof_prize_legacy_v1(uuid,uuid,uuid)'::regprocedure,'app.event_settings_operational_proof_prize_latest_v1(uuid,uuid,uuid)'::regprocedure,'app.bind_event_prize_operational_policy_v1()'::regprocedure,'app.require_event_prize_native_activation_v1()'::regprocedure,
 'app.finalize_event_settings_operational_prize_legacy_v1(uuid,uuid,jsonb)'::regprocedure,'app.finalize_event_settings_operational_prize_latest_v1(uuid,uuid,jsonb)'::regprocedure,
 'app.get_event_prize_activation_source_v1(uuid)'::regprocedure,'app.event_prize_activation_record_v1(uuid,uuid,uuid)'::regprocedure,'app.prepare_event_prize_activation_v1(uuid,text)'::regprocedure,
 'app.finalize_event_prize_activation_v1(uuid,uuid,text)'::regprocedure,'app.get_event_prize_activation_operation_v1(uuid,text)'::regprocedure,
 'public.get_event_prize_activation_source_provider_v1(uuid)'::regprocedure,'public.prepare_event_prize_activation_provider_v1(uuid,text)'::regprocedure,
 'public.finalize_event_prize_activation_provider_v1(uuid,uuid,text)'::regprocedure,'public.get_event_prize_activation_operation_provider_v1(uuid,text)'::regprocedure
 ]loop execute format('alter function %s owner to postgres',f);execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;
end$acl$;
-- END database/proposals/event-prize-activation-source-v1.sql

-- BEGIN database/proposals/event-prize-rule-context-source-v1.sql source SHA256 33b0fc2914752d92aac17b874f7ddf22fb929b96393552671156a40304ff6495
-- PRIVATE LOCAL RULE-CONTEXT UI SOURCE. Not a migration or release.
-- Depends on event-prize-activation-source-v1 and existing rule-context journal.
-- No grants, inferred sanctioning, external approval, calculation or payment.
create function app.event_prize_rule_context_read_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.event_prize_rule_context_write_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.event_prize_rule_context_recovery_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.get_event_prize_rule_context_source_v1(tid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();current_pin jsonb;w jsonb;s app.event_settings_snapshots_v3%rowtype;
 e app.tournament_setup_event_versions%rowtype;r app.event_rule_context_reviews_v1%rowtype;
 item jsonb;review_value jsonb;assessment jsonb;rows_value jsonb:='[]';
 authorized boolean;is_current boolean;eligible boolean;deferred boolean;all_eligible boolean:=true;guard_available boolean;
begin
 if app.event_prize_rule_context_read_enabled_v1()is distinct from true or a is null then return null;end if;
 current_pin:=app.event_prize_activation_current_v1(tid,a);
 if current_pin is null then return jsonb_build_object('status','blocked','code','all_maincon_prize_adoption_required');end if;
 -- current_v1 holds current role/tournament/source locks, including immutable
 -- context history. Direct latest-version lookup proves absence, never a DTO.
 w:=app.get_event_prize_workspace_source_v1(tid);
 if w->>'status'='retry_exact'then return w;end if;
 if w->>'actorId'is distinct from a::text or w#>>'{settings,state}'is distinct from'present'then return null;end if;
 select*into s from app.event_settings_snapshots_v3 where id=(current_pin->>'settingsSnapshotId')::uuid and tournament_id=tid and setup_revision_id=(current_pin->>'setupRevisionId')::uuid;
 guard_available:=app.event_settings_deferred_guard_available_v1();
 for e in select*from app.tournament_setup_event_versions where tournament_id=tid and setup_revision_id=s.setup_revision_id and event_kind in('main','consolation')order by ordinal,client_row_id loop
  select value into item from jsonb_array_elements(s.effective_settings)x where x->>'eventClientRowId'=e.client_row_id::text;
  if item->>'mode'is distinct from'configured'then return jsonb_build_object('status','blocked','code','configured_settings_required');end if;
  select*into r from app.event_rule_context_reviews_v1 where tournament_id=tid and event_client_row_id=e.client_row_id order by version desc limit 1;
  if r.id is null then
   review_value:=jsonb_build_object('state','absent','historyExists',false);all_eligible:=false;
  else
   perform 1 from app.tournament_roles where tournament_id=tid and profile_id=r.actor_id and role in('director','co_director')order by role for share nowait;authorized:=found;
   is_current:=authorized and r.setup_revision_id=s.setup_revision_id and r.settings_snapshot_id=s.id and r.setup_event_version_id=e.id and r.draft=item->'draft'and r.context->>'eventKind'=e.event_kind;
   assessment:=app.assess_event_prize_series_draft_v1(r.draft,r.context);
   deferred:=assessment->'deferredOriginalField'='true'::jsonb;
   eligible:=is_current and assessment->>'status'='eligible'and(not deferred or guard_available);
   review_value:=jsonb_build_object('state','present','historyExists',true,'reviewId',r.id,'actorId',r.actor_id,'version',r.version,'setupRevisionId',r.setup_revision_id,'setupEventVersionId',r.setup_event_version_id,'settingsSnapshotId',r.settings_snapshot_id,'draftDigest',r.draft_digest,'draft',r.draft,'context',r.context,'reason',r.reason,'approvalReference',r.approval_reference,'reviewerAuthorized',authorized,'current',is_current,'eligible',eligible,'deferredOriginalField',deferred);
   all_eligible:=all_eligible and eligible;
  end if;
  rows_value:=rows_value||jsonb_build_array(jsonb_build_object('eventClientRowId',e.client_row_id,'eventKind',e.event_kind,'setupEventVersionId',e.id,'displayName',e.display_name,'draft',item->'draft','review',review_value));
 end loop;
 return jsonb_build_object('kind','event-prize-rule-context-workspace-v1','actorId',a,'tournamentId',tid,'setupRevisionId',current_pin->'setupRevisionId','setupVersion',current_pin->'setupVersion','settingsSnapshotId',s.id,'settingsDigest',w#>'{settings,digest}','rows',rows_value,'deferredGuardAvailable',guard_available,'allCurrentEligible',all_eligible,'activationAllowed',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- Current-role-owned exact journal lookup. Current settings and context heads
-- are deliberately not required to recover an earlier completed request.
create function app.event_prize_rule_context_operation_v1(tid uuid,request_value jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;r app.event_rule_context_operations_v1%rowtype;
begin
 if a is null or jsonb_typeof(request_value)is distinct from'object'or octet_length(request_value::text)>1000000 then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 op:=(request_value->>'operationId')::uuid;if op is null then return null;end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in('director','co_director')order by role for share nowait;if not found then return null;end if;
 select*into r from app.event_rule_context_operations_v1 where actor_id=a and operation_id=op;
 if r.actor_id is null then return jsonb_build_object('status','unknown','code','operation_not_found');end if;
 if r.tournament_id is distinct from tid or r.request_payload is distinct from request_value then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 return jsonb_build_object('kind','event-prize-rule-context-operation-v1','actorId',a,'tournamentId',tid,'operationId',op,'request',r.request_payload,'result',r.result);
exception when invalid_text_representation then return null;
 when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;
create function app.save_event_prize_rule_context_v1(tid uuid,request_value jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare result_value jsonb;record_value jsonb;
begin
 if app.event_prize_rule_context_write_enabled_v1()is distinct from true then return jsonb_build_object('status','unavailable','code','feature_disabled');end if;
 result_value:=app.save_event_rule_context_v1(tid,request_value);
 -- Prefer the immutable original result; replay decoration is not an ACK.
 record_value:=app.event_prize_rule_context_operation_v1(tid,request_value);
 if record_value->>'kind'='event-prize-rule-context-operation-v1' then return record_value;end if;
 return result_value;
end$$;
create function app.get_event_prize_rule_context_operation_v1(tid uuid,request_value jsonb)returns jsonb
language sql security definer set search_path=''as $$select case when app.event_prize_rule_context_recovery_enabled_v1()is true then app.event_prize_rule_context_operation_v1(tid,request_value)else null end$$;
create function public.get_event_prize_rule_context_source_provider_v1(tid uuid)returns jsonb
language sql security definer set search_path=''as $$select app.get_event_prize_rule_context_source_v1(tid)$$;
create function public.save_event_prize_rule_context_provider_v1(tid uuid,request_value jsonb)returns jsonb
language sql security definer set search_path=''as $$select app.save_event_prize_rule_context_v1(tid,request_value)$$;
create function public.get_event_prize_rule_context_operation_provider_v1(tid uuid,request_value jsonb)returns jsonb
language sql security definer set search_path=''as $$select app.get_event_prize_rule_context_operation_v1(tid,request_value)$$;
do $acl$declare f regprocedure;begin
 foreach f in array array[
 'app.event_prize_rule_context_read_enabled_v1()'::regprocedure,'app.event_prize_rule_context_write_enabled_v1()'::regprocedure,'app.event_prize_rule_context_recovery_enabled_v1()'::regprocedure,
 'app.get_event_prize_rule_context_source_v1(uuid)'::regprocedure,'app.event_prize_rule_context_operation_v1(uuid,jsonb)'::regprocedure,
 'app.save_event_prize_rule_context_v1(uuid,jsonb)'::regprocedure,'app.get_event_prize_rule_context_operation_v1(uuid,jsonb)'::regprocedure,
 'public.get_event_prize_rule_context_source_provider_v1(uuid)'::regprocedure,'public.save_event_prize_rule_context_provider_v1(uuid,jsonb)'::regprocedure,'public.get_event_prize_rule_context_operation_provider_v1(uuid,jsonb)'::regprocedure
 ]loop execute format('alter function %s owner to postgres',f);execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;
end$acl$;
-- END database/proposals/event-prize-rule-context-source-v1.sql

-- BEGIN database/proposals/native-mixed-pool-amounts-v1.sql source SHA256 c916aba5f4e08c1e424aa9034fb9dca1f273f09ee77a497002a3162aecdf4707
-- PRIVATE LOCAL CANDIDATE. No journal/schema installation, grant or recipient authority.
create function app.native_mixed_pool_amounts_v1(policy jsonb,paid_count integer,recipient_count integer)returns jsonb
language plpgsql immutable set search_path=''as $$
declare kind text;method text;fee numeric;ratio numeric;unit numeric;fund numeric;k integer;d numeric;den numeric;num numeric;raw jsonb:='[]';
 amounts numeric[]:='{}';rem numeric[]:='{}';nums numeric[]:='{}';dens numeric[]:='{}';total numeric:=0;missing integer;i integer;j integer;branch text;
 a numeric;b numeric;t numeric;each_amount numeric;key text;code text;
begin
 if jsonb_typeof(policy)is distinct from'object'then return jsonb_build_object('status','blocked','code','invalid_policy');end if;
 if(select count(*)from jsonb_object_keys(policy))<>6 or not(policy?&array['version','kind','method','feeMinor','ratio','roundingUnitMinor'])then return jsonb_build_object('status','blocked','code','invalid_policy');end if;
 kind:=policy->>'kind';method:=policy->>'method';
 if policy->>'version'is distinct from'native-mixed-pool-policy-v1'or kind is null or kind not in('q','side')or jsonb_typeof(policy->'feeMinor')is distinct from'number'or jsonb_typeof(policy->'roundingUnitMinor')is distinct from'number'then return jsonb_build_object('status','blocked','code','invalid_policy');end if;
 fee:=(policy->>'feeMinor')::numeric;unit:=(policy->>'roundingUnitMinor')::numeric;
 if fee<>trunc(fee)or abs(fee)>9007199254740991 or unit not in(100,500,1000)then return jsonb_build_object('status','blocked','code','invalid_policy');end if;
 if paid_count is null or paid_count not between 1 and 10000 or recipient_count is null or recipient_count not between 1 and paid_count then return jsonb_build_object('status','blocked','code','invalid_counts');end if;
 k:=recipient_count;fund:=paid_count::numeric*fee;
 if method='q-equal-exact-selected-step-v1'then
  if kind<>'q'or policy->'ratio'is distinct from'null'::jsonb or fee not between 100 and 100000000 or mod(fee,100)<>0 then return jsonb_build_object('status','blocked','code','invalid_equal_policy');end if;
  if mod(fund,k::numeric*unit)<>0 then return jsonb_build_object('status','blocked','code','equal_split_not_exact');end if;
  branch:='equal';each_amount:=(fund/k)::bigint;
  for j in 1..k loop amounts:=array_append(amounts,each_amount);nums:=array_append(nums,each_amount);dens:=array_append(dens,1);end loop;
 else
  if jsonb_typeof(policy->'ratio')is distinct from'number'then return jsonb_build_object('status','blocked','code','invalid_ratio_or_recipient_count');end if;
  ratio:=(policy->>'ratio')::numeric;
  if ratio<>trunc(ratio)or ratio not between 1 and 2147483647 then return jsonb_build_object('status','blocked','code','invalid_ratio_or_recipient_count');end if;
  if k<>ceil(paid_count::numeric/ratio)then return jsonb_build_object('status','blocked','code','invalid_ratio_or_recipient_count');end if;
  if kind='q'and method='q-v3-raw-selected-step-v1'then
   if fee not between 500 and 100000000 then return jsonb_build_object('status','blocked','code','unsupported_fee');end if;
   if mod(fee,500)<>0 then return jsonb_build_object('status','blocked','code','unsupported_lattice');end if;
   if mod(fund,unit)<>0 then return jsonb_build_object('status','blocked','code','fund_not_divisible_by_step');end if;
   d:=k::numeric*(k+1)/2;
   branch:=case when k=1 then'single_recipient'when fund>d*fee then'descending_linear'else'entry_fee_floor'end;
  elsif kind='side'and method='side-sheet20-40-selected-step-v1'then
   if fee not in(1000,2000,5000,10000)then return jsonb_build_object('status','blocked','code','unverified_fee_tab');end if;
   if k>(case when fee=1000 then 56 else 128 end)then return jsonb_build_object('status','blocked','code','verified_weight_row_capacity_exceeded');end if;
   if mod(fund,unit)<>0 then return jsonb_build_object('status','blocked','code','fund_not_divisible_by_increment');end if;
   d:=k::numeric*(k+1)/2;branch:=case when fund>4000*d then'descending_linear'else'fixed_20_dollar_baseline'end;
   if branch='fixed_20_dollar_baseline'and fund<2000*k then return jsonb_build_object('status','blocked','code','fund_below_sheet_baseline');end if;
   if branch='fixed_20_dollar_baseline'and k=1 then return jsonb_build_object('status','blocked','code','one_recipient_baseline_formula_unverified');end if;
  else return jsonb_build_object('status','blocked','code','method_kind_mismatch');end if;
  for j in 1..k loop
   if branch='single_recipient'then num:=fund;den:=1;
   elsif branch='descending_linear'then num:=fund*(k-j+1);den:=d;
   else den:=d-k;num:=(case when kind='q'then fee else 2000 end)*den+(fund-(case when kind='q'then fee else 2000 end)*k)*(k-j);end if;
   amounts:=array_append(amounts,floor(num/(den*unit))*unit);rem:=array_append(rem,mod(num,den*unit));total:=total+amounts[j];
   a:=num;b:=den;while b<>0 loop t:=mod(a,b);a:=b;b:=t;end loop;nums:=array_append(nums,num/a);dens:=array_append(dens,den/a);
  end loop;
  if total>fund or mod(fund-total,unit)<>0 then return jsonb_build_object('status','blocked','code','unsupported_conservation');end if;
  missing:=((fund-total)/unit)::integer;if missing<0 or missing>=k then return jsonb_build_object('status','blocked','code','unsupported_conservation');end if;
  -- Every raw denominator within this branch is shared; exact remainder order.
  for i in select x from generate_subscripts(rem,1)x order by rem[x]desc,x limit missing loop amounts[i]:=amounts[i]+unit;end loop;
  if(select sum(x)from unnest(amounts)x)<>fund or exists(select 1 from generate_subscripts(amounts,1)x where amounts[x]<(case when kind='q'then fee else 2000 end)or mod(amounts[x],unit)<>0 or(x>1 and amounts[x]>amounts[x-1]))then
   code:=case when kind='q'then'rounding_below_fee_floor'else'selected_increment_violates_baseline_or_order'end;return jsonb_build_object('status','blocked','code',code);end if;
 end if;
 select jsonb_agg(jsonb_build_object('numeratorMinor',trunc(nums[x])::text,'denominator',trunc(dens[x])::text)order by x)into raw from generate_subscripts(nums,1)x;
 return jsonb_build_object('status','calculated','calculationVersion','native-mixed-pool-amounts-v1','amountPolicy',policy,'paidCount',paid_count,'recipientCount',k,'fundMinor',fund,'roundingUnitMinor',unit,'branch',branch,'awardsMinor',to_jsonb(amounts),'unroundedAwards',raw,'refunds','[]'::jsonb,'recipientSelectionPerformed',false,'financialFinalizationAllowed',false,'moneyMoved',false);
end$$;
alter function app.native_mixed_pool_amounts_v1(jsonb,integer,integer)owner to postgres;
revoke all on function app.native_mixed_pool_amounts_v1(jsonb,integer,integer)from public,anon,authenticated,service_role;

-- END database/proposals/native-mixed-pool-amounts-v1.sql

-- BEGIN database/proposals/native-mixed-pool-finance-v1.sql source SHA256 6b3f51e33a809dddd14173d14af75c4ba109163c82760e7aef475bde50d9bf4c
-- PRIVATE LOCAL CANDIDATE. Requires native mixed funding/review and pool amounts V1.
-- UNPAID SIMULATED obligations only. No ordinary payment, attendance, liability,
-- refund, disbursement, public capability or historical policy is changed.
create function app.native_mixed_pool_finance_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.native_mixed_pool_exact_v1(v jsonb,keys text[])returns boolean
language sql immutable set search_path=''as $$select case when jsonb_typeof(v)='object'
 then (select count(*)from jsonb_object_keys(v))=cardinality(keys)and v?&keys else false end$$;
-- The existing subject helper locks current user/session records. This new
-- boundary also checks the JWT expiry itself, including direct SQL callers.
create function app.native_mixed_pool_actor_v1()returns uuid
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;claims jsonb;expires numeric;begin
 actor:=app.native_mixed_game_own_subject_v1();if actor is null then return null;end if;
 claims:=auth.jwt();
 if jsonb_typeof(claims->'exp')is distinct from'number'or coalesce(claims->>'exp','')!~'^[0-9]{1,16}$'then return null;end if;
 expires:=(claims->>'exp')::numeric;if expires<=extract(epoch from clock_timestamp())then return null;end if;
 return actor;
end$$;

create table app.native_mixed_pool_operations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,receipt_id uuid not null unique,
 record_id uuid not null,request_payload jsonb not null,request_hash text not null,
 response_payload jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 check(request_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array(
  'native-mixed-pool-finance-v1',actor_id,operation_id,tournament_id,event_id,request_payload)))
);
create table app.native_mixed_pool_records_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 entity_key text not null check(length(entity_key)between 1 and 180),version integer not null check(version>0),
 prior_id uuid,kind text not null check(kind in('policy','election','funding','seal','final')),
 actor_id uuid not null,operation_id uuid not null,payload jsonb not null,source_digest text not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id,entity_key,version),unique(id,tournament_id,event_id,entity_key),
 unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_mixed_pool_operations_v1(actor_id,operation_id,tournament_id,event_id),
 foreign key(prior_id,tournament_id,event_id,entity_key)references app.native_mixed_pool_records_v1(id,tournament_id,event_id,entity_key),
 check((version=1 and prior_id is null)or(version>1 and prior_id is not null)),
 check(source_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array(
  'native-mixed-pool-record-v1',id,tournament_id,event_id,entity_key,version,prior_id,kind,actor_id,operation_id,payload)))
);
alter table app.native_mixed_pool_operations_v1 add foreign key(record_id,tournament_id,event_id)
 references app.native_mixed_pool_records_v1(id,tournament_id,event_id)deferrable initially deferred;
create table app.native_mixed_pool_obligations_v1(
 id uuid primary key default extensions.gen_random_uuid(),final_record_id uuid not null,policy_record_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,participant_id uuid not null,
 amount_minor bigint not null check(amount_minor>0),rounding_unit_minor integer not null check(rounding_unit_minor in(100,500,1000)),
 status text not null default'UNPAID_SIMULATED'check(status='UNPAID_SIMULATED'),
 actual_money_received boolean not null default false check(not actual_money_received),
 ordinary_liability boolean not null default false check(not ordinary_liability),
 money_moved boolean not null default false check(not money_moved),
 unique(final_record_id,policy_record_id,participant_id),
 foreign key(final_record_id,tournament_id,event_id)references app.native_mixed_pool_records_v1(id,tournament_id,event_id),
 foreign key(policy_record_id,tournament_id,event_id)references app.native_mixed_pool_records_v1(id,tournament_id,event_id),
 foreign key(participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 check(amount_minor%rounding_unit_minor=0)
);
do $security$declare n text;begin foreach n in array array[
 'native_mixed_pool_operations_v1','native_mixed_pool_records_v1','native_mixed_pool_obligations_v1']loop
 execute format('alter table app.%I owner to postgres',n);
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',n);
 execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',n);
end loop;end$security$;

create function app.native_mixed_pool_journal_digest_v1(tid uuid,eid uuid)returns text
language sql stable security definer set search_path=''as $$select app.native_mixed_simulation_hash_v1(
 coalesce(jsonb_agg(jsonb_build_array(entity_key,version,source_digest)order by entity_key,version),'[]'))
 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid$$;

-- Read the saved activated setup, not a caller's fee/ratio or display name.
create function app.native_mixed_pool_setup_v1(tid uuid,eid uuid,kind text,pool uuid,funding jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare intent app.native_mixed_admission_intents_v1%rowtype;s app.native_mixed_funding_scopes_v1%rowtype;
 q jsonb;definition jsonb;ratio text;method text;fee integer;
begin
 select*into s from app.native_mixed_funding_scopes_v1 where id=(funding#>>'{scope,scopeId}')::uuid and tournament_id=tid and event_id=eid;
 select*into intent from app.native_mixed_admission_intents_v1 where id=s.admission_intent_id and tournament_id=tid and event_id=eid;
 if intent.id is null then return null;end if;
 if kind='q'then
  select to_jsonb(x)into q from app.tournament_setup_q_pool_versions x where x.id=pool and x.tournament_id=tid
   and x.setup_event_version_id=(intent.setup_event_capture->>'id')::uuid;
  if q is null then return null;end if;fee:=(q->>'entry_fee_cents')::integer;
  if q->>'pool_type_code'='Equal (Pays All Equally)'then method:='q-equal-exact-selected-step-v1';ratio:=null;
  elsif q->>'pool_type_code'~'^Graduated \(1-in-[1-9][0-9]*\)$'then
   method:='q-v3-raw-selected-step-v1';ratio:=substring(q->>'pool_type_code'from'1-in-([0-9]+)');
  else return null;end if;
 elsif kind='side'then
  select to_jsonb(x)into q from app.tournament_setup_side_pool_materializations m
   join app.tournament_setup_side_pool_versions x on x.id=m.setup_side_pool_version_id and x.tournament_id=m.tournament_id
   where m.tournament_id=tid and m.event_id=eid and m.pool_id=pool
   and x.setup_event_version_id=(intent.setup_event_capture->>'id')::uuid;
  select to_jsonb(x)into definition from app.event_side_pool_definition_versions x
   where x.tournament_id=tid and x.event_id=eid and x.pool_id=pool order by x.version desc limit 1;
  if q is null or definition is null or definition->'active'is distinct from'true'::jsonb
   or q->'entry_fee_cents'is distinct from definition->'entry_fee_minor'then return null;end if;
  fee:=(q->>'entry_fee_cents')::integer;method:='side-sheet20-40-selected-step-v1';
  if q->>'payout_type'~'^graduated-1-in-[1-9][0-9]*$'then ratio:=substring(q->>'payout_type'from'1-in-([0-9]+)');
  elsif q->>'payout_type'is null and coalesce(q->>'custom_ratio_denominator_v3','')~'^[1-9][0-9]*$'then ratio:=q->>'custom_ratio_denominator_v3';
  else return null;end if;
 else return null;end if;
 if fee<=0 or(ratio is not null and(ratio::numeric<1 or ratio::numeric>2147483647))then return null;end if;
 return jsonb_build_object('kind',kind,'poolId',pool,'setup',q,'definition',definition,
  'admissionIntentId',intent.id,'setupEventVersionId',intent.setup_event_capture->'id',
  'method',method,'feeMinor',fee,'ratio',case when ratio is null then null else ratio::integer end);
end$$;

-- New pools are sealed before an existing native Start. No-policy starts are unchanged.
create function app.native_mixed_pool_start_guard_v1()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=new.tournament_id and event_id=new.event_id and kind='policy')
 and not exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=new.tournament_id and event_id=new.event_id and kind='seal')
 then raise exception using errcode='P0001',message='native_pool_seal_before_start_required';end if;return new;
end$$;
create trigger native_pool_seal_guard_v1 before insert on app.native_mixed_simulation_starts_v1
 for each row execute function app.native_mixed_pool_start_guard_v1();

create function app.execute_native_mixed_pool_finance_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;action text;data jsonb;funding jsonb;setup_source jsonb;amount_policy jsonb;latest_prize jsonb;saved_rounding text;
 old app.native_mixed_pool_operations_v1%rowtype;head app.native_mixed_pool_records_v1%rowtype;
 policy app.native_mixed_pool_records_v1%rowtype;el app.native_mixed_pool_records_v1%rowtype;
 seal app.native_mixed_pool_records_v1%rowtype;part jsonb;entry jsonb;record_payload jsonb;response jsonb;
 key text;requested_kind text;pool uuid;rid uuid:=extensions.gen_random_uuid();receipt uuid:=extensions.gen_random_uuid();
 h text;rh text;journal text;seq integer;prior uuid;code text;review jsonb;cards jsonb;ranked jsonb;
 policy_rows jsonb:='[]';elections jsonb;contributions jsonb;results jsonb:='[]';awards jsonb;calc jsonb;
 paid integer;recipients integer;fund bigint;unit integer;i integer;item jsonb;ob jsonb;is_director boolean;
begin
 if app.native_mixed_pool_finance_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 actor:=app.native_mixed_pool_actor_v1();
 if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1 in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 if tid is null or eid is null or op is null or not app.native_mixed_pool_exact_v1(request,array['version','action','expectedJournalDigest','data','reason'])
  or request->>'version'is distinct from'native-mixed-pool-request-v1'
  or coalesce(request->>'expectedJournalDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'<>trim(request->>'reason')
  or length(request->>'reason')not between 1 and 500 or request->>'reason'~'[[:cntrl:]]'
 then raise exception using errcode='P0001',message='native_pool_invalid_request';end if;
 action:=request->>'action';data:=request->'data';
 if action is null or action not in('policy','elect','fund','seal','final')then raise exception using errcode='P0001',message='native_pool_invalid_request';end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;
 is_director:=found;
 if action<>'elect'and not is_director then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))
 then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 select*into old from app.native_mixed_pool_operations_v1 where actor_id=actor and operation_id=op;
 if old.operation_id is not null then
  if old.tournament_id<>tid or old.event_id<>eid or old.request_payload<>request then raise exception using errcode='P0001',message='native_pool_operation_conflict';end if;
  if action='elect'and not is_director and not exists(select 1 from app.native_mixed_pool_records_v1 r
   where r.id=old.record_id and r.kind='election'and r.payload#>>'{participant,mode}'='digital'and r.payload#>>'{participant,profileId}'=actor::text)
  then return null;end if;
  if not exists(select 1 from app.operation_receipts r join app.native_mixed_pool_records_v1 x on x.id=old.record_id
   where r.id=old.receipt_id and r.actor_profile_id=actor and r.client_operation_id=op and r.tournament_id=tid
   and r.operation_type='native_mixed_pool_simulation_v1'and r.request_hash=old.request_hash and r.outcome='accepted'
   and r.response_payload=old.response_payload and x.actor_id=actor and x.operation_id=op)
  then raise exception using errcode='P0001',message='native_pool_journal_integrity';end if;
  return old.response_payload||jsonb_build_object('replayed',true,'current',false,'historicalReceipt',true);
 end if;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true then raise exception using errcode='P0001',message='native_pool_operation_conflict';end if;
 funding:=app.native_mixed_funding_seal_source_v1(tid,eid);
 if funding->>'status'is distinct from'source_available'then raise exception using errcode='P0001',message='native_pool_current_funding_required';end if;
 lock table app.native_mixed_pool_operations_v1,app.native_mixed_pool_records_v1,app.native_mixed_pool_obligations_v1 in share row exclusive mode nowait;
 lock table app.tournament_setup_q_pool_versions,app.tournament_setup_side_pool_versions,
  app.tournament_setup_side_pool_materializations,app.event_side_pool_definition_versions in share mode nowait;
 journal:=app.native_mixed_pool_journal_digest_v1(tid,eid);
 if journal<>request->>'expectedJournalDigest'then raise exception using errcode='P0001',message='native_pool_source_changed';end if;
 if action<>'final'and exists(select 1 from app.native_mixed_simulation_starts_v1 where tournament_id=tid and event_id=eid)
 then raise exception using errcode='P0001',message='native_pool_prestart_required';end if;
 if exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='final')
 then raise exception using errcode='P0001',message='native_pool_already_final';end if;
 if action not in('final','seal')and exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='seal')
 then raise exception using errcode='P0001',message='native_pool_membership_sealed';end if;

 if action='policy'then
  if not app.native_mixed_pool_exact_v1(data,array['kind','poolId','amountPolicy','disclosure','expectedFundingDigest'])
   or data->>'expectedFundingDigest'is distinct from funding->>'sourceDigest'
   or jsonb_typeof(data->'disclosure')is distinct from'string'or length(trim(data->>'disclosure'))not between 1 and 1000
  then raise exception using errcode='P0001',message='native_pool_invalid_request';end if;
  requested_kind:=data->>'kind';pool:=(data->>'poolId')::uuid;amount_policy:=data->'amountPolicy';
  setup_source:=app.native_mixed_pool_setup_v1(tid,eid,requested_kind,pool,funding);
  if setup_source is null or not app.native_mixed_pool_exact_v1(amount_policy,array['version','kind','method','feeMinor','ratio','roundingUnitMinor'])
   or amount_policy->>'version'is distinct from'native-mixed-pool-policy-v1'or amount_policy->>'kind'is distinct from requested_kind
   or amount_policy->'feeMinor'is distinct from setup_source->'feeMinor'or amount_policy->'ratio'is distinct from setup_source->'ratio'
   or amount_policy->'method'is distinct from setup_source->'method'or amount_policy->'roundingUnitMinor'not in('100'::jsonb,'500'::jsonb,'1000'::jsonb)
  then raise exception using errcode='P0001',message='native_pool_saved_policy_mismatch';end if;
  -- The current seal proves the entire immutable funding/base capture. Latest
  -- saved rounding is a setting, not a caller-selectable override here.
  -- Legacy captures have no latestPrize and retain their original behavior.
  select s.source_capture#>'{baseSource,latestPrize}'into latest_prize
   from app.native_mixed_funding_scopes_v1 s
   where s.id=(funding#>>'{scope,scopeId}')::uuid and s.tournament_id=tid and s.event_id=eid;
  if latest_prize is not null then
   saved_rounding:=latest_prize#>>array['plan','draft','rounding',case when requested_kind='q'then'qPool'else'sidePool'end];
   if latest_prize->>'kind'is distinct from'native-mixed-latest-prize-pin-v1'
    or saved_rounding is null or saved_rounding not in('1','5','10')then
    raise exception using errcode='P0001',message='native_pool_saved_rounding_unavailable';end if;
   if amount_policy->'roundingUnitMinor'is distinct from to_jsonb(saved_rounding::integer*100)then
    raise exception using errcode='P0001',message='native_pool_saved_rounding_mismatch';end if;
  end if;
  if(requested_kind='side'and(amount_policy->>'feeMinor')::integer not in(1000,2000,5000,10000))
   or(requested_kind='q'and amount_policy->>'method'='q-v3-raw-selected-step-v1'and((amount_policy->>'feeMinor')::integer<500 or(amount_policy->>'feeMinor')::integer%500<>0))
   or(requested_kind='q'and amount_policy->>'method'='q-equal-exact-selected-step-v1'and(amount_policy->>'feeMinor')::integer%100<>0)
  then raise exception using errcode='P0001',message='native_pool_unsupported_amount_domain';end if;
  key:='policy:'||requested_kind||':'||pool::text;
  if exists(select 1 from app.native_mixed_pool_records_v1 e join app.native_mixed_pool_records_v1 p on p.id=(e.payload->>'policyId')::uuid
   where e.tournament_id=tid and e.event_id=eid and e.kind='election'and p.entity_key=key)
  then raise exception using errcode='P0001',message='native_pool_policy_has_elections';end if;
  record_payload:=jsonb_build_object('setupSource',setup_source,'amountPolicy',amount_policy,'disclosure',data->'disclosure',
   'fundingScopeId',funding#>'{scope,scopeId}','fundingSourceDigest',funding->'sourceDigest','simulationOnly',true);
 elsif action='elect'then
  if not app.native_mixed_pool_exact_v1(data,array['policyId','policyDigest','participantId','elected','acknowledged','consentReference'])
   or jsonb_typeof(data->'elected')is distinct from'boolean'or jsonb_typeof(data->'acknowledged')is distinct from'boolean'
   or(data->'elected'='true'::jsonb and data->'acknowledged'is distinct from'true'::jsonb)
   or jsonb_typeof(data->'consentReference')is distinct from'string'or length(trim(data->>'consentReference'))not between 1 and 500
  then raise exception using errcode='P0001',message='native_pool_invalid_request';end if;
  select*into policy from app.native_mixed_pool_records_v1 where id=(data->>'policyId')::uuid and tournament_id=tid and event_id=eid and kind='policy';
  if policy.id is null or policy.source_digest<>data->>'policyDigest'or exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and entity_key=policy.entity_key and version>policy.version)
  then raise exception using errcode='P0001',message='native_pool_policy_changed';end if;
  select x into part from jsonb_array_elements(funding->'entries')x where x->>'participantId'=data->>'participantId';
  if app.native_mixed_pool_setup_v1(tid,eid,policy.payload#>>'{amountPolicy,kind}',(policy.payload#>>'{setupSource,poolId}')::uuid,funding)
   is distinct from policy.payload->'setupSource'or policy.payload->>'fundingSourceDigest'<>funding->>'sourceDigest'
  then raise exception using errcode='P0001',message='native_pool_setup_or_funding_changed';end if;
  if part is null or(part->>'mode'='digital'and part->>'profileId'is distinct from actor::text)
   or(part->>'mode'='paper'and(part->>'profileId'is not null or not is_director))
  then raise exception using errcode='P0001',message='native_pool_own_or_fictional_subject_required';end if;
  if exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and entity_key='funding:'||policy.id::text||':'||(part->>'participantId'))
  then raise exception using errcode='P0001',message='native_pool_funded_change_requires_policy';end if;
  key:='election:'||policy.id::text||':'||(part->>'participantId');
  record_payload:=jsonb_build_object('policyId',policy.id,'policyDigest',policy.source_digest,'participant',part-'obligation'-'receipt',
   'elected',data->'elected','acknowledged',data->'acknowledged','consentReference',data->'consentReference','simulationOnly',true);
 elsif action='fund'then
  if not app.native_mixed_pool_exact_v1(data,array['electionId','electionDigest'])then raise exception using errcode='P0001',message='native_pool_invalid_request';end if;
  select*into el from app.native_mixed_pool_records_v1 where id=(data->>'electionId')::uuid and tournament_id=tid and event_id=eid and kind='election';
  if el.id is null or el.source_digest<>data->>'electionDigest'or el.payload->'elected'is distinct from'true'::jsonb
   or exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and entity_key=el.entity_key and version>el.version)
  then raise exception using errcode='P0001',message='native_pool_current_election_required';end if;
  select*into policy from app.native_mixed_pool_records_v1 where id=(el.payload->>'policyId')::uuid and kind='policy';
  if app.native_mixed_pool_setup_v1(tid,eid,policy.payload#>>'{amountPolicy,kind}',(policy.payload#>>'{setupSource,poolId}')::uuid,funding)
   is distinct from policy.payload->'setupSource'or policy.payload->>'fundingSourceDigest'<>funding->>'sourceDigest'
  then raise exception using errcode='P0001',message='native_pool_setup_or_funding_changed';end if;
  key:='funding:'||policy.id::text||':'||(el.payload#>>'{participant,participantId}');
  if exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and entity_key=key)
  then raise exception using errcode='P0001',message='native_pool_contribution_already_recorded';end if;
  record_payload:=jsonb_build_object('policyId',policy.id,'policyDigest',policy.source_digest,'electionId',el.id,'electionDigest',el.source_digest,
   'participantId',el.payload#>'{participant,participantId}','amountMinor',policy.payload#>'{amountPolicy,feeMinor}',
   'fundingScopeId',funding#>'{scope,scopeId}','fundingSourceDigest',funding->'sourceDigest',
   'method','simulated','actualMoneyReceived',false,'moneyMoved',false);
 elsif action='seal'then
  if not app.native_mixed_pool_exact_v1(data,array['expectedFundingDigest'])or data->>'expectedFundingDigest'is distinct from funding->>'sourceDigest'
   or exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='seal')
  then raise exception using errcode='P0001',message='native_pool_seal_conflict';end if;
  for policy in select distinct on(entity_key)*from app.native_mixed_pool_records_v1
   where tournament_id=tid and event_id=eid and kind='policy'order by entity_key,version desc loop
   setup_source:=app.native_mixed_pool_setup_v1(tid,eid,policy.payload#>>'{amountPolicy,kind}',(policy.payload#>>'{setupSource,poolId}')::uuid,funding);
   if setup_source is distinct from policy.payload->'setupSource'or policy.payload->>'fundingSourceDigest'<>funding->>'sourceDigest'
   then raise exception using errcode='P0001',message='native_pool_setup_or_funding_changed';end if;
   select coalesce(jsonb_agg(to_jsonb(x)order by x.entity_key),'[]')into elections from(
    select distinct on(entity_key)*from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid
     and kind='election'and payload->>'policyId'=policy.id::text order by entity_key,version desc)x;
   select coalesce(jsonb_agg(to_jsonb(x)order by x.entity_key),'[]')into contributions from app.native_mixed_pool_records_v1 x
    where tournament_id=tid and event_id=eid and kind='funding'and payload->>'policyId'=policy.id::text;
   for entry in select value from jsonb_array_elements(elections)where value#>'{payload,elected}'='true'::jsonb loop
    if not exists(select 1 from jsonb_array_elements(contributions)c where c#>>'{payload,electionId}'=entry->>'id'and c#>>'{payload,electionDigest}'=entry->>'source_digest')
    then raise exception using errcode='P0001',message='native_pool_unfunded_election';end if;
   end loop;
   if jsonb_array_length(contributions)<>(select count(*)from jsonb_array_elements(elections)x where x#>'{payload,elected}'='true'::jsonb)
   then raise exception using errcode='P0001',message='native_pool_contribution_mismatch';end if;
   policy_rows:=policy_rows||jsonb_build_array(jsonb_build_object('policy',to_jsonb(policy),'elections',elections,'contributions',contributions));
  end loop;
  if jsonb_array_length(policy_rows)=0 then raise exception using errcode='P0001',message='native_pool_no_policies';end if;
  key:='seal';record_payload:=jsonb_build_object('policies',policy_rows,'fundingSourceDigest',funding->'sourceDigest','simulationOnly',true);
 else
  if not app.native_mixed_pool_exact_v1(data,array['sealId','sealDigest','startId'])then raise exception using errcode='P0001',message='native_pool_invalid_request';end if;
  select*into seal from app.native_mixed_pool_records_v1 where id=(data->>'sealId')::uuid and tournament_id=tid and event_id=eid and kind='seal';
  if seal.id is null or seal.source_digest<>data->>'sealDigest'or seal.payload->>'fundingSourceDigest'<>funding->>'sourceDigest'
   or not exists(select 1 from app.native_mixed_simulation_starts_v1 where id=(data->>'startId')::uuid and tournament_id=tid and event_id=eid and started_at>=seal.created_at)
  then raise exception using errcode='P0001',message='native_pool_current_seal_and_start_required';end if;
  review:=app.native_mixed_qualification_review_v1(tid,eid,(data->>'startId')::uuid);
  if review->>'status'is distinct from'review_available'or review->'qualificationReady'is distinct from'true'::jsonb
   or review->'tieReviewRequired'is distinct from'false'::jsonb or review->>'fundingSourceDigest'<>funding->>'sourceDigest'
  then raise exception using errcode='P0001',message='native_pool_verified_untied_cards_required';end if;
  cards:=review->'cards';
  for item in select value from jsonb_array_elements(seal.payload->'policies')loop
   amount_policy:=item#>'{policy,payload,amountPolicy}';requested_kind:=amount_policy->>'kind';
   setup_source:=app.native_mixed_pool_setup_v1(tid,eid,requested_kind,(item#>>'{policy,payload,setupSource,poolId}')::uuid,funding);
   if setup_source is distinct from item#>'{policy,payload,setupSource}'then raise exception using errcode='P0001',message='native_pool_setup_or_funding_changed';end if;
   paid:=jsonb_array_length(item->'contributions');unit:=(amount_policy->>'roundingUnitMinor')::integer;
   fund:=paid::bigint*(amount_policy->>'feeMinor')::bigint;
   if paid=0 then results:=results||jsonb_build_array(jsonb_build_object('policyId',item#>'{policy,id}','status','empty_no_obligations','fundMinor',0,'obligations','[]'::jsonb));continue;end if;
   select jsonb_agg(c order by(c->>'gamePoints')::integer desc,(c->>'wins')::integer desc,
    case when requested_kind='q'then(c->>'netSpread')::integer else 0 end desc,(c->>'positiveSpread')::integer desc)
   into ranked from jsonb_array_elements(cards)c where exists(select 1 from jsonb_array_elements(item->'contributions')p where p#>>'{payload,participantId}'=c->>'participantId')
    and(amount_policy->>'method'<>'q-equal-exact-selected-step-v1'or(c->>'rank')::integer<=5);
   if coalesce(jsonb_array_length(ranked),0)=0 then raise exception using errcode='P0001',message='native_pool_no_eligible_paid_recipients';end if;
   if requested_kind='side'and exists(select 1 from jsonb_array_elements(ranked)c group by c->>'gamePoints',c->>'wins',c->>'positiveSpread'having count(*)>1)
   then raise exception using errcode='P0001',message='native_pool_cash_tie_unresolved';end if;
   recipients:=case when amount_policy->>'method'='q-equal-exact-selected-step-v1' then jsonb_array_length(ranked)
    else ceil(paid::numeric/(amount_policy->>'ratio')::numeric)::integer end;
   if recipients>jsonb_array_length(ranked)then raise exception using errcode='P0001',message='native_pool_recipient_source_mismatch';end if;
   calc:=app.native_mixed_pool_amounts_v1(amount_policy,paid,recipients);
   if calc->>'status'is distinct from'calculated'or(calc->>'fundMinor')::bigint<>fund
   then raise exception using errcode='P0001',message='native_pool_amount_blocked:'||coalesce(calc->>'code','unknown');end if;
   awards:='[]';for i in 0..recipients-1 loop awards:=awards||jsonb_build_array(jsonb_build_object(
    'participantId',ranked#>array[i::text,'participantId'],'amountMinor',calc#>array['awardsMinor',i::text],
    'status','UNPAID_SIMULATED','ordinaryLiability',false,'moneyMoved',false));end loop;
   results:=results||jsonb_build_array(jsonb_build_object('policyId',item#>'{policy,id}','fundMinor',fund,'calculation',calc,'obligations',awards));
  end loop;
  key:='final';record_payload:=jsonb_build_object('sealId',seal.id,'sealDigest',seal.source_digest,'startId',data->'startId',
   'reviewSourceDigest',review->'sourceDigest','fundingSourceDigest',funding->'sourceDigest','pools',results,
   'status','UNPAID_SIMULATED','ordinaryLiability',false,'moneyMoved',false,'refunds','[]'::jsonb);
 end if;

 select*into head from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and entity_key=key order by version desc limit 1;
 seq:=coalesce(head.version,0)+1;prior:=head.id;
 h:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-pool-record-v1',rid,tid,eid,key,seq,prior,case action when'elect'then'election'when'fund'then'funding'else action end,actor,op,record_payload));
 rh:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-pool-finance-v1',actor,op,tid,eid,request));
 if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true
 then raise exception using errcode='P0001',message='native_pool_authorization_changed';end if;
 response:=jsonb_build_object('status','accepted','kind','native-mixed-pool-receipt-v1','action',action,'recordId',rid,
  'recordDigest',h,'operationId',op,'tournamentId',tid,'eventId',eid,'simulationOnly',true,'current',true,
  'ordinaryLiability',false,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'refunds','[]'::jsonb);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(receipt,tid,actor,'native_mixed_pool_simulation_v1',rid,rh,op,'accepted',response,clock_timestamp());
 insert into app.native_mixed_pool_operations_v1 values(actor,op,tid,eid,receipt,rid,request,rh,response,clock_timestamp());
 insert into app.native_mixed_pool_records_v1 values(rid,tid,eid,key,seq,prior,case action when'elect'then'election'when'fund'then'funding'else action end,actor,op,record_payload,h,clock_timestamp());
 if action='final'then for item in select value from jsonb_array_elements(results)loop
  for ob in select value from jsonb_array_elements(item->'obligations')loop
   insert into app.native_mixed_pool_obligations_v1(final_record_id,policy_record_id,tournament_id,event_id,participant_id,amount_minor,rounding_unit_minor)
   values(rid,(item->>'policyId')::uuid,tid,eid,(ob->>'participantId')::uuid,(ob->>'amountMinor')::bigint,
    (select(payload#>>'{amountPolicy,roundingUnitMinor}')::integer from app.native_mixed_pool_records_v1 where id=(item->>'policyId')::uuid));
  end loop;end loop;end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(tid,actor,receipt,'native_mixed_pool_simulation',rid,action,jsonb_build_object('digest',h,'simulationOnly',true,'moneyMoved',false));
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','native_pool_invalid_request');
 when sqlstate'P0001'then get stacked diagnostics code=message_text;
  if code not like'native_pool_%'then raise;end if;return jsonb_build_object('status','rejected','code',code,'moneyMoved',false);
end$$;

-- Cohort-only read model: public-shaped policy/count summaries, own election
-- references, and a Director-only work list. Unknown/stale funding is not zero.
create function app.get_native_mixed_pool_finance_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;director boolean;funding jsonb;policies jsonb;own_entries jsonb;work jsonb;seals jsonb;saved_policy record;
begin
 if app.native_mixed_pool_finance_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_pool_actor_v1();
 if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1 in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then
  return jsonb_build_object('status','blocked','code','source_busy');end if;
 funding:=app.native_mixed_funding_seal_source_v1(tid,eid);
 if funding->>'status'is distinct from'source_available'then return jsonb_build_object('status','blocked','code','current_funding_unavailable');end if;
 lock table app.native_mixed_pool_operations_v1,app.native_mixed_pool_records_v1 in share mode nowait;
 lock table app.tournament_setup_q_pool_versions,app.tournament_setup_side_pool_versions,
  app.tournament_setup_side_pool_materializations,app.event_side_pool_definition_versions in share mode nowait;
 for saved_policy in select distinct on(entity_key)*from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='policy'order by entity_key,version desc loop
  if app.native_mixed_pool_setup_v1(tid,eid,saved_policy.payload#>>'{amountPolicy,kind}',(saved_policy.payload#>>'{setupSource,poolId}')::uuid,funding)
   is distinct from saved_policy.payload->'setupSource'or saved_policy.payload->>'fundingSourceDigest'<>funding->>'sourceDigest'
  then return jsonb_build_object('status','blocked','code','pool_setup_or_funding_changed');end if;
 end loop;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;
 director:=found;
 with p as(select distinct on(entity_key)*from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='policy'order by entity_key,version desc),
 e as(select distinct on(entity_key)*from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='election'order by entity_key,version desc)
 select coalesce(jsonb_agg(jsonb_build_object('policyId',p.id,'policyDigest',p.source_digest,
  'poolId',p.payload#>'{setupSource,poolId}','amountPolicy',p.payload->'amountPolicy','disclosure',p.payload->'disclosure',
  'electedCount',(select count(*)from e where e.payload->>'policyId'=p.id::text and e.payload->'elected'='true'::jsonb),
  'simulatedPaidCount',(select count(*)from app.native_mixed_pool_records_v1 f where f.tournament_id=tid and f.event_id=eid and f.kind='funding'and f.payload->>'policyId'=p.id::text),
  'simulatedFundMinor',(select coalesce(sum((f.payload->>'amountMinor')::bigint),0)from app.native_mixed_pool_records_v1 f where f.tournament_id=tid and f.event_id=eid and f.kind='funding'and f.payload->>'policyId'=p.id::text))order by p.entity_key),'[]')into policies from p;
 with e as(select distinct on(entity_key)*from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='election'order by entity_key,version desc)
 select coalesce(jsonb_agg(jsonb_build_object('electionId',e.id,'electionDigest',e.source_digest,'policyId',e.payload->'policyId',
  'participantId',e.payload#>'{participant,participantId}','mode',e.payload#>'{participant,mode}','elected',e.payload->'elected',
  'simulatedFunded',exists(select 1 from app.native_mixed_pool_records_v1 f where f.tournament_id=tid and f.event_id=eid and f.kind='funding'and f.payload->>'electionId'=e.id::text))order by e.entity_key),'[]')
 into work from e where director or e.payload#>>'{participant,profileId}'=actor::text;
 select coalesce(jsonb_agg(jsonb_build_object('participantId',x->'participantId','rosterEntryId',x->'rosterEntryId')),'[]')into own_entries
 from jsonb_array_elements(funding->'entries')x where x->>'mode'='digital'and x->>'profileId'=actor::text;
 select jsonb_build_object('sealed',exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='seal'),
  'seal',case when director then(select jsonb_build_object('id',id,'digest',source_digest)from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='seal')else null end)into seals;
 return jsonb_build_object('status','source_available','kind','native-mixed-pool-workspace-v1','actorId',actor,'tournamentId',tid,'eventId',eid,
  'journalDigest',app.native_mixed_pool_journal_digest_v1(tid,eid),'fundingSourceDigest',funding->'sourceDigest',
  'policies',policies,'ownParticipants',own_entries,'elections',work,'membership',seals,
  'simulationOnly',true,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'ordinaryLiability',false);
exception when lock_not_available then return jsonb_build_object('status','blocked','code','source_busy');end$$;

do $acl$declare p regprocedure;begin foreach p in array array[
 'app.native_mixed_pool_finance_enabled_v1()'::regprocedure,'app.native_mixed_pool_exact_v1(jsonb,text[])'::regprocedure,
 'app.native_mixed_pool_actor_v1()'::regprocedure,
 'app.native_mixed_pool_journal_digest_v1(uuid,uuid)'::regprocedure,'app.native_mixed_pool_setup_v1(uuid,uuid,text,uuid,jsonb)'::regprocedure,
 'app.native_mixed_pool_start_guard_v1()'::regprocedure,'app.execute_native_mixed_pool_finance_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.get_native_mixed_pool_finance_v1(uuid,uuid)'::regprocedure
 ]loop execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$acl$;
-- END database/proposals/native-mixed-pool-finance-v1.sql

-- BEGIN database/proposals/native-mixed-playoff-v1.sql source SHA256 db6c616cfb841c02f22fed8144715e8d3e4e5b5e589b4d7b6258af866f4aa52d
-- PRIVATE / DEFAULT-OFF LOCAL CANDIDATE. Separate synthetic five-player playoffs.
-- Does not create ordinary qualification, canonical games, genuine series,
-- MRPs, prize liabilities, receipts for money, or payments. No application grants.
create function app.native_mixed_playoff_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

-- Keep the actual caller subject and every existing root/funding/game check.
-- Only sporting Director authority comes from the exact immutable Start row.
do $clone$
declare original text;candidate text;old text;replacement text;
begin
 original:=replace(pg_get_functiondef('app.native_mixed_qualification_review_v1(uuid,uuid,uuid)'::regprocedure),E'\r\n',E'\n');
 if encode(extensions.digest(original,'sha256'),'hex')<>'e326b89c4d21a982a324e04c5a9a229f016350e9f666234debdccaf5c7ac2bdd' then raise exception 'mixed playoff review definition changed';end if;
 old:=E' perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor\n  and role in(''director'',''co_director'')for share nowait;';
 replacement:=E' perform 1 from app.tournament_roles role_row join app.native_mixed_simulation_starts_v1 start_row\n  on start_row.id=sid and start_row.tournament_id=tid and start_row.event_id=eid\n  where role_row.tournament_id=tid and role_row.profile_id=start_row.actor_id and role_row.role=''director''\n  for share of role_row,start_row nowait;';
 if (length(original)-length(replace(original,old,'')))/length(old)<>1 then raise exception 'mixed playoff caller-role anchor changed';end if;
 candidate:=replace(original,'FUNCTION app.native_mixed_qualification_review_v1(','FUNCTION app.native_mixed_playoff_review_v1(');
 if candidate=original then raise exception 'mixed playoff review name anchor changed';end if;
 candidate:=replace(candidate,old,replacement);execute candidate;
 execute 'alter function app.native_mixed_playoff_review_v1(uuid,uuid,uuid)owner to postgres';
 execute 'revoke all on function app.native_mixed_playoff_review_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role';
 if replace(pg_get_functiondef('app.native_mixed_playoff_review_v1(uuid,uuid,uuid)'::regprocedure),E'\r\n',E'\n')<>candidate
  or replace(pg_get_functiondef('app.native_mixed_qualification_review_v1(uuid,uuid,uuid)'::regprocedure),E'\r\n',E'\n')<>original
 then raise exception 'mixed playoff clone postcondition changed';end if;
end$clone$;

create table app.native_mixed_playoff_contexts_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 start_id uuid not null,actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 receipt_id uuid not null unique,request_payload jsonb not null,request_hash text not null,
 source_capture jsonb not null,source_digest text not null,context_digest text not null,response_payload jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(start_id)references app.native_mixed_simulation_starts_v1(id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 check(source_digest=app.native_mixed_simulation_hash_v1(source_capture)),
 check(context_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-context-v1',id,tournament_id,event_id,start_id,source_digest)))
);
create table app.native_mixed_playoff_evidence_v1(
 id uuid primary key default extensions.gen_random_uuid(),context_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 slot integer not null check(slot between 1 and 4),game_number integer not null check(game_number between 1 and 2500),
 sequence integer not null check(sequence between 1 and 6),actor_id uuid not null references app.profiles(id),actor_session_id uuid not null,operation_id uuid not null,
 receipt_id uuid not null unique,request_payload jsonb not null,request_hash text not null,
 match_digest text not null,entry jsonb not null,authority_capture jsonb not null,entry_digest text not null,response_payload jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(context_id,slot,game_number,sequence),unique(actor_id,operation_id),
 foreign key(context_id,tournament_id,event_id)references app.native_mixed_playoff_contexts_v1(id,tournament_id,event_id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 check(entry_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-evidence-v1',id,context_id,slot,game_number,sequence,actor_id,actor_session_id,operation_id,request_payload,match_digest,entry,authority_capture)))
);
create table app.native_mixed_playoff_results_v1(
 id uuid primary key default extensions.gen_random_uuid(),context_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 slot integer not null check(slot between 1 and 4),receipt_id uuid not null unique,
 match_digest text not null,source_capture jsonb not null,result_digest text not null,
 winner_id uuid not null,loser_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 unique(context_id,slot),unique(id,context_id),
 foreign key(context_id,tournament_id,event_id)references app.native_mixed_playoff_contexts_v1(id,tournament_id,event_id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 foreign key(winner_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 foreign key(loser_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 check(winner_id<>loser_id),check(result_digest=app.native_mixed_simulation_hash_v1(source_capture))
);
create table app.native_mixed_playoff_completions_v1(
 id uuid primary key default extensions.gen_random_uuid(),context_id uuid not null unique,tournament_id uuid not null,event_id uuid not null,
 receipt_id uuid not null unique,source_capture jsonb not null,source_digest text not null,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(context_id,tournament_id,event_id)references app.native_mixed_playoff_contexts_v1(id,tournament_id,event_id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 check(source_digest=app.native_mixed_simulation_hash_v1(source_capture))
);
do $security$declare n text;begin foreach n in array array['native_mixed_playoff_contexts_v1','native_mixed_playoff_evidence_v1','native_mixed_playoff_results_v1','native_mixed_playoff_completions_v1']loop
 execute format('alter table app.%I owner to postgres',n);
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',n);
 execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',n);
end loop;end$security$;

create function app.native_mixed_playoff_source_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare st app.native_mixed_simulation_starts_v1%rowtype;b app.event_settings_operational_bindings_v1%rowtype;
 a app.tournament_setup_activations%rowtype;s app.event_settings_snapshots_v3%rowtype;
 review jsonb;roster jsonb;seeds jsonb;series jsonb;capture jsonb;assessment jsonb;
begin
 select*into st from app.native_mixed_simulation_starts_v1 where tournament_id=tid and event_id=eid for share nowait;if st.id is null then return null;end if;
 review:=app.native_mixed_playoff_review_v1(tid,eid,st.id);
 if review->>'status'is distinct from'review_available'or review->'qualificationReady'is distinct from'true'::jsonb
  or review->'tieReviewRequired'is distinct from'false'::jsonb or review->'entrantCount'is distinct from'18'::jsonb or review->'qualifyingCount'is distinct from'5'::jsonb
 then return null;end if;
 lock table app.event_settings_operational_bindings_v1,app.event_settings_snapshots_v3,app.tournament_setup_activations,
 app.roster_account_links,app.event_participants,app.tournament_roster_entries in share mode nowait;
 select*into b from app.event_settings_operational_bindings_v1 where tournament_id=tid and event_id=eid;
 select*into a from app.tournament_setup_activations where id=b.activation_id and tournament_id=tid and event_id=eid;
 select*into s from app.event_settings_snapshots_v3 where id=b.settings_snapshot_id and tournament_id=tid;
 if b.id is null or a.id is null or s.id is null or a.setup_event_version_id<>b.setup_event_version_id
  or b.context->>'eventKind'is distinct from'main'or not exists(select 1 from app.events where id=eid and tournament_id=tid and format='standard_singles'and operational_state='active'and ruleset_version_id=a.ruleset_version_id)
 then return null;end if;
 -- Existing setup assessor expects its original nullable setup context. The
 -- verified review separately proves the actual original field is exactly 18.
 assessment:=app.assess_event_rule_draft_v1(b.draft,b.context);
 if assessment->>'status'is distinct from'eligible'then return null;end if;
 series:=jsonb_build_object('regular',app.resolve_event_series_format_v1(b.draft#>'{series,regular}'),
  'final',app.resolve_event_series_format_v1(case b.draft->>'finalMode'when'same'then b.draft#>'{series,regular}'else b.draft#>'{series,final}'end));
 if series#>>'{regular,winsRequired}'is null or series#>>'{final,winsRequired}'is null
  or(series#>>'{regular,maximumGames}')::integer>2500 or(series#>>'{final,maximumGames}')::integer>2500 then return null;end if;
 select jsonb_agg(jsonb_build_object('participantId',p.id,'rosterEntryId',r.id,'profileId',p.profile_id,'mode',r.scorecard_type,'fixedTournamentId',x->'fixedId')order by p.id)
 into roster from jsonb_array_elements(st.source_capture->'fixedAssignments')x
 join app.event_participants p on p.id=(x->>'participantId')::uuid and p.event_id=eid and p.tournament_id=tid
 join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=tid
 where p.status='registered'and(r.scorecard_type='paper'and p.profile_id is null or r.scorecard_type='digital'and p.profile_id is not null and exists(select 1 from app.roster_account_links l where l.tournament_id=tid and l.roster_entry_id=r.id and l.profile_id=p.profile_id));
 if jsonb_array_length(roster)is distinct from 18 or(select count(*)from jsonb_array_elements(roster)x where x->>'mode'='digital')<>6
  or(select count(distinct x->>'participantId')from jsonb_array_elements(roster)x)<>18
  or(select count(distinct x->>'profileId')from jsonb_array_elements(roster)x where x->>'mode'='digital')<>6 then return null;end if;
 select jsonb_agg(r||jsonb_build_object('seed',(c->>'rank')::integer,'gamePoints',c->'gamePoints')order by(c->>'rank')::integer)into seeds
 from jsonb_array_elements(review->'cards')c join jsonb_array_elements(roster)r on r->>'participantId'=c->>'participantId'and r->'fixedTournamentId'=c->'fixedTournamentId'
 where(c->>'rank')::integer between 1 and 5 and c->'tieCount'='1'::jsonb;
 if jsonb_array_length(seeds)is distinct from 5 or(select array_agg((x->>'seed')::integer order by(x->>'seed')::integer)from jsonb_array_elements(seeds)x)is distinct from array[1,2,3,4,5]then return null;end if;
 capture:=jsonb_build_object('kind','native-mixed-playoff-source-v1','tournamentId',tid,'eventId',eid,'startId',st.id,
  'review',review,'settingsBinding',to_jsonb(b),'activation',to_jsonb(a),'settingsSnapshot',to_jsonb(s),'series',series,'roster',roster,'seeds',seeds,
  'ordinaryQualificationRecorded',false,'mrpAwarded',false,'actualMoneyReceived',false,'moneyMoved',false);
 return jsonb_build_object('status','source_available','capture',capture,'sourceDigest',app.native_mixed_simulation_hash_v1(capture));
end$$;

-- Verify immutable rows against the global operation-receipt and audit journal.
create function app.native_mixed_playoff_row_bound_v1(row_id uuid,kind text)returns boolean
language plpgsql stable security definer set search_path=''as $$
declare v jsonb;r app.operation_receipts%rowtype;q jsonb;d jsonb;expected_entry jsonb;artifact jsonb;prior_history jsonb;c app.native_mixed_playoff_contexts_v1%rowtype;begin
 if kind='context'then select to_jsonb(x)into v from app.native_mixed_playoff_contexts_v1 x where id=row_id;
 elsif kind='evidence'then select to_jsonb(x)into v from app.native_mixed_playoff_evidence_v1 x where id=row_id;else return false;end if;
 if v is null then return false;end if;
 q:=v->'request_payload';d:=q->'data';
 if not app.native_mixed_pool_exact_v1(q,array['version','action','expectedSourceDigest','data','reason'])
  or q->>'version'is distinct from'native-mixed-playoff-request-v1'then return false;end if;
 if kind='context'then
  if q->>'action'is distinct from'create-context'or not app.native_mixed_pool_exact_v1(d,array[]::text[])
   or q->>'expectedSourceDigest'is distinct from v->>'source_digest'
   or v#>>'{source_capture,tournamentId}'is distinct from v->>'tournament_id'
   or v#>>'{source_capture,eventId}'is distinct from v->>'event_id'
   or v#>>'{source_capture,startId}'is distinct from v->>'start_id'
   or v->>'source_digest'is distinct from app.native_mixed_simulation_hash_v1(v->'source_capture')
   or v->>'context_digest'is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-context-v1',row_id,(v->>'tournament_id')::uuid,(v->>'event_id')::uuid,(v->>'start_id')::uuid,v->>'source_digest'))then return false;end if;
 else
  select*into c from app.native_mixed_playoff_contexts_v1 where id=(v->>'context_id')::uuid;
  if c.id is null or c.tournament_id::text is distinct from v->>'tournament_id'or c.event_id::text is distinct from v->>'event_id'
   or q->>'action'is distinct from'game-action'or q->>'expectedSourceDigest'is distinct from c.source_digest
   or not app.native_mixed_pool_exact_v1(d,array['contextId','slot','gameNumber','expectedMatchDigest','expectedRevision','expectedHistoryDigest','entry'])
   or d->>'contextId'is distinct from v->>'context_id'or d->'slot'is distinct from v->'slot'or d->'gameNumber'is distinct from v->'game_number'
   or d->>'expectedMatchDigest'is distinct from v->>'match_digest'or d->'expectedRevision'is distinct from to_jsonb((v->>'sequence')::integer-1)
   or jsonb_typeof(d->'entry')is distinct from'object'or(d->'entry')?|array['id','actorId']
   or(d#>>'{entry,type}'='paper-capture'and(d->'entry')?'artifactDigest')
   or not app.native_mixed_pool_exact_v1(v->'authority_capture',array['actorId','sessionId','roles','paperIdentityBinding','simulationOnly'])
   or v#>>'{authority_capture,actorId}'is distinct from v->>'actor_id'or v#>>'{authority_capture,sessionId}'is distinct from v->>'actor_session_id'
   or v#>'{authority_capture,simulationOnly}'is distinct from'true'::jsonb then return false;end if;
  select coalesce(jsonb_agg(entry order by sequence),'[]')into prior_history from app.native_mixed_playoff_evidence_v1
   where context_id=c.id and slot=(v->>'slot')::integer and game_number=(v->>'game_number')::integer and sequence<(v->>'sequence')::integer;
  if jsonb_array_length(prior_history)<>(v->>'sequence')::integer-1 or d->>'expectedHistoryDigest'is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-game-history-v1',c.id,(v->>'slot')::integer,(v->>'game_number')::integer,v->>'match_digest',prior_history))then return false;end if;
  expected_entry:=jsonb_build_object('id',row_id,'actorId',(v->>'actor_id')::uuid)||(d->'entry');
  if d#>>'{entry,type}'='paper-capture'then
   artifact:=jsonb_build_object('kind','native-mixed-playoff-fictional-paper-v1','contextId',c.id,'slot',(v->>'slot')::integer,'gameNumber',(v->>'game_number')::integer,'claims',d#>'{entry,claims}','physicalOriginal',false,'actualPlayClaimed',false);
   expected_entry:=expected_entry||jsonb_build_object('artifactDigest',app.native_mixed_simulation_hash_v1(artifact));
  end if;
  if v->'entry'is distinct from expected_entry
   or v->>'entry_digest'is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-evidence-v1',row_id,(v->>'context_id')::uuid,(v->>'slot')::integer,(v->>'game_number')::integer,(v->>'sequence')::integer,(v->>'actor_id')::uuid,(v->>'actor_session_id')::uuid,(v->>'operation_id')::uuid,v->'request_payload',v->>'match_digest',v->'entry',v->'authority_capture'))then return false;end if;
 end if;
 select*into r from app.operation_receipts where id=(v->>'receipt_id')::uuid;
 return r.id is not null and r.actor_profile_id=(v->>'actor_id')::uuid and r.client_operation_id=(v->>'operation_id')::uuid
  and r.tournament_id=(v->>'tournament_id')::uuid and r.target_id=row_id and r.operation_type='native_mixed_playoff_v1'
  and r.request_hash=v->>'request_hash'and r.request_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-request-v1',r.actor_profile_id,r.tournament_id,(v->>'event_id')::uuid,v->'request_payload'))
  and r.outcome='accepted'and r.response_payload=v->'response_payload'
  and exists(select 1 from app.audit_events a where a.tournament_id=r.tournament_id and a.actor_profile_id=r.actor_profile_id and a.operation_receipt_id=r.id
   and a.entity_type='native_mixed_playoff_simulation'and a.entity_id=row_id and a.action=kind and a.after_state=r.response_payload);
end$$;

create function app.native_mixed_playoff_match_v1(context_value uuid,slot_value integer)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare c app.native_mixed_playoff_contexts_v1%rowtype;p uuid[];parents jsonb:='[]';r1 app.native_mixed_playoff_results_v1%rowtype;r2 app.native_mixed_playoff_results_v1%rowtype;
 series jsonb;body jsonb;begin
 select*into c from app.native_mixed_playoff_contexts_v1 where id=context_value;if c.id is null or slot_value not between 1 and 4 then return null;end if;
 if slot_value=1 then p:=array[(c.source_capture#>>'{seeds,3,participantId}')::uuid,(c.source_capture#>>'{seeds,4,participantId}')::uuid];
 elsif slot_value=2 then select*into r1 from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=1;if r1.id is null then return null;end if;
  if app.native_mixed_playoff_result_bound_v1(r1.id)is distinct from true then return null;end if;
  p:=array[(c.source_capture#>>'{seeds,0,participantId}')::uuid,r1.winner_id];parents:=jsonb_build_array(jsonb_build_object('id',r1.id,'digest',r1.result_digest));
 elsif slot_value=3 then p:=array[(c.source_capture#>>'{seeds,2,participantId}')::uuid,(c.source_capture#>>'{seeds,1,participantId}')::uuid];
 else select*into r1 from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=2;select*into r2 from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=3;
  if r1.id is null or r2.id is null then return null;end if;
  if app.native_mixed_playoff_result_bound_v1(r1.id)is distinct from true or app.native_mixed_playoff_result_bound_v1(r2.id)is distinct from true then return null;end if;
  p:=array[r1.winner_id,r2.winner_id];parents:=jsonb_build_array(jsonb_build_object('id',r1.id,'digest',r1.result_digest),jsonb_build_object('id',r2.id,'digest',r2.result_digest));end if;
 series:=c.source_capture#>(case when slot_value=4 then'{series,final}'::text[]else'{series,regular}'::text[]end);
 body:=jsonb_build_object('contextId',c.id,'contextDigest',c.context_digest,'slot',slot_value,'participants',to_jsonb(p),'format',series,'parentResultPins',parents);
 return body||jsonb_build_object('matchDigest',app.native_mixed_simulation_hash_v1(body));end$$;

-- Pure verification of one stored synthetic game; no sporting or write authority.
create function app.native_mixed_playoff_game_v1(capture jsonb,participants jsonb,history jsonb)returns jsonb
language plpgsql immutable set search_path=''as $$
declare e jsonb;p jsonb;item jsonb;submissions jsonb:='[]';confirmed jsonb:='[]';digital jsonb;paper jsonb;capture_entry jsonb;review_entry jsonb;
 winner text;refs jsonb;own_pid text;action text;actor text;roles jsonb;begin
 if jsonb_typeof(history)is distinct from'array'then return null;end if;
 if jsonb_array_length(history)>6 then return null;end if;
 if jsonb_typeof(participants)is distinct from'array'then return null;end if;
 if jsonb_array_length(participants)<>2 then return null;end if;
 if exists(select 1 from jsonb_array_elements(history)x where jsonb_typeof(x)is distinct from'object'
  or app.native_mixed_simulation_uuid_v1(x->>'id')is distinct from true or app.native_mixed_simulation_uuid_v1(x->>'actorId')is distinct from true)
  or(select count(distinct x->>'id')from jsonb_array_elements(history)x)<>jsonb_array_length(history)then return null;end if;
 select coalesce(jsonb_agg(x->'participantId'),'[]')into digital from jsonb_array_elements(capture->'seeds')x where participants? (x->>'participantId')and x->>'mode'='digital';
 select coalesce(jsonb_agg(x->'participantId'),'[]')into paper from jsonb_array_elements(capture->'seeds')x where participants? (x->>'participantId')and x->>'mode'='paper';
 if jsonb_array_length(digital)+jsonb_array_length(paper)<>2 then return null;end if;
 for e in select value from jsonb_array_elements(history)loop
  action:=e->>'type';actor:=e->>'actorId';p:=e-'id'-'type'-'actorId';
  select x->>'participantId'into own_pid from jsonb_array_elements(capture->'roster')x where x->>'profileId'=actor and x->>'mode'='digital'and participants?(x->>'participantId');
  if action='digital-submit'then
   if not app.native_mixed_pool_exact_v1(p,array['participantId','winnerParticipantId','statement'])or p->>'statement'is distinct from'simulation-own-playoff-result-v1'
    or app.native_mixed_simulation_uuid_v1(p->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(p->>'winnerParticipantId')is distinct from true
    or own_pid is null or own_pid is distinct from p->>'participantId'or exists(select 1 from jsonb_array_elements(submissions)x where x->>'participantId'=own_pid)
    or not(participants?(p->>'winnerParticipantId'))or(winner is not null and winner<>p->>'winnerParticipantId')or jsonb_array_length(confirmed)>0 then return null;end if;
   winner:=p->>'winnerParticipantId';submissions:=submissions||jsonb_build_array(e);
  elsif action='digital-confirm'then
   select coalesce(jsonb_agg(x->'id'order by x->>'id'),'[]')into refs from jsonb_array_elements(history)x where x->>'type'in('digital-submit','paper-capture','paper-review')and(x->>'id')<>(e->>'id');
   -- The current prefix must be complete before a confirmation is admitted.
   if not app.native_mixed_pool_exact_v1(p,array['participantId','submissionId','winnerParticipantId','evidenceIds','statement'])or p->>'statement'is distinct from'simulation-own-playoff-confirmation-v1'
    or app.native_mixed_simulation_uuid_v1(p->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(p->>'submissionId')is distinct from true or app.native_mixed_simulation_uuid_v1(p->>'winnerParticipantId')is distinct from true
    or own_pid is null or own_pid is distinct from p->>'participantId'or jsonb_array_length(submissions)<>jsonb_array_length(digital)
    or(jsonb_array_length(paper)>0 and review_entry is null)or winner is null or winner is distinct from p->>'winnerParticipantId'
    or not exists(select 1 from jsonb_array_elements(submissions)x where x->>'participantId'=own_pid and x->>'id'=p->>'submissionId')
    or confirmed?own_pid or p->'evidenceIds'is distinct from refs then return null;end if;
   confirmed:=confirmed||jsonb_build_array(own_pid);
  elsif action='paper-capture'then
   if jsonb_typeof(p->'claims')is distinct from'array'then return null;end if;
   if not app.native_mixed_pool_exact_v1(p,array['artifactId','artifactDigest','claims','statement'])or p->>'statement'is distinct from'fictional-playoff-paper-capture-v1'
    or app.native_mixed_simulation_uuid_v1(p->>'artifactId')is distinct from true or coalesce(p->>'artifactDigest','')!~'^[a-f0-9]{64}$'
    or jsonb_array_length(paper)=0 or own_pid is not null or capture_entry is not null or jsonb_typeof(p->'claims')is distinct from'array'
    or jsonb_array_length(p->'claims')<>jsonb_array_length(paper)then return null;end if;
   if(select count(distinct x->>'participantId')from jsonb_array_elements(p->'claims')x)<>jsonb_array_length(paper)then return null;end if;
   for item in select value from jsonb_array_elements(p->'claims')loop
    if not app.native_mixed_pool_exact_v1(item,array['participantId','winnerParticipantId'])or app.native_mixed_simulation_uuid_v1(item->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(item->>'winnerParticipantId')is distinct from true or not(paper?(item->>'participantId'))or not(participants?(item->>'winnerParticipantId'))or(winner is not null and winner<>item->>'winnerParticipantId')then return null;end if;winner:=item->>'winnerParticipantId';end loop;
   capture_entry:=e;
  elsif action='paper-review'then
   if not app.native_mixed_pool_exact_v1(p,array['captureId','artifactId','artifactDigest','reenteredClaims','statement'])or p->>'statement'is distinct from'fictional-playoff-paper-review-v1'
    or capture_entry is null or review_entry is not null or actor=capture_entry->>'actorId'or own_pid is not null
    or p->'captureId'is distinct from capture_entry->'id'or p->'artifactId'is distinct from capture_entry->'artifactId'or p->'artifactDigest'is distinct from capture_entry->'artifactDigest'
    or p->'reenteredClaims'is distinct from capture_entry->'claims'then return null;end if;review_entry:=e;
  else return null;end if;
 end loop;
 return jsonb_build_object('complete',winner is not null and jsonb_array_length(submissions)=jsonb_array_length(digital)
  and jsonb_array_length(confirmed)=jsonb_array_length(digital)and(jsonb_array_length(paper)=0 or review_entry is not null),'winnerId',winner);
end$$;

create function app.native_mixed_playoff_progress_v1(context_value uuid,slot_value integer,extra jsonb default null)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare c app.native_mixed_playoff_contexts_v1%rowtype;m jsonb;history jsonb;games jsonb:='[]';g jsonb;v record;n integer:=0;last_game integer:=0;
 wins_a integer:=0;wins_b integer:=0;winner text;limit_wins integer;hd text;begin
 select*into c from app.native_mixed_playoff_contexts_v1 where id=context_value;m:=app.native_mixed_playoff_match_v1(context_value,slot_value);if c.id is null or m is null then return null;end if;
 limit_wins:=(m#>>'{format,winsRequired}')::integer;
 for n in select distinct game_number from app.native_mixed_playoff_evidence_v1 where context_id=context_value and slot=slot_value
  union select(extra->>'gameNumber')::integer where extra is not null order by 1 loop
  if winner is not null or n<>last_game+1 or n>(m#>>'{format,maximumGames}')::integer then return null;end if;
  for v in select id,match_digest from app.native_mixed_playoff_evidence_v1 where context_id=context_value and slot=slot_value and game_number=n loop
   if v.match_digest<>m->>'matchDigest'or app.native_mixed_playoff_row_bound_v1(v.id,'evidence')is distinct from true then return null;end if;end loop;
  select coalesce(jsonb_agg(entry order by sequence),'[]')into history from app.native_mixed_playoff_evidence_v1 where context_id=context_value and slot=slot_value and game_number=n;
  if extra is not null and n=(extra->>'gameNumber')::integer then history:=history||jsonb_build_array(extra->'entry');end if;
  g:=app.native_mixed_playoff_game_v1(c.source_capture,m->'participants',history);if g is null then return null;end if;
  hd:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-game-history-v1',c.id,slot_value,n,m->>'matchDigest',history));
  games:=games||jsonb_build_array(jsonb_build_object('gameNumber',n,'revision',jsonb_array_length(history),'historyDigest',hd,'complete',g->'complete','winnerId',g->'winnerId'));
  if g->'complete'is distinct from'true'::jsonb then
   if exists(select 1 from app.native_mixed_playoff_evidence_v1 where context_id=context_value and slot=slot_value and game_number>n)or(extra is not null and(extra->>'gameNumber')::integer>n)then return null;end if;
   return jsonb_build_object('match',m,'games',games,'complete',false,'winsA',wins_a,'winsB',wins_b,'nextGameNumber',n,'winnerId',null);
  end if;
  if g->>'winnerId'=m#>>'{participants,0}'then wins_a:=wins_a+1;else wins_b:=wins_b+1;end if;
  if wins_a=limit_wins or wins_b=limit_wins then winner:=g->>'winnerId';end if;last_game:=n;
 end loop;
 return jsonb_build_object('match',m,'games',games,'complete',winner is not null,'winsA',wins_a,'winsB',wins_b,'nextGameNumber',case when winner is null then last_game+1 else null end,'winnerId',winner);
end$$;

-- Parent validation is acyclic: slot 2 replays slot 1; slot 4 replays slots 2/3.
create function app.native_mixed_playoff_result_bound_v1(result_value uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$
declare r app.native_mixed_playoff_results_v1%rowtype;c app.native_mixed_playoff_contexts_v1%rowtype;
 p jsonb;m jsonb;body jsonb;loser uuid;last_e app.native_mixed_playoff_evidence_v1%rowtype;begin
 select*into r from app.native_mixed_playoff_results_v1 where id=result_value;if r.id is null then return false;end if;
 select*into c from app.native_mixed_playoff_contexts_v1 where id=r.context_id;
 if c.id is null or r.tournament_id<>c.tournament_id or r.event_id<>c.event_id or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true then return false;end if;
 p:=app.native_mixed_playoff_progress_v1(c.id,r.slot);if p is null or p->'complete'is distinct from'true'::jsonb then return false;end if;m:=p->'match';
 loser:=case when p->>'winnerId'=m#>>'{participants,0}'then(m#>>'{participants,1}')::uuid else(m#>>'{participants,0}')::uuid end;
 body:=jsonb_build_object('contextId',c.id,'contextDigest',c.context_digest,'sourceDigest',c.source_digest,'slot',r.slot,'match',m,'progress',p,'winnerId',(p->>'winnerId')::uuid,'loserId',loser,'simulationOnly',true);
 select*into last_e from app.native_mixed_playoff_evidence_v1 where context_id=c.id and slot=r.slot order by game_number desc,sequence desc limit 1;
 return r.source_capture=body and r.result_digest=app.native_mixed_simulation_hash_v1(body)and r.match_digest=m->>'matchDigest'
  and r.winner_id=(p->>'winnerId')::uuid and r.loser_id=loser and last_e.receipt_id=r.receipt_id
  and app.native_mixed_playoff_row_bound_v1(last_e.id,'evidence')is true;
end$$;

create function app.native_mixed_playoff_completion_bound_v1(context_value uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$
declare c app.native_mixed_playoff_contexts_v1%rowtype;v app.native_mixed_playoff_completions_v1%rowtype;
 r app.native_mixed_playoff_results_v1%rowtype;body jsonb;cohorts jsonb;begin
 select*into c from app.native_mixed_playoff_contexts_v1 where id=context_value;
 select*into v from app.native_mixed_playoff_completions_v1 where context_id=context_value;
 if c.id is null or v.context_id is null or v.tournament_id<>c.tournament_id or v.event_id<>c.event_id
  or(select count(*)from app.native_mixed_playoff_results_v1 where context_id=c.id)<>4 then return false;end if;
 for r in select*from app.native_mixed_playoff_results_v1 where context_id=c.id loop
  if app.native_mixed_playoff_result_bound_v1(r.id)is distinct from true then return false;end if;
 end loop;
 select*into r from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=4;
 cohorts:=jsonb_build_array(jsonb_build_object('firstPlace',1,'lastPlace',1,'participantIds',jsonb_build_array(r.winner_id)),jsonb_build_object('firstPlace',2,'lastPlace',2,'participantIds',jsonb_build_array(r.loser_id)),
  jsonb_build_object('firstPlace',3,'lastPlace',4,'participantIds',(select jsonb_agg(loser_id order by slot)from app.native_mixed_playoff_results_v1 where context_id=c.id and slot in(2,3))),
  jsonb_build_object('firstPlace',5,'lastPlace',5,'participantIds',(select jsonb_agg(loser_id)from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=1)));
 body:=jsonb_build_object('contextId',c.id,'sourceDigest',c.source_digest,'finishingGroups',cohorts,'resultPins',(select jsonb_agg(jsonb_build_object('id',id,'slot',slot,'digest',result_digest)order by slot)from app.native_mixed_playoff_results_v1 where context_id=c.id),'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
 return v.receipt_id=r.receipt_id and v.source_capture=body and v.source_digest=app.native_mixed_simulation_hash_v1(body);
end$$;

create function app.execute_native_mixed_playoff_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare actor uuid;action text;data jsonb;source jsonb;old app.operation_receipts%rowtype;c app.native_mixed_playoff_contexts_v1%rowtype;
 e app.native_mixed_playoff_evidence_v1%rowtype;m jsonb;progress jsonb;history jsonb;revision integer;hd text;request_hash text;
 entry_value jsonb;payload jsonb;authority jsonb;roles jsonb;binding app.paper_official_identity_bindings%rowtype;
 rid uuid:=extensions.gen_random_uuid();idv uuid:=extensions.gen_random_uuid();ctxid uuid;slot_no integer;game_no integer;
 typ text;own_pid uuid;response jsonb;kind text;artifact jsonb;result_id uuid;winner uuid;loser uuid;cohorts jsonb;result_capture jsonb;is_director boolean;
begin
 if app.native_mixed_playoff_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 actor:=app.native_mixed_pool_actor_v1();if actor is null or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1 in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 if tid is null or eid is null or op is null or not app.native_mixed_pool_exact_v1(request,array['version','action','expectedSourceDigest','data','reason'])
  or request->>'version'is distinct from'native-mixed-playoff-request-v1'or coalesce(request->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or length(request->>'reason')not between 1 and 500 or request->>'reason'<>trim(request->>'reason')or request->>'reason'~'[[:cntrl:]]'
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 action:=request->>'action';data:=request->'data';if action is null or action not in('create-context','game-action')then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 lock table app.tournament_roles,app.paper_official_identity_bindings,app.roster_account_links,app.event_participants in share mode nowait;
 select coalesce(jsonb_agg(role order by role),'[]')into roles from app.tournament_roles where tournament_id=tid and profile_id=actor;
 is_director:=roles?'director';
 if action='create-context'and not is_director then return null;end if;
 if action='game-action'then
  if not app.native_mixed_pool_exact_v1(data,array['contextId','slot','gameNumber','expectedMatchDigest','expectedRevision','expectedHistoryDigest','entry'])
   or app.native_mixed_simulation_uuid_v1(data->>'contextId')is distinct from true
   or jsonb_typeof(data->'slot')is distinct from'number'or coalesce(data->>'slot','')!~'^[1-4]$'
   or jsonb_typeof(data->'gameNumber')is distinct from'number'or coalesce(data->>'gameNumber','')!~'^[1-9][0-9]{0,3}$'
   or(data->>'gameNumber')::integer>2500 or coalesce(data->>'expectedMatchDigest','')!~'^[a-f0-9]{64}$'
   or jsonb_typeof(data->'expectedRevision')is distinct from'number'or coalesce(data->>'expectedRevision','')!~'^[0-5]$'
   or coalesce(data->>'expectedHistoryDigest','')!~'^[a-f0-9]{64}$'or jsonb_typeof(data->'entry')is distinct from'object'
  then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  ctxid:=(data->>'contextId')::uuid;slot_no:=(data->>'slot')::integer;game_no:=(data->>'gameNumber')::integer;typ:=data#>>'{entry,type}';
  select*into c from app.native_mixed_playoff_contexts_v1 where id=ctxid and tournament_id=tid and event_id=eid;
  m:=app.native_mixed_playoff_match_v1(ctxid,slot_no);if c.id is null or m is null then return jsonb_build_object('status','rejected','code','parent_or_context_unavailable');end if;
  if typ is null or typ not in('digital-submit','digital-confirm','paper-capture','paper-review')then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  select(p->>'participantId')::uuid into own_pid from jsonb_array_elements(c.source_capture->'roster')p
   where p->>'mode'='digital'and p->>'profileId'=actor::text and m->'participants'?(p->>'participantId')
   and exists(select 1 from app.event_participants ep join app.roster_account_links l on l.tournament_id=ep.tournament_id and l.roster_entry_id=ep.roster_entry_id and l.profile_id=ep.profile_id where ep.id=(p->>'participantId')::uuid and ep.tournament_id=tid and ep.event_id=eid and ep.profile_id=actor);
  if typ in('digital-submit','digital-confirm')then if own_pid is null then return null;end if;
  else
   if own_pid is not null or app.paper_official_identity_is_current_valid(actor,tid)is distinct from true
    or(typ='paper-capture'and not(roles?'cross_checker'))or(typ='paper-review'and not(roles?|array['director','co_director','cross_checker']))then return null;end if;
   select*into binding from app.paper_official_identity_bindings where tournament_id=tid and official_profile_id=actor order by binding_version desc limit 1;
   if binding.id is null or exists(select 1 from app.event_participants p where p.tournament_id=tid and p.event_id=eid and m->'participants'?p.id::text and(p.profile_id=actor or p.roster_entry_id=binding.roster_entry_id))then return null;end if;
  end if;
 end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 request_hash:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-request-v1',actor,tid,eid,request));
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if old.id is not null then
  if old.tournament_id<>tid or old.operation_type<>'native_mixed_playoff_v1'or old.request_hash<>request_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  kind:=case action when'create-context'then'context'else'evidence'end;
  if app.native_mixed_playoff_row_bound_v1(old.target_id,kind)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  return old.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 source:=app.native_mixed_playoff_source_v1(tid,eid);if source is null or source->>'sourceDigest'<>request->>'expectedSourceDigest'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 lock table app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share row exclusive mode nowait;
 if action='create-context'then
  if not app.native_mixed_pool_exact_v1(data,array[]::text[])then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if exists(select 1 from app.native_mixed_playoff_contexts_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','rejected','code','context_already_exists');end if;
  response:=jsonb_build_object('status','simulated_playoff_context_created','contextId',idv,'sourceDigest',source->>'sourceDigest',
   'contextDigest',app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-context-v1',idv,tid,eid,(source#>>'{capture,startId}')::uuid,source->>'sourceDigest')),
   'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
  if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true
  then raise exception using errcode='P0001',message='native_playoff_authorization_changed';end if;
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(rid,tid,actor,'native_mixed_playoff_v1',idv,request_hash,op,'accepted',response,clock_timestamp());
  insert into app.native_mixed_playoff_contexts_v1(id,tournament_id,event_id,start_id,actor_id,operation_id,receipt_id,request_payload,request_hash,source_capture,source_digest,context_digest,response_payload)
   values(idv,tid,eid,(source#>>'{capture,startId}')::uuid,actor,op,rid,request,request_hash,source->'capture',source->>'sourceDigest',response->>'contextDigest',response);kind:='context';
 else
  if c.source_capture is distinct from source->'capture'or c.source_digest<>source->>'sourceDigest'or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true then return jsonb_build_object('status','rejected','code','source_changed');end if;
  progress:=app.native_mixed_playoff_progress_v1(c.id,slot_no);
  if progress is null or progress->'complete'='true'::jsonb or(progress->>'nextGameNumber')::integer<>game_no or m->>'matchDigest'<>data->>'expectedMatchDigest'then return jsonb_build_object('status','rejected','code','match_or_game_changed');end if;
  select coalesce(jsonb_agg(entry order by sequence),'[]'),count(*)into history,revision from app.native_mixed_playoff_evidence_v1 where context_id=c.id and slot=slot_no and game_number=game_no;
  hd:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-game-history-v1',c.id,slot_no,game_no,m->>'matchDigest',history));
  if revision<>(data->>'expectedRevision')::integer or hd<>data->>'expectedHistoryDigest'then return jsonb_build_object('status','rejected','code','history_changed');end if;
  if exists(select 1 from app.native_mixed_playoff_completions_v1 where context_id=c.id)then return jsonb_build_object('status','rejected','code','playoffs_complete');end if;
  payload:=(data->'entry')-'type';
  if payload?'id'or payload?'actorId'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if typ='paper-capture'then
   if not app.native_mixed_pool_exact_v1(payload,array['artifactId','claims','statement'])or app.native_mixed_simulation_uuid_v1(payload->>'artifactId')is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;
   artifact:=jsonb_build_object('kind','native-mixed-playoff-fictional-paper-v1','contextId',c.id,'slot',slot_no,'gameNumber',game_no,'claims',payload->'claims','physicalOriginal',false,'actualPlayClaimed',false);
   payload:=payload||jsonb_build_object('artifactDigest',app.native_mixed_simulation_hash_v1(artifact));
   if exists(select 1 from app.native_mixed_playoff_evidence_v1 where entry->>'artifactId'=payload->>'artifactId'and entry->>'type'='paper-capture')then return jsonb_build_object('status','rejected','code','artifact_already_used');end if;
  end if;
  authority:=jsonb_build_object('actorId',actor,'sessionId',auth.jwt()->>'session_id','roles',roles,'paperIdentityBinding',case when typ in('paper-capture','paper-review')then to_jsonb(binding)else null end,'simulationOnly',true);
  entry_value:=jsonb_build_object('id',idv,'type',typ,'actorId',actor)||payload;
  progress:=app.native_mixed_playoff_progress_v1(c.id,slot_no,jsonb_build_object('gameNumber',game_no,'entry',entry_value));if progress is null then return jsonb_build_object('status','rejected','code','evidence_mismatch');end if;
  history:=history||jsonb_build_array(entry_value);hd:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-game-history-v1',c.id,slot_no,game_no,m->>'matchDigest',history));
  response:=jsonb_build_object('status','simulated_playoff_evidence_recorded','contextId',c.id,'slot',slot_no,'gameNumber',game_no,'entryId',idv,'revision',revision+1,'historyDigest',hd,'sourceDigest',c.source_digest,'matchDigest',m->>'matchDigest','gameComplete',(progress->'games'->-1)->'complete','matchComplete',progress->'complete','winnerId',progress->'winnerId','simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
  if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true
  then raise exception using errcode='P0001',message='native_playoff_authorization_changed';end if;
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(rid,tid,actor,'native_mixed_playoff_v1',idv,request_hash,op,'accepted',response,clock_timestamp());
  insert into app.native_mixed_playoff_evidence_v1(id,context_id,tournament_id,event_id,slot,game_number,sequence,actor_id,actor_session_id,operation_id,receipt_id,request_payload,request_hash,match_digest,entry,authority_capture,entry_digest,response_payload)
   values(idv,c.id,tid,eid,slot_no,game_no,revision+1,actor,(auth.jwt()->>'session_id')::uuid,op,rid,request,request_hash,m->>'matchDigest',entry_value,authority,app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-evidence-v1',idv,c.id,slot_no,game_no,revision+1,actor,(auth.jwt()->>'session_id')::uuid,op,request,m->>'matchDigest',entry_value,authority)),response);kind:='evidence';
  if progress->'complete'='true'::jsonb then
   winner:=(progress->>'winnerId')::uuid;loser:=case when winner=(m#>>'{participants,0}')::uuid then(m#>>'{participants,1}')::uuid else(m#>>'{participants,0}')::uuid end;
   result_capture:=jsonb_build_object('contextId',c.id,'contextDigest',c.context_digest,'sourceDigest',c.source_digest,'slot',slot_no,'match',m,'progress',progress,'winnerId',winner,'loserId',loser,'simulationOnly',true);
   result_id:=extensions.gen_random_uuid();insert into app.native_mixed_playoff_results_v1(id,context_id,tournament_id,event_id,slot,receipt_id,match_digest,source_capture,result_digest,winner_id,loser_id)
    values(result_id,c.id,tid,eid,slot_no,rid,m->>'matchDigest',result_capture,app.native_mixed_simulation_hash_v1(result_capture),winner,loser);
   if slot_no=4 then
    select jsonb_build_array(jsonb_build_object('firstPlace',1,'lastPlace',1,'participantIds',jsonb_build_array(winner)),jsonb_build_object('firstPlace',2,'lastPlace',2,'participantIds',jsonb_build_array(loser)),
     jsonb_build_object('firstPlace',3,'lastPlace',4,'participantIds',(select jsonb_agg(loser_id order by slot)from app.native_mixed_playoff_results_v1 where context_id=c.id and slot in(2,3))),
     jsonb_build_object('firstPlace',5,'lastPlace',5,'participantIds',(select jsonb_agg(loser_id)from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=1)))into cohorts;
    result_capture:=jsonb_build_object('contextId',c.id,'sourceDigest',c.source_digest,'finishingGroups',cohorts,'resultPins',(select jsonb_agg(jsonb_build_object('id',id,'slot',slot,'digest',result_digest)order by slot)from app.native_mixed_playoff_results_v1 where context_id=c.id),'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
    insert into app.native_mixed_playoff_completions_v1(context_id,tournament_id,event_id,receipt_id,source_capture,source_digest)values(c.id,tid,eid,rid,result_capture,app.native_mixed_simulation_hash_v1(result_capture));
   end if;
  end if;
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,rid,'native_mixed_playoff_simulation',idv,kind,response);
 if app.native_mixed_playoff_row_bound_v1(idv,kind)is distinct from true then raise exception 'mixed playoff receipt postcondition failed';end if;
 if result_id is not null and app.native_mixed_playoff_result_bound_v1(result_id)is distinct from true then raise exception 'mixed playoff result postcondition failed';end if;
 if slot_no=4 and result_id is not null and app.native_mixed_playoff_completion_bound_v1(c.id)is distinct from true then raise exception 'mixed playoff completion postcondition failed';end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- Official-only private read. Do not expose this source capture to players.
create function app.get_native_mixed_playoff_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare actor uuid;c app.native_mixed_playoff_contexts_v1%rowtype;source jsonb;matches jsonb:='[]';m jsonb;i integer;response jsonb;begin
 if app.native_mixed_playoff_enabled_v1()is distinct from true then return null;end if;actor:=app.native_mixed_pool_actor_v1();if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1 in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')for share nowait;if not found then return null;end if;
 source:=app.native_mixed_playoff_source_v1(tid,eid);if source is null then return jsonb_build_object('status','blocked','code','source_unavailable');end if;
 lock table app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,
  app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share mode nowait;
 select*into c from app.native_mixed_playoff_contexts_v1 where tournament_id=tid and event_id=eid;
 if c.id is null then response:=jsonb_build_object('status','source_available','source',source);
 else
 if c.source_capture is distinct from source->'capture'or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true then return jsonb_build_object('status','blocked','code','source_changed');end if;
 for i in 1..4 loop
  if exists(select 1 from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=i and app.native_mixed_playoff_result_bound_v1(id)is distinct from true)then return jsonb_build_object('status','blocked','code','result_history_changed');end if;
  m:=app.native_mixed_playoff_progress_v1(c.id,i);matches:=matches||jsonb_build_array(jsonb_build_object('slot',i,'projection',m));end loop;
 if exists(select 1 from app.native_mixed_playoff_completions_v1 where context_id=c.id)and app.native_mixed_playoff_completion_bound_v1(c.id)is distinct from true then return jsonb_build_object('status','blocked','code','completion_history_changed');end if;
 response:=jsonb_build_object('status','simulated_playoffs_available','contextId',c.id,'contextDigest',c.context_digest,'source',source,'matches',matches,
  'completion',(select source_capture from app.native_mixed_playoff_completions_v1 where context_id=c.id),'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
 end if;
 if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

do $acl$declare p regprocedure;begin foreach p in array array[
 'app.native_mixed_playoff_enabled_v1()'::regprocedure,'app.native_mixed_playoff_source_v1(uuid,uuid)'::regprocedure,
 'app.native_mixed_playoff_row_bound_v1(uuid,text)'::regprocedure,'app.native_mixed_playoff_match_v1(uuid,integer)'::regprocedure,
 'app.native_mixed_playoff_game_v1(jsonb,jsonb,jsonb)'::regprocedure,'app.native_mixed_playoff_progress_v1(uuid,integer,jsonb)'::regprocedure,
 'app.native_mixed_playoff_result_bound_v1(uuid)'::regprocedure,'app.native_mixed_playoff_completion_bound_v1(uuid)'::regprocedure,
 'app.execute_native_mixed_playoff_v1(uuid,uuid,uuid,jsonb)'::regprocedure,'app.get_native_mixed_playoff_v1(uuid,uuid)'::regprocedure]loop
 execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$acl$;
-- END database/proposals/native-mixed-playoff-v1.sql

-- BEGIN database/proposals/native-mixed-playoff-own-read-v1.sql source SHA256 d6f550b4e6bd9b77b5f3248c4c4ad250c344cf23d91d47fd1f6615c1246f50bf
-- Private/default-off dependency: native-mixed-playoff-v1.sql.
-- Own digital-player projection only. No grants, routes or public bracket.
create function app.get_native_mixed_playoff_own_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;source jsonb;c app.native_mixed_playoff_contexts_v1%rowtype;
 own_person jsonb;own_id uuid;mine jsonb;other_person jsonb;other_id uuid;
 m jsonb;p jsonb;g jsonb;e jsonb;item jsonb;entries jsonb;games jsonb;next_game jsonb;matches jsonb:='[]';
 slot_no integer;own_place jsonb;own_submitted boolean;finished boolean:=false;eliminated boolean:=false;open_match boolean:=false;answer jsonb;
begin
 if app.native_mixed_playoff_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_pool_actor_v1();
 if actor is null or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 source:=app.native_mixed_playoff_source_v1(tid,eid);if source is null then return jsonb_build_object('status','blocked','code','source_unavailable');end if;
 select value into own_person from jsonb_array_elements(source#>'{capture,roster}')x
 where x->>'mode'='digital'and x->>'profileId'=actor::text;
 if own_person is null then return null;end if;own_id:=(own_person->>'participantId')::uuid;
 mine:=jsonb_build_object('participantId',own_id,'tournamentIdNumber',own_person->'fixedTournamentId');
 lock table app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,
  app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share mode nowait;
 select*into c from app.native_mixed_playoff_contexts_v1 where tournament_id=tid and event_id=eid;
 if c.id is null then answer:=jsonb_build_object('status','awaiting_playoff_preparation','own',mine);
 else
  if c.source_digest is distinct from source->>'sourceDigest'or c.source_capture is distinct from source->'capture'
   or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true
  then return jsonb_build_object('status','blocked','code','source_changed');end if;
  if not exists(select 1 from jsonb_array_elements(c.source_capture->'seeds')x where x->>'participantId'=own_id::text)
  then answer:=jsonb_build_object('status','not_in_simulated_playoffs','own',mine);
  else
   for slot_no in 1..4 loop
    m:=app.native_mixed_playoff_match_v1(c.id,slot_no);
    if m is null or not(m->'participants'?own_id::text)then continue;end if;
    p:=app.native_mixed_playoff_progress_v1(c.id,slot_no);if p is null then return jsonb_build_object('status','blocked','code','history_unavailable');end if;
    select value into other_person from jsonb_array_elements(c.source_capture->'roster')x
     where m->'participants'?(x->>'participantId')and x->>'participantId'<>own_id::text;
    if other_person is null then return jsonb_build_object('status','blocked','code','opponent_unavailable');end if;
    other_id:=(other_person->>'participantId')::uuid;
    games:='[]';
    for g in select value from jsonb_array_elements(p->'games')loop
     entries:='[]';
     select exists(select 1 from app.native_mixed_playoff_evidence_v1 where context_id=c.id and slot=slot_no
      and game_number=(g->>'gameNumber')::integer and entry->>'type'='digital-submit'
      and entry->>'participantId'=own_id::text and actor_id=actor)into own_submitted;
     for e in select entry from app.native_mixed_playoff_evidence_v1 where context_id=c.id and slot=slot_no
       and game_number=(g->>'gameNumber')::integer and own_submitted order by sequence loop
      -- Explicit projection: never return actor/session/profile, authority capture,
      -- request payload, roster contact/ACC fields, or unrelated game evidence.
      item:=jsonb_build_object('id',e->'id','type',e->'type');
      if e->>'type'='digital-submit'then item:=item||jsonb_build_object('participantId',e->'participantId','winnerParticipantId',e->'winnerParticipantId');
      elsif e->>'type'='digital-confirm'then item:=item||jsonb_build_object('participantId',e->'participantId','submissionId',e->'submissionId','winnerParticipantId',e->'winnerParticipantId','evidenceIds',e->'evidenceIds');
      elsif e->>'type'='paper-capture'then item:=item||jsonb_build_object('artifactId',e->'artifactId','artifactDigest',e->'artifactDigest','claims',e->'claims');
      elsif e->>'type'='paper-review'then item:=item||jsonb_build_object('captureId',e->'captureId','artifactId',e->'artifactId','artifactDigest',e->'artifactDigest','reenteredClaims',e->'reenteredClaims');
      else return jsonb_build_object('status','blocked','code','history_unavailable');end if;
      entries:=entries||jsonb_build_array(item);
     end loop;
     games:=games||jsonb_build_array(jsonb_build_object('gameNumber',g->'gameNumber','complete',case when own_submitted then g->'complete'else'false'::jsonb end,
      'winnerParticipantId',case when own_submitted then g->'winnerId'else'null'::jsonb end,
      'revision',g->'revision','historyDigest',g->'historyDigest','counterEvidenceAvailable',own_submitted,'entries',entries));
    end loop;
    if p->'complete'='true'::jsonb and p->>'winnerId'<>own_id::text then eliminated:=true;end if;
    if p->'complete'='false'::jsonb then open_match:=true;end if;
    next_game:=null;
    if p->'complete'='false'::jsonb then
     select value into g from jsonb_array_elements(p->'games')x where x->'gameNumber'=p->'nextGameNumber';
     next_game:=jsonb_build_object('gameNumber',p->'nextGameNumber','expectedRevision',coalesce(g->'revision','0'::jsonb),
      'expectedHistoryDigest',coalesce(g->'historyDigest',to_jsonb(app.native_mixed_simulation_hash_v1(jsonb_build_array(
       'native-mixed-playoff-game-history-v1',c.id,slot_no,(p->>'nextGameNumber')::integer,m->>'matchDigest','[]'::jsonb)))));
    end if;
    matches:=matches||jsonb_build_array(jsonb_build_object('slot',slot_no,'matchDigest',m->'matchDigest','format',m->'format',
     'own',mine,'opponent',jsonb_build_object('participantId',other_id,'tournamentIdNumber',other_person->'fixedTournamentId',
      'mode',other_person->'mode',
      'displayName',(select claimed_display_name from app.tournament_roster_entries where id=(other_person->>'rosterEntryId')::uuid and tournament_id=tid)),
     'complete',p->'complete','winnerParticipantId',p->'winnerId','nextGame',next_game,'games',games,
     'ownWins',case when m#>>'{participants,0}'=own_id::text then p->'winsA'else p->'winsB'end,
     'opponentWins',case when m#>>'{participants,0}'=own_id::text then p->'winsB'else p->'winsA'end));
   end loop;
   if exists(select 1 from app.native_mixed_playoff_completions_v1 where context_id=c.id)then
    if app.native_mixed_playoff_completion_bound_v1(c.id)is distinct from true then return jsonb_build_object('status','blocked','code','history_unavailable');end if;
    finished:=true;
    select jsonb_build_object('firstPlace',x->'firstPlace','lastPlace',x->'lastPlace')into own_place
     from app.native_mixed_playoff_completions_v1 completion_row cross join lateral jsonb_array_elements(completion_row.source_capture->'finishingGroups')x
     where completion_row.context_id=c.id and x->'participantIds'?own_id::text;
    if own_place is null then return jsonb_build_object('status','blocked','code','history_unavailable');end if;
   end if;
   answer:=jsonb_build_object('status','simulated_playoff_own_available','contextId',c.id,'sourceDigest',source->'sourceDigest',
    'own',mine,'matches',matches,'complete',finished,'eliminated',eliminated,'awaitingOpponent',not finished and not eliminated and not open_match,'ownFinishingGroup',own_place);
  end if;
 end if;
 if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 return answer||jsonb_build_object('tournamentId',tid,'eventId',eid,'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','blocked','code','source_busy');end$$;
alter function app.get_native_mixed_playoff_own_v1(uuid,uuid)owner to postgres;
revoke all on function app.get_native_mixed_playoff_own_v1(uuid,uuid)from public,anon,authenticated,service_role;
-- END database/proposals/native-mixed-playoff-own-read-v1.sql

-- BEGIN database/proposals/native-mixed-latest-prize-admission-v1.sql source SHA256 83c1f647d1dbea821e80e205bbcc3628551a56fceffc09cbeaa5cd5a7d1ea672
-- PRIVATE SOURCE CANDIDATE ONLY. No migration, grant, caller capability or payout.
-- Requires the complete latest event-prize save/context/registration closure,
-- native mixed funding/attendance/Start, and native-mixed-playoff-v1.sql.
-- Legacy original OIDs remain in place; their exact prior bodies are copied to
-- revoked functions before installing opt-in dispatchers. No historical rows,
-- saved policies, old output or old digest domains are rewritten.

do $dependencies$declare signature text;n text;begin
 foreach signature in array array[
  'app.save_event_settings_custom_pool_draft_v4(uuid,jsonb)',
  'app.save_event_prize_settings_source_v1(uuid,text)','app.get_event_prize_workspace_source_v1(uuid)',
  'app.get_event_prize_rule_context_source_v1(uuid)','app.save_event_prize_rule_context_v1(uuid,jsonb)',
  'app.event_prize_activation_current_v1(uuid,uuid,uuid)','app.assess_event_prize_series_draft_v1(jsonb,jsonb)',
  'app.valid_event_prize_snapshot_source_v1(jsonb)','app.event_prize_policy_ready_v1(jsonb)',
  'app.native_mixed_admission_base_source_v1(uuid,uuid)','app.native_mixed_playoff_source_v1(uuid,uuid)'
 ]loop if to_regprocedure(signature)is null then raise exception'native_latest_dependency_missing: %',signature;end if;end loop;
 foreach n in array array['event_prize_reservations_v1','event_prize_revision_bindings_v1',
  'event_prize_snapshots_v1','event_prize_heads_v1','event_prize_outcomes_v1','event_prize_policy_activation_pins_v1']loop
  if to_regclass('app.'||n)is null then raise exception'native_latest_dependency_missing: %',n;end if;
 end loop;
end$dependencies$;

create function app.native_mixed_latest_prize_admission_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

-- Any latest-prize history is a barrier, including a missing/stale head or an
-- incomplete adoption. Such a tournament must never fall back to dormant V1.
create function app.native_mixed_latest_prize_present_v1(tid uuid)returns boolean
language plpgsql volatile security definer set search_path=''as $$begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='55P03',message='native_latest_isolation_not_supported';end if;
 perform 1 from app.tournaments where id=tid for share nowait;
 perform app.lock_event_settings_activation_sources_v1();
 lock table app.event_prize_heads_v1,app.event_prize_snapshots_v1,
  app.event_prize_revision_bindings_v1,app.event_prize_reservations_v1,
  app.event_prize_outcomes_v1,app.event_prize_policy_activation_pins_v1 in share mode nowait;
 return exists(select 1 from app.event_prize_snapshots_v1 where tournament_id=tid)
  or exists(select 1 from app.event_prize_heads_v1 where tournament_id=tid)
  or exists(select 1 from app.event_prize_revision_bindings_v1 where tournament_id=tid)
  or exists(select 1 from app.event_prize_policy_activation_pins_v1 where tournament_id=tid)
  or exists(select 1 from app.event_prize_reservations_v1 where tournament_id=tid)
  or exists(select 1 from app.event_prize_outcomes_v1 o join app.event_prize_reservations_v1 r
    on r.actor_id=o.actor_id and r.operation_id=o.operation_id where r.tournament_id=tid);
end$$;

-- Source binding only. The captured Graduated/all-qualifier plan is NOT executed
-- by this bridge. Manual simulated Finance remains a distinct disclosed path.
create function app.native_mixed_latest_prize_pin_v1(tid uuid,eid uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set timezone='UTC'as $$
declare b app.event_settings_operational_bindings_v1%rowtype;a app.tournament_setup_activations%rowtype;
 e app.tournament_setup_event_versions%rowtype;s app.event_settings_snapshots_v3%rowtype;
 pin app.event_prize_policy_activation_pins_v1%rowtype;p app.event_prize_snapshots_v1%rowtype;
 rb app.event_prize_revision_bindings_v1%rowtype;r app.event_prize_reservations_v1%rowtype;
 saved jsonb;activated jsonb;current_pin jsonb;plan jsonb;body jsonb;
begin
 if app.native_mixed_latest_prize_admission_enabled_v1()is distinct from true
  or app.native_mixed_latest_prize_present_v1(tid)is distinct from true then return null;end if;
 lock table app.event_settings_operational_bindings_v1,app.tournament_setup_activations,
  app.event_settings_snapshots_v3,app.event_settings_operational_outcomes_v1 in share mode nowait;
 select*into b from app.event_settings_operational_bindings_v1 where tournament_id=tid and event_id=eid;
 select*into a from app.tournament_setup_activations where id=b.activation_id and tournament_id=tid and event_id=eid;
 select*into e from app.tournament_setup_event_versions where id=b.setup_event_version_id and tournament_id=tid;
 select*into s from app.event_settings_snapshots_v3 where id=b.settings_snapshot_id and tournament_id=tid;
 if b.id is null or a.id is null or e.id is null or s.id is null
  or a.setup_event_version_id is distinct from e.id or a.setup_revision_id is distinct from e.setup_revision_id
  or s.setup_revision_id is distinct from e.setup_revision_id
  or b.context->>'eventKind'is distinct from'main'or b.context->'sanctioned'is distinct from'false'::jsonb
  or e.event_kind<>'main'or e.style_code<>'Standard'or e.format_code<>'standard_singles'or e.game_count<>12
  or(select count(*)from app.events where tournament_id=tid)<>1
  or not exists(select 1 from app.events where id=eid and tournament_id=tid and event_type='main'
    and format='standard_singles'and operational_state='active'and ruleset_version_id=a.ruleset_version_id)
  or not exists(select 1 from jsonb_array_elements(s.effective_settings)x where x->>'eventClientRowId'=e.client_row_id::text
    and x->>'mode'='configured'and x->'draft'=b.draft)
  or not exists(select 1 from app.event_rule_context_reviews_v1 x where x.id=b.review_id and x.tournament_id=tid
    and x.settings_snapshot_id=s.id and x.setup_event_version_id=e.id and x.draft=b.draft and x.context=b.context)
 then return null;end if;
 -- Reuse the existing current head/save-hash/activation-pin/role proof, without
 -- importing its ordinary Finance reader or its native allocation requirements.
 current_pin:=app.event_prize_activation_current_v1(tid,b.intent_actor_id,b.intent_operation_id);
 if current_pin is null or current_pin->>'setupRevisionId'is distinct from e.setup_revision_id::text
  or current_pin->>'settingsSnapshotId'is distinct from s.id::text then return null;end if;
 select*into pin from app.event_prize_policy_activation_pins_v1 where actor_id=b.intent_actor_id
  and operation_id=b.intent_operation_id and tournament_id=tid;
 select ps.*into p from app.event_prize_heads_v1 h join app.event_prize_snapshots_v1 ps
  on ps.id=h.snapshot_id and ps.tournament_id=h.tournament_id where h.tournament_id=tid;
 select*into rb from app.event_prize_revision_bindings_v1 where tournament_id=tid and setup_revision_id=e.setup_revision_id;
 select*into r from app.event_prize_reservations_v1 where actor_id=p.actor_id and operation_id=p.operation_id and tournament_id=tid;
 select record_payload into saved from app.event_prize_outcomes_v1 where actor_id=r.actor_id and operation_id=r.operation_id;
 select result into activated from app.event_settings_operational_outcomes_v1 where actor_id=pin.actor_id
  and operation_id=pin.operation_id and tournament_id=tid and request_payload=pin.inner_intent;
 if pin.actor_id is null or p.id is null or rb.actor_id is null or r.actor_id is null
  or pin.prize_snapshot_id is distinct from p.id or pin.prize_digest is distinct from p.document->>'prizeDigest'
  or pin.settings_snapshot_id is distinct from s.id or pin.setup_revision_id is distinct from e.setup_revision_id
  or rb.settings_snapshot_id is distinct from s.id or rb.actor_id is distinct from p.actor_id or rb.operation_id is distinct from p.operation_id
  or p.setup_revision_id is distinct from e.setup_revision_id or s.actor_id is distinct from r.actor_id or s.operation_id is distinct from r.nested_operation_id
  or app.valid_event_prize_snapshot_source_v1(p.document)is distinct from true
  or saved->>'kind'is distinct from'event-prize-operation-record-v1'
  or saved->>'operationId'is distinct from r.operation_id::text
  or saved#>>'{scope,actorId}'is distinct from r.actor_id::text or saved#>>'{scope,tournamentId}'is distinct from tid::text
  or saved#>>'{result,status}'is distinct from'accepted'or saved->>'requestText'is distinct from r.request_text
  or saved->>'requestHash'is distinct from r.request_hash or saved#>'{result,ack,envelope}'is distinct from r.request_payload
  or saved#>>'{result,ack,fullRequestHash}'is distinct from r.request_hash or p.document->>'prizeDigest'is distinct from r.request_hash
  or saved#>'{result,ack,snapshot}'is distinct from p.document
  or activated->>'status'is distinct from'event_settings_operationally_activated'
  or activated->>'actorId'is distinct from pin.actor_id::text or activated->>'operationId'is distinct from pin.operation_id::text
  or activated->>'tournamentId'is distinct from tid::text or activated->'request'is distinct from pin.inner_intent
  or activated->>'setupRevisionId'is distinct from e.setup_revision_id::text
  or activated->>'settingsSnapshotId'is distinct from s.id::text
 then return null;end if;
 select value into plan from jsonb_array_elements(p.document->'plans')x
  where x->>'eventClientRowId'=e.client_row_id::text and x->>'eventKind'='main'and x->>'mode'='proposed_v2';
 if plan is null or app.event_prize_policy_ready_v1(plan->'draft')is distinct from true
  or plan#>>'{draft,method}'is distinct from'graduated'or plan#>>'{draft,recipients}'is distinct from'all'
  or(app.assess_event_prize_series_draft_v1(b.draft,b.context))->>'status'is distinct from'eligible'
 then return null;end if;
 body:=jsonb_build_object('kind','native-mixed-latest-prize-pin-v1','tournamentId',tid,'eventId',eid,
  'operationalBindingId',b.id,'activationId',a.id,'setupEventVersionId',e.id,'settingsSnapshot',to_jsonb(s),
  'revisionBinding',to_jsonb(rb),'prizeSnapshot',to_jsonb(p),'activationPin',to_jsonb(pin),
  'saveRequestHash',r.request_hash,'saveOutcome',saved,'operationalOutcome',activated,'plan',plan,
  'latestPolicyExecuted',false,'ordinaryFinanceSource',false,'simulationOnly',true,'moneyMoved',false);
 return body||jsonb_build_object('sourceDigest',app.native_mixed_simulation_hash_v1(body));
end$$;

-- The pins below hash normalized *recoverable source bodies*, not a guessed PG
-- pretty-printed definition. Catalog metadata is checked separately. Copies use
-- the actual installed definition, and a postcondition verifies their full body.
do $install$
declare item record;d text;body text;legacy text;candidate text;old text;replacement text;oid_before oid;
begin
 for item in select*from(values
  ('native_mixed_admission_base_source_v1','native_mixed_admission_base_legacy_latest_v1','native_mixed_admission_base_latest_v1','5c326a4e83f975c26b2ab267fdd92471fb30b65ed14d4c242c54e8ad301cf92f'),
  ('native_mixed_playoff_source_v1','native_mixed_playoff_source_legacy_latest_v1','native_mixed_playoff_source_latest_v1','ff3a30d7058be63b03e1105e7d4240e65ff60f55bb31a35f429c4580a1bfabbf')
 )as sources(name,legacy_name,latest_name,body_sha)loop
  oid_before:=to_regprocedure('app.'||item.name||'(uuid,uuid)');
  if oid_before is null or to_regprocedure('app.'||item.legacy_name||'(uuid,uuid)')is not null
   or to_regprocedure('app.'||item.latest_name||'(uuid,uuid)')is not null then raise exception'native_latest_install_reconcile_required';end if;
  select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=oid_before;
  if encode(extensions.digest(body,'sha256'),'hex')<>item.body_sha
   or not exists(select 1 from pg_proc x join pg_language l on l.oid=x.prolang where x.oid=oid_before
     and l.lanname='plpgsql'and x.prosecdef and not x.proisstrict and x.prorettype='jsonb'::regtype
     and x.proowner='postgres'::regrole and x.provolatile::text=case when item.name='native_mixed_admission_base_source_v1'then's'else'v'end
     and x.proconfig@>array['search_path=""']and exists(select 1 from unnest(x.proconfig)g where lower(g)='timezone=utc'))
  then raise exception'native_latest_dependency_definition_changed: %',item.name;end if;
  d:=replace(pg_get_functiondef(oid_before),E'\r\n',E'\n');
  old:='FUNCTION app.'||item.name||'(';
  if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'native_latest_name_anchor_changed';end if;
  legacy:=replace(d,old,'FUNCTION app.'||item.legacy_name||'(');execute legacy;
  if replace(pg_get_functiondef(to_regprocedure('app.'||item.legacy_name||'(uuid,uuid)')),E'\r\n',E'\n')<>legacy then raise exception'native_latest_legacy_copy_changed';end if;
  candidate:=replace(d,old,'FUNCTION app.'||item.latest_name||'(');
  old:='assessment:=app.assess_event_rule_draft_v1(b.draft,b.context);';
  replacement:='latest_pin:=app.native_mixed_latest_prize_pin_v1(tid,eid);if latest_pin is null then '
   ||case when item.name='native_mixed_admission_base_source_v1'then 'return jsonb_build_object(''status'',''blocked'',''code'',''native_latest_prize_binding_unavailable'');'
     else 'return null;'end||'end if;assessment:=app.assess_event_prize_series_draft_v1(b.draft,b.context);';
  if(length(candidate)-length(replace(candidate,old,'')))/length(old)<>1 then raise exception'native_latest_assessor_anchor_changed';end if;
  candidate:=replace(candidate,old,replacement);
  old:='assessment jsonb;';
  if(length(candidate)-length(replace(candidate,old,'')))/length(old)<>1 then raise exception'native_latest_declaration_anchor_changed';end if;
  candidate:=replace(candidate,old,'assessment jsonb;latest_pin jsonb;');
  if item.name='native_mixed_admission_base_source_v1'then old:='''syntheticAllFlags'',false';else old:='''series'',series,''roster'',roster';end if;
  replacement:=case when item.name='native_mixed_admission_base_source_v1'then'''latestPrize'',latest_pin,''syntheticAllFlags'',false'else'''latestPrize'',latest_pin,''series'',series,''roster'',roster'end;
  if(length(candidate)-length(replace(candidate,old,'')))/length(old)<>1 then raise exception'native_latest_capture_anchor_changed';end if;
  candidate:=replace(candidate,old,replacement);
  -- Latest source calls a locking helper; preserve legacy copy volatility, while
  -- the new variant and original-OID dispatcher use fresh READ COMMITTED reads.
  candidate:=replace(candidate,E' STABLE SECURITY DEFINER',E' VOLATILE SECURITY DEFINER');execute candidate;
  execute format($wrapper$create or replace function app.%I(tid uuid,eid uuid)returns jsonb
   language plpgsql volatile security definer set search_path=''set timezone='UTC'as $body$begin
    if app.native_mixed_latest_prize_present_v1(tid)then
     if app.native_mixed_latest_prize_admission_enabled_v1()is distinct from true then %s end if;
     return app.%I(tid,eid);
    end if;
    return app.%I(tid,eid);
   end$body$;$wrapper$,item.name,
    case when item.name='native_mixed_admission_base_source_v1'then'return jsonb_build_object(''status'',''blocked'',''code'',''native_latest_bridge_disabled'');'else'return null;'end,
    item.latest_name,item.legacy_name);
  if to_regprocedure('app.'||item.name||'(uuid,uuid)')<>oid_before then raise exception'native_latest_original_oid_changed';end if;
 end loop;
end$install$;

do $acl$declare n text;begin foreach n in array array[
 'native_mixed_latest_prize_admission_enabled_v1()','native_mixed_latest_prize_present_v1(uuid)',
 'native_mixed_latest_prize_pin_v1(uuid,uuid)','native_mixed_admission_base_legacy_latest_v1(uuid,uuid)',
 'native_mixed_admission_base_latest_v1(uuid,uuid)','native_mixed_playoff_source_legacy_latest_v1(uuid,uuid)',
 'native_mixed_playoff_source_latest_v1(uuid,uuid)','native_mixed_admission_base_source_v1(uuid,uuid)',
 'native_mixed_playoff_source_v1(uuid,uuid)']loop
 execute 'alter function app.'||n||' owner to postgres';execute 'revoke all on function app.'||n||' from public,anon,authenticated,service_role';
end loop;end$acl$;
-- END database/proposals/native-mixed-latest-prize-admission-v1.sql

-- BEGIN database/proposals/native-mixed-pool-preparation-read-v1.sql source SHA256 5e2e62723af0e1d463047083bbbbacc018bdc9cb324b7f3633c6b62e27e11bf7
-- PRIVATE SOURCE CANDIDATE. No install, access grant, policy or money movement.
create function app.native_mixed_pool_preparation_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create function app.get_native_mixed_pool_preparation_v1(tid uuid,eid uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare actor uuid;funding jsonb;intent app.native_mixed_admission_intents_v1%rowtype;
 scope_row app.native_mixed_funding_scopes_v1%rowtype;candidate record;source jsonb;
 pools jsonb:='[]';paper jsonb;digital jsonb;response jsonb;assignments jsonb:='[]';v_context_id uuid;v_pre_start boolean;
 v_latest_prize jsonb;v_rounding_text text;v_rounding_unit integer;v_rounding_digest text;v_amount_supported boolean;
begin
 if app.native_mixed_pool_preparation_enabled_v1()is distinct from true
  or app.native_mixed_pool_finance_enabled_v1()is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 actor:=app.native_mixed_pool_actor_v1();if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1 in share mode nowait;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;
 if not found or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then
  return jsonb_build_object('status','blocked','code','source_busy');end if;
 lock table app.tournament_setup_q_pool_versions,app.tournament_setup_side_pool_versions,
  app.tournament_setup_side_pool_materializations,app.event_side_pool_definition_versions,
  app.tournament_roster_entries,app.event_participants,app.roster_account_links,app.initial_seating_assignments,
  app.native_mixed_simulation_starts_v1,app.event_play_starts,
  app.native_mixed_pool_operations_v1,app.native_mixed_pool_records_v1 in share mode nowait;
 funding:=app.native_mixed_funding_seal_source_v1(tid,eid);
 if funding->>'status'is distinct from'source_available'then return jsonb_build_object('status','blocked','code','current_funding_unavailable');end if;
 select*into scope_row from app.native_mixed_funding_scopes_v1 where id=(funding#>>'{scope,scopeId}')::uuid and tournament_id=tid and event_id=eid;
 select*into intent from app.native_mixed_admission_intents_v1 where id=scope_row.admission_intent_id and tournament_id=tid and event_id=eid;
 if intent.id is null then return null;end if;
 -- True only after a coherent locked absence check, not an inferred permission
 -- to start/write. Contention/missing dependencies fail the entire read closed.
 v_pre_start:=not exists(select 1 from app.native_mixed_simulation_starts_v1 ns where ns.tournament_id=tid and ns.event_id=eid)
  and not exists(select 1 from app.event_play_starts os where os.tournament_id=tid and os.event_id=eid);
 -- The current funding getter already compared this exact immutable base pin
 -- to the current admission source. Expose only its selected unit/digest, never
 -- the private plan/roster/activation captures. No guessed legacy default.
 v_latest_prize:=scope_row.source_capture#>'{baseSource,latestPrize}';
 if v_latest_prize is not null and(v_latest_prize->>'kind'is distinct from'native-mixed-latest-prize-pin-v1'
  or coalesce(v_latest_prize->>'sourceDigest','')!~'^[a-f0-9]{64}$')then return null;end if;
 for candidate in
  select 'q'::text kind,q.id pool_id,q.slot,q.pool_type_code saved_label,q.entry_fee_cents fee from app.tournament_setup_q_pool_versions q
   where q.tournament_id=tid and q.setup_event_version_id=(intent.setup_event_capture->>'id')::uuid
  union all
  select 'side',m.pool_id,s.slot,s.pool_type_code,s.entry_fee_cents from app.tournament_setup_side_pool_materializations m
   join app.tournament_setup_side_pool_versions s on s.id=m.setup_side_pool_version_id and s.tournament_id=m.tournament_id
   where m.tournament_id=tid and m.event_id=eid and s.setup_event_version_id=(intent.setup_event_capture->>'id')::uuid
  order by kind,slot,pool_id
 loop
  source:=app.native_mixed_pool_setup_v1(tid,eid,candidate.kind,candidate.pool_id,funding);
  v_rounding_unit:=null;v_rounding_digest:=null;
  if v_latest_prize is not null then
   v_rounding_text:=v_latest_prize#>>array['plan','draft','rounding',case when candidate.kind='q'then'qPool'else'sidePool'end];
   if v_latest_prize->>'kind'is distinct from'native-mixed-latest-prize-pin-v1'
    or v_rounding_text is null or v_rounding_text not in('1','5','10')
    or coalesce(v_latest_prize->>'sourceDigest','')!~'^[a-f0-9]{64}$'then return null;end if;
   v_rounding_unit:=v_rounding_text::integer*100;v_rounding_digest:=v_latest_prize->>'sourceDigest';
  end if;
  -- Mirror the writer's existing policy admission domain, not eventual amount
  -- feasibility (which also needs actual eligible counts and fund conservation).
  v_amount_supported:=source is not null and case
   when source->>'method'='side-sheet20-40-selected-step-v1'then candidate.fee in(1000,2000,5000,10000)
   when source->>'method'='q-v3-raw-selected-step-v1'then candidate.fee>=500 and candidate.fee%500=0
   when source->>'method'='q-equal-exact-selected-step-v1'then candidate.fee>0 and candidate.fee%100=0
   else false end;
  -- Unsupported methods/fees remain visible, without promising usable policy.
  pools:=pools||jsonb_build_array(jsonb_build_object('kind',candidate.kind,'poolId',candidate.pool_id,
   'slot',candidate.slot,'label',left(regexp_replace(trim(candidate.saved_label),'[[:cntrl:]]','','g'),160),
   'supported',v_amount_supported,'method',source->'method',
   'feeMinor',candidate.fee,'ratio',source->'ratio',
   'roundingStatus',case when v_latest_prize is null then'unknown_legacy'else'saved_latest'end,
   'roundingUnitMinor',v_rounding_unit,'roundingSourceDigest',v_rounding_digest));
 end loop;
 -- Only the reviewed native publication's exact sidecar can supply fixed IDs.
 -- No normal-auth call to the service-only schedule getter or JWT substitution.
 perform app.lock_native_mixed_simulation_sources_v1();
 select c.id into v_context_id from app.native_mixed_simulation_publication_contexts_v1 c where c.tournament_id=tid and c.event_id=eid;
 if v_context_id is not null then
  if app.native_mixed_simulation_publication_bound_v1(v_context_id)is distinct from true then return null;end if;
  select ss.assignments_capture into assignments from app.native_mixed_simulation_seating_sidecars_v1 ss where ss.context_id=v_context_id;
 end if;
 -- Before a proven publication, IDs are explicitly null/pending.
 select coalesce(jsonb_agg(jsonb_build_object('participantId',p.id,'rosterEntryId',r.id,
  'displayName',r.claimed_display_name,'fixedTournamentId',a.value->'fixedId',
  'fixedIdStatus',case when v_context_id is null then 'pending'else 'published'end,'simulationOnly',true)order by r.id),'[]')into paper
 from jsonb_array_elements(funding->'entries')x
 join app.event_participants p on p.id=(x->>'participantId')::uuid and p.tournament_id=tid and p.event_id=eid and p.profile_id is null
 join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.id=(x->>'rosterEntryId')::uuid and r.tournament_id=tid and r.scorecard_type='paper'
 left join lateral(select value from jsonb_array_elements(assignments)j(value)
  where value->>'rosterEntryId'=r.id::text and value->>'participantId'=p.id::text)a on true
 where x->>'mode'='paper'and x->'profileId'='null'::jsonb;
 if jsonb_array_length(paper)<>12 or(v_context_id is not null and exists(
  select 1 from jsonb_array_elements(paper)x where x->>'fixedTournamentId'is null))then return null;end if;
 -- Six linked digital roster labels are Director-only display data. No profile,
 -- account-link, contact or ACC fields leave this projection. They do not give
 -- the Director authority to enter any real player's election.
 select coalesce(jsonb_agg(jsonb_build_object('participantId',p.id,'rosterEntryId',r.id,
  'displayName',r.claimed_display_name,'fixedTournamentId',a.value->'fixedId',
  'fixedIdStatus',case when v_context_id is null then 'pending'else 'published'end)order by r.id),'[]')into digital
 from jsonb_array_elements(funding->'entries')x
 join app.event_participants p on p.id=(x->>'participantId')::uuid and p.tournament_id=tid and p.event_id=eid
  and p.profile_id::text=x->>'profileId'
 join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.id=(x->>'rosterEntryId')::uuid and r.tournament_id=tid and r.scorecard_type='digital'
 left join lateral(select value from jsonb_array_elements(assignments)j(value)
  where value->>'rosterEntryId'=r.id::text and value->>'participantId'=p.id::text)a on true
 where x->>'mode'='digital'and exists(select 1 from app.roster_account_links l where l.tournament_id=tid and l.roster_entry_id=r.id and l.profile_id=p.profile_id)
 ;
 if jsonb_array_length(digital)<>6 or(v_context_id is not null and exists(
  select 1 from jsonb_array_elements(digital)x where x->>'fixedTournamentId'is null))then return null;end if;
 response:=jsonb_build_object('kind','native-mixed-pool-preparation-v1','status','source_available',
  'actorId',actor,'tournamentId',tid,'eventId',eid,'fundingSourceDigest',funding->'sourceDigest',
  'journalDigest',app.native_mixed_pool_journal_digest_v1(tid,eid),'availablePools',pools,'fictionalPaperParticipants',paper,
  'digitalParticipants',digital,'preStart',v_pre_start,
  'simulationOnly',true,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'ordinaryLiability',false);
 if app.native_mixed_pool_actor_v1()is distinct from actor
  or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','blocked','code','source_busy');end$$;

create function public.get_native_mixed_pool_preparation_v1(p_tournament_id uuid,p_event_id uuid)returns jsonb
language sql volatile security definer set search_path=''as $$
 select app.get_native_mixed_pool_preparation_v1(p_tournament_id,p_event_id)
$$;
do $acl$declare f regprocedure;begin foreach f in array array[
 'app.native_mixed_pool_preparation_enabled_v1()'::regprocedure,
 'app.get_native_mixed_pool_preparation_v1(uuid,uuid)'::regprocedure,
 'public.get_native_mixed_pool_preparation_v1(uuid,uuid)'::regprocedure]loop
 execute format('alter function %s owner to postgres',f);
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
end loop;end$acl$;
-- END database/proposals/native-mixed-pool-preparation-read-v1.sql

-- BEGIN database/proposals/native-mixed-pool-operation-read-v1.sql source SHA256 f1abdbe0ced37ca57f98853510f9f3c535ff76e99afe379aff3975d83dfc19c9
-- PRIVATE SOURCE CANDIDATE ONLY. No grants, writes, new liability or retry.
-- Existing pool records do not store original session IDs. This reader proves
-- the CURRENT own session; it does not claim the request used that same session.
create function app.native_mixed_pool_operation_read_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.get_native_mixed_pool_operation_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql volatile security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare actor uuid;is_director boolean;v_action text;expected_kind text;rh text;response jsonb;
 operation_row app.native_mixed_pool_operations_v1%rowtype;record_row app.native_mixed_pool_records_v1%rowtype;
 receipt_row app.operation_receipts%rowtype;
begin
 if app.native_mixed_pool_operation_read_enabled_v1()is distinct from true
  or app.native_mixed_pool_finance_enabled_v1()is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 -- Technical wire bound, not a pool/business limit. Apply before lock/hash work.
 if request is null or octet_length(convert_to(request::text,'UTF8'))>32768 then return null;end if;
 actor:=app.native_mixed_pool_actor_v1();if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1,
  app.tournament_roles in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 if tid is null or eid is null or op is null or not app.native_mixed_pool_exact_v1(request,array['version','action','expectedJournalDigest','data','reason'])
  or request->>'version'is distinct from'native-mixed-pool-request-v1'
  or coalesce(request->>'expectedJournalDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'<>trim(request->>'reason')
  or length(request->>'reason')not between 1 and 500 or request->>'reason'~'[[:cntrl:]]'then return null;end if;
 v_action:=request->>'action';if v_action is null or v_action not in('policy','elect','fund','seal','final')then return null;end if;
 perform 1 from app.tournament_roles tr where tr.tournament_id=tid and tr.profile_id=actor and tr.role='director'for share nowait;
 is_director:=found;if v_action<>'elect'and not is_director then return null;end if;
 lock table app.native_mixed_pool_operations_v1,app.native_mixed_pool_records_v1,
  app.operation_receipts,app.audit_events,app.event_participants,app.tournament_roster_entries,
  app.roster_account_links in share mode nowait;
 select o.*into operation_row from app.native_mixed_pool_operations_v1 o where o.actor_id=actor and o.operation_id=op;
 -- Absence is not an assertion of non-execution or permission to write.
 if operation_row.operation_id is null then return null;end if;
 rh:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-pool-finance-v1',actor,op,tid,eid,request));
 if operation_row.tournament_id is distinct from tid or operation_row.event_id is distinct from eid
  or operation_row.request_payload is distinct from request or operation_row.request_hash is distinct from rh then return null;end if;
 select r.*into record_row from app.native_mixed_pool_records_v1 r where r.id=operation_row.record_id;
 select r.*into receipt_row from app.operation_receipts r where r.id=operation_row.receipt_id;
 expected_kind:=case v_action when'elect'then'election'when'fund'then'funding'else v_action end;
 if record_row.id is null or record_row.tournament_id is distinct from tid or record_row.event_id is distinct from eid
  or record_row.actor_id is distinct from actor or record_row.operation_id is distinct from op or record_row.kind is distinct from expected_kind
  or record_row.source_digest is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-pool-record-v1',
   record_row.id,tid,eid,record_row.entity_key,record_row.version,record_row.prior_id,record_row.kind,actor,op,record_row.payload))
  or receipt_row.id is null or receipt_row.actor_profile_id is distinct from actor or receipt_row.client_operation_id is distinct from op
  or receipt_row.tournament_id is distinct from tid or receipt_row.target_id is distinct from record_row.id
  or receipt_row.operation_type is distinct from'native_mixed_pool_simulation_v1'or receipt_row.request_hash is distinct from rh
  or receipt_row.outcome is distinct from'accepted'or receipt_row.response_payload is distinct from operation_row.response_payload
  or not exists(select 1 from app.audit_events a where a.operation_receipt_id=receipt_row.id and a.tournament_id=tid
   and a.actor_profile_id=actor and a.entity_type='native_mixed_pool_simulation'and a.entity_id=record_row.id and a.action=v_action
   and a.after_state=jsonb_build_object('digest',record_row.source_digest,'simulationOnly',true,'moneyMoved',false))then return null;end if;
 -- The stored receipt must be exactly the writer's non-private response.
 response:=jsonb_build_object('status','accepted','kind','native-mixed-pool-receipt-v1','action',v_action,'recordId',record_row.id,
  'recordDigest',record_row.source_digest,'operationId',op,'tournamentId',tid,'eventId',eid,'simulationOnly',true,'current',true,
  'ordinaryLiability',false,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'refunds','[]'::jsonb);
 if response is distinct from operation_row.response_payload then return null;end if;
 if v_action='elect'then
  if record_row.payload->>'policyId'is distinct from request#>>'{data,policyId}'
   or record_row.payload->>'policyDigest'is distinct from request#>>'{data,policyDigest}'
   or record_row.payload#>>'{participant,participantId}'is distinct from request#>>'{data,participantId}'
   or record_row.payload->'elected'is distinct from request#>'{data,elected}'
   or record_row.payload->'acknowledged'is distinct from request#>'{data,acknowledged}'
   or record_row.payload->'consentReference'is distinct from request#>'{data,consentReference}'then return null;end if;
  if not is_director and(record_row.payload#>>'{participant,mode}'is distinct from'digital'
   or record_row.payload#>>'{participant,profileId}'is distinct from actor::text
   or not exists(select 1 from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
    join app.roster_account_links l on l.roster_entry_id=r.id and l.tournament_id=r.tournament_id and l.profile_id=actor
    where p.id::text=record_row.payload#>>'{participant,participantId}'and p.tournament_id=tid and p.event_id=eid
     and p.profile_id=actor and r.scorecard_type='digital'and r.id::text=record_row.payload#>>'{participant,rosterEntryId}'))then return null;end if;
 end if;
 if app.native_mixed_pool_actor_v1()is distinct from actor
  or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 return response||jsonb_build_object('current',false,'historicalReceipt',true,'recovered',true,
  'currentSourceVerified',false,'writeAuthorized',false,'originalSessionVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy','current',false,'writeAuthorized',false);end$$;
create function public.get_native_mixed_pool_operation_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language sql volatile security definer set search_path=''as $$select app.get_native_mixed_pool_operation_v1(p_tournament_id,p_event_id,p_operation_id,p_request)$$;
do $acl$declare f regprocedure;begin foreach f in array array[
 'app.native_mixed_pool_operation_read_enabled_v1()'::regprocedure,
 'app.get_native_mixed_pool_operation_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'public.get_native_mixed_pool_operation_v1(uuid,uuid,uuid,jsonb)'::regprocedure]loop
 execute format('alter function %s owner to postgres',f);execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
end loop;end$acl$;
-- END database/proposals/native-mixed-pool-operation-read-v1.sql

-- BEGIN database/proposals/native-mixed-main-finance-v1.sql source SHA256 ab9d4efdf58ec7ea7f83830549627f9b43305dea37bca4437902ec229319fce2
-- PRIVATE / DEFAULT-OFF LOCAL CANDIDATE. Native simulated Main only.
-- Director-entered costs and whole-group awards, never an automatic payout
-- policy, genuine receipt, ordinary qualification, liability or disbursement.
create function app.native_mixed_main_finance_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create table app.native_mixed_main_finance_records_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 sequence integer not null check(sequence>0),prior_id uuid,kind text not null check(kind in('cost-line','review-costs','propose-awards','finalize-unpaid')),
 actor_id uuid not null references app.profiles(id),actor_session_id uuid not null,operation_id uuid not null,receipt_id uuid not null unique,
 request_payload jsonb not null,request_hash text not null,source_capture jsonb not null,source_digest text not null,
 payload jsonb not null,record_digest text not null,response_payload jsonb not null,created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id,sequence),unique(actor_id,operation_id),unique(id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(prior_id,tournament_id,event_id)references app.native_mixed_main_finance_records_v1(id,tournament_id,event_id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 check((sequence=1 and prior_id is null)or(sequence>1 and prior_id is not null)),
 check(source_digest=app.native_mixed_simulation_hash_v1(source_capture)),
 check(request_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-finance-request-v1',actor_id,tournament_id,event_id,request_payload))),
 check(record_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-finance-record-v1',id,tournament_id,event_id,sequence,prior_id,kind,actor_id,actor_session_id,operation_id,request_payload,source_digest,payload)))
);
create table app.native_mixed_main_finance_obligations_v1(
 id uuid primary key default extensions.gen_random_uuid(),final_record_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 participant_id uuid not null,first_place integer not null,last_place integer not null,
 amount_minor bigint not null check(amount_minor>0),rounding_unit_minor integer not null check(rounding_unit_minor in(100,500,1000)),
 status text not null default'UNPAID_SIMULATED'check(status='UNPAID_SIMULATED'),
 actual_money_received boolean not null default false check(not actual_money_received),ordinary_liability boolean not null default false check(not ordinary_liability),
 money_moved boolean not null default false check(not money_moved),unique(final_record_id,participant_id),
 foreign key(final_record_id,tournament_id,event_id)references app.native_mixed_main_finance_records_v1(id,tournament_id,event_id),
 foreign key(participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 check(amount_minor%rounding_unit_minor=0)
);
do $security$declare n text;begin foreach n in array array['native_mixed_main_finance_records_v1','native_mixed_main_finance_obligations_v1']loop
 execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',n);
 execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',n);
end loop;end$security$;

create function app.native_mixed_main_finance_journal_v1(tid uuid,eid uuid)returns text
language sql stable security definer set search_path=''as $$select app.native_mixed_simulation_hash_v1(coalesce(jsonb_agg(jsonb_build_array(id,sequence,record_digest)order by sequence),'[]'))from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid$$;

-- Only existing native source, sealed simulated Main funding, and receipt-bound
-- native playoff completion are accepted. No ordinary V2 IDs are synthesized.
create function app.native_mixed_main_finance_source_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare p jsonb;c app.native_mixed_playoff_contexts_v1%rowtype;f app.native_mixed_playoff_completions_v1%rowtype;body jsonb;begin
 p:=app.native_mixed_playoff_source_v1(tid,eid);if p is null then return null;end if;
 select*into c from app.native_mixed_playoff_contexts_v1 where tournament_id=tid and event_id=eid;
 select*into f from app.native_mixed_playoff_completions_v1 where context_id=c.id;
 if c.id is null or f.id is null or c.source_capture is distinct from p->'capture'or c.source_digest is distinct from p->>'sourceDigest'
  or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true or app.native_mixed_playoff_completion_bound_v1(c.id)is distinct from true
  or p#>'{capture,review,simulatedGrossMinor}'is null or p#>>'{capture,review,simulatedGrossMinor}'!~'^[1-9][0-9]{0,11}$'
  or p#>'{capture,review,actualMoneyReceived}'is distinct from'false'::jsonb
  or p#>'{capture,settingsBinding,context,sanctioned}'is distinct from'false'::jsonb
 then return null;end if; -- sanctioned coverage needs an actual assessment bridge
 body:=jsonb_build_object('kind','native-mixed-main-finance-source-v1','tournamentId',tid,'eventId',eid,'playoffContextId',c.id,
  'playoffContextDigest',c.context_digest,'playoffSource',p,'completionId',f.id,'completionDigest',f.source_digest,'completion',f.source_capture,
  'simulatedGrossMinor',p#>'{capture,review,simulatedGrossMinor}','mainFundingSourceDigest',p#>'{capture,review,fundingSourceDigest}',
  'historicalSavedDraft',p#>'{capture,settingsBinding,draft}','costsReviewed',false,'netPrizeFundMinor',null,
  'simulationOnly',true,'ordinaryQualificationRecorded',false,'actualMoneyReceived',false,'ordinaryLiability',false,'moneyMoved',false);
 return jsonb_build_object('sourceDigest',app.native_mixed_simulation_hash_v1(body),'capture',body);
end$$;

create function app.native_mixed_main_finance_record_bound_v1(record_value uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$
declare v app.native_mixed_main_finance_records_v1%rowtype;p app.native_mixed_main_finance_records_v1%rowtype;r app.operation_receipts%rowtype;
 review app.native_mixed_main_finance_records_v1%rowtype;award app.native_mixed_main_finance_records_v1%rowtype;
 d jsonb;costs jsonb;expected jsonb;response jsonb;groups jsonb:='[]';recipients jsonb:='[]';g jsonb;a jsonb;pid jsonb;total bigint:=0;previous_amount bigint;unit integer;i integer;prior_journal text;begin
 select*into v from app.native_mixed_main_finance_records_v1 where id=record_value;if v.id is null then return false;end if;
 if v.sequence>1 then select*into p from app.native_mixed_main_finance_records_v1 where id=v.prior_id and tournament_id=v.tournament_id and event_id=v.event_id and sequence=v.sequence-1;if p.id is null then return false;end if;end if;
 if not app.native_mixed_pool_exact_v1(v.request_payload,array['version','action','expectedSourceDigest','expectedJournalDigest','data','reason'])then return false;end if;
 select app.native_mixed_simulation_hash_v1(coalesce(jsonb_agg(jsonb_build_array(id,sequence,record_digest)order by sequence),'[]'))into prior_journal
  from app.native_mixed_main_finance_records_v1 where tournament_id=v.tournament_id and event_id=v.event_id and sequence<v.sequence;
 if v.request_payload->>'expectedJournalDigest'is distinct from prior_journal then return false;end if;
 d:=v.request_payload->'data';costs:=app.native_mixed_main_finance_costs_v1(v.tournament_id,v.event_id,(v.source_capture->>'simulatedGrossMinor')::bigint,v.sequence);
 if v.kind='cost-line'then
  if not app.native_mixed_pool_exact_v1(d,array['lineId','priorRecordId','category','label','amountMinor','voided'])then return false;end if;
  select*into p from app.native_mixed_main_finance_records_v1 where tournament_id=v.tournament_id and event_id=v.event_id and kind='cost-line'and sequence<v.sequence and payload->>'lineId'=d->>'lineId'order by sequence desc limit 1;
  if d->>'priorRecordId'is distinct from p.id::text or(p.id is not null and d->>'category'is distinct from p.payload->>'category')then return false;end if;
  expected:=d||jsonb_build_object('recordId',v.id,'simulationOnly',true);
 elsif v.kind='review-costs'then
  if not app.native_mixed_pool_exact_v1(d,array['roundingUnitMinor','coverage','expectedBenefitsMinor','expectedExpensesMinor','expectedIncomeMinor','expectedNetMinor','confirmed'])
   or d->'confirmed'is distinct from'true'::jsonb or d->'expectedBenefitsMinor'is distinct from costs->'benefitsMinor'or d->'expectedExpensesMinor'is distinct from costs->'expensesMinor'
   or d->'expectedIncomeMinor'is distinct from costs->'additionalIncomeMinor'or d->'expectedNetMinor'is distinct from costs->'netMinor'then return false;end if;
  expected:=jsonb_build_object('costs',costs,'coverage',d->'coverage','roundingUnitMinor',d->'roundingUnitMinor','costsExplicitlyReviewed',true,'zeroCostsNotInferred',true,'simulationOnly',true);
 else
  select*into review from app.native_mixed_main_finance_records_v1 where id=(d->>'costReviewId')::uuid and tournament_id=v.tournament_id and event_id=v.event_id and kind='review-costs'and sequence<v.sequence;
  if review.id is null or review.source_digest<>v.source_digest or review.payload#>>'{costs,costDigest}'is distinct from costs->>'costDigest'then return false;end if;
  unit:=(review.payload->>'roundingUnitMinor')::integer;
  if v.kind='propose-awards'then
   if not app.native_mixed_pool_exact_v1(d,array['costReviewId','manualPolicy','groups','confirmed'])or d->'confirmed'is distinct from'true'::jsonb or jsonb_typeof(d->'groups')is distinct from'array'then return false;end if;
   if jsonb_array_length(d->'groups')<>4 or d#>'{manualPolicy,roundingUnitMinor}'is distinct from to_jsonb(unit)then return false;end if;
   for i in 0..3 loop
    g:=d->'groups'->i;a:=(v.source_capture#>'{completion,finishingGroups}')->i;
    if not app.native_mixed_pool_exact_v1(g,array['firstPlace','lastPlace','perPersonMinor'])or g->'firstPlace'is distinct from a->'firstPlace'or g->'lastPlace'is distinct from a->'lastPlace'
     or coalesce(g->>'perPersonMinor','')!~'^[1-9][0-9]{0,11}$'or(g->>'perPersonMinor')::bigint%unit<>0 then return false;end if;
    if i>0 and(g->>'perPersonMinor')::bigint>previous_amount then return false;end if;previous_amount:=(g->>'perPersonMinor')::bigint;
    total:=total+(g->>'perPersonMinor')::bigint*jsonb_array_length(a->'participantIds');groups:=groups||jsonb_build_array(g||jsonb_build_object('participantIds',a->'participantIds'));
   end loop;
   if total<>(costs->>'netMinor')::bigint then return false;end if;
   expected:=jsonb_build_object('costReviewId',review.id,'costReviewDigest',review.record_digest,'costDigest',costs->>'costDigest','manualPolicy',d->'manualPolicy','groups',groups,'totalMinor',total,
    'historicalSavedDraft',v.source_capture->'historicalSavedDraft','distributionAutomaticallyApproved',false,'feeComparisonNotEvaluated',true,'simulationOnly',true);
  elsif v.kind='finalize-unpaid'then
   if not app.native_mixed_pool_exact_v1(d,array['costReviewId','awardProposalId','confirmed'])or d->'confirmed'is distinct from'true'::jsonb then return false;end if;
   select*into award from app.native_mixed_main_finance_records_v1 where id=(d->>'awardProposalId')::uuid and tournament_id=v.tournament_id and event_id=v.event_id and kind='propose-awards'and sequence<v.sequence;
   if award.id is null or award.source_digest<>v.source_digest or award.payload->>'costReviewDigest'<>review.record_digest then return false;end if;
   groups:=award.payload->'groups';total:=(award.payload->>'totalMinor')::bigint;if total<>(costs->>'netMinor')::bigint then return false;end if;
   for g in select value from jsonb_array_elements(groups)loop
    for pid in select value from jsonb_array_elements(g->'participantIds')loop recipients:=recipients||jsonb_build_array(jsonb_build_object('participantId',pid,'firstPlace',g->'firstPlace','lastPlace',g->'lastPlace','amountMinor',g->'perPersonMinor','status','UNPAID_SIMULATED'));end loop;
   end loop;
   if(select count(*)from app.native_mixed_main_finance_obligations_v1 where final_record_id=v.id)<>jsonb_array_length(recipients)
    or exists(select 1 from jsonb_array_elements(recipients)x where not exists(select 1 from app.native_mixed_main_finance_obligations_v1 ob where ob.final_record_id=v.id and ob.tournament_id=v.tournament_id and ob.event_id=v.event_id
     and ob.participant_id::text=x->>'participantId'and ob.first_place=(x->>'firstPlace')::integer and ob.last_place=(x->>'lastPlace')::integer and ob.amount_minor=(x->>'amountMinor')::bigint and ob.rounding_unit_minor=unit and ob.status='UNPAID_SIMULATED'))then return false;end if;
   expected:=jsonb_build_object('costReviewId',review.id,'costReviewDigest',review.record_digest,'awardProposalId',award.id,'awardProposalDigest',award.record_digest,'completionDigest',v.source_capture->'completionDigest',
    'roundingUnitMinor',unit,'groups',groups,'recipients',recipients,'totalMinor',total,'reviewedCosts',costs,'status','UNPAID_SIMULATED','simulationOnly',true,'actualMoneyReceived',false,'ordinaryLiability',false,'moneyMoved',false,'refunds','[]'::jsonb);
  else return false;end if;
 end if;
 if v.payload is distinct from expected then return false;end if;
 response:=jsonb_build_object('status','accepted','kind','native-mixed-main-finance-receipt-v1','action',v.kind,'recordId',v.id,'recordDigest',v.record_digest,'sequence',v.sequence,
  'simulationOnly',true,'ordinaryQualificationRecorded',false,'actualMoneyReceived',false,'ordinaryLiability',false,'moneyMoved',false,'payoutAuthorized',false);
 if v.response_payload is distinct from response then return false;end if;
 select*into r from app.operation_receipts where id=v.receipt_id;
 return v.request_payload->>'action'=v.kind and v.request_payload->>'version'='native-mixed-main-finance-request-v1'
  and v.request_payload->>'expectedSourceDigest'=v.source_digest and v.source_capture->>'tournamentId'=v.tournament_id::text and v.source_capture->>'eventId'=v.event_id::text
  and v.source_digest=app.native_mixed_simulation_hash_v1(v.source_capture)
  and v.request_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-finance-request-v1',v.actor_id,v.tournament_id,v.event_id,v.request_payload))
  and v.record_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-finance-record-v1',v.id,v.tournament_id,v.event_id,v.sequence,v.prior_id,v.kind,v.actor_id,v.actor_session_id,v.operation_id,v.request_payload,v.source_digest,v.payload))
  and r.id is not null and r.tournament_id=v.tournament_id and r.actor_profile_id=v.actor_id and r.client_operation_id=v.operation_id
  and r.operation_type='native_mixed_main_finance_v1'and r.target_id=v.id and r.request_hash=v.request_hash and r.outcome='accepted'and r.response_payload=v.response_payload
  and exists(select 1 from app.audit_events a where a.operation_receipt_id=r.id and a.tournament_id=v.tournament_id and a.actor_profile_id=v.actor_id
   and a.entity_type='native_mixed_main_finance_simulation'and a.entity_id=v.id and a.action=v.kind and a.after_state=v.response_payload);
end$$;

-- Replays active cost lines only; absence is NOT Director review of zero costs.
create function app.native_mixed_main_finance_costs_v1(tid uuid,eid uuid,gross bigint,before_sequence integer default 2147483647)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare rows jsonb;benefits bigint;expenses bigint;income bigint;h text;begin
 select coalesce(jsonb_agg(payload order by payload->>'lineId'),'[]')into rows from(
  select distinct on(payload->>'lineId')payload from app.native_mixed_main_finance_records_v1
   where tournament_id=tid and event_id=eid and kind='cost-line'and sequence<before_sequence order by payload->>'lineId',sequence desc)x;
 select coalesce(sum((x->>'amountMinor')::bigint)filter(where x->>'category'='player_benefit'and x->'voided'='false'::jsonb),0),
  coalesce(sum((x->>'amountMinor')::bigint)filter(where x->>'category'='operating_expense'and x->'voided'='false'::jsonb),0),
  coalesce(sum((x->>'amountMinor')::bigint)filter(where x->>'category'='unrestricted_income'and x->'voided'='false'::jsonb),0)into benefits,expenses,income from jsonb_array_elements(rows)x;
 h:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-cost-lines-v1',rows));
 return jsonb_build_object('lines',rows,'costDigest',h,'grossMinor',gross,'benefitsMinor',benefits,'expensesMinor',expenses,'additionalIncomeMinor',income,'netMinor',gross-benefits-expenses+income);
end$$;

create function app.execute_native_mixed_main_finance_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;action text;d jsonb;source jsonb;head app.native_mixed_main_finance_records_v1%rowtype;old app.operation_receipts%rowtype;
 previous app.native_mixed_main_finance_records_v1%rowtype;review app.native_mixed_main_finance_records_v1%rowtype;awards app.native_mixed_main_finance_records_v1%rowtype;
 costs jsonb;record_payload jsonb;groups jsonb;g jsonb;actual jsonb;recipients jsonb:='[]';pid jsonb;total bigint:=0;amount bigint;previous_amount bigint;unit integer;latest_prize jsonb;saved_rounding text;
 rh text;rd text;response jsonb;rid uuid:=extensions.gen_random_uuid();idv uuid:=extensions.gen_random_uuid();n integer;i integer;begin
 if app.native_mixed_main_finance_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 actor:=app.native_mixed_pool_actor_v1();if actor is null or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1,app.tournament_roles in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;if not found then return null;end if;
 if tid is null or eid is null or op is null or not app.native_mixed_pool_exact_v1(request,array['version','action','expectedSourceDigest','expectedJournalDigest','data','reason'])
  or request->>'version'is distinct from'native-mixed-main-finance-request-v1'or coalesce(request->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'or coalesce(request->>'expectedJournalDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or length(request->>'reason')not between 1 and 500 or request->>'reason'<>trim(request->>'reason')or request->>'reason'~'[[:cntrl:]]'
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 action:=request->>'action';d:=request->'data';if action is null or action not in('cost-line','review-costs','propose-awards','finalize-unpaid')then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 rh:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-finance-request-v1',actor,tid,eid,request));
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if old.id is not null then
  if old.tournament_id<>tid or old.operation_type<>'native_mixed_main_finance_v1'or old.request_hash<>rh then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  if app.native_mixed_main_finance_record_bound_v1(old.target_id)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  return old.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 source:=app.native_mixed_main_finance_source_v1(tid,eid);if source is null or source->>'sourceDigest'<>request->>'expectedSourceDigest'then return jsonb_build_object('status','rejected','code','source_or_fee_coverage_unavailable');end if;
 lock table app.native_mixed_main_finance_records_v1,app.native_mixed_main_finance_obligations_v1 in share row exclusive mode nowait;
 if request->>'expectedJournalDigest'<>app.native_mixed_main_finance_journal_v1(tid,eid)then return jsonb_build_object('status','rejected','code','journal_changed');end if;
 if exists(select 1 from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid and(source_digest<>source->>'sourceDigest'or app.native_mixed_main_finance_record_bound_v1(id)is distinct from true))then return jsonb_build_object('status','blocked','code','source_or_history_changed');end if;
 if exists(select 1 from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid and kind='finalize-unpaid')then return jsonb_build_object('status','rejected','code','already_finalized');end if;
 select*into head from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid order by sequence desc limit 1;n:=coalesce(head.sequence,0)+1;
 costs:=app.native_mixed_main_finance_costs_v1(tid,eid,(source#>>'{capture,simulatedGrossMinor}')::bigint);
 if action='cost-line'then
  if not app.native_mixed_pool_exact_v1(d,array['lineId','priorRecordId','category','label','amountMinor','voided'])or app.native_mixed_simulation_uuid_v1(d->>'lineId')is distinct from true
   or(d->'priorRecordId'is distinct from'null'::jsonb and app.native_mixed_simulation_uuid_v1(d->>'priorRecordId')is distinct from true)
   or coalesce(d->>'category','')not in('player_benefit','operating_expense','unrestricted_income')or jsonb_typeof(d->'label')is distinct from'string'or length(d->>'label')not between 1 and 200 or d->>'label'<>trim(d->>'label')or d->>'label'~'[[:cntrl:]]'
   or jsonb_typeof(d->'amountMinor')is distinct from'number'or coalesce(d->>'amountMinor','')!~'^(0|[1-9][0-9]{0,11})$'or jsonb_typeof(d->'voided')is distinct from'boolean'
   then return jsonb_build_object('status','rejected','code','invalid_cost_line');end if;
  select r.*into previous from app.native_mixed_main_finance_records_v1 r where r.tournament_id=tid and r.event_id=eid and r.kind='cost-line'and r.payload->>'lineId'=d->>'lineId'order by r.sequence desc limit 1;
  if(previous.id is null and(d->'priorRecordId'is distinct from'null'::jsonb or d->'voided'='true'::jsonb))or(previous.id is not null and(d->>'priorRecordId'is distinct from previous.id::text or d->>'category'is distinct from previous.payload->>'category'))
   or(d->'voided'='true'::jsonb and d->'amountMinor'is distinct from'0'::jsonb)then return jsonb_build_object('status','rejected','code','cost_lineage_changed');end if;
  record_payload:=d||jsonb_build_object('recordId',idv,'simulationOnly',true);
 elsif action='review-costs'then
  if not app.native_mixed_pool_exact_v1(d,array['roundingUnitMinor','coverage','expectedBenefitsMinor','expectedExpensesMinor','expectedIncomeMinor','expectedNetMinor','confirmed'])
   or d->'confirmed'is distinct from'true'::jsonb or d->'roundingUnitMinor'not in('100'::jsonb,'500'::jsonb,'1000'::jsonb)
   or not app.native_mixed_pool_exact_v1(d->'coverage',array['status','reason'])or d#>>'{coverage,status}'is distinct from'not_applicable'
   or jsonb_typeof(d#>'{coverage,reason}')is distinct from'string'or length(trim(d#>>'{coverage,reason}'))not between 1 and 500
   or d->'expectedBenefitsMinor'is distinct from costs->'benefitsMinor'or d->'expectedExpensesMinor'is distinct from costs->'expensesMinor'
   or d->'expectedIncomeMinor'is distinct from costs->'additionalIncomeMinor'or d->'expectedNetMinor'is distinct from costs->'netMinor'
   or(costs->>'netMinor')::bigint<0 then return jsonb_build_object('status','rejected','code','cost_review_required');end if;
  -- Latest regular rounding is captured by the verified current playoff source.
  -- Existing legacy sources and exact historical receipts remain unchanged.
  latest_prize:=source#>'{capture,playoffSource,capture,latestPrize}';
  if latest_prize is not null then
   saved_rounding:=latest_prize#>>'{plan,draft,rounding,regular}';
   if latest_prize->>'kind'is distinct from'native-mixed-latest-prize-pin-v1'
    or saved_rounding is null or saved_rounding not in('1','5','10')then
    return jsonb_build_object('status','rejected','code','saved_rounding_unavailable');end if;
   if d->'roundingUnitMinor'is distinct from to_jsonb(saved_rounding::integer*100)then
    return jsonb_build_object('status','rejected','code','saved_rounding_mismatch');end if;
  end if;
  record_payload:=jsonb_build_object('costs',costs,'coverage',d->'coverage','roundingUnitMinor',d->'roundingUnitMinor','costsExplicitlyReviewed',true,'zeroCostsNotInferred',true,'simulationOnly',true);
 else
  if action='propose-awards'then
   if not app.native_mixed_pool_exact_v1(d,array['costReviewId','manualPolicy','groups','confirmed'])or d->'confirmed'is distinct from'true'::jsonb
    or app.native_mixed_simulation_uuid_v1(d->>'costReviewId')is distinct from true or jsonb_typeof(d->'groups')is distinct from'array'
    or not app.native_mixed_pool_exact_v1(d->'manualPolicy',array['version','roundingUnitMinor','disclosure'])or d#>>'{manualPolicy,version}'is distinct from'native-mixed-main-manual-whole-group-v1'
    or jsonb_typeof(d#>'{manualPolicy,disclosure}')is distinct from'string'or length(trim(d#>>'{manualPolicy,disclosure}'))not between 1 and 1000
   then return jsonb_build_object('status','rejected','code','invalid_manual_awards');end if;
   select*into review from app.native_mixed_main_finance_records_v1 where id=(d->>'costReviewId')::uuid and tournament_id=tid and event_id=eid and kind='review-costs';
  else
   if not app.native_mixed_pool_exact_v1(d,array['costReviewId','awardProposalId','confirmed'])or d->'confirmed'is distinct from'true'::jsonb
    or app.native_mixed_simulation_uuid_v1(d->>'costReviewId')is distinct from true or app.native_mixed_simulation_uuid_v1(d->>'awardProposalId')is distinct from true then return jsonb_build_object('status','rejected','code','invalid_finalize');end if;
   select*into awards from app.native_mixed_main_finance_records_v1 where id=(d->>'awardProposalId')::uuid and tournament_id=tid and event_id=eid and kind='propose-awards';
   select*into review from app.native_mixed_main_finance_records_v1 where id=(d->>'costReviewId')::uuid and tournament_id=tid and event_id=eid and kind='review-costs';
   if awards.id is null or awards.payload->>'costReviewId'is distinct from review.id::text
    or awards.id is distinct from(select id from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid and kind='propose-awards'order by sequence desc limit 1)
   then return jsonb_build_object('status','rejected','code','award_proposal_changed');end if;
  end if;
  if review.id is null or review.id is distinct from(select id from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid and kind='review-costs'order by sequence desc limit 1)
   or review.payload#>>'{costs,costDigest}'is distinct from costs->>'costDigest'or review.source_digest<>source->>'sourceDigest'
   then return jsonb_build_object('status','rejected','code','current_cost_review_required');end if;
  unit:=(review.payload->>'roundingUnitMinor')::integer;
  if action='propose-awards'then
   if d#>'{manualPolicy,roundingUnitMinor}'is distinct from to_jsonb(unit)or jsonb_array_length(d->'groups')<>4 then return jsonb_build_object('status','rejected','code','manual_policy_or_groups_changed');end if;
   groups:='[]';
   for i in 0..3 loop
    g:=d->'groups'->i;actual:=(source#>'{capture,completion,finishingGroups}')->i;
    if not app.native_mixed_pool_exact_v1(g,array['firstPlace','lastPlace','perPersonMinor'])or g->'firstPlace'is distinct from actual->'firstPlace'or g->'lastPlace'is distinct from actual->'lastPlace'
     or jsonb_typeof(g->'perPersonMinor')is distinct from'number'or coalesce(g->>'perPersonMinor','')!~'^[1-9][0-9]{0,11}$'then return jsonb_build_object('status','rejected','code','whole_group_required');end if;
    amount:=(g->>'perPersonMinor')::bigint;if amount%unit<>0 then return jsonb_build_object('status','rejected','code','selected_increment_required');end if;
    if i>0 and amount>previous_amount then return jsonb_build_object('status','rejected','code','award_order_required');end if;previous_amount:=amount;
    total:=total+amount*jsonb_array_length(actual->'participantIds');groups:=groups||jsonb_build_array(g||jsonb_build_object('participantIds',actual->'participantIds'));
   end loop;
   if total<>(costs->>'netMinor')::bigint then return jsonb_build_object('status','rejected','code','fund_imbalance');end if;
   record_payload:=jsonb_build_object('costReviewId',review.id,'costReviewDigest',review.record_digest,'costDigest',costs->>'costDigest','manualPolicy',d->'manualPolicy','groups',groups,'totalMinor',total,
    'historicalSavedDraft',source#>'{capture,historicalSavedDraft}','distributionAutomaticallyApproved',false,'feeComparisonNotEvaluated',true,'simulationOnly',true);
  else
   groups:=awards.payload->'groups';total:=(awards.payload->>'totalMinor')::bigint;
   if total<>(costs->>'netMinor')::bigint or awards.payload->>'costReviewDigest'<>review.record_digest then return jsonb_build_object('status','rejected','code','fund_or_review_changed');end if;
   for g in select value from jsonb_array_elements(groups)loop
    for pid in select value from jsonb_array_elements(g->'participantIds')loop recipients:=recipients||jsonb_build_array(jsonb_build_object('participantId',pid,'firstPlace',g->'firstPlace','lastPlace',g->'lastPlace','amountMinor',g->'perPersonMinor','status','UNPAID_SIMULATED'));end loop;
   end loop;
   if jsonb_array_length(recipients)<>5 or(select count(distinct x->>'participantId')from jsonb_array_elements(recipients)x)<>5 then return jsonb_build_object('status','blocked','code','recipient_mapping_changed');end if;
   record_payload:=jsonb_build_object('costReviewId',review.id,'costReviewDigest',review.record_digest,'awardProposalId',awards.id,'awardProposalDigest',awards.record_digest,'completionDigest',source#>'{capture,completionDigest}',
    'roundingUnitMinor',unit,'groups',groups,'recipients',recipients,'totalMinor',total,'reviewedCosts',costs,'status','UNPAID_SIMULATED','simulationOnly',true,'actualMoneyReceived',false,'ordinaryLiability',false,'moneyMoved',false,'refunds','[]'::jsonb);
  end if;
 end if;
 rd:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-finance-record-v1',idv,tid,eid,n,head.id,action,actor,(auth.jwt()->>'session_id')::uuid,op,request,source->>'sourceDigest',record_payload));
 response:=jsonb_build_object('status','accepted','kind','native-mixed-main-finance-receipt-v1','action',action,'recordId',idv,'recordDigest',rd,'sequence',n,
  'simulationOnly',true,'ordinaryQualificationRecorded',false,'actualMoneyReceived',false,'ordinaryLiability',false,'moneyMoved',false,'payoutAuthorized',false);
 if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then raise exception using errcode='P0001',message='native_main_authorization_changed';end if;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(rid,tid,actor,'native_mixed_main_finance_v1',idv,rh,op,'accepted',response,clock_timestamp());
 insert into app.native_mixed_main_finance_records_v1(id,tournament_id,event_id,sequence,prior_id,kind,actor_id,actor_session_id,operation_id,receipt_id,request_payload,request_hash,source_capture,source_digest,payload,record_digest,response_payload)
  values(idv,tid,eid,n,head.id,action,actor,(auth.jwt()->>'session_id')::uuid,op,rid,request,rh,source->'capture',source->>'sourceDigest',record_payload,rd,response);
 if action='finalize-unpaid'then
  for g in select value from jsonb_array_elements(recipients)loop insert into app.native_mixed_main_finance_obligations_v1(final_record_id,tournament_id,event_id,participant_id,first_place,last_place,amount_minor,rounding_unit_minor)
   values(idv,tid,eid,(g->>'participantId')::uuid,(g->>'firstPlace')::integer,(g->>'lastPlace')::integer,(g->>'amountMinor')::bigint,unit);end loop;
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,rid,'native_mixed_main_finance_simulation',idv,action,response);
 if app.native_mixed_main_finance_record_bound_v1(idv)is distinct from true then raise exception 'native Main receipt postcondition failed';end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.get_native_mixed_main_finance_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;source jsonb;costs jsonb;rows jsonb;response jsonb;begin
 if app.native_mixed_main_finance_enabled_v1()is distinct from true then return null;end if;actor:=app.native_mixed_pool_actor_v1();if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1,app.tournament_roles in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;if not found then return null;end if;
 source:=app.native_mixed_main_finance_source_v1(tid,eid);if source is null then return jsonb_build_object('status','blocked','code','source_or_fee_coverage_unavailable');end if;
 lock table app.native_mixed_main_finance_records_v1,app.native_mixed_main_finance_obligations_v1 in share mode nowait;
 if exists(select 1 from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid and(source_digest<>source->>'sourceDigest'or app.native_mixed_main_finance_record_bound_v1(id)is distinct from true))then return jsonb_build_object('status','blocked','code','source_or_history_changed');end if;
 costs:=app.native_mixed_main_finance_costs_v1(tid,eid,(source#>>'{capture,simulatedGrossMinor}')::bigint);
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'sequence',sequence,'kind',kind,'payload',payload,'recordDigest',record_digest)order by sequence),'[]')into rows from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid;
 response:=jsonb_build_object('status','source_available','source',source,'journalDigest',app.native_mixed_main_finance_journal_v1(tid,eid),'costs',costs,'records',rows,
  'costsReviewed',exists(select 1 from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid and kind='review-costs'and payload#>>'{costs,costDigest}'=costs->>'costDigest'),
  'simulationOnly',true,'actualMoneyReceived',false,'ordinaryLiability',false,'moneyMoved',false,'payoutAuthorized',false);
 if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

do $acl$declare p regprocedure;begin foreach p in array array[
 'app.native_mixed_main_finance_enabled_v1()'::regprocedure,'app.native_mixed_main_finance_journal_v1(uuid,uuid)'::regprocedure,
 'app.native_mixed_main_finance_source_v1(uuid,uuid)'::regprocedure,'app.native_mixed_main_finance_record_bound_v1(uuid)'::regprocedure,
 'app.native_mixed_main_finance_costs_v1(uuid,uuid,bigint,integer)'::regprocedure,'app.execute_native_mixed_main_finance_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.get_native_mixed_main_finance_v1(uuid,uuid)'::regprocedure]loop execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$acl$;
-- END database/proposals/native-mixed-main-finance-v1.sql

-- BEGIN database/proposals/native-mixed-main-operation-read-v1.sql source SHA256 1919691ae0206b170cf3c7c936bb02f927d923b42e223fa24f14c7d5a2e09333
-- PRIVATE DEFAULT-OFF SOURCE CANDIDATE. Historical owned Main receipt only.
-- No policy, grant, journal mutation, current-source claim or retry permission.
-- Stored original session evidence remains internal; current authentication
-- does not certify that the caller still uses the original request's session.
create function app.native_mixed_main_operation_read_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create function app.get_native_mixed_main_operation_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql volatile security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare actor uuid;v_action text;rh text;response jsonb;
 record_row app.native_mixed_main_finance_records_v1%rowtype;
 receipt_row app.operation_receipts%rowtype;
begin
 if app.native_mixed_main_operation_read_enabled_v1()is distinct from true
  or app.native_mixed_main_finance_enabled_v1()is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return null;end if;
 -- Normalized JSON technical bound precedes lock/hash work. A cold backend may
 -- still need rowtype catalog locks during compilation: SQLSTATE 55P03 there
 -- is an unknown read outcome, not proof of absence or authorization to write.
 if request is null or octet_length(convert_to(request::text,'UTF8'))>32768 then return null;end if;
 actor:=app.native_mixed_pool_actor_v1();if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1,
  app.tournament_roles in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 perform 1 from app.tournament_roles tr where tr.tournament_id=tid and tr.profile_id=actor and tr.role='director'for share nowait;
 if not found then return null;end if;
 if tid is null or eid is null or op is null
  or app.native_mixed_pool_exact_v1(request,array['version','action','expectedSourceDigest','expectedJournalDigest','data','reason'])is distinct from true
  or request->>'version'is distinct from'native-mixed-main-finance-request-v1'
  or jsonb_typeof(request->'expectedSourceDigest')is distinct from'string'or coalesce(request->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'expectedJournalDigest')is distinct from'string'or coalesce(request->>'expectedJournalDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'<>trim(request->>'reason')
  or length(request->>'reason')not between 1 and 500 or request->>'reason'~'[[:cntrl:]]'
  or jsonb_typeof(request->'data')is distinct from'object'then return null;end if;
 v_action:=request->>'action';if v_action is null or v_action not in('cost-line','review-costs','propose-awards','finalize-unpaid')then return null;end if;
 -- The existing bound helper reads the complete journal prefix, cost lineage,
 -- award/review references, actual final obligation rows, receipts and audits.
 -- Reserve all those domains coherently without requiring the current source.
 lock table app.native_mixed_main_finance_records_v1,app.native_mixed_main_finance_obligations_v1,
  app.operation_receipts,app.audit_events in share mode nowait;
 select m.*into record_row from app.native_mixed_main_finance_records_v1 m where m.actor_id=actor and m.operation_id=op;
 -- Missing is unknown; it never establishes non-execution or permission.
 if record_row.id is null then return null;end if;
 rh:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-finance-request-v1',actor,tid,eid,request));
 if record_row.tournament_id is distinct from tid or record_row.event_id is distinct from eid
  or record_row.actor_id is distinct from actor or record_row.operation_id is distinct from op
  or record_row.kind is distinct from v_action or record_row.request_payload is distinct from request
  or record_row.request_hash is distinct from rh
  or app.native_mixed_main_finance_record_bound_v1(record_row.id)is distinct from true then return null;end if;
 select r.*into receipt_row from app.operation_receipts r where r.id=record_row.receipt_id;
 if receipt_row.id is null or receipt_row.tournament_id is distinct from tid or receipt_row.actor_profile_id is distinct from actor
  or receipt_row.client_operation_id is distinct from op or receipt_row.target_id is distinct from record_row.id
  or receipt_row.operation_type is distinct from'native_mixed_main_finance_v1'
  or receipt_row.request_hash is distinct from rh or receipt_row.outcome is distinct from'accepted'
  or receipt_row.response_payload is distinct from record_row.response_payload then return null;end if;
 -- Independently pin the public response; the bound helper also proves that
 -- this response is the exact audit after_state and reconstructs payload/rows.
 response:=jsonb_build_object('status','accepted','kind','native-mixed-main-finance-receipt-v1','action',v_action,
  'recordId',record_row.id,'recordDigest',record_row.record_digest,'sequence',record_row.sequence,
  'simulationOnly',true,'ordinaryQualificationRecorded',false,'actualMoneyReceived',false,
  'ordinaryLiability',false,'moneyMoved',false,'payoutAuthorized',false);
 if response is distinct from record_row.response_payload then return null;end if;
 if app.native_mixed_pool_actor_v1()is distinct from actor
  or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 return response||jsonb_build_object('operationId',op,'tournamentId',tid,'eventId',eid,
  'current',false,'historicalReceipt',true,'recovered',true,'currentSourceVerified',false,
  'writeAuthorized',false,'originalSessionVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy','current',false,'writeAuthorized',false);end$$;

create function public.get_native_mixed_main_operation_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language sql volatile security definer set search_path=''as $$
 select app.get_native_mixed_main_operation_v1(p_tournament_id,p_event_id,p_operation_id,p_request)
$$;
do $acl$declare f regprocedure;begin foreach f in array array[
 'app.native_mixed_main_operation_read_enabled_v1()'::regprocedure,
 'app.get_native_mixed_main_operation_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'public.get_native_mixed_main_operation_v1(uuid,uuid,uuid,jsonb)'::regprocedure]loop
 execute format('alter function %s owner to postgres',f);
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
end loop;end$acl$;
-- END database/proposals/native-mixed-main-operation-read-v1.sql

-- BEGIN database/proposals/native-mixed-playoff-finance-transport-v1.sql source SHA256 dd4fa8d4ab5fc35d9ccbad13d90ced232b9dfc11972a8942f35a28295ec38c7e
-- LOCAL CLOSED CANDIDATE. Normal authenticated-subject RPC bridge only.
-- Dependencies: reviewed native mixed pool, playoff, own-read and Main Finance
-- proposals. Installs no application access, cohort, route or feature enablement.
-- Private writers retain all current session/issuer/expiry/scope/role/identity,
-- source, receipt, audit, concurrency and simulated-only checks.
do $transport$
declare item record;declaration text;arguments text;types text;signature text;size_guard text;
begin
 for item in select*from(values
  ('get_native_mixed_playoff_own_v1',false),
  ('get_native_mixed_playoff_v1',false),
  ('execute_native_mixed_playoff_v1',true),
  ('get_native_mixed_pool_finance_v1',false),
  ('execute_native_mixed_pool_finance_v1',true),
  ('get_native_mixed_main_finance_v1',false),
  ('execute_native_mixed_main_finance_v1',true)
 )as definitions(name,writing)loop
  declaration:='p_tournament_id uuid,p_event_id uuid';arguments:='p_tournament_id,p_event_id';types:='uuid,uuid';size_guard:='';
  if item.writing then
   declaration:=declaration||',p_operation_id uuid,p_request jsonb';arguments:=arguments||',p_operation_id,p_request';types:=types||',uuid,jsonb';
   -- Normalized UTF-8 JSON command bound, not an HTTP wire-byte bound or a
   -- business cap on custom costs, players, payout places or ratios.
   size_guard:=$guard$if p_request is not null and octet_length(convert_to(p_request::text,'UTF8'))>32768 then return jsonb_build_object('status','rejected','code','request_too_large');end if;$guard$;
  end if;
  if to_regprocedure('app.'||quote_ident(item.name)||'('||types||')')is null then
   raise exception 'native_mixed_transport_dependency_missing: %',item.name;
  end if;
  execute format($definition$
   create function public.%I(%s)returns jsonb
   language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $body$
   begin
    if auth.role()is distinct from'authenticated'then return null;end if;
    %s
    return app.%I(%s);
   end$body$;
  $definition$,item.name,declaration,size_guard,item.name,arguments);
  signature:='public.'||quote_ident(item.name)||'('||types||')';
  execute format('alter function %s owner to postgres',signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);
 end loop;
end$transport$;
-- END database/proposals/native-mixed-playoff-finance-transport-v1.sql
