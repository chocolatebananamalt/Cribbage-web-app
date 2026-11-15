-- LOCAL additive proposal. Five actual qualifiers, three evidenced first-round
-- byes and FOUR played series. No historical v3/legacy row is reinterpreted.
begin;
do $$begin if current_user<>'postgres'then raise exception 'Reviewed postgres migration owner required';end if;end$$;
create table app.playoff_outcome_versions_v4 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null,event_id uuid not null,qualification_result_version_id uuid not null,
 version integer not null check(version between 1 and 256),supersedes_id uuid,
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 request_payload jsonb not null,
 series jsonb not null check(jsonb_typeof(series)='array'and jsonb_array_length(series)=4),
 outcomes jsonb not null check(jsonb_typeof(outcomes)='array'and jsonb_array_length(outcomes)=5),
 bracket_source_version text not null check(bracket_source_version='acc-rulebook-2025-effective-2025-08-01'),
 mrp_source_version text not null check(mrp_source_version='acc-published-mrp-2016-08-01'),
 recorded_by uuid not null references app.profiles(id),operation_receipt_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(qualification_result_version_id,tournament_id,event_id)references app.qualification_result_versions(id,tournament_id,event_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(event_id,version),unique(id,tournament_id,event_id,qualification_result_version_id),
 unique(id,tournament_id,event_id),
 foreign key(supersedes_id,tournament_id,event_id)references app.playoff_outcome_versions_v4(id,tournament_id,event_id)
);
alter table app.playoff_outcome_versions_v4 enable row level security;
alter table app.playoff_outcome_versions_v4 force row level security;
revoke all on app.playoff_outcome_versions_v4 from public,anon,authenticated,service_role;
create trigger playoff_outcome_versions_v4_immutable before update or delete on app.playoff_outcome_versions_v4 for each row execute function app.reject_immutable_history();
create index playoff_v4_qualification_idx on app.playoff_outcome_versions_v4(qualification_result_version_id,tournament_id,event_id);
create index playoff_v4_receipt_idx on app.playoff_outcome_versions_v4(operation_receipt_id,tournament_id);
create index playoff_v4_supersedes_idx on app.playoff_outcome_versions_v4(supersedes_id,tournament_id,event_id);
create index playoff_v4_actor_idx on app.playoff_outcome_versions_v4(recorded_by);

create function app.five_qualifier_playoff_source_v4(p_tid uuid,p_eid uuid,p_qid uuid)
returns text language plpgsql stable security definer set search_path=''as $$
declare q app.qualification_result_versions%rowtype;begin
 select*into q from app.qualification_result_versions where id=p_qid and tournament_id=p_tid and event_id=p_eid;
 if not found or q.qualifier_count<>5 or q.participant_count not between 17 and 20
  or not app.qualification_resolution_snapshot_current_v1(q.id)
  or not exists(select 1 from app.tournament_setup_activations a join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id join app.events e on e.id=a.event_id
   where a.tournament_id=p_tid and a.event_id=p_eid and s.event_kind='main'and s.format_code='standard_singles'and s.style_code='Standard'and s.game_count=12 and e.operational_state='active'and e.format='standard_singles')
  or(select count(*)from app.qualification_result_rows where result_version_id=q.id and qualification_status='qualified')<>5
  or exists(select 1 from app.qualification_result_rows r where result_version_id=q.id and r.qualification_status='qualified'and(r.tied or r.verified_games<>12 or r.ranking_ordinal not between 1 and 5 or(r.ranking_ordinal<=3 and r.game_points<14)))then return null;end if;
 return encode(extensions.digest(convert_to(jsonb_build_object('kind','five_qualifier_three_byes_v4','qualification',to_jsonb(q),
  'sourceFingerprint',app.qualification_tie_source_v1(p_tid,p_eid),
  'rows',(select jsonb_agg(to_jsonb(r)order by ranking_ordinal)from app.qualification_result_rows r where result_version_id=q.id))::text,'utf8'),'sha256'),'hex');
end$$;
revoke all on function app.five_qualifier_playoff_source_v4(uuid,uuid,uuid)from public,anon,authenticated,service_role;

