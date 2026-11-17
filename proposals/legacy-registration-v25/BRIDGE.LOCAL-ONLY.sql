-- NEW CLOSED LOCAL PROPOSAL. No public RPC, grants, hosted installation or activation.
-- Requires exact reviewed V5/V8 core and V11 shared write control; mature catalog admission is separate.
begin;
do $$begin
 if current_user<>'postgres' or (select rolsuper from pg_roles where rolname=current_user) then raise exception 'expected_nonsuperuser_postgres';end if;
 if to_regclass('identity_adoption_v8.write_control_v11')is null then raise exception 'shared_identity_write_control_required';end if;
end$$;
create schema identity_roster_v25;
revoke all on schema identity_roster_v25 from public,anon,authenticated,service_role;
create table identity_roster_v25.operations(tournament_id uuid not null,actor_id uuid not null,operation_id uuid not null,request_text text not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),response jsonb not null,primary key(tournament_id,actor_id,operation_id));
create table identity_roster_v25.control(singleton boolean primary key check(singleton),version bigint not null check(version>=0),enabled boolean not null);
insert into identity_roster_v25.control values(true,0,false);
create table identity_roster_v25.control_audit(operation_id uuid primary key,request jsonb not null,response jsonb not null,database_actor text not null,database_session_actor text not null,recorded_at timestamptz not null default clock_timestamp());
do $$declare n text;begin foreach n in array array['operations','control','control_audit']loop
 execute format('alter table identity_roster_v25.%I enable row level security',n);execute format('alter table identity_roster_v25.%I force row level security',n);
 if n<>'control'then execute format('create trigger immutable before update or delete on identity_roster_v25.%I for each row execute function identity_trial_v4.immutable()',n);execute format('create trigger no_truncate before truncate on identity_roster_v25.%I for each statement execute function identity_trial_v4.immutable()',n);end if;
end loop;end$$;
create function identity_roster_v25.set_control(op uuid,expected_version bigint,new_enabled boolean,reason text,approval_reference text)returns jsonb language plpgsql security invoker set search_path='' as $$declare h identity_roster_v25.control%rowtype;p identity_roster_v25.control_audit%rowtype;q jsonb;r jsonb;begin
 if current_user<>'postgres'or op is null or expected_version is null or expected_version<0 or new_enabled is null or not identity_trial_v4.txt(to_jsonb(reason),500,true)or not identity_trial_v4.txt(to_jsonb(approval_reference),500,true)then raise exception 'invalid_operator_request';end if;
 select*into strict h from identity_roster_v25.control where singleton for update;
 q:=jsonb_build_object('expectedVersion',expected_version,'enabled',new_enabled,'reason',reason,'approvalReference',approval_reference,'databaseActor',current_user,'databaseSessionActor',session_user);
 select*into p from identity_roster_v25.control_audit where operation_id=op;if found then if p.request=q then return p.response;end if;raise exception 'operator_idempotency_conflict';end if;
 if h.version<>expected_version then raise exception 'operator_stale_version';end if;
 update identity_roster_v25.control set version=version+1,enabled=new_enabled where singleton;
 r:=jsonb_build_object('status','recorded','version',h.version+1,'enabled',new_enabled);
 insert into identity_roster_v25.control_audit values(op,q,r,current_user,session_user,clock_timestamp());return r;
end$$;
create function identity_roster_v25.lock_scope(actor uuid,sid uuid,tid uuid,create_head boolean default false)returns void language plpgsql security invoker set search_path='' as $$begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception 'read_committed_required';end if;
 if not identity_trial_v4.authorized(actor,sid,tid)then raise exception 'identity_access_changed';end if;
 perform 1 from auth.sessions where id=sid and user_id=actor for share;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director' for share;
 -- Existing check-in takes registration lock before actor/op, while legacy manual takes actor/op first.
 -- Never add the opposite blocking edge: contention is an uncertain/busy error, not a terminal rejection.
 if not pg_try_advisory_xact_lock(hashtextextended('registration-link-v2:'||tid::text,0))then raise exception 'registration_scope_busy' using errcode='55P03';end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then raise exception 'tournament_unavailable';end if;
 lock table app.tournament_roster_entries in share row exclusive mode nowait;
 lock table app.roster_account_links,app.event_participants,app.roster_entry_lifecycle_events in share mode nowait;
 -- Insert a missing zero-revision head BEFORE holding the issued-table fence. A raw V5 head creator
 -- can finish without waiting on our issued lock; the empty head is not an identity allocation.
 if create_head then insert into identity_trial_v4.heads(tournament_id)values(tid)on conflict do nothing;end if;
 perform 1 from identity_trial_v4.heads where tournament_id=tid for update nowait;
 lock table identity_trial_v4.issued,identity_trial_v4.issued_retired in share row exclusive mode nowait;
 perform identity_adoption_v8.lock_scope(actor,sid,tid,false);
 if not identity_trial_v4.authorized(actor,sid,tid)then raise exception 'identity_access_changed';end if;
