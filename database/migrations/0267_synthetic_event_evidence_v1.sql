-- LOCAL ONLY. Extends explicitly owner-enrolled staging fixtures, not production.
-- No enrollment, artifact, ledger, outcome or authority rows are seeded.
begin;
create table app.synthetic_event_artifacts_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 kind text not null check(kind in('qualification_tie','playoff','close')),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),payload jsonb not null check(jsonb_typeof(payload)='object'),
 artifact_text text not null check(length(artifact_text)between 1 and 16000),
 sha256 text generated always as(encode(extensions.digest(artifact_text,'sha256'),'hex'))stored,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.synthetic_paper_fixtures_v1(event_id,tournament_id),
 unique(id,tournament_id,event_id));
create table app.synthetic_event_provenance_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 operation_receipt_id uuid not null,entity_table text not null,entity_id uuid not null,artifact_id uuid,
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),record_sha256 text not null check(record_sha256~'^[a-f0-9]{64}$'),
 actual_money_received boolean not null default false check(not actual_money_received),
 physical_play boolean not null default false check(not physical_play),human_review_claimed boolean not null default false check(not human_review_claimed),
 money_moved boolean not null default false check(not money_moved),recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.synthetic_paper_fixtures_v1(event_id,tournament_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 foreign key(artifact_id,tournament_id,event_id)references app.synthetic_event_artifacts_v1(id,tournament_id,event_id),
 unique(entity_table,entity_id));
create index synthetic_event_artifacts_event_v1 on app.synthetic_event_artifacts_v1(event_id,tournament_id);
create index synthetic_event_provenance_event_v1 on app.synthetic_event_provenance_v1(event_id,tournament_id);
create index synthetic_event_provenance_receipt_v1 on app.synthetic_event_provenance_v1(operation_receipt_id,tournament_id);
create index synthetic_event_provenance_artifact_v1 on app.synthetic_event_provenance_v1(artifact_id,tournament_id,event_id);
do $$declare t text;begin foreach t in array array['synthetic_event_artifacts_v1','synthetic_event_provenance_v1']loop
 execute format('alter table app.%I enable row level security',t);execute format('alter table app.%I force row level security',t);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',t||'_immutable',t);
end loop;end$$;

create function app.synthetic_event_source_v1(actor uuid,tid uuid,eid uuid,kind_value text)returns text language plpgsql stable security definer set search_path=''as $$
declare w jsonb;begin
 if not exists(select 1 from app.synthetic_paper_fixtures_v1 f join app.synthetic_paper_deployments_v1 d using(project_ref)where f.tournament_id=tid and f.event_id=eid)then return null;end if;
 if kind_value='qualification_tie'then
  w:=public.get_qualification_tie_workspace_v1(actor,tid,eid);if w is null or jsonb_array_length(w->'blockers')<>0 then return null;end if;return w->>'sourceFingerprint';
 elsif kind_value='playoff'then
  w:=public.get_standard_singles_playoff_outcome_workspace_v4(actor,tid,eid);return w->>'sourceDigest';
 elsif kind_value='close'then
  if not exists(select 1 from app.canonical_games where tournament_id=tid and event_id=eid)or exists(select 1 from app.canonical_games where tournament_id=tid and event_id=eid and state<>'verified')then return null;end if;
  return encode(extensions.digest((select jsonb_build_object('kind','synthetic_verified_game_counts_v1','games',jsonb_agg(jsonb_build_array(id,version,state,winner_side,margin)order by id),'structuredProofGameIds',(select jsonb_agg(x.game_id order by x.game_id)from(select distinct p.game_id from app.synthetic_paper_provenance_v1 p join app.paper_game_completion_reviews r on r.completion_id=p.completion_id and r.decision='approve'where p.event_id=eid and p.phase='review')x))::text from app.canonical_games where tournament_id=tid and event_id=eid),'sha256'),'hex');
 end if;return null;
end$$;
revoke all on function app.synthetic_event_source_v1(uuid,uuid,uuid,text)from public,anon,authenticated,service_role;

