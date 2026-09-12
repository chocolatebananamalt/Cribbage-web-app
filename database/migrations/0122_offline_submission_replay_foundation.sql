-- Durable, actor/session/device-bound offline submission replay. The browser
-- never receives table access; authenticated issuance and service-only replay
-- are the only boundaries.

create table app.offline_device_keys (
  id uuid primary key,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  session_binding_id uuid not null,
  public_jwk jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at),
  check (jsonb_typeof(public_jwk) = 'object'),
  check (public_jwk->>'kty' = 'EC' and public_jwk->>'crv' = 'P-256'),
  check (public_jwk - 'kty' - 'crv' - 'x' - 'y' - 'ext' - 'key_ops' = '{}'::jsonb),
  check (public_jwk->>'ext' = 'true' and public_jwk->'key_ops' = '["verify"]'::jsonb),
  check (not public_jwk ? 'd'),
  check (length(coalesce(public_jwk->>'x','')) between 40 and 60),
  check (length(coalesce(public_jwk->>'y','')) between 40 and 60),
  unique (id, actor_profile_id, session_binding_id)
);

create table app.offline_score_capabilities (
  id uuid primary key,
  device_key_id uuid not null,
  actor_profile_id uuid not null,
  session_binding_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  assigned_side text not null check (assigned_side in ('a','b')),
  submission_slot smallint not null check (submission_slot in (1,2)),
  operation_kind text not null check (operation_kind = 'submission'),
  expected_game_version integer not null check (expected_game_version > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  foreign key (device_key_id, actor_profile_id, session_binding_id)
    references app.offline_device_keys(id, actor_profile_id, session_binding_id) on delete restrict,
  foreign key (canonical_game_id, tournament_id, event_id)
    references app.canonical_games(id, tournament_id, event_id) on delete restrict,
  check (expires_at > created_at),
  unique (id, actor_profile_id, session_binding_id),
  unique (actor_profile_id, session_binding_id, canonical_game_id, operation_kind)
);

create table app.offline_score_replay_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  queue_id uuid not null unique,
  client_operation_id uuid not null,
  capability_id uuid references app.offline_score_capabilities(id) on delete restrict,
  device_key_id uuid not null,
  actor_profile_id uuid not null,
  session_binding_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  submission_id uuid not null,
  payload_digest text not null check (payload_digest ~ '^[0-9a-f]{64}$'),
  signature text not null check (length(signature) between 1 and 256),
  disposition text not null check (disposition in ('accepted','rejected','quarantined','conflict')),
  reason_code text,
  response_payload jsonb not null,
  applied_at timestamptz not null default now(),
  unique (actor_profile_id, client_operation_id),
  unique (capability_id)
);

create table app.offline_score_replay_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  queue_id uuid not null,
  actor_profile_id uuid not null,
  canonical_game_id uuid not null,
  attempted_payload_digest text not null,
  prior_receipt_id uuid references app.offline_score_replay_receipts(id) on delete restrict,
  reason_code text not null,
  recorded_at timestamptz not null default now()
);

create trigger offline_device_keys_immutable before update or delete on app.offline_device_keys
for each row execute function app.reject_immutable_history();
create trigger offline_score_capabilities_immutable before update or delete on app.offline_score_capabilities
for each row execute function app.reject_immutable_history();
create trigger offline_score_replay_receipts_immutable before update or delete on app.offline_score_replay_receipts
for each row execute function app.reject_immutable_history();
create trigger offline_score_replay_conflicts_immutable before update or delete on app.offline_score_replay_conflicts
for each row execute function app.reject_immutable_history();

alter table app.offline_device_keys enable row level security;
alter table app.offline_device_keys force row level security;
alter table app.offline_score_capabilities enable row level security;
alter table app.offline_score_capabilities force row level security;
alter table app.offline_score_replay_receipts enable row level security;
alter table app.offline_score_replay_receipts force row level security;
alter table app.offline_score_replay_conflicts enable row level security;
alter table app.offline_score_replay_conflicts force row level security;
revoke all on table app.offline_device_keys, app.offline_score_capabilities,
  app.offline_score_replay_receipts, app.offline_score_replay_conflicts
  from public, anon, authenticated;