end$$;
create function identity_roster_v25.uncertain_coverage(tid uuid,e jsonb)returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from app.tournament_roster_entries r left join identity_trial_v4.latest(tid)f on f.roster_id=r.id
 where r.tournament_id=tid and (r.claimed_first_name is null or r.claimed_last_name is null or identity_trial_v4.norm(r.claimed_first_name||' '||r.claimed_last_name)=identity_trial_v4.norm((e->>'firstName')||' '||(e->>'lastName')))
 and (f.roster_id is null or identity_trial_v4.match_key(f.entry,f.address)is null or not identity_adoption_v8.row_safe(tid,r.id)))
 or exists(select 1 from identity_trial_v4.latest(tid)f where identity_trial_v4.norm((f.entry->>'firstName')||' '||(f.entry->>'lastName'))=identity_trial_v4.norm((e->>'firstName')||' '||(e->>'lastName')) and (identity_trial_v4.match_key(f.entry,f.address)is null or not exists(select 1 from app.tournament_roster_entries r where r.id=f.roster_id and r.tournament_id=tid)))
$$;
create function identity_roster_v25.prepare(actor uuid,sid uuid,tid uuid,e jsonb,a jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$declare k text;m jsonb;rev bigint;begin
 perform identity_roster_v25.lock_scope(actor,sid,tid);k:=identity_trial_v4.match_key(e,a);
 if not identity_trial_v4.valid_entry(e)or e->>'scorecardType'<>'paper'or k is null then return null;end if;
 select revision into rev from identity_trial_v4.heads where tournament_id=tid;
 select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',f.roster_id,'playerIdentityId',f.subject_id,'displayName',f.display_name,'identityVersion',f.version)order by f.roster_id),'[]')into m from identity_trial_v4.latest(tid)f where f.match_key=k and exists(select 1 from app.tournament_roster_entries r where r.tournament_id=tid and r.id=f.roster_id)and identity_adoption_v8.row_safe(tid,f.roster_id);
 if not identity_trial_v4.authorized(actor,sid,tid)then raise exception 'identity_access_changed';end if;
 return jsonb_build_object('sourceRevision',coalesce(rev,0),'sourceDigest',identity_adoption_v8.inventory_digest(tid),'coverage',case when identity_roster_v25.uncertain_coverage(tid,e)then'incomplete_candidates'else'complete'end,'matches',m);
end$$;
create function identity_roster_v25.valid_request(q jsonb)returns boolean language sql immutable set search_path='' as $$select
 identity_trial_v4.exact(q,array['kind','sourceRevision','sourceDigest','entry','address','distinction','decision','reason'])and q->>'kind'='legacy-roster-identity-request-v25'
 and jsonb_typeof(q->'sourceRevision')='number'and(q->>'sourceRevision')~'^[0-9]+$'and(q->>'sourceRevision')::numeric<=9007199254740991 and coalesce(q->>'sourceDigest','')~'^[a-f0-9]{64}$'
 and identity_trial_v4.valid_entry(q->'entry')and q->'entry'->>'scorecardType'='paper'and identity_trial_v4.match_key(q->'entry',q->'address')is not null
 and identity_trial_v4.display_name(q->'entry',q->'distinction')is not null and identity_trial_v4.txt(q->'reason',500,true)
 and(q->'decision'='null'::jsonb or identity_trial_v4.exact(q->'decision',array['action'])and q->'decision'->>'action'='distinct' or identity_trial_v4.exact(q->'decision',array['action','rosterEntryId'])and q->'decision'->>'action'='duplicate'and coalesce(q->'decision'->>'rosterEntryId','')~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
$$;
create function identity_roster_v25.rebind(actor uuid,sid uuid,tid uuid,r jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$declare p jsonb;rid uuid;subject uuid;begin
 if r->>'status'in('recorded','open_existing')then
 rid:=case when r->>'status'='recorded'then(r->'player'->>'rosterEntryId')::uuid else(r->>'rosterEntryId')::uuid end;
 subject:=case when r->>'status'='recorded'then(r->'player'->>'playerIdentityId')::uuid else(r->>'playerIdentityId')::uuid end;
 if not identity_adoption_v8.row_safe(tid,rid)then return jsonb_build_object('status','binding_review_required');end if;
 p:=identity_adoption_v8.profile(actor,sid,tid,rid);if p is null or(p->'player'->>'playerIdentityId')::uuid<>subject then return jsonb_build_object('status','binding_review_required');end if;
 if not identity_trial_v4.authorized(actor,sid,tid)then raise exception 'identity_access_changed';end if;
 if r->>'status'='recorded'then return jsonb_set(r,'{player,sessionId}',to_jsonb(sid));end if;
 end if;
 if not identity_trial_v4.authorized(actor,sid,tid)then raise exception 'identity_access_changed';end if;return r;
end$$;
create function identity_roster_v25.write(actor uuid,sid uuid,tid uuid,op uuid,request_text text,request_hash text)returns jsonb language plpgsql security invoker set search_path='' as $$declare prior identity_roster_v25.operations%rowtype;q jsonb;review jsonb;inner_request jsonb;p jsonb;outcome jsonb;rid uuid;receipt uuid;e jsonb;dec jsonb;enabled boolean;shared_enabled boolean;reference text;legal_name text;begin
 if op is null or request_text is null or octet_length(request_text)>16000 or request_hash is null or request_hash!~'^[a-f0-9]{64}$'or encode(sha256(convert_to(request_text,'UTF8')),'hex')<>request_hash then return null;end if;
 q:=request_text::jsonb;if not coalesce(identity_roster_v25.valid_request(q),false)then return null;end if;
 if not identity_trial_v4.authorized(actor,sid,tid)then raise exception 'identity_access_changed';end if;
 -- Both fences are held for the entire transaction, allowing an operator pause to drain active writers.
 select c.enabled into strict shared_enabled from identity_adoption_v8.write_control_v11 c where c.singleton for share;
 select c.enabled into strict enabled from identity_roster_v25.control c where c.singleton for share;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then raise exception 'operation_busy' using errcode='55P03';end if;
 perform identity_roster_v25.lock_scope(actor,sid,tid,enabled and shared_enabled);
 select*into prior from identity_roster_v25.operations o where o.tournament_id=tid and o.actor_id=actor and o.operation_id=op;
 if found then if prior.request_text<>request_text or prior.request_hash<>request_hash then return jsonb_build_object('status','idempotency_conflict');end if;return identity_roster_v25.rebind(actor,sid,tid,prior.response);end if;
 if not enabled or not shared_enabled then raise exception 'identity_registration_writes_paused' using errcode='55000';end if;
 if exists(select 1 from app.operation_receipts o where o.actor_profile_id=actor and o.client_operation_id=op)or exists(select 1 from identity_trial_v4.operations o where o.actor_id=actor and o.operation_id=op)or exists(select 1 from identity_adoption_v8.operations o where o.actor_id=actor and o.operation_id=op)then return jsonb_build_object('status','idempotency_conflict');end if;
 e:=q->'entry';dec:=q->'decision';review:=identity_roster_v25.prepare(actor,sid,tid,e,q->'address');
 if review is null or review->>'sourceDigest'<>q->>'sourceDigest'or review->'sourceRevision'<>q->'sourceRevision'then outcome:=jsonb_build_object('status','rejected','code','stale_source','effects',false);
 elsif review->>'coverage'<>'complete'then outcome:=jsonb_build_object('status','rejected','code','incomplete_candidate_review','effects',false);
 elsif not exists(select 1 from app.tournaments t where t.id=tid and t.status in('draft','open')and t.registration_status='open')or exists(select 1 from app.initial_seating_publications where tournament_id=tid)then outcome:=jsonb_build_object('status','rejected','code','registration_closed','effects',false);
 elsif dec->>'action'='duplicate'then
   if exists(select 1 from jsonb_array_elements(review->'matches')m where m->>'rosterEntryId'=dec->>'rosterEntryId')then outcome:=(select jsonb_build_object('status','open_existing','rosterEntryId',m->>'rosterEntryId','playerIdentityId',m->>'playerIdentityId')from jsonb_array_elements(review->'matches')m where m->>'rosterEntryId'=dec->>'rosterEntryId');else outcome:=jsonb_build_object('status','rejected','code','invalid_duplicate','effects',false);end if;
 elsif jsonb_array_length(review->'matches')>0 and(dec->>'action'is distinct from'distinct'or not exists(select 1 from jsonb_each_text(q->'distinction')where trim(value)<>'')or exists(select 1 from jsonb_array_elements(review->'matches')m where identity_trial_v4.norm(m->>'displayName')=identity_trial_v4.norm(identity_trial_v4.display_name(e,q->'distinction'))))then outcome:=jsonb_build_object('status','rejected','code','visible_distinction_required','effects',false);
 elsif jsonb_array_length(review->'matches')=0 and dec<>'null'::jsonb then outcome:=jsonb_build_object('status','rejected','code','invalid_duplicate','effects',false);
 else
   reference:=identity_legacy_v1.reference_key(e->>'accNumber');
   if reference is not null and(exists(select 1 from app.tournament_roster_entries r where r.tournament_id=tid and identity_legacy_v1.reference_key(r.claimed_acc_number)=reference)or exists(select 1 from identity_trial_v4.issued i where identity_legacy_v1.reference_key(i.number)=reference)or exists(select 1 from identity_trial_v4.issued_retired i where identity_legacy_v1.reference_key(i.number)=reference))then outcome:=jsonb_build_object('status','rejected','code','issued_reference_review_required','effects',false);
   else
     -- Source/revision were checked BEFORE this transaction's own deliberate inventory delta.
     perform identity_adoption_v8.lock_scope(actor,sid,tid,true);rid:=gen_random_uuid();
     inner_request:=jsonb_build_object('action','create','expectedRevision',q->'sourceRevision','expectedVersion',0,'rosterEntryId',rid,'entry',e,'address',q->'address','distinction',q->'distinction','decision',dec,'reason',q->>'reason','issuedEvidence','');
     p:=identity_adoption_v8.write_inner(actor,sid,tid,op,inner_request,false);
     if p->>'status'is distinct from'recorded'then raise exception 'identity_inner_outcome_unconfirmed';end if;
     if p->'player'->>'rosterEntryId'<>rid::text then raise exception 'roster_identity_binding_mismatch';end if;
     outcome:=jsonb_build_object('status','recorded','player',p->'player','profileLinked',false,'roleGranted',false,'eventEnrolled',false,'paymentRecorded',false,'checkedIn',false,'seatAssigned',false);
     insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(actor,tid,'create_legacy_roster_identity_v25',rid,request_hash,op,'accepted',outcome,clock_timestamp())returning id into receipt;
     legal_name:=trim(e->>'firstName')||' '||trim(e->>'lastName');
     insert into app.tournament_roster_entries(id,tournament_id,source_kind,source_claim_id,approval_decision_id,claimed_first_name,claimed_last_name,claimed_display_name,claimed_normalized_name,claimed_email,claimed_normalized_email,claimed_acc_number,claimed_normalized_acc_number,scorecard_type,creator_profile_id,operation_receipt_id)
       values(rid,tid,'director_manual',null,null,e->>'firstName',e->>'lastName',legal_name,lower(regexp_replace(legal_name,'[[:space:]]+',' ','g')),nullif(trim(e->>'email'),''),nullif(lower(trim(e->>'email')),''),nullif(e->>'accNumber',''),reference,'paper',actor,receipt);
     insert into identity_legacy_v1.adoptions(tournament_id,roster_id,subject_id,actor_id,operation_id,request,source_digest)values(tid,rid,(p->'player'->>'playerIdentityId')::uuid,actor,op,inner_request,identity_legacy_v1.digest(tid,rid));
     insert into identity_adoption_v8.reviews(tournament_id,roster_id,subject_id,coverage,actor_id,operation_id,request)values(tid,rid,(p->'player'->>'playerIdentityId')::uuid,'complete',actor,op,q);
     insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,receipt,'tournament_roster_entry',rid,'manual_roster_identity_created_v25',jsonb_build_object('rosterEntryId',rid,'playerIdentityId',p->'player'->>'playerIdentityId','reviewedSourceDigest',q->>'sourceDigest','identityVersion',1,'operationId',op));
   end if;
 end if;
 insert into identity_roster_v25.operations values(tid,actor,op,request_text,request_hash,outcome);
 if not identity_trial_v4.authorized(actor,sid,tid)then raise exception 'identity_access_changed';end if;return outcome;
end$$;
create function identity_roster_v25.reconcile(actor uuid,sid uuid,tid uuid,op uuid,request_hash text)returns jsonb language plpgsql security invoker set search_path='' as $$declare p identity_roster_v25.operations%rowtype;begin
 perform identity_roster_v25.lock_scope(actor,sid,tid);
 select*into p from identity_roster_v25.operations o where o.tournament_id=tid and o.actor_id=actor and o.operation_id=op;
 if not identity_trial_v4.authorized(actor,sid,tid)then raise exception 'identity_access_changed';end if;
 if not found then return null;end if;if p.request_hash<>request_hash then return jsonb_build_object('status','idempotency_conflict');end if;return identity_roster_v25.rebind(actor,sid,tid,p.response);
end$$;
create function identity_roster_v25.catalog()returns text language sql stable security invoker set search_path='' as $$
with ns as(select oid,nspname,nspowner,nspacl from pg_namespace where nspname in('identity_roster_v25','identity_trial_v4','identity_legacy_v1','identity_adoption_v8','app','auth','public')),
rels as(select c.* from pg_class c join ns on ns.oid=c.relnamespace where c.relkind in('r','p','v','m','S','f'))
select encode(sha256(convert_to(jsonb_build_object(
 'schemas',(select jsonb_agg(to_jsonb(n)order by n.nspname collate "C")from ns n),
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',p.proowner,'acl',p.proacl,'config',p.proconfig,'kind',p.prokind,'definer',p.prosecdef,'strict',p.proisstrict,'volatile',p.provolatile,'parallel',p.proparallel,'leakproof',p.proleakproof,'body',case when p.prokind in('f','p','w')then pg_get_functiondef(p.oid)else p.prosrc end)order by p.oid::regprocedure::text collate "C")from pg_proc p join ns on ns.oid=p.pronamespace),
 'relations',(select jsonb_agg(jsonb_build_object('name',r.oid::regclass::text,'owner',r.relowner,'acl',r.relacl,'rls',r.relrowsecurity,'force',r.relforcerowsecurity,'kind',r.relkind,'options',r.reloptions,'view',case when r.relkind in('v','m')then pg_get_viewdef(r.oid,true)else null end)order by r.oid::regclass::text collate "C")from rels r),
 'columns',(select jsonb_agg(jsonb_build_object('relation',a.attrelid::regclass::text,'position',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'dropped',a.attisdropped,'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl,'collation',a.attcollation,'default',pg_get_expr(d.adbin,d.adrelid))order by a.attrelid::regclass::text collate "C",a.attnum)from pg_attribute a join rels r on r.oid=a.attrelid left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0),
 'constraints',(select jsonb_agg(jsonb_build_object('relation',c.conrelid::regclass::text,'name',c.conname,'validated',c.convalidated,'definition',pg_get_constraintdef(c.oid,true))order by c.conrelid::regclass::text collate "C",c.conname collate "C")from pg_constraint c join rels r on r.oid=c.conrelid),
 'triggers',(select jsonb_agg(jsonb_build_object('relation',t.tgrelid::regclass::text,'name',t.tgname,'enabled',t.tgenabled,'internal',t.tgisinternal,'definition',pg_get_triggerdef(t.oid,true),'helper',pg_get_functiondef(t.tgfoid))order by t.tgrelid::regclass::text collate "C",t.tgname collate "C")from pg_trigger t join rels r on r.oid=t.tgrelid),
 'policies',(select jsonb_agg(jsonb_build_object('relation',p.polrelid::regclass::text,'name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',p.polroles,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))order by p.polrelid::regclass::text collate "C",p.polname collate "C")from pg_policy p join rels r on r.oid=p.polrelid),
 'indexes',(select jsonb_agg(jsonb_build_object('relation',i.indrelid::regclass::text,'definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready,'unique',i.indisunique,'primary',i.indisprimary)order by i.indexrelid::regclass::text collate "C")from pg_index i join rels r on r.oid=i.indrelid)
)::text,'UTF8')),'hex')$$;
create function identity_roster_v25.capability(actor uuid,sid uuid,tid uuid)returns jsonb language plpgsql stable security invoker set search_path='' as $$begin
 if not identity_trial_v4.authorized(actor,sid,tid)then return null;end if;
 return jsonb_build_object('kind','legacy-roster-identity-capability-v25','actorId',actor,'sessionId',sid,'tournamentId',tid,'version',25,'available',true,'catalogHash',identity_roster_v25.catalog(),'writesEnabled',coalesce((select enabled from identity_roster_v25.control where singleton),false)and coalesce((select enabled from identity_adoption_v8.write_control_v11 where singleton),false));
end$$;
revoke all on all tables in schema identity_roster_v25 from public,anon,authenticated,service_role;
revoke all on all functions in schema identity_roster_v25 from public,anon,authenticated,service_role;
commit;