-- Owner-only reviewed fixture artifact creation, not an application outcome API.
create function app.prepare_synthetic_event_artifact_v1(actor uuid,tid uuid,eid uuid,kind_value text,decision jsonb)returns uuid language plpgsql security definer set search_path=''as $$
declare source text;w jsonb;g jsonb;p jsonb;ids uuid[];aid uuid;body text;
begin
 perform 1 from app.tournaments where id=tid for update;perform 1 from app.events where id=eid and tournament_id=tid for update;
 perform 1 from app.canonical_games where event_id=eid and tournament_id=tid order by id for update;
 if not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director'))then raise exception'synthetic_director_required';end if;
 source:=app.synthetic_event_source_v1(actor,tid,eid,kind_value);if source is null then raise exception'synthetic_source_unavailable';end if;
 if kind_value='qualification_tie'then
  if jsonb_typeof(decision)is distinct from'object'or(select count(*)from jsonb_object_keys(decision))<>3 or not(decision?&array['participantIds','winnerId','method'])or jsonb_typeof(decision->'participantIds')is distinct from'array'or jsonb_array_length(decision->'participantIds')<>2 then raise exception'synthetic_decision_invalid';end if;
  select array_agg(x::uuid order by x::uuid)into ids from jsonb_array_elements_text(decision->'participantIds')x;
  w:=public.get_qualification_tie_workspace_v1(actor,tid,eid);select value into g from jsonb_array_elements(w->'groups')where value->'candidateIds'=to_jsonb(ids);
  if g is null or g->>'method'='blocked'or decision->>'method'is distinct from g->>'method'or not((decision->>'winnerId')::uuid=any(ids))or(g->>'method'='head_to_head'and decision->>'winnerId'is distinct from g->>'headToHeadWinnerId')then raise exception'synthetic_decision_invalid';end if;
  p:=jsonb_build_object('expectedSourceFingerprint',source,'participantIds',to_jsonb(ids),'winnerId',decision->'winnerId','method',decision->'method');
 elsif kind_value='playoff'then
  if jsonb_typeof(decision)is distinct from'array'or jsonb_array_length(decision)<>4 or exists(select 1 from jsonb_array_elements(decision)x where jsonb_typeof(x)is distinct from'object'or(select count(*)from jsonb_object_keys(x))<>2 or not(x?&array['winnerId','loserId']))then raise exception'synthetic_decision_invalid';end if;
  w:=public.get_standard_singles_playoff_outcome_workspace_v4(actor,tid,eid);
  -- Validate the bracket using the same source-derived participants/byes kernel.
  if app.derive_five_qualifier_playoff_v4((w->>'qualificationResultVersionId')::uuid,(select jsonb_agg(x||jsonb_build_object('evidenceNote','SYNTHETIC TEST planned series')order by n)from jsonb_array_elements(decision)with ordinality e(x,n)))is null then raise exception'synthetic_decision_invalid';end if;
  p:=jsonb_build_object('qualificationResultVersionId',w->'qualificationResultVersionId','expectedVersion',w->'currentVersion','sourceDigest',source,'series',decision);
 elsif kind_value='close'then
  if decision is distinct from'{}'::jsonb then raise exception'synthetic_decision_invalid';end if;
  p:=jsonb_build_object('scheduledGames',(select count(*)from app.canonical_games where tournament_id=tid and event_id=eid),'verifiedGames',(select count(*)from app.canonical_games where tournament_id=tid and event_id=eid and state='verified'),'structuredSyntheticGames',(select count(distinct p.game_id)from app.synthetic_paper_provenance_v1 p join app.paper_game_completion_reviews r on r.completion_id=p.completion_id and r.decision='approve'where p.event_id=eid and p.phase='review'),'legacyVerifiedGamesWithoutStructuredProof',(select count(*)from app.canonical_games g where g.tournament_id=tid and g.event_id=eid and g.state='verified'and not exists(select 1 from app.synthetic_paper_provenance_v1 p where p.game_id=g.id and p.phase='review')));
 else raise exception'synthetic_decision_invalid';end if;
 body:='SYNTHETIC EVENT EVIDENCE'||chr(10)||'Kind: '||kind_value||chr(10)||'Tournament: '||tid||chr(10)||'Event: '||eid||chr(10)||'Source: '||source||chr(10)||'Simulated outcome: '||p::text||chr(10)||'No physical play; no human review; no actual money received or moved.'||chr(10);
 insert into app.synthetic_event_artifacts_v1(tournament_id,event_id,kind,source_digest,payload,artifact_text)values(tid,eid,kind_value,source,p,body)returning id into aid;return aid;
end$$;
revoke all on function app.prepare_synthetic_event_artifact_v1(uuid,uuid,uuid,text,jsonb)from public,anon,authenticated,service_role;

