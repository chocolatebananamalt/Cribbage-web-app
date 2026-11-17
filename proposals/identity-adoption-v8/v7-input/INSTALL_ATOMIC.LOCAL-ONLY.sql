-- CLOSED DISPOSABLE-FIXTURE PROPOSAL ONLY. Not a staging installer.
begin;
-- Closed local proposal; no grants, legacy writes, or hosted installation.
create schema identity_legacy_v1;
revoke all on schema identity_legacy_v1 from public;
create table identity_legacy_v1.adoptions(tournament_id uuid not null,roster_id uuid not null,subject_id uuid not null references identity_trial_v4.subjects(id),actor_id uuid not null,operation_id uuid not null,request jsonb not null,source_digest text not null,recorded_at timestamptz not null default clock_timestamp(),primary key(tournament_id,roster_id),unique(tournament_id,subject_id),unique(tournament_id,actor_id,operation_id),foreign key(roster_id,tournament_id)references app.tournament_roster_entries(id,tournament_id));
create trigger immutable before update or delete on identity_legacy_v1.adoptions for each row execute function identity_trial_v4.immutable();
create trigger no_truncate before truncate on identity_legacy_v1.adoptions for each statement execute function identity_trial_v4.immutable();
alter table identity_legacy_v1.adoptions enable row level security;
alter table identity_legacy_v1.adoptions force row level security;
create function identity_legacy_v1.reference_key(v text)returns text language sql immutable set search_path='' as $$select nullif(regexp_replace(upper(regexp_replace(trim(coalesce(v,'')),'[[:space:]]+','','g')),'Y$',''),'')$$;
create function identity_legacy_v1.source(tid uuid,rid uuid)returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('roster',to_jsonb(r),'links',coalesce((select jsonb_agg(to_jsonb(l)order by l.id)from app.roster_account_links l where l.tournament_id=tid and l.roster_entry_id=rid),'[]'),'participants',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'eventId',p.event_id,'rosterId',p.roster_entry_id,'profileId',p.profile_id)order by p.id)from app.event_participants p where p.tournament_id=tid and p.roster_entry_id=rid),'[]'),'foreignIssued',coalesce((select jsonb_agg(to_jsonb(i)order by i.number)from identity_trial_v4.issued i where identity_legacy_v1.reference_key(i.number)=identity_legacy_v1.reference_key(r.claimed_acc_number)and i.subject_id is distinct from(select a.subject_id from identity_legacy_v1.adoptions a where a.tournament_id=tid and a.roster_id=rid)),'[]'),'retiredIssued',coalesce((select jsonb_agg(to_jsonb(x)order by x.number)from identity_trial_v4.issued_retired x where identity_legacy_v1.reference_key(x.number)=identity_legacy_v1.reference_key(r.claimed_acc_number)),'[]'),'lifecycle',coalesce((select jsonb_agg(to_jsonb(e)order by e.version)from app.roster_entry_lifecycle_events e where e.tournament_id=tid and e.roster_entry_id=rid),'[]'))from app.tournament_roster_entries r where r.id=rid and r.tournament_id=tid
$$;
create function identity_legacy_v1.digest(tid uuid,rid uuid)returns text language sql stable security invoker set search_path='' as $$select encode(sha256(convert_to(identity_legacy_v1.source(tid,rid)::text,'UTF8')),'hex')$$;
create function identity_legacy_v1.read_safe(actor uuid,sid uuid,tid uuid)returns boolean language sql stable security invoker set search_path='' as $$select identity_trial_v4.authorized(actor,sid,tid)and not exists(select 1 from identity_legacy_v1.adoptions a where a.tournament_id=tid and a.source_digest is distinct from identity_legacy_v1.digest(tid,a.roster_id))$$;
create function identity_legacy_v1.inventory(actor uuid,sid uuid,tid uuid)returns jsonb language plpgsql stable security invoker set search_path='' as $$declare v jsonb;begin
if not identity_trial_v4.authorized(actor,sid,tid)then return null;end if;
select coalesce(jsonb_agg(jsonb_build_object('rosterEntryId',r.id,'firstName',r.claimed_first_name,'lastName',r.claimed_last_name,'suppliedReference',r.claimed_acc_number,'scorecardType',r.scorecard_type,'sourceDigest',identity_legacy_v1.digest(tid,r.id),'addressCoverage','missing_legacy_address','status',case when a.roster_id is not null then case when a.source_digest=identity_legacy_v1.digest(tid,r.id)then'adopted'else'legacy_binding_changed'end when exists(select 1 from app.roster_account_links l where l.tournament_id=tid and l.roster_entry_id=r.id)or exists(select 1 from app.event_participants p where p.tournament_id=tid and p.roster_entry_id=r.id and p.profile_id is not null)then'account_identity_review_required'when r.claimed_first_name is null or r.claimed_last_name is null then'legal_name_review_required'when r.scorecard_type<>'paper'then'digital_identity_review_required'else'explicit_review_required'end)order by r.id),'[]')into v from app.tournament_roster_entries r left join identity_legacy_v1.adoptions a on a.tournament_id=tid and a.roster_id=r.id where r.tournament_id=tid;return v;end$$;