-- Source chart eight slots:1v8,4v5,3v6,2v7. Missing seeds6/7/8 are
-- first-round byes for3/2/1; only4v5 is played in round1. Notes are evidence,
-- never authority for participant, bye, prize band or MRP derivation.
create function app.derive_five_qualifier_playoff_v4(p_qid uuid,p_series jsonb)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare q app.qualification_result_versions%rowtype;ids uuid[];points integer[];item jsonb;
 w uuid[]:='{}';l uuid[]:='{}';i integer;played integer;byes integer;credit integer;elim integer;bs integer;be integer;qp integer;pm integer;outcomes jsonb:='[]';begin
 select*into q from app.qualification_result_versions where id=p_qid;
 if not found or app.five_qualifier_playoff_source_v4(q.tournament_id,q.event_id,q.id)is null then return null;end if;
 if jsonb_typeof(p_series)is distinct from'array'or jsonb_array_length(p_series)<>4 then return null;end if;
 for item in select value from jsonb_array_elements(p_series)loop
  if jsonb_typeof(item)is distinct from'object'then return null;end if;
  if(select count(*)from jsonb_object_keys(item))<>3 or not(item?&array['winnerId','loserId','evidenceNote'])
   or jsonb_typeof(item->'winnerId')is distinct from'string'or jsonb_typeof(item->'loserId')is distinct from'string'
   or(item->>'winnerId')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or(item->>'loserId')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or jsonb_typeof(item->'evidenceNote')is distinct from'string'or length(item->>'evidenceNote')not between 1 and 200
   or item->>'evidenceNote'<>trim(item->>'evidenceNote')or item->>'evidenceNote'~'[[:cntrl:]]'then return null;end if;
  w:=array_append(w,(item->>'winnerId')::uuid);l:=array_append(l,(item->>'loserId')::uuid);
 end loop;
 select array_agg(participant_id order by ranking_ordinal),array_agg(game_points order by ranking_ordinal)into ids,points
 from app.qualification_result_rows where result_version_id=q.id and qualification_status='qualified';
 if exists(select 1 from generate_series(1,4)n where w[n]=l[n])
  or not(w[1]=any(array[ids[4],ids[5]])and l[1]=any(array[ids[4],ids[5]]))
  or not(w[2]=any(array[ids[1],w[1]])and l[2]=any(array[ids[1],w[1]]))
  or not(w[3]=any(array[ids[3],ids[2]])and l[3]=any(array[ids[3],ids[2]]))
  or not(w[4]=any(array[w[2],w[3]])and l[4]=any(array[w[2],w[3]]))then return null;end if;
 for i in 1..5 loop
  select count(*)::integer into played from unnest(w)x where x=ids[i];
  byes:=case when i<=3 then 1 else 0 end;credit:=played+byes+1;
  elim:=case when ids[i]=w[4]then null when ids[i]=l[4]then 3 when ids[i]=l[1]then 1 else 2 end;
  bs:=case when elim is null then 1 when elim=3 then 2 when elim=2 then 3 else 5 end;
  be:=case when elim=2 then 4 else bs end;
  qp:=case when i<=3 then 5*(points[i]-13)else 5 end;pm:=7*credit*(credit+1)/2;
  outcomes:=outcomes||jsonb_build_array(jsonb_build_object('participantId',ids[i],'playedMatchWins',played,'byeWins',byes,
   'eliminatedInRound',elim,'champion',elim is null,'bandStart',bs,'bandEnd',be,'qualifyingMrp',qp,'playoffMrp',pm,'totalMrp',qp+pm));
 end loop;return outcomes;
end$$;
revoke all on function app.derive_five_qualifier_playoff_v4(uuid,jsonb)from public,anon,authenticated,service_role;

create function app.playoff_domain_conflict_v4(p_eid uuid)returns boolean language sql stable security definer set search_path=''as $$
 select exists(select 1 from app.playoff_outcome_versions_v3 where event_id=p_eid)
 or exists(select 1 from app.standard_singles_playoff_result_versions where event_id=p_eid)
 or exists(select 1 from app.event_settlement_drafts_v5 where event_id=p_eid)
 or exists(select 1 from app.standard_singles_settlement_drafts where event_id=p_eid)
 or exists(select 1 from app.event_settlement_finals_v2 where event_id=p_eid)
 or exists(select 1 from app.standard_singles_settlement_final_versions where event_id=p_eid)