create function public.get_synthetic_event_context_v1(p_actor_id uuid,p_tournament_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director','cross_checker','player','viewer'))then return null;end if;
 if not exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=p_tournament_id)then return null;end if;
 return jsonb_build_object('tournamentId',p_tournament_id,'projectRef','nnhcnvksxgxnpvdqjgpg','eventIds',(select jsonb_agg(event_id order by event_id)from app.synthetic_paper_fixtures_v1 where tournament_id=p_tournament_id),
 'artifacts',coalesce((select jsonb_agg(jsonb_build_object('artifactId',a.id,'eventId',a.event_id,'kind',a.kind,'sourceDigest',a.source_digest,'payload',a.payload,'text',a.artifact_text,'sha256',a.sha256,'reference','SYNTHETIC-EVENT-v1:'||a.id||':'||a.sha256)order by a.created_at,a.id)from app.synthetic_event_artifacts_v1 a where a.tournament_id=p_tournament_id and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director','cross_checker'))),'[]'),
 'actualMoneyReceived',false,'physicalPlay',false,'humanReviewClaimed',false);
end$$;

create function app.guard_synthetic_event_claim_v1()returns trigger language plpgsql security definer set search_path=''as $$
declare a app.synthetic_event_artifacts_v1%rowtype;kind_value text;row_data jsonb:=to_jsonb(new);actor uuid;source text;ref text;
begin
 if not exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=new.tournament_id and event_id=new.event_id)then return new;end if;
 kind_value:=case tg_table_name when'qualification_tie_resolutions_v1'then'qualification_tie'when'playoff_outcome_versions_v4'then'playoff'else'close'end;
 select * into a from app.synthetic_event_artifacts_v1 where id::text=current_setting('app.synthetic_event_artifact',true)and tournament_id=new.tournament_id and event_id=new.event_id and kind=kind_value;
 if not found then raise exception'synthetic_event_evidence_required';end if;
 actor:=coalesce((row_data->>'actor_id')::uuid,(row_data->>'recorded_by')::uuid,(row_data->>'actor_profile_id')::uuid);
 source:=app.synthetic_event_source_v1(actor,new.tournament_id,new.event_id,kind_value);
 if source is null or source<>a.source_digest then raise exception'synthetic_event_source_changed';end if;
 ref:='SYNTHETIC-EVENT-v1:'||a.id||':'||a.sha256;
 if kind_value='qualification_tie'then
  if new.source_fingerprint<>a.source_digest or to_jsonb(array[new.participant_a_id,new.participant_b_id])is distinct from a.payload->'participantIds'or new.winner_id::text is distinct from a.payload->>'winnerId'or new.method is distinct from a.payload->>'method'or new.evidence_reference<>ref or position('TEST ONLY SYNTHETIC:'in new.reason)<>1 then raise exception'synthetic_event_evidence_mismatch';end if;
 elsif kind_value='playoff'then
  if new.source_digest<>a.source_digest or new.qualification_result_version_id::text is distinct from a.payload->>'qualificationResultVersionId'
   or new.request_payload->'expectedVersion'is distinct from a.payload->'expectedVersion'
   or(select jsonb_agg(x-'evidenceNote'order by n)from jsonb_array_elements(new.series)with ordinality e(x,n))is distinct from a.payload->'series'
   or exists(select 1 from jsonb_array_elements(new.series)with ordinality e(x,n)where x->>'evidenceNote'<>ref||':'||n)
   or position('TEST ONLY SYNTHETIC:'in(new.request_payload->>'reason'))<>1 then raise exception'synthetic_event_evidence_mismatch';end if;
 else
  if new.action<>'closed'or new.scheduled_game_count is distinct from(a.payload->>'scheduledGames')::integer or new.resolved_game_count is distinct from(a.payload->>'verifiedGames')::integer or position('TEST ONLY SYNTHETIC: '||ref||' 'in new.reason)<>1 or position('TEST ONLY SYNTHETIC:'in new.reason)<>1 then raise exception'synthetic_event_evidence_mismatch';end if;
 end if;return new;
end$$;
revoke all on function app.guard_synthetic_event_claim_v1()from public,anon,authenticated,service_role;
create trigger aaa_synthetic_tie_claim_v1 before insert on app.qualification_tie_resolutions_v1 for each row execute function app.guard_synthetic_event_claim_v1();
create trigger aaa_synthetic_playoff_claim_v1 before insert on app.playoff_outcome_versions_v4 for each row execute function app.guard_synthetic_event_claim_v1();
create trigger aaa_synthetic_close_claim_v1 before insert on app.event_play_closes for each row execute function app.guard_synthetic_event_claim_v1();

create function app.synthetic_event_request_matches_v1(a app.synthetic_event_artifacts_v1,req jsonb)returns boolean language plpgsql immutable set search_path=''as $$
declare ref text:='SYNTHETIC-EVENT-v1:'||a.id||':'||a.sha256;begin
 if a.kind='qualification_tie'then return req-'reason'-'evidenceReference'=a.payload and req->>'evidenceReference'=ref and position('TEST ONLY SYNTHETIC:'in(req->>'reason'))=1;
 elsif a.kind='playoff'then return req-'reason'-'reviewed'-'series'=a.payload-'series'
  and(select jsonb_agg(x-'evidenceNote'order by n)from jsonb_array_elements(req->'series')with ordinality e(x,n))=a.payload->'series'
  and not exists(select 1 from jsonb_array_elements(req->'series')with ordinality e(x,n)where x->>'evidenceNote'<>ref||':'||n)
  and req->'reviewed'='true'::jsonb and position('TEST ONLY SYNTHETIC:'in(req->>'reason'))=1;
 elsif a.kind='close'then return position('TEST ONLY SYNTHETIC: '||ref||' 'in(req->>'reason'))=1;end if;return false;
end$$;
revoke all on function app.synthetic_event_request_matches_v1(app.synthetic_event_artifacts_v1,jsonb)from public,anon,authenticated,service_role;

-- Each wrapper is explicit. There is no user-controlled function dispatcher.
-- Artifact validation of CURRENT sources occurs in the INSERT guard after the
-- canonical writer acquires its normal locks. Accepted exact replays retain
-- their original outcome even when later source/lifecycle state changes.
create function public.save_synthetic_qualification_tie_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_artifact_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare prior text;result jsonb;a app.synthetic_event_artifacts_v1%rowtype;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or not exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=p_tournament_id and event_id=p_event_id)then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','not_director');end if;
 -- Let the canonical receipt logic detect altered same-operation requests
 -- before artifact validation; otherwise a conflict could look like a fresh
 -- rejection and incorrectly clear retained recovery work.
 if exists(select 1 from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id)then
  result:=public.save_qualification_tie_resolution_v1(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id);
  if result->>'status'='qualification_tie_recorded'and(p_artifact_id is not null or position('SYNTHETIC-EVENT-v1:'in p_request::text)>0)then
   select * into a from app.synthetic_event_artifacts_v1 where id=p_artifact_id and tournament_id=p_tournament_id and event_id=p_event_id and kind='qualification_tie';
   if not found or not coalesce(app.synthetic_event_request_matches_v1(a,p_request),false)then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','idempotency_conflict');end if;
  end if;return result;
 end if;
 if p_artifact_id is not null then select * into a from app.synthetic_event_artifacts_v1 where id=p_artifact_id and tournament_id=p_tournament_id and event_id=p_event_id and kind='qualification_tie';if not found or not coalesce(app.synthetic_event_request_matches_v1(a,p_request),false)then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','invalid_request');end if;
 elsif position('SYNTHETIC-EVENT-v1:'in(p_request::text))>0 then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','invalid_request');end if;
 prior:=current_setting('app.synthetic_event_artifact',true);perform set_config('app.synthetic_event_artifact',coalesce(p_artifact_id::text,''),true);
 result:=public.save_qualification_tie_resolution_v1(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id);
 perform set_config('app.synthetic_event_artifact',coalesce(prior,''),true);return result;
