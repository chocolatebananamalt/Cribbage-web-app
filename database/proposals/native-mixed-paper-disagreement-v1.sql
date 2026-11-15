-- PRIVATE DEFAULT-OFF native fictional independent Paper disagreement.
-- Depends on exact closed native-mixed-game-reopen-v1.sql SHA256
-- 2f3f5a09da1caebf9bd96137435bb19b31f0e8ba49c12a81ab75d5b1421ee998.
-- This separate delta preserves that prior candidate and every historical row.
-- No ordinary scores, eligibility, MRPs, money, grants or policy overrides.
begin;
create function app.native_mixed_paper_disagreement_enabled_v1()returns boolean
language sql immutable set search_path=''set timezone='UTC'as $$select false$$;

create or replace function app.native_mixed_game_request_valid_v1(v jsonb)returns boolean
language plpgsql immutable set search_path=''as $$declare p jsonb;item_value jsonb;begin
 if app.native_mixed_game_exact_v1(v,array['kind','operationId','startId','gameId','expectedStartSourceDigest','expectedRevision','expectedHistoryDigest','action','payload'])is distinct from true
  or v->>'kind'is distinct from'native-mixed-simulation-game-write-v1'
  or app.native_mixed_simulation_uuid_v1(v->>'operationId')is distinct from true
  or app.native_mixed_simulation_uuid_v1(v->>'startId')is distinct from true
  or app.native_mixed_simulation_uuid_v1(v->>'gameId')is distinct from true
  or jsonb_typeof(v->'expectedStartSourceDigest')is distinct from'string'
  or coalesce(v->>'expectedStartSourceDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(v->'expectedHistoryDigest')is distinct from'string'
  or coalesce(v->>'expectedHistoryDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(v->'expectedRevision')is distinct from'number'
  or coalesce(v->>'expectedRevision','')!~'^[0-3]$'then return false;end if;
 p:=v->'payload';
 case v->>'action'
 when'digital-submit'then
  return app.native_mixed_game_exact_v1(p,array['participantId','result','statement'])is true
   and app.native_mixed_simulation_uuid_v1(p->>'participantId')is true
   and app.native_mixed_game_result_valid_v1(p->'result')is true and p->>'statement'is not distinct from'simulation-own-result-v1';
 when'digital-confirm'then
  if app.native_mixed_game_exact_v1(p,array['participantId','result','references','statement'])is distinct from true
   or app.native_mixed_simulation_uuid_v1(p->>'participantId')is distinct from true
   or app.native_mixed_game_result_valid_v1(p->'result')is distinct from true
   or p->>'statement'is distinct from'simulation-own-confirmation-v1'
   or jsonb_typeof(p->'references')is distinct from'array'then return false;end if;
  if jsonb_array_length(p->'references')not between 2 and 3 then return false;end if;
  for item_value in select value from jsonb_array_elements(p->'references')loop
   if jsonb_typeof(item_value)is distinct from'string'or app.native_mixed_simulation_uuid_v1(item_value#>>'{}')is distinct from true then return false;end if;
  end loop;
  return(select count(distinct x#>>'{}')from jsonb_array_elements(p->'references')x)=jsonb_array_length(p->'references');
 when'paper-capture'then
  if app.native_mixed_game_exact_v1(p,array['artifactId','claims','physicalOriginal','fictionalOpponentPlayed','independentHumanPlayClaimed','statement'])is distinct from true
   or app.native_mixed_simulation_uuid_v1(p->>'artifactId')is distinct from true
   or p->'physicalOriginal'is distinct from'false'::jsonb or p->'fictionalOpponentPlayed'is distinct from'false'::jsonb
   or p->'independentHumanPlayClaimed'is distinct from'false'::jsonb
   or p->>'statement'is distinct from'fictional-paper-capture-v1'or jsonb_typeof(p->'claims')is distinct from'array'then return false;end if;
  if jsonb_array_length(p->'claims')not between 1 and 2 then return false;end if;
  for item_value in select value from jsonb_array_elements(p->'claims')loop
   if app.native_mixed_game_exact_v1(item_value,array['side','result'])is distinct from true or coalesce(item_value->>'side','')not in('a','b')
    or app.native_mixed_game_result_valid_v1(item_value->'result')is distinct from true then return false;end if;
  end loop;
  return(select count(distinct x->>'side')from jsonb_array_elements(p->'claims')x)=jsonb_array_length(p->'claims');
 when'paper-review'then
  if(app.native_mixed_game_exact_v1(p,array['captureId','artifactId','artifactDigest','reenteredClaims','decision','statement'])is true
   and app.native_mixed_simulation_uuid_v1(p->>'captureId')is true and app.native_mixed_simulation_uuid_v1(p->>'artifactId')is true
   and jsonb_typeof(p->'artifactDigest')='string'and coalesce(p->>'artifactDigest','')~'^[a-f0-9]{64}$'
   and p->>'decision'in('accepted-simulation-only','disputed-simulation-only')and p->>'statement'is not distinct from'fictional-paper-review-v1')is distinct from true then return false;end if;
  if jsonb_typeof(p->'reenteredClaims')is distinct from'array'then return false;end if;
  if jsonb_array_length(p->'reenteredClaims')not between 1 and 2 then return false;end if;
  for item_value in select value from jsonb_array_elements(p->'reenteredClaims')loop
   if app.native_mixed_game_exact_v1(item_value,array['side','result'])is distinct from true or coalesce(item_value->>'side','')not in('a','b')
    or app.native_mixed_game_result_valid_v1(item_value->'result')is distinct from true then return false;end if;
  end loop;
  return(select count(distinct x->>'side')from jsonb_array_elements(p->'reenteredClaims')x)=jsonb_array_length(p->'reenteredClaims');
 else return false;end case;end$$;

create or replace function app.native_mixed_game_entry_bound_with_start_v1(entry_value uuid,s app.native_mixed_simulation_starts_v1)returns boolean
language plpgsql stable security definer set search_path=''as $$declare e app.native_mixed_game_evidence_v1%rowtype;
 r app.operation_receipts%rowtype;a app.native_mixed_game_artifacts_v1%rowtype;capture_entry app.native_mixed_game_evidence_v1%rowtype;h jsonb;hd text;begin
 select*into e from app.native_mixed_game_all_evidence_v1() where id=entry_value;if not found then return false;end if;
 if app.native_mixed_game_entry_attempt_v1(e.id)is not null and app.native_mixed_game_reopen_bound_v1(app.native_mixed_game_entry_attempt_v1(e.id))is distinct from true then return false;end if;
 select*into r from app.operation_receipts where id=e.operation_receipt_id;
 if s.id is null or s.tournament_id<>e.tournament_id or s.event_id<>e.event_id or s.id<>e.start_id or not exists(select 1 from app.native_mixed_simulation_starts_v1 stored where stored.id=s.id and stored=s)
  or app.native_mixed_game_request_valid_v1(e.request_payload)is distinct from true
  or r.id is null or r.actor_profile_id<>e.actor_id or r.client_operation_id<>e.operation_id or r.tournament_id<>e.tournament_id
  or r.operation_type<>'native_mixed_simulation_game_evidence_v1'or r.target_id<>e.id or r.outcome<>'accepted'
  or r.request_hash<>app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-game-write-v1',e.actor_id,e.tournament_id,e.event_id,e.request_payload))
  or e.entry->>'id'is distinct from e.id::text or e.entry->>'actorId'is distinct from e.actor_id::text or e.entry->>'receiptId'is distinct from e.operation_receipt_id::text
  or e.entry->>'tournamentId'is distinct from e.tournament_id::text or e.entry->>'eventId'is distinct from e.event_id::text
  or e.request_payload->>'expectedStartSourceDigest'is distinct from s.source_digest
  or e.request_payload->'expectedRevision'is distinct from to_jsonb(e.sequence-1)
  or e.entry->>'payloadDigest'is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-evidence-v1',e.entry-'payloadDigest',e.authority_capture))
  or e.entry->>'startSourceDigest'is distinct from s.source_digest or e.entry->>'gameId'is distinct from e.game_id::text or e.entry->>'startId'is distinct from e.start_id::text
  or e.entry->>'operationId'is distinct from e.operation_id::text or e.entry->'sequence'is distinct from to_jsonb(e.sequence)
  or e.entry->>'action'is distinct from e.request_payload->>'action'
  or(e.entry-'payloadDigest'-array['id','operationId','receiptId','sequence','actorId','tournamentId','eventId','startId','gameId','startSourceDigest','action'])
    is distinct from(e.request_payload->'payload'||case when e.entry->>'action'='paper-capture'then jsonb_build_object('artifactDigest',e.entry->>'artifactDigest')else'{}'::jsonb end)
  or e.authority_capture->>'subjectId'is distinct from e.actor_id::text or app.native_mixed_simulation_uuid_v1(e.authority_capture->>'sessionId')is distinct from true
 then return false;end if;
 if e.entry->>'action'in('paper-capture','paper-review')then
  if app.native_mixed_game_exact_v1(e.authority_capture,array['subjectId','sessionId','roles','paperIdentityChecked','nonselfChecked','paperIdentityBindingId'])is distinct from true
   or e.authority_capture->'paperIdentityChecked'is distinct from'true'::jsonb or e.authority_capture->'nonselfChecked'is distinct from'true'::jsonb
   or app.native_mixed_simulation_uuid_v1(e.authority_capture->>'paperIdentityBindingId')is distinct from true
   or not exists(select 1 from app.paper_official_identity_bindings b where b.id=(e.authority_capture->>'paperIdentityBindingId')::uuid and b.tournament_id=e.tournament_id and b.official_profile_id=e.actor_id)
   or(e.entry->>'action'='paper-capture'and not(e.authority_capture->'roles'?'cross_checker'))
   or(e.entry->>'action'='paper-review'and not(e.authority_capture->'roles'?|array['director','co_director','cross_checker']))then return false;end if;
 else
  if app.native_mixed_game_exact_v1(e.authority_capture,array['subjectId','sessionId','roles'])is distinct from true
   or not exists(select 1 from app.native_mixed_simulation_publication_contexts_v1 c,
    lateral jsonb_array_elements(c.source_capture#>'{attendance,digitalConsents}')d
    where c.id=s.publication_context_id and d->>'profileId'=e.actor_id::text and d->>'participantId'=e.entry->>'participantId')then return false;end if;
 end if;
 if e.entry->>'action'='paper-capture'then
  select*into a from app.native_mixed_game_all_artifacts_v1() where id=(e.entry->>'artifactId')::uuid and start_id=e.start_id and game_id=e.game_id;
  if a.id is null or a.creator_id<>e.actor_id or a.operation_receipt_id<>r.id or a.sha256<>e.entry->>'artifactDigest'
   or a.body is distinct from jsonb_build_object('kind','native-mixed-fictional-paper-v1','tournamentId',e.tournament_id,'eventId',e.event_id,
    'startId',e.start_id,'gameId',e.game_id,'claims',e.entry->'claims','physicalOriginal',false,'fictionalOpponentPlayed',false,'independentHumanPlayClaimed',false)then return false;end if;
 end if;
 if e.entry->>'action'='paper-review'then
  select*into capture_entry from app.native_mixed_game_all_evidence_v1() where id=(e.entry->>'captureId')::uuid and start_id=e.start_id and game_id=e.game_id and sequence<e.sequence and app.native_mixed_game_entry_attempt_v1(id)is not distinct from app.native_mixed_game_entry_attempt_v1(e.id);
  if capture_entry.id is null or capture_entry.entry->>'action'is distinct from'paper-capture'or capture_entry.actor_id=e.actor_id
   or e.entry->>'artifactId'is distinct from capture_entry.entry->>'artifactId'or e.entry->>'artifactDigest'is distinct from capture_entry.entry->>'artifactDigest'
   or(select jsonb_agg(x->'side'order by x->>'side')from jsonb_array_elements(e.entry->'reenteredClaims')x)is distinct from(select jsonb_agg(x->'side'order by x->>'side')from jsonb_array_elements(capture_entry.entry->'claims')x)
    or(e.entry->>'decision'='accepted-simulation-only'and (select jsonb_agg(x order by x->>'side')from jsonb_array_elements(e.entry->'reenteredClaims')x)is distinct from(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(capture_entry.entry->'claims')x))
    or(e.entry->>'decision'='disputed-simulation-only'and((select jsonb_agg(x order by x->>'side')from jsonb_array_elements(e.entry->'reenteredClaims')x)is not distinct from(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(capture_entry.entry->'claims')x)or exists(select 1 from app.native_mixed_game_attempt_history_v1(e.start_id,e.game_id,app.native_mixed_game_entry_attempt_v1(e.id))previous where previous.sequence<e.sequence and previous.entry->>'action'='digital-confirm')))then return false;end if;
 end if;
 select coalesce(jsonb_agg(x.entry order by x.sequence),'[]')into h from app.native_mixed_game_all_evidence_v1() x where x.start_id=e.start_id and x.game_id=e.game_id and x.sequence<e.sequence and app.native_mixed_game_entry_attempt_v1(x.id)is not distinct from app.native_mixed_game_entry_attempt_v1(e.id);
 if jsonb_array_length(h)<>e.sequence-1 or e.request_payload->>'expectedHistoryDigest'is distinct from app.native_mixed_game_attempt_digest_v1(e.start_id,e.game_id,s.source_digest,h,app.native_mixed_game_entry_attempt_v1(e.id))then return false;end if;
 h:=h||jsonb_build_array(e.entry);
 if jsonb_array_length(h)<>e.sequence then return false;end if;
 hd:=app.native_mixed_game_attempt_digest_v1(e.start_id,e.game_id,s.source_digest,h,app.native_mixed_game_entry_attempt_v1(e.id));
 return r.response_payload=app.native_mixed_game_receipt_v1(e,hd)and exists(select 1 from app.audit_events v
 where v.tournament_id=e.tournament_id and v.actor_profile_id=e.actor_id and v.operation_receipt_id=r.id
  and v.entity_type='native_mixed_simulation_game_evidence'and v.entity_id=e.id and v.action='simulation_game_evidence_recorded'and v.after_state=r.response_payload);end$$;

create or replace function app.native_mixed_game_complete_with_start_v1(tid uuid,eid uuid,s app.native_mixed_simulation_starts_v1,gid uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$
declare sid uuid:=s.id;g app.canonical_games%rowtype;h jsonb;subs jsonb;confirms jsonb;capture_value jsonb;review_value jsonb;refs jsonb;results jsonb;digital_ids uuid[];digital_profiles uuid[];paper_sides text[];people_count integer;row_value record;
begin
 select*into g from app.canonical_games where id=gid and tournament_id=tid and event_id=eid;if not found then return false;end if;
 if not exists(select 1 from app.native_mixed_simulation_starts_v1 st where st.id=sid and st.tournament_id=tid and st.event_id=eid and st=s
  and exists(select 1 from jsonb_array_elements(st.source_capture->'canonicalGames')x where x->>'gameId'=gid::text))then return false;end if;
 select count(*),array_agg(p.id)filter(where r.scorecard_type='digital'),array_agg(p.profile_id)filter(where r.scorecard_type='digital'),
 array_agg(case when p.id=g.side_a_participant_id then'a'else'b'end order by case when p.id=g.side_a_participant_id then'a'else'b'end)filter(where r.scorecard_type='paper')
 into people_count,digital_ids,digital_profiles,paper_sides from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=tid
 where p.event_id=eid and p.id in(g.side_a_participant_id,g.side_b_participant_id);
 if people_count<>2 or coalesce(cardinality(digital_ids),0)+coalesce(cardinality(paper_sides),0)<>2 then return false;end if;
 select coalesce(jsonb_agg(entry order by sequence),'[]')into h from app.native_mixed_game_active_evidence_v1(sid,gid) where tournament_id=tid and event_id=eid and start_id=sid and game_id=gid;
 if exists(select 1 from jsonb_array_elements(h)x where x->>'action'='paper-review'and x->>'decision'is distinct from'accepted-simulation-only')then return false;end if;
 if jsonb_array_length(h)<>(case when coalesce(cardinality(digital_ids),0)=0 then 2 else 4 end)then return false;end if;
 for row_value in select id from app.native_mixed_game_active_evidence_v1(sid,gid) where tournament_id=tid and event_id=eid and start_id=sid and game_id=gid loop
  if app.native_mixed_game_entry_bound_with_start_v1(row_value.id,s)is distinct from true then return false;end if;
 end loop;
 select coalesce(jsonb_agg(x),'[]')into subs from jsonb_array_elements(h)x where x->>'action'='digital-submit';
 select coalesce(jsonb_agg(x),'[]')into confirms from jsonb_array_elements(h)x where x->>'action'='digital-confirm';
 if jsonb_array_length(subs)<>coalesce(cardinality(digital_ids),0)or jsonb_array_length(confirms)<>coalesce(cardinality(digital_ids),0)
  or(select count(distinct x->>'participantId')from jsonb_array_elements(subs)x)<>coalesce(cardinality(digital_ids),0)
  or(select count(distinct x->>'participantId')from jsonb_array_elements(confirms)x)<>coalesce(cardinality(digital_ids),0)
  or exists(select 1 from jsonb_array_elements(subs||confirms)x where not exists(select 1 from app.event_participants p where p.event_id=eid and p.id=any(digital_ids)and p.id::text=x->>'participantId'and p.profile_id::text=x->>'actorId'))then return false;end if;
 if(select count(*)from jsonb_array_elements(h)x where x->>'action'='paper-capture')<>(case when coalesce(cardinality(paper_sides),0)>0 then 1 else 0 end)
  or(select count(*)from jsonb_array_elements(h)x where x->>'action'='paper-review')<>(case when coalesce(cardinality(paper_sides),0)>0 then 1 else 0 end) then return false;end if;
 select x into capture_value from jsonb_array_elements(h)x where x->>'action'='paper-capture';select x into review_value from jsonb_array_elements(h)x where x->>'action'='paper-review';
 if capture_value is not null then
  if capture_value->>'actorId'=review_value->>'actorId'or (capture_value->>'actorId')::uuid=any(digital_profiles)or(review_value->>'actorId')::uuid=any(digital_profiles)
   or(select jsonb_agg(x->>'side'order by x->>'side')from jsonb_array_elements(capture_value->'claims')x)is distinct from to_jsonb(paper_sides)
   or review_value->>'captureId'is distinct from capture_value->>'id'then return false;end if;
 end if;
 select coalesce(jsonb_agg(result_value),'[]')into results from(select x->'result'result_value from jsonb_array_elements(subs)x union all select x->'result'from jsonb_array_elements(coalesce(capture_value->'claims','[]'))x)y;
 if jsonb_array_length(results)<>2 or(select count(distinct x)from jsonb_array_elements(results)x)<>1 then return false;end if;
 select jsonb_agg(to_jsonb(x->>'id')order by x->>'id')into refs from jsonb_array_elements(h)x where x->>'action'<>'digital-confirm';
 if exists(select 1 from jsonb_array_elements(confirms)c where c->'result'is distinct from results->0
  or(select jsonb_agg(x order by x#>>'{}')from jsonb_array_elements(c->'references')x)is distinct from refs
  or exists(select 1 from jsonb_array_elements(h)x where x->>'action'<>'digital-confirm'and(x->>'sequence')::integer>=(c->>'sequence')::integer))then return false;end if;
 return true;
end$$;

create or replace function app.append_native_mixed_simulation_game_evidence_v1(tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare verified_start app.native_mixed_simulation_starts_v1%rowtype;actor uuid;op uuid;sid uuid;gid uuid;g app.canonical_games%rowtype;root jsonb;start_digest text;
 old app.operation_receipts%rowtype;e app.native_mixed_game_evidence_v1%rowtype;row_value record;history jsonb;revision_value integer;hd text;
 payload jsonb;action_value text;digital uuid[];paper_sides text[];actor_own uuid;capture jsonb;review jsonb;submissions jsonb;results jsonb;refs jsonb;
 idv uuid:=extensions.gen_random_uuid();receipt_id uuid:=extensions.gen_random_uuid();request_hash text;body jsonb;entry_value jsonb;authority jsonb;artifact jsonb;artifact_digest text;response jsonb;roles jsonb;
begin
 if app.native_mixed_game_writer_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 actor:=app.native_mixed_game_own_subject_v1();if actor is null or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 if app.native_mixed_game_request_valid_v1(request)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(request->>'operationId')::uuid;sid:=(request->>'startId')::uuid;gid:=(request->>'gameId')::uuid;payload:=request->'payload';action_value:=request->>'action';
 request_hash:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-game-write-v1',actor,tid,eid,request));
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-game:'||sid::text||':'||gid::text,0))
 then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then
  if old.operation_type='native_mixed_game_closed_v1'then
   response:=app.native_mixed_game_closed_receipt_v1(old,actor,tid,eid,request);
   return coalesce(response,jsonb_build_object('status','rejected','code','idempotency_conflict'));end if;
  if old.tournament_id<>tid or old.operation_type<>'native_mixed_simulation_game_evidence_v1'or old.request_hash<>request_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select*into e from app.native_mixed_game_all_evidence_v1() where operation_receipt_id=old.id and tournament_id=tid and event_id=eid and actor_id=actor;
  if e.id is null or app.native_mixed_game_entry_bound_v1(e.id)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  return old.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);
 if root is null or root->>'startSourceDigest'is distinct from request->>'expectedStartSourceDigest'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 select*into verified_start from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
 start_digest:=root->>'startSourceDigest';
 select*into g from app.canonical_games where id=gid and tournament_id=tid and event_id=eid for share nowait;
 if not found or not exists(select 1 from jsonb_array_elements(root#>'{source,canonicalGames}')x where x->>'gameId'=gid::text)then return jsonb_build_object('status','rejected','code','game_not_in_scope');end if;
 lock table app.native_mixed_game_reopens_v1,app.native_mixed_game_attempt_evidence_v1,app.native_mixed_game_attempt_artifacts_v1,app.native_mixed_game_evidence_v1,app.native_mixed_game_artifacts_v1,app.paper_official_identity_bindings in share row exclusive mode nowait;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true
  or exists(select 1 from app.native_mixed_simulation_cancellations_v1 where actor_id=actor and operation_id=op)
 then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 for row_value in select id from app.native_mixed_game_active_evidence_v1(sid,gid) where start_id=sid and game_id=gid loop
  if app.native_mixed_game_entry_bound_with_start_v1(row_value.id,verified_start)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;end loop;
 select coalesce(jsonb_agg(x.entry order by x.sequence),'[]'),count(*)into history,revision_value from app.native_mixed_game_active_evidence_v1(sid,gid) x where start_id=sid and game_id=gid;
 hd:=app.native_mixed_game_attempt_digest_v1(sid,gid,start_digest,history,app.native_mixed_game_active_attempt_v1(sid,gid));
 if revision_value<>(request->>'expectedRevision')::integer or hd<>request->>'expectedHistoryDigest'then return jsonb_build_object('status','rejected','code','history_changed');end if;
 if revision_value>=4 then return jsonb_build_object('status','rejected','code','evidence_complete_or_review_required');end if;
 select array_agg(p.id order by p.id)filter(where r.scorecard_type='digital'),array_agg(case when p.id=g.side_a_participant_id then'a'else'b'end order by p.id)filter(where r.scorecard_type='paper')
 into digital,paper_sides from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
 where p.id in(g.side_a_participant_id,g.side_b_participant_id)and p.event_id=eid;
 select p.id into actor_own from app.event_participants p join app.roster_account_links l on l.tournament_id=p.tournament_id and l.roster_entry_id=p.roster_entry_id and l.profile_id=p.profile_id
 where p.id=any(digital)and p.profile_id=actor and p.event_id=eid;
 select value into capture from jsonb_array_elements(history)x where x->>'action'='paper-capture';
 select value into review from jsonb_array_elements(history)x where x->>'action'='paper-review';
 select coalesce(jsonb_agg(x),'[]')into submissions from jsonb_array_elements(history)x where x->>'action'='digital-submit';
 select coalesce(jsonb_agg(v),'[]')into results from(
  select x->'result'v from jsonb_array_elements(submissions)x
  union all select x->'result'from jsonb_array_elements(coalesce(capture->'claims','[]'))x)y;
 if(select count(distinct v)from jsonb_array_elements(results)v)>1
  or exists(select 1 from jsonb_array_elements(history)x where x->>'action'='paper-review'and x->>'decision'='disputed-simulation-only')then return jsonb_build_object('status','rejected','code','mismatch_requires_review');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor for share nowait;
 select coalesce(jsonb_agg(role order by role),'[]')into roles from app.tournament_roles where tournament_id=tid and profile_id=actor;
 authority:=jsonb_build_object('subjectId',actor,'sessionId',auth.jwt()->>'session_id','roles',roles);
 if action_value in('digital-submit','digital-confirm')then
  if actor_own is null or actor_own::text<>payload->>'participantId'then return jsonb_build_object('status','rejected','code','own_digital_side_required');end if;
  if app.native_mixed_game_play_order_with_start_v1(tid,eid,verified_start,gid,actor_own)is distinct from'current'then return jsonb_build_object('status','rejected','code','prior_game_incomplete');end if;
  if action_value='digital-submit'then
   if exists(select 1 from jsonb_array_elements(submissions)x where x->>'participantId'=actor_own::text)
    or exists(select 1 from jsonb_array_elements(history)x where x->>'action'='digital-confirm')then return jsonb_build_object('status','rejected','code','evidence_complete_or_review_required');end if;
  else
   if jsonb_array_length(submissions)<>cardinality(digital)or(coalesce(cardinality(paper_sides),0)>0 and review is null)
    or exists(select 1 from jsonb_array_elements(history)x where x->>'action'='digital-confirm'and x->>'participantId'=actor_own::text)
    or jsonb_array_length(results)=0 or payload->'result'is distinct from results->0
   then return jsonb_build_object('status','rejected','code','exact_confirmation_required');end if;
   select jsonb_agg(to_jsonb(x->>'id')order by x->>'id')into refs from jsonb_array_elements(history)x where x->>'action'in('digital-submit','paper-capture','paper-review');
   if refs is distinct from(select jsonb_agg(x order by x#>>'{}')from jsonb_array_elements(payload->'references')x)then return jsonb_build_object('status','rejected','code','exact_confirmation_required');end if;
  end if;
 else
  if coalesce(cardinality(paper_sides),0)=0 or actor_own is not null
   or app.paper_official_identity_is_current_valid(actor,tid)is distinct from true or app.paper_official_is_independent(actor,tid,gid)is distinct from true
  then return jsonb_build_object('status','rejected','code','independent_official_required');end if;
  authority:=authority||jsonb_build_object('paperIdentityChecked',true,'nonselfChecked',true,'paperIdentityBindingId',
   (select id from app.paper_official_identity_bindings where tournament_id=tid and official_profile_id=actor order by binding_version desc limit 1));
  if action_value='paper-capture'then
   if not(roles?'cross_checker')or capture is not null or jsonb_array_length(payload->'claims')<>cardinality(paper_sides)
    or exists(select 1 from jsonb_array_elements(payload->'claims')x where not(x->>'side'=any(paper_sides)))
   then return jsonb_build_object('status','rejected','code','paper_capture_required');end if;
   artifact:=jsonb_build_object('kind','native-mixed-fictional-paper-v1','tournamentId',tid,'eventId',eid,'startId',sid,'gameId',gid,
    'claims',payload->'claims','physicalOriginal',false,'fictionalOpponentPlayed',false,'independentHumanPlayClaimed',false);
   if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-artifact:'||(payload->>'artifactId'),0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
   if exists(select 1 from app.native_mixed_game_all_artifacts_v1()where id=(payload->>'artifactId')::uuid)then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
   artifact_digest:=app.native_mixed_simulation_hash_v1(artifact);payload:=payload||jsonb_build_object('artifactDigest',artifact_digest);
  else
   if not(roles?|array['director','co_director','cross_checker'])or capture is null or review is not null
    or capture->>'actorId'=actor::text or payload->>'captureId'<>capture->>'id'
    or payload->>'artifactId'<>capture->>'artifactId'or payload->>'artifactDigest'<>capture->>'artifactDigest'
    or(select jsonb_agg(x->'side'order by x->>'side')from jsonb_array_elements(payload->'reenteredClaims')x)is distinct from(select jsonb_agg(x->'side'order by x->>'side')from jsonb_array_elements(capture->'claims')x)
    or(payload->>'decision'='accepted-simulation-only'and (select jsonb_agg(x order by x->>'side')from jsonb_array_elements(payload->'reenteredClaims')x)is distinct from(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(capture->'claims')x))
    or(payload->>'decision'='disputed-simulation-only'and((select jsonb_agg(x order by x->>'side')from jsonb_array_elements(payload->'reenteredClaims')x)is not distinct from(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(capture->'claims')x)or exists(select 1 from jsonb_array_elements(history)x where x->>'action'='digital-confirm')))
   then return jsonb_build_object('status','rejected','code','independent_paper_review_required');end if;
  end if;
 end if;
 -- Only a fully validated fresh intent reaches this no-write retry branch.
 -- Old accepted receipts replay above even while the new append mode is off.
 if action_value='paper-review'and payload->>'decision'='disputed-simulation-only'and app.native_mixed_paper_disagreement_enabled_v1()is distinct from true then return jsonb_build_object('status','retry_exact','code','paper_disagreement_unavailable');end if;
 body:=jsonb_build_object('id',idv,'operationId',op,'receiptId',receipt_id,'sequence',revision_value+1,'actorId',actor,
 'tournamentId',tid,'eventId',eid,'startId',sid,'gameId',gid,'startSourceDigest',start_digest,'action',action_value)||payload;
 entry_value:=body||jsonb_build_object('payloadDigest',app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-evidence-v1',body,authority)));
 select idv,tid,eid,sid,gid,revision_value+1,actor,op,receipt_id,request,entry_value,authority,clock_timestamp()into e;
 history:=history||jsonb_build_array(entry_value);hd:=app.native_mixed_game_attempt_digest_v1(sid,gid,start_digest,history,app.native_mixed_game_active_attempt_v1(sid,gid));
 response:=app.native_mixed_game_receipt_v1(e,hd);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(receipt_id,tid,actor,'native_mixed_simulation_game_evidence_v1',idv,request_hash,op,'accepted',response,clock_timestamp());
 if action_value='paper-capture'then
  if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-artifact:'||(payload->>'artifactId'),0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
  if exists(select 1 from app.native_mixed_game_all_artifacts_v1()where id=(payload->>'artifactId')::uuid)then raise exception 'Artifact identity collision';end if;
  if app.native_mixed_game_active_attempt_v1(sid,gid)is not null then
   insert into app.native_mixed_game_attempt_artifacts_v1(attempt_id,id,tournament_id,event_id,start_id,game_id,creator_id,operation_receipt_id,body,sha256)
   values(app.native_mixed_game_active_attempt_v1(sid,gid),(payload->>'artifactId')::uuid,tid,eid,sid,gid,actor,receipt_id,artifact,artifact_digest);
  else
  insert into app.native_mixed_game_artifacts_v1(id,tournament_id,event_id,start_id,game_id,creator_id,operation_receipt_id,body,sha256)
  values((payload->>'artifactId')::uuid,tid,eid,sid,gid,actor,receipt_id,artifact,artifact_digest);end if;end if;
 if app.native_mixed_game_active_attempt_v1(sid,gid)is null then
  insert into app.native_mixed_game_evidence_v1 select(e).*;
 else insert into app.native_mixed_game_attempt_evidence_v1 select app.native_mixed_game_active_attempt_v1(sid,gid),(e).*;end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(tid,actor,receipt_id,'native_mixed_simulation_game_evidence',idv,'simulation_game_evidence_recorded',response);
 if app.native_mixed_game_entry_bound_with_start_v1(idv,verified_start)is distinct from true then raise exception'simulation evidence postcondition failed';end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create or replace function app.native_mixed_game_reopen_block_v1(tid uuid,eid uuid,sid uuid,gid uuid)returns text
language plpgsql security definer set search_path=''set timezone='UTC'as $$declare st app.native_mixed_simulation_starts_v1%rowtype;g app.canonical_games%rowtype;h jsonb;results jsonb;v record;round_value integer;begin
 select*into st from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
 select*into g from app.canonical_games where id=gid and tournament_id=tid and event_id=eid;
 if st.id is null or g.id is null then return'source_changed';end if;
 for v in select id from app.native_mixed_game_active_evidence_v1(sid,gid)loop
  if app.native_mixed_game_entry_bound_with_start_v1(v.id,st)is distinct from true then return'operation_history_unavailable';end if;
 end loop;
 if app.native_mixed_game_complete_with_start_v1(tid,eid,st,gid)is true then return'game_already_complete';end if;
 select coalesce(jsonb_agg(entry order by sequence),'[]')into h from app.native_mixed_game_active_evidence_v1(sid,gid);
 select coalesce(jsonb_agg(result),'[]')into results from(
  select x->'result'result from jsonb_array_elements(h)x where x->>'action'='digital-submit'
  union all select c->'result'from jsonb_array_elements(h)x,lateral jsonb_array_elements(x->'claims')c where x->>'action'='paper-capture')r;
 if not exists(select 1 from jsonb_array_elements(h)x where x->>'action'='paper-review'and x->>'decision'='disputed-simulation-only')
  and(jsonb_array_length(results)<>2 or(select count(distinct x)from jsonb_array_elements(results)x)<>2)then return'game_not_mismatched';end if;
 select round_number into round_value from app.rounds where id=g.round_id and event_id=eid;
 if round_value is null then return'source_changed';end if;
 if exists(select 1 from app.canonical_games later join app.rounds rn on rn.id=later.round_id and rn.event_id=eid
  join app.native_mixed_game_all_evidence_v1()e on e.start_id=sid and e.game_id=later.id
  where later.tournament_id=tid and later.event_id=eid and rn.round_number>round_value
   and(g.side_a_participant_id in(later.side_a_participant_id,later.side_b_participant_id)or g.side_b_participant_id in(later.side_a_participant_id,later.side_b_participant_id)))then return'later_evidence_exists';end if;
 if exists(select 1 from app.qualification_result_versions where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_mixed_playoff_contexts_v1 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid and kind='finalize-unpaid')
  or exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='final')then return'downstream_closed';end if;
 return null;end$$;

create or replace function app.get_native_mixed_simulation_game_state_v1(tid uuid,eid uuid,sid uuid,gid uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$declare verified_start app.native_mixed_simulation_starts_v1%rowtype;actor uuid;root jsonb;g app.canonical_games%rowtype;h jsonb;hd text;row_value record;blind boolean;private_start_key uuid;own_participant uuid;play_order text;begin
 if app.native_mixed_game_writer_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 actor:=app.native_mixed_game_own_subject_v1();if actor is null then return null;end if;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);if root is null then return jsonb_build_object('status','blocked','code','source_changed');end if;
 select*into verified_start from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
 select*into g from app.canonical_games where id=gid and tournament_id=tid and event_id=eid;if not found then return null;end if;
 if not exists(select 1 from app.event_participants where id in(g.side_a_participant_id,g.side_b_participant_id)and profile_id=actor)
  and not(exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director','cross_checker'))and app.paper_official_identity_is_current_valid(actor,tid)and app.paper_official_is_independent(actor,tid,gid))then return null;end if;
 lock table app.native_mixed_game_reopens_v1,app.native_mixed_game_attempt_evidence_v1,app.native_mixed_game_attempt_artifacts_v1,app.native_mixed_game_evidence_v1 in share mode nowait;
 for row_value in select id from app.native_mixed_game_active_evidence_v1(sid,gid) where start_id=sid and game_id=gid loop
  if app.native_mixed_game_entry_bound_with_start_v1(row_value.id,verified_start)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;end loop;
 select coalesce(jsonb_agg(entry order by sequence),'[]')into h from app.native_mixed_game_active_evidence_v1(sid,gid) where start_id=sid and game_id=gid;
 hd:=app.native_mixed_game_attempt_digest_v1(sid,gid,root->>'startSourceDigest',h,app.native_mixed_game_active_attempt_v1(sid,gid));
 select id into own_participant from app.event_participants where event_id=eid and id in(g.side_a_participant_id,g.side_b_participant_id)and profile_id=actor;
 play_order:=case when own_participant is null then'official'else app.native_mixed_game_play_order_with_start_v1(tid,eid,verified_start,gid,own_participant)end;
 if play_order is null then return null;end if;
 -- A participating Digital official is still blind until their own submission.
 -- Revision/digest permit CAS without revealing another person's score.
 blind:=exists(select 1 from app.event_participants where id in(g.side_a_participant_id,g.side_b_participant_id)and profile_id=actor)
  and not exists(select 1 from app.native_mixed_game_active_evidence_v1(sid,gid) where start_id=sid and game_id=gid and actor_id=actor and entry->>'action'='digital-submit');
 -- Paper preparers cannot copy a prior Digital result either. Once a capture
 -- exists, a nonplaying reviewer needs it for the separate review action.
 blind:=blind or(not exists(select 1 from app.event_participants where id in(g.side_a_participant_id,g.side_b_participant_id)and profile_id=actor)
  and not exists(select 1 from app.native_mixed_game_active_evidence_v1(sid,gid) where start_id=sid and game_id=gid and entry->>'action'='paper-capture'));
 -- A bound dispute may precede the Digital participant's own submission.
 -- Reveal only a read-only status hint, never the hidden independent claims.
 -- Future Paper evidence must not turn an upcoming game into the current game.
 if blind and own_participant is not null and play_order='current'and exists(
  select 1 from app.native_mixed_game_active_evidence_v1(sid,gid)e where e.entry->>'action'='paper-review'and e.entry->>'decision'='disputed-simulation-only')then play_order:='review';end if;
 -- Display DTOs never disclose another account UUID, including to Paper officials. Correlation is
 -- needed only inside this game. The private Start receipt is not exposed to
 -- players and keys the HMAC; canonical journal/hash/own receipt stay unchanged.
 -- Canonical raw journal, digest and owned receipts are unchanged.
 select operation_receipt_id into private_start_key from app.native_mixed_simulation_starts_v1 where id=sid;
  if private_start_key is null then return null;end if;
  select coalesce(jsonb_agg(case when x->>'actorId'=actor::text then x else
   jsonb_set(x,'{actorId}',to_jsonb(substr(encode(extensions.hmac(sid::text||':'||gid::text||':'||(x->>'actorId'),private_start_key::text,'sha256'),'hex'),1,32)::uuid))end order by(x->>'sequence')::integer),'[]')into h from jsonb_array_elements(h)x;
 return jsonb_build_object('kind','native-mixed-simulation-game-state-v1','playOrder',play_order,'actorId',actor,'tournamentId',tid,'eventId',eid,'startId',sid,'gameId',gid,
 'startSourceDigest',root->>'startSourceDigest','revision',jsonb_array_length(h),'historyDigest',hd,'evidenceVisibility',case when blind then 'metadata-only'else 'evidence'end,'entries',case when blind then '[]'::jsonb else h end,'currentSourceVerified',true,
 'simulationOnly',true,'ordinaryScoreWritten',false,'normalStartAuthorized',false,'scoringAuthorized',false,'officialResultVerified',false,'humanPlayVerified',false,'moneyMoved',false,'payoutAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

alter function app.native_mixed_paper_disagreement_enabled_v1()owner to postgres;
revoke all on function app.native_mixed_paper_disagreement_enabled_v1()from public,anon,authenticated,service_role;
alter function app.native_mixed_game_request_valid_v1(jsonb)owner to postgres;
revoke all on function app.native_mixed_game_request_valid_v1(jsonb)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_entry_bound_with_start_v1(uuid,app.native_mixed_simulation_starts_v1)owner to postgres;
revoke all on function app.native_mixed_game_entry_bound_with_start_v1(uuid,app.native_mixed_simulation_starts_v1)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_complete_with_start_v1(uuid,uuid,app.native_mixed_simulation_starts_v1,uuid)owner to postgres;
revoke all on function app.native_mixed_game_complete_with_start_v1(uuid,uuid,app.native_mixed_simulation_starts_v1,uuid)from public,anon,authenticated,service_role;
alter function app.append_native_mixed_simulation_game_evidence_v1(uuid,uuid,jsonb)owner to postgres;
revoke all on function app.append_native_mixed_simulation_game_evidence_v1(uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.native_mixed_game_reopen_block_v1(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function app.native_mixed_game_reopen_block_v1(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
alter function app.get_native_mixed_simulation_game_state_v1(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function app.get_native_mixed_simulation_game_state_v1(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
