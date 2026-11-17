-- LOCAL PROTOCOL PROPOSAL, NOT AN INSTALLER. No grants or activation.
-- bootstrap_fenced MUST stay false until all pinned first-effect tables and
-- old-running-body fencing have been installed atomically. This file does NOT
-- establish that boundary. Never change this marker merely to enable a UI.
begin;
create table app.closeout_write_control_v19(
 singleton boolean primary key default true check(singleton),
 version bigint not null default 0 check(version>=0),
 paused boolean not null default true,
 drained_version bigint not null default 0 check(drained_version>=0 and drained_version<=version),
 bootstrap_fenced boolean not null default false,
 check(not paused or drained_version=version));
insert into app.closeout_write_control_v19(singleton)values(true);
alter table app.closeout_write_control_v19 enable row level security;
alter table app.closeout_write_control_v19 force row level security;
revoke all on app.closeout_write_control_v19 from public,anon,authenticated,service_role;
create table app.closeout_write_control_audit_v19(
 operation_id uuid primary key,request jsonb not null,result jsonb not null,
 database_actor name not null default current_user,
 database_session_actor name not null default session_user,
 created_at timestamptz not null default clock_timestamp());
alter table app.closeout_write_control_audit_v19 enable row level security;
alter table app.closeout_write_control_audit_v19 force row level security;
revoke all on app.closeout_write_control_audit_v19 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.closeout_write_control_audit_v19 for each row execute function app.reject_immutable_history();
create trigger no_truncate before truncate on app.closeout_write_control_audit_v19 for each statement execute function app.reject_immutable_history();

-- Participating writers hold the row SHARE lock until transaction completion.
-- An operator FOR UPDATE lock waits for those writers; NOWAIT admission rejects
-- newcomers while a pause owns the row. Terminal reads need no such lock.
create function app.require_closeout_write_admission_v19()returns void
language plpgsql security definer set search_path='' as $$
declare c app.closeout_write_control_v19%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception 'closeout_isolation_unsupported';end if;
 select * into strict c from app.closeout_write_control_v19 where singleton for share nowait;
 if not c.bootstrap_fenced or c.paused then raise exception using errcode='PZ019',message='closeout_writes_paused';end if;
end$$;
revoke all on function app.require_closeout_write_admission_v19()from public,anon,authenticated,service_role;

-- Direct DB operator only; deliberately SECURITY INVOKER. No HTTP entrypoint.
-- Returned result is transaction-local. Confirm COMMIT using a fresh control
-- read; exact historical replay alone is NOT proof of the current drain state.
create function app.set_closeout_write_pause_v19(op uuid,expected_version bigint,
 desired_pause boolean,reason text,authorization_ref text)returns jsonb
language plpgsql set search_path='' as $$
declare c app.closeout_write_control_v19%rowtype; prior app.closeout_write_control_audit_v19%rowtype;
 req jsonb;reply jsonb;
begin
 if current_user<>'postgres'or session_user<>'postgres' or exists(select 1 from pg_roles where rolname=current_user and(rolsuper or not rolbypassrls))then raise exception 'closeout_operator_required';end if;
 if current_setting('transaction_isolation')<>'read committed'then raise exception 'closeout_isolation_unsupported';end if;
 if op is null or expected_version is null or expected_version<0 or desired_pause is null or reason is null or btrim(reason)=''or length(reason)>1000 or authorization_ref is null or btrim(authorization_ref)=''or length(authorization_ref)>1000 then raise exception 'invalid_closeout_control_request';end if;
 req:=jsonb_build_object('expectedVersion',expected_version,'paused',desired_pause,'reason',reason,'authorizationRef',authorization_ref);
 -- Caller must set a bounded transaction lock_timeout before invoking. Never
 -- claim drained on timeout; transaction rollback leaves control/audit intact.
 if current_setting('lock_timeout')::interval<=interval '0'or current_setting('lock_timeout')::interval>interval '5 seconds'then raise exception 'bounded_lock_timeout_required';end if;
 select * into strict c from app.closeout_write_control_v19 where singleton for update;
 select * into prior from app.closeout_write_control_audit_v19 where operation_id=op;
 if found then if prior.request is distinct from req then raise exception 'closeout_control_operation_conflict';end if;return prior.result;end if;
 if c.version<>expected_version then raise exception 'closeout_control_stale_version';end if;
 if not desired_pause and not c.bootstrap_fenced then raise exception 'closeout_bootstrap_unverified';end if;
 update app.closeout_write_control_v19 set version=version+1,paused=desired_pause,
 drained_version=case when desired_pause then version+1 else drained_version end where singleton returning * into c;
 reply:=jsonb_build_object('kind','closeout-control-v19','version',c.version,'paused',c.paused,'drainedVersion',c.drained_version,'bootstrapFenced',c.bootstrap_fenced,'commitRequired',true);
 insert into app.closeout_write_control_audit_v19(operation_id,request,result)values(op,req,reply);
 return reply;
end$$;
revoke all on function app.set_closeout_write_pause_v19(uuid,bigint,boolean,text,text)from public,anon,authenticated,service_role;
commit;