end$$;
create function public.record_synthetic_playoff_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_artifact_id uuid,p_request jsonb,p_operation_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare prior text;result jsonb;a app.synthetic_event_artifacts_v1%rowtype;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or not exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=p_tournament_id and event_id=p_event_id)then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','not_director');end if;
 -- Let the canonical receipt logic detect altered same-operation requests
 -- before artifact validation; otherwise a conflict could look like a fresh
 -- rejection and incorrectly clear retained recovery work.
 if exists(select 1 from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id)then
  result:=public.record_standard_singles_playoff_outcomes_v4(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id);
  if result->>'status'='playoff_outcomes_recorded_v4'and(p_artifact_id is not null or position('SYNTHETIC-EVENT-v1:'in p_request::text)>0)then
   select * into a from app.synthetic_event_artifacts_v1 where id=p_artifact_id and tournament_id=p_tournament_id and event_id=p_event_id and kind='playoff';
   if not found or not coalesce(app.synthetic_event_request_matches_v1(a,p_request),false)then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','idempotency_conflict');end if;
  end if;return result;
 end if;
 if p_artifact_id is not null then select * into a from app.synthetic_event_artifacts_v1 where id=p_artifact_id and tournament_id=p_tournament_id and event_id=p_event_id and kind='playoff';if not found or not coalesce(app.synthetic_event_request_matches_v1(a,p_request),false)then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','invalid_request');end if;
 elsif position('SYNTHETIC-EVENT-v1:'in(p_request::text))>0 then return jsonb_build_object('status','rejected','eventId',p_event_id,'code','invalid_request');end if;
 prior:=current_setting('app.synthetic_event_artifact',true);perform set_config('app.synthetic_event_artifact',coalesce(p_artifact_id::text,''),true);
 result:=public.record_standard_singles_playoff_outcomes_v4(p_actor_id,p_tournament_id,p_event_id,p_request,p_operation_id);
 perform set_config('app.synthetic_event_artifact',coalesce(prior,''),true);return result;