create or replace function public.issue_offline_submission_capability_v1(
  p_actor_id uuid, p_session_binding_id uuid, p_game_id uuid, p_capability_id uuid,
  p_device_key_id uuid, p_public_jwk jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_game app.canonical_games%rowtype;
  v_side text;
  v_slot smallint;
  v_expiry timestamptz := now() + interval '18 hours';
  v_existing app.offline_score_capabilities%rowtype;
  v_existing_jwk jsonb;
begin
  if coalesce(auth.role(),'') <> 'service_role' then return null; end if;
  if p_actor_id is null or p_session_binding_id is null or p_game_id is null or p_capability_id is null or p_device_key_id is null
     or jsonb_typeof(p_public_jwk) <> 'object' or p_public_jwk->>'kty' <> 'EC'
     or p_public_jwk->>'crv' <> 'P-256'
     or p_public_jwk - 'kty' - 'crv' - 'x' - 'y' - 'ext' - 'key_ops' <> '{}'::jsonb
     or p_public_jwk->>'ext' <> 'true'
     or p_public_jwk->'key_ops' <> '["verify"]'::jsonb or p_public_jwk ? 'd'
     or length(coalesce(p_public_jwk->>'x','')) not between 40 and 60
     or length(coalesce(p_public_jwk->>'y','')) not between 40 and 60 then
    return jsonb_build_object('status','rejected','code','invalid_device_key');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text || ':' || p_session_binding_id::text || ':' || p_game_id::text, 0));
  select * into v_existing from app.offline_score_capabilities where id=p_capability_id;
  if found then select public_jwk into v_existing_jwk from app.offline_device_keys where id=v_existing.device_key_id; end if;
  if not found then
    select * into v_existing from app.offline_score_capabilities c
    where c.actor_profile_id=p_actor_id and c.session_binding_id=p_session_binding_id
      and c.canonical_game_id=p_game_id and c.operation_kind='submission';
    if found then select public_jwk into v_existing_jwk from app.offline_device_keys where id=v_existing.device_key_id; end if;
  end if;
  if found then
    if v_existing.actor_profile_id=p_actor_id and v_existing.session_binding_id=p_session_binding_id
       and v_existing.canonical_game_id=p_game_id
       and v_existing_jwk=jsonb_build_object('kty','EC','crv','P-256','x',p_public_jwk->>'x','y',p_public_jwk->>'y','ext',true,'key_ops',jsonb_build_array('verify')) then
      return jsonb_build_object('status','issued','version',1,'capabilityId',v_existing.id,
        'deviceKeyId',v_existing.device_key_id,'verifiedActorId',v_existing.actor_profile_id,
        'sessionBindingId',v_existing.session_binding_id,'tournamentId',v_existing.tournament_id,
        'eventId',v_existing.event_id,'gameId',v_existing.canonical_game_id,
        'assignedSide',v_existing.assigned_side,'submissionSlot',v_existing.submission_slot,
        'expectedGameVersion',v_existing.expected_game_version,
        'capabilityExpiresAtMs',floor(extract(epoch from v_existing.expires_at)*1000)::bigint);
    end if;
    return jsonb_build_object('status','rejected','code','capability_conflict');
  end if;
  select cg.* into v_game from app.canonical_games cg
    join app.tournaments t on t.id=cg.tournament_id and t.status='open'
    join app.events e on e.id=cg.event_id and e.tournament_id=cg.tournament_id
      and e.format='standard_singles' and e.scoring_method='digital'
    join app.ruleset_versions rv on rv.id=e.ruleset_version_id and rv.tournament_id=e.tournament_id
      and rv.format='standard_singles' and rv.approved_at is not null
    join app.event_schedule_games sg on sg.canonical_game_id=cg.id
      and sg.event_id=cg.event_id and sg.tournament_id=cg.tournament_id
    where cg.id=p_game_id and cg.state in ('pending','submitted') for update of cg;
  if not found then return jsonb_build_object('status','rejected','code','game_unavailable'); end if;
  select case when ep.id=v_game.side_a_participant_id then 'a' else 'b' end,
         case when ep.id=v_game.side_a_participant_id then 1 else 2 end
    into v_side, v_slot
    from app.event_participants ep
    where ep.id in (v_game.side_a_participant_id,v_game.side_b_participant_id)
      and ep.event_id=v_game.event_id and ep.tournament_id=v_game.tournament_id
      and ep.profile_id=p_actor_id and ep.status='checked_in';
  if v_side is null then return jsonb_build_object('status','rejected','code','not_assigned'); end if;
  if exists (select 1 from app.score_submissions s where s.canonical_game_id=v_game.id and s.submitter_profile_id=p_actor_id) then
    return jsonb_build_object('status','rejected','code','already_submitted');
  end if;
  insert into app.offline_device_keys(id,actor_profile_id,session_binding_id,public_jwk,expires_at)
    values(p_device_key_id,p_actor_id,p_session_binding_id,jsonb_build_object('kty','EC','crv','P-256','x',p_public_jwk->>'x','y',p_public_jwk->>'y','ext',true,'key_ops',jsonb_build_array('verify')),v_expiry)
    on conflict (id) do nothing;
  if not exists (select 1 from app.offline_device_keys k where k.id=p_device_key_id
      and k.actor_profile_id=p_actor_id and k.session_binding_id=p_session_binding_id
      and k.public_jwk=jsonb_build_object('kty','EC','crv','P-256','x',p_public_jwk->>'x','y',p_public_jwk->>'y','ext',true,'key_ops',jsonb_build_array('verify'))) then
    return jsonb_build_object('status','rejected','code','device_key_conflict');
  end if;
  insert into app.offline_score_capabilities(id,device_key_id,actor_profile_id,session_binding_id,
    tournament_id,event_id,canonical_game_id,assigned_side,submission_slot,operation_kind,
    expected_game_version,expires_at)
  values(p_capability_id,p_device_key_id,p_actor_id,p_session_binding_id,v_game.tournament_id,v_game.event_id,
    v_game.id,v_side,v_slot,'submission',v_game.version,v_expiry);
  return jsonb_build_object('status','issued','version',1,'capabilityId',p_capability_id,
    'deviceKeyId',p_device_key_id,'verifiedActorId',p_actor_id,'sessionBindingId',p_session_binding_id,
    'tournamentId',v_game.tournament_id,'eventId',v_game.event_id,'gameId',v_game.id,
    'assignedSide',v_side,'submissionSlot',v_slot,'expectedGameVersion',v_game.version,
    'capabilityExpiresAtMs',floor(extract(epoch from v_expiry)*1000)::bigint);