$$;
revoke all on function app.playoff_domain_conflict_v4(uuid)from public,anon,authenticated,service_role;

create function app.require_playoff_domain_v4()returns trigger language plpgsql security definer set search_path=''as $$begin
 perform pg_advisory_xact_lock(hashtextextended('standard-singles-post-event:'||new.event_id::text,0));
 if tg_table_name='playoff_outcome_versions_v4'then
  if app.playoff_domain_conflict_v4(new.event_id)then raise exception 'playoff_domain_conflict';end if;
 elsif exists(select 1 from app.playoff_outcome_versions_v4 where event_id=new.event_id)then raise exception 'playoff_domain_conflict';end if;
 return new;end$$;
revoke all on function app.require_playoff_domain_v4()from public,anon,authenticated,service_role;
create trigger playoff_v4_domain before insert on app.playoff_outcome_versions_v4 for each row execute function app.require_playoff_domain_v4();
create trigger playoff_v3_domain_v4 before insert on app.playoff_outcome_versions_v3 for each row execute function app.require_playoff_domain_v4();
create trigger playoff_legacy_domain_v4 before insert on app.standard_singles_playoff_result_versions for each row execute function app.require_playoff_domain_v4();

create function app.valid_playoff_request_v4(p_request jsonb)returns boolean language plpgsql immutable set search_path=''as $$begin
 if jsonb_typeof(p_request)is distinct from'object'then return false;end if;
 if jsonb_typeof(p_request->'series')is distinct from'array'then return false;end if;
 return(select count(*)from jsonb_object_keys(p_request))=6 and p_request?&array['qualificationResultVersionId','expectedVersion','sourceDigest','series','reason','reviewed']
  and jsonb_typeof(p_request->'qualificationResultVersionId')='string'and(p_request->>'qualificationResultVersionId')~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  and jsonb_typeof(p_request->'expectedVersion')='number'and(p_request->>'expectedVersion')~'^(0|[1-9][0-9]*)$'and(p_request->>'expectedVersion')::numeric<=255
  and jsonb_typeof(p_request->'sourceDigest')='string'and(p_request->>'sourceDigest')~'^[a-f0-9]{64}$'
  and jsonb_typeof(p_request->'series')='array'and jsonb_array_length(p_request->'series')=4
  and jsonb_typeof(p_request->'reason')='string'and length(p_request->>'reason')between 1 and 500
  and p_request->>'reason'=trim(p_request->>'reason')and p_request->>'reason'!~'[[:cntrl:]]'and p_request->'reviewed'='true'::jsonb;
end$$;
revoke all on function app.valid_playoff_request_v4(jsonb)from public,anon,authenticated,service_role;

