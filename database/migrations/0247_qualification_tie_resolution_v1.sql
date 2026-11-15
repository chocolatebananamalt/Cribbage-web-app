begin;
-- LOCAL PROPOSAL: ACC 2025 Appendix A20 / Policy 6 IV.B.2.
-- Qualification ordering only. No qualifying score, Q cash tie policy, or historical result changes.
create table app.qualification_tie_resolutions_v1 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null, event_id uuid not null,
 source_fingerprint text not null check(source_fingerprint ~ '^[a-f0-9]{64}$'),
 participant_a_id uuid not null, participant_b_id uuid not null,
 winner_id uuid not null, method text not null check(method in('head_to_head','one_game_playoff')),
 head_to_head_game_id uuid,
 reason text not null check(length(trim(reason)) between 1 and 500 and reason !~ '[[:cntrl:]]'),
 evidence_reference text not null check(length(trim(evidence_reference)) between 1 and 500 and evidence_reference !~ '[[:cntrl:]]'),
 actor_id uuid not null references app.profiles(id), operation_receipt_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 check(participant_a_id < participant_b_id and winner_id in(participant_a_id,participant_b_id)),
 check((method='head_to_head')=(head_to_head_game_id is not null)),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id),
 foreign key(participant_a_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id),
 foreign key(participant_b_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id),
 foreign key(head_to_head_game_id,event_id,tournament_id) references app.canonical_games(id,event_id,tournament_id),
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id),
 unique(event_id,source_fingerprint,participant_a_id,participant_b_id)
);
alter table app.qualification_tie_resolutions_v1 enable row level security;
alter table app.qualification_tie_resolutions_v1 force row level security;
revoke all on app.qualification_tie_resolutions_v1 from public,anon,authenticated,service_role;
create trigger qualification_tie_resolutions_immutable before update or delete on app.qualification_tie_resolutions_v1 for each row execute function app.reject_immutable_history();
create index qualification_tie_tournament_idx on app.qualification_tie_resolutions_v1(tournament_id,event_id);
create index qualification_tie_actor_idx on app.qualification_tie_resolutions_v1(actor_id);
create index qualification_tie_receipt_idx on app.qualification_tie_resolutions_v1(operation_receipt_id,tournament_id);
create index qualification_tie_a_idx on app.qualification_tie_resolutions_v1(participant_a_id,event_id,tournament_id);
create index qualification_tie_b_idx on app.qualification_tie_resolutions_v1(participant_b_id,event_id,tournament_id);
create index qualification_tie_game_idx on app.qualification_tie_resolutions_v1(head_to_head_game_id,event_id,tournament_id);

-- Excludes resolutions themselves: recording one pair does not invalidate another pair.
-- Includes canonical/effective values and immutable submission/paper evidence history,
-- so a same-total evidence correction still invalidates applicability.
create function app.qualification_tie_source_v1(t uuid,e uuid) returns text
language sql stable security definer set search_path='' as $$
 select encode(extensions.digest(convert_to(jsonb_build_object('version','qualification-tie-v1',
 'event',(select to_jsonb(x) from app.events x where id=e and tournament_id=t),
 'schedule',(select jsonb_agg(to_jsonb(x) order by id) from app.event_schedule_publications x where event_id=e and tournament_id=t),
 'participants',(select jsonb_agg(to_jsonb(x) order by id) from app.event_participants x where event_id=e and tournament_id=t),
 'games',(select jsonb_agg(to_jsonb(x) order by id) from app.canonical_games x where event_id=e and tournament_id=t),
 'effective',(select jsonb_agg(to_jsonb(x) order by participant_id,canonical_game_id,line_id) from app.current_effective_scorelines(t,e)x),
 'submissions',(select jsonb_agg(to_jsonb(x) order by id) from app.score_submissions x where event_id=e and tournament_id=t),
 'confirmations',(select jsonb_agg(to_jsonb(x) order by id) from app.score_confirmations x where event_id=e and tournament_id=t),
 'paperEvidence',(select jsonb_agg(to_jsonb(x) order by id) from app.paper_game_completion_evidence x where event_id=e and tournament_id=t),
 'paperReviews',(select jsonb_agg(to_jsonb(x) order by id) from app.paper_game_completion_reviews x where event_id=e and tournament_id=t),
 'corrections',(select jsonb_agg(to_jsonb(x) order by id) from app.independent_card_corrections x where event_id=e and tournament_id=t),
 'correctionStates',(select jsonb_agg(to_jsonb(x) order by x.id) from app.independent_card_correction_state_events x join app.independent_card_corrections c on c.id=x.correction_id where c.event_id=e and c.tournament_id=t),
 'recoveries',(select jsonb_agg(to_jsonb(x) order by id) from app.device_failure_recoveries x where event_id=e and tournament_id=t),
 'recoveryStates',(select jsonb_agg(to_jsonb(x) order by x.id) from app.device_failure_recovery_state_events x join app.device_failure_recoveries c on c.id=x.recovery_id where c.event_id=e and c.tournament_id=t)
 )::text,'utf8'),'sha256'),'hex')