end; $$;

create or replace function public.record_offline_submission_rejection_v1(
  p_actor_id uuid, p_session_binding_id uuid, p_queue_id uuid, p_client_operation_id uuid,
  p_device_key_id uuid, p_tournament_id uuid, p_event_id uuid, p_game_id uuid,
  p_submission_id uuid, p_payload_digest text, p_signature text, p_reason_code text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_prior app.offline_score_replay_receipts%rowtype; v_response jsonb;
begin
  if coalesce(auth.role(),'') <> 'service_role' then return null; end if;
  if p_actor_id is null or p_session_binding_id is null or p_queue_id is null or p_client_operation_id is null
     or p_device_key_id is null or p_game_id is null or p_submission_id is null
     or p_payload_digest !~ '^[0-9a-f]{64}$' or length(p_signature) not between 1 and 256
     or p_reason_code not in ('capability_unavailable','scope_mismatch','invalid_signature') then return null; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_queue_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_client_operation_id::text,0));
  select * into v_prior from app.offline_score_replay_receipts
    where queue_id=p_queue_id or (actor_profile_id=p_actor_id and client_operation_id=p_client_operation_id)
    order by (queue_id=p_queue_id) desc limit 1;
  if found then
    if v_prior.queue_id=p_queue_id and v_prior.actor_profile_id=p_actor_id
       and v_prior.client_operation_id=p_client_operation_id and v_prior.payload_digest=p_payload_digest
       and v_prior.signature=p_signature then return v_prior.response_payload; end if;
    insert into app.offline_score_replay_conflicts(queue_id,actor_profile_id,canonical_game_id,
      attempted_payload_digest,prior_receipt_id,reason_code)
    values(p_queue_id,p_actor_id,p_game_id,p_payload_digest,v_prior.id,'changed_replay');
    return jsonb_build_object('version',1,'queueId',p_queue_id,'clientOperationId',p_client_operation_id,
      'kind','submission','gameId',p_game_id,'submissionId',p_submission_id,
      'payloadDigest',p_payload_digest,'disposition','conflict');
  end if;
  if (select count(*) from app.offline_score_replay_receipts r where r.actor_profile_id=p_actor_id and r.applied_at>now()-interval '1 minute') >= 30 then
    return jsonb_build_object('status','rate_limited');
  end if;
  v_response:=jsonb_build_object('version',1,'queueId',p_queue_id,'clientOperationId',p_client_operation_id,
    'kind','submission','gameId',p_game_id,'submissionId',p_submission_id,
    'payloadDigest',p_payload_digest,'disposition','rejected');
  insert into app.offline_score_replay_receipts(queue_id,client_operation_id,capability_id,
    device_key_id,actor_profile_id,session_binding_id,tournament_id,event_id,canonical_game_id,
    submission_id,payload_digest,signature,disposition,reason_code,response_payload)
  values(p_queue_id,p_client_operation_id,null,p_device_key_id,p_actor_id,p_session_binding_id,
    p_tournament_id,p_event_id,p_game_id,p_submission_id,p_payload_digest,p_signature,
    'rejected',p_reason_code,v_response);
  return v_response;