create function public.record_standard_singles_playoff_outcomes_v4(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=''as $$
declare old app.operation_receipts%rowtype;prior app.playoff_outcome_versions_v4%rowtype;h text;source text;derived jsonb;code text;response jsonb;
 rid uuid:=extensions.gen_random_uuid();receipt uuid:=extensions.gen_random_uuid();stamp timestamptz;status_value text;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','invalid_request');end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('qualification-finalization:'||p_event_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('standard-singles-post-event:'||p_event_id::text,0));
 select status into status_value from app.tournaments where id=p_tournament_id for update;if not found then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')for update;
 if not found then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','not_director');end if;
 perform 1 from app.events where id=p_event_id and tournament_id=p_tournament_id for update;if not found then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','source_blocked');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('playoff_outcomes_v4',p_actor_id,p_tournament_id,p_event_id,p_request)::text,'utf8'),'sha256'),'hex');
 select*into old from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
  if old.tournament_id=p_tournament_id and old.target_id=p_event_id and old.operation_type='playoff_outcomes_v4'and old.request_hash=h then return old.response_payload;end if;
  insert into app.standard_singles_playoff_result_conflicts(tournament_id,actor_profile_id,attempted_event_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code)
  values(p_tournament_id,p_actor_id,p_event_id,p_operation_id,h,case when old.tournament_id=p_tournament_id then old.id else null end,'idempotency_conflict');
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)
  values(p_tournament_id,p_actor_id,'playoff_outcome_v4',p_event_id,'playoff_outcomes_v4_conflict',jsonb_build_object('code','idempotency_conflict'));
  return jsonb_build_object('status','rejected','eventId',p_event_id,'code','idempotency_conflict');
 end if;
 begin
  if not coalesce(app.valid_playoff_request_v4(p_request),false)then raise exception 'invalid_request';end if;
  if exists(select 1 from app.q_accounting_finals_v6 where tournament_id=p_tournament_id and event_id=p_event_id)then raise exception 'settlement_finalized';end if;
  if status_value<>'open'then raise exception 'tournament_unavailable';end if;
  if app.playoff_domain_conflict_v4(p_event_id)then raise exception 'playoff_domain_conflict';end if;
  source:=app.five_qualifier_playoff_source_v4(p_tournament_id,p_event_id,(p_request->>'qualificationResultVersionId')::uuid);
  if source is null then raise exception 'qualification_unavailable';end if;
  if source<>p_request->>'sourceDigest'then raise exception 'source_changed';end if;
  select*into prior from app.playoff_outcome_versions_v4 where event_id=p_event_id order by version desc limit 1;
  if coalesce(prior.version,0)<>(p_request->>'expectedVersion')::integer then raise exception 'stale_version';end if;
  if prior.id is not null and prior.source_digest=source and prior.series=p_request->'series'then raise exception 'already_recorded';end if;
  derived:=app.derive_five_qualifier_playoff_v4((p_request->>'qualificationResultVersionId')::uuid,p_request->'series');if derived is null then raise exception 'invalid_series';end if;
  stamp:=clock_timestamp();response:=jsonb_build_object('status','playoff_outcomes_recorded_v4','tournamentId',p_tournament_id,'eventId',p_event_id,'resultId',rid,'version',coalesce(prior.version,0)+1,'sourceDigest',source,'recordedAt',stamp);
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
  code:=case when sqlerrm in('invalid_request','tournament_unavailable','playoff_domain_conflict','settlement_finalized','qualification_unavailable','source_changed','stale_version','already_recorded','invalid_series')then sqlerrm else'invalid_request'end;
  stamp:=clock_timestamp();response:=jsonb_build_object('status','rejected','eventId',p_event_id,'code',code);
 end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(receipt,p_tournament_id,p_actor_id,'playoff_outcomes_v4',p_event_id,h,p_operation_id,case when code is null then'accepted'else'rejected'end,response,stamp);
 if code is null then insert into app.playoff_outcome_versions_v4(id,tournament_id,event_id,qualification_result_version_id,version,supersedes_id,source_digest,request_payload,series,outcomes,bracket_source_version,mrp_source_version,recorded_by,operation_receipt_id,recorded_at)
 values(rid,p_tournament_id,p_event_id,(p_request->>'qualificationResultVersionId')::uuid,coalesce(prior.version,0)+1,prior.id,source,p_request,p_request->'series',derived,'acc-rulebook-2025-effective-2025-08-01','acc-published-mrp-2016-08-01',p_actor_id,receipt,stamp);end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
 values(p_tournament_id,p_actor_id,receipt,'playoff_outcome_v4',case when code is null then rid else p_event_id end,case when code is null then'playoff_outcomes_v4_recorded'else'playoff_outcomes_v4_rejected'end,
 case when prior.id is not null and code is null then jsonb_build_object('supersedesId',prior.id)else null end,response);
 return response;
end$$;