$$;

create function app.qualification_tie_totals_v1(t uuid,e uuid)
returns table(id uuid,display_name text,verified_games integer,game_points integer,games_won integer,plus_points integer,minus_points integer,numeric_rank integer,group_size integer)
language sql stable security definer set search_path='' as $$
 with totals as (
 select p.id,coalesce(nullif(trim(r.claimed_display_name),''),nullif(trim(pr.display_name),'')) display_name,
 count(l.line_id)::integer verified_games,coalesce(sum(l.game_points),0)::integer game_points,
 count(*) filter(where l.is_winner)::integer games_won,coalesce(sum(l.plus_points),0)::integer plus_points,coalesce(sum(l.minus_points),0)::integer minus_points
 from app.event_participants p left join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
 left join app.profiles pr on pr.id=p.profile_id
 left join lateral(select * from app.current_effective_scorelines(t,e) where participant_id=p.id)l on true
 where p.tournament_id=t and p.event_id=e group by p.id,coalesce(nullif(trim(r.claimed_display_name),''),nullif(trim(pr.display_name),''))
 ) select totals.*,rank()over(order by game_points desc,games_won desc,(plus_points-minus_points)desc,plus_points desc)::integer,
 count(*)over(partition by game_points,games_won,(plus_points-minus_points),plus_points)::integer from totals
$$;