end$$;
create function public.close_synthetic_event_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_artifact_id uuid,p_reason text,p_confirmed boolean,p_operation_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare prior text;result jsonb;a app.synthetic_event_artifacts_v1%rowtype;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or not exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=p_tournament_id and event_id=p_event_id)then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))then return jsonb_build_object('status','rejected','code','not_director');end if;
 -- Let the canonical receipt logic detect altered same-operation requests
 -- before artifact validation; otherwise a conflict could look like a fresh
 -- rejection and incorrectly clear retained recovery work.
 if exists(select 1 from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id)then
  result:=public.close_event_play_v1(p_actor_id,p_tournament_id,p_event_id,p_reason,p_confirmed,p_operation_id);
  if result->>'status'='event_play_closed'and(p_artifact_id is not null or position('SYNTHETIC-EVENT-v1:'in p_reason)>0)then
   select * into a from app.synthetic_event_artifacts_v1 where id=p_artifact_id and tournament_id=p_tournament_id and event_id=p_event_id and kind='close';
   if not found or not coalesce(app.synthetic_event_request_matches_v1(a,jsonb_build_object('reason',p_reason)),false)then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  end if;return result;
 end if;
 if p_artifact_id is not null then select * into a from app.synthetic_event_artifacts_v1 where id=p_artifact_id and tournament_id=p_tournament_id and event_id=p_event_id and kind='close';if not found or not coalesce(app.synthetic_event_request_matches_v1(a,jsonb_build_object('reason',p_reason)),false)then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 elsif position('SYNTHETIC-EVENT-v1:'in p_reason)>0 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 prior:=current_setting('app.synthetic_event_artifact',true);perform set_config('app.synthetic_event_artifact',coalesce(p_artifact_id::text,''),true);
 result:=public.close_event_play_v1(p_actor_id,p_tournament_id,p_event_id,p_reason,p_confirmed,p_operation_id);
 perform set_config('app.synthetic_event_artifact',coalesce(prior,''),true);return result;
end$$;

create function app.guard_synthetic_financial_evidence_v1()returns trigger language plpgsql security definer set search_path=''as $$
declare j jsonb:=to_jsonb(new);eid uuid;memo text;begin
 if not exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=new.tournament_id)then return new;end if;
 if tg_table_name in('prize_rounding_funding_events_v8','prize_rounding_funding_events_v9','event_side_pool_payout_versions')then raise exception'synthetic_actual_funding_unsupported';end if;
 if j->>'event_type'='voided'then raise exception'synthetic_void_unsupported';end if;
 if(select count(*)from app.synthetic_paper_fixtures_v1 where tournament_id=new.tournament_id)<>1 or(select count(*)from app.events where tournament_id=new.tournament_id and operational_state='active')<>1 then raise exception'synthetic_financial_scope_ambiguous';end if;
 select event_id into eid from app.synthetic_paper_fixtures_v1 where tournament_id=new.tournament_id;
 if not exists(select 1 from app.events where id=eid and tournament_id=new.tournament_id and operational_state='active'and event_type='main'and format='standard_singles')then raise exception'synthetic_financial_scope_ambiguous';end if;
 if tg_table_name='roster_payment_events'and not exists(select 1 from app.event_participants p where p.tournament_id=new.tournament_id and p.event_id=eid and p.roster_entry_id=(j->>'roster_entry_id')::uuid)then raise exception'synthetic_financial_roster_scope';end if;
 if j?'event_id'and(j->>'event_id')::uuid<>eid then raise exception'synthetic_financial_scope_ambiguous';end if;
 memo:=case tg_table_name when'roster_payment_events'then coalesce(j->>'receipt_note',j->>'void_reason')when'tournament_expense_events'then coalesce(j->>'void_reason',j->>'description')else j->>'payment_reference'end;
 if tg_table_name='event_side_pool_election_versions'and(j->>'amount_received_minor')::bigint=0 then return new;end if;
 if position('TEST ONLY SYNTHETIC:'in coalesce(memo,''))<>1 then raise exception'synthetic_financial_memo_required';end if;return new;