end; $$;

create or replace function public.get_offline_submission_capability_v1(
  p_actor_id uuid, p_session_binding_id uuid, p_capability_id uuid, p_queue_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when coalesce(auth.role(),'')='service_role' then (
    select jsonb_build_object('capabilityId',c.id,'deviceKeyId',c.device_key_id,
      'verifiedActorId',c.actor_profile_id,'sessionBindingId',c.session_binding_id,
      'tournamentId',c.tournament_id,'eventId',c.event_id,'gameId',c.canonical_game_id,
      'assignedSide',c.assigned_side,'submissionSlot',c.submission_slot,
      'expectedGameVersion',c.expected_game_version,
      'capabilityExpiresAtMs',floor(extract(epoch from c.expires_at)*1000)::bigint,
      'publicJwk',k.public_jwk,
      'priorReceipt',case when r.id is null then null else jsonb_build_object(
        'queueId',r.queue_id,'clientOperationId',r.client_operation_id,
        'submissionId',r.submission_id,'payloadDigest',r.payload_digest,
        'signature',r.signature,'response',r.response_payload) end)
    from app.offline_score_capabilities c join app.offline_device_keys k on k.id=c.device_key_id
    left join app.offline_score_replay_receipts r on r.queue_id=p_queue_id
      and r.actor_profile_id=p_actor_id and r.session_binding_id=p_session_binding_id
      and r.capability_id=c.id
    where c.id=p_capability_id and c.actor_profile_id=p_actor_id
      and c.session_binding_id=p_session_binding_id
      and ((c.expires_at>now() and k.expires_at>now()) or r.id is not null)
  ) else null end
$$;

create or replace function public.replay_offline_submission_v1(
  p_actor_id uuid, p_session_binding_id uuid, p_queue_id uuid, p_client_operation_id uuid,
  p_capability_id uuid, p_device_key_id uuid, p_tournament_id uuid, p_event_id uuid,
  p_game_id uuid, p_assigned_side text, p_expected_game_version integer,
  p_submission_id uuid, p_submission_slot smallint, p_winner_side text, p_margin integer,
  p_payload_digest text, p_signature text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cap app.offline_score_capabilities%rowtype;
  v_game app.canonical_games%rowtype;
  v_prior app.offline_score_replay_receipts%rowtype;
  v_score jsonb;
  v_disposition text;
  v_reason text;
  v_response jsonb;
begin
  if coalesce(auth.role(),'') <> 'service_role' then return null; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_queue_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_client_operation_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_capability_id::text,0));
  select * into v_prior from app.offline_score_replay_receipts
    where queue_id=p_queue_id or (actor_profile_id=p_actor_id and client_operation_id=p_client_operation_id)
      or capability_id=p_capability_id
    order by (queue_id=p_queue_id) desc limit 1;
  if found then
    if v_prior.queue_id=p_queue_id and v_prior.payload_digest=p_payload_digest
       and v_prior.actor_profile_id=p_actor_id and v_prior.client_operation_id=p_client_operation_id
       and v_prior.capability_id=p_capability_id and v_prior.signature=p_signature then return v_prior.response_payload; end if;
    insert into app.offline_score_replay_conflicts(queue_id,actor_profile_id,canonical_game_id,
      attempted_payload_digest,prior_receipt_id,reason_code)
    values(p_queue_id,p_actor_id,p_game_id,coalesce(p_payload_digest,''),v_prior.id,'changed_replay');
    return jsonb_build_object('version',1,'queueId',p_queue_id,'clientOperationId',p_client_operation_id,
      'kind','submission','gameId',p_game_id,'submissionId',p_submission_id,
      'payloadDigest',p_payload_digest,'disposition','conflict');
  end if;
  select * into v_cap from app.offline_score_capabilities c where c.id=p_capability_id for share;
  if not found or v_cap.actor_profile_id<>p_actor_id or v_cap.session_binding_id<>p_session_binding_id
     or v_cap.device_key_id<>p_device_key_id or v_cap.tournament_id<>p_tournament_id
     or v_cap.event_id<>p_event_id or v_cap.canonical_game_id<>p_game_id
     or v_cap.assigned_side<>p_assigned_side or v_cap.submission_slot<>p_submission_slot
     or v_cap.expected_game_version<>p_expected_game_version or v_cap.expires_at<=now() then
    v_disposition:='rejected'; v_reason:='invalid_or_expired_capability';
  elsif p_winner_side not in ('a','b') or p_margin not between 1 and 121
     or p_payload_digest !~ '^[0-9a-f]{64}$' or length(p_signature) not between 1 and 256 then
    v_disposition:='rejected'; v_reason:='invalid_submission';
  else
    select * into v_game from app.canonical_games where id=p_game_id for update;
    if not found or v_game.tournament_id<>p_tournament_id or v_game.event_id<>p_event_id
       or v_game.state not in ('pending','submitted')
       or v_game.version not between p_expected_game_version and p_expected_game_version+1
       or exists (select 1 from app.score_submissions s where s.canonical_game_id=p_game_id and s.submitter_profile_id=p_actor_id) then
      v_disposition:='quarantined'; v_reason:='stale_or_conflicting_game';
    else
      perform set_config('request.jwt.claim.sub',p_actor_id::text,true);
      v_score:=public.submit_game_score(p_game_id,p_submission_id,p_submission_slot,p_winner_side,p_margin,p_client_operation_id);
      if v_score->>'status'='rejected' then v_disposition:='rejected'; v_reason:=v_score->>'code';
      else v_disposition:='accepted'; end if;
    end if;
  end if;
  v_response:=jsonb_build_object('version',1,'queueId',p_queue_id,
    'clientOperationId',p_client_operation_id,'kind','submission','gameId',p_game_id,
    'submissionId',p_submission_id,'payloadDigest',p_payload_digest,
    'disposition',v_disposition,'score',v_score,'reasonCode',v_reason);
  insert into app.offline_score_replay_receipts(queue_id,client_operation_id,capability_id,
    device_key_id,actor_profile_id,session_binding_id,tournament_id,event_id,canonical_game_id,
    submission_id,payload_digest,signature,disposition,reason_code,response_payload)
  values(p_queue_id,p_client_operation_id,p_capability_id,p_device_key_id,p_actor_id,
    p_session_binding_id,p_tournament_id,p_event_id,p_game_id,p_submission_id,
    p_payload_digest,p_signature,v_disposition,v_reason,v_response);
  insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,entity_type,
    entity_id,action,after_state)
  values(p_tournament_id,p_actor_id,p_game_id,'canonical_game',p_game_id,
    'offline_submission_'||v_disposition,v_response);
  return v_response;
end; $$;

revoke all on function public.issue_offline_submission_capability_v1(uuid,uuid,uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.issue_offline_submission_capability_v1(uuid,uuid,uuid,uuid,uuid,jsonb) to service_role;
revoke all on function public.record_offline_submission_rejection_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.record_offline_submission_rejection_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text) to service_role;
revoke all on function public.get_offline_submission_capability_v1(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_offline_submission_capability_v1(uuid,uuid,uuid,uuid) to service_role;
revoke all on function public.replay_offline_submission_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,integer,uuid,smallint,text,integer,text,text) from public, anon, authenticated;
grant execute on function public.replay_offline_submission_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,integer,uuid,smallint,text,integer,text,text) to service_role;