create function app.qualification_tie_groups_v1(t uuid,e uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare fp text:=app.qualification_tie_source_v1(t,e);g record;ids uuid[];meetings integer;gid uuid;winner uuid;v_method text;res jsonb;out jsonb:='[]';n integer;
begin
 select (count(*)::integer+3)/4 into n from app.event_participants where tournament_id=t and event_id=e;
 for g in select numeric_rank,array_agg(id order by id) ids from app.qualification_tie_totals_v1(t,e) where group_size>1 group by numeric_rank order by numeric_rank loop
 ids:=g.ids;gid:=null;winner:=null;v_method:='blocked';res:=null;
 if cardinality(ids)=2 then
  -- Count qualifying meetings from canonical schedule, even if an effective pair is malformed.
  select count(*)::integer into meetings from app.canonical_games c where c.tournament_id=t and c.event_id=e
   and app.game_counts_in_standings_v1(c.id) and ((c.side_a_participant_id=ids[1] and c.side_b_participant_id=ids[2])or(c.side_a_participant_id=ids[2] and c.side_b_participant_id=ids[1]));
  if meetings=0 then v_method:='one_game_playoff';
  elsif meetings=1 and (select count(*) from app.current_effective_scorelines(t,e) l where l.participant_id=any(ids) and l.opponent_participant_id=any(ids))=2 then
   select a.canonical_game_id,a.participant_id into gid,winner
    from app.current_effective_scorelines(t,e)a join app.current_effective_scorelines(t,e)b on b.canonical_game_id=a.canonical_game_id and b.participant_id=a.opponent_participant_id and b.opponent_participant_id=a.participant_id
    where a.participant_id=any(ids) and a.opponent_participant_id=any(ids) and a.is_winner and not b.is_winner
      and a.margin=b.margin and a.plus_points=b.minus_points and a.minus_points=b.plus_points;
   if found then v_method:='head_to_head';end if;
  end if;
  select jsonb_build_object('id',r.id,'winnerId',r.winner_id,'method',r.method,'reason',r.reason,'evidenceReference',r.evidence_reference,'recordedAt',r.recorded_at,'recordedBy',r.actor_id)
   into res from app.qualification_tie_resolutions_v1 r where r.tournament_id=t and r.event_id=e and r.source_fingerprint=fp and r.participant_a_id=ids[1] and r.participant_b_id=ids[2]
    and r.method=v_method and (v_method='one_game_playoff' or(r.winner_id=winner and r.head_to_head_game_id=gid));
 end if;
 out:=out||jsonb_build_array(jsonb_build_object('candidateIds',to_jsonb(ids),'numericRank',g.numeric_rank,'affectsQualificationCut',g.numeric_rank<=n and g.numeric_rank+cardinality(ids)-1>n,
 'method',v_method,'headToHeadGameId',gid,'headToHeadWinnerId',winner,'resolution',res));
 end loop;
 return out;
end$$;

-- Readiness mirrors the existing finalizer; the existing finalizer retains its own guards too.
create function app.qualification_tie_blockers_v1(t uuid,e uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare b jsonb:='[]';s app.event_schedule_publications%rowtype;n integer;
begin
 if not exists(select 1 from app.tournaments where id=t and status='open') then b:=b||'"tournament_unavailable"'::jsonb;end if;
 if not exists(select 1 from app.events x where x.id=e and x.tournament_id=t and x.format='standard_singles' and x.scoring_method='digital'
  and exists(select 1 from app.ruleset_versions r where r.id=x.ruleset_version_id and r.tournament_id=t and r.format='standard_singles' and r.approved_at is not null and nullif(trim(r.source_reference),'')is not null)
  and exists(select 1 from app.tournament_setup_activations a where a.tournament_id=t and a.event_id=e)
  and exists(select 1 from app.event_publication_states p where p.tournament_id=t and p.event_id=e and p.state='draft')) then b:=b||'"event_unavailable"'::jsonb;end if;
 select * into s from app.event_schedule_publications where tournament_id=t and event_id=e;
 select count(*) into n from app.event_participants where tournament_id=t and event_id=e;
 if s.id is null or n<>s.participant_count or s.match_count<>(n*s.game_count)/2
  or exists(select 1 from app.event_participants p where p.tournament_id=t and p.event_id=e and p.status<>'checked_in')
  or (select count(*)from app.canonical_games where tournament_id=t and event_id=e)<>s.match_count
  or (select count(*)from app.current_effective_scorelines(t,e))<>s.match_count*2
  or exists(select 1 from app.event_participants p where p.tournament_id=t and p.event_id=e and(select count(*)from app.current_effective_scorelines(t,e)l where l.participant_id=p.id)<>s.game_count)
 then b:=b||'"schedule_incomplete"'::jsonb;end if;
 if exists(select 1 from app.canonical_games g where g.tournament_id=t and g.event_id=e and g.state in('pending','submitted','mismatch','confirmation_pending') and not exists(select 1 from app.device_failure_recoveries r where r.canonical_game_id=g.id and app.device_recovery_is_approved(r.id))) then b:=b||'"scorecards_unresolved"'::jsonb;end if;
 if exists(select 1 from app.event_disputes d where d.tournament_id=t and d.event_id=e and app.event_dispute_is_open(d.id)) then b:=b||'"dispute_open"'::jsonb;end if;
 if exists(select 1 from app.device_failure_recoveries r cross join lateral(select x.state from app.device_failure_recovery_state_events x where x.recovery_id=r.id order by x.transition_sequence desc limit 1)z where r.tournament_id=t and r.event_id=e and z.state in('pending_review','disputed')) then b:=b||'"recovery_pending"'::jsonb;end if;
 if exists(select 1 from app.independent_card_correction_lifecycles l cross join lateral(select x.state from app.independent_card_correction_state_events x where x.correction_id=l.correction_id order by x.transition_sequence desc limit 1)z where l.tournament_id=t and l.event_id=e and z.state not in('applied','rejected'))
 or exists(select 1 from app.game_corrections c where c.tournament_id=t and c.event_id=e and not exists(select 1 from app.correction_state_events x where x.correction_id=c.id and x.state in('applied','rejected'))) then b:=b||'"correction_pending"'::jsonb;end if;
 if exists(select 1 from app.independent_card_corrections c cross join lateral(select x.state from app.independent_card_correction_state_events x where x.correction_id=c.id order by x.transition_sequence desc limit 1)z where c.tournament_id=t and c.event_id=e and c.qualification_changed and z.state='applied' and not exists(select 1 from app.rule12_affected_player_notices n where n.correction_id=c.id)) then b:=b||'"qualification_notice_pending"'::jsonb;end if;
 return b;
end$$;

create function public.get_qualification_tie_workspace_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))
 and exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id) then jsonb_build_object('tournamentId',p_tournament_id,'eventId',p_event_id,
 'sourceFingerprint',app.qualification_tie_source_v1(p_tournament_id,p_event_id),
 'finalized',exists(select 1 from app.qualification_result_versions where event_id=p_event_id),
 'blockers',app.qualification_tie_blockers_v1(p_tournament_id,p_event_id),'groups',app.qualification_tie_groups_v1(p_tournament_id,p_event_id)) else null end