create function public.get_standard_singles_playoff_outcome_workspace_v4(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare q app.qualification_result_versions%rowtype;v app.playoff_outcome_versions_v4%rowtype;digest text;blocker text;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))or not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id)then return null;end if;
 select*into q from app.qualification_result_versions where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;
 digest:=app.five_qualifier_playoff_source_v4(p_tournament_id,p_event_id,q.id);
 select*into v from app.playoff_outcome_versions_v4 where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;
 blocker:=case when q.id is null or digest is null then'qualification_unavailable'when app.playoff_domain_conflict_v4(p_event_id)then'playoff_domain_conflict'
 when exists(select 1 from app.q_accounting_finals_v6 where event_id=p_event_id)then'settlement_finalized'
 when not exists(select 1 from app.tournaments where id=p_tournament_id and status='open')then'tournament_unavailable'else null end;
 return jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,'qualificationResultVersionId',q.id,'sourceDigest',digest,'bracketKind','five_qualifier_three_byes_v4',
  'currentVersion',coalesce(v.version,0),'canRecord',blocker is null,'blocker',blocker,
  'qualifiers',coalesce((select jsonb_agg(jsonb_build_object('participantId',r.participant_id,'displayName',r.display_name_snapshot,'qualificationRank',r.ranking_ordinal,'gamePoints',r.game_points,'byeWins',case when r.ranking_ordinal<=3 then 1 else 0 end)order by r.ranking_ordinal)from app.qualification_result_rows r where result_version_id=q.id and qualification_status='qualified'),'[]'),
  'result',case when v.id is null then null else jsonb_build_object('resultId',v.id,'version',v.version,'qualificationResultVersionId',v.qualification_result_version_id,'sourceDigest',v.source_digest,'current',coalesce(v.source_digest=digest and v.outcomes=app.derive_five_qualifier_playoff_v4(v.qualification_result_version_id,v.series),false),
   'series',v.series,'outcomes',v.outcomes,'request',v.request_payload,'bracketSourceVersion',v.bracket_source_version,'mrpSourceVersion',v.mrp_source_version,'recordedAt',v.recorded_at)end,
  'automaticPayment',false);
end$$;

create function public.get_standard_singles_playoff_outcome_reconciliation_v4(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)
returns jsonb language plpgsql stable security definer set search_path=''as $$declare r app.operation_receipts%rowtype;h text;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))or not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id)then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('playoff_outcomes_v4',p_actor_id,p_tournament_id,p_event_id,p_request)::text,'utf8'),'sha256'),'hex');
 select*into r from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if r.id is null then return jsonb_build_object('authorized',true,'result',null);end if;
 if r.tournament_id is distinct from p_tournament_id or r.target_id is distinct from p_event_id or r.operation_type is distinct from'playoff_outcomes_v4'or r.request_hash is distinct from h then
 return jsonb_build_object('authorized',true,'result',jsonb_build_object('status','rejected','eventId',p_event_id,'code','idempotency_conflict'));end if;
 return jsonb_build_object('authorized',true,'result',r.response_payload);
end$$;
revoke all on function public.record_standard_singles_playoff_outcomes_v4(uuid,uuid,uuid,jsonb,uuid),public.get_standard_singles_playoff_outcome_workspace_v4(uuid,uuid,uuid),public.get_standard_singles_playoff_outcome_reconciliation_v4(uuid,uuid,uuid,uuid,jsonb)from public,anon,authenticated;
grant execute on function public.record_standard_singles_playoff_outcomes_v4(uuid,uuid,uuid,jsonb,uuid),public.get_standard_singles_playoff_outcome_workspace_v4(uuid,uuid,uuid),public.get_standard_singles_playoff_outcome_reconciliation_v4(uuid,uuid,uuid,uuid,jsonb)to service_role;

-- Dispatch ONLY the new tagged domain. Clone old readers verbatim, retaining
-- their OIDs/callers and all v3/legacy numerical/source restrictions.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.canonical_settlement_mrp_v5(uuid,uuid,jsonb)'::regprocedure);
 p:=replace(d,'FUNCTION app.canonical_settlement_mrp_v5(','FUNCTION app.canonical_settlement_mrp_pre_five_v5(');
 if p=d then raise exception 'Reviewed canonical clone anchor changed';end if;execute p;
 d:=pg_get_functiondef('app.settlement_source_current_v5(uuid,uuid,jsonb)'::regprocedure);
 p:=replace(d,'FUNCTION app.settlement_source_current_v5(','FUNCTION app.settlement_source_current_pre_five_v5(');
 if p=d then raise exception 'Reviewed current-source clone anchor changed';end if;execute p;
