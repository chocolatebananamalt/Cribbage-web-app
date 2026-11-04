-- LOCAL ONLY. Private source/derivation groundwork; deliberately no writer,
-- settlement dispatch, grant, fixture enrollment, or historical reinterpretation.
begin;
do $$begin if current_user<>'postgres' then raise exception 'Reviewed postgres migration owner required';end if;end$$;

create function app.consolation_four_qualifier_source_v1(t uuid,e uuid,qid uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare q app.qualification_result_versions%rowtype; m app.qualification_result_versions%rowtype;
 mid uuid; games integer; threshold integer;
begin
 select * into q from app.qualification_result_versions where id=qid and tournament_id=t and event_id=e;
 if not found or q.qualifier_count<>4 or q.participant_count not between 13 and 16
   or not app.qualification_resolution_snapshot_current_v1(q.id) then return null;end if;
 select s.game_count into games from app.tournament_setup_activations a
 join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id
 join app.events ev on ev.id=a.event_id and ev.tournament_id=a.tournament_id
 where a.tournament_id=t and a.event_id=e and s.event_kind='consolation' and s.format_code='standard_singles'
 and s.style_code='Standard' and ev.event_type='consolation' and ev.operational_state='active' and ev.format='standard_singles';
 threshold:=case games when 7 then 9 when 8 then 11 when 9 then 12 when 10 then 13 end;
 if threshold is null then return null;end if;
 if (select count(*) from app.events ev join app.tournament_setup_activations a on a.event_id=ev.id and a.tournament_id=ev.tournament_id
 join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id
 where ev.tournament_id=t and ev.event_type='main' and ev.operational_state='active' and ev.format='standard_singles'
 and s.event_kind='main' and s.format_code='standard_singles' and s.style_code='Standard')<>1 then return null;end if;
 select ev.id into mid from app.events ev join app.tournament_setup_activations a on a.event_id=ev.id and a.tournament_id=ev.tournament_id
 join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id
 where ev.tournament_id=t and ev.event_type='main' and ev.operational_state='active' and ev.format='standard_singles'
 and s.event_kind='main' and s.format_code='standard_singles' and s.style_code='Standard';
 select * into m from app.qualification_result_versions where tournament_id=t and event_id=mid order by version desc limit 1;
 if m.id is null or not app.qualification_resolution_snapshot_current_v1(m.id) then return null;end if;
 if (select count(*) from app.qualification_result_rows where result_version_id=q.id and qualification_status='qualified')<>4
 or exists(select 1 from app.qualification_result_rows r where r.result_version_id=q.id and r.qualification_status='qualified'
   and (r.tied or r.verified_games<>games or r.ranking_ordinal not between 1 and 4 or (r.ranking_ordinal<=2 and r.game_points<threshold))) then return null;end if;
 -- Every entrant must map to exactly one current Main nonqualifier. Opt-outs
 -- are allowed. Profile IDs and display names are never identity evidence.
 if exists(select 1 from app.event_participants cp where cp.tournament_id=t and cp.event_id=e and
  (cp.roster_entry_id is null or (select count(*) from app.event_participants mp join app.qualification_result_rows mr
    on mr.result_version_id=m.id and mr.participant_id=mp.id and mr.qualification_status in('high_non_qualifier','not_qualified')
    where mp.tournament_id=t and mp.event_id=mid and mp.roster_entry_id=cp.roster_entry_id)<>1)) then return null;end if;
 return encode(extensions.digest(convert_to(jsonb_build_object('kind','consolation-four-qualifier-v1',
  'consolationQualification',to_jsonb(q),'mainQualification',to_jsonb(m),
  'activations',(select jsonb_agg(jsonb_build_object('activation',to_jsonb(a),'setup',to_jsonb(s)) order by a.event_id)
    from app.tournament_setup_activations a join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id
    where a.tournament_id=t and a.event_id in(e,mid)),
  'consolationSource',app.qualification_tie_source_v1(t,e),'mainSource',app.qualification_tie_source_v1(t,mid),
  'consolationRows',(select jsonb_agg(to_jsonb(r) order by ranking_ordinal) from app.qualification_result_rows r where r.result_version_id=q.id),
  'mainRows',(select jsonb_agg(to_jsonb(r) order by ranking_ordinal) from app.qualification_result_rows r where r.result_version_id=m.id),
  'entrantMapping',(select jsonb_agg(jsonb_build_array(cp.id,cp.roster_entry_id,mp.id,mr.qualification_status) order by cp.id)
    from app.event_participants cp join app.event_participants mp on mp.tournament_id=t and mp.event_id=mid and mp.roster_entry_id=cp.roster_entry_id
    join app.qualification_result_rows mr on mr.result_version_id=m.id and mr.participant_id=mp.id where cp.tournament_id=t and cp.event_id=e))::text,'utf8'),'sha256'),'hex');
end$$;
revoke all on function app.consolation_four_qualifier_source_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function app.derive_consolation_four_qualifier_v1(qid uuid,series jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q app.qualification_result_versions%rowtype; ids uuid[];points integer[];w uuid[]:='{}';l uuid[]:='{}';item jsonb;
 games integer;threshold integer;i integer;wins integer;qp integer;pm integer;elim integer; result jsonb:='[]';
begin
 select * into q from app.qualification_result_versions where id=qid;
 if not found or app.consolation_four_qualifier_source_v1(q.tournament_id,q.event_id,q.id) is null then return null;end if;
 select s.game_count into games from app.tournament_setup_activations a join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id where a.tournament_id=q.tournament_id and a.event_id=q.event_id;
 threshold:=case games when 7 then 9 when 8 then 11 when 9 then 12 when 10 then 13 end;
 if jsonb_typeof(series) is distinct from 'array' or jsonb_array_length(series)<>3 then return null;end if;
 for item in select value from jsonb_array_elements(series) loop
  if jsonb_typeof(item) is distinct from 'object' then return null;end if;
  if (select count(*) from jsonb_object_keys(item))<>3 or not(item?&array['winnerId','loserId','evidenceNote'])
   or jsonb_typeof(item->'winnerId') is distinct from 'string' or jsonb_typeof(item->'loserId') is distinct from 'string'
   or (item->>'winnerId')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or (item->>'loserId')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or jsonb_typeof(item->'evidenceNote') is distinct from 'string' or length(item->>'evidenceNote') not between 1 and 200
   or item->>'evidenceNote'<>trim(item->>'evidenceNote') or item->>'evidenceNote'~'[[:cntrl:]]' then return null;end if;
  w:=array_append(w,(item->>'winnerId')::uuid);l:=array_append(l,(item->>'loserId')::uuid);
 end loop;
 select array_agg(participant_id order by ranking_ordinal),array_agg(game_points order by ranking_ordinal) into ids,points
 from app.qualification_result_rows where result_version_id=q.id and qualification_status='qualified';
 if exists(select 1 from generate_series(1,3)n where w[n]=l[n])
 or not(w[1]=any(array[ids[1],ids[4]]) and l[1]=any(array[ids[1],ids[4]]))
 or not(w[2]=any(array[ids[2],ids[3]]) and l[2]=any(array[ids[2],ids[3]]))
 or not(w[3]=any(array[w[1],w[2]]) and l[3]=any(array[w[1],w[2]])) then return null;end if;
 for i in 1..4 loop
  select count(*)::integer into wins from unnest(w)x where x=ids[i];
  elim:=case when ids[i]=w[3] then null when ids[i]=l[3] then 2 else 1 end;
  qp:=case when i<=2 then 3*(points[i]-threshold+1) else 3 end;
  pm:=4*(wins+1)*(wins+2)/2;
  result:=result||jsonb_build_array(jsonb_build_object('participantId',ids[i],'playedMatchWins',wins,'byeWins',0,
   'eliminatedInRound',elim,'champion',elim is null,'bandStart',case when elim is null then 1 when elim=2 then 2 else 3 end,
   'bandEnd',case when elim is null then 1 when elim=2 then 2 else 4 end,'qualifyingMrp',qp,'playoffMrp',pm,'totalMrp',qp+pm));
 end loop;return result;
end$$;
revoke all on function app.derive_consolation_four_qualifier_v1(uuid,jsonb) from public,anon,authenticated,service_role;

create table app.consolation_playoff_outcome_versions_v1(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,qualification_result_version_id uuid not null,
 version integer not null check(version between 1 and 256),supersedes_id uuid,
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),request_payload jsonb not null,
 series jsonb not null check(jsonb_typeof(series)='array' and jsonb_array_length(series)=3),
 outcomes jsonb not null check(jsonb_typeof(outcomes)='array' and jsonb_array_length(outcomes)=4),
 bracket_source_version text not null check(bracket_source_version='acc-rulebook-2025-effective-2025-08-01'),
 mrp_source_version text not null check(mrp_source_version='acc-published-mrp-2016-08-01'),
 physical_play_attested boolean not null,synthetic_artifact_id uuid,recorded_by uuid not null references app.profiles(id),
 operation_receipt_id uuid not null,recorded_at timestamptz not null,
 check((physical_play_attested and synthetic_artifact_id is null) or (not physical_play_attested and synthetic_artifact_id is not null)),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id),
 foreign key(qualification_result_version_id,tournament_id,event_id) references app.qualification_result_versions(id,tournament_id,event_id),
 foreign key(synthetic_artifact_id,tournament_id,event_id) references app.synthetic_event_artifacts_v1(id,tournament_id,event_id),
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id),
 unique(event_id,version),unique(id,tournament_id,event_id),
 foreign key(supersedes_id,tournament_id,event_id) references app.consolation_playoff_outcome_versions_v1(id,tournament_id,event_id)
);
alter table app.consolation_playoff_outcome_versions_v1 enable row level security;
alter table app.consolation_playoff_outcome_versions_v1 force row level security;
revoke all on app.consolation_playoff_outcome_versions_v1 from public,anon,authenticated,service_role;
create trigger consolation_outcomes_immutable_v1 before update or delete on app.consolation_playoff_outcome_versions_v1 for each row execute function app.reject_immutable_history();
create index consolation_outcomes_qualification_v1 on app.consolation_playoff_outcome_versions_v1(qualification_result_version_id,tournament_id,event_id);
create index consolation_outcomes_receipt_v1 on app.consolation_playoff_outcome_versions_v1(operation_receipt_id,tournament_id);
create index consolation_outcomes_artifact_v1 on app.consolation_playoff_outcome_versions_v1(synthetic_artifact_id,tournament_id,event_id);
create index consolation_outcomes_supersedes_v1 on app.consolation_playoff_outcome_versions_v1(supersedes_id,tournament_id,event_id);

