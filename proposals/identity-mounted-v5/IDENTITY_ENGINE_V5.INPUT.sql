-- EXECUTABLE LOCAL-ONLY PROPOSAL; NOT APPLIED OR A PRODUCTION INSTALLER.
-- Run only in a disposable database with fixture auth.sessions/app.tournament_roles.
-- Backend owner must reconcile prerequisites/ownership/session revocation before adoption.
begin;
create schema identity_trial_v4;
revoke all on schema identity_trial_v4 from public;
create table identity_trial_v4.heads(tournament_id uuid primary key,revision bigint not null default 0 check(revision>=0),next_ordinal bigint not null default 1 check(next_ordinal between 1 and 2147483648));
create table identity_trial_v4.subjects(id uuid primary key default gen_random_uuid(),created_by uuid not null,created_at timestamptz not null default clock_timestamp());
create table identity_trial_v4.facts(tournament_id uuid not null,subject_id uuid not null references identity_trial_v4.subjects(id),roster_id uuid not null,version integer not null check(version>0),entry jsonb not null,address jsonb not null,distinction jsonb not null,match_key text not null,display_name text not null,actor_id uuid not null,operation_id uuid not null,reason text not null,recorded_at timestamptz not null default clock_timestamp(),primary key(tournament_id,roster_id,version),unique(tournament_id,subject_id,version));
create table identity_trial_v4.temporary(tournament_id uuid not null,subject_id uuid not null references identity_trial_v4.subjects(id),ordinal integer not null check(ordinal>0),primary key(tournament_id,subject_id),unique(tournament_id,ordinal));
create table identity_trial_v4.issued(number text primary key check(number~'^ZZ[0-9]{4}$' or(number!~'^ZZ' and number~'^[A-Z]{2}[0-9]+Y?$')),subject_id uuid not null references identity_trial_v4.subjects(id),evidence text not null check(length(trim(evidence)) between 1 and 500),actor_id uuid not null,recorded_at timestamptz not null default clock_timestamp());
create table identity_trial_v4.issued_retired(number text primary key references identity_trial_v4.issued(number),actor_id uuid not null,reason text not null,recorded_at timestamptz not null default clock_timestamp());
create table identity_trial_v4.operations(tournament_id uuid not null,actor_id uuid not null,operation_id uuid not null,request jsonb not null,response jsonb not null,primary key(tournament_id,actor_id,operation_id));
create function identity_trial_v4.immutable()returns trigger language plpgsql set search_path='' as $$begin raise exception 'immutable_identity_history';end$$;
do $$declare n text;begin foreach n in array array['subjects','facts','temporary','issued','issued_retired','operations']loop execute format('create trigger immutable before update or delete on identity_trial_v4.%I for each row execute function identity_trial_v4.immutable()',n);execute format('create trigger no_truncate before truncate on identity_trial_v4.%I for each statement execute function identity_trial_v4.immutable()',n);end loop;end$$;
create function identity_trial_v4.exact(v jsonb,k text[])returns boolean language sql immutable set search_path='' as $$select case when jsonb_typeof(v)='object' then coalesce((select array_agg(x order by x) from jsonb_object_keys(v)x)=(select array_agg(x order by x)from unnest(k)x),false) else false end$$;
create function identity_trial_v4.txt(v jsonb,n integer,required boolean default false)returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(v)='string' and length(v#>>'{}')<=n and (not required or length(trim(v#>>'{}'))>0) and (v#>>'{}')!~'[[:cntrl:]]',false)$$;
create function identity_trial_v4.norm(v text)returns text language sql immutable set search_path='' as $$select lower(regexp_replace(trim(normalize(v,NFKC)),'\s+',' ','g'))$$;
create function identity_trial_v4.valid_entry(e jsonb)returns boolean language plpgsql immutable set search_path='' as $$declare a text;j jsonb;begin
 if not identity_trial_v4.exact(e,array['firstName','lastName','email','city','state','accNumber','nonmemberWithoutNumber','scorecardType','joiningClaim'])then return false;end if;
 if not(identity_trial_v4.txt(e->'firstName',80,true)and identity_trial_v4.txt(e->'lastName',80,true)and identity_trial_v4.txt(e->'city',160)and identity_trial_v4.txt(e->'state',80)and identity_trial_v4.txt(e->'email',320)and identity_trial_v4.txt(e->'accNumber',64))then return false;end if;
 if jsonb_typeof(e->'nonmemberWithoutNumber')is distinct from'boolean'then return false;end if;
 a:=e->>'accNumber';j:=e->'joiningClaim';return coalesce(length((e->>'firstName')||' '||(e->>'lastName'))<=160 and(e->>'email'='' or e->>'email'~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')and jsonb_typeof(e->'nonmemberWithoutNumber')='boolean'and(e->>'scorecardType')in('paper','digital')and(a=''or a~'^ZZ[0-9]{4}$'or(a!~'^ZZ'and a~'^[A-Z]{2}[0-9]+Y?$'))and(not(e->>'nonmemberWithoutNumber')::boolean or a='')and identity_trial_v4.exact(j,array['status','evidenceReference'])and(j->>'status')in('none','claimed_pending')and identity_trial_v4.txt(j->'evidenceReference',500)and(j->>'status'<>'none'or j->>'evidenceReference'=''),false);
 end$$;
create function identity_trial_v4.match_key(e jsonb,a jsonb)returns text language plpgsql immutable set search_path='' as $$declare x text;k text[];begin
 if not identity_trial_v4.valid_entry(e)or not identity_trial_v4.exact(a,array['street','postalCode','country'])then return null;end if;
 if not(identity_trial_v4.txt(a->'street',300,true)and identity_trial_v4.txt(a->'postalCode',40,true)and identity_trial_v4.txt(a->'country',80,true))then return null;end if;
 k:=array[e->>'firstName',e->>'lastName',a->>'street',e->>'city',e->>'state',a->>'postalCode',a->>'country'];foreach x in array k loop if identity_trial_v4.norm(x)in('','unknown','n/a','na','not provided','none','-')then return null;end if;end loop;return(select jsonb_agg(identity_trial_v4.norm(v)order by o)::text from unnest(k)with ordinality q(v,o));end$$;
create function identity_trial_v4.display_name(e jsonb,d jsonb)returns text language plpgsql immutable set search_path='' as $$declare k text;n text;begin
 if not identity_trial_v4.exact(d,array['prefix','middleName','suffix','localLabel'])then return null;end if;foreach k in array array['prefix','middleName','suffix','localLabel']loop if not identity_trial_v4.txt(d->k,80)then return null;end if;end loop;
 n:=concat_ws(' ',nullif(trim(d->>'prefix'),''),trim(e->>'firstName'),nullif(trim(d->>'middleName'),''),trim(e->>'lastName'),nullif(trim(d->>'suffix'),''));if trim(d->>'localLabel')<>''then n:=n||' ('||trim(d->>'localLabel')||')';end if;
 if n~*'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'or n~*'temporary\s*id\s*#\s*[0-9]+'then return null;end if;return n;end$$;
-- SECURITY INVOKER: no new bypass privilege, no public/exposed RPC or grants.
-- Fixture executor must already be authorized to read auth.sessions/app roles and own these tables.
create function identity_trial_v4.authorized(actor uuid,sid uuid,tid uuid)returns boolean language sql stable security invoker set search_path='' as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')='service_role'and exists(select 1 from auth.sessions s where s.id=sid and s.user_id=actor and(s.not_after is null or s.not_after>clock_timestamp()))and exists(select 1 from app.tournament_roles r where r.tournament_id=tid and r.profile_id=actor and r.role='director')$$;
create function identity_trial_v4.latest(tid uuid)returns setof identity_trial_v4.facts language sql stable security invoker set search_path='' as $$select distinct on(roster_id)*from identity_trial_v4.facts where tournament_id=tid order by roster_id,version desc$$;
create function identity_trial_v4.preflight(actor uuid,sid uuid,tid uuid,e jsonb,a jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$declare rev bigint;k text;m jsonb;begin
 if not identity_trial_v4.authorized(actor,sid,tid)then return null;end if;select revision into rev from identity_trial_v4.heads where tournament_id=tid;k:=identity_trial_v4.match_key(e,a);select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',roster_id,'playerIdentityId',subject_id,'displayName',display_name,'identityVersion',version)order by roster_id),'[]')into m from identity_trial_v4.latest(tid)where match_key=k;
 return jsonb_build_object('kind','identity-trial-preflight-v4','actorId',actor,'sessionId',sid,'tournamentId',tid,'sourceRevision',coalesce(rev,0),'coverage',case when k is null then'incomplete_input'else'complete'end,'matches',m);end$$;
create function identity_trial_v4.read_player(actor uuid,sid uuid,tid uuid,rid uuid)returns jsonb language plpgsql security invoker set search_path='' as $$declare f identity_trial_v4.facts%rowtype;n integer;issued text;begin
 if not identity_trial_v4.authorized(actor,sid,tid)then return null;end if;select*into f from identity_trial_v4.facts where tournament_id=tid and roster_id=rid order by version desc limit 1;if not found then return null;end if;
 select ordinal into n from identity_trial_v4.temporary where tournament_id=tid and subject_id=f.subject_id;select i.number into issued from identity_trial_v4.issued i where i.subject_id=f.subject_id and i.number=f.entry->>'accNumber'and not exists(select 1 from identity_trial_v4.issued_retired r where r.number=i.number);
 return jsonb_build_object('kind','identity-trial-player-v4','actorId',actor,'sessionId',sid,'tournamentId',tid,'rosterEntryId',rid,'playerIdentityId',f.subject_id,'version',f.version,'operationId',f.operation_id,'entry',f.entry,'address',f.address,'distinction',f.distinction,'displayName',f.display_name,'temporaryOrdinal',n,'issuedReference',issued,'officialMembershipVerified',false,'actualMrpAwarded',false);end$$;
create function identity_trial_v4.write_player(actor uuid,sid uuid,tid uuid,op uuid,q jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$declare h identity_trial_v4.heads%rowtype;f identity_trial_v4.facts%rowtype;old identity_trial_v4.operations%rowtype;e jsonb;a jsonb;d jsonb;dec jsonb;k text;n text;rid uuid;pid uuid;ver integer;outcome jsonb;matches integer;action text;nr text;begin
 if not identity_trial_v4.authorized(actor,sid,tid)then return null;end if;
 -- Lock live session and Director authority before the tournament serialization lock.
 perform 1 from auth.sessions where id=sid and user_id=actor for share;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director' for share;
 if not identity_trial_v4.authorized(actor,sid,tid)then raise exception'identity_access_changed';end if;
 if op is null or not identity_trial_v4.exact(q,array['action','expectedRevision','expectedVersion','rosterEntryId','entry','address','distinction','decision','reason','issuedEvidence'])then return jsonb_build_object('status','invalid_request');end if;
 if jsonb_typeof(q->'action')is distinct from'string'or coalesce(q->>'action','')not in('create','correct','attach_issued')or jsonb_typeof(q->'expectedRevision')is distinct from'number'or jsonb_typeof(q->'expectedVersion')is distinct from'number'then return jsonb_build_object('status','invalid_request');end if;
 if coalesce(q->>'expectedRevision','')!~'^[0-9]+$'or coalesce(q->>'expectedVersion','')!~'^[0-9]+$'then return jsonb_build_object('status','invalid_request');end if;
 if(q->>'expectedRevision')::numeric>9007199254740991 or(q->>'expectedVersion')::numeric>2147483647 then return jsonb_build_object('status','invalid_request');end if;
 insert into identity_trial_v4.heads(tournament_id)values(tid)on conflict do nothing;select*into h from identity_trial_v4.heads where tournament_id=tid for update;
 if not identity_trial_v4.authorized(actor,sid,tid)then raise exception'identity_access_changed';end if;
 select*into old from identity_trial_v4.operations where tournament_id=tid and actor_id=actor and operation_id=op;if found then return case when old.request=q then jsonb_set(old.response,'{player,sessionId}',to_jsonb(sid)) else jsonb_build_object('status','idempotency_conflict')end;end if;
 if(q->>'expectedRevision')::numeric<>h.revision then return jsonb_build_object('status','stale_review');end if;
 action:=q->>'action';e:=q->'entry';a:=q->'address';d:=q->'distinction';dec:=q->'decision';k:=identity_trial_v4.match_key(e,a);n:=identity_trial_v4.display_name(e,d);
 if action not in('create','correct','attach_issued')or k is null or n is null or not identity_trial_v4.txt(q->'reason',500,true)or not identity_trial_v4.txt(q->'issuedEvidence',500)or(action<>'attach_issued'and q->>'issuedEvidence'<>'')then return jsonb_build_object('status','invalid_request');end if;
 if action='create'then
  if q->'rosterEntryId'<>'null'::jsonb or q->'expectedVersion'<>'0'::jsonb then return jsonb_build_object('status','invalid_request');end if;
  select count(*)into matches from identity_trial_v4.latest(tid)where match_key=k;
  if dec->>'action'='duplicate'then
   if not identity_trial_v4.exact(dec,array['action','rosterEntryId'])then return jsonb_build_object('status','invalid_decision');end if;
   select roster_id into rid from identity_trial_v4.latest(tid)where match_key=k and roster_id::text=lower(dec->>'rosterEntryId');if rid is null then return jsonb_build_object('status','invalid_existing');end if;return jsonb_build_object('status','open_existing','tournamentId',tid,'rosterEntryId',rid);
  end if;
  if matches>0 and(dec->>'action'is distinct from'distinct'or not identity_trial_v4.exact(dec,array['action'])or not exists(select 1 from jsonb_each_text(d)where trim(value)<>'')or exists(select 1 from identity_trial_v4.latest(tid)where match_key=k and identity_trial_v4.norm(display_name)=identity_trial_v4.norm(n)))then return jsonb_build_object('status','duplicate_resolution_required');end if;
  if matches=0 and dec<>'null'::jsonb then return jsonb_build_object('status','invalid_decision');end if;
  insert into identity_trial_v4.subjects(created_by)values(actor)returning id into pid;rid:=gen_random_uuid();ver:=1;
 else
  if q->'decision'<>'null'::jsonb then return jsonb_build_object('status','invalid_decision');end if;
  if(q->>'rosterEntryId')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'then return jsonb_build_object('status','invalid_request');end if;rid:=(q->>'rosterEntryId')::uuid;
  select*into f from identity_trial_v4.facts where tournament_id=tid and roster_id=rid order by version desc limit 1;
  if not found or q->'expectedVersion'<>to_jsonb(f.version)or f.version=2147483647 then return jsonb_build_object('status','stale_identity');end if;pid:=f.subject_id;ver:=f.version+1;
  -- Corrections cannot silently reidentify or merge profiles or replace an issued number.
  if e->>'firstName'<>f.entry->>'firstName'or e->>'lastName'<>f.entry->>'lastName'or a<>f.address or k<>f.match_key or d<>f.distinction or(action='correct'and e->>'accNumber'<>f.entry->>'accNumber')then return jsonb_build_object('status','identity_resolution_required');end if;
 end if;
 nr:=e->>'accNumber';
 if action='attach_issued'then
  if nr=''or nr=f.entry->>'accNumber'or not identity_trial_v4.txt(q->'issuedEvidence',500,true)then return jsonb_build_object('status','issued_evidence_required');end if;
  -- Serialize global issued-reference uniqueness across tournaments; never recycle retired numbers.
  perform pg_advisory_xact_lock(hashtextextended('identity-issued:'||nr,0));
  if exists(select 1 from identity_trial_v4.issued_retired where number=nr)or exists(select 1 from identity_trial_v4.issued where number=nr and subject_id<>pid)then return jsonb_build_object('status','issued_reference_unavailable');end if;
  insert into identity_trial_v4.issued(number,subject_id,evidence,actor_id)values(nr,pid,q->>'issuedEvidence',actor)on conflict(number)do nothing;
 elsif q->>'issuedEvidence'<>''then return jsonb_build_object('status','invalid_request');end if;
 insert into identity_trial_v4.facts(tournament_id,subject_id,roster_id,version,entry,address,distinction,match_key,display_name,actor_id,operation_id,reason)values(tid,pid,rid,ver,e,a,d,k,n,actor,op,q->>'reason');
 if e->>'accNumber'=''and(e->>'nonmemberWithoutNumber')::boolean and not exists(select 1 from identity_trial_v4.temporary where tournament_id=tid and subject_id=pid)then
  if h.next_ordinal>2147483647 then raise exception'temporary_id_exhausted';end if;
  insert into identity_trial_v4.temporary values(tid,pid,h.next_ordinal::integer);update identity_trial_v4.heads set next_ordinal=next_ordinal+1 where tournament_id=tid;
 end if;
 update identity_trial_v4.heads set revision=revision+1 where tournament_id=tid;
 outcome:=jsonb_build_object('status','recorded','player',identity_trial_v4.read_player(actor,sid,tid,rid));if outcome->'player'='null'::jsonb then raise exception'identity_access_changed';end if;insert into identity_trial_v4.operations values(tid,actor,op,q,outcome);return outcome;
 end$$;
create function identity_trial_v4.reconcile(actor uuid,sid uuid,tid uuid,op uuid,q jsonb)returns jsonb language sql stable security invoker set search_path='' as $$select case when identity_trial_v4.authorized(actor,sid,tid)then(select case when request=q then jsonb_set(response,'{player,sessionId}',to_jsonb(sid)) else jsonb_build_object('status','idempotency_conflict')end from identity_trial_v4.operations where tournament_id=tid and actor_id=actor and operation_id=op)else null end$$;
-- Identity-only preparation rows, not a complete event/results report or official ACC schema.
create function identity_trial_v4.manual_identity_rows(actor uuid,sid uuid,tid uuid)returns jsonb language plpgsql stable security invoker set search_path='' as $$declare out_rows jsonb;begin
 if not identity_trial_v4.authorized(actor,sid,tid)then return null;end if;
 if exists(select 1 from identity_trial_v4.latest(tid)f where concat_ws(' ',f.entry->>'firstName',f.entry->>'lastName',f.entry->>'city',f.entry->>'state')~*'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' or concat_ws(' ',f.entry->>'firstName',f.entry->>'lastName',f.entry->>'city',f.entry->>'state')~*'temporary\s*id\s*#\s*[0-9]+')then return jsonb_build_object('status','blocked','code','unsafe_export_contact');end if;
 select coalesce(jsonb_agg(jsonb_build_object('firstName',f.entry->>'firstName','lastName',f.entry->>'lastName','city',f.entry->>'city','state',f.entry->>'state','accNumber',coalesce(i.number,''),'joinedAtTournamentClaim',case when f.entry->'joiningClaim'->>'status'='claimed_pending'then'joined_pending'else'not_recorded'end,'actualMrpAwarded',false,'needsAccHandling',i.number is null or f.entry->'joiningClaim'->>'status'='claimed_pending')order by f.roster_id),'[]')into out_rows from identity_trial_v4.latest(tid)f left join identity_trial_v4.issued i on i.subject_id=f.subject_id and i.number=f.entry->>'accNumber'and not exists(select 1 from identity_trial_v4.issued_retired r where r.number=i.number);
 return out_rows;end$$;
-- CLOSED proposal: functions/tables/schema receive no app-facing grants. RLS defense in depth.
do $$declare n text;begin foreach n in array array['heads','subjects','facts','temporary','issued','issued_retired','operations']loop execute format('alter table identity_trial_v4.%I enable row level security',n);execute format('alter table identity_trial_v4.%I force row level security',n);end loop;end$$;
revoke all on all tables in schema identity_trial_v4 from public;
revoke all on all functions in schema identity_trial_v4 from public;
commit;