$$;

create function public.save_qualification_tie_resolution_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_request jsonb,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old app.operation_receipts%rowtype;h text;w jsonb;g jsonb;ids uuid[];winner uuid;method text;reason text;ev text;fp text;rid uuid:=extensions.gen_random_uuid();receipt uuid:=extensions.gen_random_uuid();response jsonb;code text;
begin
 if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('save_qualification_tie_resolution_v1',p_actor_id,p_tournament_id,p_event_id,p_request)::text,'utf8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qualification-finalization:'||p_event_id::text,0));
 perform 1 from app.tournaments where id=p_tournament_id for update;if not found then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director') for update;
 if not found then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','not_director');end if;
 select * into old from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
  if old.tournament_id=p_tournament_id and old.operation_type='save_qualification_tie_resolution_v1' and old.target_id=p_event_id and old.request_hash=h then return old.response_payload;end if;
  return jsonb_build_object('status','rejected','eventId',p_event_id,'code','idempotency_conflict');
 end if;
 begin
  perform 1 from app.events where id=p_event_id and tournament_id=p_tournament_id for update;
  if not found then raise exception using errcode='P0001',message='event_unavailable';end if;
  perform 1 from app.canonical_games where tournament_id=p_tournament_id and event_id=p_event_id order by id for update;
  w:=public.get_qualification_tie_workspace_v1(p_actor_id,p_tournament_id,p_event_id);
  if (w->>'finalized')::boolean then raise exception using errcode='P0001',message='already_finalized';end if;
  if jsonb_array_length(w->'blockers')>0 then raise exception using errcode='P0001',message=(w->'blockers'->>0);end if;
  if jsonb_typeof(p_request)<>'object' or (select count(*)from jsonb_object_keys(p_request))<>6
   or not(p_request ?& array['expectedSourceFingerprint','participantIds','winnerId','method','reason','evidenceReference'])
   or jsonb_typeof(p_request->'participantIds')<>'array' or jsonb_array_length(p_request->'participantIds')<>2
   or jsonb_typeof(p_request->'reason')<>'string' or jsonb_typeof(p_request->'evidenceReference')<>'string'
   then raise exception using errcode='P0001',message='invalid_request';end if;
  select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(p_request->'participantIds')x;
  if ids[1]=ids[2] then raise exception using errcode='P0001',message='invalid_pair';end if;
  winner:=(p_request->>'winnerId')::uuid;method:=p_request->>'method';reason:=trim(p_request->>'reason');ev:=trim(p_request->>'evidenceReference');fp:=w->>'sourceFingerprint';
  if winner is null or not(winner=any(ids)) or method not in('head_to_head','one_game_playoff') or reason is null or ev is null or length(reason)not between 1 and 500 or length(ev)not between 1 and 500 or reason~'[[:cntrl:]]' or ev~'[[:cntrl:]]' then raise exception using errcode='P0001',message='invalid_request';end if;
  if p_request->>'expectedSourceFingerprint' is distinct from fp then raise exception using errcode='P0001',message='stale_source';end if;
  select value into g from jsonb_array_elements(w->'groups') where value->'candidateIds'=to_jsonb(ids);
  if g is null then raise exception using errcode='P0001',message='invalid_pair';end if;
  if g->>'method'='blocked' then raise exception using errcode='P0001',message='ambiguous_tie';end if;
  if method is distinct from g->>'method' then raise exception using errcode='P0001',message='method_unavailable';end if;
  if method='head_to_head' and winner is distinct from (g->>'headToHeadWinnerId')::uuid then raise exception using errcode='P0001',message='head_to_head_winner_mismatch';end if;
  if g->'resolution'<>'null'::jsonb then raise exception using errcode='P0001',message='resolution_already_recorded';end if;
  response:=jsonb_build_object('status','qualification_tie_recorded','eventId',p_event_id,'resolutionId',rid,'sourceFingerprint',fp,'participantIds',to_jsonb(ids),'winnerId',winner,'method',method);
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(receipt,p_tournament_id,p_actor_id,'save_qualification_tie_resolution_v1',p_event_id,h,p_operation_id,'accepted',response,clock_timestamp());
  insert into app.qualification_tie_resolutions_v1(id,tournament_id,event_id,source_fingerprint,participant_a_id,participant_b_id,winner_id,method,head_to_head_game_id,reason,evidence_reference,actor_id,operation_receipt_id)
   values(rid,p_tournament_id,p_event_id,fp,ids[1],ids[2],winner,method,(g->>'headToHeadGameId')::uuid,reason,ev,p_actor_id,receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,receipt,'qualification_tie_resolution',rid,'qualification_tie_recorded',response||jsonb_build_object('winnerId',winner,'method',method));
  return response;
 exception when sqlstate 'P0001' or invalid_text_representation or invalid_parameter_value or null_value_not_allowed or check_violation then
  code:=case when sqlstate='P0001' then sqlerrm else 'invalid_request' end;
  response:=jsonb_build_object('status','rejected','eventId',p_event_id,'code',code);
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(receipt,p_tournament_id,p_actor_id,'save_qualification_tie_resolution_v1',p_event_id,h,p_operation_id,'rejected',response,clock_timestamp());
  return response;
 end;