end$$;
revoke all on function app.guard_synthetic_financial_evidence_v1()from public,anon,authenticated,service_role;
do $$declare t text;begin foreach t in array array['roster_payment_events','tournament_expense_events','event_side_pool_election_versions','prize_rounding_funding_events_v8','prize_rounding_funding_events_v9','event_side_pool_payout_versions']loop
 execute format('create trigger %I before insert on app.%I for each row execute function app.guard_synthetic_financial_evidence_v1()','aaa_synthetic_financial_'||t,t);
end loop;end$$;

-- New-row-only annotation: replay of a pre-enrollment receipt never inserts,
-- hence cannot acquire retroactive synthetic provenance. Any failure rolls back
-- the original record, operation receipt and annotation in the same transaction.
create function app.annotate_synthetic_event_record_v1()returns trigger language plpgsql security definer set search_path=''as $$
declare j jsonb:=to_jsonb(new);eid uuid;aid uuid;r app.operation_receipts%rowtype;digest text;begin
 if j?'event_id'then eid:=(j->>'event_id')::uuid;
 else if(select count(*)from app.synthetic_paper_fixtures_v1 where tournament_id=new.tournament_id)<>1 then return new;end if;select event_id into eid from app.synthetic_paper_fixtures_v1 where tournament_id=new.tournament_id;end if;
 if not exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=new.tournament_id and event_id=eid)then return new;end if;
 select * into r from app.operation_receipts where id=new.operation_receipt_id and tournament_id=new.tournament_id;
 if not found then raise exception'synthetic_receipt_missing';end if;
 if tg_table_name in('qualification_tie_resolutions_v1','playoff_outcome_versions_v4','event_play_closes')then
  select id,source_digest into aid,digest from app.synthetic_event_artifacts_v1 where id::text=current_setting('app.synthetic_event_artifact',true)and tournament_id=new.tournament_id and event_id=eid;
  if aid is null then raise exception'synthetic_event_evidence_required';end if;
 else digest:=coalesce(j->>'source_digest',j->>'source_fingerprint',r.request_hash);end if;
 insert into app.synthetic_event_provenance_v1(tournament_id,event_id,operation_receipt_id,entity_table,entity_id,artifact_id,source_digest,record_sha256)
 values(new.tournament_id,eid,r.id,tg_table_name,new.id,aid,digest,encode(extensions.digest(j::text,'sha256'),'hex'));
 return new;
end$$;
revoke all on function app.annotate_synthetic_event_record_v1()from public,anon,authenticated,service_role;
do $$declare t text;begin foreach t in array array['qualification_tie_resolutions_v1','playoff_outcome_versions_v4','event_play_closes','qualification_result_versions','cross_check_finalizations','prize_accounting_drafts_v8','prize_accounting_finals_v8','prize_accounting_drafts_v9','prize_accounting_finals_v9','roster_payment_events','tournament_expense_events','event_side_pool_election_versions','q_obligation_reviews_v2','side_pool_recipient_reviews_v3']loop
 execute format('create trigger %I after insert on app.%I for each row execute function app.annotate_synthetic_event_record_v1()','synthetic_provenance_'||t,t);
end loop;end$$;

revoke all on function public.get_synthetic_event_context_v1(uuid,uuid)from public,anon,authenticated;
revoke all on function public.save_synthetic_qualification_tie_v1(uuid,uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
revoke all on function public.record_synthetic_playoff_v1(uuid,uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
revoke all on function public.close_synthetic_event_v1(uuid,uuid,uuid,uuid,text,boolean,uuid)from public,anon,authenticated;
grant execute on function public.get_synthetic_event_context_v1(uuid,uuid)to service_role;
grant execute on function public.save_synthetic_qualification_tie_v1(uuid,uuid,uuid,uuid,jsonb,uuid)to service_role;
grant execute on function public.record_synthetic_playoff_v1(uuid,uuid,uuid,uuid,jsonb,uuid)to service_role;
grant execute on function public.close_synthetic_event_v1(uuid,uuid,uuid,uuid,text,boolean,uuid)to service_role;
commit;