end$$;
create or replace function app.settlement_source_current_v5(p_tid uuid,p_eid uuid,p_source jsonb)
returns boolean language plpgsql stable security definer set search_path=''as $$declare v app.playoff_outcome_versions_v4%rowtype;digest text;begin
 if p_source->>'kind'is distinct from'playoff_outcome_v4'then return app.settlement_source_current_pre_five_v5(p_tid,p_eid,p_source);end if;
 if jsonb_typeof(p_source)is distinct from'object'or(select count(*)from jsonb_object_keys(p_source))<>3 or not(p_source?&array['kind','resultId','qualificationResultVersionId'])then return false;end if;
 begin select*into v from app.playoff_outcome_versions_v4 where id=(p_source->>'resultId')::uuid and tournament_id=p_tid and event_id=p_eid and qualification_result_version_id=(p_source->>'qualificationResultVersionId')::uuid;
 exception when invalid_text_representation then return false;end;
 if v.id is null or exists(select 1 from app.playoff_outcome_versions_v4 n where n.event_id=p_eid and n.version>v.version)then return false;end if;
 digest:=app.five_qualifier_playoff_source_v4(p_tid,p_eid,v.qualification_result_version_id);
 return digest is not null and digest=v.source_digest and v.outcomes=app.derive_five_qualifier_playoff_v4(v.qualification_result_version_id,v.series);
end$$;
create or replace function app.canonical_settlement_mrp_v5(p_tournament_id uuid,p_event_id uuid,p_source jsonb)
returns jsonb language plpgsql stable security definer set search_path=''as $$declare v app.playoff_outcome_versions_v4%rowtype;rows jsonb;
 blocked constant jsonb:='{"status":"blocked","sourceVersion":"acc-published-mrp-2016-08-01","effectiveDate":"2016-08-01","code":"mrp_evidence_correction_required"}';begin
 if p_source->>'kind'is distinct from'playoff_outcome_v4'then return app.canonical_settlement_mrp_pre_five_v5(p_tournament_id,p_event_id,p_source);end if;
 if app.settlement_source_current_v5(p_tournament_id,p_event_id,p_source)is distinct from true then return blocked;end if;
 select*into v from app.playoff_outcome_versions_v4 where id=(p_source->>'resultId')::uuid and tournament_id=p_tournament_id and event_id=p_event_id;
 select jsonb_agg(jsonb_build_object('participantId',r.participant_id,'displayName',r.display_name_snapshot,'qualificationRank',r.ranking_ordinal,'gamePoints',r.game_points,
 'qualifyingMrp',o->'qualifyingMrp','playoffMrp',o->'playoffMrp','totalMrp',o->'totalMrp','playedMatchWins',o->'playedMatchWins','byeWins',o->'byeWins','eliminatedInRound',o->'eliminatedInRound','bandStart',o->'bandStart','bandEnd',o->'bandEnd',
 'evidenceNote','ACC published MRP schedule effective2016-08-01; first-round bye credit is separate from played series')order by r.ranking_ordinal)into rows
 from jsonb_array_elements(app.derive_five_qualifier_playoff_v4(v.qualification_result_version_id,v.series))o
 join app.qualification_result_rows r on r.result_version_id=v.qualification_result_version_id and r.participant_id=(o->>'participantId')::uuid;
 if jsonb_array_length(rows)is distinct from 5 then return blocked;end if;
 return jsonb_build_object('status','available','sourceVersion','acc-published-mrp-2016-08-01','effectiveDate','2016-08-01','bracketSourceVersion','acc-rulebook-2025-effective-2025-08-01','rows',rows);
end$$;
revoke all on function app.canonical_settlement_mrp_v5(uuid,uuid,jsonb),app.canonical_settlement_mrp_pre_five_v5(uuid,uuid,jsonb),app.settlement_source_current_v5(uuid,uuid,jsonb),app.settlement_source_current_pre_five_v5(uuid,uuid,jsonb)from public,anon,authenticated,service_role;
commit;