end$$;

-- Reconcile only the exact retained request, including rejected outcomes.
-- A changed reason/evidence/source/pair must not clear an uncertain operation.
create function public.get_qualification_tie_reconciliation_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then jsonb_build_object('authorized',true,'result',
  (select case when r.tournament_id=p_tournament_id and r.target_id=p_event_id and r.operation_type='save_qualification_tie_resolution_v1'
   and r.request_hash=encode(extensions.digest(convert_to(jsonb_build_array('save_qualification_tie_resolution_v1',p_actor_id,p_tournament_id,p_event_id,p_request)::text,'utf8'),'sha256'),'hex')
   then r.response_payload else jsonb_build_object('status','rejected','eventId',p_event_id,'code','idempotency_conflict') end
   from app.operation_receipts r where r.actor_profile_id=p_actor_id and r.client_operation_id=p_operation_id))else null end
$$;

create function app.qualification_resolved_rankings_v1(t uuid,e uuid)
returns table(id uuid,display_name text,verified_games integer,game_points integer,games_won integer,plus_points integer,minus_points integer,ordinal integer,numeric_rank integer,tied boolean)
language sql stable security definer set search_path='' as $$
 with totals as(select * from app.qualification_tie_totals_v1(t,e)),groups as(select value g from jsonb_array_elements(app.qualification_tie_groups_v1(t,e)))
 select x.id,x.display_name,x.verified_games,x.game_points,x.games_won,x.plus_points,x.minus_points,
 row_number()over(order by x.numeric_rank,case when x.group_size=1 or g.g->'resolution'->>'winnerId'=x.id::text then 0 else 1 end,x.id)::integer,
 x.numeric_rank,x.group_size>1 and g.g->'resolution'='null'::jsonb
 from totals x left join groups g on g.g->'candidateIds' ? x.id::text
