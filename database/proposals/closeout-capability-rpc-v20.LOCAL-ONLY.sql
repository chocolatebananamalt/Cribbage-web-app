-- LOCAL CLOSED PROPOSAL. Apply after exact reviewed V18 + V19 + V20 fence,
-- within the SAME transaction as their preflight. No client execute grants.
begin;
create table app.closeout_runtime_pins_v20(
 singleton boolean primary key check(singleton),
 signatures text[] not null,tables text[] not null,
 expected_catalog_hash text not null check(expected_catalog_hash~'^[a-f0-9]{64}$'),
 admission_set_hash text not null check(admission_set_hash~'^[a-f0-9]{64}$'));
alter table app.closeout_runtime_pins_v20 enable row level security;
alter table app.closeout_runtime_pins_v20 force row level security;
revoke all on app.closeout_runtime_pins_v20 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.closeout_runtime_pins_v20 for each row execute function app.reject_immutable_history();
create trigger no_truncate before truncate on app.closeout_runtime_pins_v20 for each statement execute function app.reject_immutable_history();

-- Hash canonical code/security metadata, never the stored expected hash or
-- changing control values. Missing signatures/relations produce NULL entries,
-- hence cannot compare equal to the originally complete installation snapshot.
create function app.closeout_catalog_hash_v20(signatures text[],tables text[])returns text
language sql stable security definer set search_path=''as $$
 select encode(extensions.digest(convert_to(jsonb_build_array(
  (select jsonb_agg(jsonb_build_array(s,p.proowner::regrole::text,p.prosecdef,p.provolatile,p.proconfig,
   coalesce((select jsonb_agg(a::text order by a::text collate "C")from unnest(p.proacl)a),'null'::jsonb),
   replace(pg_get_functiondef(p.oid),E'\r\n',E'\n'))order by s collate "C")from unnest(signatures)s left join pg_proc p on p.oid=to_regprocedure(s)),
  (select jsonb_agg(jsonb_build_array(t,c.relowner::regrole::text,c.relrowsecurity,c.relforcerowsecurity,
   coalesce((select jsonb_agg(a::text order by a::text collate "C")from unnest(c.relacl)a),'null'::jsonb),
   (select jsonb_agg(jsonb_build_array(tr.tgname,tr.tgenabled,pg_get_triggerdef(tr.oid),
    replace(pg_get_functiondef(tr.tgfoid),E'\r\n',E'\n'),fp.proowner::regrole::text,fp.proconfig,
    (select jsonb_agg(a::text order by a::text collate "C")from unnest(fp.proacl)a))order by tr.tgname collate "C")from pg_trigger tr join pg_proc fp on fp.oid=tr.tgfoid where tr.tgrelid=c.oid and not tr.tgisinternal),
   (select jsonb_agg(jsonb_build_array(att.attname,att.atttypid::regtype::text,att.attnotnull,att.attidentity,att.attgenerated,
    pg_get_expr(d.adbin,d.adrelid),(select jsonb_agg(a::text order by a::text collate "C")from unnest(att.attacl)a))order by att.attnum)from pg_attribute att left join pg_attrdef d on d.adrelid=att.attrelid and d.adnum=att.attnum where att.attrelid=c.oid and att.attnum>0 and not att.attisdropped),
   (select jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid),convalidated,condeferrable,condeferred)order by conname collate "C")from pg_constraint where conrelid=c.oid),
   (select jsonb_agg(jsonb_build_array(polname,polcmd,polpermissive,
    (select jsonb_agg(r::regrole::text order by r::regrole::text collate "C")from unnest(polroles)r),pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid))order by polname collate "C")from pg_policy where polrelid=c.oid))order by t collate "C")from unnest(tables)t left join pg_class c on c.oid=to_regclass(t)),
  (select jsonb_agg(jsonb_build_array(nspname,nspowner::regrole::text,(select jsonb_agg(a::text order by a::text collate "C")from unnest(nspacl)a))order by nspname collate "C")from pg_namespace where nspname in('app','auth','public','extensions')),
  (select jsonb_agg(jsonb_build_array(rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolbypassrls,rolvaliduntil)order by rolname collate "C")from pg_roles where rolname in('postgres','anon','authenticated','service_role')),
  (select jsonb_agg(jsonb_build_array(roleid::regrole::text,member::regrole::text,grantor::regrole::text,admin_option,inherit_option,set_option)order by roleid::regrole::text collate "C",member::regrole::text collate "C",grantor::regrole::text collate "C")from pg_auth_members where roleid in(select oid from pg_roles where rolname in('postgres','anon','authenticated','service_role'))or member in(select oid from pg_roles where rolname in('postgres','anon','authenticated','service_role'))),
  (select jsonb_agg(jsonb_build_array(extname,extversion,extowner::regrole::text,extnamespace::regnamespace::text)order by extname collate "C")from pg_extension where extname='pgcrypto'))::text,'utf8'),'sha256'),'hex')
$$;
revoke all on function app.closeout_catalog_hash_v20(text[],text[])from public,anon,authenticated,service_role;
create function app.closeout_catalog_verified_v20()returns boolean language sql stable security definer set search_path=''as $$
 select coalesce((select expected_catalog_hash=app.closeout_catalog_hash_v20(signatures,tables)from app.closeout_runtime_pins_v20 where singleton),false)
$$;
revoke all on function app.closeout_catalog_verified_v20()from public,anon,authenticated,service_role;

-- Replace only the previously exact V19 admission body, preserving OID/ACL.
do $pin$declare target regprocedure:='app.require_closeout_write_admission_v19()'::regprocedure;old text;definition text;begin
 select prosrc into old from pg_proc where oid=target and prosecdef and proowner='postgres'::regrole;
 if old is null or encode(extensions.digest(convert_to(replace(old,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')<>'484af50d38396ee01d691e3a640b9c4ef13ff848133df91142ef900835232d65'then raise exception 'closeout_admission_preimage_required';end if;
 definition:=pg_get_functiondef(target);
 execute replace(definition,old,replace(old,'if not c.bootstrap_fenced or c.paused then','if not app.closeout_catalog_verified_v20() or not c.bootstrap_fenced or c.paused then'));
end$pin$;

create function public.get_closeout_capability_v19(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare c app.closeout_write_control_v19%rowtype;p app.closeout_runtime_pins_v20%rowtype;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role'then raise exception 'server_only_closeout_capability';end if;
 if actor is null or sid is null or tid is null or eid is null or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 perform 1 from auth.sessions where id=sid and user_id=actor and(not_after is null or not_after>clock_timestamp())for share nowait;if not found then return null;end if;
 select * into strict c from app.closeout_write_control_v19 where singleton;
 select * into strict p from app.closeout_runtime_pins_v20 where singleton;
 if not c.bootstrap_fenced or not app.closeout_catalog_verified_v20()then return null;end if;
 return jsonb_build_object('kind','closeout-capability-v19','actorId',actor,'sessionId',sid,'tournamentId',tid,'eventId',eid,
  'catalogHash',p.expected_catalog_hash,'admissionSetHash',p.admission_set_hash,'controlVersion',c.version,
  'drainedVersion',c.drained_version,'paused',c.paused,'bootstrapFenced',c.bootstrap_fenced,'readAvailable',true,
  'writeAvailable',not c.paused and app.closeout_retirement_enabled_v17());
end$$;
alter function public.get_closeout_capability_v19(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function public.get_closeout_capability_v19(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
-- Expected snapshot INSERT is generated only by the exact reviewed installer;
-- this fragment cannot activate itself or auto-pin a drifted database.
commit;
