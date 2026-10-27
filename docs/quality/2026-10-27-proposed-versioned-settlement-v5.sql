-- LOCAL ONLY: expanded reviewed redesign; not registered/applied. Retains legacy grants.
do $$ begin
 if current_user<>'postgres' then raise exception 'Reviewed postgres migration owner required';end if;
 if to_regclass('app.playoff_outcome_versions_v3')is not null then raise exception 'Existing playoff v3 schema requires explicit version reconciliation';end if;
 if not has_function_privilege('service_role','public.record_standard_singles_playoff_placements_v2(uuid,uuid,uuid,uuid,integer,jsonb,uuid)','EXECUTE')or not has_function_privilege('service_role','public.save_standard_singles_settlement_draft_v4(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,uuid)','EXECUTE')then raise exception 'Legacy grants differ from reviewed compatibility baseline';end if;
end $$;
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
 -- EXECUTE grants are the server-only boundary; actor authorization remains below.
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
 -- EXECUTE grants are the server-only boundary; actor authorization remains below.
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
 -- EXECUTE grants are the server-only boundary; actor authorization remains below.
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

create unique index playoff_outcome_v3_qualification_scope on app.playoff_outcome_versions_v3(id,tournament_id,event_id,qualification_result_version_id);

create or replace function app.canonical_settlement_mrp_v5(p_tournament_id uuid,p_event_id uuid,p_source jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q app.qualification_result_versions%rowtype; kind text; games integer; fmt text; n integer; depth integer; scale integer; playoff_scale integer; threshold integer; rows jsonb; source_id uuid; qid uuid;
 blocked constant jsonb:='{"status":"blocked","sourceVersion":"acc-published-mrp-2016-08-01","effectiveDate":"2016-08-01","code":"mrp_evidence_correction_required"}'::jsonb;
begin
 if p_source is null or jsonb_typeof(p_source)<>'object' or (select count(*)from jsonb_object_keys(p_source))<>3 or not(p_source ?& array['kind','resultId','qualificationResultVersionId']) then return blocked;end if;
 begin source_id:=(p_source->>'resultId')::uuid;qid:=(p_source->>'qualificationResultVersionId')::uuid;exception when invalid_text_representation then return blocked;end;
 select * into q from app.qualification_result_versions where id=qid and tournament_id=p_tournament_id and event_id=p_event_id;
 if not found then return blocked;end if;
 select e.event_kind,e.game_count,e.format_code into kind,games,fmt from app.tournament_setup_activations a join app.tournament_setup_event_versions e on e.id=a.setup_event_version_id where a.tournament_id=p_tournament_id and a.event_id=p_event_id;
 if fmt<>'standard_singles' or kind not in('main','consolation') then return blocked;end if;
 if kind='main' then scale:=5;playoff_scale:=7;threshold:=case games when 12 then 14 when 14 then 17 when 16 then 20 when 18 then 22 when 20 then 25 when 21 then 26 when 22 then 27 end;
 else scale:=3;playoff_scale:=4;threshold:=case games when 7 then 9 when 8 then 11 when 9 then 12 when 10 then 13 when 12 then 16 end;end if;
 if threshold is null then return blocked;end if;
 n:=q.qualifier_count;
 if n<4 or n>256 or exists(select 1 from app.qualification_result_rows r where r.result_version_id=q.id and r.qualification_status='qualified' and (r.tied or r.numeric_rank<>r.ranking_ordinal or (r.ranking_ordinal<=ceil(n::numeric/2) and r.game_points<threshold))) then return blocked;end if;
 if p_source->>'kind'='playoff_outcome_v3' then
  select jsonb_agg(jsonb_build_object('participantId',r.participant_id,'displayName',r.display_name_snapshot,'qualificationRank',r.ranking_ordinal,'gamePoints',r.game_points,
    'qualifyingMrp',(o.item->>'qualifyingMrp')::integer,'playoffMrp',(o.item->>'playoffMrp')::integer,'totalMrp',(o.item->>'totalMrp')::integer,'playedMatchWins',(o.item->>'playedMatchWins')::integer,'byeWins',(o.item->>'byeWins')::integer,'eliminatedInRound',o.item->'eliminatedInRound','bandStart',(o.item->>'bandStart')::integer,'bandEnd',(o.item->>'bandEnd')::integer,'evidenceNote','ACC published MRP schedule effective 2016-08-01') order by r.ranking_ordinal)
  into rows from app.playoff_outcome_versions_v3 v cross join lateral jsonb_array_elements(app.derive_four_player_playoff_v3(q.id,v.series)) o(item)
  join app.qualification_result_rows r on r.result_version_id=q.id and r.participant_id=(o.item->>'participantId')::uuid
  where v.id=source_id and v.tournament_id=p_tournament_id and v.event_id=p_event_id and v.qualification_result_version_id=q.id;
 elsif p_source->>'kind'='legacy_placement_v2' then
  if (n & (n-1))<>0 then return blocked;end if;depth:=round(log(2,n))::integer;
  if not exists(select 1 from app.standard_singles_playoff_result_versions v where v.id=source_id and v.tournament_id=p_tournament_id and v.event_id=p_event_id and v.qualification_result_version_id=q.id and v.placement_count=n and exists(select 1 from app.operation_receipts receipt where receipt.id=v.operation_receipt_id and receipt.operation_type='record_standard_singles_playoff_placements_v2'))
    or (select count(*)from app.standard_singles_playoff_placement_rows r where r.playoff_result_version_id=source_id)<>n
    or exists(select 1 from app.standard_singles_playoff_placement_rows r left join app.qualification_result_rows qr on qr.result_version_id=q.id and qr.participant_id=r.participant_id and qr.qualification_status='qualified'
      where r.playoff_result_version_id=source_id and (qr.participant_id is null or r.mrp_playoff_exit_round is null or (r.placement=1 and r.mrp_playoff_exit_round not in(depth,depth+1)) or (r.placement<>1 and r.mrp_playoff_exit_round not between 1 and depth)))
    or (select count(*)from app.standard_singles_playoff_placement_rows where playoff_result_version_id=source_id and placement=1)<>1
    or exists(select 1 from generate_series(1,depth) round_no where (select count(*)from app.standard_singles_playoff_placement_rows where playoff_result_version_id=source_id and placement<>1 and mrp_playoff_exit_round=round_no)<>n/(2^round_no)::integer)
   then return blocked;end if;
  select jsonb_agg(jsonb_build_object('participantId',r.participant_id,'displayName',r.display_name_snapshot,'qualificationRank',r.ranking_ordinal,'gamePoints',r.game_points,
   'qualifyingMrp',case when r.ranking_ordinal<=ceil(n::numeric/2) then scale*(r.game_points-threshold+1) else scale end,
   'playoffMrp',playoff_scale*c.credit*(c.credit+1)/2,'playedMatchWins',c.credit-1,'byeWins',0,'eliminatedInRound',case when p.placement=1 then null else p.mrp_playoff_exit_round end,'bandStart',case when p.placement=1 then 1 else n/(2^p.mrp_playoff_exit_round)::integer+1 end,'bandEnd',case when p.placement=1 then 1 else n/(2^(p.mrp_playoff_exit_round-1))::integer end,
   'totalMrp',(case when r.ranking_ordinal<=ceil(n::numeric/2) then scale*(r.game_points-threshold+1) else scale end)+playoff_scale*c.credit*(c.credit+1)/2,
   'evidenceNote','ACC published MRP schedule effective 2016-08-01') order by r.ranking_ordinal)
  into rows from app.standard_singles_playoff_placement_rows p join app.qualification_result_rows r on r.result_version_id=q.id and r.participant_id=p.participant_id
  cross join lateral(select case when p.placement=1 then depth+1 else p.mrp_playoff_exit_round end credit)c where p.playoff_result_version_id=source_id;
 else return blocked;end if;
 if rows is null or jsonb_array_length(rows)<>n then return blocked;end if;
 return jsonb_build_object('status','available','sourceVersion','acc-published-mrp-2016-08-01','effectiveDate','2016-08-01','bracketSourceVersion',case when p_source->>'kind'='legacy_placement_v2'then'legacy-complete-no-bye-v2'else'acc-rulebook-2025-effective-2025-08-01'end,'rows',rows);
end $$;
revoke all on function app.canonical_settlement_mrp_v5(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

-- Same reader signature; historical rows stay raw, only the explicitly derived display changes.
create or replace function app.standard_singles_automatic_mrps_v1(p_tournament_id uuid,p_event_id uuid,p_qualification_result_version_id uuid,p_playoff_result_version_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 with canonical as(select app.canonical_settlement_mrp_v5(p_tournament_id,p_event_id,jsonb_build_object('kind','legacy_placement_v2','resultId',p_playoff_result_version_id,'qualificationResultVersionId',p_qualification_result_version_id))v)select case when v->>'status'='blocked' then v else (v-'bracketSourceVersion')||jsonb_build_object('rows',(select jsonb_agg(item-'playedMatchWins'-'byeWins'-'eliminatedInRound'-'bandStart'-'bandEnd')from jsonb_array_elements(v->'rows')item))end from canonical;
$$;

create or replace function app.settlement_ledger_v5(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 with payments as(select distinct on(roster_entry_id)*from app.roster_payment_events where tournament_id=p_tournament_id order by roster_entry_id,version desc),
 expenses as(select distinct on(expense_id)*from app.tournament_expense_events where tournament_id=p_tournament_id order by expense_id,version desc)
 select jsonb_build_object('paymentCount',(select count(*)from payments where event_type='received'),'paymentTotalMinor',(select coalesce(sum(amount_minor),0)from payments where event_type='received'),
 'expenseCount',(select count(*)from expenses where event_type='recorded'),'expenseTotalMinor',(select coalesce(sum(amount_minor),0)from expenses where event_type='recorded'),
 'paymentIds',(select coalesce(jsonb_agg(id order by id),'[]')from payments where event_type='received'),'expenseIds',(select coalesce(jsonb_agg(id order by id),'[]')from expenses where event_type='recorded'));
$$;
revoke all on function app.settlement_ledger_v5(uuid) from public,anon,authenticated,service_role;

create table app.event_settlement_drafts_v5(
 id uuid primary key,tournament_id uuid not null references app.tournaments(id),event_id uuid not null,
 qualification_result_version_id uuid not null,source_kind text not null check(source_kind in('legacy_placement_v2','playoff_outcome_v3')),
 legacy_result_id uuid,outcome_result_id uuid,prior_legacy_draft_id uuid references app.standard_singles_settlement_drafts(id),sanctioning_expense_event_id uuid references app.tournament_expense_events(id),version integer not null check(version>0),supersedes_id uuid,
 request_payload jsonb not null,canonical_mrp jsonb not null,ledger_snapshot jsonb not null,recorded_by uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null,
 check((source_kind='legacy_placement_v2' and legacy_result_id is not null and outcome_result_id is null)or(source_kind='playoff_outcome_v3' and outcome_result_id is not null and legacy_result_id is null)),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(legacy_result_id,tournament_id,event_id,qualification_result_version_id)references app.standard_singles_playoff_result_versions(id,tournament_id,event_id,qualification_result_version_id),
 foreign key(outcome_result_id,tournament_id,event_id,qualification_result_version_id)references app.playoff_outcome_versions_v3(id,tournament_id,event_id,qualification_result_version_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(event_id,version),unique(id,tournament_id,event_id),foreign key(supersedes_id,tournament_id,event_id)references app.event_settlement_drafts_v5(id,tournament_id,event_id)
);
create table app.event_settlement_finals_v2(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,draft_id uuid not null,prior_legacy_final_id uuid references app.standard_singles_settlement_final_versions(id),version integer not null check(version>0),supersedes_id uuid,
 attestations jsonb not null,recorded_by uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null,
 foreign key(draft_id,tournament_id,event_id)references app.event_settlement_drafts_v5(id,tournament_id,event_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(event_id,version),unique(id,tournament_id,event_id),foreign key(supersedes_id,tournament_id,event_id)references app.event_settlement_finals_v2(id,tournament_id,event_id)
);
create table app.event_settlement_conflicts_v5(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null references app.tournaments(id),event_id uuid not null,actor_id uuid not null references app.profiles(id),operation_id uuid not null,attempted_request_hash text not null check(length(attempted_request_hash)=64),reason_code text not null check(reason_code='idempotency_conflict'),prior_receipt_id uuid references app.operation_receipts(id),created_at timestamptz not null default clock_timestamp()
);
do $$ declare table_name text;begin foreach table_name in array array['event_settlement_drafts_v5','event_settlement_finals_v2','event_settlement_conflicts_v5'] loop
 execute format('alter table app.%I enable row level security',table_name);execute format('alter table app.%I force row level security',table_name);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',table_name);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',table_name||'_immutable',table_name);
 end loop;end $$;
create index settlement_v5_source_legacy_idx on app.event_settlement_drafts_v5(legacy_result_id);
create index settlement_v5_source_outcome_idx on app.event_settlement_drafts_v5(outcome_result_id);
create index settlement_v5_receipt_idx on app.event_settlement_drafts_v5(operation_receipt_id);
create index settlement_v2_final_receipt_idx on app.event_settlement_finals_v2(operation_receipt_id);

create or replace function app.settlement_source_current_v5(p_tid uuid,p_eid uuid,p_source jsonb)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.qualification_result_versions q where q.id=(p_source->>'qualificationResultVersionId')::uuid and q.tournament_id=p_tid and q.event_id=p_eid and not exists(select 1 from app.qualification_result_versions newer where newer.event_id=q.event_id and newer.version>q.version))
 and case p_source->>'kind' when 'legacy_placement_v2' then exists(select 1 from app.standard_singles_playoff_result_versions v join app.operation_receipts r on r.id=v.operation_receipt_id where v.id=(p_source->>'resultId')::uuid and v.tournament_id=p_tid and v.event_id=p_eid and v.qualification_result_version_id=(p_source->>'qualificationResultVersionId')::uuid and r.operation_type='record_standard_singles_playoff_placements_v2' and not exists(select 1 from app.standard_singles_playoff_result_versions newer where newer.event_id=v.event_id and newer.version>v.version))
 when 'playoff_outcome_v3' then exists(select 1 from app.playoff_outcome_versions_v3 v where v.id=(p_source->>'resultId')::uuid and v.tournament_id=p_tid and v.event_id=p_eid and v.qualification_result_version_id=(p_source->>'qualificationResultVersionId')::uuid and not exists(select 1 from app.playoff_outcome_versions_v3 newer where newer.event_id=v.event_id and newer.version>v.version)) else false end;
$$;
revoke all on function app.settlement_source_current_v5(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create or replace function app.settlement_award_blocked_v5(p_tid uuid,p_eid uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.tournament_setup_activations a join app.tournament_setup_q_pool_versions p on p.setup_event_version_id=a.setup_event_version_id where a.tournament_id=p_tid and a.event_id=p_eid and p.entry_fee_cents>0)
 or exists(select 1 from app.standard_singles_settlement_awards a join app.standard_singles_settlement_drafts d on d.id=a.settlement_draft_id where a.tournament_id=p_tid and a.event_id=p_eid and a.amount_minor>0 and not exists(select 1 from app.standard_singles_settlement_drafts newer where newer.event_id=d.event_id and newer.version>d.version));
$$;
revoke all on function app.settlement_award_blocked_v5(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function app.write_event_settlement_v5(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt app.operation_receipts%rowtype;draft app.event_settlement_drafts_v5%rowtype; response jsonb; code text; hash text; stamp timestamptz:=clock_timestamp(); rid uuid:=extensions.gen_random_uuid();result_id uuid:=extensions.gen_random_uuid();prior uuid;version_no integer;status_value text;mrp jsonb;ledger jsonb;source jsonb;item jsonb;claims_total bigint;other_income bigint;other_expense bigint;op text;authorized boolean:=false;
 required_attestations constant jsonb:='{"expenseLedgerReviewed":true,"mrpClaimsReviewed":true,"noAutomaticAccSubmission":true,"officialSourceReviewed":true,"payoutClaimsReviewed":true,"noQPoolClaimsRecorded":true}'::jsonb;
begin
 op:=case when p_action='draft' then 'save_event_settlement_draft_v5' when p_action='final' then 'finalize_event_settlement_v2' else null end;
 if op is null or p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','invalid_request');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('standard-singles-post-event:'||p_event_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('settlement:'||p_event_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('settlement-domain:'||p_event_id::text,0));
 select status into status_value from app.tournaments where id=p_tournament_id for update;
 if not found then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director') for update;
 if not found then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','not_director');end if;authorized:=true;
 if not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id) then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','source_unavailable');end if;
 hash:=encode(extensions.digest(convert_to(jsonb_build_array(op,p_actor_id,p_tournament_id,p_event_id,p_request)::text,'utf8'),'sha256'),'hex');
 select *into receipt from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
  if receipt.tournament_id=p_tournament_id and receipt.target_id=p_event_id and receipt.operation_type=op and receipt.request_hash=hash then return receipt.response_payload;end if;
  insert into app.event_settlement_conflicts_v5(tournament_id,event_id,actor_id,operation_id,attempted_request_hash,reason_code,prior_receipt_id)values(p_tournament_id,p_event_id,p_actor_id,p_operation_id,hash,'idempotency_conflict',case when receipt.tournament_id=p_tournament_id then receipt.id end);
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,'event_settlement_v5',p_event_id,'settlement_idempotency_conflict',jsonb_build_object('operationId',p_operation_id));
  return jsonb_build_object('status','rejected','eventId',p_event_id,'code','idempotency_conflict');
 end if;
 begin
  if status_value not in('open','pending_finalization') then raise exception 'tournament_unavailable';end if;
  if not app.valid_settlement_request_v5(p_request,p_action)then raise exception 'invalid_request';end if;
  ledger:=app.settlement_ledger_v5(p_tournament_id);
  if p_action='draft' then
   if (select count(*)from jsonb_object_keys(p_request))<>8 or not(p_request ?& array['source','expectedVersion','prizeClaims','eventIncomeMinor','eventExpenseMinor','retainedBalanceMinor','officialSourceReference','sanctioningExpenseEventId']) then raise exception 'invalid_request';end if;
   -- Exact eight-field versioned request; financial source binding is explicit.
   if p_request->'sanctioningExpenseEventId'<>'null'::jsonb and not exists(select 1 from app.tournament_expense_events e where e.id=(p_request->>'sanctioningExpenseEventId')::uuid and e.tournament_id=p_tournament_id and e.event_type='recorded' and not exists(select 1 from app.tournament_expense_events newer where newer.expense_id=e.expense_id and newer.version>e.version))then raise exception 'sanctioning_assessment_evidence_unavailable';end if;
   if (p_request->>'expectedVersion')!~'^(0|[1-9][0-9]*)$' then raise exception 'invalid_request';end if;
   source:=p_request->'source';if app.settlement_source_current_v5(p_tournament_id,p_event_id,source)is distinct from true then raise exception 'source_unavailable';end if;
   if jsonb_typeof(p_request->'prizeClaims')<>'array' or jsonb_array_length(p_request->'prizeClaims')>256 then raise exception 'invalid_claims';end if;
   claims_total:=0;
   for item in select value from jsonb_array_elements(p_request->'prizeClaims')loop
    if jsonb_typeof(item)<>'object' or (select count(*)from jsonb_object_keys(item))<>4 or not(item ?& array['participantId','amountMinor','prizeOrder','note'])
     or (item->>'amountMinor')!~'^(0|[1-9][0-9]*)$' or (item->>'amountMinor')::numeric>9007199254740991
     or not(item->'prizeOrder'='null'::jsonb or ((item->>'prizeOrder')~'^[1-9][0-9]*$' and (item->>'prizeOrder')::numeric<=256))
     or length(trim(item->>'note'))not between 1 and 500 or (item->>'note')<>trim(item->>'note') or (item->>'note')~'[[:cntrl:]]'
     or not exists(select 1 from app.qualification_result_rows q where q.result_version_id=(source->>'qualificationResultVersionId')::uuid and q.participant_id=(item->>'participantId')::uuid and q.qualification_status='qualified') then raise exception 'invalid_claims';end if;
    claims_total:=claims_total+(item->>'amountMinor')::bigint;
   end loop;
   if (select count(distinct value->>'participantId')from jsonb_array_elements(p_request->'prizeClaims'))<>jsonb_array_length(p_request->'prizeClaims') then raise exception 'invalid_claims';end if;
   if exists(select 1 from jsonb_array_elements(p_request->'prizeClaims')a join jsonb_array_elements(p_request->'prizeClaims')b on a.value->>'participantId'<>b.value->>'participantId' and a.value->'prizeOrder'=b.value->'prizeOrder' where a.value->'prizeOrder'<>'null'::jsonb)then raise exception 'invalid_claims';end if;
   foreach code in array array['eventIncomeMinor','eventExpenseMinor','retainedBalanceMinor']loop if (p_request->>code)!~'^(0|[1-9][0-9]*)$' or (p_request->>code)::numeric>9007199254740991 then raise exception 'invalid_request';end if;end loop;code:=null;
   if length(trim(p_request->>'officialSourceReference'))not between 1 and 500 or (p_request->>'officialSourceReference')<>trim(p_request->>'officialSourceReference') or (p_request->>'officialSourceReference')~'[[:cntrl:]]' then raise exception 'invalid_request';end if;
   select greatest(coalesce((select max(version)from app.event_settlement_drafts_v5 where event_id=p_event_id),0),coalesce((select max(version)from app.standard_singles_settlement_drafts where event_id=p_event_id),0)) into version_no;
   if (p_request->>'expectedVersion')::integer<>version_no then raise exception 'stale_version';end if;
   select id into prior from app.event_settlement_drafts_v5 where event_id=p_event_id order by version desc limit 1;
   mrp:=app.canonical_settlement_mrp_v5(p_tournament_id,p_event_id,source);
   version_no:=version_no+1;
   response:=jsonb_build_object('status','settlement_draft_saved_v5','tournamentId',p_tournament_id,'eventId',p_event_id,'draftId',result_id,'version',version_no);
  else
   if (select count(*)from jsonb_object_keys(p_request))<>4 or not(p_request ?& array['draftId','draftVersion','expectedVersion','attestations'])or p_request->'attestations' is distinct from required_attestations then raise exception 'invalid_request';end if;
   select *into draft from app.event_settlement_drafts_v5 where id=(p_request->>'draftId')::uuid and tournament_id=p_tournament_id and event_id=p_event_id and version=(p_request->>'draftVersion')::integer;
   if not found or exists(select 1 from app.event_settlement_drafts_v5 where event_id=p_event_id and version>draft.version)then raise exception 'stale_version';end if;
   source:=draft.request_payload->'source';if app.settlement_source_current_v5(p_tournament_id,p_event_id,source)is distinct from true then raise exception 'source_unavailable';end if;
   mrp:=app.canonical_settlement_mrp_v5(p_tournament_id,p_event_id,source);
   if mrp->>'status'<>'available' or mrp is distinct from draft.canonical_mrp then raise exception 'mrp_evidence_correction_required';end if;
   if ledger is distinct from draft.ledger_snapshot then raise exception 'ledger_snapshot_changed';end if;
   if app.settlement_award_blocked_v5(p_tournament_id,p_event_id)then raise exception 'unsupported_award_obligations';end if;
   if exists(select 1 from app.event_disputes where tournament_id=p_tournament_id and event_id=p_event_id and app.event_dispute_is_open(id))then raise exception 'event_dispute_unresolved';end if;
   if app.settlement_assessment_v5(p_event_id)is null then raise exception 'sanctioning_assessment_unavailable';end if;
   if app.settlement_assessment_v5(p_event_id)>0 then
    if draft.sanctioning_expense_event_id is null then raise exception 'sanctioning_assessment_unfunded';end if;
    if not exists(select 1 from app.tournament_expense_events e where e.id=draft.sanctioning_expense_event_id and e.tournament_id=p_tournament_id and e.event_type='recorded' and e.amount_minor>=app.settlement_assessment_v5(p_event_id)and not exists(select 1 from app.tournament_expense_events newer where newer.expense_id=e.expense_id and newer.version>e.version))or(draft.request_payload->>'eventExpenseMinor')::bigint<app.settlement_assessment_v5(p_event_id)then raise exception 'sanctioning_assessment_evidence_unavailable';end if;
    if exists(select 1 from app.event_settlement_finals_v2 f join app.event_settlement_drafts_v5 d on d.id=f.draft_id where f.tournament_id=p_tournament_id and f.event_id<>p_event_id and d.sanctioning_expense_event_id=draft.sanctioning_expense_event_id and not exists(select 1 from app.event_settlement_finals_v2 newer where newer.event_id=f.event_id and newer.version>f.version))then raise exception 'ledger_allocation_exceeded';end if;
   end if;
   if not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id and operational_state='active')or not exists(select 1 from app.cross_check_finalizations where tournament_id=p_tournament_id)or app.cross_check_finalization_conditions_v1(p_tournament_id)is null or exists(select 1 from jsonb_array_elements(app.cross_check_finalization_conditions_v1(p_tournament_id))c where(c->>'outstanding')::boolean)then raise exception 'crosscheck_incomplete';end if;
   select coalesce(sum((value->>'amountMinor')::bigint),0)into claims_total from jsonb_array_elements(draft.request_payload->'prizeClaims');
   if (draft.request_payload->>'eventIncomeMinor')::bigint<>(draft.request_payload->>'eventExpenseMinor')::bigint+claims_total+(draft.request_payload->>'retainedBalanceMinor')::bigint then raise exception 'non_conserving_ledger';end if;
   with all_finals as(select f.event_id,f.version,f.event_income_minor income,f.event_expense_minor expense from app.standard_singles_settlement_final_versions f where f.tournament_id=p_tournament_id and f.event_id<>p_event_id
    union all select f.event_id,f.version,(d.request_payload->>'eventIncomeMinor')::bigint,(d.request_payload->>'eventExpenseMinor')::bigint from app.event_settlement_finals_v2 f join app.event_settlement_drafts_v5 d on d.id=f.draft_id where f.tournament_id=p_tournament_id and f.event_id<>p_event_id), latest as(select distinct on(event_id)*from all_finals order by event_id,version desc)
    select coalesce(sum(income),0),coalesce(sum(expense),0)into other_income,other_expense from latest;
   if other_income+(draft.request_payload->>'eventIncomeMinor')::bigint>(ledger->>'paymentTotalMinor')::bigint or other_expense+(draft.request_payload->>'eventExpenseMinor')::bigint>(ledger->>'expenseTotalMinor')::bigint then raise exception 'ledger_allocation_exceeded';end if;
   select greatest(coalesce((select max(version)from app.event_settlement_finals_v2 where event_id=p_event_id),0),coalesce((select max(version)from app.standard_singles_settlement_final_versions where event_id=p_event_id),0))into version_no;
   if (p_request->>'expectedVersion')::integer<>version_no then raise exception 'stale_version';end if;
   select id into prior from app.event_settlement_finals_v2 where event_id=p_event_id order by version desc limit 1;version_no:=version_no+1;
   response:=jsonb_build_object('status','settlement_finalized_v2','tournamentId',p_tournament_id,'eventId',p_event_id,'finalizationId',result_id,'version',version_no,'draftId',draft.id);
  end if;
 exception when sqlstate 'P0001' then
  code:=case when sqlerrm in('tournament_unavailable','invalid_request','source_unavailable','stale_version','invalid_claims','mrp_evidence_correction_required','ledger_snapshot_changed','unsupported_award_obligations','event_dispute_unresolved','crosscheck_incomplete','non_conserving_ledger','ledger_allocation_exceeded','settlement_domain_conflict','sanctioning_assessment_unfunded','sanctioning_assessment_unavailable','sanctioning_assessment_evidence_unavailable')then sqlerrm else null end;
  if code is null then raise;end if;
  response:=jsonb_build_object('status','rejected','eventId',p_event_id,'code',code);
 end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(rid,p_tournament_id,p_actor_id,op,p_event_id,hash,p_operation_id,case when code is null then 'accepted' else 'rejected' end,response,stamp);
 if code is null and p_action='draft' then
  insert into app.event_settlement_drafts_v5(id,tournament_id,event_id,qualification_result_version_id,source_kind,legacy_result_id,outcome_result_id,prior_legacy_draft_id,sanctioning_expense_event_id,version,supersedes_id,request_payload,canonical_mrp,ledger_snapshot,recorded_by,operation_receipt_id,recorded_at)
  values(result_id,p_tournament_id,p_event_id,(source->>'qualificationResultVersionId')::uuid,source->>'kind',case when source->>'kind'='legacy_placement_v2'then (source->>'resultId')::uuid end,case when source->>'kind'='playoff_outcome_v3'then(source->>'resultId')::uuid end,case when prior is null then(select id from app.standard_singles_settlement_drafts where event_id=p_event_id order by version desc limit 1)end,(p_request->>'sanctioningExpenseEventId')::uuid,version_no,prior,p_request,mrp,ledger,p_actor_id,rid,stamp);
 elsif code is null then insert into app.event_settlement_finals_v2(id,tournament_id,event_id,draft_id,prior_legacy_final_id,version,supersedes_id,attestations,recorded_by,operation_receipt_id,recorded_at)values(result_id,p_tournament_id,p_event_id,draft.id,case when prior is null then(select id from app.standard_singles_settlement_final_versions where event_id=p_event_id order by version desc limit 1)end,version_no,prior,p_request->'attestations',p_actor_id,rid,stamp);end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,rid,'event_settlement_v5',case when code is null then result_id else p_event_id end,case when code is null then op else op||'_rejected' end,response);
 return response;
end $$;
revoke all on function app.write_event_settlement_v5(uuid,uuid,uuid,jsonb,uuid,text)from public,anon,authenticated,service_role;
create function public.save_event_settlement_draft_v5(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path='' as $$select app.write_event_settlement_v5(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id,'draft');$$;
create function public.finalize_event_settlement_v2(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language sql security definer set search_path='' as $$select app.write_event_settlement_v5(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id,'final');$$;

create or replace function app.valid_settlement_request_v5(p_request jsonb,p_action text)
returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb;k text;
begin
 if jsonb_typeof(p_request)is distinct from'object'then return false;end if;
 if p_action='draft'then
  if(select count(*)from jsonb_object_keys(p_request))<>8 or not(p_request?&array['source','expectedVersion','prizeClaims','eventIncomeMinor','eventExpenseMinor','retainedBalanceMinor','officialSourceReference','sanctioningExpenseEventId'])or jsonb_typeof(p_request->'source')is distinct from'object'or jsonb_typeof(p_request->'prizeClaims')is distinct from'array'then return false;end if;
  if(select count(*)from jsonb_object_keys(p_request->'source'))<>3 or not((p_request->'source')?&array['kind','resultId','qualificationResultVersionId'])or coalesce(p_request->'source'->>'kind','')not in('legacy_placement_v2','playoff_outcome_v3')then return false;end if;
  foreach k in array array['resultId','qualificationResultVersionId']loop if coalesce(p_request->'source'->>k,'')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'then return false;end if;end loop;
  foreach k in array array['expectedVersion','eventIncomeMinor','eventExpenseMinor','retainedBalanceMinor']loop if jsonb_typeof(p_request->k)is distinct from'number'or coalesce(p_request->>k,'')!~'^(0|[1-9][0-9]*)$'or(p_request->>k)::numeric>9007199254740991 then return false;end if;end loop;
  if(p_request->>'expectedVersion')::numeric>2147483647 or jsonb_array_length(p_request->'prizeClaims')>256 then return false;end if;
  if p_request->'sanctioningExpenseEventId'<>'null'::jsonb and coalesce(p_request->>'sanctioningExpenseEventId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'then return false;end if;
  if jsonb_typeof(p_request->'officialSourceReference')is distinct from'string'or length(trim(p_request->>'officialSourceReference'))not between 1 and 500 or p_request->>'officialSourceReference'<>trim(p_request->>'officialSourceReference')or p_request->>'officialSourceReference'~'[[:cntrl:]]'then return false;end if;
  for item in select value from jsonb_array_elements(p_request->'prizeClaims')loop
   if jsonb_typeof(item)is distinct from'object'or(select count(*)from jsonb_object_keys(item))<>4 or not(item?&array['participantId','amountMinor','prizeOrder','note'])then return false;end if;
   if coalesce(item->>'participantId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or jsonb_typeof(item->'amountMinor')is distinct from'number'or coalesce(item->>'amountMinor','')!~'^(0|[1-9][0-9]*)$'or(item->>'amountMinor')::numeric>9007199254740991 then return false;end if;
   if jsonb_typeof(item->'note')is distinct from'string'or length(trim(item->>'note'))not between 1 and 500 or item->>'note'<>trim(item->>'note')or item->>'note'~'[[:cntrl:]]'then return false;end if;
   if item->'prizeOrder'<>'null'::jsonb and(jsonb_typeof(item->'prizeOrder')is distinct from'number'or coalesce(item->>'prizeOrder','')!~'^[1-9][0-9]*$'or(item->>'prizeOrder')::numeric>256)then return false;end if;
  end loop;return true;
 elsif p_action='final'then
  return coalesce((select count(*)from jsonb_object_keys(p_request))=4 and p_request?&array['draftId','draftVersion','expectedVersion','attestations']and coalesce(p_request->>'draftId','')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'and jsonb_typeof(p_request->'draftVersion')='number'and coalesce(p_request->>'draftVersion','')~'^[1-9][0-9]*$'and jsonb_typeof(p_request->'expectedVersion')='number'and coalesce(p_request->>'expectedVersion','')~'^(0|[1-9][0-9]*)$'and(p_request->>'draftVersion')::numeric<=2147483647 and(p_request->>'expectedVersion')::numeric<=2147483647,false);
 end if;return false;
exception when others then return false;
end $$;
revoke all on function app.valid_settlement_request_v5(jsonb,text)from public,anon,authenticated,service_role;

create or replace function app.settlement_assessment_v5(p_event_id uuid)
returns bigint language sql stable security definer set search_path='' as $$select total_cents::bigint from app.event_sanctioning_fee_snapshots where event_id=p_event_id;$$;
revoke all on function app.settlement_assessment_v5(uuid)from public,anon,authenticated,service_role;

create function public.get_event_settlement_workspace_v5(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d app.event_settlement_drafts_v5%rowtype;f app.event_settlement_finals_v2%rowtype;sources jsonb;blockers jsonb:='[]';assessment bigint;
begin
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))or not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id)then return null;end if;
 select *into d from app.event_settlement_drafts_v5 where event_id=p_event_id order by version desc limit 1;
 select *into f from app.event_settlement_finals_v2 where event_id=p_event_id order by version desc limit 1;
 select coalesce(jsonb_agg(item),'[]')into sources from(
 select jsonb_build_object('kind','legacy_placement_v2','resultId',v.id,'qualificationResultVersionId',v.qualification_result_version_id,'label','Legacy recorded result version '||v.version)item from app.standard_singles_playoff_result_versions v join app.operation_receipts r on r.id=v.operation_receipt_id where v.tournament_id=p_tournament_id and v.event_id=p_event_id and r.operation_type='record_standard_singles_playoff_placements_v2'and not exists(select 1 from app.standard_singles_playoff_result_versions newer where newer.event_id=v.event_id and newer.version>v.version)
 union all select jsonb_build_object('kind','playoff_outcome_v3','resultId',v.id,'qualificationResultVersionId',v.qualification_result_version_id,'label','Versioned playoff outcome '||v.version)from app.playoff_outcome_versions_v3 v where v.tournament_id=p_tournament_id and v.event_id=p_event_id and not exists(select 1 from app.playoff_outcome_versions_v3 newer where newer.event_id=v.event_id and newer.version>v.version))choices;
 if app.settlement_award_blocked_v5(p_tournament_id,p_event_id)then blockers:=blockers||'"unsupported_award_obligations"'::jsonb;end if;
 if d.id is not null then
  if app.settlement_source_current_v5(p_tournament_id,p_event_id,d.request_payload->'source')is distinct from true then blockers:=blockers||'"source_unavailable"'::jsonb;end if;
  if d.canonical_mrp->>'status' is distinct from'available'then blockers:=blockers||'"mrp_evidence_correction_required"'::jsonb;end if;
  if d.ledger_snapshot is distinct from app.settlement_ledger_v5(p_tournament_id)then blockers:=blockers||'"ledger_snapshot_changed"'::jsonb;end if;
 end if;
 assessment:=app.settlement_assessment_v5(p_event_id);
 if assessment is null then blockers:=blockers||'"sanctioning_assessment_unavailable"'::jsonb;
 elsif assessment>0 and(d.sanctioning_expense_event_id is null or coalesce((d.request_payload->>'eventExpenseMinor')::bigint,0)<assessment)then blockers:=blockers||'"sanctioning_assessment_unfunded"'::jsonb;end if;
 return jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,
 'currentDraftVersion',greatest(coalesce(d.version,0),coalesce((select max(version)from app.standard_singles_settlement_drafts where event_id=p_event_id),0)),
 'currentFinalVersion',greatest(coalesce(f.version,0),coalesce((select max(version)from app.standard_singles_settlement_final_versions where event_id=p_event_id),0)),
 'draft',case when d.id is null then null else jsonb_build_object('draftId',d.id,'version',d.version,'request',d.request_payload,'canonicalMrp',d.canonical_mrp,'ledgerSnapshot',d.ledger_snapshot)end,
 'finalization',case when f.id is null then null else jsonb_build_object('finalizationId',f.id,'version',f.version,'draftId',f.draft_id)end,
 'capabilities',jsonb_build_object('qPoolClaims',false,'automaticPayout',false),'sources',sources,'ledgerSnapshot',app.settlement_ledger_v5(p_tournament_id),'blockers',blockers,'sanctioningAssessmentMinor',assessment,'expenseEvidence',(select coalesce(jsonb_agg(jsonb_build_object('expenseEventId',e.id,'amountMinor',e.amount_minor,'description',e.description,'currencyCode',e.currency_code)order by e.id),'[]')from app.tournament_expense_events e where e.tournament_id=p_tournament_id and e.event_type='recorded'and not exists(select 1 from app.tournament_expense_events newer where newer.expense_id=e.expense_id and newer.version>e.version)));
end $$;
create function public.get_event_settlement_reconciliation_v5(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$declare response jsonb;begin
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))then return null;end if;
 select response_payload into response from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id and tournament_id=p_tournament_id and target_id=p_event_id and operation_type in('save_event_settlement_draft_v5','finalize_event_settlement_v2');
 return jsonb_build_object('authorized',true,'result',response);end $$;
revoke all on function public.save_event_settlement_draft_v5(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
revoke all on function public.finalize_event_settlement_v2(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
revoke all on function public.get_event_settlement_workspace_v5(uuid,uuid,uuid)from public,anon,authenticated;
revoke all on function public.get_event_settlement_reconciliation_v5(uuid,uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.save_event_settlement_draft_v5(uuid,uuid,uuid,jsonb,uuid)to service_role;
grant execute on function public.finalize_event_settlement_v2(uuid,uuid,uuid,jsonb,uuid)to service_role;
grant execute on function public.get_event_settlement_workspace_v5(uuid,uuid,uuid)to service_role;
grant execute on function public.get_event_settlement_reconciliation_v5(uuid,uuid,uuid,uuid)to service_role;

-- Symmetric per-event playoff domain invariant, no legacy grant changes.
-- LOCAL DESIGN PROPOSAL ONLY. Requires the v3 table, but revokes no existing grant.
-- Not registered, executed or approved for rollout. No settlement replacement implied.
-- Install in the same transaction as an additive v3 schema, before enabling its writers.
do $$ begin
 if exists(select 1 from app.standard_singles_playoff_result_versions legacy
   join app.playoff_outcome_versions_v3 outcomes
   on outcomes.tournament_id=legacy.tournament_id and outcomes.event_id=legacy.event_id) then
  raise exception 'playoff write domain preflight failed: existing mixed-domain history requires review';
 end if;
end $$;
create or replace function app.require_single_playoff_write_domain_v3()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('standard-singles-post-event:'||new.event_id::text,0));
 if tg_table_name='standard_singles_playoff_result_versions' then
  if exists(select 1 from app.playoff_outcome_versions_v3 v
    where v.tournament_id=new.tournament_id and v.event_id=new.event_id) then
   raise exception using errcode='P0001',message='playoff write domain conflict: this event uses versioned outcomes';
  end if;
 elsif tg_table_name='playoff_outcome_versions_v3' then
  if exists(select 1 from app.standard_singles_playoff_result_versions v
    where v.tournament_id=new.tournament_id and v.event_id=new.event_id) then
   raise exception using errcode='P0001',message='playoff write domain conflict: this event has legacy placement history';
  end if;
 else
  raise exception 'unexpected playoff write domain table';
 end if;
 return new;
end $$;
revoke all on function app.require_single_playoff_write_domain_v3()
 from public,anon,authenticated,service_role;
create trigger playoff_legacy_domain_exclusion_v3
 before insert on app.standard_singles_playoff_result_versions
 for each row execute function app.require_single_playoff_write_domain_v3();
create trigger playoff_outcome_domain_exclusion_v3
 before insert on app.playoff_outcome_versions_v3
 for each row execute function app.require_single_playoff_write_domain_v3();

-- Retain all legacy writer/reader grants, ownership and search paths unchanged.
-- Do not register this guard with the withdrawn 0240 global-revocation tail.
-- This only prevents dual write domains. It does NOT validate legacy MRP evidence,
-- authorize new callers, attest a bracket, or make v3 financial settlement available.
-- Before rollout, writer preflight/error mapping must turn these backstop exceptions
-- into structured rejected receipts without rewriting prior accepted receipts.


create or replace function app.require_canonical_legacy_mrp_v5()
returns trigger language plpgsql security definer set search_path='' as $$
declare source jsonb;canonical jsonb;expected integer;actual jsonb;
begin
 if tg_table_name='standard_singles_settlement_mrp_claims' then
  select jsonb_build_object('kind','legacy_placement_v2','resultId',b.playoff_result_version_id,'qualificationResultVersionId',b.qualification_result_version_id)into source from app.standard_singles_settlement_playoff_bindings b where b.settlement_draft_id=new.settlement_draft_id and b.tournament_id=new.tournament_id and b.event_id=new.event_id;
  canonical:=app.canonical_settlement_mrp_v5(new.tournament_id,new.event_id,source);
  select(item->>'totalMrp')::integer into expected from jsonb_array_elements(canonical->'rows')item where(item->>'participantId')::uuid=new.participant_id;
  if canonical->>'status' is distinct from'available'or expected is null or expected<>new.mrp_points then raise exception 'invalid mrp claims';end if;
 elsif tg_table_name='standard_singles_settlement_final_versions' then
  if exists(select 1 from app.event_settlement_drafts_v5 where tournament_id=new.tournament_id and event_id=new.event_id)then raise exception 'settlement_domain_conflict';end if;
  source:=jsonb_build_object('kind','legacy_placement_v2','resultId',new.playoff_result_version_id,'qualificationResultVersionId',new.qualification_result_version_id);
  canonical:=app.canonical_settlement_mrp_v5(new.tournament_id,new.event_id,source);
  select jsonb_agg(jsonb_build_object('participantId',c.participant_id,'totalMrp',c.mrp_points)order by c.participant_id)into actual from app.standard_singles_settlement_mrp_claims c where c.settlement_draft_id=new.settlement_draft_id;
  if canonical->>'status' is distinct from'available'or actual is distinct from(select jsonb_agg(jsonb_build_object('participantId',item->>'participantId','totalMrp',(item->>'totalMrp')::integer)order by item->>'participantId')from jsonb_array_elements(canonical->'rows')item)then raise exception 'mrp claims incomplete';end if;
 end if;return new;
end $$;
revoke all on function app.require_canonical_legacy_mrp_v5()from public,anon,authenticated,service_role;
create trigger canonical_legacy_mrp_claim_v5 before insert on app.standard_singles_settlement_mrp_claims for each row execute function app.require_canonical_legacy_mrp_v5();
create trigger canonical_legacy_mrp_final_v5 before insert on app.standard_singles_settlement_final_versions for each row execute function app.require_canonical_legacy_mrp_v5();

create or replace function app.require_settlement_write_domain_v5()
returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('settlement-domain:'||new.event_id::text,0));
 if tg_table_name='standard_singles_settlement_drafts'and exists(select 1 from app.event_settlement_drafts_v5 where tournament_id=new.tournament_id and event_id=new.event_id)then raise exception 'settlement_domain_conflict';end if;
 if tg_table_name='event_settlement_drafts_v5'and exists(select 1 from app.standard_singles_settlement_drafts where tournament_id=new.tournament_id and event_id=new.event_id and version>=new.version)then raise exception 'settlement_domain_conflict';end if;
 return new;end $$;
revoke all on function app.require_settlement_write_domain_v5()from public,anon,authenticated,service_role;
create trigger old_settlement_domain_v5 before insert on app.standard_singles_settlement_drafts for each row execute function app.require_settlement_write_domain_v5();
create trigger new_settlement_domain_v5 before insert on app.event_settlement_drafts_v5 for each row execute function app.require_settlement_write_domain_v5();

-- Preserve old request hashes, response shapes, authority and accepted replay. Only
-- extend controlled rejection mapping. Refuse the migration if the reviewed anchors drift.
do $$ declare routine record;definition text;patched text;begin
 for routine in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('record_standard_singles_playoff_placements_v1','record_standard_singles_playoff_placements_v2','save_standard_singles_settlement_draft_v1','save_standard_singles_settlement_draft_v2','save_standard_singles_settlement_draft_v3','finalize_standard_singles_settlement_manual_v1')loop
  definition:=pg_get_functiondef(routine.oid);patched:=definition;
  if routine.proname like'record_standard_singles_playoff%'then
   patched:=replace(patched,'else ''invalid_request'' end;','when ''playoff write domain conflict: this event uses versioned outcomes'' then ''playoff_write_domain_conflict'' else ''invalid_request'' end;');
  else patched:=replace(patched,'else ''invalid_request'' end;','when ''settlement_domain_conflict'' then ''settlement_domain_conflict'' else ''invalid_request'' end;');end if;
  if patched=definition then raise exception 'legacy writer rejection anchor unavailable: %',routine.proname;end if;execute patched;
 end loop;
end $$;

-- Direct v1 retries need the same post-exception actor/op serialization as v2+.
do $$ declare definition text;needle text;replacement text;begin
 definition:=pg_get_functiondef('public.save_standard_singles_settlement_draft_v1(uuid,uuid,uuid,uuid,integer,jsonb,jsonb,uuid)'::regprocedure);
 needle:='if v_authorized and p_operation_id is not null and v_hash is not null then';
 replacement:=needle||$patch$
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
   perform 1 from app.tournaments where id=p_tournament_id and status in('open','pending_finalization')for update;if not found then return v_response;end if;
   perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')for update;if not found then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','not_director');end if;
   select *into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
   if found then
    if v_existing.tournament_id=p_tournament_id and v_existing.target_id=p_event_id and v_existing.operation_type='save_standard_singles_settlement_draft_v1'and v_existing.request_hash=v_hash then return v_existing.response_payload;end if;
    insert into app.standard_singles_settlement_conflicts(tournament_id,actor_profile_id,attempted_event_id,attempted_operation_id,attempted_request_hash,prior_receipt_id,reason_code)values(p_tournament_id,p_actor_id,p_event_id,p_operation_id,v_hash,case when v_existing.tournament_id=p_tournament_id then v_existing.id end,'idempotency_conflict');
    return jsonb_build_object('status','rejected','eventId',p_event_id,'code','idempotency_conflict');end if;
 $patch$;
 if position(needle in definition)=0 then raise exception 'v1 rejection anchor missing';end if;execute replace(definition,needle,replacement);
end $$;
notify pgrst,'reload schema';


alter table app.event_settlement_drafts_v5 add constraint settlement_v5_prior_kind_exclusive check(prior_legacy_draft_id is null or supersedes_id is null),add constraint settlement_v5_prior_legacy_scope foreign key(prior_legacy_draft_id,tournament_id,event_id)references app.standard_singles_settlement_drafts(id,tournament_id,event_id);
alter table app.event_settlement_finals_v2 add constraint settlement_v2_prior_kind_exclusive check(prior_legacy_final_id is null or supersedes_id is null),add constraint settlement_v2_prior_legacy_scope foreign key(prior_legacy_final_id,tournament_id,event_id)references app.standard_singles_settlement_final_versions(id,tournament_id,event_id);

-- A historical accepted v4 request must reach its original v3 child receipt
-- BEFORE the corrected calculator evaluates today's evidence. Delegating keeps
-- v3's current authorization, exact hash/scope and conflict rules intact.
do $$ declare definition text;needle text;injected text;begin
 definition:=pg_get_functiondef('public.save_standard_singles_settlement_draft_v4(uuid,uuid,uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,uuid)'::regprocedure);
 needle:='v_auto:=app.standard_singles_automatic_mrps_v1';
 injected:=$patch$
 v_inner_id:=(substr(md5(p_operation_id::text||':settlement-v4'),1,8)||'-'||substr(md5(p_operation_id::text||':settlement-v4'),9,4)||'-4'||substr(md5(p_operation_id::text||':settlement-v4'),14,3)||'-8'||substr(md5(p_operation_id::text||':settlement-v4'),18,3)||'-'||substr(md5(p_operation_id::text||':settlement-v4'),21,12))::uuid;
 if exists(select 1 from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=v_inner_id)then
  return public.save_standard_singles_settlement_draft_v3(p_actor_id,p_tournament_id,p_event_id,p_qualification_result_version_id,p_playoff_result_version_id,p_expected_version,p_placements,p_awards,p_mrp_claims,v_inner_id);
 end if;
 $patch$||needle;
 if position(needle in definition)=0 then raise exception 'v4 receipt compatibility anchor missing';end if;execute replace(definition,needle,injected);
end $$;