-- Protect both directions. Existing versioned domains remain untouched.
create function app.consolation_playoff_domain_conflict_v1(eid uuid)returns boolean language sql stable security definer set search_path=''as $$
 select app.playoff_domain_conflict_v4(eid) or exists(select 1 from app.playoff_outcome_versions_v4 where event_id=eid)
 or exists(select 1 from app.q_accounting_drafts_v6 where event_id=eid) or exists(select 1 from app.q_accounting_finals_v6 where event_id=eid)
 or exists(select 1 from app.no_q_accounting_drafts_v7 where event_id=eid) or exists(select 1 from app.no_q_accounting_finals_v7 where event_id=eid)
 or exists(select 1 from app.prize_accounting_drafts_v8 where event_id=eid) or exists(select 1 from app.prize_accounting_finals_v8 where event_id=eid)
 or exists(select 1 from app.prize_accounting_drafts_v9 where event_id=eid) or exists(select 1 from app.prize_accounting_finals_v9 where event_id=eid)
$$;
revoke all on function app.consolation_playoff_domain_conflict_v1(uuid) from public,anon,authenticated,service_role;
create function app.guard_consolation_playoff_domain_v1()returns trigger language plpgsql security definer set search_path=''as $$begin
 -- Accounting writers already hold this row; never add a post-event advisory
 -- lock here, because legacy accounting obtains the tournament row first.
 perform 1 from app.tournaments where id=new.tournament_id for update;
 if tg_table_name='consolation_playoff_outcome_versions_v1' then
  if app.consolation_playoff_domain_conflict_v1(new.event_id) then raise exception 'playoff_domain_conflict';end if;
 elsif exists(select 1 from app.consolation_playoff_outcome_versions_v1 where event_id=new.event_id) then raise exception 'playoff_domain_conflict';end if;
 return new;