$$;

-- Extend the reviewed private core only; the public dispute wrapper and existing
-- readiness/correction/notice/freeze guards remain intact. Fail on unexpected source drift.
do $repair$
declare d text;old text;new text;start_at integer;end_at integer;
begin
 select replace(pg_get_functiondef('app.finalize_standard_singles_qualification_without_event_dispute_guard_v1(uuid,uuid,uuid,uuid)'::regprocedure),chr(13)||chr(10),chr(10))into d;
 start_at:=position(E'    if exists (\n      with totals as (' in d);
 end_at:=position(E'    v_response := jsonb_build_object(''status'',''qualification_finalized''' in d);
 if start_at=0 or end_at=0 or end_at<=start_at then raise exception 'qualification tie patch source drift (ranking guard/digest)';end if;
 old:=$original$    if exists (
      with totals as (
        select participant.id,
          coalesce(sum(line.game_points),0)::integer game_points,
          count(*) filter(where line.is_winner)::integer games_won,
          coalesce(sum(line.plus_points),0)::integer plus_points,
          coalesce(sum(line.minus_points),0)::integer minus_points
        from app.event_participants participant
        left join lateral (select effective.* from app.current_effective_scorelines(p_tournament_id,p_event_id) effective
          where effective.participant_id=participant.id) line on true
        where participant.tournament_id=p_tournament_id and participant.event_id=p_event_id group by participant.id
      )
      select 1 from totals
      group by game_points,games_won,(plus_points-minus_points),plus_points
      having count(*) > 1
    ) then raise exception using errcode = 'P0001', message = 'ranking tie unresolved'; end if;

    with totals as (
      select participant.id,
        coalesce(nullif(trim(roster.claimed_display_name),''),nullif(trim(profile.display_name),'')) display_name,
        count(line.line_id)::integer verified_games, coalesce(sum(line.game_points),0)::integer game_points,
        count(*) filter(where line.is_winner)::integer games_won,
        coalesce(sum(line.plus_points),0)::integer plus_points,
        coalesce(sum(line.minus_points),0)::integer minus_points
      from app.event_participants participant
      left join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id and roster.tournament_id=participant.tournament_id
      left join app.profiles profile on profile.id=participant.profile_id
      left join lateral (select effective.* from app.current_effective_scorelines(p_tournament_id,p_event_id) effective where effective.participant_id=participant.id) line on true
      where participant.tournament_id=p_tournament_id and participant.event_id=p_event_id
      group by participant.id,coalesce(nullif(trim(roster.claimed_display_name),''),nullif(trim(profile.display_name),''))
    ), ranked as (
      select totals.*,
        row_number() over(order by game_points desc,games_won desc,(plus_points-minus_points) desc,plus_points desc,id)::integer ordinal,
        rank() over(order by game_points desc,games_won desc,(plus_points-minus_points) desc,plus_points desc)::integer numeric_rank,
        count(*) over(partition by game_points,games_won,(plus_points-minus_points),plus_points)>1 tied
      from totals
    )
    select encode(extensions.digest(convert_to(jsonb_agg(to_jsonb(ranked) order by ordinal)::text,'utf8'),'sha256'),'hex')
      into v_digest from ranked;

