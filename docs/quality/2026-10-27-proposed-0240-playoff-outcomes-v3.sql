-- WITHDRAWN DESIGN — DO NOT REGISTER OR APPLY. Preserved only for prior isolated-test evidence.
-- Database-wide legacy/settlement revocations below are rejected compatibility behavior.
-- See 2026-10-27-playoff-compatibility-revision.md; no replacement rollout is approved.
-- Compatible app first. Source: ACC 2025 Rule13; MainMRPs effective2016-08-01.
-- Bounded first version: four qualifiers, Standard Main,12games,no byes.
create table app.playoff_outcome_versions_v3 (
 id uuid primary key,
 tournament_id uuid not null,
 event_id uuid not null,
 qualification_result_version_id uuid not null,
 version integer not null check(version>0),
 supersedes_id uuid,
 series jsonb not null check(jsonb_typeof(series)='array' and jsonb_array_length(series)=3),
 outcomes jsonb not null check(jsonb_typeof(outcomes)='array' and jsonb_array_length(outcomes)=4),
 bracket_source_version text not null check(bracket_source_version='acc-rulebook-2025-effective-2025-08-01'),
 mrp_source_version text not null check(mrp_source_version='acc-published-mrp-2016-08-01'),
 recorded_by uuid not null references app.profiles(id) on delete restrict,
 operation_receipt_id uuid not null,
 recorded_at timestamptz not null,
 foreign key(qualification_result_version_id,tournament_id,event_id) references app.qualification_result_versions(id,tournament_id,event_id) on delete restrict,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
 unique(event_id,version),unique(id,tournament_id,event_id),
 foreign key(supersedes_id,tournament_id,event_id) references app.playoff_outcome_versions_v3(id,tournament_id,event_id) on delete restrict
);
alter table app.playoff_outcome_versions_v3 enable row level security;
alter table app.playoff_outcome_versions_v3 force row level security;
revoke all on app.playoff_outcome_versions_v3 from public,anon,authenticated,service_role;
create trigger playoff_outcome_versions_v3_immutable before update or delete on app.playoff_outcome_versions_v3 for each row execute function app.reject_immutable_history();
create index playoff_outcomes_v3_qualification_idx on app.playoff_outcome_versions_v3(qualification_result_version_id,tournament_id,event_id);
create index playoff_outcomes_v3_receipt_idx on app.playoff_outcome_versions_v3(operation_receipt_id,tournament_id);
create index playoff_outcomes_v3_supersedes_idx on app.playoff_outcome_versions_v3(supersedes_id,tournament_id,event_id);
create index playoff_outcomes_v3_actor_idx on app.playoff_outcome_versions_v3(recorded_by);

