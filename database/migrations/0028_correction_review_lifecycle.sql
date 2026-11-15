-- Approval-required correction reviews are immutable, independently authorized,
-- and sequenced explicitly because transaction timestamps alone do not prove order.
-- This is the authoritative pre-results publication guard. It remains Draft and
-- immutable until result-versioning/supersession is implemented in a later migration.
create table app.event_publication_states (
  event_id uuid primary key,
  tournament_id uuid not null,
  state text not null default 'draft' check (state in ('draft', 'published', 'superseded')),
  created_at timestamptz not null default now(),
  foreign key (event_id, tournament_id) references app.events(id, tournament_id) on delete restrict
);
alter table app.event_publication_states enable row level security;
alter table app.event_publication_states force row level security;
revoke all on table app.event_publication_states from public, anon, authenticated;
create trigger event_publication_states_immutable before update or delete on app.event_publication_states
for each row execute function app.reject_immutable_history();
create index event_publication_states_tournament_id_idx on app.event_publication_states(tournament_id);

insert into app.event_publication_states(event_id, tournament_id)
select id, tournament_id from app.events
on conflict (event_id) do nothing;

create or replace function app.provision_event_publication_state()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into app.event_publication_states(event_id, tournament_id) values (new.id, new.tournament_id);
  return new;
end; $$;
revoke all on function app.provision_event_publication_state() from public, anon, authenticated;
drop trigger if exists provision_event_publication_state on app.events;
create trigger provision_event_publication_state after insert on app.events
for each row execute function app.provision_event_publication_state();

alter table app.correction_state_events
  add column transition_sequence smallint not null default 1 check (transition_sequence between 1 and 3),
  add column reviewer_role text check (reviewer_role is null or reviewer_role in ('cross_checker', 'director', 'co_director'));

alter table app.correction_state_events
  add constraint correction_state_events_transition_sequence_unique unique (correction_id, transition_sequence),
  add constraint correction_state_events_reviewer_role_state_check check (
    (state in ('approved', 'rejected') and reviewer_role is not null)
    or (state in ('pending', 'applied') and reviewer_role is null)
  );