$original$;
 if substr(d,start_at,end_at-start_at)<>old then raise exception 'qualification tie patch unexpected ranking guard/digest';end if;
 d:=substr(d,1,start_at-1)||$new$
    if exists(select 1 from jsonb_array_elements(app.qualification_tie_groups_v1(p_tournament_id,p_event_id))g where g->'resolution'='null'::jsonb) then
      raise exception using errcode='P0001',message='ranking tie unresolved';
    end if;
    select encode(extensions.digest(convert_to(jsonb_agg(to_jsonb(ranked) order by ordinal)::text,'utf8'),'sha256'),'hex') into v_digest
      from app.qualification_resolved_rankings_v1(p_tournament_id,p_event_id) ranked;
$new$||substr(d,end_at);
 start_at:=position(E'    from (\n      select participant.id,row_number()' in d);
 end_at:=position(E'    insert into app.audit_events(' in d);
 if start_at=0 or end_at=0 or end_at<=start_at then raise exception 'qualification tie patch source drift (snapshot rows)';end if;
 old:=$original$    from (
      select participant.id,row_number() over(order by sum(line.game_points) desc,
        count(*) filter(where line.is_winner) desc,(sum(line.plus_points)-sum(line.minus_points)) desc,
        sum(line.plus_points) desc,participant.id)::integer ordinal
      from app.event_participants participant
      join lateral (select effective.* from app.current_effective_scorelines(p_tournament_id,p_event_id) effective where effective.participant_id=participant.id) line on true
      where participant.tournament_id=p_tournament_id and participant.event_id=p_event_id group by participant.id
    ) ranked where ranked.ordinal=v_qualifier_count+1;

    with totals as (
      select participant.id,
        coalesce(nullif(trim(roster.claimed_display_name),''),nullif(trim(profile.display_name),'')) display_name,
        count(line.line_id)::integer verified_games,sum(line.game_points)::integer game_points,
        count(*) filter(where line.is_winner)::integer games_won,sum(line.plus_points)::integer plus_points,sum(line.minus_points)::integer minus_points
      from app.event_participants participant
      left join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id and roster.tournament_id=participant.tournament_id
      left join app.profiles profile on profile.id=participant.profile_id
      join lateral (select effective.* from app.current_effective_scorelines(p_tournament_id,p_event_id) effective where effective.participant_id=participant.id) line on true
      where participant.tournament_id=p_tournament_id and participant.event_id=p_event_id
      group by participant.id,coalesce(nullif(trim(roster.claimed_display_name),''),nullif(trim(profile.display_name),''))
    ), ranked as (
      select totals.*,row_number() over(order by game_points desc,games_won desc,(plus_points-minus_points) desc,plus_points desc,id)::integer ordinal,
        rank() over(order by game_points desc,games_won desc,(plus_points-minus_points) desc,plus_points desc)::integer numeric_rank,
        count(*) over(partition by game_points,games_won,(plus_points-minus_points),plus_points)>1 tied from totals
    )
    insert into app.qualification_result_rows(result_version_id,tournament_id,event_id,participant_id,
      ranking_ordinal,numeric_rank,tied,display_name_snapshot,verified_games,game_points,games_won,
      plus_points,minus_points,net_spread_points,qualification_status)
    select v_result_id,p_tournament_id,p_event_id,id,ordinal,numeric_rank,tied,display_name,verified_games,
      game_points,games_won,plus_points,minus_points,plus_points-minus_points,
      case when ordinal<=v_qualifier_count then 'qualified'
        when ordinal=v_qualifier_count+1 then 'high_non_qualifier' else 'not_qualified' end
    from ranked;
$original$;
 if substr(d,start_at,end_at-start_at)<>old then raise exception 'qualification tie patch unexpected snapshot rows';end if;
 d:=substr(d,1,start_at-1)||$new$
    from app.qualification_resolved_rankings_v1(p_tournament_id,p_event_id) ranked where ranked.ordinal=v_qualifier_count+1;
    insert into app.qualification_result_rows(result_version_id,tournament_id,event_id,participant_id,
      ranking_ordinal,numeric_rank,tied,display_name_snapshot,verified_games,game_points,games_won,
      plus_points,minus_points,net_spread_points,qualification_status)
    select v_result_id,p_tournament_id,p_event_id,id,ordinal,numeric_rank,tied,display_name,verified_games,
      game_points,games_won,plus_points,minus_points,plus_points-minus_points,
      case when ordinal<=v_qualifier_count then 'qualified'
        when ordinal=v_qualifier_count+1 then 'high_non_qualifier' else 'not_qualified' end
    from app.qualification_resolved_rankings_v1(p_tournament_id,p_event_id);