end$$;
revoke all on function app.guard_consolation_playoff_domain_v1() from public,anon,authenticated,service_role;
create trigger consolation_playoff_domain_v1 before insert on app.consolation_playoff_outcome_versions_v1 for each row execute function app.guard_consolation_playoff_domain_v1();
create trigger legacy_playoff_consolation_domain_v1 before insert on app.standard_singles_playoff_result_versions for each row execute function app.guard_consolation_playoff_domain_v1();
create trigger v3_playoff_consolation_domain_v1 before insert on app.playoff_outcome_versions_v3 for each row execute function app.guard_consolation_playoff_domain_v1();
create trigger v4_playoff_consolation_domain_v1 before insert on app.playoff_outcome_versions_v4 for each row execute function app.guard_consolation_playoff_domain_v1();
do $$declare n text;begin foreach n in array array['standard_singles_settlement_drafts','standard_singles_settlement_final_versions','event_settlement_drafts_v5','event_settlement_finals_v2','q_accounting_drafts_v6','q_accounting_finals_v6','no_q_accounting_drafts_v7','no_q_accounting_finals_v7','prize_accounting_drafts_v8','prize_accounting_finals_v8','prize_accounting_drafts_v9','prize_accounting_finals_v9'] loop
 execute format('create trigger %I before insert on app.%I for each row execute function app.guard_consolation_playoff_domain_v1()','a0_consolation_domain_'||n,n);