create function identity_legacy_v1.write_adoption_inner(actor uuid,sid uuid,tid uuid,op uuid,q jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$declare h identity_trial_v4.heads%rowtype;f identity_trial_v4.facts%rowtype;old identity_trial_v4.operations%rowtype;e jsonb;a jsonb;d jsonb;dec jsonb;k text;n text;rid uuid;pid uuid;ver integer;outcome jsonb;matches integer;action text;nr text;begin
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
  if (q->>'rosterEntryId')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or q->'expectedVersion'<>'0'::jsonb then return jsonb_build_object('status','invalid_request');end if;
  select count(*)into matches from identity_trial_v4.latest(tid)where match_key=k;
  if dec->>'action'='duplicate'then
   if not identity_trial_v4.exact(dec,array['action','rosterEntryId'])then return jsonb_build_object('status','invalid_decision');end if;
   select roster_id into rid from identity_trial_v4.latest(tid)where match_key=k and roster_id::text=lower(dec->>'rosterEntryId');if rid is null then return jsonb_build_object('status','invalid_existing');end if;return jsonb_build_object('status','open_existing','tournamentId',tid,'rosterEntryId',rid);
  end if;
  if matches>0 and(dec->>'action'is distinct from'distinct'or not identity_trial_v4.exact(dec,array['action'])or not exists(select 1 from jsonb_each_text(d)where trim(value)<>'')or exists(select 1 from identity_trial_v4.latest(tid)where match_key=k and identity_trial_v4.norm(display_name)=identity_trial_v4.norm(n)))then return jsonb_build_object('status','duplicate_resolution_required');end if;
  if matches=0 and dec<>'null'::jsonb then return jsonb_build_object('status','invalid_decision');end if;
  insert into identity_trial_v4.subjects(created_by)values(actor)returning id into pid;rid:=(q->>'rosterEntryId')::uuid;ver:=1;
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
  if nr=''or(nr=f.entry->>'accNumber'and exists(select 1 from identity_trial_v4.issued i where i.number=nr and i.subject_id=pid and not exists(select 1 from identity_trial_v4.issued_retired r where r.number=i.number)))or not identity_trial_v4.txt(q->'issuedEvidence',500,true)then return jsonb_build_object('status','issued_evidence_required');end if;
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
-- Execute after exact derived inner writer; neither function is app-facing.
create function identity_legacy_v1.adopt(actor uuid,sid uuid,tid uuid,op uuid,q jsonb,expected_source text,review_confirmed boolean)returns jsonb language plpgsql security invoker set search_path='' as $$
declare r app.tournament_roster_entries%rowtype;prior identity_legacy_v1.adoptions%rowtype;outcome jsonb;rid uuid;begin
if not identity_trial_v4.authorized(actor,sid,tid)then return null;end if;
perform 1 from auth.sessions where id=sid and user_id=actor for share;
perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director' for share;
-- Align with known enrollment/account-link writers; source-table lock prevents a fixture source phantom during review/commit.
perform 1 from app.tournaments where id=tid for update;
lock table app.tournament_roster_entries,app.roster_account_links,app.event_participants,app.roster_entry_lifecycle_events in share mode;
if not identity_trial_v4.authorized(actor,sid,tid)then raise exception'identity_access_changed';end if;
if op is null or review_confirmed is distinct from true or expected_source!~'^[a-f0-9]{64}$'or(q->>'rosterEntryId')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'then return jsonb_build_object('status','explicit_review_required');end if;
rid:=(q->>'rosterEntryId')::uuid;
insert into identity_trial_v4.heads(tournament_id)values(tid)on conflict do nothing;
perform 1 from identity_trial_v4.heads where tournament_id=tid for update;
lock table identity_trial_v4.issued,identity_trial_v4.issued_retired in share row exclusive mode;
select*into prior from identity_legacy_v1.adoptions where tournament_id=tid and actor_id=actor and operation_id=op;
if found then
if prior.request is distinct from q or prior.source_digest is distinct from expected_source then return jsonb_build_object('status','idempotency_conflict');end if;
if not identity_legacy_v1.read_safe(actor,sid,tid)then return jsonb_build_object('status','legacy_binding_changed');end if;
return identity_trial_v4.reconcile(actor,sid,tid,op,q);end if;
select*into r from app.tournament_roster_entries where id=rid and tournament_id=tid;
if not found then return jsonb_build_object('status','legacy_target_unavailable');end if;
if expected_source is distinct from identity_legacy_v1.digest(tid,rid)then return jsonb_build_object('status','stale_legacy_source');end if;
if exists(select 1 from identity_legacy_v1.adoptions where tournament_id=tid and roster_id=rid)or exists(select 1 from identity_trial_v4.facts where tournament_id=tid and roster_id=rid)then return jsonb_build_object('status','already_adopted');end if;
if exists(select 1 from app.roster_account_links where tournament_id=tid and roster_entry_id=rid)or exists(select 1 from app.event_participants where tournament_id=tid and roster_entry_id=rid and profile_id is not null)then return jsonb_build_object('status','account_identity_review_required');end if;
if coalesce((select event_type from app.roster_entry_lifecycle_events where tournament_id=tid and roster_entry_id=rid order by version desc limit 1),'active')='withdrawn'then return jsonb_build_object('status','legacy_target_withdrawn');end if;
if r.scorecard_type<>'paper'or q->'entry'->>'scorecardType'<>'paper'then return jsonb_build_object('status','digital_identity_review_required');end if;
if r.claimed_first_name is null or r.claimed_last_name is null then return jsonb_build_object('status','legal_name_review_required');end if;
if q->>'action'<>'create'or q->'entry'->>'firstName'<>r.claimed_first_name or q->'entry'->>'lastName'<>r.claimed_last_name or q->'entry'->>'email'<>coalesce(r.claimed_email,'')or q->'entry'->>'accNumber'<>coalesce(r.claimed_acc_number,'')then return jsonb_build_object('status','legacy_identity_mismatch');end if;
-- Historical address is absent: director must collect a complete address and explicitly review the exact target, not infer a match.
if identity_trial_v4.match_key(q->'entry',q->'address')is null then return jsonb_build_object('status','address_review_required');end if;
-- A supplied number never merges identities. Existing/retired registry ownership is an explicit conflict.
if coalesce(q->'entry'->>'accNumber','')<>''then
perform pg_advisory_xact_lock(hashtextextended('identity-issued:'||(q->'entry'->>'accNumber'),0));
if exists(select 1 from identity_trial_v4.issued where identity_legacy_v1.reference_key(number)=identity_legacy_v1.reference_key(q->'entry'->>'accNumber'))or exists(select 1 from identity_trial_v4.issued_retired where identity_legacy_v1.reference_key(number)=identity_legacy_v1.reference_key(q->'entry'->>'accNumber'))then return jsonb_build_object('status','issued_identity_review_required');end if;
end if;
outcome:=identity_legacy_v1.write_adoption_inner(actor,sid,tid,op,q);
if outcome->>'status'='recorded'then
if outcome->'player'->>'rosterEntryId'<>rid::text then raise exception'legacy_id_changed';end if;
insert into identity_legacy_v1.adoptions(tournament_id,roster_id,subject_id,actor_id,operation_id,request,source_digest)values(tid,rid,(outcome->'player'->>'playerIdentityId')::uuid,actor,op,q,expected_source);
end if;return outcome;end$$;
create function identity_legacy_v1.guard(actor uuid,sid uuid,tid uuid)returns void language plpgsql security invoker set search_path='' as $$begin
if not identity_trial_v4.authorized(actor,sid,tid)then raise exception'identity_access_changed';end if;
perform 1 from auth.sessions where id=sid and user_id=actor for share;
perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director' for share;
perform 1 from app.tournaments where id=tid for update;
lock table app.tournament_roster_entries,app.roster_account_links,app.event_participants,app.roster_entry_lifecycle_events in share mode;
perform 1 from identity_trial_v4.heads where tournament_id=tid for update;
lock table identity_trial_v4.issued,identity_trial_v4.issued_retired in share row exclusive mode;
if not identity_legacy_v1.read_safe(actor,sid,tid)then raise exception'legacy_binding_changed';end if;
end$$;
revoke all on all tables in schema identity_legacy_v1 from public,anon,authenticated,service_role;
revoke all on all functions in schema identity_legacy_v1 from public,anon,authenticated,service_role;

commit;
