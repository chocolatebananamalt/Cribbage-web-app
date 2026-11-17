-- LOCAL PROPOSAL ONLY. Input V4 engine SHA d8e2d09c84e7d9011a03c62e288fcebf2aa22622f62a05155080354f960ffdee.
-- Same actor/session/director checks, operation/identity binding and registry uniqueness retained.
-- No grants or hosted apply. Existing supplied-but-unconfirmed number may be confirmed with evidence on same subject.
begin;
create or replace function identity_trial_v4.write_player(actor uuid,sid uuid,tid uuid,op uuid,q jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$declare h identity_trial_v4.heads%rowtype;f identity_trial_v4.facts%rowtype;old identity_trial_v4.operations%rowtype;e jsonb;a jsonb;d jsonb;dec jsonb;k text;n text;rid uuid;pid uuid;ver integer;outcome jsonb;matches integer;action text;nr text;begin
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
commit;