end loop;end$$;

create function app.valid_consolation_playoff_request_v1(req jsonb)returns boolean language plpgsql immutable set search_path=''as $$begin
 if jsonb_typeof(req) is distinct from 'object' or jsonb_typeof(req->'series') is distinct from 'array' then return false;end if;
 return (select count(*) from jsonb_object_keys(req))=8 and req?&array['qualificationResultVersionId','expectedVersion','sourceDigest','series','reason','reviewed','physicalPlayAttested','artifactId']
  and jsonb_typeof(req->'qualificationResultVersionId')='string' and (req->>'qualificationResultVersionId')~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  and jsonb_typeof(req->'expectedVersion')='number' and (req->>'expectedVersion')~'^(0|[1-9][0-9]*)$' and (req->>'expectedVersion')::numeric<=255
  and jsonb_typeof(req->'sourceDigest')='string' and (req->>'sourceDigest')~'^[a-f0-9]{64}$' and jsonb_array_length(req->'series')=3
  and jsonb_typeof(req->'reason')='string' and length(req->>'reason') between 1 and 500 and trim(req->>'reason')=req->>'reason' and req->>'reason'!~'[[:cntrl:]]'
  and req->'reviewed'='true'::jsonb and jsonb_typeof(req->'physicalPlayAttested')='boolean'
  and (req->'artifactId'='null'::jsonb or (jsonb_typeof(req->'artifactId')='string' and (req->>'artifactId')~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'));
exception when others then return false;end$$;
revoke all on function app.valid_consolation_playoff_request_v1(jsonb) from public,anon,authenticated,service_role;

-- Dispute writers lock a qualification advisory key before their game row and
-- tournament row. Taking both event keys first avoids a game/tournament cycle.
create function app.lock_consolation_qualification_sources_v1(tid uuid,eid uuid)returns uuid[]
language plpgsql volatile security definer set search_path=''as $$
declare ids uuid[];one_id uuid;begin
 select array_agg(id order by id) into ids from app.events where tournament_id=tid and (id=eid or (event_type='main' and operational_state='active'));
 foreach one_id in array coalesce(ids,'{}'::uuid[]) loop
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qualification-finalization:'||one_id::text,0));
 end loop;return coalesce(ids,'{}'::uuid[]);
end$$;
revoke all on function app.lock_consolation_qualification_sources_v1(uuid,uuid) from public,anon,authenticated,service_role;

-- Fixture owner creates the evidence itself; service callers cannot prepare it.
create function app.prepare_synthetic_consolation_playoff_v1(actor uuid,tid uuid,eid uuid,qid uuid,expected integer,decision jsonb)returns uuid
language plpgsql security definer set search_path=''as $$
declare source text;aid uuid;body text;payload jsonb;series jsonb;locked uuid[];begin
 locked:=app.lock_consolation_qualification_sources_v1(tid,eid);
 perform 1 from app.tournaments where id=tid and status='open' for update;
 if not found or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director'))
 or not exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=tid and event_id=eid) then raise exception 'synthetic_fixture_unavailable';end if;
 if locked is distinct from coalesce((select array_agg(id order by id) from app.events where tournament_id=tid and (id=eid or (event_type='main' and operational_state='active'))),'{}'::uuid[]) then raise exception 'synthetic_source_unavailable';end if;
 perform 1 from app.events where tournament_id=tid and (id=eid or (event_type='main' and operational_state='active')) order by id for update;
 perform 1 from app.canonical_games where tournament_id=tid and event_id in(select id from app.events where tournament_id=tid and (id=eid or (event_type='main' and operational_state='active'))) order by event_id,id for update;
 source:=app.consolation_four_qualifier_source_v1(tid,eid,qid);
 if source is null or expected is null or expected<0 or expected>255 or expected<>(select coalesce(max(version),0) from app.consolation_playoff_outcome_versions_v1 where event_id=eid)
 or jsonb_typeof(decision) is distinct from 'array' or jsonb_array_length(decision)<>3 then raise exception 'synthetic_source_unavailable';end if;
 if exists(select 1 from jsonb_array_elements(decision)x where jsonb_typeof(x) is distinct from 'object' or (select count(*) from jsonb_object_keys(x))<>2 or not(x?&array['winnerId','loserId'])) then raise exception 'synthetic_decision_invalid';end if;
 select jsonb_agg(x||jsonb_build_object('evidenceNote','TEST ONLY synthetic planning') order by n) into series from jsonb_array_elements(decision)with ordinality e(x,n);
 if app.derive_consolation_four_qualifier_v1(qid,series) is null then raise exception 'synthetic_decision_invalid';end if;
 payload:=jsonb_build_object('qualificationResultVersionId',qid,'expectedVersion',expected,'sourceDigest',source,'series',decision);
 body:='SYNTHETIC CONSOLATION PLAYOFF EVIDENCE'||chr(10)||'Tournament: '||tid||chr(10)||'Event: '||eid||chr(10)||'Source: '||source||chr(10)||'Simulated series: '||decision::text||chr(10)||'No physical play; no human review; no actual money received or moved.'||chr(10);
 insert into app.synthetic_event_artifacts_v1(tournament_id,event_id,kind,source_digest,payload,artifact_text)values(tid,eid,'playoff',source,payload,body)returning id into aid;return aid;
end$$;
revoke all on function app.prepare_synthetic_consolation_playoff_v1(uuid,uuid,uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;

create function app.guard_consolation_playoff_evidence_v1()returns trigger language plpgsql security definer set search_path=''as $$
declare a app.synthetic_event_artifacts_v1%rowtype;ref text;synthetic boolean;begin
 synthetic:=exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=new.tournament_id and event_id=new.event_id);
 if not synthetic then
  if not new.physical_play_attested or new.synthetic_artifact_id is not null then raise exception 'physical_attestation_required';end if;
  return new;
 end if;
 if new.physical_play_attested or new.synthetic_artifact_id is null then raise exception 'synthetic_evidence_required';end if;
 select * into a from app.synthetic_event_artifacts_v1 where id=new.synthetic_artifact_id and tournament_id=new.tournament_id and event_id=new.event_id and kind='playoff';
 if not found or a.source_digest is distinct from new.source_digest
  or a.source_digest is distinct from app.consolation_four_qualifier_source_v1(new.tournament_id,new.event_id,new.qualification_result_version_id)
  or a.payload->>'qualificationResultVersionId' is distinct from new.qualification_result_version_id::text
  or a.payload->'expectedVersion' is distinct from new.request_payload->'expectedVersion'
  or a.payload->>'sourceDigest' is distinct from new.source_digest
  or (select jsonb_agg(x-'evidenceNote' order by n) from jsonb_array_elements(new.series) with ordinality e(x,n)) is distinct from a.payload->'series'
  or position('TEST ONLY SYNTHETIC:' in new.request_payload->>'reason')<>1 then raise exception 'synthetic_evidence_mismatch';end if;
 ref:='SYNTHETIC-EVENT-v1:'||a.id||':'||a.sha256;
 if exists(select 1 from jsonb_array_elements(new.series) with ordinality e(x,n) where x->>'evidenceNote' is distinct from ref||':'||n) then raise exception 'synthetic_evidence_mismatch';end if;
 return new;
end$$;
revoke all on function app.guard_consolation_playoff_evidence_v1() from public,anon,authenticated,service_role;
create trigger consolation_playoff_evidence_v1 before insert on app.consolation_playoff_outcome_versions_v1 for each row execute function app.guard_consolation_playoff_evidence_v1();

create function app.annotate_synthetic_consolation_playoff_v1()returns trigger language plpgsql security definer set search_path=''as $$begin
 if new.synthetic_artifact_id is not null then
  insert into app.synthetic_event_provenance_v1(tournament_id,event_id,operation_receipt_id,entity_table,entity_id,artifact_id,source_digest,record_sha256)
  values(new.tournament_id,new.event_id,new.operation_receipt_id,tg_table_name,new.id,new.synthetic_artifact_id,new.source_digest,encode(extensions.digest(to_jsonb(new)::text,'sha256'),'hex'));
 end if;return new;
end$$;
revoke all on function app.annotate_synthetic_consolation_playoff_v1() from public,anon,authenticated,service_role;
create trigger consolation_playoff_provenance_v1 after insert on app.consolation_playoff_outcome_versions_v1 for each row execute function app.annotate_synthetic_consolation_playoff_v1();

create function public.record_consolation_playoff_outcomes_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare old app.operation_receipts%rowtype;prior app.consolation_playoff_outcome_versions_v1%rowtype;
 h text;source text;derived jsonb;code text;response jsonb;rid uuid:=extensions.gen_random_uuid();receipt uuid:=extensions.gen_random_uuid();stamp timestamptz;status_value text;synthetic boolean;locked uuid[];begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' then return null;end if;
 if actor is null or tid is null or eid is null or op is null then return jsonb_build_object('status','rejected','code','invalid_request','eventId',eid);end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||op::text,0));
 locked:=app.lock_consolation_qualification_sources_v1(tid,eid);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('standard-singles-post-event:'||eid::text,0));
 select status into status_value from app.tournaments where id=tid for update;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable','eventId',eid);end if;
 if locked is distinct from coalesce((select array_agg(id order by id) from app.events where tournament_id=tid and (id=eid or (event_type='main' and operational_state='active'))),'{}'::uuid[]) then return jsonb_build_object('status','rejected','code','source_blocked','eventId',eid);end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director') for update;
 if not found then return jsonb_build_object('status','rejected','code','not_director','eventId',eid);end if;
 perform 1 from app.events where id=eid and tournament_id=tid for update;
 if not found then return jsonb_build_object('status','rejected','code','source_blocked','eventId',eid);end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('consolation_playoff_outcomes_v1',actor,tid,eid,req)::text,'utf8'),'sha256'),'hex');
 select * into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then
  if old.tournament_id=tid and old.target_id=eid and old.operation_type='consolation_playoff_outcomes_v1' and old.request_hash=h then return old.response_payload;end if;
  insert into app.standard_singles_playoff_result_conflicts(tournament_id,actor_profile_id,attempted_event_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code)
  values(tid,actor,eid,op,h,case when old.tournament_id=tid then old.id end,'idempotency_conflict');
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,'consolation_playoff_outcome_v1',eid,'consolation_playoff_conflict_v1',jsonb_build_object('code','idempotency_conflict'));
  return jsonb_build_object('status','rejected','code','idempotency_conflict','eventId',eid);
 end if;
 begin
  if not coalesce(app.valid_consolation_playoff_request_v1(req),false) then raise exception 'invalid_request';end if;
  if status_value<>'open' then raise exception 'tournament_unavailable';end if;
  if app.consolation_playoff_domain_conflict_v1(eid) then raise exception 'playoff_domain_conflict';end if;
  -- Match qualification finalization's tournament -> event -> game lock boundary.
  -- Lock both sources before the fingerprint, including an in-flight correction.
  perform 1 from app.events where tournament_id=tid and (id=eid or (event_type='main' and operational_state='active')) order by id for update;
  perform 1 from app.canonical_games where tournament_id=tid and event_id in(select id from app.events where tournament_id=tid and (id=eid or (event_type='main' and operational_state='active'))) order by event_id,id for update;
  source:=app.consolation_four_qualifier_source_v1(tid,eid,(req->>'qualificationResultVersionId')::uuid);
  if source is null then raise exception 'qualification_unavailable';end if;
  if source<>req->>'sourceDigest' then raise exception 'source_changed';end if;
  select * into prior from app.consolation_playoff_outcome_versions_v1 where event_id=eid order by version desc limit 1;
  if coalesce(prior.version,0)<>(req->>'expectedVersion')::integer then raise exception 'stale_version';end if;
  if prior.id is not null and prior.source_digest=source and prior.series=req->'series' then raise exception 'already_recorded';end if;
  derived:=app.derive_consolation_four_qualifier_v1((req->>'qualificationResultVersionId')::uuid,req->'series');
  if derived is null then raise exception 'invalid_series';end if;
  synthetic:=exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=tid and event_id=eid);
  if synthetic and (req->'physicalPlayAttested'<>'false'::jsonb or req->'artifactId'='null'::jsonb) then raise exception 'synthetic_evidence_required';end if;
  if not synthetic and (req->'physicalPlayAttested'<>'true'::jsonb or req->'artifactId'<>'null'::jsonb) then raise exception 'physical_attestation_required';end if;
  if synthetic and not exists(select 1 from app.synthetic_event_artifacts_v1 a where a.id=(req->>'artifactId')::uuid and a.tournament_id=tid and a.event_id=eid and a.kind='playoff'
   and a.source_digest=source and app.synthetic_event_request_matches_v1(a,req-'physicalPlayAttested'-'artifactId')) then raise exception 'synthetic_evidence_mismatch';end if;
  stamp:=clock_timestamp();response:=jsonb_build_object('status','consolation_playoff_recorded_v1','tournamentId',tid,'eventId',eid,'resultId',rid,'version',coalesce(prior.version,0)+1,'sourceDigest',source,'recordedAt',stamp);
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
  code:=case when sqlerrm in('invalid_request','tournament_unavailable','playoff_domain_conflict','qualification_unavailable','source_changed','stale_version','already_recorded','invalid_series','synthetic_evidence_required','synthetic_evidence_mismatch','physical_attestation_required') then sqlerrm else 'invalid_request' end;
  stamp:=clock_timestamp();response:=jsonb_build_object('status','rejected','code',code,'eventId',eid);
 end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(receipt,tid,actor,'consolation_playoff_outcomes_v1',eid,h,op,case when code is null then 'accepted' else 'rejected' end,response,stamp);
 if code is null then
  insert into app.consolation_playoff_outcome_versions_v1(id,tournament_id,event_id,qualification_result_version_id,version,supersedes_id,source_digest,request_payload,series,outcomes,bracket_source_version,mrp_source_version,physical_play_attested,synthetic_artifact_id,recorded_by,operation_receipt_id,recorded_at)
  values(rid,tid,eid,(req->>'qualificationResultVersionId')::uuid,coalesce(prior.version,0)+1,prior.id,source,req,req->'series',derived,'acc-rulebook-2025-effective-2025-08-01','acc-published-mrp-2016-08-01',(req->>'physicalPlayAttested')::boolean,(req->>'artifactId')::uuid,actor,receipt,stamp);
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
 values(tid,actor,receipt,'consolation_playoff_outcome_v1',case when code is null then rid else eid end,case when code is null then 'consolation_playoff_recorded_v1' else 'consolation_playoff_rejected_v1' end,
 case when prior.id is not null and code is null then jsonb_build_object('supersedesId',prior.id) else null end,response);
 return response;