-- No client-supplied MRP, elimination band, prize order, source version or win count.
create function app.derive_four_player_playoff_v3(p_qualification_id uuid,p_series jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare qids uuid[]; qpoints integer[]; w0 uuid; l0 uuid; w1 uuid; l1 uuid; wf uuid; lf uuid;
 item jsonb; qid uuid; n integer; wins integer; elim integer; qp integer; pm integer; result jsonb:='[]'::jsonb;
begin
 select array_agg(participant_id order by ranking_ordinal),array_agg(game_points order by ranking_ordinal)
 into qids,qpoints from app.qualification_result_rows
 where result_version_id=p_qualification_id and qualification_status='qualified' and not tied and numeric_rank=ranking_ordinal and verified_games=12;
 if cardinality(qids)<>4 or qpoints[1]<14 or qpoints[2]<14
   or (select count(*) from app.qualification_result_rows where result_version_id=p_qualification_id and qualification_status='qualified' and ranking_ordinal between 1 and 4)<>4 then return null; end if;
 if p_series is null or jsonb_typeof(p_series)<>'array' then return null; end if;
 if jsonb_array_length(p_series)<>3 then return null; end if;
 for item in select value from jsonb_array_elements(p_series) loop
   if jsonb_typeof(item)<>'object' then return null; end if;
   if (select count(*) from jsonb_object_keys(item))<>3 or not(item ?& array['winnerId','loserId','evidenceNote']) then return null; end if;
   if jsonb_typeof(item->'winnerId')<>'string' or jsonb_typeof(item->'loserId')<>'string' or jsonb_typeof(item->'evidenceNote')<>'string'
     or (item->>'winnerId')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     or (item->>'loserId')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     or length(item->>'evidenceNote') not between 1 and 200 or trim(item->>'evidenceNote')<>item->>'evidenceNote'
     or length(trim(item->>'evidenceNote'))=0 then return null; end if;
 end loop;
 w0:=(p_series->0->>'winnerId')::uuid;l0:=(p_series->0->>'loserId')::uuid;
 w1:=(p_series->1->>'winnerId')::uuid;l1:=(p_series->1->>'loserId')::uuid;
 wf:=(p_series->2->>'winnerId')::uuid;lf:=(p_series->2->>'loserId')::uuid;
 if w0=l0 or w1=l1 or wf=lf
   or not(w0=any(array[qids[1],qids[4]]) and l0=any(array[qids[1],qids[4]]))
   or not(w1=any(array[qids[2],qids[3]]) and l1=any(array[qids[2],qids[3]]))
   or not(wf=any(array[w0,w1]) and lf=any(array[w0,w1])) then return null; end if;
 for n in 1..4 loop
   qid:=qids[n];select count(*)::integer into wins from jsonb_array_elements(p_series) s where (s->>'winnerId')::uuid=qid;
   elim:=case when qid=wf then null when qid=lf then 2 else 1 end;
   qp:=case when n<=2 then 5*(qpoints[n]-14+1) else 5 end;
   pm:=7*(wins+1)*(wins+2)/2;
   result:=result||jsonb_build_array(jsonb_build_object('participantId',qid,'playedMatchWins',wins,'byeWins',0,
     'eliminatedInRound',elim,'champion',qid=wf,'bandStart',case when qid=wf then 1 when qid=lf then 2 else 3 end,
     'bandEnd',case when qid=wf then 1 when qid=lf then 2 else 4 end,'qualifyingMrp',qp,'playoffMrp',pm,'totalMrp',qp+pm));
 end loop;
 return result;
end $$;
revoke all on function app.derive_four_player_playoff_v3(uuid,jsonb) from public,anon,authenticated,service_role;

-- Shared reader/writer eligibility, independent of the submitted series.
create function app.playoff_outcome_blocker_v3(p_tournament_id uuid,p_event_id uuid,p_qualification_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare q app.qualification_result_versions%rowtype; ids uuid[]; capability_series jsonb;
begin
 if not exists(select 1 from app.tournaments where id=p_tournament_id and status='open') then return 'tournament_unavailable';end if;
 select * into q from app.qualification_result_versions where id=p_qualification_id and tournament_id=p_tournament_id and event_id=p_event_id;
 if not found or exists(select 1 from app.qualification_result_versions newer where newer.event_id=p_event_id and newer.version>q.version) then return 'qualification_unavailable';end if;
 if q.qualifier_count<>4 or not exists(select 1 from app.tournament_setup_activations a join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id join app.events e on e.id=a.event_id
   where a.tournament_id=p_tournament_id and a.event_id=p_event_id and s.event_kind='main' and s.format_code='standard_singles' and s.game_count=12 and e.operational_state='active' and e.format='standard_singles') then return 'unsupported_format';end if;
 if exists(select 1 from app.standard_singles_playoff_result_versions where event_id=p_event_id) then return 'legacy_conflict';end if;
 select array_agg(participant_id order by ranking_ordinal) into ids from app.qualification_result_rows where result_version_id=q.id and qualification_status='qualified';
 capability_series:=jsonb_build_array(jsonb_build_object('winnerId',ids[1],'loserId',ids[4],'evidenceNote','Capability validation only'),jsonb_build_object('winnerId',ids[2],'loserId',ids[3],'evidenceNote','Capability validation only'),jsonb_build_object('winnerId',ids[1],'loserId',ids[2],'evidenceNote','Capability validation only'));
 if app.derive_four_player_playoff_v3(q.id,capability_series) is null then return 'qualification_unavailable';end if;
 return null;
end $$;
revoke all on function app.playoff_outcome_blocker_v3(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.record_standard_singles_playoff_outcomes_v3(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,
 p_qualification_result_version_id uuid,p_expected_version integer,p_series jsonb,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing app.operation_receipts%rowtype; q app.qualification_result_versions%rowtype;
 tournament_status text; current_version integer; prior_id uuid; result_id uuid:=extensions.gen_random_uuid();
 receipt_id uuid:=extensions.gen_random_uuid(); stamp timestamptz:=clock_timestamp(); request_hash text;
 response jsonb; code text; derived jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server-only playoff outcomes'; end if;
 if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null then return jsonb_build_object('status','rejected','code','invalid_series','eventId',p_event_id); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('standard-singles-post-event:'||p_event_id::text,0));
 select status into tournament_status from app.tournaments where id=p_tournament_id for update;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable','eventId',p_event_id); end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director') for update;
 if not found then return jsonb_build_object('status','rejected','code','not_director','eventId',p_event_id); end if;
 request_hash:=encode(extensions.digest(convert_to(jsonb_build_array('record_standard_singles_playoff_outcomes_v3',p_actor_id,p_tournament_id,p_event_id,p_qualification_result_version_id,p_expected_version,p_series)::text,'utf8'),'sha256'),'hex');
 select * into existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
   if existing.tournament_id=p_tournament_id and existing.target_id=p_event_id and existing.operation_type='record_standard_singles_playoff_outcomes_v3' and existing.request_hash=request_hash then return existing.response_payload; end if;
   insert into app.standard_singles_playoff_result_conflicts(tournament_id,actor_profile_id,attempted_event_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code)
     values(p_tournament_id,p_actor_id,p_event_id,p_operation_id,request_hash,case when existing.tournament_id=p_tournament_id then existing.id end,'idempotency_conflict');
   insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
     values(p_tournament_id,p_actor_id,null,'playoff_outcome_v3',p_event_id,'playoff_outcomes_v3_conflict',jsonb_build_object('code','idempotency_conflict'));
   return jsonb_build_object('status','rejected','code','idempotency_conflict','eventId',p_event_id);
 end if;
 code:=app.playoff_outcome_blocker_v3(p_tournament_id,p_event_id,p_qualification_result_version_id);
 select * into q from app.qualification_result_versions where id=p_qualification_result_version_id and tournament_id=p_tournament_id and event_id=p_event_id;
 select coalesce(max(version),0) into current_version from app.playoff_outcome_versions_v3 where event_id=p_event_id;
 select id into prior_id from app.playoff_outcome_versions_v3 where event_id=p_event_id order by version desc limit 1;
 if code is null and (p_expected_version is null or p_expected_version<>current_version) then code:='stale_version'; end if;
 if code is null then derived:=app.derive_four_player_playoff_v3(q.id,p_series);if derived is null then code:='invalid_series';end if;end if;
 if code is not null then response:=jsonb_build_object('status','rejected','code',code,'eventId',p_event_id);
 else response:=jsonb_build_object('status','playoff_outcomes_recorded','tournamentId',p_tournament_id,'eventId',p_event_id,'resultId',result_id,'version',current_version+1,
   'bracketSourceVersion','acc-rulebook-2025-effective-2025-08-01','mrpSourceVersion','acc-published-mrp-2016-08-01','recordedAt',stamp);end if;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
   values(receipt_id,p_tournament_id,p_actor_id,'record_standard_singles_playoff_outcomes_v3',p_event_id,request_hash,p_operation_id,case when code is null then 'accepted' else 'rejected' end,response,stamp);
 if code is null then
   insert into app.playoff_outcome_versions_v3(id,tournament_id,event_id,qualification_result_version_id,version,supersedes_id,series,outcomes,bracket_source_version,mrp_source_version,recorded_by,operation_receipt_id,recorded_at)
     values(result_id,p_tournament_id,p_event_id,q.id,current_version+1,prior_id,p_series,derived,'acc-rulebook-2025-effective-2025-08-01','acc-published-mrp-2016-08-01',p_actor_id,receipt_id,stamp);
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
   values(p_tournament_id,p_actor_id,receipt_id,'playoff_outcome_v3',case when code is null then result_id else p_event_id end,
   case when code is null then 'playoff_outcomes_v3_recorded' else 'playoff_outcomes_v3_rejected' end,
   case when prior_id is null or code is not null then null else jsonb_build_object('supersedesId',prior_id) end,response);
 return response;
end $$;

create function public.get_standard_singles_playoff_outcome_workspace_v3(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q app.qualification_result_versions%rowtype; v app.playoff_outcome_versions_v3%rowtype;
 supported_format boolean; can_record boolean; legacy_conflict boolean; blocker text; ids uuid[]; validation_series jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server-only playoff outcomes';end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then return null;end if;
 select * into q from app.qualification_result_versions where tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;
 if not found then return null;end if;
 supported_format:=q.qualifier_count=4 and exists(select 1 from app.tournament_setup_activations a join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id join app.events e on e.id=a.event_id
   where a.tournament_id=p_tournament_id and a.event_id=p_event_id and s.event_kind='main' and s.format_code='standard_singles' and s.game_count=12 and e.operational_state='active' and e.format='standard_singles');
 legacy_conflict:=exists(select 1 from app.standard_singles_playoff_result_versions where event_id=p_event_id);
 select array_agg(participant_id order by ranking_ordinal) into ids from app.qualification_result_rows where result_version_id=q.id and qualification_status='qualified';
 validation_series:=jsonb_build_array(jsonb_build_object('winnerId',ids[1],'loserId',ids[4],'evidenceNote','Capability validation only'),jsonb_build_object('winnerId',ids[2],'loserId',ids[3],'evidenceNote','Capability validation only'),jsonb_build_object('winnerId',ids[1],'loserId',ids[2],'evidenceNote','Capability validation only'));
 blocker:=app.playoff_outcome_blocker_v3(p_tournament_id,p_event_id,q.id);
 can_record:=blocker is null;
 select * into v from app.playoff_outcome_versions_v3 where event_id=p_event_id order by version desc limit 1;
 return jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,'qualificationResultVersionId',q.id,'currentVersion',coalesce(v.version,0),
   'legacyConflict',legacy_conflict,'supported',can_record,'supportedFormat',supported_format,'canRecord',can_record,'blocker',blocker,
   'qualifiers',coalesce((select jsonb_agg(jsonb_build_object('participantId',participant_id,'displayName',display_name_snapshot,'qualificationRank',ranking_ordinal,'gamePoints',game_points) order by ranking_ordinal) from app.qualification_result_rows where result_version_id=q.id and qualification_status='qualified'),'[]'::jsonb),
   'result',case when v.id is null then null else jsonb_build_object('resultId',v.id,'version',v.version,'series',v.series,'outcomes',v.outcomes,'bracketSourceVersion',v.bracket_source_version,'mrpSourceVersion',v.mrp_source_version,'recordedAt',v.recorded_at) end,'capabilities',jsonb_build_object('settlement',false));
end $$;

create function public.get_standard_singles_playoff_outcome_reconciliation_v3(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare response jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'server-only playoff outcomes';end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then return null;end if;
 select response_payload into response from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id and tournament_id=p_tournament_id and target_id=p_event_id and operation_type='record_standard_singles_playoff_outcomes_v3';
 return jsonb_build_object('authorized',true,'result',response);
end $$;

revoke all on function public.record_standard_singles_playoff_outcomes_v3(uuid,uuid,uuid,uuid,integer,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_playoff_outcome_workspace_v3(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_standard_singles_playoff_outcome_reconciliation_v3(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.record_standard_singles_playoff_outcomes_v3(uuid,uuid,uuid,uuid,integer,jsonb,uuid) to service_role;
grant execute on function public.get_standard_singles_playoff_outcome_workspace_v3(uuid,uuid,uuid) to service_role;
grant execute on function public.get_standard_singles_playoff_outcome_reconciliation_v3(uuid,uuid,uuid,uuid) to service_role;
-- Retain v2 readers/reconciliation/history, but do not permit two current write domains.
revoke execute on function public.record_standard_singles_playoff_placements_v1(uuid,uuid,uuid,uuid,integer,jsonb,uuid) from service_role;
revoke execute on function public.record_standard_singles_playoff_placements_v2(uuid,uuid,uuid,uuid,integer,jsonb,uuid) from service_role;
-- Known ambiguous legacy MRP cannot authorize NEW settlement claims/finalizations.
-- Historical readers and reconciliation functions retain their existing grants.
do $$ declare routine record; begin
 for routine in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in ('save_standard_singles_settlement_draft_v1','save_standard_singles_settlement_draft_v2','save_standard_singles_settlement_draft_v3','save_standard_singles_settlement_draft_v4','finalize_standard_singles_settlement_manual_v1') loop
   execute format('revoke execute on function %s from service_role',routine.signature);
 end loop;
end $$;
notify pgrst,'reload schema';