$new$||substr(d,end_at);
 execute d;
end$repair$;

revoke all on function app.qualification_tie_source_v1(uuid,uuid),app.qualification_tie_totals_v1(uuid,uuid),app.qualification_tie_groups_v1(uuid,uuid),app.qualification_tie_blockers_v1(uuid,uuid),app.qualification_resolved_rankings_v1(uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function public.get_qualification_tie_workspace_v1(uuid,uuid,uuid),public.save_qualification_tie_resolution_v1(uuid,uuid,uuid,jsonb,uuid),public.get_qualification_tie_reconciliation_v1(uuid,uuid,uuid,uuid,jsonb)from public,anon,authenticated;
grant execute on function public.get_qualification_tie_workspace_v1(uuid,uuid,uuid),public.save_qualification_tie_resolution_v1(uuid,uuid,uuid,jsonb,uuid),public.get_qualification_tie_reconciliation_v1(uuid,uuid,uuid,uuid,jsonb)to service_role;
notify pgrst,'reload schema';


-- The Q source reader must recompute the same authoritative qualification order.
-- The helper is byte-compatible with legacy no-tie digest rows. Do not alter Q cash tie rules.
do $qrepair$
declare d text;a integer;b integer;original text;
begin
 d:=replace(pg_get_functiondef('app.q_obligation_sources_v1(uuid,uuid)'::regprocedure),chr(13)||chr(10),chr(10));
 a:=position('  with totals as (' in d);
 b:=position('  if digest is distinct from q.standings_digest' in d);
 if a=0 or b=0 or b<=a then raise exception 'Q qualification digest patch source drift';end if;
 original:=$original$  with totals as (
   select p.id,coalesce(nullif(trim(r.claimed_display_name),''),nullif(trim(pr.display_name),'')) display_name,
    count(l.line_id)::integer verified_games,coalesce(sum(l.game_points),0)::integer game_points,
    count(*) filter(where l.is_winner)::integer games_won,coalesce(sum(l.plus_points),0)::integer plus_points,coalesce(sum(l.minus_points),0)::integer minus_points
   from app.event_participants p left join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
   left join app.profiles pr on pr.id=p.profile_id left join lateral(select * from app.current_effective_scorelines(tid,eid) x where x.participant_id=p.id)l on true
   where p.tournament_id=tid and p.event_id=eid group by p.id,coalesce(nullif(trim(r.claimed_display_name),''),nullif(trim(pr.display_name),''))
  ),ranked as(select totals.*,row_number()over(order by game_points desc,games_won desc,(plus_points-minus_points)desc,plus_points desc,id)::integer ordinal,
   rank()over(order by game_points desc,games_won desc,(plus_points-minus_points)desc,plus_points desc)::integer numeric_rank,
   count(*)over(partition by game_points,games_won,(plus_points-minus_points),plus_points)>1 tied from totals)
  select encode(extensions.digest(convert_to(jsonb_agg(to_jsonb(ranked)order by ordinal)::text,'utf8'),'sha256'),'hex') into digest from ranked;
$original$;
 if substr(d,a,b-a)<>original then raise exception 'Q qualification digest patch unexpected source';end if;
 d:=substr(d,1,a-1)||$new$
  select encode(extensions.digest(convert_to(jsonb_agg(to_jsonb(ranked)order by ordinal)::text,'utf8'),'sha256'),'hex') into digest
    from app.qualification_resolved_rankings_v1(tid,eid)ranked;
$new$||substr(d,b);
 execute d;
end$qrepair$;





commit;