end$$;
revoke all on function public.record_consolation_playoff_outcomes_v1(uuid,uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.record_consolation_playoff_outcomes_v1(uuid,uuid,uuid,jsonb,uuid) to service_role;

create function public.get_consolation_playoff_workspace_v1(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare q app.qualification_result_versions%rowtype;v app.consolation_playoff_outcome_versions_v1%rowtype;source text;blocker text;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director'))
 or not exists(select 1 from app.events where id=eid and tournament_id=tid) then return null;end if;
 select * into q from app.qualification_result_versions where tournament_id=tid and event_id=eid order by version desc limit 1;
 source:=app.consolation_four_qualifier_source_v1(tid,eid,q.id);
 select * into v from app.consolation_playoff_outcome_versions_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 blocker:=case when source is null then 'qualification_unavailable' when app.consolation_playoff_domain_conflict_v1(eid) then 'playoff_domain_conflict'
  when not exists(select 1 from app.tournaments where id=tid and status='open') then 'tournament_unavailable' else null end;
 return jsonb_build_object('tournamentId',tid,'eventId',eid,'qualificationResultVersionId',q.id,'sourceDigest',source,'currentVersion',coalesce(v.version,0),
  'canRecord',blocker is null,'blocker',blocker,'qualifiers',coalesce((select jsonb_agg(jsonb_build_object('participantId',r.participant_id,'displayName',r.display_name_snapshot,'qualificationRank',r.ranking_ordinal,'gamePoints',r.game_points) order by r.ranking_ordinal) from app.qualification_result_rows r where r.result_version_id=q.id and r.qualification_status='qualified'),'[]'::jsonb),
  'result',case when v.id is null then null else jsonb_build_object('resultId',v.id,'version',v.version,'sourceDigest',v.source_digest,
   'current',coalesce(v.source_digest=source and v.outcomes=app.derive_consolation_four_qualifier_v1(v.qualification_result_version_id,v.series),false),
   'series',v.series,'outcomes',v.outcomes,'physicalPlayAttested',v.physical_play_attested,'syntheticArtifactId',v.synthetic_artifact_id,
   'bracketSourceVersion',v.bracket_source_version,'mrpSourceVersion',v.mrp_source_version,'recordedAt',v.recorded_at)end,
  'automaticPayment',false);
end$$;

create function public.get_consolation_playoff_reconciliation_v1(actor uuid,tid uuid,eid uuid,op uuid,req jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$declare r app.operation_receipts%rowtype;h text;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director'))
 or not exists(select 1 from app.events where id=eid and tournament_id=tid) then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('consolation_playoff_outcomes_v1',actor,tid,eid,req)::text,'utf8'),'sha256'),'hex');
 select * into r from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if r.id is null then return jsonb_build_object('authorized',true,'result',null);end if;
 if r.tournament_id is distinct from tid or r.target_id is distinct from eid or r.operation_type is distinct from 'consolation_playoff_outcomes_v1' or r.request_hash is distinct from h then
  return jsonb_build_object('authorized',true,'result',jsonb_build_object('status','rejected','eventId',eid,'code','idempotency_conflict'));end if;
 return jsonb_build_object('authorized',true,'result',r.response_payload);
end$$;
revoke all on function public.get_consolation_playoff_workspace_v1(uuid,uuid,uuid),public.get_consolation_playoff_reconciliation_v1(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.get_consolation_playoff_workspace_v1(uuid,uuid,uuid),public.get_consolation_playoff_reconciliation_v1(uuid,uuid,uuid,uuid,jsonb) to service_role;
commit;