create or replace function app.revalidate_correction_lifecycle(p_correction_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_correction app.game_corrections%rowtype;
  v_states text[];
  v_unresolved integer;
begin
  select * into v_correction from app.game_corrections where id = p_correction_id;
  if not found then raise exception 'correction lifecycle references missing correction'; end if;
  select array_agg(state order by transition_sequence) into v_states
    from app.correction_state_events where correction_id = p_correction_id;
  if v_correction.required_approvals = 0 then
    if v_states is distinct from array['applied']::text[] then
      raise exception 'immediate correction requires exactly applied transition';
    end if;
  elsif v_correction.required_approvals = 1 then
    if v_states is distinct from array['pending']::text[]
       and v_states is distinct from array['pending', 'rejected']::text[]
       and v_states is distinct from array['pending', 'approved', 'applied']::text[] then
      raise exception 'approval correction has invalid lifecycle';
    end if;
  else
    raise exception 'correction has invalid approval policy';
  end if;
  select count(*) into v_unresolved
    from app.game_corrections c
    where c.canonical_game_id = v_correction.canonical_game_id
      and c.required_approvals = 1
      and exists (select 1 from app.correction_state_events e where e.correction_id = c.id and e.state = 'pending')
      and not exists (select 1 from app.correction_state_events e where e.correction_id = c.id and e.state in ('approved', 'rejected'));
  if v_unresolved > 1 then raise exception 'game has multiple unresolved corrections'; end if;
end; $$;

create or replace function app.revalidate_correction_lifecycle_from_correction()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app.revalidate_correction_lifecycle(new.id);
  return null;
end; $$;

create or replace function app.revalidate_correction_lifecycle_from_state_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app.revalidate_correction_lifecycle(new.correction_id);
  return null;
end; $$;

drop trigger if exists correction_lifecycle_from_correction on app.game_corrections;
create constraint trigger correction_lifecycle_from_correction
after insert on app.game_corrections deferrable initially deferred
for each row execute function app.revalidate_correction_lifecycle_from_correction();

drop trigger if exists correction_lifecycle_from_state_event on app.correction_state_events;
create constraint trigger correction_lifecycle_from_state_event
after insert on app.correction_state_events deferrable initially deferred
for each row execute function app.revalidate_correction_lifecycle_from_state_event();

revoke all on function app.revalidate_correction_lifecycle(uuid) from public, anon, authenticated;
revoke all on function app.revalidate_correction_lifecycle_from_correction() from public, anon, authenticated;
revoke all on function app.revalidate_correction_lifecycle_from_state_event() from public, anon, authenticated;

create or replace function public.review_game_correction(
  p_correction_id uuid,
  p_decision text,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_correction app.game_corrections%rowtype;
  v_game app.canonical_games%rowtype;
  v_existing app.operation_receipts%rowtype;
  v_hash text;
  v_tournament_status text;
  v_publication_state text;
  v_director_profile_id uuid;
  v_reviewer_role text;
  v_receipt uuid;
  v_response jsonb;
  v_error text;
  v_code text;
begin
  begin
  if v_actor is null then raise exception using errcode = 'P0001', message = 'authentication required'; end if;
  if p_correction_id is null or p_decision is null or p_decision not in ('approve', 'reject') or p_idempotency_key is null then
    raise exception using errcode = 'P0001', message = 'invalid correction review request';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array('review_game_correction', p_correction_id::text, p_decision, p_idempotency_key::text)::text, 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0));
  select * into v_correction from app.game_corrections where id = p_correction_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'correction not found'; end if;
  select * into v_game from app.canonical_games where id = v_correction.canonical_game_id for update;
  if not found or v_game.tournament_id <> v_correction.tournament_id or v_game.event_id <> v_correction.event_id then
    raise exception using errcode = 'P0001', message = 'correction scope invalid';
  end if;
  select * into v_existing from app.operation_receipts where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_hash then raise exception using errcode = 'P0001', message = 'idempotency conflict'; end if;
    return v_existing.response_payload;
  end if;
  select status, director_profile_id into v_tournament_status, v_director_profile_id
    from app.tournaments where id = v_correction.tournament_id for update;
  if v_tournament_status is distinct from 'open' then raise exception using errcode = 'P0001', message = 'correction review requires an open tournament'; end if;
  select state into v_publication_state from app.event_publication_states
    where event_id = v_game.event_id and tournament_id = v_game.tournament_id for update;
  if v_publication_state is distinct from 'draft' then raise exception using errcode = 'P0001', message = 'result publication guard blocks correction'; end if;
  if v_correction.required_approvals <> 1 then raise exception using errcode = 'P0001', message = 'correction does not require review'; end if;
  if not exists (select 1 from app.correction_policy_versions p where p.tournament_id = v_correction.tournament_id
      and p.version = v_correction.policy_version and p.reason_required = v_correction.reason_required
      and p.required_approvals = v_correction.required_approvals) then
    raise exception using errcode = 'P0001', message = 'correction policy snapshot invalid';
  end if;
  if not exists (select 1 from app.correction_state_events e where e.correction_id = p_correction_id and e.state = 'pending' and e.transition_sequence = 1)
     or exists (select 1 from app.correction_state_events e where e.correction_id = p_correction_id and e.state in ('approved', 'rejected', 'applied')) then
    raise exception using errcode = 'P0001', message = 'correction is not pending review';
  end if;
  if v_actor = v_correction.editor_profile_id
     or exists (select 1 from app.event_participants p where p.id in (v_game.side_a_participant_id, v_game.side_b_participant_id) and p.profile_id = v_actor) then
    raise exception using errcode = 'P0001', message = 'reviewer must be independent';
  end if;
  if v_actor = v_director_profile_id then
    v_reviewer_role := 'director';
  else
    select role into v_reviewer_role from app.tournament_roles
      where tournament_id = v_correction.tournament_id and profile_id = v_actor
        and role in ('cross_checker', 'director', 'co_director')
      order by case role when 'director' then 1 when 'co_director' then 2 else 3 end
      limit 1;
  end if;
  if v_reviewer_role is null then raise exception using errcode = 'P0001', message = 'eligible reviewer role required'; end if;
  if p_decision = 'approve' then
    if v_game.state not in ('verified', 'corrected') or v_game.version <> v_correction.base_game_version
       or v_game.winner_side <> v_correction.previous_winner_side or v_game.margin <> v_correction.previous_margin then
      raise exception using errcode = 'P0001', message = 'correction source is stale';
    end if;
    if not exists (select 1 from app.events e join app.ruleset_versions rv
      on rv.id = e.ruleset_version_id and rv.tournament_id = e.tournament_id
      where e.id = v_game.event_id and e.tournament_id = v_game.tournament_id
        and e.format = 'standard_singles' and e.scoring_method = 'digital'
        and rv.format = 'standard_singles' and rv.approved_at is not null) then
      raise exception using errcode = 'P0001', message = 'event is not approved for digital Standard Singles correction';
    end if;
    insert into app.correction_state_events(correction_id,canonical_game_id,tournament_id,event_id,actor_profile_id,state,transition_sequence,reviewer_role)
      values(p_correction_id,v_game.id,v_game.tournament_id,v_game.event_id,v_actor,'approved',2,v_reviewer_role);
    insert into app.correction_state_events(correction_id,canonical_game_id,tournament_id,event_id,actor_profile_id,state,transition_sequence)
      values(p_correction_id,v_game.id,v_game.tournament_id,v_game.event_id,v_actor,'applied',3);
    update app.card_scorelines set is_winner = (side = v_correction.corrected_winner_side), margin = v_correction.corrected_margin,
      plus_points = case when side = v_correction.corrected_winner_side then v_correction.corrected_margin else 0 end,
      minus_points = case when side = v_correction.corrected_winner_side then 0 else v_correction.corrected_margin end,
      game_points = case when side = v_correction.corrected_winner_side then case when v_correction.corrected_margin >= 31 then 3 else 2 end else 0 end
      where canonical_game_id = v_game.id;
    update app.canonical_games set state = 'corrected', winner_side = v_correction.corrected_winner_side,
      margin = v_correction.corrected_margin, version = version + 1 where id = v_game.id;
    v_response := jsonb_build_object('status','approved','decision','approve','correction_id',p_correction_id,'game_id',v_game.id,'version',v_correction.base_game_version + 1);
  else
    insert into app.correction_state_events(correction_id,canonical_game_id,tournament_id,event_id,actor_profile_id,state,transition_sequence,reviewer_role)
      values(p_correction_id,v_game.id,v_game.tournament_id,v_game.event_id,v_actor,'rejected',2,v_reviewer_role);
    v_response := jsonb_build_object('status','rejected','decision','reject','correction_id',p_correction_id,'game_id',v_game.id,'version',v_game.version);
  end if;
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(v_actor,v_game.tournament_id,'review_game_correction',p_correction_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
    values(v_game.tournament_id,v_actor,v_game.id,v_receipt,'game_correction',p_correction_id,
      case when p_decision = 'approve' then 'correction_review_approved' else 'correction_review_rejected' end,
      jsonb_build_object('winnerSide',v_game.winner_side,'margin',v_game.margin,'version',v_game.version),v_response);
  return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'authentication required' then 'authentication_required'
      when 'invalid correction review request' then 'invalid_request'
      when 'correction not found' then 'correction_not_found'
      when 'correction scope invalid' then 'correction_scope_invalid'
      when 'idempotency conflict' then 'idempotency_conflict'
      when 'correction review requires an open tournament' then 'tournament_closed'
      when 'result publication guard blocks correction' then 'result_publication_guarded'
      when 'correction does not require review' then 'review_not_required'
      when 'correction policy snapshot invalid' then 'policy_snapshot_invalid'
      when 'correction is not pending review' then 'not_pending_review'
      when 'reviewer must be independent' then 'reviewer_not_independent'
      when 'eligible reviewer role required' then 'not_eligible_reviewer'
      when 'correction source is stale' then 'stale_correction_source'
      when 'event is not approved for digital Standard Singles correction' then 'event_not_eligible'
      else 'correction_review_rejected' end;
    v_response := jsonb_build_object('status','rejected','code',v_code,'correction_id',p_correction_id);
    if v_error = 'idempotency conflict' then
      insert into app.correction_operation_conflicts(actor_profile_id,canonical_game_id,attempted_idempotency_key,attempted_request_hash,prior_receipt_id,reason_code)
        values(v_actor,v_game.id,p_idempotency_key,coalesce(v_hash,''),v_existing.id,'review_idempotency_conflict');
    elsif v_actor is not null and v_game.tournament_id is not null then
      insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
        values(v_actor,v_game.tournament_id,'review_game_correction',p_correction_id,coalesce(v_hash,''),p_idempotency_key,'rejected',v_response,now()) returning id into v_receipt;
      insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state)
        values(v_game.tournament_id,v_actor,v_game.id,v_receipt,'game_correction',p_correction_id,'correction_review_rejected',v_response);
    end if;
    return v_response;
  when others then raise;
  end;
end; $$;

revoke all on function public.review_game_correction(uuid,text,uuid) from public, anon;
grant execute on function public.review_game_correction(uuid,text,uuid) to authenticated;
